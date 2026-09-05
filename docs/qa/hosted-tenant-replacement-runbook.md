# Hosted pre-launch tenant replacement runbook (QA2)

Maintainer runbook for replacing the single legacy hosted demo tenant
(**Lean Excellence Demo**) with the **CookieWorks Manufacturing** foundation-only
QA tenant **without** resetting the Supabase project.

**This document is planning and verification guidance only.** Automated agents
must not execute destructive hosted steps. A human maintainer performs the
hosted replacement.

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

Dry-run output must show:

- Resolved legacy organisation name, code, and UUID
- Membership count (**8** expected on current hosted pre-launch)
- Module/business inventory counts
- `organisation-evidence` object count for the legacy tenant prefix
- Auth identities attached to legacy memberships
- Auth identities safe to delete (legacy-only memberships)
- Whether CookieWorks already exists (must be **no** before destructive run)

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
2. Purge all legacy tenant module/business data
3. Delete legacy tenant storage objects under `organisation-evidence/{legacy_org_id}/`
4. Delete legacy foundation records and the `organisations` row
5. Delete legacy-only auth identities (users with no memberships outside the legacy tenant)
6. Seed CookieWorks foundation (`cookieworks-manufacturing`)
7. Verify legacy absence and `FOUNDATION-ONLY VERIFIED` for CookieWorks

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
| Verification marker | `FOUNDATION-ONLY VERIFIED` |
| Legacy organisation | **Absent** |
| `organisation-evidence` storage objects | **0** |

Sign in to the hosted application as `admin@cookieworks.local` and begin manual
smoke testing from **ORG-01** in `docs/qa/SMOKE_TEST_PLAYBOOK.md`.

## 4. Maintainer checklist

- [ ] Project ref confirmed: `zsadfvjtknbbfomlmttv`
- [ ] Dry-run legacy inventory reviewed
- [ ] Legacy UUID/code/name/membership contract verified
- [ ] CookieWorks not already present before destructive run
- [ ] Destructive command executed with `DELETE_LEGACY_DEMO_AND_SEED_COOKIEWORKS`
- [ ] Legacy organisation absent
- [ ] Legacy storage prefix absent
- [ ] CookieWorks foundation seeded
- [ ] `FOUNDATION-ONLY VERIFIED` confirmed
- [ ] Hosted login verified (ORG-01)

## Related documentation

- `docs/development/qa-tenant.md` — CookieWorks harness commands and personas
- `docs/development/qa-tenant-deletion-graph.md` — module purge strategy
- `docs/qa/hosted-qa-rebuild-runbook.md` — full hosted wipe alternative (QA1)
