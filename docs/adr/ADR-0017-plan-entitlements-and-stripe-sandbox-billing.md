# ADR-0017: Plan entitlements and Stripe Sandbox billing

## Status

Accepted for BILLING-001.

## Context

LEH already authorises people through RBAC and session-bound organisation
context. It did not represent commercial access. Pricing is defined in
[pricing-subscription-onboarding-v1](../product/pricing-subscription-onboarding-v1.md).
Stripe is the payment provider. Organisation lifecycle already uses
`provisioning | active | suspended | closed`.

## Decision

### Entitlements are not RBAC

```
Organisation → Subscription → Plan → Entitlements → existing RBAC
```

RBAC answers whether a person may perform an action. Entitlements answer
whether the organisation has purchased a capability. Application code must not
branch on Stripe product names or `if (plan === "professional")`.

Stable plan codes are `essentials`, `professional`, `enterprise`, and
`founder`. Stripe Price IDs are environment mappings, not product behaviour.

### Provider boundary

All Stripe SDK calls live behind `BillingProvider`. The fake provider is used
only when `BILLING_PROVIDER=fake` is set explicitly (local, CI, and tests).
Missing Stripe secrets must not select fake. A deployed environment without
`BILLING_PROVIDER` or without Stripe Sandbox secrets fails closed and reports
billing unavailable. The Stripe implementation is Sandbox-only: live secret
keys (`sk_live…`) are rejected.

Checkout may mix a recurring price with a one-time setup fee, but LEH v1 keeps
setup fees as catalogue metadata and does not collect them automatically.

### Webhooks are authoritative

Browser Checkout success means only that Checkout returned. Signed webhook
events persist subscription snapshots idempotently. Organisation activation and
suspension map onto existing organisation status values; they are not inferred
from redirects.

Operational billing states (`trialing`, `active`, `cancel_at_period_end`, and
`past_due` within the configured grace window) activate or reactivate a
`provisioning` or `suspended` organisation. Ended, suspended, or unrecovered
`past_due` billing suspends an `active` organisation. A `provisioning`
organisation that never becomes operational stays `provisioning`. LEH never
auto-closes a tenant; `closed` remains an operator action.

`current_membership_id` still requires `organisations.status = active`, so
operational RLS stays closed for provisioning and suspended tenants. Listing
and switching include those statuses so `/onboarding` and `/billing` can load
without a redirect loop, and a member can still select a different active
organisation.

### Site capacity

LEH bills per site. Paid `site_quantity` is the allowance. Organisations with
no subscription, including CookieWorks, remain uncapped. Automatic Stripe
quantity changes when adding sites are deferred.

## Consequences

- Billing tables are tenant-owned and mutated through service-role SECURITY
  DEFINER RPCs.
- Duplicate webhook delivery is harmless.
- Out-of-order events cannot regress a newer snapshot.
- Foreign Stripe customer or subscription IDs cannot bind to another
  organisation.
