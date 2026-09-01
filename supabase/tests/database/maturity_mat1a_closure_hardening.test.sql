begin;

select plan(28);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '87000000-0000-0000-0000-000000000002',
  'mat1a-hardening@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table mat1a_hardening_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on mat1a_hardening_ids to authenticated;

insert into mat1a_hardening_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '87000000-0000-0000-0000-000000000002',
    'mat1a-hardening-org',
    'MAT1a Hardening Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '88000000-0000-0000-0000-000000000002',
  '87000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"88000000-0000-0000-0000-000000000002","email":"mat1a-hardening@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from mat1a_hardening_ids where key = 'organisation')),
  'owner selects organisation'
);

select ok(
  not exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'start_maturity_assessment'
      and pg_get_function_identity_arguments(procedure_row.oid)
        = 'target_model_version_id uuid, target_unit_id uuid, target_assessment_type text, target_lead_assessor_membership_id uuid'
  ),
  'legacy four-argument start_maturity_assessment overload is removed'
);

insert into mat1a_hardening_ids (key, id)
select 'model', public.create_maturity_model_draft('Hardening Framework', 'Original description');

insert into mat1a_hardening_ids (key, id)
select 'model_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from mat1a_hardening_ids where key = 'organisation')
  and model_version.model_id = (select id from mat1a_hardening_ids where key = 'model')
  and model_version.version_number = 1;

select is(
  (
    select model_version.display_name
    from public.maturity_model_versions model_version
    where model_version.id = (select id from mat1a_hardening_ids where key = 'model_version')
  ),
  'Hardening Framework',
  'draft version stores display name snapshot'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''mat1a-h-site'', ''H Site'', ''plant'')',
    (select id from mat1a_hardening_ids where key = 'organisation')
  ),
  'create site unit'
);

insert into mat1a_hardening_ids (key, id)
select 'site_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_hardening_ids where key = 'organisation')
  and organisation_unit.code = 'mat1a-h-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''mat1a-h-dept'', ''H Department'', ''department'')',
    (select id from mat1a_hardening_ids where key = 'organisation'),
    (select id from mat1a_hardening_ids where key = 'site_unit')
  ),
  'create department unit'
);

insert into mat1a_hardening_ids (key, id)
select 'department_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_hardening_ids where key = 'organisation')
  and organisation_unit.code = 'mat1a-h-dept';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''mat1a-h-line'', ''H Line'', ''line'')',
    (select id from mat1a_hardening_ids where key = 'organisation'),
    (select id from mat1a_hardening_ids where key = 'department_unit')
  ),
  'create line unit'
);

insert into mat1a_hardening_ids (key, id)
select 'line_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_hardening_ids where key = 'organisation')
  and organisation_unit.code = 'mat1a-h-line';

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from mat1a_hardening_ids where key = 'model_version')
  ),
  'add maturity level'
);

insert into mat1a_hardening_ids (key, id)
select 'level', level_row.id
from public.maturity_levels level_row
where level_row.organisation_id = (select id from mat1a_hardening_ids where key = 'organisation')
  and level_row.model_version_id = (select id from mat1a_hardening_ids where key = 'model_version')
  and level_row.level_number = 1;

insert into mat1a_hardening_ids (key, id)
select 'pillar', public.add_maturity_pillar(
  (select id from mat1a_hardening_ids where key = 'model_version'),
  'Leadership',
  1,
  null,
  1,
  null,
  'Leadership'
);

insert into mat1a_hardening_ids (key, id)
select 'criterion', public.add_maturity_criterion(
  (select id from mat1a_hardening_ids where key = 'pillar'),
  'Gemba walks',
  1
);

insert into mat1a_hardening_ids (key, id)
select 'question', public.add_maturity_question(
  (select id from mat1a_hardening_ids where key = 'model_version'),
  (select section_id from public.maturity_pillars where id = (select id from mat1a_hardening_ids where key = 'pillar')),
  'score',
  'Rate Gemba walks',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from mat1a_hardening_ids where key = 'criterion'),
    (select id from mat1a_hardening_ids where key = 'question')
  ),
  'link scored question'
);

select ok(
  public.update_maturity_model_version_metadata(
    (select id from mat1a_hardening_ids where key = 'model_version'),
    'Hardening Framework v1',
    'Version one description'
  ),
  'draft metadata can be edited'
);

select ok(
  public.update_maturity_level(
    (select id from mat1a_hardening_ids where key = 'level'),
    1,
    'Initial revised',
    'maturity-1',
    'Level description',
    'Level guidance'
  ),
  'draft level can be edited'
);

