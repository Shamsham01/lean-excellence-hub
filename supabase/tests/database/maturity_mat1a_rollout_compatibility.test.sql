begin;

select plan(29);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '87000000-0000-0000-0000-000000000003',
    'mat1a-compat@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '87000000-0000-0000-0000-000000000004',
    'mat1a-compat-foreign@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '87000000-0000-0000-0000-000000000005',
    'mat1a-compat-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table mat1a_compat_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on mat1a_compat_ids to authenticated;

insert into mat1a_compat_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '87000000-0000-0000-0000-000000000003',
    'mat1a-compat-org',
    'MAT1a Compatibility Organisation'
  )
);

insert into mat1a_compat_ids (key, id)
values (
  'foreign_organisation',
  private.provision_organisation(
    '87000000-0000-0000-0000-000000000004',
    'mat1a-compat-foreign',
    'MAT1a Compatibility Foreign Organisation'
  )
);

reset role;
set local role lean_hub_private_owner;

insert into public.organisation_units (
  organisation_id,
  parent_unit_id,
  code,
  name,
  unit_type,
  status
)
select
  organisation.id,
  null,
  'foreign-site',
  'Foreign Site',
  'plant',
  'active'
from public.organisations organisation
where organisation.code = 'mat1a-compat-foreign';

reset role;

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '88000000-0000-0000-0000-000000000003',
    '87000000-0000-0000-0000-000000000003',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '88000000-0000-0000-0000-000000000005',
    '87000000-0000-0000-0000-000000000005',
    statement_timestamp(), statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"88000000-0000-0000-0000-000000000003","email":"mat1a-compat@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from mat1a_compat_ids where key = 'organisation')),
  'owner selects organisation'
);

select ok(
  exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'start_maturity_assessment'
      and pg_get_function_identity_arguments(procedure_row.oid)
        = 'target_model_version_id uuid, target_unit_id uuid, target_assessment_type text, target_lead_assessor_membership_id uuid'
  ),
  '4-arg rollout compatibility RPC exists'
);

insert into mat1a_compat_ids (key, id)
select 'model', public.create_maturity_model_draft('Compatibility Framework');

insert into mat1a_compat_ids (key, id)
select 'model_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and model_version.model_id = (select id from mat1a_compat_ids where key = 'model')
  and model_version.version_number = 1;

select ok(
  public.set_maturity_model_version_assessment_scopes(
    (select id from mat1a_compat_ids where key = 'model_version'),
    array['site', 'department', 'area']::text[]
  ),
  'framework enables site, department, and area scopes'
);

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from mat1a_compat_ids where key = 'model_version')
  ),
  'add maturity level'
);

insert into mat1a_compat_ids (key, id)
select 'pillar', public.add_maturity_pillar(
  (select id from mat1a_compat_ids where key = 'model_version'),
  'Leadership',
  1,
  null,
  1,
  null,
  'Leadership'
);

insert into mat1a_compat_ids (key, id)
select 'criterion', public.add_maturity_criterion(
  (select id from mat1a_compat_ids where key = 'pillar'),
  'Gemba walks',
  1
);

insert into mat1a_compat_ids (key, id)
select 'question', public.add_maturity_question(
  (select id from mat1a_compat_ids where key = 'model_version'),
  (select section_id from public.maturity_pillars where id = (select id from mat1a_compat_ids where key = 'pillar')),
  'score',
  'Rate Gemba walks',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from mat1a_compat_ids where key = 'criterion'),
    (select id from mat1a_compat_ids where key = 'question')
  ),
  'link scored question'
);

select ok(
  public.publish_maturity_model_version((select id from mat1a_compat_ids where key = 'model_version')),
  'publish compatibility framework'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''compat-site'', ''Compat Site'', ''plant'')',
    (select id from mat1a_compat_ids where key = 'organisation')
  ),
  'create site unit'
);

