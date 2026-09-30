begin;

select plan(48);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd1910000-0000-4000-8000-000000000001',
    'sec-rpc-002-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1910000-0000-4000-8000-000000000002',
    'sec-rpc-002-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd1910000-0000-4000-8000-000000000003',
    'sec-rpc-002-foreign@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table sec_rpc_002_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on sec_rpc_002_ids to authenticated, anon;

insert into sec_rpc_002_ids (key, id)
values
  (
    'org_active',
    private.provision_organisation(
      'd1910000-0000-4000-8000-000000000001',
      'sec-rpc-002-active',
      'SEC RPC 002 Active'
    )
  ),
  (
    'org_provisioning',
    private.provision_organisation(
      'd1910000-0000-4000-8000-000000000001',
      'sec-rpc-002-provisioning',
      'SEC RPC 002 Provisioning'
    )
  ),
  (
    'org_suspended',
    private.provision_organisation(
      'd1910000-0000-4000-8000-000000000001',
      'sec-rpc-002-suspended',
      'SEC RPC 002 Suspended'
    )
  ),
  (
    'org_foreign',
    private.provision_organisation(
      'd1910000-0000-4000-8000-000000000003',
      'sec-rpc-002-foreign',
      'SEC RPC 002 Foreign'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'd1911000-0000-4000-8000-000000000001',
    'd1910000-0000-4000-8000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'd1911000-0000-4000-8000-000000000002',
    'd1910000-0000-4000-8000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'd1911000-0000-4000-8000-000000000003',
    'd1910000-0000-4000-8000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  );

insert into private.identity_controls (
  user_id,
  status,
  enrolment_status,
  stewardship_kind,
  enrolment_completed_at
)
values (
  'd1910000-0000-4000-8000-000000000002',
  'active',
  'complete',
  'platform',
  statement_timestamp()
)
on conflict (user_id) do update
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp();

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values
  (
    (select id from sec_rpc_002_ids where key = 'org_active'),
    'd1910000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  ),
  (
    (select id from sec_rpc_002_ids where key = 'org_suspended'),
    'd1910000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  );

insert into sec_rpc_002_ids (key, id)
select 'foreign_site', inserted.id
from (
  insert into public.organisation_units (
    organisation_id,
    code,
    name,
    unit_type
  )
  values (
    (select id from sec_rpc_002_ids where key = 'org_foreign'),
    'foreign-site',
    'Foreign Site',
    'site'
  )
  returning id
) inserted;

update public.organisations
set status = 'provisioning',
    status_reason = null,
    status_changed_at = statement_timestamp(),
    version = version + 1
where id in (
  select id from sec_rpc_002_ids where key in ('org_provisioning', 'org_suspended')
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from sec_rpc_002_ids where key = 'org_active'),
    'fake',
    'cus_sec_rpc_002_active',
    'sub_sec_rpc_002_active',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-30 08:00:00+00'
  ),
  'applied',
  'active organisation receives a paid snapshot'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from sec_rpc_002_ids where key = 'org_suspended'),
    'fake',
    'cus_sec_rpc_002_suspended',
    'sub_sec_rpc_002_suspended',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-30 08:10:00+00'
  ),
  'applied',
  'suspended organisation starts from a paid snapshot'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from sec_rpc_002_ids where key = 'org_suspended'),
    'fake',
    'cus_sec_rpc_002_suspended',
    'sub_sec_rpc_002_suspended',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'past_due',
    'past_due',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-30 08:20:00+00',
    timestamptz '2026-09-01 00:00:00+00'
  ),
  'applied',
  'expired grace suspends the billed organisation'
);

select is(
  (
    select organisation.status
    from public.organisations organisation
    where organisation.id = (select id from sec_rpc_002_ids where key = 'org_suspended')
  ),
  'suspended',
  'suspended organisation remains closed for operational membership'
);

-- ---------------------------------------------------------------------------
-- Privilege catalog
-- ---------------------------------------------------------------------------

select ok(
  (
    select bool_and(not p.prosecdef)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
      ('public', 'get_current_organisation_billing'),
      ('public', 'record_leanai_semantic_event'),
      ('public', 'get_leanai_journey_context'),
      ('public', 'get_organisation_setup_readiness'),
      ('public', 'get_leanai_contextual_snapshot')
    )
  ),
  'public billing and LeanAI APIs are SECURITY INVOKER'
);

select ok(
  (
    select bool_and(p.proconfig = array['search_path=""']::text[])
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
      ('public', 'get_current_organisation_billing'),
      ('public', 'record_leanai_semantic_event'),
      ('public', 'get_leanai_journey_context'),
      ('public', 'get_organisation_setup_readiness'),
      ('public', 'get_leanai_contextual_snapshot'),
      ('private', 'get_current_organisation_billing'),
      ('private', 'record_leanai_semantic_event'),
      ('private', 'get_leanai_journey_context'),
      ('private', 'evaluate_organisation_setup_readiness'),
      ('private', 'get_leanai_contextual_snapshot')
    )
  ),
  'public wrappers and private helpers pin search_path to empty'
);

