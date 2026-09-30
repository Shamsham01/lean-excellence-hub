# LEANAI-CONTEXT-04 — Hosted migration operator runbook

**Canonical migration:** `20260930103004_leanai_general_coach_sessions.sql`

**Target:** linked hosted Supabase project `zsadfvjtknbbfomlmttv`
(`eu-west-1`). A prior audit on 30 September found hosted/repository
history aligned through `20260930081134`; the generated-version mismatch
tracked in #193 was already repaired.

This runbook required explicit authorisation to apply the migration. It does
not authorise a Netlify deploy, Auth changes, billing writes or a CookieWorks
reset. Code gate: #196 and #197 are merged. The hosted schema gate is
**complete** as of the apply recorded below; customer-readiness is not.

## Applied outcome (30 September 2026)

An authenticated operator environment (Cursor Cloud runtime secret
`SUPABASE_ACCESS_TOKEN`, value not recorded) used official CLI
`npx supabase` v2.115.0 against project `zsadfvjtknbbfomlmttv`
(`ACTIVE_HEALTHY`, `eu-west-1`):

1. `supabase login` then `supabase link --project-ref zsadfvjtknbbfomlmttv`
   succeeded.
2. `supabase migration list --linked` showed 216 matched versions through
   `20260930081134` and **only** local-only `20260930103004`.
3. `supabase db push --linked --dry-run` listed **only**
   `20260930103004_leanai_general_coach_sessions.sql`.
4. `supabase db push --linked` applied that file once. Remote history now
   includes canonical `20260930103004` / `leanai_general_coach_sessions`
   (217/217). A second dry run reports the remote database up to date.
5. Post-apply SQL confirmed Coach columns, INVOKER
   `public.create_ai_coach_session`, guarded DEFINER
   `get_ai_session_detail`, remaining Problem Solving `create_ai_session`,
   and Security Advisor counts unchanged (3 anon / 261 authenticated
   DEFINER warnings; leaked-password protection disabled).

MCP `apply_migration` was not used. History was not repaired. CookieWorks,
Stripe and Netlify were not mutated. Do not replay this file.

## Earlier recovery (30 September 2026)

A previous recovery operator confirmed the same hosted project was
`ACTIVE_HEALTHY` with remote history ending at
`20260930081134_sec_rpc_002_billing_leanai_privilege_boundary`, but
`supabase link --project-ref zsadfvjtknbbfomlmttv` failed:
`LegacyPlatformAuthRequiredError` (no access token). That attempt correctly
stopped without applying the migration by any other mechanism.

## Why the linked CLI, not an MCP migration call?

The Supabase `apply_migration` MCP tool generates a new remote migration
timestamp. It does not accept the canonical filename version, which would
recreate the history mismatch previously repaired in #193. Use the official
Supabase CLI from an authenticated operator environment to preserve the
canonical timestamp.

## Operator sequence

From a clean, current checkout of `Shamsham01/lean-excellence-hub`:

```bash
git checkout main
git pull --ff-only
git status --short
supabase --version
supabase link --project-ref zsadfvjtknbbfomlmttv
supabase migration list --linked
supabase db push --linked --dry-run
```

**Stop unless** the CLI confirms the exact target project and the dry run
lists **only**
`supabase/migrations/20260930103004_leanai_general_coach_sessions.sql`.
Do not run repair or replay a past migration if any other discrepancy appears.
Do not print tokens, passwords or database credentials into reports.

After verifying that the final code head is green and publishing has been
coordinated, deploy **once**:

```bash
supabase db push --linked
supabase migration list --linked
```

The resulting remote migration history must include the canonical
`20260930103004` entry and contain no generated replacement version.

## Read-only post-deployment verification

Check in the hosted Supabase SQL editor or the authenticated operator CLI:

```sql
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ai_sessions'
  and column_name in (
    'context_type',
    'problem_solving_case_id',
    'module_key',
    'intervention_key',
    'site_unit_id',
    'context_contract_version'
  )
order by column_name;

select n.nspname as schema_name, p.proname as function_name,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_ai_coach_session', 'get_ai_session_detail')
order by function_name;
```

Expected: the six columns exist; `problem_solving_case_id` is nullable,
while the new `context_type` is not. The new
`public.create_ai_coach_session` wrapper is SECURITY INVOKER; the existing
`get_ai_session_detail` remains guarded and security-definer. Verify
creator-only Coach privacy through the reviewed pgTAP test before deployment
and inspect the hosted Security Advisor afterwards.

The 30 September apply recorded canonical version `20260930103004`,
post-deployment advisor counts (3 anon / 261 authenticated DEFINER, leaked
password protection disabled) and **no** operator-approved app deployment
SHA in [PROJECT-CURRENT-STATE.md](./PROJECT-CURRENT-STATE.md). Do not mark
the customer-readiness gate complete merely because the migration succeeded.
