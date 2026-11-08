# Migration version ledger (Nov 2026 parallel PRs)

Coordination only — not applied on `main` until branches merge.

## `cursor/billing-entitlement-readiness-13ce` (PR #374)

| Version | File |
| --- | --- |
| `20261108210500` | `billing_02_plan_capabilities.sql` (renamed from `08210000` — #375 owns `08210000`) |
| `20261108220500` | `billing_03_module_entitlements.sql` (renamed from `08220000` — #375 owns `08220000`) |
| `20261108230000` | `billing_05_leanai_credit_ledger.sql` |
| `20261108231000` | `billing_04_module_gates_and_wrapper_fix.sql` |
| `20261108233000` | `billing_07_leanai_credit_lifecycle.sql` |
| `20261108234000` | `billing_08_leanai_credit_table_grants.sql` |
| `20261109000000` | `billing_comprehensive_module_mutation_gates.sql` |
| `20261109120000` | `billing_audit_remediation.sql` |
| `20261109140000` | `billing_08_cost_credit_accounting.sql` |
| `20261109150000` | `billing_09_private_write_grant_hardening.sql` |
| `20261109160000` | `billing_10_cost_credit_unit_fixes.sql` |

## `cursor/suggestion-approval-routing-delegation-5afc` (PR #375)

| Version | File |
| --- | --- |
| `20261108190000` | `suggestion_approval_routing_delegation.sql` |
| `20261108190100` | `suggestion_awaiting_review_delivery_context.sql` |
| `20261108200000` | `suggestion_approval_routing_security_hardening.sql` |
| `20261108210000` | `suggestion_submitted_email_suppression.sql` |
| `20261108220000` | `suggestion_approval_complete_privilege_and_delegation_authority.sql` |

## `cursor/organisation-invitation-email-delivery-96ca` (PR #376)

| Version | File |
| --- | --- |
| `20261108180000` | `organisation_invitation_email_delivery.sql` |
| `20261108235000` | `invitation_inbox_proof_redeem.sql` |
| `20261108236000` | `invitation_inbox_security_hardening.sql` (may move to `20261109010000` on #376) |

## Merge-order sketch (shared `20261108*` spine)

`181700` (founding) → `181800` (#376) → `181900`–`182100` (#375) → `182105` (#374 billing_02) → `182200` (#375) → `182205`+ (#374 billing) → `182350`+ (#376) → `20261109*` (#374 only).
