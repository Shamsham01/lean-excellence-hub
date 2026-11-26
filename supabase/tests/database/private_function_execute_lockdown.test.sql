begin;

select plan(22);

-- Private function EXECUTE lockdown (20261126093000).
-- Nothing in schema private is executable by PUBLIC or anon; required roles
-- hold explicit grants; definer chains still resolve for lean_hub_private_owner.

-- 1-2. Global invariants.
select is(
  (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where n.nspname = 'private'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no private function grants EXECUTE to PUBLIC'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'no private function is executable by anon'
);

-- 3-6. Definer chain: lhpo definers call the postgres-owned INVOKER
-- schedule_recurrence_matches_date, which calls schedule_weekday_matches.
select ok(
  pg_catalog.has_function_privilege(
    'lean_hub_private_owner',
    'private.schedule_recurrence_matches_date(jsonb,date,date,date)',
    'EXECUTE'
  ),
  'lean_hub_private_owner can execute private.schedule_recurrence_matches_date'
);

select ok(
  pg_catalog.has_function_privilege(
    'lean_hub_private_owner',
    'private.schedule_weekday_matches(date,text)',
    'EXECUTE'
  ),
  'lean_hub_private_owner can execute private.schedule_weekday_matches'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.schedule_weekday_matches(date,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.schedule_weekday_matches'
);

select ok(
  not pg_catalog.has_function_privilege(
    'service_role',
    'private.schedule_recurrence_matches_date(jsonb,date,date,date)',
    'EXECUTE'
  ),
  'service_role cannot execute private.schedule_recurrence_matches_date'
);

-- 7-9. RLS policy helpers stay executable by authenticated.
select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'private.can_read_ci_project(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated can execute policy helper private.can_read_ci_project'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'private.can_read_gemba_action_evidence(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated can execute policy helper private.can_read_gemba_action_evidence'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'private.action_visible_to_current_member(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated can execute policy helper private.action_visible_to_current_member'
);

-- 10. Worker RPC chain: public.finalize_workforce_provision (INVOKER,
-- service_role) calls the private definer.
select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'private.finalize_workforce_provision(uuid,uuid)',
    'EXECUTE'
  ),
  'service_role can execute private.finalize_workforce_provision'
);

-- 11-17. Exact proacl samples.
select is(
  (select proacl::text from pg_catalog.pg_proc
   where oid = 'private.schedule_weekday_matches(date,text)'::regprocedure),
  '{postgres=X/postgres,lean_hub_private_owner=X/postgres}',
  'private.schedule_weekday_matches proacl is exact'
);

select is(
  (select proacl::text from pg_catalog.pg_proc
   where oid = 'private.schedule_recurrence_matches_date(jsonb,date,date,date)'::regprocedure),
  '{postgres=X/postgres,lean_hub_private_owner=X/postgres}',
  'private.schedule_recurrence_matches_date proacl is exact'
);

select is(
  (select proacl::text from pg_catalog.pg_proc
   where oid = 'private.can_read_ci_project(uuid,uuid)'::regprocedure),
  '{lean_hub_private_owner=X/lean_hub_private_owner,authenticated=X/lean_hub_private_owner}',
  'private.can_read_ci_project proacl is exact'
);

select is(
  (select proacl::text from pg_catalog.pg_proc
   where oid = 'private.can_use_ai(uuid)'::regprocedure),
  '{lean_hub_private_owner=X/lean_hub_private_owner,authenticated=X/lean_hub_private_owner}',
  'private.can_use_ai lost its explicit PUBLIC entry and keeps authenticated'
);

select is(
  (select proacl::text from pg_catalog.pg_proc
   where oid = 'private.finalize_workforce_provision(uuid,uuid)'::regprocedure),
  '{lean_hub_private_owner=X/lean_hub_private_owner,service_role=X/lean_hub_private_owner}',
  'private.finalize_workforce_provision proacl is exact'
);

select is(
  (select proacl::text from pg_catalog.pg_proc
   where oid = 'private.action_visible_to_current_member(uuid,uuid)'::regprocedure),
  '{postgres=X/postgres,authenticated=X/postgres}',
  'private.action_visible_to_current_member proacl is exact'
);

select is(
  (select proacl::text from pg_catalog.pg_proc
   where oid = 'private.invoke_notification_projector_worker()'::regprocedure),
  '{postgres=X/postgres}',
  'cron entry point private.invoke_notification_projector_worker stays postgres-only'
);

-- 18-19. The chain actually runs as lean_hub_private_owner.
set local role lean_hub_private_owner;

select lives_ok(
  $$select private.schedule_recurrence_matches_date(
      '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
      date '2026-11-02', null::date, date '2026-11-23')$$,
  'lean_hub_private_owner can run the recurrence -> weekday invoker chain'
);

select is(
  private.schedule_recurrence_matches_date(
    '{"frequency":"weekly","interval":1,"weekdays":["monday"]}'::jsonb,
    date '2026-11-02', null::date, date '2026-11-23'),
  true,
  'recurrence chain evaluates correctly as lean_hub_private_owner'
);

reset role;

-- 20. authenticated gets a clean 42501 on a private helper it does not need.
set local role authenticated;

select throws_ok(
  $$select private.schedule_weekday_matches(date '2026-11-23', 'monday')$$,
  '42501',
  'permission denied for function schedule_weekday_matches',
  'authenticated cannot call private.schedule_weekday_matches directly'
);

reset role;

-- 21. service_role gets 42501 on a private helper it does not need.
set local role service_role;

select throws_ok(
  $$select private.schedule_weekday_matches(date '2026-11-23', 'monday')$$,
  '42501',
  'permission denied for function schedule_weekday_matches',
  'service_role cannot call private.schedule_weekday_matches directly'
);

reset role;

-- 22. postgres (cron run-as) still reaches lhpo-owned functions via membership.
select ok(
  pg_catalog.has_function_privilege(
    'postgres',
    'private.finalize_workforce_provision(uuid,uuid)',
    'EXECUTE'
  ),
  'postgres keeps EXECUTE on lean_hub_private_owner-owned functions via membership'
);

select * from finish();

rollback;
