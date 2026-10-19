from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from entitlesim.db import get_db, RunRecord, CounterexampleRecord, RegressionTestRecord
from entitlesim.samples.seed import seed_sample_model

router = APIRouter(tags=["admin"])


@router.post("/admin/reset")
def reset_demo_data(db: Session = Depends(get_db)):
    """Clears runs, counterexamples, and regression tests, keeps saved models,
    and re-seeds the sample and template models.
    """
    # Clear runs, counterexamples, and regression tests
    db.query(RegressionTestRecord).delete()
    db.query(CounterexampleRecord).delete()
    db.query(RunRecord).delete()
    db.commit()

    # Re-seed the sample and template models
    seed_sample_model(overwrite_samples=True, db=db)

    return {"status": "ok", "message": "Demo data reset successfully"}