insert into mat1a_compat_ids (key, id)
select 'site_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and organisation_unit.code = 'compat-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''compat-dept'', ''Compat Department'', ''department'')',
    (select id from mat1a_compat_ids where key = 'organisation'),
    (select id from mat1a_compat_ids where key = 'site_unit')
  ),
  'create department unit'
);

insert into mat1a_compat_ids (key, id)
select 'department_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and organisation_unit.code = 'compat-dept';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''compat-area'', ''Compat Area'', ''area'')',
    (select id from mat1a_compat_ids where key = 'organisation'),
    (select id from mat1a_compat_ids where key = 'department_unit')
  ),
  'create area unit'
);

insert into mat1a_compat_ids (key, id)
select 'area_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and organisation_unit.code = 'compat-area';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''compat-line'', ''Compat Line'', ''line'')',
    (select id from mat1a_compat_ids where key = 'organisation'),
    (select id from mat1a_compat_ids where key = 'department_unit')
  ),
  'create line unit'
);

insert into mat1a_compat_ids (key, id)
select 'line_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and organisation_unit.code = 'compat-line';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''compat-team'', ''Compat Team'', ''team'')',
    (select id from mat1a_compat_ids where key = 'organisation')
  ),
  'create team unit'
);

insert into mat1a_compat_ids (key, id)
select 'team_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and organisation_unit.code = 'compat-team';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''compat-org'', ''Compat Organisation Unit'', ''organisation'')',
    (select id from mat1a_compat_ids where key = 'organisation')
  ),
  'create organisation-type unit'
);

insert into mat1a_compat_ids (key, id)
select 'organisation_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and organisation_unit.code = 'compat-org';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''compat-disabled'', ''Disabled Site'', ''plant'')',
    (select id from mat1a_compat_ids where key = 'organisation')
  ),
  'create disabled site unit'
);

insert into mat1a_compat_ids (key, id)
select 'disabled_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and organisation_unit.code = 'compat-disabled';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''compat-finance'', ''Compat Finance'', ''finance'')',
    (select id from mat1a_compat_ids where key = 'organisation')
  ),
  'create unsupported finance unit'
);

insert into mat1a_compat_ids (key, id)
select 'finance_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
  and organisation_unit.code = 'compat-finance';

reset role;
set local role lean_hub_private_owner;

update public.organisation_units organisation_unit
set status = 'retired',
    retired_at = statement_timestamp(),
    status_reason = 'compatibility test retirement'
from public.organisations organisation
where organisation_unit.organisation_id = organisation.id
  and organisation.code = 'mat1a-compat-org'
  and organisation_unit.code = 'compat-disabled';

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"88000000-0000-0000-0000-000000000003","email":"mat1a-compat@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from mat1a_compat_ids where key = 'organisation')),
  'owner re-selects primary organisation'
);

insert into mat1a_compat_ids (key, id)
select 'foreign_unit', organisation_unit.id
from public.organisation_units organisation_unit
join public.organisations organisation
  on organisation.id = organisation_unit.organisation_id
where organisation.code = 'mat1a-compat-foreign'
  and organisation_unit.code = 'foreign-site';

insert into mat1a_compat_ids (key, id)
select 'compat_site_assessment', public.start_maturity_assessment(
  (select id from mat1a_compat_ids where key = 'model_version'),
  (select id from mat1a_compat_ids where key = 'site_unit'),
  'formal'
);

select ok(
  (
    select assessment_row.assessment_scope_type
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from mat1a_compat_ids where key = 'compat_site_assessment')
  ) = 'site',
  '4-arg RPC succeeds for site unit and stores site scope'
);

insert into mat1a_compat_ids (key, id)
select 'compat_dept_assessment', public.start_maturity_assessment(
  (select id from mat1a_compat_ids where key = 'model_version'),
  (select id from mat1a_compat_ids where key = 'department_unit'),
  'formal'
);

select ok(
  (
    select assessment_row.assessment_scope_type
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from mat1a_compat_ids where key = 'compat_dept_assessment')
  ) = 'department',
  '4-arg RPC succeeds for department unit and stores department scope'
);

