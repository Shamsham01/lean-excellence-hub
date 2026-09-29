# BILLING-001 — Architecture and operator report

Status: **implementation complete as stacked PRs; not merged, not deployed.**

Date: **2026-09-29**

Parent: #170. Product SoT: `docs/product/pricing-subscription-onboarding-v1.md`.

This is an operator-facing summary of what landed in the sequential slices.
It is not a licence to merge, apply hosted migrations, create live Stripe
objects, or mutate CookieWorks.

---

## Stacked PRs

| Slice | Issue | PR | Branch | Base |
| --- | --- | --- | --- | --- |
| CORE | #172 | #176 | `cursor/billing-core-001-d921` | `main` |
| LIFECYCLE | #173 | #177 | `cursor/billing-lifecycle-001-d921` | CORE |
| ONBOARD | #174 | #178 | `cursor/onboard-001-d921` | LIFECYCLE |
| QA runbook | #175 | this PR | `cursor/qa-new-org-001-d921` | ONBOARD |

Merge order is CORE → LIFECYCLE → ONBOARD → QA docs. Do not squash the stack
out of order.

Pre-merge closures landed on this stack (do not redesign billing):

| Finding | PR |
| --- | --- |
| Fake provider only when `BILLING_PROVIDER=fake` is explicit; deployed missing Stripe config fails closed | #176 |
| Fake Checkout completion bound to auth + selected provisioning org + persisted session | #178 |
| `createCustomerPortalSession` enforces `billing.manage`; suspended owners keep Portal; ordinary members do not | #177 |
| Expired `past_due` grace denies operational access without a later webhook | #177 |
| `create_founding_organisation` consumes founding capability transactionally | #178 |

---

## Architecture (what LEH owns vs Stripe)

```
Organisation (tenant)
  → organisation_billing_accounts (customer mapping, open Checkout)
  → organisation_subscriptions (normalised snapshot)
  → plan catalogue / entitlements
  → existing RBAC (membership permissions)
```

- **RBAC** answers “is this person allowed to do this?”
- **Entitlements** answer “has this organisation bought the capability?”
  Catalogue entitlements exist; enforcement of Essentials vs Professional is
  **BILLING-02**, not this release.
- Stripe (or the fake provider, **only** when `BILLING_PROVIDER=fake` is set)
  is the payment processor. Missing Stripe secrets in a deployed environment
  fail closed and report billing unavailable. LEH is the source of truth for
  tenant access. Webhook event ids are claimed idempotently.
- Site is the billable unit. Users are not billed.
- Organisation lifecycle remains `provisioning | active | suspended | closed`.
  Billing maps onto those states. `closed` is never auto-opened or auto-set.

Commercial catalogue in code:

- Essentials £499 / site / month
- Professional £999 / site / month
- Enterprise from £1,500, Contact Sales only (no Checkout)
- Founder Pilot £499 with Professional entitlements, not public
- Annual = 10% off
- Setup fees catalogue-only, not collected in Checkout
- VAT/tax out of scope

Access routing:

| Org status | `onboarding_required` | Landing |
| --- | --- | --- |
| `provisioning` | n/a | `/onboarding` |
| `active` | true | `/onboarding/setup` |
| `active` | false | `/platform` |
| `suspended` | n/a | `/billing` |

`current_membership_id` stays **active-only** and also requires operational
billing (or no subscription, for legacy tenants such as CookieWorks). A
`past_due` snapshot whose grace has expired is treated as suspended on the
next application access even if Stripe sends no further webhook.
Operational RLS stays closed while provisioning/suspended/stale-active-expired.
List/switch include those statuses so recovery pages can load.

Customer Portal is a server-side mutation. Active organisations require
`billing.manage`. Suspended organisations use a lifecycle-safe billing
authority check so owners can open Portal without reopening operational RBAC
for ordinary members.

Founder signup uses `founding_signup_bindings` and Auth `user_metadata`.
The invitation-only signup hook still rejects unbound accounts.
`create_founding_organisation` consumes `can_found_organisation` in the same
transaction; a second direct RPC returns `42501`. Unexpired founding bindings
are reused for the same canonical email.

---

## Tests already run (local)

- pgTAP: billing foundation 18 + lifecycle 37 + onboarding 22
- Unit: catalogue, env (explicit fake only; missing provider fails closed;
  `sk_live` rejected), fake Checkout hostile completion, portal
  `billing.manage` authority, fake provider, access paths, workspace redirects
- Playwright: authentication-shell (no workforce self-signup; founder link
  present); founding journey with explicit `BILLING_PROVIDER=fake` and
  `E2E_WITH_SUPABASE=1`

Hosted Fast CI / Database CI / Full Regression run on the stacked PRs.
Mark **#176 only** ready for review so Full Regression runs; keep later
stacked PRs as drafts until CORE is green.

This report does not wait on hosted merge.

---

## Operator actions remaining (human)

Do **not** treat this list as authorised work for an agent.

1. Review and merge the stack in order.
2. Apply new billing migrations to hosted Supabase **once**, after merge.
   Do not replay older versions. CookieWorks rows should keep
   `onboarding_required = false`.
3. Create Stripe **Sandbox** products/prices and a webhook endpoint as in
   `docs/qa/STRIPE-SANDBOX-ONBOARDING-SMOKE.md`.
4. Set Netlify/server env: `BILLING_PROVIDER=stripe`, `sk_test_`, `whsec_`,
   Professional price ids. Never `sk_live` on this environment.
5. Execute `docs/qa/QA-NEW-ORG-001-runbook.md` against a **new** org.
6. Keep CookieWorks for regression.
7. LIVE-CUTOVER later: live prices, live webhook, Supabase Pro, leaked
   password protection, Terms/DPA/retention wording.

---

## Explicitly not done

- Hosted migration apply
- Hosted or production deploy
- Stripe live objects
- CookieWorks mutation or reset
- VAT/tax
- AI overage billing
- SCIM / SSO
- Auto tenant deletion
- Plan entitlement enforcement (BILLING-02)
