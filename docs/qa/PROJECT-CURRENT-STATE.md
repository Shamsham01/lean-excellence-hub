# Lean Excellence Hub — current project and release state

## Repository baseline

At `efcfc9522b028c342f20f7f1d2c359d23cbc4d7d`, main includes PR #424. [Full Regression passed on this commit](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/45033541855). The repository contains 325 SQL migrations through `20261122112740_ci_projects_function_acl_hardening.sql`.

Go-live and customer onboarding start in January 2027 under the [master plan](../roadmap/MASTER_PLAN.md).

## Delivered on main

| Area | Behaviour | Merged PRs |
| --- | --- | --- |
| Problem Solving | Practitioners can edit a 6M fishbone, promote a cause to a hypothesis, record a test and verify or reject the cause. Closed cases block stage drafts. Sustain plans, close controls and read-only future stages follow the case lifecycle. | [#402](https://github.com/Shamsham01/lean-excellence-hub/pull/402), [#403](https://github.com/Shamsham01/lean-excellence-hub/pull/403), [#404](https://github.com/Shamsham01/lean-excellence-hub/pull/404), [#407](https://github.com/Shamsham01/lean-excellence-hub/pull/407), [#409](https://github.com/Shamsham01/lean-excellence-hub/pull/409), [#418](https://github.com/Shamsham01/lean-excellence-hub/pull/418) |
| LeanAI | The multiline composer preserves drafts. Responses render safe Markdown, including in narrow chat bubbles. | [#417](https://github.com/Shamsham01/lean-excellence-hub/pull/417) |
| Actions and projects | Planner actions support labels, checklists, comments and attachments. The searchable project picker includes Draft and On hold projects for action links. Existing Completed and Cancelled links are read-only. | [#394](https://github.com/Shamsham01/lean-excellence-hub/pull/394), [#395](https://github.com/Shamsham01/lean-excellence-hub/pull/395), [#405](https://github.com/Shamsham01/lean-excellence-hub/pull/405), [#419](https://github.com/Shamsham01/lean-excellence-hub/pull/419) |
| 5S, Gemba and scheduling | 5S Quick Start uses score-only questions. Standards and Gemba definitions support site applicability. Users can raise actions from audit questions and Gemba observations. Starting a schedule without an activity opens a picker for applicable published activities. | [#389](https://github.com/Shamsham01/lean-excellence-hub/pull/389), [#390](https://github.com/Shamsham01/lean-excellence-hub/pull/390), [#399](https://github.com/Shamsham01/lean-excellence-hub/pull/399), [#400](https://github.com/Shamsham01/lean-excellence-hub/pull/400), [#405](https://github.com/Shamsham01/lean-excellence-hub/pull/405), [#401](https://github.com/Shamsham01/lean-excellence-hub/pull/401) |
| Notifications | One bell opens authorised deep links. The in-app chase scheduler has plan gates, a daily cap and an enablement watermark. It stays switched off until the founder approves it. | [#383](https://github.com/Shamsham01/lean-excellence-hub/pull/383), [#378](https://github.com/Shamsham01/lean-excellence-hub/pull/378), [#380](https://github.com/Shamsham01/lean-excellence-hub/pull/380) |
| Invitations | Branded invitations support single-step activation. Transactional emails share a logo header, and stale sessions redirect to login. | [#376](https://github.com/Shamsham01/lean-excellence-hub/pull/376), [#379](https://github.com/Shamsham01/lean-excellence-hub/pull/379) |
| Marketing | The demo-led landing page was followed by the Golden Thread redesign across the homepage and related public pages. | [#410](https://github.com/Shamsham01/lean-excellence-hub/pull/410), [#415](https://github.com/Shamsham01/lean-excellence-hub/pull/415) |
| Project security | Project writes use owner-controlled RPCs. The database guards protected columns, removes direct authenticated updates and restricts helper execution. | [#421](https://github.com/Shamsham01/lean-excellence-hub/pull/421), [#423](https://github.com/Shamsham01/lean-excellence-hub/pull/423), [#424](https://github.com/Shamsham01/lean-excellence-hub/pull/424) |

Invitation preview and signup binding intentionally accept anonymous callers with the invitation token. See the [invitation and RLS notes](../knowledge/supabase-security-rls.md).

## Release checks

- **To confirm:** published application SHA, hosted migration parity and preview database isolation for the release candidate. Match hosted versions to the filenames at the published SHA. See the [migration version ledger](../operations/migration-version-ledger-nov-2026.md).
- **To confirm:** founder sign-off on the release candidate after [fresh-organisation smoke](./QA-NEW-ORG-001-runbook.md) and the [first-customer cutover checklist](./FIRST-CUSTOMER-CUTOVER-CHECKLIST.md). CI includes the [go-live journey](../../tests/e2e/customer-go-live-journey.spec.ts).
- The [October preflight report](./QA-NEW-ORG-001-PREFLIGHT-REPORT.md) records the earlier rehearsal. The [CookieWorks isolation protocol](./RELEASE-SMOKE-01-protocol.md) and [Stripe Sandbox rehearsal](./STRIPE-SANDBOX-ONBOARDING-SMOKE.md) remain available for cutover.
