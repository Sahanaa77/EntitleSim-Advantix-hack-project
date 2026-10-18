import pytest
from fastapi.testclient import TestClient

from entitlesim.db import Base, engine, init_db, SessionLocal, RegressionTestRecord
from entitlesim.main import app
from entitlesim.samples.seed import seed_sample_model


@pytest.fixture(scope="module")
def client():
    init_db()
    seed_sample_model()
    with TestClient(app) as test_client:
        yield test_client


def test_api_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_sample_model_seeded_on_startup(client):
    res = client.get("/api/models")
    assert res.status_code == 200
    models = res.json()
    assert len(models) >= 1
    sample = next((m for m in models if m["name"] == "saas-upgrade-demo"), None)
    assert sample is not None
    assert "A" in str(sample["definition"])


def test_model_validation(client):
    # Valid model
    valid_payload = {
        "definition": {
            "name": "custom-saas",
            "tenants": [{"id": "T1"}],
            "plans": {"free": {"features": ["basic"]}},
            "invariants": [{"id": "INV-1", "type": "feature_access_matches_plan"}],
            "scenario": [],
        }
    }
    res = client.post("/api/models/validate", json=valid_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert "T1" in data["summary"]["tenants"]

    # Invalid model
    invalid_payload = {
        "definition": {
            "name": 123,
        }
    }
    res = client.post("/api/models/validate", json=invalid_payload)
    assert res.status_code == 200
    assert res.json()["valid"] is False
    assert len(res.json()["errors"]) > 0


def test_full_verification_flow_via_api(client):
    """Verifies end-to-end REST flow:
    1. Fetch model
    2. Create exploration run (fixed=False)
    3. Poll run and retrieve counterexample
    4. Minimize counterexample to 4 steps
    5. Re-run counterexample with fixed=True (re-verification pass)
    6. Export regression test and export full suite
    """
    # 1. Fetch sample model
    models_res = client.get("/api/models")
    models = models_res.json()
    sample = next(m for m in models if m["name"] == "saas-upgrade-demo")
    model_id = sample["id"]

    # 2. Create exploration run
    run_payload = {
        "model_id": model_id,
        "bounds": {
            "max_depth": 12,
            "max_retries": 1,
            "allow_duplicates": True,
            "allow_reorder": True,
            "allow_interrupt": True,
            "max_states": 2000,
            "max_concurrency": 2,
            "seed": 42,
        },
        "fixed": False,
    }
    create_run_res = client.post("/api/runs", json=run_payload)
    assert create_run_res.status_code == 200
    run_data = create_run_res.json()
    run_id = run_data["id"]
    assert run_data["run_id"] == run_id

    # 3. Fetch run details (background task executed)
    get_run_res = client.get(f"/api/runs/{run_id}")
    assert get_run_res.status_code == 200
    run_detail = get_run_res.json()
    assert run_detail["status"] == "done"
    assert run_detail["stats"]["states_explored"] > 0
    assert len(run_detail["counterexamples"]) > 0

    inv1_cx = next((cx for cx in run_detail["counterexamples"] if cx["invariant_id"] == "INV-1"), None)
    assert inv1_cx is not None, "INV-1 counterexample must be present in run"
    cx_id = inv1_cx["id"]
    assert len(inv1_cx["original_trace"]) > 4

    # 4. Minimize counterexample
    min_res = client.post(f"/api/counterexamples/{cx_id}/minimize")
    assert min_res.status_code == 200
    min_data = min_res.json()
    assert min_data["minimal_len"] == 4
    assert len(min_data["minimal_trace"]) == 4
    assert min_data["replays"] > 0
    assert len(min_data["state_diffs"]) == 4

    event_types = [e["type"] for e in min_data["minimal_trace"]]
    assert event_types == ["SubscriptionCreated", "PlanDowngraded", "PlanUpgraded", "AccessCheck"]

    # 5. Re-run counterexample (Buggy fails, Fixed passes)
    # 5a. Rerun fixed=False -> fails
    rerun_buggy_res = client.post(f"/api/counterexamples/{cx_id}/rerun", json={"fixed": False})
    assert rerun_buggy_res.status_code == 200
    assert rerun_buggy_res.json()["passed"] is False

    # 5b. Rerun fixed=True -> passes (Re-Verification Pass)
    rerun_fixed_res = client.post(f"/api/counterexamples/{cx_id}/rerun", json={"fixed": True})
    assert rerun_fixed_res.status_code == 200
    assert rerun_fixed_res.json()["passed"] is True

    # 6. Export regression test
    # 6a. Format pytest
    export_pytest_res = client.get(f"/api/counterexamples/{cx_id}/export?format=pytest")
    assert export_pytest_res.status_code == 200
    pytest_data = export_pytest_res.json()
    assert pytest_data["format"] == "pytest"
    assert pytest_data["filename"].startswith("test_regression_inv_1_")
    assert "def test_regression_inv_1_passes_when_fixed" in pytest_data["content"]
    assert "def test_regression_inv_1_fails_on_buggy_sut" in pytest_data["content"]

    # Verify persisted in DB
    db = SessionLocal()
    try:
        saved_test = db.query(RegressionTestRecord).filter(RegressionTestRecord.counterexample_id == cx_id).first()
        assert saved_test is not None
        assert saved_test.format == "pytest"
    finally:
        db.close()

    # 6b. Format JSON
    export_json_res = client.get(f"/api/counterexamples/{cx_id}/export?format=json")
    assert export_json_res.status_code == 200
    json_data = export_json_res.json()
    assert json_data["format"] == "json"
    assert json_data["filename"].startswith("counterexample_inv_1_")

    # 7. Export CI suite
    suite_res = client.get(f"/api/runs/{run_id}/export-suite")
    assert suite_res.status_code == 200
    suite_data = suite_res.json()
    assert len(suite_data["files"]) == 2
    filenames = {f["filename"] for f in suite_data["files"]}
    assert "test_entitlesim_suite.py" in filenames
    assert ".github/workflows/entitlesim.yml" in filenames
