# Supabase migration filename drift repair (2026-11-05)

**Hosted project:** `zsadfvjtknbbfomlmttv` (`eu-west-1`)

## What happened

On 2026-11-05, three migrations were applied on the hosted project while agent
work used Supabase MCP `apply_migration`. That tool records migrations under
**server-generated version timestamps**, not the canonical filenames later
committed on `main`. Hosted `supabase_migrations.schema_migrations` therefore
listed the same migration **names** as the repository, but with different
**version** ids than the files under `supabase/migrations/`.

This did not change SQL semantics on hosted: the bodies already matched the
repo files. The mismatch only blocked safe `supabase db push` / CLI applies
(false “pending” local files or duplicate-apply risk).

## Repair (repository only)

PRs that rename files only — **no** hosted `apply_migration`, **no**
`schema_migrations` repair migration, **no** production data changes.

| Migration name | Old repo filename version | Canonical version (hosted + repo) |
| --- | --- | --- |
| `ai_run_provider_dispatch_and_case_stale_recovery` | `20261105121500` | `20261105065358` |
| `ai_run_recovery_security_hardening` | `20261105143000` | `20261105065404` |
| `problem_solving_activate_pinned_draft` | `20261105180000` | `20261105113335` |

## Verification before rename

- File contents on `main` were unchanged since merge commits `#329` and `#331`.
- Read-only hosted checks confirmed applied objects (for example
  `public.ai_runs.provider_dispatched_at`, hardened
  `private.recover_stale_ai_runs_for_problem_solving_case`, pinned-draft
  `private.activate_problem_solving_case`).

## Operator guidance

- Prefer **`supabase db push --linked`** (or documented CLI flow in
  `docs/qa/COACH-04-HOSTED-MIGRATION-RUNBOOK.md`) so local filenames define
  migration versions.
- Do **not** use MCP `apply_migration` for canonical repo migrations; it
  auto-assigns timestamps and can recreate filename drift (see also #193).
- Netlify production deploy remains **owner-only**; aligning filenames does
  not require a deploy.
