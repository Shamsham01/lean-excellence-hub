# CookieWorks QA tenant harness

The CookieWorks QA tenant is a **separate** local and hosted smoke-test fixture from the Apex
Manufacturing demo seed (`scripts/demo-seed/**`). It provides a foundation-only tenant for
manual acceptance testing through the real LEH UI.

## Safety model

| Command | Scope | Destructive |
| --- | --- | --- |
| `npm run qa:cookie:seed` | Creates/updates CookieWorks foundation only | No |
| `npm run qa:cookie:inventory` | Read-only inventory for CookieWorks | No |
| `npm run qa:cookie:reset` | Deletes CookieWorks tenant data locally, then re-seeds foundation | Yes (CookieWorks only) |
| `npm run qa:cookie:hosted-reset` | Maintainer CLI for hosted inventory / reset | Dry-run by default |
| `npm run qa:cookie:hosted-seed` | Seeds CookieWorks foundation on hosted QA only | No (foundation reconcile only) |

Local commands use the same local-only guards as demo seed (local Supabase URL, no linked
project, not `NODE_ENV=production`). Hosted reset adds stronger maintainer safeguards.

`npm run db:seed-demo` and `scripts/demo-seed/**` are unchanged.

## Organisation

| Field | Value |
| --- | --- |
| Name | CookieWorks Manufacturing |
| Code | `cookieworks-manufacturing` |
| Primary site | Bodmin Cookie Factory |

### Hierarchy

```text
Bodmin Cookie Factory
├── Operations
│   ├── Mixing & Preparation
│   ├── Baking
│   ├── Decorating
│   └── Packing
├── Quality
├── Engineering
├── Warehouse
└── Continuous Improvement
```

## Personas (local development passwords only)

| Persona | Email | Password |
| --- | --- | --- |
| Organisation Admin | `admin@cookieworks.local` | `Admin@CookieWorks-QA-2026!` |
| CI / OpEx Manager | `ci-manager@cookieworks.local` | `CiManager@CookieWorks-QA-2026!` |
| Production Manager | `production-manager@cookieworks.local` | `ProductionMgr@CookieWorks-QA-2026!` |
| Team Leader | `team-leader@cookieworks.local` | `TeamLeader@CookieWorks-QA-2026!` |
| Operator | `operator@cookieworks.local` | `Operator@CookieWorks-QA-2026!` |
| QA / Maturity Assessor | `assessor@cookieworks.local` | `Assessor@CookieWorks-QA-2026!` |
| Finance Validator | `finance@cookieworks.local` | `Finance@CookieWorks-QA-2026!` |

Never use these credentials outside local development or the dedicated hosted QA tenant.

## Local workflow

```bash
npm run db:start
npm run db:reset
npm run db:seed-demo          # optional: keep Apex demo tenant for comparison
npm run qa:cookie:seed
npm run qa:cookie:inventory
```

Return to Day Zero for CookieWorks only:

```bash
npm run qa:cookie:reset
```

## Foundation-only contract

After seed or reset, CookieWorks contains organisation foundation data only. Module/business
records (maturity, 5S, Gemba, schedules, training, skills, suggestions, recognition, projects,
benefits, problem solving, AI, actions, templates) must be **zero**.

### Expected bootstrap exceptions

`provision_organisation` intentionally creates:

- Baseline application roles from the platform catalogue
- Builtin problem-solving method catalogue
- Organisation owner role/grant and provisioning security audit event
- Organisation document sequences when provisioned by platform flows

These are documented in inventory output under **Bootstrap exceptions**.

## Hosted maintainer reset (CLI only)

**Do not run from application runtime.** Supply credentials at execution time; never commit
service role keys or database passwords.

### 1. Dry-run inventory / deletion plan (default)