select ok(
  (
    select bool_and(p.prosecdef)
      and bool_and(pg_catalog.pg_get_userbyid(p.proowner) = 'lean_hub_private_owner')
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
      ('private', 'get_current_organisation_billing'),
      ('private', 'record_leanai_semantic_event'),
      ('private', 'get_leanai_journey_context'),
      ('private', 'evaluate_organisation_setup_readiness'),
      ('private', 'get_leanai_contextual_snapshot')
    )
  ),
  'private helpers remain SECURITY DEFINER owned by lean_hub_private_owner'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.get_current_organisation_billing()', 'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.record_leanai_semantic_event(text,integer,text,text,uuid,jsonb,timestamp with time zone)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated', 'public.get_leanai_journey_context()', 'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated', 'public.get_organisation_setup_readiness()', 'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated', 'public.get_leanai_contextual_snapshot()', 'EXECUTE'
  ),
  'authenticated retains EXECUTE on the five public APIs'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon', 'public.get_current_organisation_billing()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.record_leanai_semantic_event(text,integer,text,text,uuid,jsonb,timestamp with time zone)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'public.get_leanai_journey_context()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'public.get_organisation_setup_readiness()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'public.get_leanai_contextual_snapshot()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'public', 'public.get_current_organisation_billing()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'public',
    'public.record_leanai_semantic_event(text,integer,text,text,uuid,jsonb,timestamp with time zone)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'public', 'public.get_leanai_journey_context()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'public', 'public.get_organisation_setup_readiness()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'public', 'public.get_leanai_contextual_snapshot()', 'EXECUTE'
  ),
  'anon and PUBLIC cannot execute the five public APIs'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon', 'private.get_current_organisation_billing()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'private.record_leanai_semantic_event(text,integer,text,text,uuid,jsonb,timestamp with time zone)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'private.get_leanai_journey_context()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'private.evaluate_organisation_setup_readiness()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'private.get_leanai_contextual_snapshot()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'public', 'private.get_current_organisation_billing()', 'EXECUTE'
  ),
  'anonymous callers cannot execute private billing or LeanAI helpers'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'private.get_current_organisation_billing()', 'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'private.record_leanai_semantic_event(text,integer,text,text,uuid,jsonb,timestamp with time zone)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated', 'private.get_leanai_journey_context()', 'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated', 'private.evaluate_organisation_setup_readiness()', 'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated', 'private.get_leanai_contextual_snapshot()', 'EXECUTE'
  ),
  'authenticated has narrow EXECUTE on private helpers required by SECURITY INVOKER wrappers'
);

select ok(
  (
    select coalesce(
      (
        select replace(cfg, 'pgrst.db_schemas=', '')
        from (
          select unnest(role_row.rolconfig) as cfg
          from pg_catalog.pg_roles role_row
          where role_row.rolname = 'authenticator'
        ) settings
        where cfg like 'pgrst.db_schemas=%'
        limit 1
      ),
      'public'
    )
  ) !~ '(^|[, ])private([, ]|$)',
  'private schema is not in PostgREST exposed schemas'
);

-- ---------------------------------------------------------------------------
-- Anonymous execution
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.get_current_organisation_billing()$$,
  '42501',
  null,
  'anonymous callers cannot execute billing RPC'
);

select throws_ok(
  $$select public.record_leanai_semantic_event('module.opened', 1, 'maturity')$$,
  '42501',
  null,
  'anonymous callers cannot record LeanAI semantic events'
);

select throws_ok(
  $$select public.get_leanai_journey_context()$$,
  '42501',
  null,
  'anonymous callers cannot read LeanAI journey context'
);

select throws_ok(
  $$select public.get_organisation_setup_readiness()$$,
  '42501',
  null,
  'anonymous callers cannot read setup readiness'
);

select throws_ok(
  $$select public.get_leanai_contextual_snapshot()$$,
  '42501',
  null,
  'anonymous callers cannot read the contextual snapshot'
);

reset role;

-- ---------------------------------------------------------------------------
-- Billing lifecycle reads
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"d1910000-0000-4000-8000-000000000001","role":"authenticated","session_id":"d1911000-0000-4000-8000-000000000001","email":"sec-rpc-002-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_provisioning')),
  'owner can select a provisioning organisation'
);

select is(
  (
    select billing.organisation_status
    from public.get_current_organisation_billing() billing
  ),
  'provisioning',
  'provisioning owner can read billing state required for Checkout and onboarding'
);

select ok(
  public.current_can_manage_billing(),
  'provisioning owner retains billing management'
);

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_active')),
  'owner can select the active organisation'
);

select is(
  (
    select billing.billing_state
    from public.get_current_organisation_billing() billing
  ),
  'active',
  'active billing admin can read current billing state'
);

select is(
  (
    select billing.organisation_id
    from public.get_current_organisation_billing() billing
  ),
  (select id from sec_rpc_002_ids where key = 'org_active'),
  'active billing read is scoped to the selected organisation'
);

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_suspended')),
  'owner can select a suspended organisation'
);

