begin;

select plan(8);

-- N4 (20261128160000): functions created by postgres or
-- lean_hub_private_owner no longer get PUBLIC EXECUTE by default.

select ok(
  exists (
    select 1
    from pg_catalog.pg_default_acl d
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 0
      and d.defaclobjtype = 'f'
      and not exists (
        select 1 from pg_catalog.aclexplode(d.defaclacl) a where a.grantee = 0
      )
  ),
  'postgres has a global function default ACL without PUBLIC'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_default_acl d
    where d.defaclrole = 'lean_hub_private_owner'::regrole
      and d.defaclnamespace = 0
      and d.defaclobjtype = 'f'
      and not exists (
        select 1 from pg_catalog.aclexplode(d.defaclacl) a where a.grantee = 0
      )
  ),
  'lean_hub_private_owner has a global function default ACL without PUBLIC'
);

-- A new private function created the way migrations do it (as postgres,
-- then owned by lean_hub_private_owner) starts without PUBLIC/anon EXECUTE.
create function private.n4_default_acl_probe()
returns integer
language sql
stable
set search_path = ''
as $fn$ select 1 $fn$;

alter function private.n4_default_acl_probe() owner to lean_hub_private_owner;

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = 'private.n4_default_acl_probe()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'new private function has no PUBLIC EXECUTE grant'
);

select ok(
  not pg_catalog.has_function_privilege('anon', 'private.n4_default_acl_probe()', 'execute'),
  'anon cannot execute a new private function'
);

select ok(
  not pg_catalog.has_function_privilege('authenticated', 'private.n4_default_acl_probe()', 'execute'),
  'authenticated cannot execute a new private function without an explicit grant'
);

-- A new public function also needs an explicit grant.
create function public.n4_default_acl_probe()
returns integer
language sql
stable
set search_path = ''
as $fn$ select 1 $fn$;

select ok(
  not pg_catalog.has_function_privilege('anon', 'public.n4_default_acl_probe()', 'execute'),
  'anon cannot execute a new public function'
);

-- An explicit grant still works as before.
grant execute on function private.n4_default_acl_probe() to authenticated;

select ok(
  pg_catalog.has_function_privilege('authenticated', 'private.n4_default_acl_probe()', 'execute'),
  'explicit authenticated grant on a new private function still applies'
);

-- Existing functions are unchanged (spot check from #437).
select ok(
  pg_catalog.has_function_privilege('authenticated', 'public.current_organisation_id()', 'execute'),
  'existing authenticated grant on current_organisation_id is unchanged'
);

select * from finish();

rollback;
