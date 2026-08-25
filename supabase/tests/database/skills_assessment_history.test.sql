begin;

select plan(11);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '93000000-0000-0000-0000-000000000001',
  'skills-history@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  '93000000-0000-0000-0000-000000000002',
  'skills-history-member@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table skills_history_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on skills_history_ids to authenticated;

insert into skills_history_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '93000000-0000-0000-0000-000000000001',
    'skills-history-org',
    'Skills History Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000001","email":"skills-history@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from skills_history_ids where key = 'organisation')),
  'skills history owner selects organisation'
);

insert into skills_history_ids (key, id)
select 'scale_a', public.create_skill_proficiency_scale_draft('Scale A');

insert into skills_history_ids (key, id)
select 'scale_a_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skills_history_ids where key = 'scale_a')
  and version_row.version_number = 1;

select ok(
  public.add_skill_proficiency_level(
    (select id from skills_history_ids where key = 'scale_a_version'),
    1,
    'Level 1'
  ) is not null,
  'add scale A level'
);

select ok(
  public.publish_skill_proficiency_scale_version(
    (select id from skills_history_ids where key = 'scale_a_version')
  ),
  'publish scale A'
);

insert into skills_history_ids (key, id)
select 'scale_b', public.create_skill_proficiency_scale_draft('Scale B');

insert into skills_history_ids (key, id)
select 'scale_b_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from skills_history_ids where key = 'scale_b')
  and version_row.version_number = 1;

select ok(
  public.add_skill_proficiency_level(
    (select id from skills_history_ids where key = 'scale_b_version'),
    1,
    'Level 1 B'
  ) is not null,
  'add scale B level'
);

select ok(
  public.publish_skill_proficiency_scale_version(
    (select id from skills_history_ids where key = 'scale_b_version')
  ),
  'publish scale B'
);

insert into skills_history_ids (key, id)
select 'skill', public.create_skill('Problem Solving', 'problem-solving');

insert into skills_history_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

insert into skills_history_ids (key, id)
select 'membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from skills_history_ids where key = 'organisation')
  and membership_row.user_id = '93000000-0000-0000-0000-000000000001';

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from skills_history_ids where key = 'organisation'),
    '93000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into skills_history_ids (key, id)
select 'membership_expired', id from inserted_membership;

set local role authenticated;

insert into skills_history_ids (key, id)
select 'level_a', level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from skills_history_ids where key = 'scale_a_version')
  and level_row.order_value = 1;

insert into skills_history_ids (key, id)
select 'level_b', level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from skills_history_ids where key = 'scale_b_version')
  and level_row.order_value = 1;

insert into skills_history_ids (key, id)
select 'capability_set', public.create_skill_capability_set_draft('Set', 'set');

insert into skills_history_ids (key, id)
select 'capability_version', version_row.id
from public.skill_capability_set_versions version_row
where version_row.capability_set_id = (select id from skills_history_ids where key = 'capability_set')
  and version_row.version_number = 1;

select ok(
  public.add_skill_requirement(
    (select id from skills_history_ids where key = 'capability_version'),
    (select id from skills_history_ids where key = 'skill'),
    (select id from skills_history_ids where key = 'job_function'),
    (select id from skills_history_ids where key = 'scale_a_version'),
    (select id from skills_history_ids where key = 'level_a')
  ) is not null,
  'add skill requirement on scale A'
);

select ok(
  public.publish_skill_capability_set_version(
    (select id from skills_history_ids where key = 'capability_version')
  ),
  'publish capability version'
);

select ok(
  public.assign_membership_job_function(
    (select id from skills_history_ids where key = 'membership'),
    (select id from skills_history_ids where key = 'job_function'),
    true,
    null
  ) is not null,
  'assign membership job function'
);

select ok(
  public.assign_membership_job_function(
    (select id from skills_history_ids where key = 'membership_expired'),
    (select id from skills_history_ids where key = 'job_function'),
    true,
    null
  ) is not null,
  'assign expired-case membership job function'
);

insert into skills_history_ids (key, id)
select 'validation_b', public.record_skill_validation(
  (select id from skills_history_ids where key = 'membership'),
  (select id from skills_history_ids where key = 'skill'),
  (select id from skills_history_ids where key = 'scale_b_version'),
  (select id from skills_history_ids where key = 'level_b')
);

select is(
  private.derive_skill_gap(
    (select id from skills_history_ids where key = 'membership'),
    (select id from skills_history_ids where key = 'skill')
  ) ->> 'status',
  'incompatible_scale',
  'incompatible scale comparisons fail safely in gap derivation'
);

insert into skills_history_ids (key, id)
select 'expired_validation', public.record_skill_validation(
  (select id from skills_history_ids where key = 'membership_expired'),
  (select id from skills_history_ids where key = 'skill'),
  (select id from skills_history_ids where key = 'scale_a_version'),
  (select id from skills_history_ids where key = 'level_a'),
  statement_timestamp() - interval '30 days',
  null,
  'manager_assessment',
  statement_timestamp() - interval '1 day'
);

select is(
  private.derive_skill_gap(
    (select id from skills_history_ids where key = 'membership_expired'),
    (select id from skills_history_ids where key = 'skill')
  ) ->> 'status',
  'not_assessed',
  'expired skill validation excluded from current validated proficiency'
);

reset role;

select * from finish();
rollback;
