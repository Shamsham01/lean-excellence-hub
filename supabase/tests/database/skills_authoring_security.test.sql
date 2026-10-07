begin;

select plan(22);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a6600000-0000-0000-0000-000000000001',
  'skills-owner-a@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a6600000-0000-0000-0000-000000000002',
  'skills-reader@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a6600000-0000-0000-0000-000000000003',
  'skills-catalog@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a6600000-0000-0000-0000-000000000004',
  'skills-requirements@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a6600000-0000-0000-0000-000000000005',
  'skills-site-only@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a6600000-0000-0000-0000-000000000006',
  'skills-owner-b@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table skills_authoring_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on skills_authoring_ids to authenticated;

insert into skills_authoring_ids (key, id)
values
(
  'organisation_a',
  private.provision_organisation(
    'a6600000-0000-0000-0000-000000000001',
    'skills-authoring-a',
    'Skills Authoring A'
  )
),
(
  'organisation_b',
  private.provision_organisation(
    'a6600000-0000-0000-0000-000000000006',
    'skills-authoring-b',
    'Skills Authoring B'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a6610000-0000-0000-0000-000000000001',
  'a6600000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a6610000-0000-0000-0000-000000000002',
  'a6600000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'a6610000-0000-0000-0000-000000000003',
  'a6600000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'a6610000-0000-0000-0000-000000000004',
  'a6600000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
),
(
  'a6610000-0000-0000-0000-000000000005',
  'a6600000-0000-0000-0000-000000000005',
  statement_timestamp(), statement_timestamp()
),
(
  'a6610000-0000-0000-0000-000000000006',
  'a6600000-0000-0000-0000-000000000006',
  statement_timestamp(), statement_timestamp()
);

reset role;

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at
)
values
(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  'a6600000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
),
(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  'a6600000-0000-0000-0000-000000000003',
  'active',
  statement_timestamp()
),
(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  'a6600000-0000-0000-0000-000000000004',
  'active',
  statement_timestamp()
),
(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  'a6600000-0000-0000-0000-000000000005',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'a6600000-0000-0000-0000-000000000002',
  'a6600000-0000-0000-0000-000000000003',
  'a6600000-0000-0000-0000-000000000004',
  'a6600000-0000-0000-0000-000000000005'
);

insert into skills_authoring_ids (key, id)
select 'reader_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.user_id = 'a6600000-0000-0000-0000-000000000002';

insert into skills_authoring_ids (key, id)
select 'catalog_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.user_id = 'a6600000-0000-0000-0000-000000000003';

insert into skills_authoring_ids (key, id)
select 'requirements_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.user_id = 'a6600000-0000-0000-0000-000000000004';

insert into skills_authoring_ids (key, id)
select 'site_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.user_id = 'a6600000-0000-0000-0000-000000000005';

select set_config(
  'request.jwt.claims',
  '{"sub":"a6600000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a6610000-0000-0000-0000-000000000001","email":"skills-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from skills_authoring_ids where key = 'organisation_a')),
  'owner selects organisation A'
);

insert into skills_authoring_ids (key, id)
select 'site', public.create_organisation_unit(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  null,
  'skills-site',
  'Skills Site',
  'site'
);

insert into skills_authoring_ids (key, id)
select 'reader_role', public.create_role_draft(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  'skills-reader',
  'Skills Reader',
  'Read the skills catalogue only'
);

select ok(
  public.add_role_permission(
    (select id from skills_authoring_ids where key = 'organisation_a'),
    (select id from skills_authoring_ids where key = 'reader_role'),
    'skills.read'
  ),
  'reader role receives skills.read'
);

select ok(
  public.publish_role_version(
    (select id from skills_authoring_ids where key = 'organisation_a'),
    (select id from skills_authoring_ids where key = 'reader_role')
  ),
  'reader role publishes'
);

