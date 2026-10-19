import json
from pathlib import Path
import pytest

from entitlesim.engine.events import Event
from entitlesim.engine.exporter import export_json, export_regression_test, export_suite
from entitlesim.engine.explorer import BoundedExplorer
from entitlesim.engine.minimizer import TraceMinimizer
from entitlesim.engine.model import parse_model
from entitlesim.engine.protocol import get_engine
from entitlesim.engine.reference import ReferenceOracle
from entitlesim.engine.sut import EntitlementService


@pytest.fixture
def saas_upgrade_model():
    sample_path = Path(__file__).parent.parent / "entitlesim" / "samples" / "saas_upgrade.json"
    with open(sample_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return parse_model(data)


@pytest.fixture
def trial_grace_model():
    sample_path = Path(__file__).parent.parent / "entitlesim" / "samples" / "saas_trial_grace.json"
    with open(sample_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return parse_model(data)


def test_explorer_finds_inv1_on_sample(saas_upgrade_model):
    """Explorer auto-discovers unauthorized premium access (INV-1) on sample scenario."""
    bounds = {
        "max_depth": 12,
        "max_retries": 1,
        "allow_duplicates": True,
        "allow_reorder": True,
        "allow_interrupt": True,
        "max_states": 2000,
        "max_concurrency": 2,
        "seed": 42,
    }
    explorer = BoundedExplorer(saas_upgrade_model)
    result = explorer.explore(bounds=bounds, fixed=False)

    assert result.states_explored > 0
    assert result.duration_ms > 0
    assert len(result.violations) > 0

    inv1_violation = next((v for v in result.violations if v.id == "INV-1"), None)
    assert inv1_violation is not None, "INV-1 violation must be found"
    assert inv1_violation.tenant == "A"
    assert len(inv1_violation.trace) > 4, "Initial failing trace includes noise events"


def test_minimizer_reduces_to_exactly_4_steps(saas_upgrade_model):
    """Minimizer reduces the sample failure to exactly 4 essential steps."""
    explorer = BoundedExplorer(saas_upgrade_model)
    bounds = {
        "max_depth": 12,
        "max_retries": 1,
        "allow_duplicates": True,
        "allow_reorder": True,
        "allow_interrupt": False,
        "max_states": 2000,
        "max_concurrency": 1,
        "seed": 42,
    }
    result = explorer.explore(bounds=bounds, fixed=False)
    inv1 = next(v for v in result.violations if v.id == "INV-1")

    minimizer = TraceMinimizer(saas_upgrade_model)
    min_res = minimizer.minimize(inv1.trace, inv_id="INV-1", fixed=False)

    assert min_res.minimal_len == 4, f"Expected exactly 4 steps, got {min_res.minimal_len}"
    assert len(min_res.minimal_trace) == 4
    assert min_res.replays > 0
    assert min_res.duration_ms > 0

    event_types = [e["type"] for e in min_res.minimal_trace]
    expected_types = ["SubscriptionCreated", "PlanDowngraded", "PlanUpgraded", "AccessCheck"]
    assert event_types == expected_types, f"Unexpected minimal event types: {event_types}"


def test_fixed_service_has_zero_violations(saas_upgrade_model):
    """Verification pass with fixed=True produces 0 violations across explored state space."""
    explorer = BoundedExplorer(saas_upgrade_model)
    bounds = {
        "max_depth": 12,
        "max_retries": 1,
        "allow_duplicates": True,
        "allow_reorder": True,
        "allow_interrupt": True,
        "max_states": 2000,
        "max_concurrency": 2,
        "seed": 42,
    }
    result = explorer.explore(bounds=bounds, fixed=True)
    assert len(result.violations) == 0, f"Expected 0 violations with fixed=True, found {len(result.violations)}"
    assert result.states_explored > 0


def test_regression_export_fails_buggy_passes_fixed(saas_upgrade_model):
    """Exported regression test executes, passes with fixed=True, fails with fixed=False."""
    minimal_trace = [
        {"id": "e1", "tenant": "A", "customer_id": "c1", "seq": 1, "type": "SubscriptionCreated", "payload": {"plan": "free"}},
        {"id": "e3", "tenant": "A", "customer_id": "c1", "seq": 3, "type": "PlanDowngraded", "payload": {"plan": "free"}},
        {"id": "e2", "tenant": "A", "customer_id": "c1", "seq": 2, "type": "PlanUpgraded", "payload": {"plan": "pro"}},
        {"id": "e4", "tenant": "A", "customer_id": "c1", "seq": 4, "type": "AccessCheck", "payload": {"feature": "premium", "role": "admin"}},
    ]

    filename, content = export_regression_test(
        model=saas_upgrade_model,
        minimal_trace=minimal_trace,
        inv_id="INV-1",
        short_id="demo",
    )
    assert filename.startswith("test_regression_inv_1_")
    assert "def test_regression_inv_1_passes_when_fixed" in content
    assert "def test_regression_inv_1_fails_on_buggy_sut" in content

    # Dynamically execute test functions in isolated scope
    namespace = {}
    exec(content, namespace)
    # 1. Fixed passes
    namespace["test_regression_inv_1_passes_when_fixed"]()
    # 2. Buggy fails
    namespace["test_regression_inv_1_fails_on_buggy_sut"]()


def test_suite_export(saas_upgrade_model):
    """Suite export generates consolidated pytest test and GitHub Actions YAML."""
    counterexamples = [
        {
            "id": "cx-1",
            "invariant_id": "INV-1",
            "minimal_trace": [
                {"id": "e1", "tenant": "A", "customer_id": "c1", "seq": 1, "type": "SubscriptionCreated", "payload": {"plan": "free"}},
                {"id": "e3", "tenant": "A", "customer_id": "c1", "seq": 3, "type": "PlanDowngraded", "payload": {"plan": "free"}},
            ],
        }
    ]
    files = export_suite(saas_upgrade_model, counterexamples)
    assert len(files) == 2
    filenames = {f["filename"] for f in files}
    assert "test_entitlesim_suite.py" in filenames
    assert ".github/workflows/entitlesim.yml" in filenames


def test_deterministic_exploration_with_seed(saas_upgrade_model):
    """Same seed and bounds yield identical exploration metrics and violations."""
    bounds = {
        "max_depth": 10,
        "max_retries": 1,
        "allow_duplicates": True,
        "allow_reorder": True,
        "allow_interrupt": True,
        "max_states": 500,
        "max_concurrency": 2,
        "seed": 12345,
    }
    explorer1 = BoundedExplorer(saas_upgrade_model)
    res1 = explorer1.explore(bounds=bounds, fixed=False)

    explorer2 = BoundedExplorer(saas_upgrade_model)
    res2 = explorer2.explore(bounds=bounds, fixed=False)

    assert res1.states_explored == res2.states_explored
    assert len(res1.violations) == len(res2.violations)
    assert [v.id for v in res1.violations] == [v.id for v in res2.violations]


def test_policies_trial_grace_and_prepaid(trial_grace_model):
    """Validates trial countdown, grace period, and prepaid credits."""
    oracle = ReferenceOracle(trial_grace_model)

    # 1. Trial: SubscriptionCreated(pro) with trial_events=2
    e1 = Event(id="1", tenant="A", customer_id="c1", seq=1, type="SubscriptionCreated", payload={"plan": "pro"})
    state1 = oracle.compute_state([e1])["A"]
    assert state1.plan == "pro"
    assert state1.trial_remaining == 2
    assert "premium" in state1.features

    # 2. Next event: trial decrements to 1
    e2 = Event(id="2", tenant="A", customer_id="c1", seq=2, type="UsageRecorded", payload={"units": 5})
    state2 = oracle.compute_state([e1, e2])["A"]
    assert state2.trial_remaining == 1
    assert state2.plan == "pro"

    # 3. Next event: trial decrements to 0 -> drops to free
    e3 = Event(id="3", tenant="A", customer_id="c1", seq=3, type="UsageRecorded", payload={"units": 5})
    state3 = oracle.compute_state([e1, e2, e3])["A"]
    assert state3.trial_remaining == 0
    assert state3.plan == "free"
    assert "premium" not in state3.features

    # 4. Grace period: PaymentFailed gives grace_period_events=2
    e4 = Event(id="4", tenant="A", customer_id="c1", seq=4, type="PlanUpgraded", payload={"plan": "pro"})
    e5 = Event(id="5", tenant="A", customer_id="c1", seq=5, type="PaymentFailed", payload={})
    state5 = oracle.compute_state([e1, e2, e3, e4, e5])["A"]
    assert state5.status == "past_due"
    assert state5.grace_remaining == 2
    assert "premium" in state5.features

    # 5. Prepaid credits: 50 credits allow usage up to plan quota (100) + 50 = 150
    assert state3.credits == 50


def test_tenant_roles_enforcement(saas_upgrade_model):
    """Enforces role-based access check against model.feature_roles."""
    sut = EntitlementService(fixed=True, model=saas_upgrade_model)
    # Admin has access to premium on pro plan
    sut.handle_event(Event(id="1", tenant="A", customer_id="c1", seq=1, type="SubscriptionCreated", payload={"plan": "pro"}))
    sut.handle_event(Event(id="2", tenant="A", customer_id="c1", seq=2, type="AccessCheck", payload={"feature": "premium", "role": "admin"}))
    assert sut.last_access_granted["A"] is True

    # Guest role is not in feature_roles['premium']
    sut.handle_event(Event(id="3", tenant="A", customer_id="c1", seq=3, type="AccessCheck", payload={"feature": "premium", "role": "guest"}))
    assert sut.last_access_granted["A"] is False


def test_engine_protocol_interface(saas_upgrade_model):
    """Verifies that VerificationEngine conforms to EngineProtocol."""
    engine = get_engine()
    # explore
    res = engine.explore(saas_upgrade_model.raw, bounds={"max_depth": 5, "max_states": 100}, fixed=True)
    assert res.states_explored > 0
    # replay
    replay_res = engine.replay(
        saas_upgrade_model.raw,
        [{"id": "1", "tenant": "A", "customer_id": "c1", "seq": 1, "type": "SubscriptionCreated", "payload": {"plan": "free"}}],
        fixed=True,
    )
    assert replay_res.passed is True


def test_duplicate_usage_event_scenario():
    """Verify Duplicate Usage Event scenario reports INV-2 expected 15 vs observed 30, and minimal trace <= 3 steps."""
    sample_path = Path(__file__).parent.parent / "entitlesim" / "samples" / "duplicate_usage_event.json"
    with open(sample_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    model = parse_model(data)

    explorer = BoundedExplorer(model)
    bounds = {
        "max_depth": 6,
        "max_retries": 2,
        "max_concurrency": 2,
        "allow_duplicates": True,
        "allow_reorder": True,
        "allow_interrupt": False,
        "max_states": 500,
        "seed": 42,
    }
    result = explorer.explore(bounds=bounds, fixed=False)

    inv2 = next((v for v in result.violations if v.id == "INV-2"), None)
    assert inv2 is not None, "INV-2 violation must be detected with duplicates allowed"
    assert inv2.expected == {"usage": 15}
    assert inv2.observed == {"usage": 30}

    minimizer = TraceMinimizer(model)
    min_res = minimizer.minimize(inv2.trace, "INV-2", fixed=False)
    assert min_res.minimal_len <= 3, f"Minimal trace length {min_res.minimal_len} must be 3 steps or fewer"

