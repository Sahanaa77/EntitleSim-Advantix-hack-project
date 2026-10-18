# Engine Spec
Model-based verification: a **reference model** (oracle) vs a **system under test (SUT)** that has seeded entitlement bugs. After every delivered event, invariants compare/validate state.

## Model JSON (also accept YAML)
```json
{
 "name":"saas-upgrade-demo",
 "tenants":[{"id":"A","roles":["admin","member"]},{"id":"B","roles":["admin","member"]}],
 "feature_roles":{"premium":["admin","member"]},
 "plans":{
  "free":{"features":["basic"],"quota":{"api_calls":100}},
  "pro":{"features":["basic","premium"],"quota":{"api_calls":1000}}},
 "transitions":[["none","free"],["free","pro"],["pro","free"],["free","cancelled"],["pro","cancelled"]],
 "policies":{"grace_period_events":1,"trial_events":0,"prepaid_credits":0},
 "scenario":[ ...events... ],
 "invariants":[
  {"id":"INV-1","type":"feature_access_matches_plan"},
  {"id":"INV-2","type":"usage_within_quota"},
  {"id":"INV-3","type":"tenant_isolation"},
  {"id":"INV-4","type":"no_access_after_cancel"},
  {"id":"INV-5","type":"cache_db_consistent"}]
}
```
## Event
`{id, tenant, customer_id, seq, type, payload}`; types: SubscriptionCreated{plan} · PlanUpgraded{plan} · PlanDowngraded{plan} · PaymentSucceeded · PaymentFailed · SubscriptionCancelled · UsageRecorded{units} · AccessCheck{feature}. `seq` = provider order (truth for ordering). Both tenants deliberately share customer_id "c1" in the sample.

## Policies (reference AND SUT implement them; invariants account for them)
- Trial: after SubscriptionCreated(pro) with trial_events=N, pro features stay active for N events, then drop to free unless PaymentSucceeded arrives.
- Grace period: PaymentFailed → status past_due; premium kept for grace_period_events further events, then revoked.
- Prepaid credits: usage above plan quota consumes a credit balance; INV-2 becomes usage ≤ quota + credits.
- Tenant roles: AccessCheck carries `role`; access = plan has feature AND role in feature_roles[feature]. SUT enforces this correctly (modeled so role rules are expressible).
- Sample model sets grace_period_events=1 and a second sample `saas_trial_grace.json` enables trial_events=2, prepaid_credits=50.

## Reference (oracle)
Per tenant: dedupe by event id, sort by seq, apply atomically → expected {plan,status,features,usage}. Ignores delivery order.

## SUT (`sut.py`) — `EntitlementService(fixed: bool)`
State per tenant: sub{plan,status}, cache{features}, usage, seen_ids. Delivery-order handlers. Handler = 2 writes: (1) update sub, (2) update cache. Seeded bugs, all disabled when fixed=True:
- B1 no version check: applies stale events by delivery order (fixed: drop if seq ≤ last applied seq for that tenant+customer)
- B2 no idempotency: duplicate event ids re-applied, double-counts usage (fixed: dedupe by id)
- B3 partial update / missed cache invalidation: interrupt between write 1 and 2 leaves cache stale (fixed: commit both or roll back)
- B4 cache/usage keyed by customer_id only, not (tenant, customer_id) → tenant A events mutate tenant B (fixed: scoped key)
- B6 lost update under concurrency: UsageRecorded handler is read-usage then write-usage+units (2 steps); interleaved handlers overwrite each other (fixed: atomic increment/lock)

## Invariants (`invariants.py`, each returns None or Violation{id, tenant, message, expected, observed, step})
- INV-1 feature_access_matches_plan: SUT cache features == reference features (flags "unauthorized premium access" or "paid feature denied")
- INV-2 usage_within_quota: SUT usage == reference usage and ≤ plan quota
- INV-3 tenant_isolation: after an event for tenant X, tenant Y's state snapshot is unchanged
- INV-4 no_access_after_cancel: cancelled sub (per reference) ⇒ no premium features in SUT
- INV-5 cache_db_consistent: SUT cache.plan features == sub.plan features
Run all after every delivery step.

## Explorer (`explorer.py`)
Input: model, bounds {max_depth(default 12), max_retries(1), allow_duplicates, allow_reorder, allow_interrupt, max_states(20000), max_concurrency(2), seed}.
- Generate delivery schedules over the full scenario (not shortest-first, so traces are long): permutations of events (seeded sample if > max_states), each event optionally duplicated up to max_retries, optional interrupt (crash after write 1) at any handler call, cross-tenant interleaving.
- Concurrent mode (max_concurrency>1): handlers are split into their write/read steps and steps of up to max_concurrency handlers are interleaved (same tenant and cross-tenant). Exposes B6 and race variants of B1/B3.
- Replay each schedule on a fresh SUT, check invariants every step, hash states to skip repeats.
- Record first violation per (invariant, signature); stop after 5 distinct unless told otherwise.
- Stats: states_explored, violations, duration_ms (measured), by_depth[], by_invariant{}.

## Minimizer (`minimizer.py`) — ddmin
Given failing trace T and invariant id: repeatedly try removing chunks (halves, then single events), replay, keep removal if SAME invariant still violated. Stop at 1-minimal. Return minimal trace, replay count, duration. Delivery order of kept events is preserved. Must reduce the sample failure to **4 steps**.

## Sample scenario (must yield the demo)
Tenant A, customer c1: seq1 SubscriptionCreated(free) · seq2 PlanUpgraded(pro) · seq3 PlanDowngraded(free) · plus noise: PaymentSucceeded, UsageRecorded×2, AccessCheck, and tenant B events. Delivery 1,3,2 → B1 leaves A on pro (expected free) → INV-1 "unauthorized premium access". Minimal = [Created, Downgraded(seq3), Upgraded(seq2), AccessCheck(premium)] = 4 steps. Also surface B2/B3/B4 as other violations, and B6 when max_concurrency≥2.

## Fix & Retest
Rerun minimal trace and full exploration with fixed=True ⇒ passed, 0 violations ("Re-Verification Pass").

## Regression export (`exporter.py`)
pytest file named `test_regression_<inv>_<shortid>.py`: builds EntitlementService(fixed=...), replays minimal events in recorded delivery order, asserts `check_all()` returns no violations; has a comment header with invariant, expected vs observed. Passes with fixed=True, fails with fixed=False. Also JSON export of the trace. **Suite export:** one `test_entitlesim_suite.py` covering every counterexample of a run, bundled with a ready `.github/workflows/entitlesim.yml` snippet that runs pytest (the "one-click CI suite exporter").

## Engine interface
`EngineProtocol`: explore(model,bounds,fixed)->RunResult · minimize(model,trace,inv_id,fixed)->MinResult · replay(model,trace,fixed)->ReplayResult. API depends only on this protocol.
