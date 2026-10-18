# EntitleSim

> Model-Based Verification & Counterexample Engine for SaaS Entitlement Workflows

EntitleSim systematically explores bounded event sequences (reordered/duplicated webhooks, concurrent ops, interrupted handlers), checks developer-defined entitlement and tenant-isolation invariants, minimizes failing traces into counterexamples, lets the dev validate a fix, and exports a regression test for CI/CD.

## Differentiators

Systematic event exploration · Counterexample minimization · Entitlement-specific invariants as first-class rules · Regression test generation. (We do NOT claim to invent model checking or generic chaos testing.)

## 6-Step Verification Workflow

1. **Model & Define**: Define plans, features, invariants, and initial scenario sequences.
2. **Bounded Exploration**: Systematically permute event arrivals, simulate duplicate webhooks, and record states explored & invariant violations in real-time.
3. **Violation & Minimization**: Run `ddmin` delta debugging to strip non-essential events down to a 4-step canonical failure.
4. **Inspect State Diff**: Interactive trace playback, state-machine graph with offending transitions highlighted in red, and side-by-side Expected vs Observed state diffs.
5. **Fix & Retest**: Validate bug fixes (`fixed=true`), verify counterexample passes, and execute full re-verification pass (0 violations).
6. **Regression Export**: Export self-contained `pytest` tests and ready-to-run GitHub Actions CI suite.

---

## Quickstart

Run without Docker (defaults to SQLite file database at `backend/entitlesim.db`):

```bash
task dev
```

This starts:
- **Web Dashboard**: [http://localhost:5173](http://localhost:5173)
- **API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Running the 1-Click Demo

Once `task dev` is running, open [http://localhost:5173](http://localhost:5173) in your browser and click **Run Demo** in the top navigation bar. EntitleSim will automatically walk through steps 1 to 6 end-to-end:
1. Loads the SaaS subscription model (2 tenants, 5 invariants).
2. Explores bounded state space and captures the `INV-1` unauthorized premium access violation.
3. Minimizes the failing trace to the canonical 4-step sequence.
4. Highlights the out-of-order transition on the interactive state machine graph.
5. Applies the fix (`fixed=true`) and re-verifies 0 violations.
6. Displays the generated regression test and CI workflow.

---

### Optional: Docker Compose

If Docker and Docker Compose are available on your host, you can optionally run with PostgreSQL:

```bash
task up
# or
docker compose up --build
```

---

## Verification & Testing

```bash
# Run backend engine and API test suite (17 passed)
task test

# Seed the default SaaS model into the database
task seed

# Build frontend production bundle
cd frontend && npm run build
```

---

## Boundaries & Constraints

- **Model accuracy**: Verifies the developer-defined state model / instrumented adapter, not uninstrumented source code.
- **Bounded exploration**: Strictly bounded by configurable step limits (depth, retries, concurrency, state caps).
- **Sandbox only**: No real payment-provider or Stripe transactions; all events simulated locally.

> *"From a flaky production bug to a permanent regression test in one workflow."*
