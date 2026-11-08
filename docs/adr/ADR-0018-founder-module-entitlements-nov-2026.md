# ADR-0018: Founder module entitlements (Nov 2026)

Status: **Accepted (founder direction t115u, 8 Nov 2026)**

## Context

Prior BILLING-02 work gated finance validation and cross-module analytics by plan SKU. Founder approved a **module matrix** instead: Essentials core Lean modules vs Professional full suite, zero mandatory setup fees, optional consultancy quoted separately, grandfather legacy orgs, no hosted data mutation.

## Decision

1. **Catalogue** remains £499 Essentials / £999 Professional **per subscribed site**, 10% annual discount, Founder Pilot price and Professional entitlements preserved. **Unlimited memberships per site** on all plans (t116u); billed quantity is **sites**, not employees.
2. **Module entitlements** are the primary commercial gate (`modules.*` in app, `module_*` in Postgres). RBAC remains mandatory (plan never grants permissions alone).
3. **Essentials modules:** Maturity, 5S, Gemba, Actions, Suggestions, Schedule, Templates utilities. **Professional** adds Projects, Benefits, Problem solving, Training, Skills, Recognition, People HR.
4. **Setup fees** removed from catalogue (`setupFeeMinor: null`); onboarding copy states optional bespoke services.
5. **Legacy organisations** without `plan_code` keep Professional-level module access (explicit grandfather).
6. **LeanAI credits** documented as policy defaults (`leanai-credit-policy-estimates.md`); hard enforcement flag stays off until verified costs.
7. **Downgrade read-only/export** for excluded modules: documented; full RLS write blocks are a **follow-up slice** (see gaps below).

## Consequences

- Navigation and selected routes enforce module entitlements server-side; deeper mutation RPC coverage is incremental.
- Finance validation is gated by `module_benefits`, not a separate finance SKU flag.
- API/integrations remain unadvertised until implemented.

## Implementation status (overnight slice — not complete)

**Done in repo (review-only migrations):**

- `public.current_organisation_plan_module_entitled` SECURITY DEFINER wrapper + pgTAP under `authenticated`
- `private.assert_current_organisation_module_entitled` + initial mutation gates (projects, benefits draft, problem-solving draft, suggestion→project, LeanAI `start_ai_run` module map)
- SQL `api_access` / `integrations` denied for all plans (matches TS catalogue `false`)
- LeanAI credit period/reservation/settle/release schema (`billing_05`); enforcement gated by `organisation_ai_settings.credit_policy_enforced` default **false**
- Route segment layouts with upgrade placeholder (not billing redirect) for Professional module trees + People HR settings
- Sample server-action write gate (`projects/actions` create)

**Still unfinished (explicit):**

- Remaining Professional RPC lifecycle mutations (update/submit/approve per module, training/skills/recognition/people HR workforce RPCs, module setup bundle publishers)
- Historical read-only + export vs write-deny matrix on downgrade (RLS + mutation RPC coverage)
- Cross-module upgrade affordances on dashboards and deep links
- LeanAI: wire settle/release on run completion/failure; customer-facing usage surfaces; verified rate card (not illustration); concurrent/idempotent paths beyond reserve stub
- Marketing/sales copy audit vs Essentials module matrix and LeanAI policy
- Automated plan-matrix tests (four tiers + legacy) for every bypass class
