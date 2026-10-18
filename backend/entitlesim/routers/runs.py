from __future__ import annotations
import uuid
from typing import Any, Dict, List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from entitlesim.db import CounterexampleRecord, ModelRecord, RunRecord, SessionLocal, get_db
from entitlesim.engine.exporter import export_suite
from entitlesim.engine.model import parse_model
from entitlesim.engine.protocol import get_engine
from entitlesim.schemas import (
    CounterexampleSummary,
    RunCreate,
    RunProgress,
    RunResponse,
    RunStats,
    SuiteExportResponse,
)

router = APIRouter(prefix="/runs", tags=["runs"])

ACTIVE_RUN_PROGRESS: Dict[str, Dict[str, Any]] = {}


def run_exploration_task(run_id: str, model_id: str, bounds: Dict[str, Any], fixed: bool):
    ACTIVE_RUN_PROGRESS[run_id] = {
        "states_explored": 0,
        "violations": 0,
        "elapsed_ms": 0.0,
        "found": [],
    }
    db = SessionLocal()
    try:
        model_record = db.query(ModelRecord).filter(ModelRecord.id == model_id).first()
        if not model_record:
            return

        def progress_cb(states: int, viols: int, elapsed: float, found: List[Dict[str, Any]]):
            ACTIVE_RUN_PROGRESS[run_id] = {
                "states_explored": states,
                "violations": viols,
                "elapsed_ms": round(elapsed, 2),
                "found": found,
            }

        engine = get_engine()
        result = engine.explore(
            model=model_record.definition,
            bounds=bounds,
            fixed=fixed,
            progress_cb=progress_cb,
        )

        run_record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
        if run_record:
            run_record.status = "done"
            run_record.stats = {
                "states_explored": result.states_explored,
                "violations": len(result.violations),
                "duration_ms": result.duration_ms,
                "by_depth": result.by_depth,
                "by_invariant": result.by_invariant,
            }
            # Save counterexamples discovered
            for v in result.violations:
                cx_rec = CounterexampleRecord(
                    id=str(uuid.uuid4()),
                    run_id=run_id,
                    invariant_id=v.id,
                    original_trace=v.trace,
                    minimal_trace=None,
                    state_diffs=None,
                )
                db.add(cx_rec)
            db.commit()
    except Exception as e:
        run_record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
        if run_record:
            run_record.status = "failed"
            run_record.stats = {"error": str(e)}
            db.commit()
    finally:
        ACTIVE_RUN_PROGRESS.pop(run_id, None)
        db.close()


@router.get("", response_model=List[RunResponse])
def list_runs(db: Session = Depends(get_db)):
    records = db.query(RunRecord).order_by(RunRecord.created_at.desc()).all()
    results = []
    for r in records:
        progress = None
        if r.id in ACTIVE_RUN_PROGRESS:
            progress = RunProgress(**ACTIVE_RUN_PROGRESS[r.id])

        stats = None
        if r.stats:
            stats = RunStats(
                states_explored=r.stats.get("states_explored", 0),
                violations=r.stats.get("violations", 0),
                duration_ms=r.stats.get("duration_ms", 0.0),
                by_depth=r.stats.get("by_depth", []),
                by_invariant=r.stats.get("by_invariant", {}),
            )

        cx_summaries = [
            CounterexampleSummary(
                id=str(cx.id),
                run_id=str(cx.run_id),
                invariant_id=cx.invariant_id,
                original_trace=cx.original_trace or [],
                minimal_trace=cx.minimal_trace,
                state_diffs=cx.state_diffs,
                created_at=cx.created_at,
            )
            for cx in r.counterexamples
        ]

        results.append(
            RunResponse(
                id=str(r.id),
                run_id=str(r.id),
                model_id=str(r.model_id),
                bounds=r.bounds,
                fixed=r.fixed,
                status=r.status,
                progress=progress,
                stats=stats,
                counterexamples=cx_summaries,
                created_at=r.created_at,
            )
        )
    return results


@router.post("", response_model=RunResponse)
def create_run(payload: RunCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    model_record = db.query(ModelRecord).filter(ModelRecord.id == payload.model_id).first()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    run_id = str(uuid.uuid4())
    bounds_dict = payload.bounds.model_dump()

    record = RunRecord(
        id=run_id,
        model_id=payload.model_id,
        bounds=bounds_dict,
        fixed=payload.fixed,
        status="running",
        stats={
            "states_explored": 0,
            "violations": 0,
            "duration_ms": 0.0,
            "by_depth": [],
            "by_invariant": {},
        },
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    background_tasks.add_task(
        run_exploration_task,
        run_id=run_id,
        model_id=payload.model_id,
        bounds=bounds_dict,
        fixed=payload.fixed,
    )

    return RunResponse(
        id=str(record.id),
        run_id=str(record.id),
        model_id=str(record.model_id),
        bounds=record.bounds,
        fixed=record.fixed,
        status="running",
        progress=RunProgress(states_explored=0, violations=0, elapsed_ms=0.0, found=[]),
        stats=None,
        counterexamples=[],
        created_at=record.created_at,
    )


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: str, db: Session = Depends(get_db)):
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")

    progress = None
    if record.id in ACTIVE_RUN_PROGRESS:
        progress = RunProgress(**ACTIVE_RUN_PROGRESS[record.id])

    stats = None
    if record.stats:
        stats = RunStats(
            states_explored=record.stats.get("states_explored", 0),
            violations=record.stats.get("violations", 0),
            duration_ms=record.stats.get("duration_ms", 0.0),
            by_depth=record.stats.get("by_depth", []),
            by_invariant=record.stats.get("by_invariant", {}),
        )

    cx_summaries = [
        CounterexampleSummary(
            id=str(cx.id),
            run_id=str(cx.run_id),
            invariant_id=cx.invariant_id,
            original_trace=cx.original_trace or [],
            minimal_trace=cx.minimal_trace,
            state_diffs=cx.state_diffs,
            created_at=cx.created_at,
        )
        for cx in record.counterexamples
    ]

    return RunResponse(
        id=str(record.id),
        run_id=str(record.id),
        model_id=str(record.model_id),
        bounds=record.bounds,
        fixed=record.fixed,
        status=record.status,
        progress=progress,
        stats=stats,
        counterexamples=cx_summaries,
        created_at=record.created_at,
    )


@router.get("/{run_id}/export-suite", response_model=SuiteExportResponse)
def export_suite_endpoint(run_id: str, db: Session = Depends(get_db)):
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")

    model_record = db.query(ModelRecord).filter(ModelRecord.id == record.model_id).first()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    parsed_model = parse_model(model_record.definition)
    cx_list = []
    for cx in record.counterexamples:
        cx_list.append(
            {
                "id": str(cx.id),
                "invariant_id": cx.invariant_id,
                "minimal_trace": cx.minimal_trace or cx.original_trace,
            }
        )

    files = export_suite(parsed_model, cx_list)
    return SuiteExportResponse(files=files)
