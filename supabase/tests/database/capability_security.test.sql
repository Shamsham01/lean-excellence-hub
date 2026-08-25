begin;

select plan(23);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '91000000-0000-0000-0000-000000000001',
  'capability-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  '91000000-0000-0000-0000-000000000002',
  'capability-member@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table capability_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on capability_ids to authenticated;

insert into capability_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '91000000-0000-0000-0000-000000000001',
    'capability-org',
    'Capability Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '92000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000001","email":"capability-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from capability_ids where key = 'organisation')),
  'capability owner selects organisation'
);

insert into capability_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from capability_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into capability_ids (key, id)
select 'unit_child', public.create_organisation_unit(
  (select id from capability_ids where key = 'organisation'),
  (select id from capability_ids where key = 'unit_root'),
  'child-dept',
  'Child Department',
  'department'
);

insert into capability_ids (key, id)
select 'unit_sibling', public.create_organisation_unit(
  (select id from capability_ids where key = 'organisation'),
  (select id from capability_ids where key = 'unit_root'),
  'sibling-dept',
  'Sibling Department',
  'department'
);

insert into capability_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into capability_ids (key, id)
select 'course', public.create_training_course_draft('Lean Basic', 'lean-basic');

insert into capability_ids (key, id)
select 'course_version', version_row.id
from public.training_course_versions version_row
where version_row.course_id = (select id from capability_ids where key = 'course')
  and version_row.version_number = 1;

select lives_ok(
  format(
    'select public.update_training_course_draft_version(%L::uuid, null, null, 365, ''classroom'')',
    (select id from capability_ids where key = 'course_version')
  ),
  'update course draft version'
);

select ok(
  public.publish_training_course_version((select id from capability_ids where key = 'course_version')),
  'publish course version'
);

insert into capability_ids (key, id)
select 'curriculum', public.create_training_curriculum_draft('Main Curriculum', 'main-curriculum');

insert into capability_ids (key, id)
select 'curriculum_version', version_row.id
from public.training_curriculum_versions version_row
where version_row.curriculum_id = (select id from capability_ids where key = 'curriculum')
  and version_row.version_number = 1;

select ok(
  public.add_training_requirement(
    (select id from capability_ids where key = 'curriculum_version'),
    (select id from capability_ids where key = 'course'),
    (select id from capability_ids where key = 'job_function'),
    null,
    false,
    true,
    null,
    180
  ) is not null,
  'add training requirement with override validity'
);

select ok(
  public.publish_training_curriculum_version((select id from capability_ids where key = 'curriculum_version')),
  'publish curriculum'
);

insert into capability_ids (key, id)
select 'scale', public.create_skill_proficiency_scale_draft('Competency Scale');

insert into capability_ids (key, id)
select 'scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from capability_ids where key = 'scale')
  and version_row.version_number = 1;

select ok(
  public.add_skill_proficiency_level(
    (select id from capability_ids where key = 'scale_version'),
    1,
    'Awareness'
  ) is not null,
  'add proficiency level'
);

insert into capability_ids (key, id)
select 'level_two', public.add_skill_proficiency_level(
  (select id from capability_ids where key = 'scale_version'),
  2,
  'Competent'
);

select ok(
  public.publish_skill_proficiency_scale_version((select id from capability_ids where key = 'scale_version')),
  'publish scale version'
);

insert into capability_ids (key, id)
select 'skill', public.create_skill('5S Auditing', 'five-s-auditing');

insert into capability_ids (key, id)
select 'capability_set', public.create_skill_capability_set_draft('Capability Set', 'cap-set');

insert into capability_ids (key, id)
select 'capability_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from capability_ids where key = 'capability_set')
  and version_row.version_number = 1;

select ok(
  public.add_skill_requirement(
    (select id from capability_ids where key = 'capability_version'),
    (select id from capability_ids where key = 'skill'),
    (select id from capability_ids where key = 'job_function'),
    (select id from capability_ids where key = 'scale_version'),
    (select id from capability_ids where key = 'level_two')
  ) is not null,
  'add skill requirement'
);

select ok(
  public.publish_skill_capability_set_version((select id from capability_ids where key = 'capability_version')),
  'publish capability set'
);

insert into capability_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from capability_ids where key = 'organisation')
  and membership_row.user_id = '91000000-0000-0000-0000-000000000001';

select ok(
  public.assign_membership_job_function(
    (select id from capability_ids where key = 'owner_membership'),
    (select id from capability_ids where key = 'job_function'),
    true,
    (select id from capability_ids where key = 'unit_child')
  ) is not null,
  'assign job function to owner membership for requirement context'
);

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from capability_ids where key = 'organisation'),
    '91000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into capability_ids (key, id)
