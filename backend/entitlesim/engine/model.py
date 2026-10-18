from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import yaml

from entitlesim.engine.events import Event, VALID_EVENT_TYPES


@dataclass
class TenantModel:
    id: str
    roles: List[str] = field(default_factory=lambda: ["admin", "member"])


@dataclass
class PlanModel:
    name: str
    features: List[str]
    quota: Dict[str, int] = field(default_factory=dict)


@dataclass
class PolicyModel:
    grace_period_events: int = 1
    trial_events: int = 0
    prepaid_credits: int = 0


@dataclass
class InvariantModel:
    id: str
    type: str
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedModel:
    name: str
    tenants: Dict[str, TenantModel]
    feature_roles: Dict[str, List[str]]
    plans: Dict[str, PlanModel]
    transitions: List[Tuple[str, str]]
    policies: PolicyModel
    scenario: List[Event]
    invariants: List[InvariantModel]
    raw: Dict[str, Any]


def parse_model(source: Union[str, Path, Dict[str, Any]]) -> ParsedModel:
    if isinstance(source, (str, Path)):
        path = Path(source)
        if path.is_file():
            content = path.read_text(encoding="utf-8")
            if path.suffix in [".yaml", ".yml"]:
                data = yaml.safe_load(content)
            else:
                data = json.loads(content)
        else:
            # Try raw JSON/YAML string
            try:
                data = json.loads(str(source))
            except Exception:
                data = yaml.safe_load(str(source))
    else:
        data = dict(source)

    if not isinstance(data, dict):
        raise ValueError("Model must be a dictionary or valid JSON/YAML object")

    name = str(data.get("name", "unnamed-model"))

    # Tenants
    raw_tenants = data.get("tenants", [])
    tenants: Dict[str, TenantModel] = {}
    for t in raw_tenants:
        if isinstance(t, str):
            tenants[t] = TenantModel(id=t)
        elif isinstance(t, dict):
            t_id = str(t["id"])
            roles = t.get("roles", ["admin", "member"])
            tenants[t_id] = TenantModel(id=t_id, roles=roles)

    # Feature roles
    feature_roles: Dict[str, List[str]] = {}
    for feat, roles in data.get("feature_roles", {}).items():
        feature_roles[feat] = list(roles)

    # Plans
    plans: Dict[str, PlanModel] = {}
    for plan_name, plan_def in data.get("plans", {}).items():
        feats = list(plan_def.get("features", []))
        quota = dict(plan_def.get("quota", {}))
        plans[plan_name] = PlanModel(name=plan_name, features=feats, quota=quota)

    # Transitions
    transitions: List[Tuple[str, str]] = []
    for tr in data.get("transitions", []):
        if isinstance(tr, (list, tuple)) and len(tr) == 2:
            transitions.append((str(tr[0]), str(tr[1])))

    # Policies
    raw_policies = data.get("policies", {})
    policies = PolicyModel(
        grace_period_events=int(raw_policies.get("grace_period_events", 1)),
        trial_events=int(raw_policies.get("trial_events", 0)),
        prepaid_credits=int(raw_policies.get("prepaid_credits", 0)),
    )

    # Scenario
    scenario: List[Event] = []
    for ev in data.get("scenario", []):
        scenario.append(Event.from_dict(ev))

    # Invariants
    invariants: List[InvariantModel] = []
    for inv in data.get("invariants", []):
        inv_id = str(inv["id"])
        inv_type = str(inv["type"])
        inv_params = {k: v for k, v in inv.items() if k not in ["id", "type"]}
        invariants.append(InvariantModel(id=inv_id, type=inv_type, params=inv_params))

    return ParsedModel(
        name=name,
        tenants=tenants,
        feature_roles=feature_roles,
        plans=plans,
        transitions=transitions,
        policies=policies,
        scenario=scenario,
        invariants=invariants,
        raw=data,
    )
