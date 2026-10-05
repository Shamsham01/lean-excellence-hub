begin;

select plan(48);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'f1940000-0000-4000-8000-000000000001',
    'sec-billing-002-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f1940000-0000-4000-8000-000000000002',
    'sec-billing-002-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f1940000-0000-4000-8000-000000000003',
    'sec-billing-002-foreign@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table sec_billing_002_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on sec_billing_002_ids to authenticated, anon;

insert into sec_billing_002_ids (key, id)
values
  (
    'org_active',
    private.provision_organisation(
      'f1940000-0000-4000-8000-000000000001',
      'sec-billing-002-active',
      'SEC BILLING 002 Active'
    )
  ),
  (
    'org_provisioning',
    private.provision_organisation(
      'f1940000-0000-4000-8000-000000000001',
      'sec-billing-002-provisioning',
      'SEC BILLING 002 Provisioning'
    )
  ),
  (
    'org_suspended',
    private.provision_organisation(
      'f1940000-0000-4000-8000-000000000001',
      'sec-billing-002-suspended',
      'SEC BILLING 002 Suspended'
    )
  ),
  (
    'org_foreign',
    private.provision_organisation(
      'f1940000-0000-4000-8000-000000000003',
      'sec-billing-002-foreign',
      'SEC BILLING 002 Foreign'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'f1941000-0000-4000-8000-000000000001',
    'f1940000-0000-4000-8000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f1941000-0000-4000-8000-000000000002',
    'f1940000-0000-4000-8000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f1941000-0000-4000-8000-000000000003',
    'f1940000-0000-4000-8000-000000000003',
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
  'f1940000-0000-4000-8000-000000000002',
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
    (select id from sec_billing_002_ids where key = 'org_active'),
    'f1940000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  ),
  (
    (select id from sec_billing_002_ids where key = 'org_suspended'),
    'f1940000-0000-4000-8000-000000000002',
    'active',
    statement_timestamp()
  );

update public.organisations
set status = 'provisioning',
    status_reason = null,
    status_changed_at = statement_timestamp(),
    version = version + 1
where id in (
  select id from sec_billing_002_ids where key in ('org_provisioning', 'org_suspended')
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from sec_billing_002_ids where key = 'org_active'),
    'fake',
    'cus_sec_billing_002_active',
    'sub_sec_billing_002_active',
    'professional',
    'monthly',
    2,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-10-05 08:00:00+00'
  ),
  'applied',
  'active organisation receives a paid snapshot'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from sec_billing_002_ids where key = 'org_suspended'),
    'fake',
    'cus_sec_billing_002_suspended',
    'sub_sec_billing_002_suspended',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-10-05 08:10:00+00'
  ),
  'applied',
  'suspended organisation starts from a paid snapshot'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from sec_billing_002_ids where key = 'org_suspended'),
    'fake',
    'cus_sec_billing_002_suspended',
    'sub_sec_billing_002_suspended',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'past_due',
    'past_due',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-10-05 08:20:00+00',
    timestamptz '2026-09-01 00:00:00+00'
  ),
  'applied',
  'expired grace suspends the billed organisation'
);

select lives_ok(
  format(
    'select public.ensure_organisation_billing_account(%L::uuid, %L, %L)',
    (select id from sec_billing_002_ids where key = 'org_provisioning'),
    'fake',
    'cus_sec_billing_002_provisioning'
  ),
  'provisioning organisation can persist a billing customer before Checkout'
);

update public.organisation_billing_accounts
set open_checkout_session_id = 'cs_sec_billing_002_active'
where organisation_id = (select id from sec_billing_002_ids where key = 'org_active');

update public.organisation_billing_accounts
set open_checkout_session_id = 'cs_sec_billing_002_provisioning'
where organisation_id = (
  select id from sec_billing_002_ids where key = 'org_provisioning'
);

update public.organisation_billing_accounts
set open_checkout_session_id = 'cs_sec_billing_002_suspended'
where organisation_id = (
  select id from sec_billing_002_ids where key = 'org_suspended'
);

select lives_ok(
  format(
    'select public.ensure_organisation_billing_account(%L::uuid, %L, %L)',
    (select id from sec_billing_002_ids where key = 'org_foreign'),
    'fake',
    'cus_sec_billing_002_foreign'
  ),
  'foreign organisation can persist a distinct billing customer'
);

update public.organisation_billing_accounts
set open_checkout_session_id = 'cs_sec_billing_002_foreign'
where organisation_id = (select id from sec_billing_002_ids where key = 'org_foreign');

-- ---------------------------------------------------------------------------
-- Privilege catalog and webhook grant freeze
-- ---------------------------------------------------------------------------

