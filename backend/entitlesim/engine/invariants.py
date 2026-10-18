from __future__ import annotations
from typing import Any, Dict, List, Optional
from entitlesim.engine.events import Event, EVENT_ACCESS_CHECK
from entitlesim.engine.model import ParsedModel
from entitlesim.engine.protocol import ViolationResult
from entitlesim.engine.reference import TenantState
from entitlesim.engine.sut import EntitlementService


def check_inv1_feature_access(
    step: int,
    tenant_id: str,
    sut: EntitlementService,
    expected_state: TenantState,
    event: Optional[Event] = None,
) -> Optional[ViolationResult]:
    # Feature access matches plan: evaluated on AccessCheck
    if event and event.type == EVENT_ACCESS_CHECK and event.tenant == tenant_id:
        sut_granted = sut.last_access_granted.get(tenant_id, False)
        exp_granted = expected_state.last_access_granted if expected_state.last_access_granted is not None else False

        # Unauthorized premium access
        if sut_granted and not exp_granted:
            return ViolationResult(
                id="INV-1",
                tenant=tenant_id,
                message=f"Unauthorized premium access granted to tenant {tenant_id}",
                expected=list(expected_state.features),
                observed=list(sut.get_tenant_features(tenant_id)),
                step=step,
            )

        # Paid feature denied
        if exp_granted and not sut_granted:
            return ViolationResult(
                id="INV-1",
                tenant=tenant_id,
                message=f"Paid premium feature denied for tenant {tenant_id}",
                expected=list(expected_state.features),
                observed=list(sut.get_tenant_features(tenant_id)),
                step=step,
            )

    return None


def check_inv2_usage_within_quota(
    step: int,
    tenant_id: str,
    sut: EntitlementService,
    expected_state: TenantState,
    model: ParsedModel,
) -> Optional[ViolationResult]:
    sut_usage = sut.get_tenant_usage(tenant_id)
    expected_usage = expected_state.usage

    # Check usage count matches reference (catches double-counting B2 / lost update B6)
    if sut_usage != expected_usage:
        return ViolationResult(
            id="INV-2",
            tenant=tenant_id,
            message=f"Usage counter mismatch for tenant {tenant_id}: observed {sut_usage}, expected {expected_usage}",
            expected={"usage": expected_usage},
            observed={"usage": sut_usage},
            step=step,
        )

    # Check quota limit
    plan = expected_state.plan
    if plan in model.plans:
        plan_quota = model.plans[plan].quota.get("api_calls", float("inf"))
        allowed_total = plan_quota + model.policies.prepaid_credits
        if sut_usage > allowed_total:
            return ViolationResult(
                id="INV-2",
                tenant=tenant_id,
                message=f"Usage exceeds quota ({sut_usage} > {allowed_total}) for tenant {tenant_id}",
                expected={"max_quota": allowed_total},
                observed={"usage": sut_usage},
                step=step,
            )

    return None


def check_inv3_tenant_isolation(
    step: int,
    current_event_tenant: str,
    other_tenant: str,
    pre_event_snapshot: Dict[str, Any],
    post_event_sut: EntitlementService,
) -> Optional[ViolationResult]:
    """INV-3: after an event for tenant X, tenant Y's state snapshot must be unchanged."""
    if current_event_tenant == other_tenant:
        return None

    post_snapshot = post_event_sut.get_tenant_snapshot(other_tenant)
    if (
        post_snapshot["plan"] != pre_event_snapshot.get("plan")
        or set(post_snapshot["features"]) != set(pre_event_snapshot.get("features", []))
        or post_snapshot["usage"] != pre_event_snapshot.get("usage")
    ):
        return ViolationResult(
            id="INV-3",
            tenant=other_tenant,
            message=f"Cross-tenant isolation violation: event for tenant {current_event_tenant} mutated state of tenant {other_tenant}",
            expected=pre_event_snapshot,
            observed=post_snapshot,
            step=step,
        )

    return None


def check_inv4_no_access_after_cancel(
    step: int,
    tenant_id: str,
    sut: EntitlementService,
    expected_state: TenantState,
) -> Optional[ViolationResult]:
    if expected_state.status == "cancelled":
        sut_features = sut.get_tenant_features(tenant_id)
        if "premium" in sut_features or "basic" in sut_features:
            return ViolationResult(
                id="INV-4",
                tenant=tenant_id,
                message=f"Access retained after cancellation for tenant {tenant_id}",
                expected={"features": []},
                observed={"features": sut_features},
                step=step,
            )
    return None


def check_inv5_cache_db_consistent(
    step: int,
    tenant_id: str,
    sut: EntitlementService,
    model: ParsedModel,
) -> Optional[ViolationResult]:
    sub = sut.get_tenant_sub(tenant_id)
    sub_plan = sub.get("plan", "none")
    cache_features = set(sut.get_tenant_features(tenant_id))

    expected_features = set()
    if sub.get("status") != "cancelled" and sub_plan in model.plans:
        expected_features = set(model.plans[sub_plan].features)

    if cache_features != expected_features:
        return ViolationResult(
            id="INV-5",
            tenant=tenant_id,
            message=f"Cache and DB state out of sync for tenant {tenant_id}: DB plan '{sub_plan}' vs cache features {list(cache_features)}",
            expected={"plan": sub_plan, "features": list(expected_features)},
            observed={"cache_features": list(cache_features)},
            step=step,
        )
    return None


def check_all_invariants(
    step: int,
    event: Event,
    sut: EntitlementService,
    expected_states: Dict[str, TenantState],
    model: ParsedModel,
    pre_event_snapshots: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[ViolationResult]:
    violations: List[ViolationResult] = []

    t_id = event.tenant
    exp = expected_states.get(t_id, TenantState(tenant_id=t_id))

    # Evaluate state/plan invariants on the active event tenant
    v1 = check_inv1_feature_access(step, t_id, sut, exp, event)
    if v1:
        violations.append(v1)

    v2 = check_inv2_usage_within_quota(step, t_id, sut, exp, model)
    if v2:
        violations.append(v2)

    v4 = check_inv4_no_access_after_cancel(step, t_id, sut, exp)
    if v4:
        violations.append(v4)

    v5 = check_inv5_cache_db_consistent(step, t_id, sut, model)
    if v5:
        violations.append(v5)

    # Invariant 3: Tenant isolation - check that OTHER tenants are NOT mutated by this event
    if pre_event_snapshots:
        for other_t in model.tenants:
            if other_t != t_id:
                pre_snap = pre_event_snapshots.get(other_t, {})
                v3 = check_inv3_tenant_isolation(step, t_id, other_t, pre_snap, sut)
                if v3:
                    violations.append(v3)

    return violations


def check_all(sut: EntitlementService, model: Optional[ParsedModel] = None) -> List[ViolationResult]:
    """Helper for regression tests."""
    m = model or sut.model
    if not m:
        return []
    violations: List[ViolationResult] = []
    for t_id in m.tenants:
        v5 = check_inv5_cache_db_consistent(1, t_id, sut, m)
        if v5:
            violations.append(v5)
        # Check if tenant has unauthorized premium feature in cache
        sub = sut.get_tenant_sub(t_id)
        sub_plan = sub.get("plan", "none")
        features = sut.get_tenant_features(t_id)
        if "premium" in features and sub_plan != "pro":
            violations.append(
                ViolationResult(
                    id="INV-1",
                    tenant=t_id,
                    message=f"Unauthorized premium access granted to tenant {t_id}",
                    expected=list(m.plans.get(sub_plan, {}).get("features", [])),
                    observed=features,
                    step=1,
                )
            )
    return violations
