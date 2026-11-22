begin;

select plan(11);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '93600000-0000-0000-0000-000000000001',
  'skills-unit-scope@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  '93600000-0000-0000-0000-000000000002',
  'skills-unit-scope-b@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table unit_scope_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on unit_scope_ids to authenticated;

insert into unit_scope_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '93600000-0000-0000-0000-000000000001',
    'skills-unit-scope-org',
    'Skills Unit Scope Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '94600000-0000-0000-0000-000000000001',
  '93600000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93600000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94600000-0000-0000-0000-000000000001","email":"skills-unit-scope@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from unit_scope_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into unit_scope_ids (key, id)
select 'site_a', public.create_organisation_unit(
  (select id from unit_scope_ids where key = 'organisation'),
  null,
  'site-a',
  'Site A',
  'site'
);

insert into unit_scope_ids (key, id)
select 'site_b', public.create_organisation_unit(
  (select id from unit_scope_ids where key = 'organisation'),
  null,
  'site-b',
  'Site B',
  'site'
);

insert into unit_scope_ids (key, id)
select 'line_a', public.create_organisation_unit(
  (select id from unit_scope_ids where key = 'organisation'),
  (select id from unit_scope_ids where key = 'site_a'),
  'line-a',
  'Line A',
  'department'
);

insert into unit_scope_ids (key, id)
select 'scale', public.create_skill_proficiency_scale_draft('Unit scope scale');

insert into unit_scope_ids (key, id)
select 'scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from unit_scope_ids where key = 'scale')
  and version_row.version_number = 1;

select public.add_skill_proficiency_level(
  (select id from unit_scope_ids where key = 'scale_version'), 1, 'Level 1'
);
select public.add_skill_proficiency_level(
  (select id from unit_scope_ids where key = 'scale_version'), 2, 'Level 2'
);
select public.add_skill_proficiency_level(
  (select id from unit_scope_ids where key = 'scale_version'), 3, 'Level 3'
);

select ok(
  public.publish_skill_proficiency_scale_version(
    (select id from unit_scope_ids where key = 'scale_version')
  ),
  'publish scale'
);

insert into unit_scope_ids (key, id)
select 'level_2', level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from unit_scope_ids where key = 'scale_version')
  and level_row.order_value = 2;

insert into unit_scope_ids (key, id)
select 'level_3', level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from unit_scope_ids where key = 'scale_version')
  and level_row.order_value = 3;

insert into unit_scope_ids (key, id)
select 'skill', public.create_skill('Welding', 'welding-unit-scope');

insert into unit_scope_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator-unit-scope');

insert into unit_scope_ids (key, id)
select 'capability_set', public.create_skill_capability_set_draft('Operators', 'operators-unit-scope');

insert into unit_scope_ids (key, id)
select 'capability_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from unit_scope_ids where key = 'capability_set')
  and version_row.version_number = 1;

select ok(
  public.add_skill_requirement(
    (select id from unit_scope_ids where key = 'capability_version'),
    (select id from unit_scope_ids where key = 'skill'),
    (select id from unit_scope_ids where key = 'job_function'),
    (select id from unit_scope_ids where key = 'scale_version'),
    (select id from unit_scope_ids where key = 'level_2')
  ) is not null,
  'org-wide requirement'
);

select ok(
  public.add_skill_requirement(
    (select id from unit_scope_ids where key = 'capability_version'),
    (select id from unit_scope_ids where key = 'skill'),
    (select id from unit_scope_ids where key = 'job_function'),
    (select id from unit_scope_ids where key = 'scale_version'),
    (select id from unit_scope_ids where key = 'level_3'),
    (select id from unit_scope_ids where key = 'site_a')
  ) is not null,
  'site-a requirement'
);

select ok(
  public.publish_skill_capability_set_version(
    (select id from unit_scope_ids where key = 'capability_version')
  ),
  'publish capability set'
);

reset role;

insert into unit_scope_ids (key, id)
select 'membership_a', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from unit_scope_ids where key = 'organisation')
  and membership_row.user_id = '93600000-0000-0000-0000-000000000001';

with inserted_membership_b as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values (
    (select id from unit_scope_ids where key = 'organisation'),
    '93600000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into unit_scope_ids (key, id)
select 'membership_b', id from inserted_membership_b;

set local role authenticated;

select ok(
  public.assign_membership_job_function(
    (select id from unit_scope_ids where key = 'membership_a'),
    (select id from unit_scope_ids where key = 'job_function'),
    true,
    (select id from unit_scope_ids where key = 'line_a')
  ) is not null,
  'assign line-a operator'
);

select ok(
  public.assign_membership_job_function(
    (select id from unit_scope_ids where key = 'membership_b'),
    (select id from unit_scope_ids where key = 'job_function'),
    true,
    (select id from unit_scope_ids where key = 'site_b')
  ) is not null,
  'assign site-b operator'
);

select is(
  private.derive_skill_gap(
    (select id from unit_scope_ids where key = 'membership_a'),
    (select id from unit_scope_ids where key = 'skill')
  ) ->> 'target_order',
  '3',
  'descendant unit inherits site override target'
);

select is(
  private.derive_skill_gap(
    (select id from unit_scope_ids where key = 'membership_b'),
    (select id from unit_scope_ids where key = 'skill')
  ) ->> 'target_order',
  '2',
  'sibling site keeps org-wide target only'
);

reset role;

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_skills_matrix(integer, integer, uuid)',
    'execute'
  ),
  'authenticated can execute get_skills_matrix'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.get_skills_matrix(integer, integer, uuid)',
    'execute'
  ),
  'anon cannot execute get_skills_matrix'
);

select * from finish();
rollback;
