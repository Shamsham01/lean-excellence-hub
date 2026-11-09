begin;

select plan(11);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2d00000-0000-4000-8000-000000000001',
  'snap@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table snap_ids (key text primary key, id uuid not null) on commit drop;
grant select, insert on snap_ids to authenticated, lean_hub_private_owner;

insert into snap_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2d00000-0000-4000-8000-000000000001',
    'snap-org',
    'Snapshot Org'
  )
);

select public.apply_organisation_subscription_snapshot(
  (select id from snap_ids where key = 'organisation'),
  'fake', 'cus_snap', 'sub_snap', 'essentials', 'monthly', 1,
  'price_fake', 'active', 'active',
  statement_timestamp(), statement_timestamp() + interval '30 days',
  false, timestamptz '2026-11-08 22:00:00+00'
);

insert into public.organisation_ai_settings (
  organisation_id, ai_enabled, credit_policy_enforced
)
values (
  (select id from snap_ids where key = 'organisation'),
  true,
  true
)
on conflict (organisation_id) do update set credit_policy_enforced = true;

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2d01000-0000-4000-8000-000000000001',
  'b2d00000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2d00000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2d01000-0000-4000-8000-000000000001"}',
  true
);
select ok(
  public.switch_organisation((select id from snap_ids where key = 'organisation')),
  'org for snapshot settle'
);

reset role;

select ok(
  private.leanai_ai_run_try_reserve(
    (select id from snap_ids where key = 'organisation'),
    'b2d02000-0000-4000-8000-000000000001'::uuid,
    'snap-settle-1',
    'fake',
    'fake-model',
    'probe'
  ),
  'reserve captures rate snapshot'
);

select ok(
  (select rate_snapshot is not null
   from public.organisation_ai_credit_reservations
   where ai_run_id = 'b2d02000-0000-4000-8000-000000000001'::uuid),
  'reservation stores snapshot json'
);

set local role postgres;

update private.leanai_provider_rate_cards
set
  input_micro_per_million = 9_999_999_999,
  enforceable_for_billing = false
where provider = 'fake' and model = 'fake-model';

select set_config(
  'request.jwt.claims',
  '{"sub":"b2d00000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2d01000-0000-4000-8000-000000000001"}',
  true
);
set local role lean_hub_private_owner;

select lives_ok(
  $$ select private.ai_credit_settle_from_run_usage(
    'b2d02000-0000-4000-8000-000000000001'::uuid,
    1_000_000,
    0,
    0,
    0
  ) $$,
  'settle uses reservation snapshot after live card mutation'
);

select cmp_ok(
  (select actual_provider_credits
   from public.organisation_ai_credit_reservations
   where ai_run_id = 'b2d02000-0000-4000-8000-000000000001'::uuid),
  '<',
  100000::bigint,
  'actual credits reflect reserved snapshot not mutated live card'
);

set local role postgres;

update private.leanai_provider_rate_cards
set enforceable_for_billing = true, input_micro_per_million = 500_000
where provider = 'fake' and model = 'fake-model';

set local role authenticated;
select public.switch_organisation((select id from snap_ids where key = 'organisation'));
reset role;

select ok(
  private.leanai_ai_run_try_reserve(
    (select id from snap_ids where key = 'organisation'),
    'b2d02000-0000-4000-8000-000000000002'::uuid,
    'snap-off-1',
    'fake',
    'fake-model',
    'x'
  ),
  'reserve second run before policy flip'
);

update public.organisation_ai_settings
set credit_policy_enforced = false
where organisation_id = (select id from snap_ids where key = 'organisation');

select lives_ok(
  $$ select private.ai_credit_settle_from_run_usage(
    'b2d02000-0000-4000-8000-000000000002'::uuid,
    10_000,
    10_000,
    0,
    0
  ) $$,
  'policy off settle records actual and releases'
);

select ok(
  (select actual_provider_credits > 0
   from public.organisation_ai_credit_reservations
   where ai_run_id = 'b2d02000-0000-4000-8000-000000000002'::uuid),
  'policy off preserves measurable actual_provider_credits'
);

update public.organisation_ai_settings
set credit_policy_enforced = true
where organisation_id = (select id from snap_ids where key = 'organisation');

set local role authenticated;
select public.switch_organisation((select id from snap_ids where key = 'organisation'));
reset role;

select ok(
  private.leanai_ai_run_try_reserve(
    (select id from snap_ids where key = 'organisation'),
    'b2d02000-0000-4000-8000-000000000003'::uuid,
    'snap-null-2',
    'fake',
    'fake-model',
    'z'
  ),
  'reserve for missing-snapshot case'
);

update public.organisation_ai_credit_reservations
set rate_snapshot = null
where ai_run_id = 'b2d02000-0000-4000-8000-000000000003'::uuid;

select lives_ok(
  $$ select private.ai_credit_settle_from_run_usage(
    'b2d02000-0000-4000-8000-000000000003'::uuid,
    100,
    100,
    0,
    0
  ) $$,
  'missing snapshot does not invent costs'
);

select is(
  (select status from public.organisation_ai_credit_reservations
   where ai_run_id = 'b2d02000-0000-4000-8000-000000000003'::uuid),
  'released',
  'missing snapshot releases hold'
);

select finish();
rollback;
