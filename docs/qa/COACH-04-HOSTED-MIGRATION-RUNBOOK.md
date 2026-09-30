# LEANAI-CONTEXT-04 — Hosted migration operator runbook

**Canonical migration:** `20260930103004_leanai_general_coach_sessions.sql`

**Target:** linked hosted Supabase project `zsadfvjtknbbfomlmttv`
(`eu-west-1`). A prior audit on 30 September found hosted/repository
history aligned through `20260930081134`; the generated-version mismatch
tracked in #193 was already repaired.

This runbook requires explicit authorisation to apply the migration. It does
not authorise a Netlify deploy, Auth changes, billing writes or a CookieWorks
reset. Code gate: #196 and #197 are merged; `main` is
`70f41c4a4f41cfd46bf3f052597f8414cda36246` with Full Regression green. The
hosted schema gate is **not** complete.

## Recovery outcome (30 September 2026)

A recovery operator confirmed hosted project `zsadfvjtknbbfomlmttv` is
`ACTIVE_HEALTHY` and that remote history still ends at
`20260930081134_sec_rpc_002_billing_leanai_privilege_boundary`. Official CLI
`npx supabase` v2.115.0 is present, but `supabase link --project-ref
zsadfvjtknbbfomlmttv` failed: access token not provided
(`LegacyPlatformAuthRequiredError`). Per policy, the migration was **not**
applied by any other mechanism (including MCP `apply_migration`). Repeat the
sequence below from an authenticated operator environment.

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

Finally, compare `supabase migration list --linked` to the repository and
record the exact migration version, post-deployment advisor counts and
operator-approved app deployment SHA in
[PROJECT-CURRENT-STATE.md](./PROJECT-CURRENT-STATE.md). Do not mark the
customer-readiness gate complete merely because the migration succeeded.
