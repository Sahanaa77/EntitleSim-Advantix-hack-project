from __future__ import annotations
import time
from typing import Any, Dict, List, Optional, Tuple

from entitlesim.engine.events import Event
from entitlesim.engine.invariants import check_all_invariants
from entitlesim.engine.model import ParsedModel
from entitlesim.engine.protocol import MinResult, ViolationResult
from entitlesim.engine.reference import ReferenceOracle
from entitlesim.engine.sut import EntitlementService


def test_trace_for_violation(
    model: ParsedModel,
    events: List[Event],
    target_inv_id: str,
    fixed: bool = False,
) -> Tuple[bool, Optional[ViolationResult], List[Dict[str, Any]]]:
    sut = EntitlementService(fixed=fixed, model=model)
    oracle = ReferenceOracle(model)
    delivered: List[Event] = []
    state_diffs: List[Dict[str, Any]] = []
    violation_found: Optional[ViolationResult] = None

    for step_idx, ev in enumerate(events):
        step_num = step_idx + 1
        pre_snapshots = {t: sut.get_tenant_snapshot(t) for t in model.tenants}

        sut.handle_event(ev)
        delivered.append(ev)

        expected_states = oracle.compute_state(delivered)

        step_violations = check_all_invariants(
            step=step_num,
            event=ev,
            sut=sut,
            expected_states=expected_states,
            model=model,
            pre_event_snapshots=pre_snapshots,
        )

        matched_violation = next((v for v in step_violations if v.id == target_inv_id), None)
        if matched_violation and not violation_found:
            violation_found = matched_violation

        # Record state diff for tenant
        t_id = ev.tenant
        exp_snap = expected_states.get(t_id)
        obs_snap = sut.get_tenant_snapshot(t_id)

        diff_item = {
            "step": step_num,
            "event": ev.to_dict(),
            "expected": exp_snap.to_dict() if exp_snap else {},
            "observed": obs_snap,
            "is_offending": bool(matched_violation is not None),
        }
        if matched_violation:
            diff_item["violation"] = {
                "id": matched_violation.id,
                "tenant": matched_violation.tenant,
                "message": matched_violation.message,
            }
        state_diffs.append(diff_item)

    return (violation_found is not None), violation_found, state_diffs


class TraceMinimizer:
    def __init__(self, model: ParsedModel):
        self.model = model

    def minimize(
        self,
        trace_data: List[Dict[str, Any]],
        inv_id: str,
        fixed: bool = False,
    ) -> MinResult:
        start_time = time.perf_counter()
        events = [Event.from_dict(d) for d in trace_data]
        original_len = len(events)

        if original_len <= 1:
            _, violation, diffs = test_trace_for_violation(self.model, events, inv_id, fixed=fixed)
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return MinResult(
                original_len=original_len,
                minimal_len=len(events),
                minimal_trace=[e.to_dict() for e in events],
                state_diffs=diffs,
                replays=1,
                duration_ms=round(duration_ms, 2),
                violation=violation,
            )

        c = list(events)
        n = 2
        replays = 0
        last_diffs: List[Dict[str, Any]] = []
        last_violation: Optional[ViolationResult] = None

        # Verify initial failure
        violates, last_violation, last_diffs = test_trace_for_violation(self.model, c, inv_id, fixed=fixed)
        replays += 1
        if not violates:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return MinResult(
                original_len=original_len,
                minimal_len=len(c),
                minimal_trace=[e.to_dict() for e in c],
                state_diffs=last_diffs,
                replays=replays,
                duration_ms=round(duration_ms, 2),
                violation=last_violation,
            )

        # Delta Debugging (ddmin) loop
        while len(c) >= 2:
            chunk_size = len(c) // n
            chunks = []
            for i in range(n):
                start = i * chunk_size
                end = len(c) if i == n - 1 else (i + 1) * chunk_size
                chunks.append(c[start:end])

            reduced = False

            # 1. Try complements (c \ chunk_i)
            for i in range(n):
                complement = [item for j, chunk in enumerate(chunks) if j != i for item in chunk]
                if not complement:
                    continue
                replays += 1
                v, viol, diffs = test_trace_for_violation(self.model, complement, inv_id, fixed=fixed)
                if v:
                    c = complement
                    last_violation = viol
                    last_diffs = diffs
                    n = max(n - 1, 2)
                    reduced = True
                    break

            if reduced:
                continue

            # 2. Try sub-chunks (chunk_i) if n < len(c)
            if n < len(c):
                for chunk in chunks:
                    if len(chunk) == len(c):
                        continue
                    replays += 1
                    v, viol, diffs = test_trace_for_violation(self.model, chunk, inv_id, fixed=fixed)
                    if v:
                        c = chunk
                        last_violation = viol
                        last_diffs = diffs
                        n = 2
                        reduced = True
                        break

            if reduced:
                continue

            # 3. Increase granularity if possible
            if n < len(c):
                n = min(len(c), 2 * n)
            else:
                break  # 1-minimal reached

        # Final recomputation of diffs for the minimal trace
        _, last_violation, last_diffs = test_trace_for_violation(self.model, c, inv_id, fixed=fixed)

        duration_ms = (time.perf_counter() - start_time) * 1000.0
        return MinResult(
            original_len=original_len,
            minimal_len=len(c),
            minimal_trace=[e.to_dict() for e in c],
            state_diffs=last_diffs,
            replays=replays,
            duration_ms=round(duration_ms, 2),
            violation=last_violation,
        )
