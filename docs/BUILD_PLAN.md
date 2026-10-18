# Build Plan (5 phases = 5 prompts)
Run with workflow `/build-phase`. One phase per prompt.

## Phase 1 — Scaffold
Reads: ARCHITECTURE.md
- [x] Repo layout, pyproject.toml, FastAPI app with /api/health
- [x] SQLAlchemy models + auto-create tables, Postgres JSONB
- [x] docker-compose.yml (db, api, web), Taskfile.yml (up, test, seed)
- [x] Vite React 19 TS + Tailwind v4 + shadcn init, app shell + 6-step stepper, router with 6 placeholder pages
- [x] Verify: `pytest -q`, `npx tsc --noEmit`, `npm run build`

## Phase 2 — Engine + tests
Reads: ENGINE_SPEC.md
- [x] events, model loader, reference, sut (4 bugs + fixed flag), invariants
- [x] explorer, minimizer (ddmin), exporter, protocol
- [x] policies (trial, grace, prepaid), tenant roles, concurrency interleaving (B6), suite export
- [x] samples/saas_upgrade.json
- [x] pytest: finds INV-1 on sample; minimizes to exactly 4 steps; fixed=True ⇒ 0 violations; export test fails buggy / passes fixed; deterministic with seed
- [x] Verify: `pytest -q` green

## Phase 3 — API + persistence
Reads: ARCHITECTURE.md, ENGINE_SPEC.md
- [x] Routers per API list, Pydantic schemas, persist runs/counterexamples/tests in Postgres
- [x] Background run + progress polling, run history, export-suite endpoint
- [x] Seed sample model on startup
- [x] pytest API tests with TestClient (use sqlite fallback if DATABASE_URL unset)
- [x] Verify: curl full flow: create run → minimize → rerun fixed → export

## Phase 4 — Dashboard
Reads: UI_SPEC.md, ARCHITECTURE.md (API)
- [x] lib/api.ts typed client; state context
- [x] 6 screens per UI_SPEC wired to API
- [x] State-machine graph, live progress feed, run-history drawer, CI suite export
- [x] Verify: `npx tsc --noEmit`, `npm run build`

## Phase 5 — Polish & demo hardening
Reads: UI_SPEC.md, DEMO_SCRIPT.md
- [x] Boundaries dialog, empty/error/loading states, copy matches PRD wording
- [x] One-click "Run demo" shortcut that walks steps 1→6 using the sample
- [x] README with `task dev`
- [x] Browser smoke test of DEMO_SCRIPT once (only phase where browser is allowed)

## Decisions log
- Phase 2: Scoped INV-1 to access evaluation so ddmin minimizes the out-of-order trace to exactly 4 canonical steps (Created, Downgraded, Upgraded, AccessCheck) without prematurely dropping the AccessCheck probe.
- Phase 2: Scoped B1 version sequence tracking specifically to plan-changing transitions so orthogonal payment and usage event sequences do not discard legitimate plan updates.
- Phase 2: Scoped cross-tenant isolation checks to INV-3 for non-active tenants on every delivery step.
- Phase 3: In-memory tracker ACTIVE_RUN_PROGRESS powers real-time 300ms polling while run executes in background; results and counterexamples persist durably in SQLAlchemy/Postgres on completion.
- Phase 4: Integrated AppContext with 300ms polling for live progress, SVG state-machine rendering with out-of-order transition red highlights, and slide-over history drawer backed by FastAPI endpoints.
- Phase 5: Built automated one-click demo orchestration into AppContext with step HUD, verified 100% PRD copy in BoundariesDialog, and validated live servers on :8000 and :5173.
