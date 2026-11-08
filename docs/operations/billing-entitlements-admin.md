# Billing entitlements — operator and admin reference

Product source of truth: [pricing-subscription-onboarding-v1.md](../product/pricing-subscription-onboarding-v1.md). Architecture: [ADR-0017](../adr/ADR-0017-plan-entitlements-and-stripe-sandbox-billing.md).

## Plan codes

| Code | Checkout | Module scope |
| --- | --- | --- |
| `essentials` | Public self-service | Core modules (Maturity, 5S, Gemba, Actions, Suggestions + Schedule/Templates utilities) |
| `professional` | Public self-service | Full module set |
| `founder` | Private price IDs | Professional-level modules + Founder price |
| `enterprise` | Contact sales only | Negotiated |

**Membership:** unlimited employees/users **per site** on every plan. Billing counts **subscribed sites** only (`site_quantity`), not headcount. See ADR-0018 and `commercial-principles.ts`.

Legacy tenants with **no** subscription row (for example CookieWorks) keep Professional-level module access until a subscription is attached.

## Enforcement layers (BILLING-02 / BILLING-03)

1. **Postgres** — `private.organisation_plan_capability` for `module_*` keys and Benefits via `module_benefits`.
2. **Application** — `resolveOrganisationEntitlements.modules`, nav `planModule`, route `requirePlanModuleEntitlement`.
3. **Operational billing** — `trialing`, `active`, `cancel_at_period_end`, and in-grace `past_due` grant capabilities. Ended or expired grace denies operational access before entitlements are evaluated.

## Owner billing UI

`/platform/settings/billing` (permission `billing.manage`) shows subscription fields, site capacity controls, Stripe Customer Portal handoff, and operational notices (trial, grace, scheduled cancellation, ended).

Suspended organisations land on `/billing` with recovery copy keyed to billing state.

## People: foundation vs paid HR

| Surface | Plan gate | RBAC |
| --- | --- | --- |
| `/platform/settings/people` invitations | **None** (all plans) | `invitations.manage`, `roles.delegate` |
| Colleague CSV import (invitations) | **None** | import permissions |
| Workforce create / import | `people_hr` module | `workforce.provision` / `workforce.import` |
| Job functions settings | `people_hr` | `job_functions.*` |
| `/platform/people/[id]/admin` | `people_hr` | membership admin |

## Security checklist (billing slice)

- [ ] `public.current_organisation_plan_module_entitled` remains SECURITY DEFINER; authenticated has no `EXECUTE` on `private.*_plan_capability`
- [ ] Professional mutations call `private.assert_current_organisation_module_entitled` (Postgres) and module assert in server actions for UX
- [ ] `api_access` / `integrations` return false until product ships
- [ ] LeanAI credits: `credit_policy_enforced` default false; reserve/settle/release wired when enabled
- [ ] Unlimited memberships per site unchanged (no seat metadata)

## Test and rehearsal

- Unit: `tests/unit/billing-entitlements.test.ts`, `billing-plan-capabilities.test.ts`, `billing-operational-notices.test.ts`
- pgTAP: `supabase/tests/database/billing_plan_capabilities.test.sql`
- Playwright: `tests/e2e/billing-trial-site-upgrade.spec.ts` (trialing Essentials → site limit → billing upgrade prompt), plus existing `site-capacity.spec.ts` and `billing-founding-onboarding.spec.ts`

Fake billing may set `BILLING_FAKE_INITIAL_SUBSCRIPTION_STATUS=trialing` for local/E2E Stripe trial simulation without live keys.

## Operator items still outside this codebase

- Production `LEH_SELF_SERVICE_CHECKOUT_ENABLED` and Stripe price/webhook configuration
- Customer legal pack (terms, privacy, DPA)
- Hosted QA-NEW-ORG-001 Sandbox rehearsal before first live customer
