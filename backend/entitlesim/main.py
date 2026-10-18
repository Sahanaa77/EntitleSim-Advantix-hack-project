from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from entitlesim.db import init_db
from entitlesim.routers import counterexamples, models, runs
from entitlesim.samples.seed import seed_sample_model
from entitlesim.schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    init_db()
    # Seed sample model on startup
    seed_sample_model()
    yield


app = FastAPI(
    title="EntitleSim API",
    description="Model-Based Verification & Counterexample Engine for SaaS Entitlement Workflows",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoints
@app.get("/api/health", response_model=HealthResponse, tags=["health"])
@app.get("/health", response_model=HealthResponse, tags=["health"])
def health_check():
    return HealthResponse(status="ok", version="0.1.0")


# Include routers
app.include_router(models.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(counterexamples.router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("entitlesim.main:app", host="0.0.0.0", port=8000, reload=True)
