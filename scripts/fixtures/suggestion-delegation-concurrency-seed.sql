\set ON_ERROR_STOP on
begin;

select set_config(
  't119.race_code',
  't119-race-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  true
);

drop table if exists private._t119_conc_ids;
create table private._t119_conc_ids (key text primary key, id uuid);
grant select, insert, update on private._t119_conc_ids to authenticated, lean_hub_private_owner, service_role;

insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
values
  ('f119c000-0000-4000-8000-000000000001', 't119race-operator@example.test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f119c000-0000-4000-8000-000000000002', 't119race-manager@example.test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f119c000-0000-4000-8000-000000000004', 't119race-delegate@example.test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f119c000-0000-4000-8000-000000000005', 't119race-alt-delegate@example.test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, false)
on conflict (id) do nothing;

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('f119c100-0000-4000-8000-000000000001', 'f119c000-0000-4000-8000-000000000001', now(), now()),
  ('f119c100-0000-4000-8000-000000000002', 'f119c000-0000-4000-8000-000000000002', now(), now())
on conflict (id) do nothing;

insert into private._t119_conc_ids (key, id)
select 'organisation', private.provision_organisation(
  'f119c000-0000-4000-8000-000000000001',
  current_setting('t119.race_code'),
  'T119 Race Delegation Organisation'
);

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
select (select id from private._t119_conc_ids where key = 'organisation'), user_row.id, 'active', now()
from (values
  ('f119c000-0000-4000-8000-000000000002'::uuid),
  ('f119c000-0000-4000-8000-000000000004'::uuid),
  ('f119c000-0000-4000-8000-000000000005'::uuid)
) as user_row(id);

update private.identity_controls
set status = 'active', enrolment_status = 'complete', enrolment_completed_at = now()
where user_id in (
  'f119c000-0000-4000-8000-000000000002',
  'f119c000-0000-4000-8000-000000000004',
  'f119c000-0000-4000-8000-000000000005'
);

insert into private._t119_conc_ids (key, id)
select seed.key, membership_row.id
from (values
  ('manager_membership', 'f119c000-0000-4000-8000-000000000002'::uuid),
  ('delegate_membership', 'f119c000-0000-4000-8000-000000000004'::uuid),
  ('alternate_delegate_membership', 'f119c000-0000-4000-8000-000000000005'::uuid)
) as seed(key, user_id)
join public.organisation_memberships membership_row
  on membership_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
 and membership_row.user_id = seed.user_id;

select set_config(
  'request.jwt.claims',
  '{"sub":"f119c000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f119c100-0000-4000-8000-000000000001","email":"t119race-operator@example.test"}',
  true
);
set local role authenticated;
select public.switch_organisation((select id from private._t119_conc_ids where key = 'organisation'));

insert into private._t119_conc_ids (key, id)
select 'unit_site', public.create_organisation_unit(
  (select id from private._t119_conc_ids where key = 'organisation'), null, 'race-site', 'Race Site', 'site'
);

insert into private._t119_conc_ids (key, id)
select 'unit_line1', public.create_organisation_unit(
  (select id from private._t119_conc_ids where key = 'organisation'),
  (select id from private._t119_conc_ids where key = 'unit_site'),
  'race-line-1', 'Race Line 1', 'line'
);

insert into private._t119_conc_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator-race');

insert into private._t119_conc_ids (key, id)
select 'operator_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
  and membership_row.user_id = 'f119c000-0000-4000-8000-000000000001';

select public.assign_membership_job_function(
  (select id from private._t119_conc_ids where key = 'operator_membership'),
  (select id from private._t119_conc_ids where key = 'job_function'),
  true,
  (select id from private._t119_conc_ids where key = 'unit_line1')
);

insert into private._t119_conc_ids (key, id)
select 'manager_role', public.create_role_draft(
  (select id from private._t119_conc_ids where key = 'organisation'), 'race-manager', 'Race Manager', 'Race manager'
);

select public.add_role_permission((select id from private._t119_conc_ids where key = 'organisation'), (select id from private._t119_conc_ids where key = 'manager_role'), 'suggestions.review');
select public.add_role_permission((select id from private._t119_conc_ids where key = 'organisation'), (select id from private._t119_conc_ids where key = 'manager_role'), 'suggestions.manage');
select public.publish_role_version((select id from private._t119_conc_ids where key = 'organisation'), (select id from private._t119_conc_ids where key = 'manager_role'));

insert into private._t119_conc_ids (key, id)
select 'manager_grant', public.grant_role_version(
  (select id from private._t119_conc_ids where key = 'organisation'),
  (select id from private._t119_conc_ids where key = 'manager_membership'),
  (select id from private._t119_conc_ids where key = 'manager_role'),
  'unit_subtree',
  (select id from private._t119_conc_ids where key = 'unit_site')
);

insert into private._t119_conc_ids (key, id)
select 'delegate_grant', public.grant_role_version(
  (select id from private._t119_conc_ids where key = 'organisation'),
  (select id from private._t119_conc_ids where key = 'delegate_membership'),
  (select id from private._t119_conc_ids where key = 'manager_role'),
  'unit_subtree',
  (select id from private._t119_conc_ids where key = 'unit_site')
);

insert into private._t119_conc_ids (key, id)
select 'alternate_delegate_grant', public.grant_role_version(
  (select id from private._t119_conc_ids where key = 'organisation'),
  (select id from private._t119_conc_ids where key = 'alternate_delegate_membership'),
  (select id from private._t119_conc_ids where key = 'manager_role'),
  'unit_subtree',
  (select id from private._t119_conc_ids where key = 'unit_site')
);

insert into private._t119_conc_ids (key, id)
select 'programme', public.create_suggestion_programme_draft('Ideas', 'ideas-race');

insert into private._t119_conc_ids (key, id)
select 'programme_version', pv.id
from public.suggestion_programme_versions pv
where pv.programme_id = (select id from private._t119_conc_ids where key = 'programme')
  and pv.version_number = 1;

select public.publish_suggestion_programme_version((select id from private._t119_conc_ids where key = 'programme_version'));
insert into private._t119_conc_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety-race');

insert into private._t119_conc_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from private._t119_conc_ids where key = 'programme_version'),
  (select id from private._t119_conc_ids where key = 'category'),
  'T119 race concurrency suggestion',
  'Problem', 'Idea', 'Benefit'
);

update public.improvement_suggestions s
set origin_unit_id = (select id from private._t119_conc_ids where key = 'unit_line1')
where s.id = (select id from private._t119_conc_ids where key = 'suggestion');

select public.submit_suggestion((select id from private._t119_conc_ids where key = 'suggestion'));

commit;