select 'member_two', id from inserted_membership;

set local role authenticated;

select ok(
  public.switch_organisation((select id from capability_ids where key = 'organisation')),
  'reselect organisation after membership setup'
);

select ok(
  public.assign_membership_job_function(
    (select id from capability_ids where key = 'member_two'),
    (select id from capability_ids where key = 'job_function'),
    true,
    (select id from capability_ids where key = 'unit_child')
  ) is not null,
  'assign job function to non-owner membership'
);

select ok(
  not exists (
    select 1
    from public.access_grants grant_row
    join public.role_permissions role_permission
      on role_permission.organisation_id = grant_row.organisation_id
     and role_permission.role_version_id = grant_row.role_version_id
    where grant_row.organisation_id = (select id from capability_ids where key = 'organisation')
      and grant_row.grantee_membership_id = (select id from capability_ids where key = 'member_two')
      and role_permission.permission_key = 'training.completions.manage'
      and grant_row.revoked_at is null
  ),
  'job function assignment never grants rbac permission'
);

insert into capability_ids (key, id)
select 'completion', public.record_training_completion(
  (select id from capability_ids where key = 'owner_membership'),
  (select id from capability_ids where key = 'course_version'),
  statement_timestamp(),
  null,
  null,
  'classroom'
);

select is(
  (
    select course_version_id
    from public.training_completions
    where id = (select id from capability_ids where key = 'completion')
  ),
  (select id from capability_ids where key = 'course_version'),
  'training completion pins exact course version'
);

select is(
  (
    select course_id
    from public.training_requirements
    where curriculum_version_id = (select id from capability_ids where key = 'curriculum_version')
    limit 1
  ),
  (select id from capability_ids where key = 'course'),
  'training requirement uses stable course identity'
);

select is(
  private.derive_training_validity_days(180, 365),
  180,
  'validity precedence: requirement override wins'
);

insert into capability_ids (key, id)
select 'successor_version', public.create_training_course_successor_version(
  (select id from capability_ids where key = 'course')
);

select is(
  (
    select course_version_id
    from public.training_completions
    where id = (select id from capability_ids where key = 'completion')
  ),
  (select id from capability_ids where key = 'course_version'),
  'successor version does not re-pin existing completion'
);

insert into capability_ids (key, id)
select 'self_assessment', public.record_skill_self_assessment(
  (select id from capability_ids where key = 'owner_membership'),
  (select id from capability_ids where key = 'skill'),
  (select id from capability_ids where key = 'scale_version'),
  (select id from capability_ids where key = 'level_two')
);

select is(
  (
    select is_authoritative
    from public.membership_skill_assessments
    where id = (select id from capability_ids where key = 'self_assessment')
  ),
  false,
  'self assessment does not count as validated proficiency'
);

select is(
  private.derive_skill_gap(
    (select id from capability_ids where key = 'owner_membership'),
    (select id from capability_ids where key = 'skill')
  ) ->> 'status',
  'not_assessed',
  'self assessment excluded from current validated proficiency'
);

insert into capability_ids (key, id)
select 'validation', public.record_skill_validation(
  (select id from capability_ids where key = 'owner_membership'),
  (select id from capability_ids where key = 'skill'),
  (select id from capability_ids where key = 'scale_version'),
  (select id from capability_ids where key = 'level_two')
);

select cmp_ok(
  (
    select count(*)::integer
    from public.membership_skill_assessments
    where membership_id = (select id from capability_ids where key = 'owner_membership')
      and skill_id = (select id from capability_ids where key = 'skill')
  ),
  '>=',
  2,
  'validation creates append-only history'
);

select is(
  (
    select assertion_type
    from public.membership_skill_assessments
    where id = (select id from capability_ids where key = 'self_assessment')
  ),
  'self_assessed',
  'historical self assessment unchanged after new validation'
);

select ok(
  public.create_capability_action(
    'Close training gap',
    'training_gap',
    (select id from capability_ids where key = 'owner_membership'),
    (select id from capability_ids where key = 'course')
  ) is not null,
  'capability action links tenant safe for training gap'
);

select ok(
  public.create_capability_action(
    'Close skill gap',
    'skill_gap',
    (select id from capability_ids where key = 'owner_membership'),
    null,
    (select id from capability_ids where key = 'skill')
  ) is not null,
  'capability action links tenant safe for skill gap'
);

reset role;

select * from finish();
rollback;
