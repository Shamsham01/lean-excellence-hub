begin;

select plan(3);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2800000-0000-4000-8000-000000000001',
  'credit-a@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table iso_ids (key text primary key, id uuid not null) on commit drop;
grant select on iso_ids to authenticated;

insert into iso_ids (key, id) values
('org_a', private.provision_organisation('b2800000-0000-4000-8000-000000000001', 'credit-a', 'Credit A')),
('org_b', private.provision_organisation('b2800000-0000-4000-8000-000000000001', 'credit-b', 'Credit B'));

select public.apply_organisation_subscription_snapshot(
  (select id from iso_ids where key = 'org_a'), 'fake','cus_a','sub_a','essentials','monthly',1,
  'price_a','active','active', statement_timestamp(), statement_timestamp() + interval '30 days', false, timestamptz '2026-11-09 00:00:00+00');
select public.apply_organisation_subscription_snapshot(
  (select id from iso_ids where key = 'org_b'), 'fake','cus_b','sub_b','essentials','monthly',1,
  'price_b','active','active', statement_timestamp(), statement_timestamp() + interval '30 days', false, timestamptz '2026-11-09 00:00:00+00');

insert into public.organisation_ai_settings (organisation_id, ai_enabled, credit_policy_enforced)
select id, true, true from iso_ids;

insert into auth.sessions (id, user_id, created_at, updated_at)
values ('b2810000-0000-4000-8000-000000000001', 'b2800000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp());

select set_config(
  'request.jwt.claims',
  '{"sub":"b2800000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b2810000-0000-4000-8000-000000000001","email":"credit-a@example.test"}',
  true
);
set local role authenticated;
select ok(public.switch_organisation((select id from iso_ids where key = 'org_a')), 'org a context');

reset role;

select ok(
  private.ai_credit_try_reserve('b2820000-0000-4000-8000-000000000001'::uuid, 'iso-reserve-a', 100),
  'org a reserve under session'
);

select ok(
  (select count(*) from public.organisation_ai_credit_reservations
   where organisation_id = (select id from iso_ids where key = 'org_b')) = 0,
  'org b has no reservations from org a session'
);

select * from finish();
rollback;