select ok(
  public.grant_role_version(
    (select id from skills_authoring_ids where key = 'organisation_a'),
    (select id from skills_authoring_ids where key = 'reader_membership'),
    (select id from skills_authoring_ids where key = 'reader_role'),
    'organisation',
    null
  ) is not null,
  'reader grant is organisation scoped'
);

insert into skills_authoring_ids (key, id)
select 'catalog_role', public.create_role_draft(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  'skills-catalog-manager',
  'Skills Catalogue Manager',
  'Manage skills and scales'
);

select public.add_role_permission(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'catalog_role'),
  'skills.read'
);
select public.add_role_permission(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'catalog_role'),
  'skills.catalog.manage'
);
select public.publish_role_version(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'catalog_role')
);
select public.grant_role_version(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'catalog_membership'),
  (select id from skills_authoring_ids where key = 'catalog_role'),
  'organisation',
  null
);

insert into skills_authoring_ids (key, id)
select 'requirements_role', public.create_role_draft(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  'skills-requirements-manager',
  'Skills Requirements Manager',
  'Manage capability requirements'
);

select public.add_role_permission(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'requirements_role'),
  'skills.read'
);
select public.add_role_permission(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'requirements_role'),
  'skills.requirements.manage'
);
select public.publish_role_version(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'requirements_role')
);
select public.grant_role_version(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'requirements_membership'),
  (select id from skills_authoring_ids where key = 'requirements_role'),
  'organisation',
  null
);

insert into skills_authoring_ids (key, id)
select 'site_role', public.create_role_draft(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  'site-unrelated-skills',
  'Site Unrelated Skills',
  'Site grant that must not manage the organisation catalogue'
);

select public.add_role_permission(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'site_role'),
  'five_s.read'
);
select public.add_role_permission(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'site_role'),
  'skills.catalog.manage'
);
select public.publish_role_version(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'site_role')
);
select public.grant_role_version(
  (select id from skills_authoring_ids where key = 'organisation_a'),
  (select id from skills_authoring_ids where key = 'site_membership'),
  (select id from skills_authoring_ids where key = 'site_role'),
  'unit_subtree',
  (select id from skills_authoring_ids where key = 'site')
);

insert into skills_authoring_ids (key, id)
select 'job_function', public.create_job_function('Production Operator', 'production-operator');

insert into skills_authoring_ids (key, id)
select 'scale', public.create_skill_proficiency_scale_draft('Operational Proficiency');

insert into skills_authoring_ids (key, id)
select 'scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skills_authoring_ids where key = 'scale')
  and version_row.version_number = 1;

select public.add_skill_proficiency_level(
  (select id from skills_authoring_ids where key = 'scale_version'),
  1,
  'Awareness'
);
select public.add_skill_proficiency_level(
  (select id from skills_authoring_ids where key = 'scale_version'),
  2,
  'Competent'
);

select ok(
  public.publish_skill_proficiency_scale_version(
    (select id from skills_authoring_ids where key = 'scale_version')
  ),
  'owner publishes proficiency scale'
);

select throws_ok(
  $$
    select public.publish_skill_proficiency_scale_version(
      (select id from skills_authoring_ids where key = 'scale_version')
    )
  $$,
  'P0002',
  'draft scale version not found',
  'published scale cannot be published again in place'
);

select ok(
  not has_table_privilege('authenticated', 'public.skill_proficiency_levels', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.skill_proficiency_levels', 'INSERT')
  and not has_table_privilege('authenticated', 'public.skill_proficiency_scales', 'UPDATE'),
  'authenticated cannot silently mutate proficiency scale tables'
);

insert into skills_authoring_ids (key, id)
select 'owner_skill', public.create_skill('Machine Setup', 'machine-setup');

select set_config(
  'request.jwt.claims',
  '{"sub":"a6600000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a6610000-0000-0000-0000-000000000002","email":"skills-reader@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from skills_authoring_ids where key = 'organisation_a')),
  'reader selects organisation A'
);

select throws_ok(
  $$ select public.create_skill('Reader Skill', 'reader-skill') $$,
  '42501',
  'skill creation is not authorised',
  'skills.read cannot create a skill'
);

select ok(
  exists (
    select 1
    from public.skills skill_row
    where skill_row.id = (select id from skills_authoring_ids where key = 'owner_skill')
  ),
  'skills.read can read the organisation skill'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a6600000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a6610000-0000-0000-0000-000000000003","email":"skills-catalog@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from skills_authoring_ids where key = 'organisation_a')),
  'catalogue manager selects organisation A'
);

