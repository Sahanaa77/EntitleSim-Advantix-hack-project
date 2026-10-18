# Demo Script (≈2 min, round-2 presentation)
1. **Problem (10s):** "Webhooks arrive late, twice, or out of order — happy-path tests miss it."
2. **Model & Define:** sample model loaded — 2 tenants, free/pro plans, 5 invariants. Click Validate.
3. **Bounded Exploration:** keep defaults, Run. Point at states explored, violations found, ms.
4. **Violation & Minimization:** open INV-1 "unauthorized premium access". Click Minimize: long trace collapses to 4 steps.
5. **Inspect State Diff:** state-machine graph shows the offending edge in red; step through; step 3 turns red — stale downgrade applied after upgrade. Expected: free/no premium. Observed: pro/premium.
6. **Fix & Retest:** Apply fix → counterexample passes → Re-Verification Pass shows 0 violations.
7. **Regression Export:** show generated pytest; Copy. "Drops straight into CI."
8. **Boundaries (10s):** verifies the developer-defined model, bounded, sandbox only.
Closing line: "From a flaky production bug to a permanent regression test in one workflow."
