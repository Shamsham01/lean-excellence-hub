# Hosted QA / Staging Clean Rebuild Runbook

Maintainer runbook for rebuilding the hosted Lean Excellence Hub QA/staging
environment from repository migrations only.

**This document is planning and verification guidance only.** Automated agents
must not execute destructive hosted steps. A human maintainer performs the
hosted rebuild.

## Target end state

| Requirement | Expected state |
| --- | --- |
| Apex Manufacturing demo tenant | **Absent** on hosted QA |
| Historic demo workflow records | **Absent** |
| Historic QA evidence / storage files | **Absent** |
| Database schema | Reconstructed **only** from `supabase/migrations/**` |
| Structured QA tenant | **CookieWorks Manufacturing** only (`cookieworks-manufacturing`) |
| QA personas | **7** deterministic CookieWorks users |
| Module / business records | **Zero** (foundation-only) |
| Manual smoke testing | Ready to begin **MAT-01** in `docs/qa/SMOKE_TEST_PLAYBOOK.md` |

## What we are not doing in this phase

- No maintainer-only append-only purge RPC migration.
- No application routes, Edge Functions, or public APIs for reset.
- No `npm run db:seed-demo` on hosted QA (Apex must not be recreated).
- No weakening of RLS or tenant isolation safeguards.

## 1. Prove local reproducibility first

Before touching hosted infrastructure, prove the repository recreates the full
schema from zero on a clean local Supabase instance:

```bash
npm run db:start
npm run qa:verify:clean-rebuild
```

The verifier runs, in order:

1. `npm run db:reset`
2. `npm run test:db` (pgTAP)
3. `npm run db:types` drift check against committed `database.types.ts`
4. `npm run typecheck`
5. `LEANHUB_ALLOW_DEMO_SEED=1 npm run db:seed-demo` (proves demo seed still works **locally only**)
6. `LEANHUB_ALLOW_QA_TENANT=1 npm run qa:cookie:seed`
7. Foundation-only inventory + `FOUNDATION-ONLY VERIFIED`
8. `npm run test`
9. `npm run test:e2e:smoke`
10. `npm run build`

Optional flags:

- `--skip-reset` — reuse the current local database (faster re-check)
- `--skip-e2e` — skip Playwright smoke
- `--skip-build` — skip Next.js production build

Success marker:

```text
LOCAL CLEAN REBUILD VERIFIED — schema reproducible from migrations.
```

If local verification fails, **do not proceed to hosted rebuild**. Fix migration
drift or harness regressions in the repository first.

## 2. Hosted rebuild procedure (maintainer only)

### Preconditions

- Local `npm run qa:verify:clean-rebuild` passes on the release commit.
- Maintainer has Supabase dashboard access to the **disposable QA/staging** project.
- Repository is checked out at the target release commit.
- Credentials are supplied at runtime only (never committed).
- Maintainer knows the **exact expected QA project ref** (record it in your team
  runbook; do not guess).

### Step A — Pre-flight: confirm linked target

**Immediately before any destructive command**, verify the Supabase CLI is
linked to the correct disposable QA/staging project.

```bash
npx supabase projects list
```

And/or inspect the linked project:

```bash
npx supabase link --project-ref <expected-qa-project-ref>   # if not already linked
cat .supabase/linked-project                                 # linked project ref
```

The maintainer must **visually confirm** the project ref shown by the CLI
matches the **exact expected QA project ref** for this environment.

| Check | Action |
| --- | --- |
| Project ref matches expected QA/staging ref | Proceed |
| Project ref does **not** match | **STOP** — do not run destructive commands |
| Target might be production | **STOP** — never run this runbook against production |

If the project ref does not exactly match, **STOP**.

### Step B — Full database wipe and migration replay

The canonical full QA/staging reset command is:

```bash
npx supabase db reset --linked
```

**Critical constraints:**

| Rule | Reason |
| --- | --- |
| `db reset --linked` is **destructive** | Drops and recreates the linked database, then replays migrations |
| Allowed **only** for this disposable QA/staging project | Production data loss risk |
| **Never** use against production | Irreversible data destruction |
| **DO NOT** use `--include-seed` | Hosted QA must not run `supabase/seed.sql` or bundled seeds |
| **Do not** run `npm run db:seed-demo` on hosted QA | Apex Manufacturing must not exist on hosted QA |

`db reset --linked` drops the remote database, recreates it, and applies all
migrations from `supabase/migrations/`. This is the correct full wipe — do **not**
treat `npx supabase db push` alone as a database wipe.

### Step C — Seed CookieWorks foundation only (hosted)

After reset, seed **only** the CookieWorks QA tenant using the **hosted**
foundation seed command:

```bash
LEANHUB_QA_RESET_SUPABASE_URL="https://<expected-qa-project-ref>.supabase.co" \
LEANHUB_QA_RESET_SERVICE_ROLE_KEY="<service-role-key>" \
LEANHUB_QA_RESET_DATABASE_URL="postgresql://..." \
LEANHUB_QA_RESET_PROJECT_REF="<expected-qa-project-ref>" \
LEANHUB_QA_RESET_PUBLISHABLE_KEY="<publishable-key>" \
npm run qa:cookie:hosted-seed
```

