# Billing / plan copy audit (Essentials vs Professional)

**Date:** 2026-11-09 (agent pass). Source of truth for product: `docs/product/pricing-subscription-onboarding-v1.md`.

## Aligned (no change required this pass)

| Claim | Where |
| --- | --- |
| Unlimited employees/users **per site**, not seat-priced | `pricing-subscription-onboarding-v1.md`, `billing-entitlements-admin.md`, `commercial-principles.ts`, onboarding/founding copy |
| Essentials = Maturity, 5S, Gemba, Actions, Suggestions + utilities | `module-entitlements.ts`, ADR-0018 |
| People invitations on all plans; paid HR for workforce import/create | `people-product-surfaces.ts`, admin doc |
| Job functions / structure on all plans | Admin doc, tests |
| `credit_policy_enforced` off by default; no fabricated rates | AI settings panel, `leanai-credit-policy.ts`, admin checklist |

## Marketing UI spot-check

- `src/components/marketing/**` — no conflicting “per user”, seat cap, or “unlimited AI credits” strings found in grep (2026-11-09).
- Interactive demos (`marketing/interactive/*`) illustrate modules generically; they do not state Essentials module matrix — acceptable for awareness, not checkout truth.

## Gaps / follow-up (not blockers for this PR)

- Public pricing page may lag `PLAN_CATALOGUE` tier labels — reconcile before self-service GA.
- Sales one-pagers outside repo not audited.

## Operator stance

Do **not** market hard LeanAI credit enforcement until `credit_policy_enforced` and verified rate card are operator-enabled. Token ceiling in org settings remains the customer-facing control.
