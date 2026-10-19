from __future__ import annotations
from typing import Any, Dict, List
from fastapi import APIRouter

from entitlesim.engine.protocol import get_engine
from entitlesim.schemas import SimulateRequest

router = APIRouter(tags=["simulator"])


@router.post("/simulate", response_model=List[Dict[str, Any]])
@router.post("/api/simulate", response_model=List[Dict[str, Any]])
def simulate_events(payload: SimulateRequest):
    engine = get_engine()
    replay_res = engine.replay(
        model=payload.model,
        trace=payload.events,
        fixed=payload.fixed,
    )
    return replay_res.trace_results
