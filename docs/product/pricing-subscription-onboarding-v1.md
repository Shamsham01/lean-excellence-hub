# LEH Pricing, Subscription and Onboarding Strategy v1

Status: **Product decision / implementation baseline**

Date: **2026-09-29**

This document is the commercial and product baseline for Lean Excellence Hub (LEH) subscription implementation. It deliberately keeps pricing simple for the first customers while leaving room for later enterprise capabilities.

## 1. Commercial principles

1. **Organisation = customer / tenant.**
2. **Site = primary billable unit.**
3. **Do not charge per user.** LEH should encourage broad frontline participation in Continuous Improvement rather than penalise adoption.
4. Core Operational Excellence functionality should remain coherent across plans. Higher tiers primarily add **analytics, financial governance, integration, AI capacity, security/governance and service level**, not arbitrary removal of essential Lean workflows.
5. Pricing and feature access must be represented through a **plan + entitlement layer**, not hard-coded plan names throughout application code.
6. Stripe is the billing provider; LEH remains the source of truth for tenant access and entitlements.
7. Enterprise is **sales-managed / Contact Sales**, not a requirement to build every future enterprise feature before launch.

All prices below are working commercial prices and should be treated as market hypotheses until validated with paying customers. Prices exclude VAT where applicable.

---

## 2. Plans

### Essentials — Run Lean digitally

**£499 per site / month**

Intended for a site replacing spreadsheets, forms and disconnected Lean tooling with one operational system.

Includes:

- Maturity / Framework Assessments
- 5S / workplace organisation audits
- Gemba
- Suggestions
- Actions
- Projects
- Problem Solving
- Training
- Skills
- Recognition
- basic Benefits / Savings tracking
- standard dashboards and exports
- standard Lean AI allowance
- standard support
- unlimited/generous users

Essentials must still allow an organisation to **Assess → Improve → Develop → Prove**. Benefits are therefore not removed from this tier; advanced financial governance is the differentiator.

### Professional — Run an Operational Excellence system

**£999 per site / month**

Everything in Essentials, plus:

- advanced Benefits / Savings validation and portfolio reporting
- finance validation / stronger benefit governance
- advanced analytics
- API and webhooks
- standard business integrations such as Microsoft 365 / Power Automate / Make.com where available
- enhanced Lean AI allowance
- richer administration and reporting
- priority support

Professional is the likely default recommendation for established CI / OpEx teams.

### Enterprise — Run OpEx across the organisation

**From £1,500 per site / month, negotiated annual contract / Contact Sales**

Everything in Professional, plus enterprise capabilities as they become available and are commercially required:

- enterprise SSO / identity-provider integration
- central / corporate OpEx governance
- cross-site benchmarking and portfolio analytics
- advanced / custom integrations
- enterprise audit and data-governance controls
- custom retention requirements
- larger/custom Lean AI allowance
- organisation-wide AI knowledge and pattern detection
- SLA / named support / onboarding programme

Do **not** advertise an Enterprise capability as generally available until it is implemented. Enterprise can initially be sold as a negotiated Professional-plus package with explicit contracted entitlements.

### Founder Pilot

Private offer for the first **3–5 customer organisations**.

Suggested baseline:

- **£499 per site / month**
- Professional-level entitlements
- 12-month founder price protection
- onboarding fee waived or heavily reduced
- direct founder/product support
- expectation of structured feedback and, where mutually agreed, reference/case-study participation

This plan does not need to appear on the public pricing page.

---

## 3. Annual billing and implementation

### Annual billing

Offer a simple **10% discount** for annual prepayment.

Do not introduce complicated volume tiers in v1. Site quantity can initially be billed at the plan's standard per-site rate. Large multi-site negotiations can move to Enterprise / custom pricing.

### Onboarding / implementation fee

Working baseline:

| Plan | Implementation / onboarding |
| --- | ---: |
| Essentials | £1,500 |
| Professional | £2,500 |
| Enterprise | Custom |
| Founder Pilot | Waived or reduced |

Implementation can include organisation setup, initial hierarchy, framework configuration, training, imports and launch support.

---

## 4. Entitlement model

Billing must not be implemented as scattered checks such as `if (plan === "professional")`.

Use:

```
Organisation
  -> Billing account / subscription
  -> Plan
  -> Entitlements
  -> Existing LEH RBAC / permissions
```

RBAC answers **"is this person allowed to do this?"**

Entitlements answer **"has this organisation bought access to this capability?"**

Both checks may be required.

