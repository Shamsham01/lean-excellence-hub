begin;

select plan(13);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '83000000-0000-0000-0000-000000000001',
  'snapshot-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table snapshot_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on snapshot_ids to authenticated;

insert into snapshot_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '83000000-0000-0000-0000-000000000001',
    'snapshot-org',
    'Snapshot Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '84000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"84000000-0000-0000-0000-000000000001","email":"snapshot-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from snapshot_ids where key = 'organisation')),
  'snapshot owner selects organisation'
);

insert into snapshot_ids (key, id)
select 'model', public.create_maturity_model_draft('Historical Framework');

insert into snapshot_ids (key, id)
select 'model_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from snapshot_ids where key = 'organisation')
  and model_version.model_id = (select id from snapshot_ids where key = 'model')
  and model_version.version_number = 1;

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from snapshot_ids where key = 'model_version')
  ),
  'add level for snapshot test'
);

insert into snapshot_ids (key, id)
select 'pillar', public.add_maturity_pillar(
  (select id from snapshot_ids where key = 'model_version'),
  'Leadership Pillar',
  1,
  null,
  1,
  null,
  'Leadership'
);

insert into snapshot_ids (key, id)
select 'criterion', public.add_maturity_criterion(
  (select id from snapshot_ids where key = 'pillar'),
  'Leadership criterion',
  1
);

insert into snapshot_ids (key, id)
select 'question', public.add_maturity_question(
  (select id from snapshot_ids where key = 'model_version'),
  (select section_id from public.maturity_pillars
    where id = (select id from snapshot_ids where key = 'pillar')),
  'score',
  'Rate leadership',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from snapshot_ids where key = 'criterion'),
    (select id from snapshot_ids where key = 'question')
  ),
  'link scored question for snapshot test'
);

select ok(
  public.publish_maturity_model_version((select id from snapshot_ids where key = 'model_version')),
  'publish framework for snapshot test'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''snapshot-unit'', ''Cornwall Plant'', ''site'')',
    (select id from snapshot_ids where key = 'organisation')
  ),
  'create unit for snapshot assessment'
);

insert into snapshot_ids (key, id)
select 'unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from snapshot_ids where key = 'organisation')
  and organisation_unit.code = 'snapshot-unit';

insert into snapshot_ids (key, id)
select 'assessment', public.start_maturity_assessment(
  (select id from snapshot_ids where key = 'model_version'),
  (select id from snapshot_ids where key = 'unit'),
  'formal'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 4)',
    (select id from snapshot_ids where key = 'assessment'),
    (select id from snapshot_ids where key = 'question')
  ),
  'answer scored question for snapshot test'
);

select ok(
  public.submit_maturity_assessment((select id from snapshot_ids where key = 'assessment')),
  'submit assessment for snapshot test'
);

select ok(
  public.begin_assessor_review((select id from snapshot_ids where key = 'assessment')),
  'begin assessor review for snapshot test'
);

select ok(
  public.approve_maturity_assessment((select id from snapshot_ids where key = 'assessment')),
  'approve assessment for snapshot test'
);

insert into snapshot_ids (key, id)
select 'official_result', public.publish_official_maturity_result(
  (select id from snapshot_ids where key = 'assessment')
);

reset role;
set local role lean_hub_private_owner;

update public.maturity_models maturity_model
set display_name = 'Renamed Framework'
from public.organisations organisation
where maturity_model.organisation_id = organisation.id
  and organisation.code = 'snapshot-org'
  and maturity_model.display_name = 'Historical Framework';

update public.organisation_units organisation_unit
set name = 'Renamed Plant'
from public.organisations organisation
where organisation_unit.organisation_id = organisation.id
  and organisation.code = 'snapshot-org'
  and organisation_unit.code = 'snapshot-unit';

update public.maturity_levels level_row
set name = 'Renamed Level'
from public.organisations organisation
join public.maturity_model_versions model_version
  on model_version.organisation_id = organisation.id
where level_row.organisation_id = organisation.id
  and organisation.code = 'snapshot-org'
  and level_row.model_version_id = model_version.id
  and model_version.version_number = 1
  and level_row.level_number = 1;

update public.maturity_pillars pillar_row
set name = 'Renamed Pillar'
from public.organisations organisation
join public.maturity_model_versions model_version
  on model_version.organisation_id = organisation.id
where pillar_row.organisation_id = organisation.id
  and organisation.code = 'snapshot-org'
  and pillar_row.model_version_id = model_version.id
  and pillar_row.position = 1;

select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"84000000-0000-0000-0000-000000000001","email":"snapshot-owner@example.test"}',
  true
);
set local role authenticated;

select is(
  (
    select official_result.model_name_snapshot
    from public.maturity_official_results official_result
    join public.organisations organisation
      on organisation.id = official_result.organisation_id
    where organisation.code = 'snapshot-org'
      and official_result.model_name_snapshot = 'Historical Framework'
  ),
  'Historical Framework',
  'official result preserves model name snapshot after rename'
);

select is(
  (
    select official_result.unit_name_snapshot
    from public.maturity_official_results official_result
    join public.organisations organisation
      on organisation.id = official_result.organisation_id
    where organisation.code = 'snapshot-org'
      and official_result.model_name_snapshot = 'Historical Framework'
  ),
  'Cornwall Plant',
  'official result preserves unit name snapshot after rename'
);

select is(
  (
    select level_snapshot.name
    from public.maturity_official_result_levels level_snapshot
    join public.maturity_official_results official_result
      on official_result.organisation_id = level_snapshot.organisation_id
     and official_result.id = level_snapshot.official_result_id
    join public.organisations organisation
      on organisation.id = official_result.organisation_id
    where organisation.code = 'snapshot-org'
      and official_result.model_name_snapshot = 'Historical Framework'
      and level_snapshot.level_number = 1
  ),
  'Initial',
  'official result preserves level label snapshot after rename'
);

select is(
  (
    select pillar_snapshot.pillar_name
    from public.maturity_official_result_pillars pillar_snapshot
    join public.maturity_official_results official_result
      on official_result.organisation_id = pillar_snapshot.organisation_id
     and official_result.id = pillar_snapshot.official_result_id
    join public.organisations organisation
      on organisation.id = official_result.organisation_id
    where organisation.code = 'snapshot-org'
      and official_result.model_name_snapshot = 'Historical Framework'
  ),
  'Leadership Pillar',
  'official result preserves pillar name snapshot after rename'
);

select * from finish();
rollback;