insert into mat1a_compat_ids (key, id)
select 'compat_area_assessment', public.start_maturity_assessment(
  (select id from mat1a_compat_ids where key = 'model_version'),
  (select id from mat1a_compat_ids where key = 'area_unit'),
  'formal'
);

select ok(
  (
    select assessment_row.assessment_scope_type
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from mat1a_compat_ids where key = 'compat_area_assessment')
  ) = 'area',
  '4-arg RPC succeeds for area unit and stores area scope'
);

insert into mat1a_compat_ids (key, id)
select 'canonical_site_assessment', public.start_maturity_assessment(
  (select id from mat1a_compat_ids where key = 'model_version'),
  (select id from mat1a_compat_ids where key = 'site_unit'),
  'formal',
  'site'
);

select is(
  (
    select assessment_row.assessment_scope_type
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from mat1a_compat_ids where key = 'compat_site_assessment')
  ),
  (
    select assessment_row.assessment_scope_type
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from mat1a_compat_ids where key = 'canonical_site_assessment')
  ),
  '4-arg and 5-arg invocations store identical semantic scope metadata'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'')',
    (select id from mat1a_compat_ids where key = 'model_version'),
    (select id from mat1a_compat_ids where key = 'organisation_unit')
  ),
  '55000',
  null,
  '4-arg RPC rejects organisation semantic scope for new assessments'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'')',
    (select id from mat1a_compat_ids where key = 'model_version'),
    (select id from mat1a_compat_ids where key = 'line_unit')
  ),
  '55000',
  null,
  '4-arg RPC rejects line unit'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'')',
    (select id from mat1a_compat_ids where key = 'model_version'),
    (select id from mat1a_compat_ids where key = 'team_unit')
  ),
  '55000',
  null,
  '4-arg RPC rejects team unit'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'')',
    (select id from mat1a_compat_ids where key = 'model_version'),
    (select id from mat1a_compat_ids where key = 'finance_unit')
  ),
  '55000',
  null,
  '4-arg RPC rejects unsupported legacy unit type'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'')',
    (select id from mat1a_compat_ids where key = 'model_version'),
    (select id from mat1a_compat_ids where key = 'disabled_unit')
  ),
  '55000',
  null,
  '4-arg RPC rejects retired unit'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'')',
    (select id from mat1a_compat_ids where key = 'model_version'),
    (select id from mat1a_compat_ids where key = 'foreign_unit')
  ),
  '55000',
  null,
  '4-arg RPC rejects cross-organisation unit'
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
    (select id from mat1a_compat_ids where key = 'organisation'),
    '87000000-0000-0000-0000-000000000005',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into mat1a_compat_ids (key, id)
select 'unauthorised_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = '87000000-0000-0000-0000-000000000005';

select set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"88000000-0000-0000-0000-000000000003","email":"mat1a-compat@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from mat1a_compat_ids where key = 'organisation')),
  'owner re-selects organisation to grant read-only member access'
);

select ok(
  public.grant_role_version(
    (select id from mat1a_compat_ids where key = 'organisation'),
    (select id from mat1a_compat_ids where key = 'unauthorised_membership'),
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from mat1a_compat_ids where key = 'organisation')
        and role_row.canonical_name = 'finance-validator'
        and role_version.status = 'published'
    ),
    'organisation',
    null
  ) is not null,
  'owner grants organisation-scoped finance-validator role without assess permission'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"88000000-0000-0000-0000-000000000005","email":"mat1a-compat-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from mat1a_compat_ids where key = 'organisation')),
  'member without assess permissions selects organisation'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'')',
    (select id from mat1a_compat_ids where key = 'model_version'),
    (select id from mat1a_compat_ids where key = 'site_unit')
  ),
  '42501',
  null,
  '4-arg RPC rejects member without formal assess permission'
);

select * from finish();
rollback;
