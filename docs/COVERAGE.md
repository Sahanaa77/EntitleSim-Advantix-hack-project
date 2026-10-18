# Coverage: pitch doc → spec (agent: treat every row as required)
| Pitch concept | Where specified |
|---|---|
| Developer model: tenants, roles, tiers, transitions, permissions, invariants (JSON/YAML) | ENGINE_SPEC Model JSON + Policies |
| Trials, grace periods, prepaid credits | ENGINE_SPEC Policies |
| Reordered/duplicate/late webhooks | Explorer; bugs B1, B2 |
| Concurrent operations | Explorer concurrent mode; bug B6 |
| Interrupted execution / state drift / cache invalidation | Bug B3 |
| Cross-tenant isolation | Bug B4, INV-3 |
| Invariants checked after every transition | Invariants |
| Bounded exploration with configurable limits | Explorer bounds |
| Counterexample minimization (4-step) | Minimizer, Sample scenario |
| Expected vs observed, offending transition highlighted | UI screen 4 (+ state-machine graph) |
| Real-time timeline, diff graphs, visualizers | UI screens 2, 4 |
| Fix validation + Re-Verification Pass | ENGINE_SPEC Fix & Retest, UI screen 5 |
| Regression test + one-click CI suite export | Regression export, UI screen 6 |
| In-memory state + PostgreSQL JSONB (models, runs, suites) | ARCHITECTURE tables, run history |
| Docker Compose + Taskfile one-command start | ARCHITECTURE, Phase 1 |
| Sandbox, model-accuracy, bounded-exploration boundaries | PRD Constraints, UI Boundaries dialog |
| Rust/Python FFI engine | NOT built: Python behind EngineProtocol (roadmap) |
