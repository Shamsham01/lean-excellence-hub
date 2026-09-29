begin;

select plan(18);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'billing-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'billing-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table billing_core_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on billing_core_ids to authenticated, anon;

insert into billing_core_ids (key, id)
values (
  'organisation_a',
  private.provision_organisation(
    'a1000000-0000-4000-8000-000000000001',
    'billing-core-a',
    'Billing Core A'
  )
);

insert into billing_core_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'a1000000-0000-4000-8000-000000000002',
    'billing-core-b',
    'Billing Core B'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

select ok(
  (select grace_period_days from public.billing_runtime_policy where id) = 7
  and (select retention_days from public.billing_runtime_policy where id) = 90,
  'billing runtime policy defaults to 7-day grace and 90-day retention'
);

select lives_ok(
  format(
    'select public.ensure_organisation_billing_account(%L::uuid, %L, %L)',
    (select id from billing_core_ids where key = 'organisation_a'),
    'fake',
    'cus_fake_org_a'
  ),
  'service path can create a billing account'
);

select throws_ok(
  format(
    'select public.ensure_organisation_billing_account(%L::uuid, %L, %L)',
    (select id from billing_core_ids where key = 'organisation_b'),
    'fake',
    'cus_fake_org_a'
  ),
  '42501',
  'billing customer is already bound to another organisation',
  'foreign customer id cannot bind to another organisation'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_core_ids where key = 'organisation_a'),
    'fake',
    'cus_fake_org_a',
    'sub_fake_org_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'active',
    'active',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 12:00:00+00'
  ),
  'applied',
  'first subscription snapshot applies'
);

select throws_ok(
  format(
    $sql$
      select public.apply_organisation_subscription_snapshot(
        %L::uuid, 'fake', 'cus_fake_org_a', 'sub_fake_org_a',
        'professional', 'monthly', 1, 'price_fake_professional_monthly',
        'active', 'active', statement_timestamp(),
        statement_timestamp() + interval '30 days', false,
        timestamptz '2026-09-29 13:00:00+00'
      )
    $sql$,
    (select id from billing_core_ids where key = 'organisation_b')
  ),
  '42501',
  'billing customer does not belong to this organisation',
  'foreign organisation cannot claim another customer subscription'
);

select is(
  public.apply_organisation_subscription_snapshot(
    (select id from billing_core_ids where key = 'organisation_a'),
    'fake',
    'cus_fake_org_a',
    'sub_fake_org_a',
    'professional',
    'monthly',
    1,
    'price_fake_professional_monthly',
    'canceled',
    'ended',
    statement_timestamp(),
    statement_timestamp() + interval '30 days',
    false,
    timestamptz '2026-09-29 11:00:00+00'
  ),
  'ignored_out_of_order',
  'older ended snapshot does not regress an active subscription'
);

select is(
  (
    select subscription.billing_state
    from public.organisation_subscriptions subscription
    where subscription.organisation_id = (
      select id from billing_core_ids where key = 'organisation_a'
    )
  ),
  'active',
  'active billing state is preserved after out-of-order event'
);

insert into billing_core_ids (key, id)
select 'webhook_first', event_id
from public.claim_billing_webhook_event(
  'fake',
  'evt_fake_1',
  'customer.subscription.created',
  (select id from billing_core_ids where key = 'organisation_a'),
  '{}'::jsonb
);

select ok(
  (
    select claimed.should_process
    from public.claim_billing_webhook_event(
      'fake',
      'evt_fake_1',
      'customer.subscription.created',
      (select id from billing_core_ids where key = 'organisation_a'),
      '{}'::jsonb
    ) claimed
  ) = false,
  'duplicate webhook event id does not process again'
);

select ok(
  public.finish_billing_webhook_event(
    (select id from billing_core_ids where key = 'webhook_first'),
    'processed',
    (select id from billing_core_ids where key = 'organisation_a'),
    null,
    '{}'::jsonb
  ),
  'webhook event can be marked processed'
);

select ok(
  (
    select count(*) = 1
    from public.organisation_billing_accounts account
    where account.organisation_id = (
      select id from billing_core_ids where key = 'organisation_a'
    )
  ),
  'one billing account per organisation'
);

select ok(
  (
    select count(*) = 1
    from public.organisation_subscriptions subscription
    where subscription.organisation_id = (
      select id from billing_core_ids where key = 'organisation_a'
    )
  ),
  'one subscription row per organisation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a2000000-0000-4000-8000-000000000001","email":"billing-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from billing_core_ids where key = 'organisation_a')),
  'owner selects organisation A'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from billing_core_ids where key = 'organisation_a'),
    'billing-site-1',
    'Billing Site 1',
    'site'
  ),
  'first paid site can be created'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from billing_core_ids where key = 'organisation_a'),
    'billing-site-2',
    'Billing Site 2',
    'site'
  ),
  '23514',
  'site quantity is already at the paid subscription limit',
  'second site is denied at paid quantity 1'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a2000000-0000-4000-8000-000000000002","email":"billing-owner-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from billing_core_ids where key = 'organisation_b')),
  'owner selects organisation B'
);

select is(
  (
    select count(*)::integer
    from public.organisation_billing_accounts
  ),
  0,
  'authenticated member cannot read another organisation billing account'
);

select is(
  (
    select count(*)::integer
    from public.organisation_subscriptions
  ),
  0,
  'authenticated member cannot read another organisation subscription'
);

select throws_ok(
  format(
    $sql$
      select public.apply_organisation_subscription_snapshot(
        %L::uuid, 'fake', 'cus_org_b', 'sub_org_b', 'professional', 'monthly', 1,
        'price_x', 'active', 'active', statement_timestamp(),
        statement_timestamp() + interval '30 days', false, statement_timestamp()
      )
    $sql$,
    (select id from billing_core_ids where key = 'organisation_b')
  ),
  '42501'
);

select * from finish();

rollback;
