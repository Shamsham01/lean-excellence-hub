# ADR-0018: Founder module entitlements (Nov 2026)

Status: **Accepted (founder direction t115u, 8 Nov 2026)**

## Context

Prior BILLING-02 work gated finance validation and cross-module analytics by plan SKU. Founder approved a **module matrix** instead: Essentials core Lean modules vs Professional full suite, zero mandatory setup fees, optional consultancy quoted separately, grandfather legacy orgs, no hosted data mutation.

## Decision

1. **Catalogue** remains £499 Essentials / £999 Professional per site, 10% annual discount, Founder Pilot price and Professional entitlements preserved.
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

## Known gaps (same PR, documented)

- Downgrade write-deny at Postgres RPC layer for every Professional module.
- LeanAI admission reservation / credit settlement in `start_ai_run`.
- People HR settings surface split (directory vs HR product fields).
- Suggestion→project conversion and module-setup AI builders: entitlement hooks beyond nav/route.