select ok(
  (
    select bool_and(not p.prosecdef)
      and bool_and(p.proconfig = array['search_path=""']::text[])
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
      ('public', 'get_current_organisation_billing'),
      ('public', 'get_current_organisation_billing_management')
    )
  ),
  'member-safe and billing-management APIs are SECURITY INVOKER with empty search_path'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.get_current_organisation_billing()', 'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_current_organisation_billing_management()',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'public.get_current_organisation_billing()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'public.get_current_organisation_billing_management()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'public', 'public.get_current_organisation_billing()', 'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'public', 'public.get_current_organisation_billing_management()', 'EXECUTE'
  ),
  'only authenticated may execute the public billing read APIs'
);

select ok(
  (
    select p.proargnames @> array[
      'plan_code',
      'billing_state',
      'organisation_status',
      'current_period_end',
      'site_quantity',
      'intended_site_quantity',
      'has_open_checkout',
      'grace_expires_at'
    ]::text[]
      and not p.proargnames @> array['provider_customer_id']::text[]
      and not p.proargnames @> array['open_checkout_session_id']::text[]
      and not p.proargnames @> array['provider']::text[]
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_current_organisation_billing'
  ),
  'member billing RPC advertises generic subscription fields and omits provider identifiers'
);

select ok(
  (
    select p.proargnames @> array[
      'provider_customer_id',
      'open_checkout_session_id',
      'provider',
      'plan_code'
    ]::text[]
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_current_organisation_billing_management'
  ),
  'billing-management RPC retains provider customer and Checkout identifiers'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_billing_webhook_event(text,text,text,uuid,jsonb)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_billing_webhook_event(text,text,text,uuid,jsonb)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.claim_billing_webhook_event(text,text,text,uuid,jsonb)',
    'EXECUTE'
  ),
  'Stripe webhook claim grants remain service_role-only'
);

set local role anon;

select throws_ok(
  $$select public.get_current_organisation_billing()$$,
  '42501',
  null,
  'anonymous callers cannot execute the member billing RPC'
);

select throws_ok(
  $$select public.get_current_organisation_billing_management()$$,
  '42501',
  null,
  'anonymous callers cannot execute the billing-management RPC'
);

reset role;

-- ---------------------------------------------------------------------------
-- Billing-authorised owner: provisioning, active, suspended, two-org isolation
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"f1940000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f1941000-0000-4000-8000-000000000001","email":"sec-billing-002-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from sec_billing_002_ids where key = 'org_provisioning')
  ),
  'owner can select a provisioning organisation'
);

select is(
  (
    select billing.organisation_status
    from public.get_current_organisation_billing() billing
  ),
  'provisioning',
  'provisioning owner can read generic billing state required for onboarding'
);

select ok(
  (
    select billing.has_open_checkout
    from public.get_current_organisation_billing() billing
  ),
  'provisioning owner can see that Checkout is in progress without receiving the session id'
);

select ok(
  (
    select not (to_jsonb(billing) ? 'provider_customer_id')
      and not (to_jsonb(billing) ? 'open_checkout_session_id')
      and not (to_jsonb(billing) ? 'provider')
    from public.get_current_organisation_billing() billing
  ),
  'member billing row JSON does not contain provider identifiers'
);

select throws_ok(
  $$select provider_customer_id from public.get_current_organisation_billing()$$,
  '42703',
  null,
  'member billing RPC cannot select provider_customer_id'
);

select throws_ok(
  $$select open_checkout_session_id from public.get_current_organisation_billing()$$,
  '42703',
  null,
  'member billing RPC cannot select open_checkout_session_id'
);

select is(
  (
    select billing.provider_customer_id
    from public.get_current_organisation_billing_management() billing
  ),
  'cus_sec_billing_002_provisioning',
  'billing-authorised owner can read the provisioning provider customer id'
);

select is(
  (
    select billing.open_checkout_session_id
    from public.get_current_organisation_billing_management() billing
  ),
  'cs_sec_billing_002_provisioning',
  'billing-authorised owner can read open Checkout context for recovery'
);

select ok(
  public.current_can_manage_billing(),
  'provisioning owner retains billing management for Checkout'
);

select ok(
  public.switch_organisation(
    (select id from sec_billing_002_ids where key = 'org_active')
  ),
  'owner can select the active organisation'
);

select is(
  (
    select billing.billing_state
    from public.get_current_organisation_billing() billing
  ),
  'active',
  'active lifecycle still exposes generic subscription state'
);

select is(
  (
    select billing.plan_code
    from public.get_current_organisation_billing() billing
  ),
  'professional',
  'ordinary and billing-authorised members can read the current plan'
);

select is(
  (
    select billing.organisation_id
    from public.get_current_organisation_billing() billing
  ),
  (select id from sec_billing_002_ids where key = 'org_active'),
  'active billing read is scoped to the selected organisation'
);

select is(
  (
    select billing.provider_customer_id
    from public.get_current_organisation_billing_management() billing
  ),
  'cus_sec_billing_002_active',
  'switching organisations does not leak the previous provider customer id'
);

