-- 20261128160000_default_function_execute_revoke_public.sql
--
-- SENTINEL follow-up N4 (from #432/#435 reviews): default privileges gap.
--
-- #432 removed PUBLIC/anon EXECUTE from every existing private.* function, but
-- new functions still get PUBLIC EXECUTE when they are created. The earlier
-- per-schema statements in 20260824200443 / 20260824201542
--   alter default privileges for role ... in schema private
--     revoke execute on functions from public, anon, authenticated;
-- cannot remove the built-in PUBLIC EXECUTE default: per-schema default ACLs
-- are only added on top of the role's global default, so the revoke is a
-- no-op for PUBLIC. Hosted pg_default_acl (read 2026-11-28) has no global
-- function entry for postgres or lean_hub_private_owner, so every function
-- those roles create starts with PUBLIC EXECUTE.
--
-- Fix: revoke EXECUTE from PUBLIC in the global (schema-less) default
-- privileges of the two roles that create LEH functions. Migrations create
-- functions as postgres and then ALTER ... OWNER TO lean_hub_private_owner,
-- so postgres is the role that matters; lean_hub_private_owner is included
-- so a function it creates directly is covered too.
--
-- Effect: functions created after this migration, in any schema, are
-- executable only by their owner until a migration grants EXECUTE
-- explicitly. That matches the intent of the original per-schema revokes
-- for both public and private (public RPCs and RLS helpers must carry
-- explicit grants, which is already the repo convention).
-- After this migration, DROP + CREATE of a function needs explicit GRANT
-- EXECUTE for any role that should call it. CREATE OR REPLACE keeps the
-- existing ACL and is unaffected.
--
-- What this migration does NOT do:
--   * change any existing function's ACL (default privileges only apply to
--     objects created later; CREATE OR REPLACE keeps the existing ACL)
--   * touch tables, sequences, types or schemas
--   * touch other roles' defaults (supabase_admin, supabase_auth_admin, ...)
-- Idempotent: ALTER DEFAULT PRIVILEGES ... REVOKE is a no-op on re-run.

alter default privileges for role postgres
  revoke execute on functions from public;

alter default privileges for role lean_hub_private_owner
  revoke execute on functions from public;
