from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set
from entitlesim.engine.events import (
    Event,
    EVENT_SUBSCRIPTION_CREATED,
    EVENT_PLAN_UPGRADED,
    EVENT_PLAN_DOWNGRADED,
    EVENT_PAYMENT_SUCCEEDED,
    EVENT_PAYMENT_FAILED,
    EVENT_SUBSCRIPTION_CANCELLED,
    EVENT_USAGE_RECORDED,
    EVENT_ACCESS_CHECK,
)
from entitlesim.engine.model import ParsedModel


@dataclass
class TenantState:
    tenant_id: str
    plan: str = "none"
    status: str = "none"  # "none", "active", "past_due", "cancelled"
    features: List[str] = field(default_factory=list)
    usage: int = 0
    credits: int = 0
    trial_remaining: int = 0
    grace_remaining: int = 0
    last_access_granted: Optional[bool] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tenant_id": self.tenant_id,
            "plan": self.plan,
            "status": self.status,
            "features": list(self.features),
            "usage": self.usage,
            "credits": self.credits,
            "trial_remaining": self.trial_remaining,
            "grace_remaining": self.grace_remaining,
            "last_access_granted": self.last_access_granted,
        }


class ReferenceOracle:
    """Oracle that computes canonical state from delivered events.
    Deduplicates by event id and sorts by seq ascending per tenant.
    """

    def __init__(self, model: ParsedModel):
        self.model = model

    def compute_state(self, delivered_events: List[Event]) -> Dict[str, TenantState]:
        # Group by tenant
        tenant_events: Dict[str, List[Event]] = {t: [] for t in self.model.tenants}
        for ev in delivered_events:
            if ev.tenant in tenant_events:
                tenant_events[ev.tenant].append(ev)

        result: Dict[str, TenantState] = {}
        for tenant_id, raw_evs in tenant_events.items():
            result[tenant_id] = self._evaluate_tenant(tenant_id, raw_evs)

        return result

    def _evaluate_tenant(self, tenant_id: str, events: List[Event]) -> TenantState:
        # Dedupe by id, preserving first occurrence
        seen_ids: Set[str] = set()
        deduped: List[Event] = []
        for ev in events:
            if ev.id not in seen_ids:
                seen_ids.add(ev.id)
                deduped.append(ev)

        # Sort strictly by provider sequence `seq`
        sorted_events = sorted(deduped, key=lambda e: e.seq)

        state = TenantState(
            tenant_id=tenant_id,
            plan="none",
            status="none",
            features=[],
            usage=0,
            credits=self.model.policies.prepaid_credits,
            trial_remaining=0,
            grace_remaining=0,
        )

        for ev in sorted_events:
            self._apply_event(state, ev)

        return state

    def _apply_event(self, state: TenantState, ev: Event) -> None:
        p_type = ev.type
        payload = ev.payload

        # Lifecycle operations require subscription to exist first
        if p_type in (
            EVENT_PLAN_UPGRADED,
            EVENT_PLAN_DOWNGRADED,
            EVENT_PAYMENT_SUCCEEDED,
            EVENT_PAYMENT_FAILED,
            EVENT_SUBSCRIPTION_CANCELLED,
        ) and state.status == "none":
            return

        if p_type == EVENT_SUBSCRIPTION_CREATED:
            target_plan = payload.get("plan", "free")
            state.plan = target_plan
            state.status = "active"
            if target_plan == "pro" and self.model.policies.trial_events > 0:
                state.trial_remaining = self.model.policies.trial_events
            else:
                state.trial_remaining = 0
            state.grace_remaining = 0

        elif p_type == EVENT_PLAN_UPGRADED:
            target_plan = payload.get("plan", "pro")
            state.plan = target_plan
            state.status = "active"
            state.trial_remaining = 0
            state.grace_remaining = 0

        elif p_type == EVENT_PLAN_DOWNGRADED:
            target_plan = payload.get("plan", "free")
            state.plan = target_plan
            state.status = "active"
            state.trial_remaining = 0
            state.grace_remaining = 0

        elif p_type == EVENT_PAYMENT_SUCCEEDED:
            if state.status == "past_due":
                state.status = "active"
                state.grace_remaining = 0
            if state.trial_remaining > 0:
                state.trial_remaining = 0

        elif p_type == EVENT_PAYMENT_FAILED:
            state.status = "past_due"
            state.grace_remaining = self.model.policies.grace_period_events

        elif p_type == EVENT_SUBSCRIPTION_CANCELLED:
            state.status = "cancelled"
            state.trial_remaining = 0
            state.grace_remaining = 0

        elif p_type == EVENT_USAGE_RECORDED:
            units = int(payload.get("units", 1))
            state.usage += units

        # Handle policy countdowns for subsequent events
        if p_type not in (EVENT_SUBSCRIPTION_CREATED,):
            if state.trial_remaining > 0:
                state.trial_remaining -= 1
                if state.trial_remaining == 0:
                    state.plan = "free"

        if p_type not in (EVENT_PAYMENT_FAILED,):
            if state.status == "past_due" and state.grace_remaining > 0:
                state.grace_remaining -= 1

        # Calculate effective features
        effective_features: List[str] = []
        if state.status != "cancelled" and state.plan in self.model.plans:
            raw_features = list(self.model.plans[state.plan].features)
            # If past_due and grace expired, revoke premium
            if state.status == "past_due" and state.grace_remaining <= 0:
                effective_features = [f for f in raw_features if f != "premium"]
            else:
                effective_features = raw_features
        state.features = effective_features

        # Access check evaluation
        if p_type == EVENT_ACCESS_CHECK:
            feature = payload.get("feature", "basic")
            role = payload.get("role", "member")
            has_feature = feature in state.features
            role_allowed = True
            if feature in self.model.feature_roles:
                role_allowed = role in self.model.feature_roles[feature]
            state.last_access_granted = bool(has_feature and role_allowed)
