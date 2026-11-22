# CI workflows

Source of truth: `docs/development/ci-strategy.md` and `.github/workflows/`.

## Tier 1 — Fast CI (**Implemented**)

- Workflow: `.github/workflows/ci-fast.yml`
- Trigger: every PR update (including **draft**)
- Steps: `npm ci`, format, lint, typecheck, unit tests, build
- Check name: `Fast CI / Quality`

## Tier 2 — Database CI (**Implemented**)

- Workflow: `.github/workflows/ci-database.yml`
- Path-filtered: `supabase/**`, QA scripts, integration tests, `database.types.ts`, etc.
- **Pure docs PRs** typically skip this tier.
- Jobs: database core (`db:lint`, `test:db`, types drift); optional QA hosted replacement / harness / Windows.

## Tier 3 — Full Regression (**Implemented**)

- Workflow: `.github/workflows/ci-full.yml`
- **Draft PRs:** expensive jobs skipped
- **Ready PR / `main` / manual:** Full Regression (parallel E2E shards, full pgTAP, demo seed on merge boundary)
- Quality gate on PRs may reuse successful Fast CI on same SHA.

## Local parity commands

```bash
npm run db:start:ci
npm run db:lint
npm run test:db
npm test
npm run build
```

E2E (representative):

```bash
eval "$(npx supabase status -o env)"
export CI=1 E2E_WITH_SUPABASE=1
npx playwright test …
```

See QA runbooks under `docs/qa/` for hosted smoke (human gates).
