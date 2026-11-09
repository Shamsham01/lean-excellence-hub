# Migration version ledger (Nov 2026 parallel PRs)

Coordination only — not applied on `main` until branches merge.

## `cursor/billing-entitlement-readiness-13ce` (PR #374)

| Version | File |
| --- | --- |
| `20261109022000` | `billing_02_plan_capabilities.sql` (after #375 `09021100`; was `08210500`) |
| `20261109022500` | `billing_03_module_entitlements.sql` (was `08220500`) |
| `20261109023000` | `billing_05_leanai_credit_ledger.sql` (was `08230000`) |
| `20261109023500` | `billing_04_module_gates_and_wrapper_fix.sql` (was `08231000`) |
| `20261109024000` | `billing_07_leanai_credit_lifecycle.sql` (was `08233000`) |
| `20261109024500` | `billing_08_leanai_credit_table_grants.sql` (was `08234000`) |
| `20261109030000` | `billing_comprehensive_module_mutation_gates.sql` (after #376 `09014000` + #375 suggestion `09020000`–`09021100` + billing `09022000`–`09024500`) |
| `20261109031000` | `billing_audit_remediation.sql` |
| `20261109032000` | `billing_08_cost_credit_accounting.sql` |
| `20261109033000` | `billing_09_private_write_grant_hardening.sql` |
| `20261109034000` | `billing_10_cost_credit_unit_fixes.sql` |
| `20261109035000` | `billing_11_credit_worker_reconcile.sql` |
| `20261109036000` | `billing_12_settle_rate_snapshot.sql` |

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

`181700` (founding) → `181800` (#376) → `181900`–`182100` (#375) → `182200` (#375) → `182350`+ (#376) → `090100`–`090211` (#375/#376 on main) → `090220`–`090245` (#374 billing spine) → `090300`+ (#374 billing gates/accounting).
