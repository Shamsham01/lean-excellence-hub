# Stripe Sandbox onboarding smoke — configuration

Planning document for **BILLING-001 / QA-NEW-ORG-001**. Automated agents and
implementation PRs must not create Stripe live objects, apply hosted
migrations, mutate CookieWorks, or write secrets into the repository.

Companion: `docs/qa/QA-NEW-ORG-001-runbook.md`.

Product baseline: `docs/product/pricing-subscription-onboarding-v1.md`.

---

## Purpose

Configure a dedicated **Stripe general Sandbox** so an operator can run a
brand-new Professional organisation through Checkout, webhooks, Customer
Portal, cancellation, payment failure, and reactivation.

CookieWorks stays the historical regression tenant. Do not wipe it.

Use **Sandbox only**. `sk_live` is rejected by the application. Live mode is a
later LIVE-CUTOVER gate, not this runbook.

---

## Operator actions (human only)

These rows require a maintainer. This PR does not perform them.

| Action | When | Do not |
| --- | --- | --- |
| Create/reuse a dedicated LEH Stripe Sandbox | Before first Sandbox smoke | Mix Sandbox IDs with live IDs |
| Create Products/Prices listed below | Before `BILLING_PROVIDER=stripe` | Put prices in git |
| Create webhook endpoint `POST /api/billing/stripe/webhook` | After the billing slices are deployed to the target app | Use a live endpoint |
| Put server-only env vars on the target runtime (Netlify / local) | After webhook signing secret exists | Prefix any Stripe secret with `NEXT_PUBLIC_` |
| Apply hosted Supabase migrations for billing | Explicit approval, after CORE+LIFECYCLE+ONBOARD merge | Replay already-applied versions |
| Run QA-NEW-ORG-001 against hosted | Explicit approval | Reset CookieWorks to do it |

---

## 1. Products and prices (Sandbox catalogue)

Create **GBP**, per-site recurring prices. Setup fees are catalogue-only and
must **not** be Checkout line items.

Annual prices are **10% off** the monthly site rate (`monthly × 12 × 0.9`).

| Plan | Public | Self-service | Monthly / site | Annual / site (10% off) | Env key pair |
| --- | --- | --- | --- | --- | --- |
| Essentials | Yes | Yes | £499.00 | £5,389.20 | `STRIPE_PRICE_ESSENTIALS_MONTHLY` / `_ANNUAL` |
| Professional | Yes | Yes | £999.00 | £10,789.20 | `STRIPE_PRICE_PROFESSIONAL_MONTHLY` / `_ANNUAL` |
| Founder Pilot | No | Checkout if price IDs set | £499.00 | £5,389.20 | `STRIPE_PRICE_FOUNDER_MONTHLY` / `_ANNUAL` |
| Enterprise | Contact Sales | No | From £1,500 | Negotiated | None |

Founder Pilot must not appear on the public plan picker. Leave founder price
IDs empty until an operator is ready to attach that private offer.

Checkout `line_items` use `price` + `quantity` (site quantity). Metadata on
both the Checkout Session and the Subscription must include:

- `organisation_id`
- `plan_code` (`essentials` \| `professional` \| `founder`)
- `billing_interval` (`monthly` \| `annual`)

The application already writes those fields.

---

## 2. Environment variables (server-only)

Never commit real values. Never expose them through `NEXT_PUBLIC_*`.

| Name | Sandbox smoke | Notes |
| --- | --- | --- |
| `BILLING_PROVIDER` | `stripe` | Must be set explicitly. Local/CI must set `fake`. Missing provider or Stripe secrets never fall back to fake; the app fails closed and reports billing unavailable. |
| `STRIPE_SECRET_KEY` | `sk_test_…` (Sandbox) | `sk_live` is rejected |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Required when provider is `stripe` |
| `STRIPE_PRICE_PROFESSIONAL_MONTHLY` | `price_…` | Required for QA-NEW-ORG-001 |
| `STRIPE_PRICE_PROFESSIONAL_ANNUAL` | `price_…` | Optional for this smoke; needed to exercise annual |
| `STRIPE_PRICE_ESSENTIALS_*` | `price_…` | Optional unless Essentials is in the smoke |
| `STRIPE_PRICE_FOUNDER_*` | empty | Private offer |
| `APP_ORIGIN` | Public origin of the target app | Checkout success/cancel and Portal return URLs |

Local fake rehearsal (already covered by Playwright):

```bash
BILLING_PROVIDER=fake
```

---

## 3. Webhook endpoint

Path: `POST /api/billing/stripe/webhook`

Runtime: Node.js. Signature header: `stripe-signature`.

Subscribe at least:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Other event types are accepted and ignored after idempotent claim.

Retries must be safe: `billing_webhook_events` claims each Stripe event id
once. Do not infer success from the Checkout success URL.

---

## 4. Customer Portal

Enable Stripe Customer Portal in the Sandbox for:

- payment method update
- invoice history
- cancel at period end (not immediate cancel)
- reactivation / un-cancel where Stripe still allows it

LEH return URLs:

- active org: `/platform/settings/billing`
- suspended org: `/billing`

LEH still owns tenant access. Portal does not activate a tenant by itself.

---

## 5. Test cards and Test Clocks

Use current Stripe Sandbox test cards from
https://docs.stripe.com/testing (do not copy live PANs).

Typical exercises:

| Intent | Method |
| --- | --- |
| Happy path | Standard Visa success card (`4242…` in Sandbox docs) |
| Payment failure / past_due | A card Stripe documents as failing recurring charge |
| Recovery | Update payment method in Customer Portal, then pay the invoice |
| Period end without waiting | Billing Test Clocks — https://docs.stripe.com/billing/testing/test-clocks |

Advance a Test Clock to:

1. period end after `cancel_at_period_end`
Also advance a Test Clock or wait until **after** the 7-day grace with **no**
further Stripe event. LEH must still deny operational access and route to
`/billing` on the next application request.

---

## 6. Expected LEH lifecycle mapping

| Billing snapshot | Organisation status | Member landing |
| --- | --- | --- |
| none / Checkout open | `provisioning` | `/onboarding` wait screen |
| `trialing`, `active`, `cancel_at_period_end`, `past_due` within grace | `active` | `/onboarding/setup` then `/platform` |
| `ended` / unrecovered `past_due` | `suspended` | `/billing` |
| `closed` | unchanged by billing | not used by this smoke |

Cancellation v1 is **period-end**, then suspend, retain data, allow
reactivation. There is **no automatic tenant deletion**. After 90 days the
org is eligible for operator-managed closure only.

---

## 7. Secrets hygiene

- Store Stripe secrets only in the server environment / secret manager.
- Rotate a webhook secret if it is pasted into chat, tickets, or a PR.
- Do not screenshot Dashboard pages that show secret keys.
- Sandbox customers/subscriptions created for this smoke may be left in
  Sandbox; do not copy them to live.