Suggested entitlement categories:

- core module access
- advanced benefits governance
- advanced analytics
- API access
- integration access
- Lean AI tier / allowance
- enterprise SSO
- enterprise governance
- cross-site benchmarking
- advanced audit / retention
- support/SLA tier

Only enforce entitlements for features that actually exist. Future Enterprise flags may exist as catalogue metadata but must not accidentally unlock unfinished functionality.

### Lean AI

Do not build metered AI overage billing in v1.

Start with configurable plan allowances and record actual consumption through the existing `ai_usage_events` infrastructure. Use the first customer data to set sensible commercial quotas later.

---

## 5. Stripe environment strategy

For a new Stripe integration, use a dedicated **Stripe general Sandbox** for LEH development/QA rather than relying on live mode.

Stripe Sandbox objects must never be mixed with live IDs.

Store Stripe secret keys only in server-side environment/secrets. Never expose them through `NEXT_PUBLIC_*`.

Suggested environments:

- local development -> Stripe Sandbox
- hosted QA / onboarding rehearsal -> same dedicated LEH Sandbox initially
- production -> Stripe live mode only after commercial readiness

Use Stripe test cards and subscription simulations/Test Clocks where supported to exercise renewal, cancellation and payment-failure behaviour without waiting for real time.

Reference:
- https://docs.stripe.com/testing-use-cases
- https://docs.stripe.com/billing/testing/test-clocks

---

## 6. Organisation onboarding v1

The first production-like onboarding journey should create a **brand-new organisation**, not reuse or wipe CookieWorks.

CookieWorks remains a regression / historical QA tenant.

Recommended journey:

1. User creates/signs into an LEH account.
2. Select **Create organisation**.
3. Enter:
   - organisation name
   - country / locale
   - time zone
   - reporting currency
   - first site name
4. Select a plan:
   - Essentials
   - Professional
   - Enterprise -> Contact Sales
5. LEH creates the organisation in **`provisioning`** state and establishes the owner identity.
6. LEH creates/reuses the Stripe Customer and starts Stripe Checkout in Sandbox.
7. Stripe webhook confirms the successful subscription/trial.
8. LEH records subscription state and activates the organisation.
9. Redirect owner into the LEH onboarding wizard.
10. Wizard guides:
    - organisation/site setup
    - people/invitations
    - module setup
    - optional LEH starter templates
    - import existing configuration
    - Lean AI guided setup
11. Complete onboarding and enter the normal platform.

The organisation lifecycle gate must prevent an unpaid/abandoned `provisioning` organisation from accessing normal modules.

Webhook events, not the browser success URL, are authoritative for billing state.

---

## 7. New-organisation full-platform smoke

Before first real-customer onboarding, use Stripe Sandbox to create a completely fresh QA organisation through the actual onboarding journey.

This is preferred over wiping CookieWorks because it proves:

- identity -> organisation provisioning
- Stripe customer/subscription creation
- lifecycle activation
- first-site setup
- RBAC/owner setup
- onboarding wizard
- every module's true empty-state/setup journey
- plan entitlement behaviour
- cancellation/reactivation behaviour

Run the full module smoke from zero:

1. Organisation / People / Sites / invitations
2. Maturity framework + Self + Formal assessment
3. 5S
4. Gemba
5. Scheduling
6. Suggestions -> Actions -> Projects -> Benefits
7. Problem Solving
8. Training
9. Skills
10. Recognition
11. Lean AI
12. exports/integrations currently in scope
13. mobile / responsive sanity checks

Use **Professional** for this fresh QA organisation so all currently implemented commercial capabilities are available.

Do not delete CookieWorks; keep it for regression against realistic historical data.

---

## 8. Subscription lifecycle and cancellation

LEH already has organisation lifecycle states:

`provisioning | active | suspended | closed`

Reuse them. Do not invent a second tenant lifecycle.

### Voluntary cancellation

Default v1 policy:

1. Customer requests cancellation.
2. Stripe subscription is set to **cancel at period end**.
3. LEH remains fully active until the paid period ends.
4. At period end, Stripe webhook updates the subscription to ended/cancelled.
5. LEH moves the organisation to **suspended**.
6. Normal module access is blocked.
7. Organisation owner/billing administrator retains access to a limited subscription/data area to:
   - reactivate
   - update billing
   - request/export data where supported
8. Reactivation returns the organisation to **active** without rebuilding tenant data.

Do not immediately delete customer data on cancellation.

