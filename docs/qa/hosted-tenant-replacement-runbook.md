# Hosted pre-launch tenant replacement runbook (QA2)

Maintainer runbook for replacing the single legacy hosted demo tenant
(**Lean Excellence Demo**) with the **CookieWorks Manufacturing** foundation-only
QA tenant **without** resetting the Supabase project.

**This document is planning and verification guidance only.** Automated agents
must not execute destructive hosted steps. A human maintainer performs the
hosted replacement.

## Incident note (QA2b): dry-run import side effect

During the first real hosted QA2 dry-run, `npm run qa:cookie:hosted-replacement`
printed `Mode: dry-run` but unexpectedly executed the CookieWorks hosted seed
before the replacement logic reached its early return.

**Root cause:** `hosted-replacement.ts` imported `runHostedCookieWorksSeed` from
`hosted-seed.ts`, and `hosted-seed.ts` unconditionally called `main()` at module
evaluation time. Importing the seed module therefore executed the hosted seed
before dry-run inspection completed.

**Fix (QA2b):** hosted QA library modules are import-safe. CLI entrypoints live in
dedicated `*-cli.ts` files (`hosted-seed-cli.ts`, `hosted-replacement-cli.ts`).
Importing library modules performs zero writes.

## Incident note (QA2c): outbox FK blocked legacy tenant purge

During the first real hosted QA2b recovery attempt (`--destructive
--preserve-existing-cookieworks`), tenant purge aborted inside the PostgreSQL
`DO $$ ... $$` module purge with:

```text
update or delete on table "domain_event_outbox"
violates foreign key constraint
"notification_projector_pre_cutover_skips_outbox_fkey"
on table "notification_projector_pre_cutover_skips"
```

**Root cause:** migration `20260903120000_n1d_notification_worker_scheduling.sql`
introduced `private.notification_projector_pre_cutover_skips` with composite FK
`(organisation_id, event_id) -> private.domain_event_outbox(organisation_id, id)`
and `ON DELETE RESTRICT`. The QA tenant purge deleted outbox rows before their
dependent pre-cutover skip rows.

**Why hosted state was unchanged:** the purge runs inside a single PostgreSQL
`DO` block. The FK violation aborted that statement and PostgreSQL rolled back all
mutations from the block. Storage and Auth stages had not started yet.

**Private infrastructure deletion order (tenant-scoped):**

```text
notification_delivery_provider_envelopes
  -> notification_delivery_ledger
    -> domain_event_outbox
notification_projector_pre_cutover_skips (via tenant outbox rows)
  -> domain_event_outbox
session_organisation_contexts (organisation-scoped; no outbox FK)
```

