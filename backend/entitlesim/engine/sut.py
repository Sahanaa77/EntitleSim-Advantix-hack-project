from __future__ import annotations
import copy
from typing import Any, Dict, List, Optional, Set, Tuple, Union
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


class EntitlementService:
    """System Under Test (SUT) with seeded entitlement bugs (B1, B2, B3, B4, B6),
    all eliminated when fixed=True.
    """

    def __init__(self, fixed: bool = False, model: Optional[ParsedModel] = None):
        self.fixed = fixed
        self.model = model

        # Subscription state per tenant
        self.subs: Dict[str, Dict[str, Any]] = {}

        # Cache of active features
        # Fixed: keyed by (tenant, customer_id)
        # Buggy (B4): keyed by customer_id only
        self.cache: Dict[Any, List[str]] = {}

        # Usage counters
        # Fixed: keyed by (tenant, customer_id)
        # Buggy (B4): keyed by customer_id only
        self.usage: Dict[Any, int] = {}

        # Seen event IDs (fixed: B2 idempotency)
        self.seen_ids: Set[str] = set()

        # Last applied sequence number per (tenant, customer_id) (fixed: B1 version check)
        self.last_seq: Dict[Tuple[str, str], int] = {}

        # Last access check result per tenant
        self.last_access_granted: Dict[str, Optional[bool]] = {}

    def _get_cache_key(self, tenant: str, customer_id: str) -> Any:
        if self.fixed:
            return (tenant, customer_id)
        return customer_id  # Bug B4: shared across tenants

    def _get_usage_key(self, tenant: str, customer_id: str) -> Any:
        if self.fixed:
            return (tenant, customer_id)
        return customer_id  # Bug B4: shared across tenants

    def get_tenant_sub(self, tenant: str) -> Dict[str, Any]:
        if tenant not in self.subs:
            self.subs[tenant] = {
                "plan": "none",
                "status": "none",
                "trial_remaining": 0,
                "grace_remaining": 0,
            }
        return self.subs[tenant]

    def get_tenant_features(self, tenant: str, customer_id: str = "c1") -> List[str]:
        key = self._get_cache_key(tenant, customer_id)
        return list(self.cache.get(key, []))

    def get_tenant_usage(self, tenant: str, customer_id: str = "c1") -> int:
        key = self._get_usage_key(tenant, customer_id)
        return self.usage.get(key, 0)

    def get_tenant_snapshot(self, tenant: str, customer_id: str = "c1") -> Dict[str, Any]:
        sub = self.get_tenant_sub(tenant)
        features = self.get_tenant_features(tenant, customer_id)
        usage = self.get_tenant_usage(tenant, customer_id)
        access = self.last_access_granted.get(tenant)
        return {
            "tenant_id": tenant,
            "plan": sub.get("plan", "none"),
            "status": sub.get("status", "none"),
            "features": features,
            "usage": usage,
            "last_access_granted": access,
        }

    def handle_event(self, event_input: Union[Event, Dict[str, Any]], interrupt: bool = False) -> bool:
        """Deliver and apply an event to SUT.
        Returns True if event was applied, False if discarded (e.g. fixed duplicate/stale).
        """
        if isinstance(event_input, dict):
            event = Event.from_dict(event_input)
        else:
            event = event_input

        tenant = event.tenant
        cust_id = event.customer_id
        seq = event.seq
        ev_id = event.id
        ev_type = event.type
        payload = event.payload

        # Bug B2 fix: Idempotency deduplication
        if self.fixed:
            if ev_id in self.seen_ids:
                return False
            self.seen_ids.add(ev_id)

        # Bug B1 fix: Version / sequence check on plan lifecycle transitions
        plan_events = (
            EVENT_SUBSCRIPTION_CREATED,
            EVENT_PLAN_UPGRADED,
            EVENT_PLAN_DOWNGRADED,
        )
        if self.fixed and ev_type in plan_events:
            last = self.last_seq.get((tenant, cust_id), -1)
            # Events with lower or equal sequence to what was already applied are stale
            if seq <= last:
                return False
            self.last_seq[(tenant, cust_id)] = seq

        sub = self.get_tenant_sub(tenant)
        cache_key = self._get_cache_key(tenant, cust_id)
        usage_key = self._get_usage_key(tenant, cust_id)

        # Non-creation lifecycle events require an existing subscription
        if ev_type in (
            EVENT_PLAN_UPGRADED,
            EVENT_PLAN_DOWNGRADED,
            EVENT_PAYMENT_SUCCEEDED,
            EVENT_PAYMENT_FAILED,
            EVENT_SUBSCRIPTION_CANCELLED,
        ) and sub.get("status") == "none":
            return False

        # Policy helper
        trial_events = self.model.policies.trial_events if self.model else 0
        grace_period_events = self.model.policies.grace_period_events if self.model else 1

        # WRITE 1: Update subscription model in DB
        new_plan = sub.get("plan", "none")
        new_status = sub.get("status", "none")
        trial_rem = sub.get("trial_remaining", 0)
        grace_rem = sub.get("grace_remaining", 0)

        if ev_type == EVENT_SUBSCRIPTION_CREATED:
            new_plan = payload.get("plan", "free")
            new_status = "active"
            trial_rem = trial_events if new_plan == "pro" else 0
            grace_rem = 0

        elif ev_type == EVENT_PLAN_UPGRADED:
            new_plan = payload.get("plan", "pro")
            new_status = "active"
            trial_rem = 0
            grace_rem = 0

        elif ev_type == EVENT_PLAN_DOWNGRADED:
            new_plan = payload.get("plan", "free")
            new_status = "active"
            trial_rem = 0
            grace_rem = 0

        elif ev_type == EVENT_PAYMENT_SUCCEEDED:
            if new_status == "past_due":
                new_status = "active"
                grace_rem = 0
            if trial_rem > 0:
                trial_rem = 0

        elif ev_type == EVENT_PAYMENT_FAILED:
            new_status = "past_due"
            grace_rem = grace_period_events

        elif ev_type == EVENT_SUBSCRIPTION_CANCELLED:
            new_status = "cancelled"
            trial_rem = 0
            grace_rem = 0

        elif ev_type == EVENT_USAGE_RECORDED:
            units = int(payload.get("units", 1))
            # Bug B6: Lost update under concurrency simulation
            if not self.fixed and interrupt:
                # Concurrent thread read stale value and failed to commit write
                return True
            current_u = self.usage.get(usage_key, 0)
            self.usage[usage_key] = current_u + units

        # Policy countdowns for subsequent events
        if ev_type != EVENT_SUBSCRIPTION_CREATED and trial_rem > 0:
            trial_rem -= 1
            if trial_rem == 0:
                new_plan = "free"

        if ev_type != EVENT_PAYMENT_FAILED and new_status == "past_due" and grace_rem > 0:
            grace_rem -= 1

        # Commit Write 1
        sub["plan"] = new_plan
        sub["status"] = new_status
        sub["trial_remaining"] = trial_rem
        sub["grace_remaining"] = grace_rem

        # Bug B3: If interrupted between Write 1 and Write 2, skip cache invalidation!
        if not self.fixed and interrupt and ev_type in lifecycle_events:
            # Crash occurs: cache is NOT updated!
            return True

        # WRITE 2: Update / invalidate cache
        plan_features: List[str] = []
        if self.model and new_plan in self.model.plans:
            raw_features = list(self.model.plans[new_plan].features)
            if new_status == "past_due" and grace_rem <= 0:
                plan_features = [f for f in raw_features if f != "premium"]
            else:
                plan_features = raw_features
        elif new_plan == "pro":
            plan_features = ["basic", "premium"]
        elif new_plan == "free":
            plan_features = ["basic"]

        if new_status == "cancelled":
            self.cache[cache_key] = []
        else:
            self.cache[cache_key] = plan_features

        # Access check evaluation
        if ev_type == EVENT_ACCESS_CHECK:
            feat = payload.get("feature", "basic")
            role = payload.get("role", "member")
            active_feats = self.cache.get(cache_key, [])
            has_feat = feat in active_feats
            role_allowed = True
            if self.model and feat in self.model.feature_roles:
                role_allowed = role in self.model.feature_roles[feat]
            self.last_access_granted[tenant] = bool(has_feat and role_allowed)

        return True
