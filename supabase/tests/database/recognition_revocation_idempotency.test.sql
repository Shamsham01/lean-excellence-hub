begin;

select plan(5);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b1200000-0000-0000-0000-000000000001',
  'revoke-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table revoke_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on revoke_ids to authenticated;

insert into revoke_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b1200000-0000-0000-0000-000000000001',
    'revoke-org',
    'Revoke Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2200000-0000-0000-0000-000000000001',
  'b1200000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1200000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2200000-0000-0000-0000-000000000001","email":"revoke-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from revoke_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into revoke_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from revoke_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into revoke_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from revoke_ids where key = 'organisation')
  and membership_row.user_id = 'b1200000-0000-0000-0000-000000000001';

insert into revoke_ids (key, id)
select 'recognition_type', public.create_recognition_type('Thanks', 'thanks');

insert into revoke_ids (key, id)
select 'award', public.award_recognition(
  (select id from revoke_ids where key = 'recognition_type'),
  'Team thanks',
  'Great teamwork today',
  (select id from revoke_ids where key = 'unit_root'),
  'organisation',
  array[(select id from revoke_ids where key = 'owner_membership')]::uuid[]
);

select ok(
  public.revoke_recognition((select id from revoke_ids where key = 'award'), 'Issued in error'),
  'first revocation succeeds'
);

select throws_ok(
  $$ select public.revoke_recognition(
    (select id from revoke_ids where key = 'award'),
    'Duplicate revoke'
  ) $$,
  'recognition award is already revoked',
  '55000'
);

select is(
  (select count(*)::integer from public.recognition_revocations
   where recognition_award_id = (select id from revoke_ids where key = 'award')),
  1,
  'single revocation history row preserved'
);

select ok(
  exists (
    select 1 from public.recognition_awards award_row
    where award_row.id = (select id from revoke_ids where key = 'award')
      and award_row.status = 'revoked'
  ),
  'award status remains revoked with preserved row'
);

select * from finish();
rollback;
