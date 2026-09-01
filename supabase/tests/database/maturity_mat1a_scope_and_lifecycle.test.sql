begin;

select plan(23);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '87000000-0000-0000-0000-000000000001',
  'mat1a-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table mat1a_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on mat1a_ids to authenticated;

insert into mat1a_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '87000000-0000-0000-0000-000000000001',
    'mat1a-org',
    'MAT1a Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '88000000-0000-0000-0000-000000000001',
  '87000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"87000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"88000000-0000-0000-0000-000000000001","email":"mat1a-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from mat1a_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into mat1a_ids (key, id)
select 'model', public.create_maturity_model_draft('MAT1a Framework');

insert into mat1a_ids (key, id)
select 'model_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from mat1a_ids where key = 'organisation')
  and model_version.model_id = (select id from mat1a_ids where key = 'model')
  and model_version.version_number = 1;

select ok(
  exists (
    select 1
    from public.maturity_model_version_assessment_scopes scope_row
    where scope_row.organisation_id = (select id from mat1a_ids where key = 'organisation')
      and scope_row.model_version_id = (select id from mat1a_ids where key = 'model_version')
      and scope_row.scope_type = 'site'
  ),
  'new draft defaults to site assessment scope'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''mat1a-site'', ''MAT1a Site'', ''plant'')',
    (select id from mat1a_ids where key = 'organisation')
  ),
  'create site unit'
);

insert into mat1a_ids (key, id)
select 'site_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_ids where key = 'organisation')
  and organisation_unit.code = 'mat1a-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''mat1a-dept'', ''MAT1a Department'', ''department'')',
    (select id from mat1a_ids where key = 'organisation'),
    (select id from mat1a_ids where key = 'site_unit')
  ),
  'create department unit'
);

insert into mat1a_ids (key, id)
select 'department_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_ids where key = 'organisation')
  and organisation_unit.code = 'mat1a-dept';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''mat1a-line'', ''MAT1a Line'', ''line'')',
    (select id from mat1a_ids where key = 'organisation'),
    (select id from mat1a_ids where key = 'department_unit')
  ),
  'create line unit'
);

insert into mat1a_ids (key, id)
select 'line_unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from mat1a_ids where key = 'organisation')
  and organisation_unit.code = 'mat1a-line';

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from mat1a_ids where key = 'model_version')
  ),
  'add maturity level'
);

insert into mat1a_ids (key, id)
select 'pillar', public.add_maturity_pillar(
  (select id from mat1a_ids where key = 'model_version'),
  'Leadership',
  1,
  null,
  1,
  null,
  'Leadership'
);

insert into mat1a_ids (key, id)
select 'criterion', public.add_maturity_criterion(
  (select id from mat1a_ids where key = 'pillar'),
  'Gemba walks',
  1
);

insert into mat1a_ids (key, id)
select 'question', public.add_maturity_question(
  (select id from mat1a_ids where key = 'model_version'),
  (select section_id from public.maturity_pillars where id = (select id from mat1a_ids where key = 'pillar')),
  'score',
  'Rate Gemba walks',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from mat1a_ids where key = 'criterion'),
    (select id from mat1a_ids where key = 'question')
  ),
  'link scored question'
);

select ok(
  public.publish_maturity_model_version((select id from mat1a_ids where key = 'model_version')),
  'publish site-only framework version'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'', ''department'')',
    (select id from mat1a_ids where key = 'model_version'),
    (select id from mat1a_ids where key = 'department_unit')
  ),
  '55000',
  null,
  'site-only framework rejects department scope'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'', ''site'')',
    (select id from mat1a_ids where key = 'model_version'),
    (select id from mat1a_ids where key = 'line_unit')
  ),
  '55000',
  null,
  'site-only framework rejects line unit even when site scope selected'
);

insert into mat1a_ids (key, id)
select 'assessment_v1', public.start_maturity_assessment(
  (select id from mat1a_ids where key = 'model_version'),
  (select id from mat1a_ids where key = 'site_unit'),
  'formal',
  'site'
);

select ok(
  (select assessment_scope_type from public.maturity_assessments
    where id = (select id from mat1a_ids where key = 'assessment_v1')) = 'site',
  'assessment stores semantic scope type'
);

