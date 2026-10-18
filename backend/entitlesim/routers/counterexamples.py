from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from entitlesim.db import CounterexampleRecord, ModelRecord, RegressionTestRecord, RunRecord, get_db
from entitlesim.engine.exporter import export_json, export_regression_test
from entitlesim.engine.model import parse_model
from entitlesim.engine.protocol import get_engine
from entitlesim.schemas import (
    CounterexampleSummary,
    ExportResponse,
    MinimizeResponse,
    RerunRequest,
    RerunResponse,
)

router = APIRouter(prefix="/counterexamples", tags=["counterexamples"])


@router.get("/{cx_id}", response_model=CounterexampleSummary)
def get_counterexample(cx_id: str, db: Session = Depends(get_db)):
    record = db.query(CounterexampleRecord).filter(CounterexampleRecord.id == cx_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Counterexample not found")
    return CounterexampleSummary(
        id=str(record.id),
        run_id=str(record.run_id),
        invariant_id=record.invariant_id,
        original_trace=record.original_trace or [],
        minimal_trace=record.minimal_trace,
        state_diffs=record.state_diffs,
        created_at=record.created_at,
    )


@router.post("/{cx_id}/minimize", response_model=MinimizeResponse)
def minimize_counterexample(cx_id: str, db: Session = Depends(get_db)):
    record = db.query(CounterexampleRecord).filter(CounterexampleRecord.id == cx_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Counterexample not found")

    run_record = db.query(RunRecord).filter(RunRecord.id == record.run_id).first()
    if not run_record:
        raise HTTPException(status_code=404, detail="Run not found")

    model_record = db.query(ModelRecord).filter(ModelRecord.id == run_record.model_id).first()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    engine = get_engine()
    min_res = engine.minimize(
        model=model_record.definition,
        trace=record.original_trace,
        inv_id=record.invariant_id,
        fixed=run_record.fixed,
    )

    record.minimal_trace = min_res.minimal_trace
    record.state_diffs = min_res.state_diffs
    db.commit()

    return MinimizeResponse(
        id=str(record.id),
        original_len=min_res.original_len,
        minimal_len=min_res.minimal_len,
        minimal_trace=min_res.minimal_trace,
        state_diffs=min_res.state_diffs,
        replays=min_res.replays,
        duration_ms=min_res.duration_ms,
    )


@router.post("/{cx_id}/rerun", response_model=RerunResponse)
def rerun_counterexample(cx_id: str, payload: RerunRequest, db: Session = Depends(get_db)):
    record = db.query(CounterexampleRecord).filter(CounterexampleRecord.id == cx_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Counterexample not found")

    run_record = db.query(RunRecord).filter(RunRecord.id == record.run_id).first()
    if not run_record:
        raise HTTPException(status_code=404, detail="Run not found")

    model_record = db.query(ModelRecord).filter(ModelRecord.id == run_record.model_id).first()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    trace = record.minimal_trace if record.minimal_trace is not None else record.original_trace
    engine = get_engine()
    replay_res = engine.replay(
        model=model_record.definition,
        trace=trace,
        fixed=payload.fixed,
    )

    msg = "Verification pass: 0 violations" if replay_res.passed else f"Violations found: {len(replay_res.violations)}"
    return RerunResponse(
        passed=replay_res.passed,
        trace_results=replay_res.trace_results,
        message=msg,
    )


@router.get("/{cx_id}/export", response_model=ExportResponse)
def export_counterexample(
    cx_id: str,
    format: str = Query("pytest", pattern="^(pytest|json)$"),
    db: Session = Depends(get_db),
):
    record = db.query(CounterexampleRecord).filter(CounterexampleRecord.id == cx_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Counterexample not found")

    run_record = db.query(RunRecord).filter(RunRecord.id == record.run_id).first()
    if not run_record:
        raise HTTPException(status_code=404, detail="Run not found")

    model_record = db.query(ModelRecord).filter(ModelRecord.id == run_record.model_id).first()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    trace = record.minimal_trace if record.minimal_trace is not None else record.original_trace
    short_id = str(record.id)[:8]

    if format == "json":
        filename, content = export_json(trace, record.invariant_id, short_id=short_id)
        return ExportResponse(filename=filename, content=content, format="json")

    parsed_model = parse_model(model_record.definition)
    filename, content = export_regression_test(
        model=parsed_model,
        minimal_trace=trace,
        inv_id=record.invariant_id,
        short_id=short_id,
    )

    # Persist in regression_tests table
    reg_test = RegressionTestRecord(
        id=str(uuid.uuid4()),
        counterexample_id=str(record.id),
        format="pytest",
        content=content,
    )
    db.add(reg_test)
    db.commit()

    return ExportResponse(filename=filename, content=content, format="pytest")
