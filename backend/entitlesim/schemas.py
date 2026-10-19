from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"


class BoundsConfig(BaseModel):
    max_depth: int = Field(default=12, ge=1, le=50)
    max_retries: int = Field(default=1, ge=0, le=5)
    allow_duplicates: bool = True
    allow_reorder: bool = True
    allow_interrupt: bool = True
    max_states: int = Field(default=20000, ge=10)
    max_concurrency: int = Field(default=2, ge=1, le=10)
    seed: int = Field(default=42)


class ModelCreate(BaseModel):
    name: str
    definition: Dict[str, Any]


class ModelValidateRequest(BaseModel):
    definition: Dict[str, Any]


class ModelValidateResponse(BaseModel):
    valid: bool
    errors: List[str] = Field(default_factory=list)
    summary: Optional[Dict[str, Any]] = None


class ModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    definition: Dict[str, Any]
    created_at: datetime


class RunCreate(BaseModel):
    model_id: str
    bounds: BoundsConfig = Field(default_factory=BoundsConfig)
    fixed: bool = False


class RunProgress(BaseModel):
    states_explored: int = 0
    violations: int = 0
    elapsed_ms: float = 0.0
    found: List[Dict[str, Any]] = Field(default_factory=list)


class RunStats(BaseModel):
    states_explored: int = 0
    violations: int = 0
    duration_ms: float = 0.0
    by_depth: List[Dict[str, Any]] = Field(default_factory=list)
    by_invariant: Dict[str, int] = Field(default_factory=dict)


class CounterexampleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    invariant_id: str
    original_trace: List[Dict[str, Any]]
    minimal_trace: Optional[List[Dict[str, Any]]] = None
    state_diffs: Optional[List[Dict[str, Any]]] = None
    created_at: datetime


class RunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: Optional[str] = None
    model_id: str
    bounds: Dict[str, Any]
    fixed: bool
    status: str
    progress: Optional[RunProgress] = None
    stats: Optional[RunStats] = None
    counterexamples: List[CounterexampleSummary] = Field(default_factory=list)
    created_at: datetime

    @model_validator(mode="after")
    def populate_run_id(self) -> RunResponse:
        if not self.run_id:
            self.run_id = self.id
        return self


class MinimizeResponse(BaseModel):
    id: str
    original_len: int
    minimal_len: int
    minimal_trace: List[Dict[str, Any]]
    state_diffs: List[Dict[str, Any]]
    replays: int
    duration_ms: float


class RerunRequest(BaseModel):
    fixed: bool = True


class RerunResponse(BaseModel):
    passed: bool
    trace_results: List[Dict[str, Any]] = Field(default_factory=list)
    message: Optional[str] = None


class ExportResponse(BaseModel):
    filename: str
    content: str
    format: str


class SuiteExportFile(BaseModel):
    filename: str
    content: str


class SuiteExportResponse(BaseModel):
    files: List[SuiteExportFile]


class SimulateRequest(BaseModel):
    model: Dict[str, Any]
    events: List[Dict[str, Any]] = Field(default_factory=list)
    fixed: bool = False