select ok(
  public.publish_maturity_model_version((select id from mat1a_hardening_ids where key = 'model_version')),
  'publish site-only framework version'
);

insert into mat1a_hardening_ids (key, id)
select 'site_assessment', public.start_maturity_assessment(
  (select id from mat1a_hardening_ids where key = 'model_version'),
  (select id from mat1a_hardening_ids where key = 'site_unit'),
  'formal',
  'site'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'', ''department'')',
    (select id from mat1a_hardening_ids where key = 'model_version'),
    (select id from mat1a_hardening_ids where key = 'department_unit')
  ),
  '55000',
  null,
  'site-only framework rejects department scope on scope-aware RPC'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'')',
    (select id from mat1a_hardening_ids where key = 'model_version'),
    (select id from mat1a_hardening_ids where key = 'line_unit')
  ),
  '42883',
  null,
  'legacy four-argument start_maturity_assessment signature cannot bypass semantic scopes'
);

update public.maturity_assessments assessment_row
set unit_id = (select id from mat1a_hardening_ids where key = 'line_unit'),
    assessment_scope_type = 'legacy_unit'
where assessment_row.id = (select id from mat1a_hardening_ids where key = 'site_assessment');

select is(
  (
    select assessment_row.assessment_scope_type
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from mat1a_hardening_ids where key = 'site_assessment')
  ),
  'legacy_unit',
  'historical line assessment can be represented as legacy_unit rather than site'
);

select throws_ok(
  format(
    'select public.set_maturity_model_version_assessment_scopes(%L::uuid, array[''site'', ''organisation'']::text[])',
    (select id from mat1a_hardening_ids where key = 'model_version')
  ),
  '55000',
  null,
  'cannot configure scopes on published version'
);

select ok(
  public.deactivate_maturity_model_version((select id from mat1a_hardening_ids where key = 'model_version')),
  'deactivate published version'
);

insert into mat1a_hardening_ids (key, id)
select 'successor_version', public.create_maturity_model_successor_version(
  (select id from mat1a_hardening_ids where key = 'model')
);

select throws_ok(
  format(
    'select public.set_maturity_model_version_assessment_scopes(%L::uuid, array[''organisation'']::text[])',
    (select id from mat1a_hardening_ids where key = 'successor_version')
  ),
  '22023',
  null,
  'organisation scope cannot be selected for draft frameworks'
);
select ok(
  (select id from mat1a_hardening_ids where key = 'successor_version') is not null,
  'successor can be created from latest archived version after deactivation'
);

select is(
  (
    select model_version.display_name
    from public.maturity_model_versions model_version
    where model_version.id = (select id from mat1a_hardening_ids where key = 'successor_version')
  ),
  'Hardening Framework v1',
  'successor clones version metadata snapshot'
);

select ok(
  public.update_maturity_model_version_metadata(
    (select id from mat1a_hardening_ids where key = 'successor_version'),
    'Hardening Framework v2',
    'Version two description'
  ),
  'successor draft metadata can be edited before publish'
);

select ok(
  public.publish_maturity_model_version((select id from mat1a_hardening_ids where key = 'successor_version')),
  'publish successor version'
);

select is(
  (
    select model_version.display_name
    from public.maturity_model_versions model_version
    where model_version.id = (select id from mat1a_hardening_ids where key = 'model_version')
  ),
  'Hardening Framework v1',
  'historical v1 version metadata remains stable after v2 publish'
);

select is(
  (
    select model_version_id
    from public.maturity_assessments
    where id = (select id from mat1a_hardening_ids where key = 'site_assessment')
  ),
  (select id from mat1a_hardening_ids where key = 'model_version'),
  'historical assessment remains pinned to original framework version'
);

insert into mat1a_hardening_ids (key, id)
select 'unused_model', public.create_maturity_model_draft('Unused Draft Shell');

insert into mat1a_hardening_ids (key, id)
select 'unused_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from mat1a_hardening_ids where key = 'organisation')
  and model_version.model_id = (select id from mat1a_hardening_ids where key = 'unused_model')
  and model_version.version_number = 1;

select ok(
  public.delete_maturity_model_draft_version((select id from mat1a_hardening_ids where key = 'unused_version')),
  'delete only unused draft version'
);

select ok(
  not exists (
    select 1
    from public.maturity_models maturity_model
    where maturity_model.id = (select id from mat1a_hardening_ids where key = 'unused_model')
  ),
  'deleting only unused draft removes empty framework shell'
);

select ok(
  not exists (
    select 1
    from public.maturity_model_version_assessment_scopes scope_row
    where scope_row.scope_type = 'organisation'
  ),
  'organisation is not exposed as selectable framework scope'
);

select * from finish();
rollback;
