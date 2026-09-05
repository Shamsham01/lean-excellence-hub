# MAT0a — Maturity Integration Closure

Closure record for reconciling PR #51 (`cursor/mat0-maturity-smoke-readiness-7c9e`) against
current `main` after QA2a (PR #50).

## Reconciliation outcome

Genuine MAT0 production, database, and regression assets were already integrated on `main` via
PR #38 (`08aa9d2`). QA2a (PR #50) superseded PR #51's older QA/auth/E2E harness copies.

MAT0a adds only deterministic CookieWorks harness/E2E teardown so `npm test` does not depend on
manual `qa:cookie:reset` after MAT0 Playwright runs.

## Retained on main (from PR #38)

| Area | Files / assets |
| --- | --- |
| Answer persistence | `src/components/maturity/assessment-workspace.tsx` |
| Question position default | `src/components/maturity/framework-editor.tsx` |
| RLS SELECT policy | `supabase/migrations/20260903150000_mat0_template_answers_select_policy.sql` |
| pgTAP regression | `supabase/tests/database/templates_security.test.sql` |
| MAT0 Playwright | `tests/e2e/cookieworks-maturity-smoke.spec.ts` |
| Helpers / fixtures | `tests/e2e/helpers/cookieworks-*.ts`, `tests/fixtures/maturity-evidence/*` |
| CookieWorks maturity permissions | `scripts/qa-tenant/constants.ts`, `sync-role-permissions.ts` |
| Maturity purge (QA2a architecture) | `scripts/qa-tenant/tenant-purge-sql.ts`, `delete-tenant.ts` |

## Dropped from PR #51 (superseded or unrelated)

- STAB-AUTH login/session route-handler rewrites
- Invitation route-handler utilities
- Benefit navigation stability fixes
- Broad demo-auth rewrites
- Old QA1 harness / hosted reset copies
- Old Windows QA portability code
- Unrelated module E2E rewrites
- Wholesale `delete-tenant.ts` MAT0 version (replaced by QA2a `tenant-purge-sql.ts`)

## Known product gap (not in scope)

**MAT0-13** — request correction / return to submitter / reopen formal Maturity assessment.
Document for later product work; do not implement in MAT0a.

## Hosted safety

- HOSTED SUPABASE NOT ACCESSED
- NO HOSTED DATA MODIFIED
- NO DEPLOYMENT