```bash
LEANHUB_QA_RESET_SUPABASE_URL="https://<project-ref>.supabase.co" \
LEANHUB_QA_RESET_SERVICE_ROLE_KEY="<service-role-key>" \
LEANHUB_QA_RESET_DATABASE_URL="postgresql://..." \
LEANHUB_QA_RESET_PROJECT_REF="<project-ref>" \
LEANHUB_QA_RESET_PUBLISHABLE_KEY="<publishable-key>" \
npm run qa:cookie:hosted-reset
```

### 2. Destructive reset (explicit confirmation required)

```bash
LEANHUB_QA_RESET_CONFIRM=DELETE_COOKIEWORKS_ONLY \
LEANHUB_QA_RESET_SUPABASE_URL="https://<project-ref>.supabase.co" \
LEANHUB_QA_RESET_SERVICE_ROLE_KEY="<service-role-key>" \
LEANHUB_QA_RESET_DATABASE_URL="postgresql://..." \
LEANHUB_QA_RESET_PROJECT_REF="<project-ref>" \
LEANHUB_QA_RESET_PUBLISHABLE_KEY="<publishable-key>" \
npm run qa:cookie:hosted-reset -- --destructive
```

### 3. Hosted foundation seed (non-destructive)

Use after a full hosted `db reset --linked`. **Do not** use `qa:cookie:seed` on
hosted — that command is local-only.

```bash
LEANHUB_QA_RESET_SUPABASE_URL="https://<project-ref>.supabase.co" \
LEANHUB_QA_RESET_SERVICE_ROLE_KEY="<service-role-key>" \
LEANHUB_QA_RESET_DATABASE_URL="postgresql://..." \
LEANHUB_QA_RESET_PROJECT_REF="<project-ref>" \
LEANHUB_QA_RESET_PUBLISHABLE_KEY="<publishable-key>" \
npm run qa:cookie:hosted-seed
```

### Hosted safeguards

1. **Dry-run by default** — without `--destructive`, only prints the plan/inventory.
2. **Exact tenant match** — organisation code must be exactly `cookieworks-manufacturing`.
3. **Tenant verification** — prints organisation name, code, UUID, project ref, and counts before destructive mode.
4. **Explicit confirmation** — destructive mode requires `LEANHUB_QA_RESET_CONFIRM=DELETE_COOKIEWORKS_ONLY`.
5. **Project allow-list** — `LEANHUB_QA_RESET_PROJECT_REF` must match the Supabase URL project ref exactly.
6. **Scoped deletion** — all deletes are scoped via CookieWorks `organisation_id` or deterministic QA auth user IDs.
7. **Other tenants preserved** — automated tests assert Apex/demo data survives CookieWorks reset.
8. **No committed secrets** — credentials are supplied at runtime only.
9. **CLI only** — no application routes, Edge Functions, or RPCs expose reset capability.

### Deletion implementation notes

- Reset purges **module/business tables** for the CookieWorks organisation using repeated FK-safe SQL passes.
- See `docs/development/qa-tenant-deletion-graph.md` for the full deletion graph, indirect child handling, storage cleanup, and fail-closed verification rules.
- Foundation tables (organisation, memberships, units, RBAC grants, builtin problem-solving catalogue, append-only audit ledgers) are preserved by allowlist.
- `provision_organisation` bootstrap artefacts and append-only audit events remain as documented exceptions.
- Auth users are refreshed in place via idempotent seed (deterministic QA user IDs/emails); unrelated Auth users are never enumerated or deleted.
- Full physical `organisations` row deletion is not attempted because append-only audit triggers and `ON DELETE RESTRICT` foreign keys require elevated maintainer DB privileges beyond the Supabase CLI connection role.

## Local clean-rebuild verification (QA1b)

Prove the repository recreates schema from migrations and reaches a
foundation-only CookieWorks baseline:

```bash
npm run db:start
npm run qa:verify:clean-rebuild
```

See `docs/qa/hosted-qa-rebuild-runbook.md` for the full hosted rebuild
procedure (maintainer-only; not executed by automation).

## Manual smoke testing

See `docs/qa/SMOKE_TEST_PLAYBOOK.md` for module order and detailed Maturity acceptance scenarios.
