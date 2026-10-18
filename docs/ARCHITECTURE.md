# Architecture
Matches the pitch diagram: Developer Model Definition → Core Verification Engine (Bounded Model Explorer · Trace Minimizer · Invariant Evaluator) ⇄ In-Memory State Store (ephemeral) and ⇄ PostgreSQL (durable) → React Verification Dashboard.

## Repo layout
```
entitlesim/
  AGENTS.md  Taskfile.yml  docker-compose.yml  README.md
  backend/
    pyproject.toml
    entitlesim/
      main.py            # FastAPI app, CORS, routers
      schemas.py         # Pydantic v2 models
      db.py              # SQLAlchemy 2 + psycopg, JSONB columns
      routers/ models.py runs.py counterexamples.py
      engine/
        protocol.py      # EngineProtocol (swap point for future Rust FFI)
        model.py         # load/validate model JSON|YAML
        events.py        # Event dataclass + types
        reference.py     # oracle: expected state from events
        sut.py           # system under test: buggy handlers + fixed flag
        invariants.py    # invariant checkers
        explorer.py      # bounded explorer
        minimizer.py     # ddmin trace minimizer
        exporter.py      # pytest/JSON regression export
      samples/saas_upgrade.json
    tests/               # pytest
  frontend/              # Vite + React 19 + TS + Tailwind v4 + shadcn
    src/{pages,components,lib/api.ts,types.ts}
```
## Docker Compose
Services: `db` (postgres:16, volume), `api` (uvicorn :8000), `web` (vite dev or nginx :5173). Env: DATABASE_URL. `task up` = `docker compose up --build`; `task test` = pytest; `task seed` = load sample model.

## Postgres tables (JSONB for state)
- models(id uuid pk, name, definition jsonb, created_at)
- runs(id uuid pk, model_id fk, bounds jsonb, fixed bool, stats jsonb, status, created_at)
- counterexamples(id uuid pk, run_id fk, invariant_id, original_trace jsonb, minimal_trace jsonb, state_diffs jsonb, created_at)
- regression_tests(id uuid pk, counterexample_id fk, format, content text, created_at)

## REST API (prefix /api)
- GET /health
- POST /models  · GET /models · GET /models/{id} · POST /models/validate
- POST /runs  body {model_id, bounds:{max_depth,max_retries,allow_duplicates,allow_reorder,allow_interrupt,max_states,max_concurrency,seed}, fixed:false} → returns {run_id, status:"running"} immediately; engine runs in a background thread and updates progress
- GET /runs (history) · GET /runs/{id} → {status:running|done, progress:{states_explored,violations,elapsed_ms,found[]}, stats:{states_explored,violations,duration_ms,by_depth[],by_invariant{}}, counterexamples[]} — UI polls every 300 ms while running
- POST /counterexamples/{id}/minimize → {original_len, minimal_len, minimal_trace, state_diffs[], replays, duration_ms}
- POST /counterexamples/{id}/rerun body {fixed:true} → {passed, trace_results[]}
- GET /counterexamples/{id}/export?format=pytest|json → {filename, content}
- GET /runs/{id}/export-suite → {files:[test_entitlesim_suite.py, .github/workflows/entitlesim.yml]}
