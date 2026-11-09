begin;

select plan(4);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2900000-0000-4000-8000-000000000001',
  'cost-credit@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table cost_ids (key text primary key, id uuid not null) on commit drop;
grant select, insert on cost_ids to authenticated, lean_hub_private_owner;

insert into cost_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2900000-0000-4000-8000-000000000001',
    'cost-credit-org',
    'Cost Credit Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from cost_ids where key = 'organisation'),
  'fake', 'cus_cc', 'sub_cc', 'professional', 'monthly', 1,
  'price_fake', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 16:00:00+00'
);

insert into public.organisation_ai_settings (
  organisation_id, ai_enabled, credit_policy_enforced
)
values (
  (select id from cost_ids where key = 'organisation'),
  true,
  true
)
on conflict (organisation_id) do update set credit_policy_enforced = true;

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2910000-0000-4000-8000-000000000001',
  'b2900000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

set local role lean_hub_private_owner;

select ok(
  private.leanai_ai_run_reserve_upper_bound(
    (select id from cost_ids where key = 'organisation'),
    'fake',
    'fake-model',
    'hello world'
  ) >= 1,
  'reserve upper bound uses configured maxima not single token'
);

select throws_ok(
  $$
    select private.leanai_ai_run_reserve_upper_bound(
      (select id from cost_ids where key = 'organisation'),
      'unknown-vendor',
      'unknown-model',
      'hello'
    );
  $$,
  '22023',
  'leanai provider rate card is unknown or not enforceable; cannot reserve cost credits',
  'enforced org fails closed on unknown rate at reserve'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2900000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2910000-0000-4000-8000-000000000001"}',
  true
);
select ok(
  public.switch_organisation((select id from cost_ids where key = 'organisation')),
  'authenticated org context for start_ai_run admission path'
);

set local role lean_hub_private_owner;

select ok(
  private.leanai_ai_run_try_reserve(
    (select id from cost_ids where key = 'organisation'),
    gen_random_uuid(),
    'cost-admit-1',
    'fake',
    'fake-model',
    'short prompt'
  ),
  'try_reserve succeeds with provisional fake rate card after org context'
);

select * from finish();
rollback;
