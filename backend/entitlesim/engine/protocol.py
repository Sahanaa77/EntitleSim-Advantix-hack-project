from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol, runtime_checkable


@dataclass
class ViolationResult:
    id: str
    tenant: str
    message: str
    expected: Any
    observed: Any
    step: int
    trace: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class RunResult:
    states_explored: int
    violations: List[ViolationResult]
    duration_ms: float
    by_depth: List[Dict[str, Any]]
    by_invariant: Dict[str, int]


@dataclass
class MinResult:
    original_len: int
    minimal_len: int
    minimal_trace: List[Dict[str, Any]]
    state_diffs: List[Dict[str, Any]]
    replays: int
    duration_ms: float
    violation: Optional[ViolationResult] = None


@dataclass
class ReplayResult:
    passed: bool
    violations: List[ViolationResult]
    trace_results: List[Dict[str, Any]]


@runtime_checkable
class EngineProtocol(Protocol):
    """Protocol for model exploration, minimization, and replaying."""

    def explore(
        self,
        model: Dict[str, Any],
        bounds: Dict[str, Any],
        fixed: bool = False,
        progress_cb: Optional[Callable[[int, int, float, List[Dict[str, Any]]], None]] = None,
    ) -> RunResult:
        ...

    def minimize(
        self,
        model: Dict[str, Any],
        trace: List[Dict[str, Any]],
        inv_id: str,
        fixed: bool = False,
    ) -> MinResult:
        ...

    def replay(
        self,
        model: Dict[str, Any],
        trace: List[Dict[str, Any]],
        fixed: bool = False,
    ) -> ReplayResult:
        ...


class VerificationEngine:
    """In-memory verification engine conforming to EngineProtocol."""

    def explore(
        self,
        model: Dict[str, Any],
        bounds: Dict[str, Any],
        fixed: bool = False,
        progress_cb: Optional[Callable[[int, int, float, List[Dict[str, Any]]], None]] = None,
    ) -> RunResult:
        from entitlesim.engine.explorer import BoundedExplorer
        from entitlesim.engine.model import parse_model

        parsed = parse_model(model)
        explorer = BoundedExplorer(parsed)
        return explorer.explore(bounds, fixed=fixed, progress_cb=progress_cb)

    def minimize(
        self,
        model: Dict[str, Any],
        trace: List[Dict[str, Any]],
        inv_id: str,
        fixed: bool = False,
    ) -> MinResult:
        from entitlesim.engine.minimizer import TraceMinimizer
        from entitlesim.engine.model import parse_model

        parsed = parse_model(model)
        minimizer = TraceMinimizer(parsed)
        return minimizer.minimize(trace, inv_id, fixed=fixed)

    def replay(
        self,
        model: Dict[str, Any],
        trace: List[Dict[str, Any]],
        fixed: bool = False,
    ) -> ReplayResult:
        from entitlesim.engine.events import Event
        from entitlesim.engine.invariants import check_all_invariants
        from entitlesim.engine.model import parse_model
        from entitlesim.engine.reference import ReferenceOracle
        from entitlesim.engine.sut import EntitlementService

        parsed = parse_model(model)
        sut = EntitlementService(fixed=fixed, model=parsed)
        oracle = ReferenceOracle(parsed)
        events = [Event.from_dict(d) for d in trace]

        delivered: List[Event] = []
        violations: List[ViolationResult] = []
        trace_results: List[Dict[str, Any]] = []

        for step_idx, ev in enumerate(events):
            step_num = step_idx + 1
            pre_snapshots = {t: sut.get_tenant_snapshot(t) for t in parsed.tenants}

            sut.handle_event(ev)
            delivered.append(ev)

            expected_states = oracle.compute_state(delivered)
            step_viols = check_all_invariants(
                step=step_num,
                event=ev,
                sut=sut,
                expected_states=expected_states,
                model=parsed,
                pre_event_snapshots=pre_snapshots,
            )
            violations.extend(step_viols)

            trace_results.append(
                {
                    "step": step_num,
                    "event": ev.to_dict(),
                    "expected": expected_states.get(ev.tenant).to_dict()
                    if expected_states.get(ev.tenant)
                    else {},
                    "observed": sut.get_tenant_snapshot(ev.tenant),
                    "violations": [
                        {"id": v.id, "tenant": v.tenant, "message": v.message}
                        for v in step_viols
                    ],
                }
            )

        return ReplayResult(
            passed=(len(violations) == 0),
            violations=violations,
            trace_results=trace_results,
        )


def get_engine() -> EngineProtocol:
    return VerificationEngine()
