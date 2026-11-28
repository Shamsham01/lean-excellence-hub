begin;

select plan(12);

-- #431 (20261128001500): EXECUTE grants for six private helpers used by live
-- paths. Pin the exact EXECUTE grantees, then prove the benefit SELECT
-- policies no longer fail with 42501 for authenticated.

select is(
  (
    select string_agg(
      case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
      ',' order by case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end
    )
    from pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where acl.privilege_type = 'EXECUTE'
  ),
  'authenticated,lean_hub_private_owner',
  'private.can_read_benefit_overlap_group(uuid,uuid) EXECUTE grantees are exactly authenticated,lean_hub_private_owner'
)
from pg_catalog.pg_proc p
where p.oid = 'private.can_read_benefit_overlap_group(uuid,uuid)'::regprocedure;

select is(
  (
    select string_agg(
      case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
      ',' order by case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end
    )
    from pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where acl.privilege_type = 'EXECUTE'
  ),
  'authenticated,lean_hub_private_owner',
  'private.can_read_benefit_overlap_allocation(uuid,uuid) EXECUTE grantees are exactly authenticated,lean_hub_private_owner'
)
from pg_catalog.pg_proc p
where p.oid = 'private.can_read_benefit_overlap_allocation(uuid,uuid)'::regprocedure;

select is(
  (
    select string_agg(
      case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
      ',' order by case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end
    )
    from pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where acl.privilege_type = 'EXECUTE'
  ),
  'authenticated,lean_hub_private_owner',
  'private.can_read_benefit_realisation_entry(uuid,uuid) EXECUTE grantees are exactly authenticated,lean_hub_private_owner'
)
from pg_catalog.pg_proc p
where p.oid = 'private.can_read_benefit_realisation_entry(uuid,uuid)'::regprocedure;

select is(
  (
    select string_agg(
      case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
      ',' order by case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end
    )
    from pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where acl.privilege_type = 'EXECUTE'
  ),
  'postgres,service_role',
  'private.platform_admin_in_app_notifications(uuid,text,text,integer) EXECUTE grantees are exactly postgres,service_role'
)
from pg_catalog.pg_proc p
where p.oid = 'private.platform_admin_in_app_notifications(uuid,text,text,integer)'::regprocedure;

select is(
  (
    select string_agg(
      case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
      ',' order by case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end
    )
    from pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where acl.privilege_type = 'EXECUTE'
  ),
  'postgres,service_role',
  'private.mark_platform_admin_in_app_notification_read(uuid,text,uuid) EXECUTE grantees are exactly postgres,service_role'
)
from pg_catalog.pg_proc p
where p.oid = 'private.mark_platform_admin_in_app_notification_read(uuid,text,uuid)'::regprocedure;

select is(
  (
    select string_agg(
      case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
      ',' order by case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end
    )
    from pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where acl.privilege_type = 'EXECUTE'
  ),
  'postgres,service_role',
  'private.mark_all_platform_admin_in_app_notifications_read(uuid,text) EXECUTE grantees are exactly postgres,service_role'
)
from pg_catalog.pg_proc p
where p.oid = 'private.mark_all_platform_admin_in_app_notifications_read(uuid,text)'::regprocedure;

-- anon still has no EXECUTE on any of the six.
select ok(
  not pg_catalog.has_function_privilege('anon', 'private.can_read_benefit_overlap_group(uuid,uuid)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('anon', 'private.can_read_benefit_overlap_allocation(uuid,uuid)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('anon', 'private.can_read_benefit_realisation_entry(uuid,uuid)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('anon', 'private.platform_admin_in_app_notifications(uuid,text,text,integer)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('anon', 'private.mark_platform_admin_in_app_notification_read(uuid,text,uuid)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('anon', 'private.mark_all_platform_admin_in_app_notifications_read(uuid,text)', 'EXECUTE'),
  'anon cannot execute any of the #431 helpers'
);

-- authenticated is not widened onto the notification functions, and
-- service_role is not widened onto the benefit helpers.
select ok(
  not pg_catalog.has_function_privilege('authenticated', 'private.platform_admin_in_app_notifications(uuid,text,text,integer)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('authenticated', 'private.mark_platform_admin_in_app_notification_read(uuid,text,uuid)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('authenticated', 'private.mark_all_platform_admin_in_app_notifications_read(uuid,text)', 'EXECUTE'),
  'authenticated cannot execute the private platform-admin notification functions'
);

select ok(
  not pg_catalog.has_function_privilege('service_role', 'private.can_read_benefit_overlap_group(uuid,uuid)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('service_role', 'private.can_read_benefit_overlap_allocation(uuid,uuid)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('service_role', 'private.can_read_benefit_realisation_entry(uuid,uuid)', 'EXECUTE'),
  'service_role is not granted the private benefit RLS helpers'
);

-- Benefit SELECT policies: EXECUTE is checked when the policy qual is
-- initialised, so these previously failed with 42501 even on empty tables.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000431","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select count(*) from public.benefit_overlap_groups$$,
  'authenticated can select benefit_overlap_groups without 42501'
);

select lives_ok(
  $$select count(*) from public.benefit_overlap_allocation_history$$,
  'authenticated can select benefit_overlap_allocation_history without 42501'
);

select lives_ok(
  $$select count(*) from public.benefit_realisation_entries$$,
  'authenticated can select benefit_realisation_entries without 42501'
);

reset role;

select * from finish();

rollback;