select is(
  (
    select billing.organisation_status
    from public.get_current_organisation_billing() billing
  ),
  'suspended',
  'suspended billing-authorised owner can read recovery billing state'
);

select ok(
  public.current_can_manage_billing(),
  'suspended owner retains billing management for portal recovery'
);

select ok(
  private.current_membership_id(
    (select id from sec_rpc_002_ids where key = 'org_suspended')
  ) is null,
  'operational membership stays closed on the suspended organisation'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1910000-0000-4000-8000-000000000002","role":"authenticated","session_id":"d1911000-0000-4000-8000-000000000002","email":"sec-rpc-002-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_active')),
  'ordinary member can select the active organisation'
);

select ok(
  not public.current_can_manage_billing(),
  'ordinary member cannot manage billing'
);

select is(
  (
    select billing.organisation_id
    from public.get_current_organisation_billing() billing
  ),
  (select id from sec_rpc_002_ids where key = 'org_active'),
  'ordinary member billing read cannot leave the selected organisation'
);

select is(
  (
    select count(*)
    from public.get_current_organisation_billing() billing
    where billing.organisation_id = (select id from sec_rpc_002_ids where key = 'org_foreign')
  ),
  0::bigint,
  'ordinary member cannot read the foreign organisation billing row'
);

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_suspended')),
  'ordinary member can select the suspended organisation'
);

select ok(
  not public.current_can_manage_billing(),
  'ordinary suspended member cannot open Customer Portal management'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1910000-0000-4000-8000-000000000003","role":"authenticated","session_id":"d1911000-0000-4000-8000-000000000003","email":"sec-rpc-002-foreign@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_foreign')),
  'foreign owner selects their own organisation'
);

select is(
  (
    select count(*)
    from public.get_current_organisation_billing() billing
    where billing.organisation_id in (
      select id from sec_rpc_002_ids where key in ('org_active', 'org_provisioning', 'org_suspended')
    )
  ),
  0::bigint,
  'foreign organisation billing read cannot see another tenant'
);

-- ---------------------------------------------------------------------------
-- LeanAI tenant isolation through the INVOKER wrappers
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1910000-0000-4000-8000-000000000001","role":"authenticated","session_id":"d1911000-0000-4000-8000-000000000001","email":"sec-rpc-002-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_active')),
  'owner reselects the active organisation for LeanAI'
);

insert into sec_rpc_002_ids (key, id)
select 'event_active', public.record_leanai_semantic_event(
  'module.opened',
  1,
  'maturity',
  null,
  null,
  '{}'::jsonb,
  null
);

select is(
  public.get_leanai_journey_context() ->> 'recent_module_key',
  'maturity',
  'journey context is scoped to the current organisation and membership'
);

select is(
  public.get_organisation_setup_readiness() ->> 'organisation_id',
  (select id::text from sec_rpc_002_ids where key = 'org_active'),
  'setup readiness is scoped to the current organisation'
);

select is(
  public.get_leanai_contextual_snapshot() ->> 'proactive_assistance_enabled',
  'true',
  'contextual snapshot still exposes proactive assistance without a new public DEFINER'
);

select throws_ok(
  $$select public.record_leanai_semantic_event('dom.click')$$,
  '23514',
  'leanai event key is not in the bounded taxonomy',
  'bounded event taxonomy is preserved'
);

select throws_ok(
  format(
    $$select public.record_leanai_semantic_event(
      'module.opened', 1, 'maturity', null, %L::uuid, '{}'::jsonb, null
    )$$,
    (select id from sec_rpc_002_ids where key = 'foreign_site')
  ),
  '42501',
  'leanai event site is not in the current organisation',
  'foreign site context is rejected'
);

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_provisioning')),
  'same identity switches to the provisioning organisation'
);

select is(
  public.get_leanai_journey_context() ->> 'recent_module_key',
  null,
  'same identity switching organisations receives isolated journey state'
);

select is(
  public.get_organisation_setup_readiness() ->> 'organisation_id',
  (select id::text from sec_rpc_002_ids where key = 'org_provisioning'),
  'same identity switching organisations receives isolated readiness'
);

select is(
  public.get_leanai_contextual_snapshot() -> 'journey' ->> 'organisation_id',
  (select id::text from sec_rpc_002_ids where key = 'org_provisioning'),
  'contextual snapshot stays on the current organisation after switch'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1910000-0000-4000-8000-000000000003","role":"authenticated","session_id":"d1911000-0000-4000-8000-000000000003","email":"sec-rpc-002-foreign@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_rpc_002_ids where key = 'org_foreign')),
  'foreign owner reselects their organisation for LeanAI denial'
);

select is(
  (
    select count(*)
    from public.leanai_semantic_events
    where id = (select id from sec_rpc_002_ids where key = 'event_active')
  ),
  0::bigint,
  'foreign organisation cannot read another tenant semantic event'
);

select is(
  public.get_leanai_journey_context() ->> 'recent_module_key',
  null,
  'foreign organisation journey context does not leak the other tenant'
);

select * from finish();

rollback;