Stripe supports cancelling subscriptions immediately or at the end of the current billing period. LEH v1 should use period-end cancellation for normal customer opt-out.

Reference:
- https://docs.stripe.com/billing/subscriptions/cancel

### Failed payment

Simple v1 policy:

- Stripe reports failed/past-due payment.
- LEH records **past_due / grace** billing state.
- Allow a **7-day grace period** while Stripe/customer attempts payment recovery.
- If recovered -> remain/return active.
- If not recovered by the configured end of grace -> organisation becomes **suspended**.

The grace duration should be configuration, not scattered business logic.

### Data retention after cancellation

Initial operational policy:

- target retention while suspended: **90 days**
- allow reactivation during retention
- do **not** implement irreversible automatic tenant deletion in the first billing slice
- after the retention window the organisation is **eligible for operator-managed closure/deletion**
- customer-requested deletion must follow the applicable contract/privacy/legal obligations
- before live launch, document the final retention/deletion terms in customer Terms / DPA

Moving to `closed` or physically deleting tenant data must remain a deliberate audited operation.

### Enterprise

Enterprise contracts may override:
- notice period
- retention
- invoice/payment terms
- suspension policy
- SLA

Do not hard-code Enterprise contract exceptions into the initial self-service path.

---

## 9. Billing state model

Keep Stripe's detailed status and an LEH-normalised access state.

Suggested LEH billing states:

- `pending`
- `trialing`
- `active`
- `past_due`
- `cancel_at_period_end`
- `suspended`
- `ended`

Do not infer payment state from redirect URLs.

Persist and process relevant Stripe webhook event IDs idempotently so retries cannot create duplicate organisations/subscriptions or repeat lifecycle changes.

At minimum, the billing foundation must safely handle:

- successful Checkout/subscription creation
- subscription updated
- subscription cancellation / end
- invoice paid
- invoice payment failed

Exact Stripe event selection should follow the chosen integration implementation and current Stripe API version.

---

## 10. Customer self-service

Use Stripe Customer Portal where it reduces custom billing UI.

Target self-service:

- update payment method
- view billing/invoices
- cancel at period end
- reactivate where supported / route back to LEH
- later: plan changes when product rules are mature

LEH still owns application access decisions and tenant lifecycle.

---

## 11. Enterprise implementation policy

Do not block initial launch on:

- SCIM
- SAML/enterprise SSO portal
- custom data retention engine
- enterprise audit centre
- data residency controls
- custom SLA tooling
- complex AI metered billing
- corporate benchmarking warehouse

Build these when customer demand justifies them.

The billing/entitlement model should make them addable without redesigning subscriptions.

---

## 12. Recommended implementation sequence

### BILLING-01 — Foundation + Sandbox

- plan catalogue / entitlements
- organisation billing account
- Stripe Customer mapping
- Stripe Sandbox Checkout
- webhook processing + idempotency
- subscription lifecycle
- organisation lifecycle gate
- Customer Portal
- period-end cancellation
- payment-failure/grace handling
- automated tests

### ONBOARD-01 — First-customer onboarding

- create organisation
- first-site setup
- plan selection
- Checkout handoff
- activation
- guided onboarding
- Lean AI setup assistance
- invite team
- onboarding completion state

### QA-NEW-ORG-01 — From-scratch release smoke

Create a brand-new organisation through the Sandbox journey and execute every LEH module from an empty tenant.

### BILLING-02 — Plan enforcement

After the fresh full-platform smoke:

- enforce the agreed Essentials / Professional entitlements
- verify upgrades/downgrades
- refine AI allowances
- expose billing/admin screens

### LIVE-CUTOVER

Before first real customer:

- Stripe live products/prices and production webhook endpoint
- business/account/payout requirements complete
- Supabase Free -> Pro
- enable leaked-password protection
- final Auth/security review
- final onboarding rehearsal
- production terms, privacy/DPA and retention wording reviewed

---

## 13. Decision summary

For LEH v1:

- **bill by site, not user**
- **Essentials £499/site/month**
- **Professional £999/site/month**
- **Enterprise from £1,500/site/month / Contact Sales**
- **10% annual discount**
- **Founder Pilot £499/site/month with Professional entitlements**
- use a plan/entitlement layer
- build in Stripe Sandbox first
- preserve CookieWorks
- create a brand-new organisation through real onboarding for the final from-scratch product smoke
- normal cancellation is at period end -> suspend tenant, retain data, allow reactivation
- no automatic destructive deletion in the first billing release
