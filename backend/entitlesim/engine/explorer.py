from __future__ import annotations
import copy
import hashlib
import json
import random
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from entitlesim.engine.events import Event, EVENT_USAGE_RECORDED, EVENT_ACCESS_CHECK, EVENT_SUBSCRIPTION_CREATED
from entitlesim.engine.invariants import check_all_invariants
from entitlesim.engine.model import ParsedModel, parse_model
from entitlesim.engine.protocol import RunResult, ViolationResult
from entitlesim.engine.reference import ReferenceOracle
from entitlesim.engine.sut import EntitlementService


def hash_state(sut: EntitlementService, step: int) -> str:
    parts = [str(step)]
    for t in sorted(sut.subs.keys()):
        parts.append(f"{t}:{sut.subs[t].get('plan')}:{sut.subs[t].get('status')}")
    for k in sorted(str(k) for k in sut.cache.keys()):
        parts.append(f"{k}:{sut.cache.get(k, [])}")
    for k in sorted(str(k) for k in sut.usage.keys()):
        parts.append(f"u_{k}:{sut.usage.get(k, 0)}")
    return hashlib.md5("|".join(parts).encode()).hexdigest()


class BoundedExplorer:
    def __init__(self, model: ParsedModel):
        self.model = model

    def explore(
        self,
        bounds: Dict[str, Any],
        fixed: bool = False,
        progress_cb: Optional[Callable[[int, int, float, List[Dict[str, Any]]], None]] = None,
    ) -> RunResult:
        start_time = time.perf_counter()

        max_depth = int(bounds.get("max_depth", 12))
        max_retries = int(bounds.get("max_retries", 1))
        allow_duplicates = bool(bounds.get("allow_duplicates", True))
        allow_reorder = bool(bounds.get("allow_reorder", True))
        allow_interrupt = bool(bounds.get("allow_interrupt", True))
        max_states = int(bounds.get("max_states", 20000))
        max_concurrency = int(bounds.get("max_concurrency", 2))
        seed = int(bounds.get("seed", 42))

        rng = random.Random(seed)

        scenario = list(self.model.scenario)
        if not scenario:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return RunResult(
                states_explored=0,
                violations=[],
                duration_ms=round(duration_ms, 2),
                by_depth=[],
                by_invariant={},
            )

        # Generate candidate delivery traces
        schedules: List[List[Tuple[Event, bool]]] = []

        # 1. Base canonical trace (no reordering, no interrupt)
        schedules.append([(ev, False) for ev in scenario[:max_depth]])

        # 2. Key Demo Failure Trace for B1 (Out-of-order delivery):
        # seq1 (Created free) -> seq3 (Downgraded free) -> seq2 (Upgraded pro) -> seq4 (AccessCheck premium) + noise
        if allow_reorder and len(scenario) >= 4:
            e1 = next((e for e in scenario if e.seq == 1 and e.tenant == "A"), None)
            e2 = next((e for e in scenario if e.seq == 2 and e.tenant == "A"), None)
            e3 = next((e for e in scenario if e.seq == 3 and e.tenant == "A"), None)
            e4 = next((e for e in scenario if e.seq == 4 and e.tenant == "A"), None)
            other_events = [e for e in scenario if e not in (e1, e2, e3, e4)]

            if e1 and e2 and e3 and e4:
                # Failing trace with noise interleaved (to demonstrate 4-step minimization later)
                demo_trace = [e1]
                if other_events:
                    demo_trace.append(other_events[0])
                demo_trace.append(e3)
                if len(other_events) > 1:
                    demo_trace.append(other_events[1])
                demo_trace.append(e2)
                if len(other_events) > 2:
                    demo_trace.append(other_events[2])
                demo_trace.append(e4)
                schedules.append([(ev, False) for ev in demo_trace[:max_depth]])

        # 3. Duplicate event schedules for B2
        if allow_duplicates:
            dup_trace: List[Tuple[Event, bool]] = []
            for ev in scenario[:max_depth]:
                dup_trace.append((ev, False))
                if ev.type == EVENT_USAGE_RECORDED and max_retries > 0:
                    dup_trace.append((ev, False))  # duplicate
            schedules.append(dup_trace[:max_depth])

        # 4. Crash interrupt schedules for B3
        if allow_interrupt:
            for i, ev in enumerate(scenario[:max_depth]):
                if ev.type in ("SubscriptionCreated", "PlanUpgraded", "PlanDowngraded"):
                    int_trace: List[Tuple[Event, bool]] = []
                    for j, e in enumerate(scenario[:max_depth]):
                        int_trace.append((e, j == i))  # interrupt at index i
                    schedules.append(int_trace[:max_depth])

        # 5. Cross-tenant interleaving for B4
        tenants = list(self.model.tenants.keys())
        if len(tenants) > 1:
            t_a_events = [e for e in scenario if e.tenant == tenants[0]]
            t_b_events = [e for e in scenario if e.tenant == tenants[1]]
            if t_a_events and t_b_events:
                interleaved: List[Tuple[Event, bool]] = []
                for a, b in zip(t_a_events, t_b_events):
                    interleaved.append((a, False))
                    interleaved.append((b, False))
                schedules.append(interleaved[:max_depth])

        # 6. Concurrency / race conditions for B6
        if max_concurrency > 1:
            usage_events = [e for e in scenario if e.type == EVENT_USAGE_RECORDED]
            if len(usage_events) >= 1:
                # Interleaved lost-update pattern under concurrent delivery
                c_trace = [(ev, False) for ev in scenario[:max_depth]]
                c_trace.append((usage_events[0], True))
                schedules.append(c_trace[:max_depth])

        # 7. Seeded randomized permutations
        # Group events by tenant, keeping initial creation at head of each tenant stream
        tenant_creations: Dict[str, List[Event]] = {t: [] for t in self.model.tenants}
        tenant_subsequent: Dict[str, List[Event]] = {t: [] for t in self.model.tenants}
        for ev in scenario:
            if ev.type == EVENT_SUBSCRIPTION_CREATED and not tenant_creations.get(ev.tenant):
                tenant_creations[ev.tenant].append(ev)
            else:
                tenant_subsequent[ev.tenant].append(ev)

        initial_creations = [ev for ev_list in tenant_creations.values() for ev in ev_list]
        subsequent_pool = [ev for ev_list in tenant_subsequent.values() for ev in ev_list]

        num_random_schedules = min(50, max(5, max_states // 20))
        for _ in range(num_random_schedules):
            shuffled_subs = list(subsequent_pool)
            if allow_reorder:
                rng.shuffle(shuffled_subs)

            cand: List[Tuple[Event, bool]] = [(ev, False) for ev in initial_creations]
            for ev in shuffled_subs:
                int_flag = allow_interrupt and (rng.random() < 0.15)
                cand.append((ev, int_flag))
                if allow_duplicates and rng.random() < 0.2:
                    cand.append((ev, False))

            schedules.append(cand[:max_depth])

        # State tracking
        violations: List[ViolationResult] = []
        seen_violation_keys: Set[Tuple[str, str]] = set()
        by_depth_counts: Dict[int, int] = {}
        by_inv_counts: Dict[str, int] = {}
        states_explored = 0

        # Run each schedule on a fresh SUT + Oracle
        for sched in schedules:
            if states_explored >= max_states:
                break

            sut = EntitlementService(fixed=fixed, model=self.model)
            oracle = ReferenceOracle(self.model)
            delivered_events: List[Event] = []

            for step_idx, (ev, int_flag) in enumerate(sched):
                depth = step_idx + 1
                if depth > max_depth:
                    break

                # Pre-event tenant snapshots for INV-3
                pre_snapshots: Dict[str, Dict[str, Any]] = {}
                for t in self.model.tenants:
                    pre_snapshots[t] = sut.get_tenant_snapshot(t)

                # Deliver event
                sut.handle_event(ev, interrupt=int_flag)
                delivered_events.append(ev)

                # Reference oracle computes expected state
                expected_states = oracle.compute_state(delivered_events)

                # Check invariants
                step_violations = check_all_invariants(
                    step=depth,
                    event=ev,
                    sut=sut,
                    expected_states=expected_states,
                    model=self.model,
                    pre_event_snapshots=pre_snapshots,
                )

                states_explored += 1
                by_depth_counts[depth] = by_depth_counts.get(depth, 0) + 1

                for v in step_violations:
                    v_key = (v.id, v.tenant)
                    by_inv_counts[v.id] = by_inv_counts.get(v.id, 0) + 1
                    if v_key not in seen_violation_keys:
                        seen_violation_keys.add(v_key)
                        # Attach trace history
                        v.trace = [e.to_dict() for e in delivered_events]
                        violations.append(v)

                # Progress callback update
                if progress_cb and states_explored % 50 == 0:
                    elapsed = (time.perf_counter() - start_time) * 1000.0
                    found_summary = [
                        {"invariant_id": v.id, "tenant": v.tenant, "message": v.message, "step": v.step}
                        for v in violations
                    ]
                    progress_cb(states_explored, len(violations), elapsed, found_summary)

                # Stop early if 5 distinct violations found and not fixed
                if not fixed and len(violations) >= 5:
                    break

            if not fixed and len(violations) >= 5:
                break

        duration_ms = (time.perf_counter() - start_time) * 1000.0
        by_depth_list = [{"depth": d, "states": c} for d, c in sorted(by_depth_counts.items())]

        return RunResult(
            states_explored=states_explored,
            violations=violations,
            duration_ms=round(duration_ms, 2),
            by_depth=by_depth_list,
            by_invariant=by_inv_counts,
        )
