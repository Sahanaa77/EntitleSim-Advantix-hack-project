from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from entitlesim.db import ModelRecord, get_db
from entitlesim.engine.model import parse_model
from entitlesim.schemas import (
    ModelCreate,
    ModelResponse,
    ModelValidateRequest,
    ModelValidateResponse,
)

router = APIRouter(prefix="/models", tags=["models"])


def validate_model_dict(data: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    if not isinstance(data, dict):
        return ["Model definition must be a JSON object"]
    if "name" not in data or not isinstance(data["name"], str):
        errors.append("Model must have a 'name' string")
    if "tenants" not in data or not isinstance(data["tenants"], list) or len(data["tenants"]) == 0:
        errors.append("Model must have at least one tenant in 'tenants'")
    if "plans" not in data or not isinstance(data["plans"], dict):
        errors.append("Model must define 'plans' mapping")
    if "invariants" not in data or not isinstance(data["invariants"], list):
        errors.append("Model must have an 'invariants' list")

    if not errors:
        try:
            parse_model(data)
        except Exception as e:
            errors.append(str(e))

    return errors


@router.get("", response_model=List[ModelResponse])
def list_models(db: Session = Depends(get_db)):
    models = db.query(ModelRecord).order_by(ModelRecord.created_at.desc()).all()
    return models


@router.post("", response_model=ModelResponse)
def create_model(payload: ModelCreate, db: Session = Depends(get_db)):
    errors = validate_model_dict(payload.definition)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    record = ModelRecord(name=payload.name, definition=payload.definition)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{model_id}", response_model=ModelResponse)
def get_model(model_id: str, db: Session = Depends(get_db)):
    record = db.query(ModelRecord).filter(ModelRecord.id == model_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Model not found")
    return record


@router.post("/validate", response_model=ModelValidateResponse)
def validate_model(payload: ModelValidateRequest):
    errors = validate_model_dict(payload.definition)
    summary = None
    if not errors:
        raw = payload.definition
        tenants = [t.get("id") if isinstance(t, dict) else str(t) for t in raw.get("tenants", [])]
        plans = list(raw.get("plans", {}).keys())
        invariants = [inv.get("id", str(i)) for i, inv in enumerate(raw.get("invariants", []))]
        summary = {
            "name": raw.get("name"),
            "tenants": tenants,
            "plans": plans,
            "invariants": invariants,
            "event_count": len(raw.get("scenario", [])),
        }
    return ModelValidateResponse(valid=len(errors) == 0, errors=errors, summary=summary)
