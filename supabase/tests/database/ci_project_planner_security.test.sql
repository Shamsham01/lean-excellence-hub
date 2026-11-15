begin;

select plan(4);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'f6000000-0000-0000-0000-000000000001',
  'ci-planner-security@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table planner_sec_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on planner_sec_ids to authenticated;

insert into planner_sec_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f6000000-0000-0000-0000-000000000001',
    'ci-planner-sec-org',
    'CI Planner Security Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'f6100000-0000-0000-0000-000000000001',
  'f6000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f6000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f6100000-0000-0000-0000-000000000001","email":"ci-planner-security@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from planner_sec_ids where key = 'organisation')),
  'organisation selected'
);

insert into planner_sec_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from planner_sec_ids where key = 'organisation')
  and membership_row.user_id = 'f6000000-0000-0000-0000-000000000001';

select throws_ok(
  format(
    'select private.namespaced_planner_action_idempotency_key(%L, %L::uuid, %L)',
    'gemba',
    (select id from planner_sec_ids where key = 'owner_membership'),
    'client-key'
  ),
  '42501',
  'permission denied for function namespaced_planner_action_idempotency_key',
  'authenticated cannot execute namespaced_planner_action_idempotency_key'
);

select throws_ok(
  format(
    'select private.assert_gemba_planner_action_idempotency_replay(%L::uuid, %L::uuid, gen_random_uuid(), gen_random_uuid(), null, null, null)',
    (select id from planner_sec_ids where key = 'organisation'),
    (select id from planner_sec_ids where key = 'owner_membership')
  ),
  '42501',
  'permission denied for function assert_gemba_planner_action_idempotency_replay',
  'authenticated cannot execute assert_gemba_planner_action_idempotency_replay'
);

select throws_ok(
  format(
    'select private.assert_five_s_planner_action_idempotency_replay(%L::uuid, %L::uuid, gen_random_uuid(), gen_random_uuid(), null, null, null)',
    (select id from planner_sec_ids where key = 'organisation'),
    (select id from planner_sec_ids where key = 'owner_membership')
  ),
  '42501',
  'permission denied for function assert_five_s_planner_action_idempotency_replay',
  'authenticated cannot execute assert_five_s_planner_action_idempotency_replay'
);

select * from finish();
rollback;