| Command | Scope |
| --- | --- |
| `npm run qa:cookie:seed` | **Local only** — blocked for `*.supabase.co` |
| `npm run qa:cookie:hosted-seed` | **Hosted only** — requires explicit QA project ref guards |

Hosted seed creates organisation hierarchy, RBAC, and seven QA personas only.
No module/business data. The command is non-destructive and idempotent.

**Do not run** `npm run db:seed-demo`, `npm run qa:cookie:seed`, or
`LEANHUB_ALLOW_DEMO_SEED=1` against hosted QA.

### Step D — Post-reset verification

After `npx supabase db reset --linked` and CookieWorks foundation seed, the
maintainer must complete **all** checks below before declaring the environment
ready.

#### D.1 — Verify migration state

Confirm all repository migrations applied to the linked project:

```bash
npx supabase migration list --linked
```

Expect every migration in `supabase/migrations/` to show as applied on remote.
Investigate any missing or failed migration before continuing.

#### D.2 — Verify Apex is absent

Confirm no Apex Manufacturing demo tenant exists:

```bash
# Example: query via linked DB URL (maintainer supplies credentials)
npx supabase db query --linked \
  "select code, name from public.organisations where code = 'apex-manufacturing';"
```

Expect **zero rows**. Any `apex-manufacturing` organisation means the hosted
rebuild failed or demo seed ran — **STOP** and investigate.

#### D.3 — Run hosted inventory and foundation verification

```bash
LEANHUB_QA_RESET_SUPABASE_URL="https://<expected-qa-project-ref>.supabase.co" \
LEANHUB_QA_RESET_SERVICE_ROLE_KEY="<service-role-key>" \
LEANHUB_QA_RESET_DATABASE_URL="postgresql://..." \
LEANHUB_QA_RESET_PROJECT_REF="<expected-qa-project-ref>" \
LEANHUB_QA_RESET_PUBLISHABLE_KEY="<publishable-key>" \
npm run qa:cookie:hosted-reset
```

This runs in **dry-run** mode by default (no data modification). Confirm:

| Check | Expected |
| --- | --- |
| CookieWorks organisation exists | `cookieworks-manufacturing` / CookieWorks Manufacturing |
| QA personas | **7** |
| All module counts | **0** |
| Verification marker | `FOUNDATION-ONLY VERIFIED` |
| `organisation-evidence` storage objects | **0** (no historic QA evidence files) |

#### D.4 — Verify login through hosted application

Sign in to the **hosted** application deployment (not local):

1. Open the hosted QA/staging app URL.
2. Sign in as `admin@cookieworks.local` (password in `docs/development/qa-tenant.md`).
3. Confirm redirect to the platform shell with CookieWorks context (see **ORG-01**
   in `docs/qa/SMOKE_TEST_PLAYBOOK.md`).

If login fails or the wrong organisation appears, **STOP** before MAT-01.

### Step E — Begin manual smoke testing

Open `docs/qa/SMOKE_TEST_PLAYBOOK.md` and start with **ORG-01** through
**ORG-05**, then **MAT-01** (Maturity empty state).

Persona credentials: `docs/development/qa-tenant.md`.

## 3. CookieWorks-only reset (post-rebuild maintenance)

After the initial clean rebuild, operators may return CookieWorks to Day Zero
without wiping the whole database:

```bash
# Local
npm run qa:cookie:reset

# Hosted (destructive; explicit confirmation required)
LEANHUB_QA_RESET_CONFIRM=DELETE_COOKIEWORKS_ONLY \
...credentials... \
npm run qa:cookie:hosted-reset -- --destructive
```

See `docs/development/qa-tenant-deletion-graph.md` for purge limits (append-only
workflow history, published template immutability).

This scoped reset does **not** remove Apex or other tenants. Use
`npx supabase db reset --linked` when a full hosted wipe is required.

## 4. Maintainer checklist

- [ ] Local `npm run qa:verify:clean-rebuild` passes on target commit
- [ ] Pre-flight: `npx supabase projects list` / linked ref matches **exact** expected QA project ref
- [ ] If project ref does not match → **STOPPED** (did not proceed)
- [ ] `npx supabase db reset --linked` executed (**without** `--include-seed`)
- [ ] Apex demo seed **not** run on hosted (`db:seed-demo` / `LEANHUB_ALLOW_DEMO_SEED=1`)
- [ ] Migration state verified (`npx supabase migration list --linked`)
- [ ] CookieWorks foundation seeded (`qa:cookie:hosted-seed`, not `qa:cookie:seed`)
- [ ] Apex organisation absent (`apex-manufacturing` not found)
- [ ] CookieWorks organisation present (`cookieworks-manufacturing`)
- [ ] 7 QA personas confirmed
- [ ] All module counts = 0
- [ ] `FOUNDATION-ONLY VERIFIED` confirmed
- [ ] `organisation-evidence` contains no historic QA objects
- [ ] Hosted application login verified (ORG-01)
- [ ] Manual smoke testing ready at MAT-01

## Related documentation

- `docs/development/qa-tenant.md` — CookieWorks harness commands and personas
- `docs/development/qa-tenant-deletion-graph.md` — deletion graph and purge limits
- `docs/qa/SMOKE_TEST_PLAYBOOK.md` — manual acceptance tracker
