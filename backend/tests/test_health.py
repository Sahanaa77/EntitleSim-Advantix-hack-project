import pytest
from fastapi.testclient import TestClient

from entitlesim.db import Base, engine, init_db
from entitlesim.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    init_db()
    yield


def test_health_check_api():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"


def test_health_check_root():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_db_tables_created():
    from sqlalchemy import inspect
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    assert "models" in table_names
    assert "runs" in table_names
    assert "counterexamples" in table_names
    assert "regression_tests" in table_names


def test_models_validate_endpoint():
    valid_model = {
        "definition": {
            "name": "test-model",
            "tenants": [{"id": "A"}, {"id": "B"}],
            "plans": {"free": {"features": ["basic"]}},
            "invariants": [{"id": "INV-1", "type": "feature_access_matches_plan"}],
            "scenario": [],
        }
    }
    response = client.post("/api/models/validate", json=valid_model)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert "A" in data["summary"]["tenants"]
