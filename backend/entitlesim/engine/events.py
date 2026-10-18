from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict


EVENT_SUBSCRIPTION_CREATED = "SubscriptionCreated"
EVENT_PLAN_UPGRADED = "PlanUpgraded"
EVENT_PLAN_DOWNGRADED = "PlanDowngraded"
EVENT_PAYMENT_SUCCEEDED = "PaymentSucceeded"
EVENT_PAYMENT_FAILED = "PaymentFailed"
EVENT_SUBSCRIPTION_CANCELLED = "SubscriptionCancelled"
EVENT_USAGE_RECORDED = "UsageRecorded"
EVENT_ACCESS_CHECK = "AccessCheck"

VALID_EVENT_TYPES = {
    EVENT_SUBSCRIPTION_CREATED,
    EVENT_PLAN_UPGRADED,
    EVENT_PLAN_DOWNGRADED,
    EVENT_PAYMENT_SUCCEEDED,
    EVENT_PAYMENT_FAILED,
    EVENT_SUBSCRIPTION_CANCELLED,
    EVENT_USAGE_RECORDED,
    EVENT_ACCESS_CHECK,
}


@dataclass
class Event:
    id: str
    tenant: str
    customer_id: str
    seq: int
    type: str
    payload: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "tenant": self.tenant,
            "customer_id": self.customer_id,
            "seq": self.seq,
            "type": self.type,
            "payload": dict(self.payload),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Event:
        return cls(
            id=str(data["id"]),
            tenant=str(data["tenant"]),
            customer_id=str(data.get("customer_id", "c1")),
            seq=int(data["seq"]),
            type=str(data["type"]),
            payload=dict(data.get("payload", {})),
        )
