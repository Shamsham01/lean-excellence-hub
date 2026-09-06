# CI strategy

Lean Excellence Hub uses a **tiered CI architecture** so development gets fast feedback while merge boundaries retain exhaustive safety coverage.

> **Policy:** Targeted testing during development; exhaustive testing at the merge boundary.

## Tiers

### Tier 1 — Fast CI (`ci-fast.yml`)

**When:** Every pull request update, including **Draft** PRs (`opened`, `synchronize`, `reopened`, `ready_for_review`).

**Check name:** `Fast CI / Quality`

**Runs:**

- `npm ci`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

**Does not run:** local Supabase, `db:lint`, `test:db`, Playwright, QA tenant integration.

**Target duration:** ~3–8 minutes.

### Tier 2 — Targeted Database CI (`ci-database.yml`)

**When:** Pull request updates that touch database / Supabase / QA / integration paths only:

- `supabase/**`
- `scripts/qa-tenant/**`
- `tests/integration/**`
- `src/platform/supabase/**`
- `package.json`, `package-lock.json`
- workflow/action files for this tier

Pure docs, CSS, or UI-only changes **do not** start this workflow.

**Check names:**

- `Database CI / Targeted`
- `Database CI / Windows QA harness` (path-filtered; see below)

**Runs:**

- `npm ci`
- bounded local Supabase startup
- `npm run db:lint`
- `npm run test:db`
- `npm run db:types` + committed type drift check
- targeted integration tests for the changed area:
  - `tests/integration/qa-tenant-hosted-replacement.test.ts` when `scripts/qa-tenant/**` or that spec changes
  - `tests/integration/qa-tenant-harness.test.ts` when `scripts/qa-tenant/**` or that spec changes

**Does not run:** full Playwright suite, demo seed (merge-boundary only).

**Windows QA harness (development-time):** runs only when relevant files change (`scripts/qa-tenant/**`, `tests/unit/qa-tenant-**`, npm execution infrastructure).

**Job timeout:** 40 minutes (database job). Supabase startup is bounded separately (see below).

### Tier 3 — Full Regression (`ci-full.yml`)

**When:**

| Event | Expensive jobs |
| --- | --- |
| Draft PR | **Skipped** (Fast + targeted DB only) |
| Ready (non-draft) PR | **Run** on current PR head |
| Push to `main` | **Run** |
| `workflow_dispatch` | **Run** manually |

**Check names:**

- `Full Regression / Quality`
- `Full Regression / E2E smoke`
- `Full Regression / Database`
- `Full Regression / Windows QA harness`

**Runs:** complete coverage of the former monolithic CI:

- quality gate (format, lint, typecheck, unit tests, build)
- Playwright smoke
- local Supabase baseline (`db:lint`, `test:db`, `db:types`, type drift, demo seed)
- QA tenant hosted replacement integration (local Supabase; must execute, not skip)
- full Supabase-backed Playwright journey suite
- Windows QA harness portability

**Upper timeout:** ~90 minutes on the database job; failures should surface earlier when possible.

## Concurrency and cancellation

Every PR workflow uses a ref-specific concurrency group:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

**Behaviour:**

- Cursor (or any contributor) pushes commit **A** → CI run **A** starts.
- Before **A** finishes, push commit **B** → run **A** is **cancelled**; run **B** is authoritative.

Full Regression on `main` uses a per-SHA group and does **not** cancel in-progress main validation unnecessarily.

## Bounded local Supabase startup

Database CI and Full Regression use `.github/actions/supabase-local-start`:

1. Each attempt is wrapped in `timeout` (default **10 minutes**).
2. Up to **2** attempts with `npm run db:stop` cleanup between attempts.
3. On failure: prints `supabase status`, matching Docker containers, and recent container logs.
4. `npm run db:stop` always runs at job end (`if: always()`).

A hung `supabase start` must **fail within ~20 minutes** (two 10-minute attempts), not sit for 40–75 minutes.

## Manual Full Regression

1. Open **Actions → Full Regression**.
2. Choose **Run workflow**.
3. Select branch (for example `main` or a ready PR branch) and confirm.

Use this to validate Full Regression on a Draft PR without marking the PR ready.

## Required checks and branch protection

Historical monolithic check names:

| Old check | New authoritative check |
| --- | --- |
| `Quality and production build` | `Full Regression / Quality` (merge gate) + `Fast CI / Quality` (development) |
| `Local Supabase database baseline` | `Full Regression / Database` (merge gate) + `Database CI / Targeted` (development) |
| `Playwright smoke test` | `Full Regression / E2E smoke` |
| `QA harness portability (Windows)` | `Full Regression / Windows QA harness` + `Database CI / Windows QA harness` (when relevant) |

### Recommended branch protection (when enabled)

Require these checks on `main` merges:

- `Fast CI / Quality`
- `Full Regression / Quality`
- `Full Regression / E2E smoke`
- `Full Regression / Database`
- `Full Regression / Windows QA harness`

**Do not** require `Database CI / Targeted` or `Database CI / Windows QA harness` as universal required checks. They are path-filtered; UI-only PRs would otherwise remain permanently "Expected" and block merge.

`main` is currently **not** branch-protected in GitHub; apply the above when protection is enabled.

## Hosted safety

All tiers use **local Supabase only**. Workflows do not use hosted Supabase credentials and do not mutate hosted database, Auth, or Storage.

## Retired workflow

The monolithic `.github/workflows/ci.yml` is removed once tiered workflows are active. Do not run four parallel CI systems.