**Dry-run inventory now includes:** `private.notification_projector_pre_cutover_skips`
(counted through the tenant's outbox rows).

**Never rerun destructive replacement blindly after failure.** Always perform a
read-only dry-run first and confirm:

- legacy foundation/private counts match expectations
- CookieWorks foundation-only contract (for recovery)
- no partial module purge residue
- no unexpected auth/storage drift

Remember: statement-level DB rollback inside the purge `DO` block is **not** the
same as atomicity across the full workflow (DB module purge, Storage deletion,
foundation deletion, Auth deletion, CookieWorks seeding). Those stages are separate
operations with independent failure modes.

## Incident note (QA2d): append-only `ai_usage_events` blocked module purge

During the second real hosted QA2 recovery attempt (`--destructive --preserve-existing-cookieworks`), tenant purge aborted inside the PostgreSQL
`DO $$ ... $$` module purge with:

```text
Tenant module purge failed on public.ai_usage_events: ai usage events are append-only
```

**Root cause:** `public.ai_usage_events` is protected by a custom append-only
trigger (`ai_usage_events_append_only` → `private.prevent_ai_usage_event_mutation()`)
introduced in migration `20260827009010_milestone12_security_hardening.sql`. The
generic purge loop attempted `DELETE` against every `organisation_id` module table.
Append-only discovery only matched triggers calling
`private.prevent_update_or_delete()`, so `ai_usage_events` was not classified.
The legacy SQLERRM handler only tolerated messages containing `is append-only`
(`% is append-only` from `tg_table_name`), not the custom message
`ai usage events are append-only`.

**Schema facts (`public.ai_usage_events`):**

| Property | Value |
| --- | --- |
| Primary key | `id uuid` (plus composite unique `(organisation_id, id)`) |
| `organisation_id` | `uuid not null` (tenant-scoped, no direct FK to `organisations`) |
| Incoming FKs | `organisation_memberships`, `ai_sessions`, `ai_runs` (all `ON DELETE RESTRICT`) |
| DELETE trigger | `ai_usage_events_append_only` |
| Trigger function | `private.prevent_ai_usage_event_mutation()` |
| SQLSTATE | `55000` |
| Exception message | `ai usage events are append-only` |
| Introducing migrations | table `20260827009005_milestone12_ai_usage_rate_limits.sql`; immutability `20260827009010_milestone12_security_hardening.sql` |
| Retention class | Authoritative AI usage/accounting telemetry; deletable only during controlled full tenant retirement |

**Why hosted state was unchanged:** same as QA2c — the purge runs inside a single
PostgreSQL `DO` block. The append-only exception aborted that statement and
PostgreSQL rolled back all mutations from the block. Storage and Auth stages had
not started yet.

**Approved append-only / immutable tenant-retirement policy (QA2d):**

| Class | Lifecycle stage | Behaviour |
| --- | --- | --- |
| A. ordinary tenant-deletable | module | Generic multi-pass `DELETE` loop |
| B. controlled-retirement-delete | module | Narrow trigger disable → tenant-scoped `DELETE` → re-enable (full tenant removal module purge only) |
| C. append-only-module-retained | module | Excluded from generic loop and CookieWorks verification |
| D. foundation-foundation-stage | foundation | Preserved through module purge; deleted only in foundation/organisation deletion |
| E. infrastructure-explicit | module | Template/resource registry handled explicitly |
| F. immutable-explicit-unlock | module | Maturity subgraph unlocked in purge SQL |

Foundation-stage audit ledgers (`security_audit_events`, `business_audit_events`) MUST
survive module purge even during `full-tenant-removal`. They are removed only in the
later foundation deletion transaction.

Custom append-only tables (not using `prevent_update_or_delete`) with controlled
retirement deletion: `ai_usage_events`, `benefit_overlap_allocation_history`.

**Purge classification order (full tenant removal):**

```text
private notification infrastructure (QA2c order)
→ controlled append-only retirement deletes (custom + discovered)
→ maturity explicit unlock deletes
→ generic deletable module tables (append-only excluded)
→ remaining-row verification (append-only must be zero)
```

**Dry-run inventory now includes:** explicit append-only / immutable tenant-owned
row counts (at minimum `public.ai_usage_events` when present).

**Fail-closed procedure:**

1. Remove recovery confirmation token after any failed destructive attempt.
2. Run read-only dry-run and verify append-only inventory section.
3. Never rerun destructive replacement blindly.
4. Unexpected append-only tables without an approved policy must abort the purge.

## Target hosted project

| Field | Value |
| --- | --- |
| Project ref | `zsadfvjtknbbfomlmttv` |
| Legacy organisation code | `lean-excellence-demo` |
| Legacy organisation UUID | `402811bb-aa05-4128-b7e5-a1e3b359b92e` |
| Legacy organisation name | Lean Excellence Demo |
| Expected legacy memberships | **8** |
| Replacement organisation | CookieWorks Manufacturing (`cookieworks-manufacturing`) |

## Desired final state

| Requirement | Expected state |
| --- | --- |
| Legacy demo tenant | **Absent** (`lean-excellence-demo`, UUID `402811bb-aa05-4128-b7e5-a1e3b359b92e`) |
| CookieWorks organisation | **Present** (`cookieworks-manufacturing`) |
| QA personas | **7** deterministic CookieWorks users |
| Organisational units | **10** |
| Active role grants | **7** |
| Module / business records | **Zero** (foundation-only) |
| `organisation-evidence` storage objects | **0** for CookieWorks tenant prefix |
| Database schema / migrations | **Unchanged** |
| RLS / RBAC semantics | **Unchanged** |

## What we are not doing in QA2

- No `npx supabase db reset --linked`
- No migrations unless investigation proves absolutely unavoidable
- No modification of hosted secrets committed to the repository
- No application routes, Edge Functions, or public APIs for replacement
- No weakening of RLS or tenant isolation safeguards

## 1. Dry-run legacy inspection (default)

Inspect the exact legacy tenant and print the destructive execution plan:

```bash
LEANHUB_QA_RESET_SUPABASE_URL="https://zsadfvjtknbbfomlmttv.supabase.co" \
LEANHUB_QA_RESET_SERVICE_ROLE_KEY="<service-role-key>" \
LEANHUB_QA_RESET_DATABASE_URL="postgresql://..." \
LEANHUB_QA_RESET_PROJECT_REF="zsadfvjtknbbfomlmttv" \
LEANHUB_QA_RESET_PUBLISHABLE_KEY="<publishable-key>" \
npm run qa:cookie:hosted-replacement
```

Dry-run is **read-only**. It may query the database, inspect Auth, inspect Storage
metadata, calculate the plan, and verify contracts. It must **not** seed CookieWorks,
delete anything, create Auth users, create organisation rows, create invitations,
mutate roles/grants, write audit events, or modify storage.

Dry-run output must show:

- Legacy organisation UUID, code, name, and membership count (**8** expected)
- Member/auth identity details: user ID, email, display name, membership count,
  legacy-only flag, and conflicting organisation identifiers when present
- Tenant foundation counts: organisational units, roles, role versions, role
  grants, memberships, invitations
- Private infrastructure counts:
  `notification_delivery_provider_envelopes`, `notification_delivery_ledger`,
  `domain_event_outbox`, `notification_projector_pre_cutover_skips`,
  `session_organisation_contexts`
- Storage: `organisation-evidence` object count for the legacy tenant prefix
- Modules: section/module counts and total tenant-owned module row count
- CookieWorks presence
- Cross-organisation conflicts (must be **none** before destructive run)

When both legacy demo and CookieWorks already exist (recovery state), dry-run also
shows:

- `Legacy organisation: VERIFIED`
- `Legacy auth isolation: VERIFIED`
- `CookieWorks already present: YES`
- `CookieWorks foundation-only contract: VERIFIED`
- `CookieWorks organisation UUID: ...`
- `Auth identity overlap: NONE`
- `Ordinary destructive replacement: REFUSED because CookieWorks exists`
- `Recovery path available: --preserve-existing-cookieworks`
- `No hosted data modified`

No secrets, passwords, or tokens are printed.

## 2. Destructive replacement (maintainer only)

**Preconditions**

- Dry-run contract checks pass for the legacy organisation
- `LEANHUB_QA_RESET_PROJECT_REF` is exactly `zsadfvjtknbbfomlmttv`
- CookieWorks organisation is **not** already present
- Maintainer has confirmed this is the disposable pre-launch hosted project

**Execution**

```bash
LEANHUB_QA_RESET_CONFIRM=DELETE_LEGACY_DEMO_AND_SEED_COOKIEWORKS \
LEANHUB_QA_RESET_SUPABASE_URL="https://zsadfvjtknbbfomlmttv.supabase.co" \
LEANHUB_QA_RESET_SERVICE_ROLE_KEY="<service-role-key>" \
LEANHUB_QA_RESET_DATABASE_URL="postgresql://..." \
LEANHUB_QA_RESET_PROJECT_REF="zsadfvjtknbbfomlmttv" \
LEANHUB_QA_RESET_PUBLISHABLE_KEY="<publishable-key>" \
npm run qa:cookie:hosted-replacement -- --destructive
```

The command performs, in order:

1. Validate legacy organisation contract (id, code, name, membership count)
2. Capture legacy auth user IDs **before** any mutation
3. Abort if any legacy member belongs to another organisation
4. Validate CookieWorks is absent and seed prerequisites are present
5. Purge all legacy tenant module/business data
6. Delete legacy tenant storage objects under `organisation-evidence/{legacy_org_id}/`
7. Delete legacy foundation records and the `organisations` row
8. Verify comprehensive legacy absence (organisation, module rows, private
   infrastructure, storage, indirect references)
9. Purge auth identity prerequisites and delete captured legacy-only auth users
10. Verify captured auth identities are absent
11. Seed CookieWorks foundation with explicit `databaseUrl` (no local env load)
12. Verify CookieWorks foundation-only state and print
    `HOSTED DEMO → COOKIEWORKS REPLACEMENT VERIFIED`

**Confirmation token (ordinary replacement):** `DELETE_LEGACY_DEMO_AND_SEED_COOKIEWORKS`

## 2b. Recovery: preserve existing CookieWorks (QA2b incident)

Use this path **only** when:

- Legacy demo (`lean-excellence-demo`) is still present
- CookieWorks (`cookieworks-manufacturing`) already exists and passes the
  **complete** foundation-only verifier (7 personas, 7 memberships, 10 units,
  7 active role grants, zero module rows, zero storage objects)
- Legacy and CookieWorks auth identities do **not** overlap

This path deletes **only** the legacy demo tenant. It does **not** re-seed
CookieWorks.

**Execution**

```bash
LEANHUB_QA_RESET_CONFIRM=DELETE_LEGACY_DEMO_PRESERVE_VERIFIED_COOKIEWORKS \
LEANHUB_QA_RESET_SUPABASE_URL="https://zsadfvjtknbbfomlmttv.supabase.co" \
LEANHUB_QA_RESET_SERVICE_ROLE_KEY="<service-role-key>" \
LEANHUB_QA_RESET_DATABASE_URL="postgresql://..." \
LEANHUB_QA_RESET_PROJECT_REF="zsadfvjtknbbfomlmttv" \
LEANHUB_QA_RESET_PUBLISHABLE_KEY="<publishable-key>" \
npm run qa:cookie:hosted-replacement -- --destructive --preserve-existing-cookieworks
```

**Confirmation token (recovery):** `DELETE_LEGACY_DEMO_PRESERVE_VERIFIED_COOKIEWORKS`

Recovery refuses dirty/partial states before any mutation, including:

- CookieWorks missing, partially seeded, wrong name/code, wrong counts
- CookieWorks contains module data or storage objects
- Legacy contract differs from pinned constants
- Legacy membership count differs from **8**
- Cross-org legacy identity exists
- Auth identity overlap between legacy and CookieWorks
- Wrong project ref or confirmation token

On success, prints:
`HOSTED LEGACY DEMO REMOVED — EXISTING COOKIEWORKS PRESERVED AND VERIFIED`

## Partial failure recovery

Database, Storage, and Auth operations are not one atomic transaction. If a
step fails, **do not** print the success marker or assume a clean final state.

| Failure point | Likely state | Recovery guidance |
| --- | --- | --- |
| Storage deletion fails | Legacy DB data still present; storage objects may remain | Fix Storage/API issue; re-run dry-run; retry destructive run only after confirming no partial CookieWorks seed |
| DB tenant deletion fails | Module purge `DO` block may roll back entirely on FK/SQL error; foundation/org row remains | Inspect dry-run private infrastructure counts (including pre-cutover skips); resolve deletion-order blockers; do not delete auth users until DB tenant is fully absent |
| Auth deletion fails | Legacy tenant DB rows absent; auth identities may remain | Re-run auth deletion for the originally captured user IDs after purging `profiles` / `identity_controls` prerequisites; verify auth absence before seeding |
| CookieWorks seed fails | Legacy absent; CookieWorks missing or partial | Inspect CookieWorks inventory; use hosted reset/seed tooling only after confirming legacy absence; never seed over an ambiguous partial state |

Before any retry:

- Re-run dry-run and confirm contract, cross-org isolation, and CookieWorks absence
  (or foundation-only state for recovery path)
- Never rediscover auth user IDs after membership rows have been deleted — reuse the
  captured ID list from the failed attempt's logs when safe to do so

## 3. Post-replacement verification

After destructive replacement, confirm:

```bash
# Legacy absent
# Expect zero rows
select code, id from public.organisations
where code = 'lean-excellence-demo'
   or id = '402811bb-aa05-4128-b7e5-a1e3b359b92e';

# CookieWorks present
select code, name from public.organisations
where code = 'cookieworks-manufacturing';
```

Re-run dry-run inventory for CookieWorks foundation state:

```bash
...credentials...
npm run qa:cookie:hosted-reset
```

Expect:

| Check | Expected |
| --- | --- |
| CookieWorks organisation | `cookieworks-manufacturing` / CookieWorks Manufacturing |
| QA personas | **7** |
| Organisational units | **10** |
| Active role grants | **7** |
| All module counts | **0** |
| Verification marker | `HOSTED DEMO → COOKIEWORKS REPLACEMENT VERIFIED` (ordinary) or `HOSTED LEGACY DEMO REMOVED — EXISTING COOKIEWORKS PRESERVED AND VERIFIED` (recovery) |
| Legacy organisation | **Absent** |
| `organisation-evidence` storage objects | **0** |

Sign in to the hosted application as `admin@cookieworks.local` and begin manual
smoke testing from **ORG-01** in `docs/qa/SMOKE_TEST_PLAYBOOK.md`.

## 4. Maintainer checklist

- [ ] Project ref confirmed: `zsadfvjtknbbfomlmttv`
- [ ] Dry-run legacy inventory reviewed
- [ ] Legacy UUID/code/name/membership contract verified
- [ ] CookieWorks not already present before ordinary destructive run (or recovery preconditions verified)
- [ ] Correct confirmation token used for chosen path
- [ ] Destructive command executed with appropriate flags
- [ ] Legacy organisation absent
- [ ] Legacy storage prefix absent
- [ ] CookieWorks foundation present and foundation-only
- [ ] `FOUNDATION-ONLY VERIFIED` confirmed
- [ ] Hosted login verified (ORG-01)

## Related documentation

- `docs/development/qa-tenant.md` — CookieWorks harness commands and personas
- `docs/development/qa-tenant-deletion-graph.md` — module purge strategy
- `docs/qa/hosted-qa-rebuild-runbook.md` — full hosted wipe alternative (QA1)