insert into skills_authoring_ids (key, id)
select 'catalog_skill', public.create_skill('Line Clearance', 'line-clearance');

select ok(
  (select id from skills_authoring_ids where key = 'catalog_skill') is not null,
  'skills.catalog.manage can create a skill'
);

select throws_ok(
  $$ select public.create_skill_capability_set_draft('Blocked Standard', 'blocked-standard') $$,
  '42501',
  'skill capability set creation is not authorised',
  'catalogue manage does not grant capability requirement authority'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a6600000-0000-0000-0000-000000000004","role":"authenticated","session_id":"a6610000-0000-0000-0000-000000000004","email":"skills-requirements@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from skills_authoring_ids where key = 'organisation_a')),
  'requirements manager selects organisation A'
);

insert into skills_authoring_ids (key, id)
select 'standard', public.create_skill_capability_set_draft(
  'Production Operator Skills',
  'production-operator-skills'
);

insert into skills_authoring_ids (key, id)
select 'standard_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from skills_authoring_ids where key = 'standard')
  and version_row.version_number = 1;

select ok(
  public.add_skill_requirement(
    (select id from skills_authoring_ids where key = 'standard_version'),
    (select id from skills_authoring_ids where key = 'owner_skill'),
    (select id from skills_authoring_ids where key = 'job_function'),
    (select id from skills_authoring_ids where key = 'scale_version'),
    (
      select level_row.id
      from public.skill_proficiency_levels level_row
      where level_row.scale_version_id = (select id from skills_authoring_ids where key = 'scale_version')
        and level_row.order_value = 2
    )
  ) is not null,
  'skills.requirements.manage can add a capability requirement'
);

select ok(
  public.publish_skill_capability_set_version(
    (select id from skills_authoring_ids where key = 'standard_version')
  ),
  'skills.requirements.manage can publish capability requirements'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a6600000-0000-0000-0000-000000000005","role":"authenticated","session_id":"a6610000-0000-0000-0000-000000000005","email":"skills-site-only@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from skills_authoring_ids where key = 'organisation_a')),
  'site-scoped member selects organisation A'
);

select throws_ok(
  $$ select public.create_skill('Site Skill', 'site-skill') $$,
  '42501',
  'skill creation is not authorised',
  'site-only grant does not provide organisation catalogue authority'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a6600000-0000-0000-0000-000000000006","role":"authenticated","session_id":"a6610000-0000-0000-0000-000000000006","email":"skills-owner-b@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from skills_authoring_ids where key = 'organisation_b')),
  'owner B selects organisation B'
);

select is(
  (
    select count(*)::integer
    from public.skills skill_row
    where skill_row.code = 'machine-setup'
  ),
  0,
  'another organisation cannot read the target organisation skill'
);

reset role;

select ok(
  not has_function_privilege(
    'anon',
    'public.create_skill(text, text, text, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.create_skill_proficiency_scale_draft(text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.add_skill_proficiency_level(uuid, integer, text, text, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.publish_skill_proficiency_scale_version(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.create_skill_capability_set_draft(text, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.add_skill_requirement(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.publish_skill_capability_set_version(uuid)',
    'execute'
  ),
  'anonymous cannot execute skills authoring RPCs'
);

select set_config('request.jwt.claims', '{}', true);
set local role authenticated;

select throws_ok(
  $$ select public.create_skill('Unsigned Skill', 'unsigned-skill') $$,
  '42501',
  'skill creation is not authorised',
  'unauthenticated session cannot author a skill'
);

select * from finish();
rollback;
