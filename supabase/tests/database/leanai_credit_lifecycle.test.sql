begin;

select plan(4);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b2500000-0000-4000-8000-000000000001',
  'credit@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table credit_ids (key text primary key, id uuid not null) on commit drop;
grant select, insert on credit_ids to authenticated;

insert into credit_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2500000-0000-4000-8000-000000000001',
    'credit-org',
    'Credit Test Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from credit_ids where key = 'organisation'),
  'fake', 'cus_credit', 'sub_credit', 'essentials', 'monthly', 2,
  'price_fake_credit', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 14:10:00+00'
);

insert into public.organisation_ai_settings (
  organisation_id,
  ai_enabled,
  credit_policy_enforced
)
values (
  (select id from credit_ids where key = 'organisation'),
  true,
  true
)
on conflict (organisation_id) do update
set credit_policy_enforced = true,
    ai_enabled = true;

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2510000-0000-4000-8000-000000000001',
  'b2500000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2500000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2510000-0000-4000-8000-000000000001","email":"credit@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation((select id from credit_ids where key = 'organisation')),
  'owner selects organisation for credit test'
);

reset role;

select ok(
  private.ai_credit_try_reserve(
    gen_random_uuid(),
    'credit-test-reserve-1',
    100
  ),
  'reserve succeeds under enforced policy with headroom'
);

select ok(
  private.ai_credit_try_reserve(
    gen_random_uuid(),
    'credit-test-reserve-1',
    100
  ),
  'idempotent reserve by idempotency key'
);

select throws_ok(
  $$
    select private.ai_credit_try_reserve(
      gen_random_uuid(),
      'credit-test-over-allowance',
      1000000
    );
  $$,
  '42501',
  'leanai credit allowance exceeded for this period',
  'reserve rejects over-allowance when enforced'
);

select * from finish();
rollback;