select throws_ok(
  format(
    'select public.set_maturity_model_version_assessment_scopes(%L::uuid, array[''site'', ''department'']::text[])',
    (select id from mat1a_ids where key = 'model_version')
  ),
  '55000',
  null,
  'cannot configure scopes on published version'
);

insert into mat1a_ids (key, id)
select 'successor_version', public.create_maturity_model_successor_version(
  (select id from mat1a_ids where key = 'model')
);

select ok(
  public.set_maturity_model_version_assessment_scopes(
    (select id from mat1a_ids where key = 'successor_version'),
    array['site', 'department']::text[]
  ),
  'draft successor accepts department scope configuration'
);

select ok(
  exists (
    select 1
    from public.maturity_model_version_assessment_scopes scope_row
    where scope_row.organisation_id = (select id from mat1a_ids where key = 'organisation')
      and scope_row.model_version_id = (select id from mat1a_ids where key = 'successor_version')
      and scope_row.scope_type = 'department'
  ),
  'successor draft stores configured department scope'
);

select ok(
  public.publish_maturity_model_version((select id from mat1a_ids where key = 'successor_version')),
  'publish successor version'
);

insert into mat1a_ids (key, id)
select 'successor_criterion', criterion_row.id
from public.maturity_criteria criterion_row
join public.maturity_pillars pillar_row
  on pillar_row.organisation_id = criterion_row.organisation_id
 and pillar_row.id = criterion_row.pillar_id
where pillar_row.organisation_id = (select id from mat1a_ids where key = 'organisation')
  and pillar_row.model_version_id = (select id from mat1a_ids where key = 'successor_version')
order by criterion_row.position
limit 1;

select is(
  (select status from public.maturity_model_versions
    where id = (select id from mat1a_ids where key = 'model_version')),
  'archived',
  'prior published version is superseded/archived after successor publish'
);

select is(
  (select model_version_id from public.maturity_assessments
    where id = (select id from mat1a_ids where key = 'assessment_v1')),
  (select id from mat1a_ids where key = 'model_version'),
  'historical assessment remains pinned to original framework version'
);

insert into mat1a_ids (key, id)
select 'assessment_v2', public.start_maturity_assessment(
  (select id from mat1a_ids where key = 'successor_version'),
  (select id from mat1a_ids where key = 'department_unit'),
  'formal',
  'department'
);

select ok(
  exists (
    select 1
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from mat1a_ids where key = 'assessment_v2')
      and assessment_row.assessment_scope_type = 'department'
  ),
  'successor version accepts configured department assessment scope'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_criterion_note(%L::uuid, %L::uuid, %L)',
    (select id from mat1a_ids where key = 'assessment_v2'),
    (select id from mat1a_ids where key = 'successor_criterion'),
    'Department-level assessor commentary'
  ),
  'assessor comment persists on assessment criterion'
);

select ok(
  exists (
    select 1
    from public.maturity_assessment_criterion_notes note_row
    where note_row.organisation_id = (select id from mat1a_ids where key = 'organisation')
      and note_row.assessment_id = (select id from mat1a_ids where key = 'assessment_v2')
      and note_row.comment_text = 'Department-level assessor commentary'
  ),
  'assessor comment is readable after save'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'', ''site'')',
    (select id from mat1a_ids where key = 'model_version'),
    (select id from mat1a_ids where key = 'site_unit')
  ),
  '55000',
  null,
  'archived framework version cannot start new assessments'
);

select ok(
  (
    select count(*)
    from public.list_maturity_assessment_scope_entities(
      (select id from mat1a_ids where key = 'successor_version'),
      'site'
    )
  ) >= 1,
  'scope listing returns eligible site entities only'
);

select ok(
  (
    select count(*)
    from public.list_maturity_assessment_scope_entities(
      (select id from mat1a_ids where key = 'successor_version'),
      'site'
    ) scope_entity
    where scope_entity.unit_id = (select id from mat1a_ids where key = 'line_unit')
  ) = 0,
  'scope listing excludes unrelated line units for site scope'
);

select * from finish();
rollback;