select is(
  (
    select billing.open_checkout_session_id
    from public.get_current_organisation_billing_management() billing
  ),
  'cs_sec_billing_002_active',
  'switching organisations does not leak the previous Checkout session id'
);

select is(
  (
    select count(*)
    from public.get_current_organisation_billing_management() billing
    where billing.organisation_id in (
      select id from sec_billing_002_ids
      where key in ('org_provisioning', 'org_suspended', 'org_foreign')
    )
  ),
  0::bigint,
  'billing-management read cannot leave the selected organisation'
);

select ok(
  public.switch_organisation(
    (select id from sec_billing_002_ids where key = 'org_suspended')
  ),
  'owner can select a suspended organisation'
);

select is(
  (
    select billing.organisation_status
    from public.get_current_organisation_billing() billing
  ),
  'suspended',
  'suspended recovery still exposes generic subscription information'
);

select ok(
  public.current_can_manage_billing(),
  'suspended owner retains billing management for Customer Portal recovery'
);

select is(
  (
    select billing.provider_customer_id
    from public.get_current_organisation_billing_management() billing
  ),
  'cus_sec_billing_002_suspended',
  'billing-authorised owner can read the suspended organisation customer id'
);

select ok(
  public.switch_organisation(
    (select id from sec_billing_002_ids where key = 'org_active')
  ),
  'owner can reselect the active organisation after recovery'
);

select is(
  (
    select billing.provider_customer_id
    from public.get_current_organisation_billing_management() billing
  ),
  'cus_sec_billing_002_active',
  'same user belonging to two organisations cannot leak billing identifiers across tenants'
);

reset role;

-- ---------------------------------------------------------------------------
-- Ordinary lifecycle member
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"f1940000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1941000-0000-4000-8000-000000000002","email":"sec-billing-002-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from sec_billing_002_ids where key = 'org_active')
  ),
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
  (select id from sec_billing_002_ids where key = 'org_active'),
  'ordinary member billing read cannot leave the selected organisation'
);

select is(
  (
    select billing.plan_code || ':' || billing.billing_state
    from public.get_current_organisation_billing() billing
  ),
  'professional:active',
  'ordinary member can retrieve generic subscription information'
);

select ok(
  (
    select not (to_jsonb(billing) ? 'provider_customer_id')
      and not (to_jsonb(billing) ? 'open_checkout_session_id')
      and not (to_jsonb(billing) ? 'provider')
      and billing.has_open_checkout
    from public.get_current_organisation_billing() billing
  ),
  'ordinary member cannot retrieve provider identifiers from the member billing RPC'
);

select is(
  (
    select count(*)
    from public.get_current_organisation_billing_management()
  ),
  0::bigint,
  'ordinary member cannot retrieve billing-management provider identifiers'
);

select is(
  (
    select count(*)
    from public.get_current_organisation_billing() billing
    where billing.organisation_id = (
      select id from sec_billing_002_ids where key = 'org_foreign'
    )
  ),
  0::bigint,
  'ordinary member cannot read the foreign organisation billing row'
);

select ok(
  public.switch_organisation(
    (select id from sec_billing_002_ids where key = 'org_suspended')
  ),
  'ordinary member can select the suspended organisation'
);

select ok(
  not public.current_can_manage_billing(),
  'ordinary suspended member cannot open Customer Portal management'
);

select is(
  (
    select billing.organisation_status
    from public.get_current_organisation_billing() billing
  ),
  'suspended',
  'ordinary suspended member can still read generic recovery billing state'
);

select is(
  (
    select count(*)
    from public.get_current_organisation_billing_management()
  ),
  0::bigint,
  'ordinary suspended member cannot retrieve provider customer or Checkout identifiers'
);

reset role;

-- ---------------------------------------------------------------------------
-- Foreign organisation isolation
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"f1940000-0000-4000-8000-000000000003","role":"authenticated","session_id":"f1941000-0000-4000-8000-000000000003","email":"sec-billing-002-foreign@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from sec_billing_002_ids where key = 'org_foreign')
  ),
  'foreign owner selects their own organisation'
);

select is(
  (
    select count(*)
    from public.get_current_organisation_billing() billing
    where billing.organisation_id in (
      select id from sec_billing_002_ids
      where key in ('org_active', 'org_provisioning', 'org_suspended')
    )
  ),
  0::bigint,
  'foreign organisation member billing read cannot see another tenant'
);

select is(
  (
    select count(*)
    from public.get_current_organisation_billing_management() billing
    where billing.provider_customer_id in (
      'cus_sec_billing_002_active',
      'cus_sec_billing_002_provisioning',
      'cus_sec_billing_002_suspended'
    )
      or billing.open_checkout_session_id in (
        'cs_sec_billing_002_active',
        'cs_sec_billing_002_provisioning',
        'cs_sec_billing_002_suspended'
      )
  ),
  0::bigint,
  'foreign organisation billing-management read cannot leak another tenant'
);

select * from finish();

rollback;
