# Deploy & release procedure

## Roles

| Action | Owner |
| --- | --- |
| Merge to `main` | Human reviewer (agents prepare PRs only) |
| Netlify production deploy | Platform owner |
| Hosted Supabase migration apply | Platform owner (after migration review + disposable proof) |
| Human smoke | VERIFY runbooks + owner sign-off |

## Pre-deploy checks (**Required**)

1. **Git SHA** — record exact commit Netlify publishes (public HTML may not embed SHA; use Netlify UI/build logs).
2. **Migration head** — hosted `supabase_migrations` must match code on that SHA ([release snapshot](../qa/PROJECT-CURRENT-STATE.md)).
3. **CI** — Fast + Database (if applicable) + Full Regression green on PR head before release.
4. **Auth hook** — Send Email Hook deployed from **same revision** as app (`docs/deployment/auth-email-templates.md`, cutover checklists).

## Environment (**Implemented** pattern)

- Publishable: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Server-only: `SUPABASE_SECRET_KEY`, AI keys, Stripe, peppers — see `.env.example`
- Lean AI: `AI_ENABLED`, `AI_PROVIDER`, `AI_RUN_TIMEOUT_MS`, model class vars

## Release smoke (**Implemented** runbooks)

- Fresh org journey: `docs/qa/QA-NEW-ORG-001-runbook.md`
- CookieWorks isolation: `docs/qa/RELEASE-SMOKE-01-protocol.md`
- First customer cutover: `docs/qa/FIRST-CUSTOMER-CUTOVER-CHECKLIST.md`

## Deploy previews (**Open question**)

- Confirm whether preview builds use production Supabase URL/keys. Until documented otherwise, assume previews could write production and **block unreviewed preview testing** (R0).

## Migration versions

Record the version from each repository filename in the hosted ledger. Compare the release SHA with the ledger before cutover. The [November version ledger](../operations/migration-version-ledger-nov-2026.md) records the parallel-branch renumbering history.
