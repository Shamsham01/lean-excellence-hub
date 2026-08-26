begin;

select plan(5);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'c1500000-0000-0000-0000-000000000001',
  'recognition-immutable-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table recognition_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on recognition_ids to authenticated;

insert into recognition_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c1500000-0000-0000-0000-000000000001',
    'recognition-immutable-org',
    'Recognition Immutability Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'c1600000-0000-0000-0000-000000000001',
  'c1500000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1600000-0000-0000-0000-000000000001","email":"recognition-immutable-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from recognition_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into recognition_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from recognition_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into recognition_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from recognition_ids where key = 'organisation')
  and membership_row.user_id = 'c1500000-0000-0000-0000-000000000001';

insert into recognition_ids (key, id)
select 'recognition_type', public.create_recognition_type('Thanks', 'thanks');

insert into recognition_ids (key, id)
select 'award', public.award_recognition(
  (select id from recognition_ids where key = 'recognition_type'),
  'Great teamwork',
  'Thanks for supporting the kaizen event',
  (select id from recognition_ids where key = 'unit_root'),
  'organisation',
  array[(select id from recognition_ids where key = 'owner_membership')]::uuid[]
);

reset role;

select throws_ok(
  format(
    'update public.recognition_awards set title = %L where id = %L',
    'Changed title',
    (select id from recognition_ids where key = 'award')
  ),
  '55000',
  'recognition award is immutable',
  'award body is immutable'
);

select throws_ok(
  format(
    'update public.recognition_recipients set contribution_summary = %L
     where recognition_award_id = %L',
    'Changed summary',
    (select id from recognition_ids where key = 'award')
  ),
  '55000',
  'recognition_recipients is append-only',
  'recipient rows are append-only'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1600000-0000-0000-0000-000000000001","email":"recognition-immutable-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.revoke_recognition((select id from recognition_ids where key = 'award'), 'Issued in error'),
  'status-only revocation remains allowed'
);

select is(
  (select status from public.recognition_awards
   where id = (select id from recognition_ids where key = 'award')),
  'revoked',
  'revoked award preserves immutable award row'
);

select * from finish();
rollback;
