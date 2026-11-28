begin;

select plan(8);

-- N5 (20261128120000): public auth wrappers are callable by authenticated
-- only, never by PUBLIC or anon. Owner and SECURITY INVOKER are unchanged.

select ok(
  pg_catalog.has_function_privilege('authenticated', 'public.current_organisation_id()', 'execute'),
  'authenticated may execute current_organisation_id'
);

select ok(
  not pg_catalog.has_function_privilege('anon', 'public.current_organisation_id()', 'execute'),
  'anon cannot execute current_organisation_id'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = 'public.current_organisation_id()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'current_organisation_id has no PUBLIC EXECUTE grant'
);

select ok(
  (
    select not p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
    from pg_catalog.pg_proc p
    where p.oid = 'public.current_organisation_id()'::regprocedure
  ),
  'current_organisation_id stays SECURITY INVOKER owned by postgres'
);

select ok(
  pg_catalog.has_function_privilege('authenticated', 'public.has_scoped_permission(uuid, text, uuid, uuid)', 'execute'),
  'authenticated may execute has_scoped_permission'
);

select ok(
  not pg_catalog.has_function_privilege('anon', 'public.has_scoped_permission(uuid, text, uuid, uuid)', 'execute'),
  'anon cannot execute has_scoped_permission'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = 'public.has_scoped_permission(uuid, text, uuid, uuid)'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'has_scoped_permission has no PUBLIC EXECUTE grant'
);

select ok(
  (
    select not p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
    from pg_catalog.pg_proc p
    where p.oid = 'public.has_scoped_permission(uuid, text, uuid, uuid)'::regprocedure
  ),
  'has_scoped_permission stays SECURITY INVOKER owned by postgres'
);

select * from finish();

rollback;
