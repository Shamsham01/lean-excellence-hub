# Billing entitlements — operator and admin reference

Product source of truth: [pricing-subscription-onboarding-v1.md](../product/pricing-subscription-onboarding-v1.md). Architecture: [ADR-0017](../adr/ADR-0017-plan-entitlements-and-stripe-sandbox-billing.md).

## Plan codes

| Code | Checkout | Professional entitlements |
| --- | --- | --- |
| `essentials` | Public self-service | No — advanced analytics and finance benefit validation are gated |
| `professional` | Public self-service | Yes |
| `founder` | Private price IDs | Yes (Professional-level) |
| `enterprise` | Contact sales only | Negotiated |

Legacy tenants with **no** subscription row (for example CookieWorks) keep Professional-level capabilities until a subscription is attached.

## Enforcement layers (BILLING-02)

1. **Postgres** — `private.organisation_plan_capability` / `private.current_organisation_plan_capability` mirror the catalogue for:
   - `advanced_benefits_governance`
   - `advanced_analytics`
   - `api_access`
   - `integrations`  
   Finance benefit validation (`record_benefit_validation` with role `finance`) fails closed when the plan is Essentials.

2. **Application** — `resolveOrganisationEntitlements` + `ModuleAnalyticsDashboard` upgrade prompt for advanced analytics; benefit validation queue shows an upgrade card for finance work on Essentials.

3. **Operational billing** — `trialing`, `active`, `cancel_at_period_end`, and in-grace `past_due` grant capabilities. Ended or expired grace denies operational access before entitlements are evaluated.

## Owner billing UI

`/platform/settings/billing` (permission `billing.manage`) shows subscription fields, site capacity controls, Stripe Customer Portal handoff, and operational notices (trial, grace, scheduled cancellation, ended).

Suspended organisations land on `/billing` with recovery copy keyed to billing state.

## Test and rehearsal

- Unit: `tests/unit/billing-entitlements.test.ts`, `billing-plan-capabilities.test.ts`, `billing-operational-notices.test.ts`
- pgTAP: `supabase/tests/database/billing_plan_capabilities.test.sql`
- Playwright: `tests/e2e/billing-trial-site-upgrade.spec.ts` (trialing Essentials → site limit → billing upgrade prompt), plus existing `site-capacity.spec.ts` and `billing-founding-onboarding.spec.ts`

Fake billing may set `BILLING_FAKE_INITIAL_SUBSCRIPTION_STATUS=trialing` for local/E2E Stripe trial simulation without live keys.

## Operator items still outside this codebase

- Production `LEH_SELF_SERVICE_CHECKOUT_ENABLED` and Stripe price/webhook configuration
- Customer legal pack (terms, privacy, DPA)
- Hosted QA-NEW-ORG-001 Sandbox rehearsal before first live customer
