begin;

select plan(7);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('f1000000-0000-0000-0000-000000000001', 'site-scope-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f1000000-0000-0000-0000-000000000002', 'site-scope-manager@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false);

create temporary table site_scope_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on site_scope_ids to authenticated;

insert into site_scope_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f1000000-0000-0000-0000-000000000001',
    'site-scope-org',
    'Site Scope Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp());

insert into site_scope_ids (key, id)
select 'owner_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000001'::uuid;

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values (
  (select id from site_scope_ids where key = 'organisation'),
  'f1000000-0000-0000-0000-000000000002'::uuid,
  'active',
  statement_timestamp()
);

insert into site_scope_ids (key, id)
select 'manager_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000002'::uuid;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'f1000000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000001","email":"site-scope-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'owner switches organisation before hierarchy setup'
);

insert into site_scope_ids (key, id)
select 'site_a', public.create_organisation_unit(
  (select id from site_scope_ids where key = 'organisation'),
  null,
  'site-a',
  'Site A',
  'site'
);

insert into site_scope_ids (key, id)
select 'site_b', public.create_organisation_unit(
  (select id from site_scope_ids where key = 'organisation'),
  null,
  'site-b',
  'Site B',
  'site'
);

insert into site_scope_ids (key, id)
select 'area_a', public.create_organisation_unit(
  (select id from site_scope_ids where key = 'organisation'),
  (select id from site_scope_ids where key = 'site_a'),
  'area-a',
  'Area A',
  'department'
);

insert into site_scope_ids (key, id)
select 'area_b', public.create_organisation_unit(
  (select id from site_scope_ids where key = 'organisation'),
  (select id from site_scope_ids where key = 'site_b'),
  'area-b',
  'Area B',
  'department'
);

insert into site_scope_ids (key, id)
select 'cross_site_standard', public.create_five_s_standard_draft(
  'Cross-site standard',
  'Applies to both sites',
  90,
  array[
    (select id from site_scope_ids where key = 'area_a'),
    (select id from site_scope_ids where key = 'area_b')
  ]::uuid[]
);

insert into site_scope_ids (key, id)
select 'site_a_standard', public.create_five_s_standard_draft(
  'Site A standard',
  'Site A only',
  90,
  array[(select id from site_scope_ids where key = 'area_a')]::uuid[]
);

select ok(
  (select count(*) from public.five_s_standards) >= 2,
  'owner seeds standards'
);

insert into public.access_grants (
  organisation_id,
  membership_id,
  permission_key,
  scope_type,
  scope_unit_id,
  granted_by_membership_id
)
values
  (
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'manager_membership'),
    'five_s.read',
    'organisation',
    null,
    (select id from site_scope_ids where key = 'owner_membership')
  ),
  (
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'manager_membership'),
    'five_s.standards.manage',
    'organisation',
    null,
    (select id from site_scope_ids where key = 'owner_membership')
  );

insert into site_scope_ids (key, id)
select 'job_function', job_function.id
from public.job_functions job_function
where job_function.organisation_id = (select id from site_scope_ids where key = 'organisation')
limit 1;

select ok(
  public.assign_membership_job_function(
    (select id from site_scope_ids where key = 'manager_membership'),
    (select id from site_scope_ids where key = 'job_function'),
    true,
    (select id from site_scope_ids where key = 'area_a')
  ) is not null,
  'manager placed on site A area'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000002","email":"site-scope-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'manager switches organisation'
);

select is(
  (select count(*)::integer from public.five_s_standards where display_name = 'Site A standard'),
  1,
  'site manager sees site-local standard'
);

select is(
  (select count(*)::integer from public.five_s_standards where display_name = 'Cross-site standard'),
  0,
  'site manager cannot read cross-site standard'
);

select throws_ok(
  format(
    'select public.set_five_s_standard_applicable_units(%L::uuid, array[%L::uuid])',
    (select id from site_scope_ids where key = 'site_a_standard'),
    (select id from site_scope_ids where key = 'area_b')
  ),
  '42501',
  'organisational unit is outside authorised site scope',
  'site manager cannot assign out-of-site unit'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.add_five_s_question(uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric)',
    'execute'
  ),
  'anon cannot execute add_five_s_question'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.add_five_s_question(uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric)',
    'execute'
  ),
  'authenticated can execute add_five_s_question'
);

select * from finish();
rollback;
