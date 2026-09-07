# CI strategy

Lean Excellence Hub uses a **tiered CI architecture** so development gets fast feedback while merge boundaries retain exhaustive safety coverage.

> **Policy:** Targeted testing during development; exhaustive testing at the merge boundary.

## Development practice

- Keep Cursor-created pull requests in **Draft** while actively iterating.
- Mark a PR **Ready for review** only after local or targeted checks are green.
- Draft PRs run **Fast CI** and path-filtered **Database CI** only; expensive Full Regression waits until the PR is ready (or you trigger it manually).

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

**Target duration:** ideally under 5 minutes.

**Timing:** step durations are written to the job summary.

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

- `Database CI / Targeted` — compact database core
- `Database CI / QA hosted replacement` (path-filtered)
- `Database CI / QA harness integration` (path-filtered)
- `Database CI / Windows QA harness` (path-filtered)

**Database core runs:**

- `npm ci`
- bounded local Supabase startup (CI-minimal service set)
- `npm run db:lint`
- `npm run test:db`
- `npm run db:types` + committed type drift check

**QA recovery jobs** run in **separate jobs with independent Supabase stacks** only when relevant paths change. They are not bundled into the bounded database-core job.

**Does not run:** full Playwright suite, demo seed (merge-boundary only).

**Job timeouts:** database core 15 minutes; QA recovery jobs 25 minutes with 18-minute step guards.

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
- `Full Regression / Database` (aggregation gate)
- `Full Regression / Windows QA harness`

**Supporting jobs (not branch-protection targets):**

- `Full Regression / Database core`
- `Full Regression / QA hosted replacement` (path-filtered on PRs; always on `main` / manual dispatch)
- `Full Regression / E2E platform`
- `Full Regression / E2E workforce`
- `Full Regression / E2E improvement`
- `Full Regression / E2E ai-closure`

**Quality gate behaviour:**

- **Pull requests:** `Full Regression / Quality` waits for a successful `Fast CI / Quality` on the same commit instead of rerunning format/lint/typecheck/unit/build.
- **`main` / manual dispatch:** runs the full quality suite directly.

**Database / E2E behaviour:**

- `Full Regression / Database core` runs `db:lint`, complete pgTAP, and generated type drift checks.
- QA hosted replacement runs in a dedicated job when QA paths change (or on `main` / manual dispatch).
- Supabase-backed Playwright coverage is split into **four parallel shards**. Each shard starts its **own** local Supabase stack, seeds demo data, and runs a bounded spec list with `--workers=1` inside the shard.
- `Full Regression / Database` is a lightweight gate that succeeds only when database core, required QA recovery (if triggered), and all E2E shards succeed.

**Target wall-clock:** ideally under 15 minutes for ready PRs through parallelism (versus the former ~40–90 minute serial database path).

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

1. Each attempt is wrapped in `timeout` (default **8–10 minutes** per attempt).
2. Up to **2** attempts with `npm run db:stop` cleanup between attempts.
3. On failure: prints `supabase status`, matching Docker containers, and recent container logs.
4. `npm run db:stop` always runs at job end (`if: always()`).

### CI-minimal local Supabase services

CI starts Supabase with these services excluded after local validation:

- `studio`
- `realtime`
- `logflare`
- `vector`
- `imgproxy`

**Still required and kept enabled:** Postgres, Kong, GoTrue, PostgREST, Storage API, Mailpit (invitation lifecycle E2E), Edge Runtime (workforce provisioning/import E2E), and other API dependencies.

Local proof on the minimal stack:

- `npm run db:lint` — pass
- `npm run test:db` — 95 pgTAP files / 1460 tests pass

Script entry point: `npm run db:start:ci`.

## Playwright browser caching

`Full Regression / E2E smoke` and each Supabase-backed E2E shard use `.github/actions/playwright-chromium`:

1. Cache `~/.cache/ms-playwright` keyed by `package-lock.json`.
2. Always install Linux system dependencies via `playwright install-deps chromium`.
3. Install browser binaries via `playwright install chromium` (cache hit avoids re-download).

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

**Do not** require `Database CI / Targeted`, `Database CI / QA hosted replacement`, `Database CI / QA harness integration`, `Database CI / Windows QA harness`, `Full Regression / Database core`, shard jobs, or `Full Regression / QA hosted replacement` as universal required checks. They are path-filtered or supporting jobs; requiring them would leave unrelated PRs permanently blocked.

`main` is currently **not** branch-protected in GitHub; apply the above when protection is enabled.

## Hosted safety

All tiers use **local Supabase only**. Workflows do not use hosted Supabase credentials and do not mutate hosted database, Auth, or Storage.

## Retired workflow

The monolithic `.github/workflows/ci.yml` is removed once tiered workflows are active. Do not run four parallel CI systems.
