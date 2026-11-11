begin;

select plan(16);

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
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('f1000000-0000-0000-0000-000000000003', 'site-scope-auditor@example.test',
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
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('f2000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp());

insert into site_scope_ids (key, id)
select 'owner_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000001'::uuid;

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  (
    (select id from site_scope_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000002'::uuid,
    'active',
    statement_timestamp()
  ),
  (
    (select id from site_scope_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000003'::uuid,
    'active',
    statement_timestamp()
  );

insert into site_scope_ids (key, id)
select 'manager_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000002'::uuid;

insert into site_scope_ids (key, id)
select 'auditor_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and membership.user_id = 'f1000000-0000-0000-0000-000000000003'::uuid;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'f1000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000003'
);

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

insert into site_scope_ids (key, id)
select 'no_location_standard', public.create_five_s_standard_draft(
  'No locations yet',
  'Draft without applicability',
  90,
  null
);

select ok(
  (select count(*) from public.five_s_standards) >= 3,
  'owner seeds standards'
);

insert into site_scope_ids (key, id)
select 'five_s_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from site_scope_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'five_s'
  and role_version.status = 'published';

select ok(
  public.grant_role_version(
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'manager_membership'),
    (select id from site_scope_ids where key = 'five_s_role_version'),
    'unit_subtree',
    (select id from site_scope_ids where key = 'site_a')
  ) is not null,
  'site manager receives unit-scoped 5S responsibility'
);

select ok(
  public.grant_role_version(
    (select id from site_scope_ids where key = 'organisation'),
    (select id from site_scope_ids where key = 'auditor_membership'),
    (select id from site_scope_ids where key = 'five_s_role_version'),
    'organisation',
    null
  ) is not null,
  'org-wide reader receives five_s access without a home site placement'
);

insert into site_scope_ids (key, id)
select 'job_function', public.create_job_function(
  'Site CI Manager',
  'site-ci-manager'
);

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
  (select count(*)::integer from public.five_s_standards where display_name = 'Cross-site standard'),
  1,
  'site manager can read cross-site standard for execution'
);

select is(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'cross_site_standard')
  ),
  false,
  'site manager cannot author cross-site standard'
);

select is(
  public.member_can_author_five_s_standard(
    (select id from site_scope_ids where key = 'site_a_standard')
  ),
  true,
  'site manager can author site-local standard'
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
  coalesce(
    public.member_can_author_five_s_standard(
      (select id from site_scope_ids where key = 'no_location_standard')
    ),
    false
  ),
  'site manager can author draft with no locations yet'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"f2000000-0000-0000-0000-000000000003","email":"site-scope-auditor@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from site_scope_ids where key = 'organisation')),
  'auditor switches organisation'
);

select is(
  (select count(*)::integer from public.five_s_standards where display_name = 'Cross-site standard'),
  1,
  'multi-site auditor can read cross-site standard'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.member_can_author_five_s_standard(uuid)',
    'execute'
  ),
  'anon cannot execute member_can_author_five_s_standard'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'private.membership_can_author_five_s_standard(uuid, uuid, uuid)',
    'execute'
  ),
  'anon cannot execute private membership_can_author_five_s_standard'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.add_five_s_question(uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric)',
    'execute'
  ),
  'anon cannot execute add_five_s_question'
);

select * from finish();
rollback;
