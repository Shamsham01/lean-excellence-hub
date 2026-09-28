begin;

select plan(27);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '91000000-0000-0000-0000-000000000001',
    'struct-owner-a@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'struct-owner-b@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table struct_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on struct_ids to authenticated;

insert into struct_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '91000000-0000-0000-0000-000000000001',
      'struct-tenant-a',
      'Structural Authoring Tenant A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '91000000-0000-0000-0000-000000000002',
      'struct-tenant-b',
      'Structural Authoring Tenant B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '91000000-0000-0000-0000-000000000011',
    '91000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '91000000-0000-0000-0000-000000000012',
    '91000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"91000000-0000-0000-0000-000000000012","email":"struct-owner-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from struct_ids where key = 'org_b')),
  'tenant B owner selects organisation'
);

insert into struct_ids (key, id)
select 'model_b', public.create_maturity_model_draft('Tenant B Framework');

insert into struct_ids (key, id)
select 'version_b', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from struct_ids where key = 'org_b')
  and model_version.model_id = (select id from struct_ids where key = 'model_b');

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from struct_ids where key = 'version_b')
  ),
  'tenant B adds a level'
);

insert into struct_ids (key, id)
select 'pillar_b', public.add_maturity_pillar(
  (select id from struct_ids where key = 'version_b'),
  'Safety',
  1,
  null,
  1,
  null,
  'Safety'
);

insert into struct_ids (key, id)
select 'criterion_b', public.add_maturity_criterion(
  (select id from struct_ids where key = 'pillar_b'),
  'Foreign criterion',
  1
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"91000000-0000-0000-0000-000000000011","email":"struct-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from struct_ids where key = 'org_a')),
  'tenant A owner selects organisation'
);

insert into struct_ids (key, id)
select 'model_a', public.create_maturity_model_draft('CookieWorks Repair Framework');

insert into struct_ids (key, id)
select 'version_v1', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from struct_ids where key = 'org_a')
  and model_version.model_id = (select id from struct_ids where key = 'model_a')
  and model_version.version_number = 1;

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from struct_ids where key = 'version_v1')
  ),
  'tenant A adds a level'
);

insert into struct_ids (key, id)
select 'pillar_safety', public.add_maturity_pillar(
  (select id from struct_ids where key = 'version_v1'),
  'Safety',
  1,
  null,
  1,
  null,
  'Safety'
);

insert into struct_ids (key, id)
select 'pillar_ops', public.add_maturity_pillar(
  (select id from struct_ids where key = 'version_v1'),
  'Operational Performance',
  2,
  null,
  1,
  null,
  'Operational Performance'
);

insert into struct_ids (key, id)
select 'criterion_safety', public.add_maturity_criterion(
  (select id from struct_ids where key = 'pillar_safety'),
  'Safety systems',
  1
);

insert into struct_ids (key, id)
select 'criterion_problem', public.add_maturity_criterion(
  (select id from struct_ids where key = 'pillar_safety'),
  'Problem Solving',
  2
);

insert into struct_ids (key, id)
select 'criterion_kpi', public.add_maturity_criterion(
  (select id from struct_ids where key = 'pillar_ops'),
  'KPI Control',
  1
);

insert into struct_ids (key, id)
select 'question_problem', public.add_maturity_question(
  (select id from struct_ids where key = 'version_v1'),
  (select section_id from public.maturity_pillars where id = (select id from struct_ids where key = 'pillar_safety')),
  'score',
  'Rate problem solving',
  1,
  true
);

insert into struct_ids (key, id)
select 'question_safety', public.add_maturity_question(
  (select id from struct_ids where key = 'version_v1'),
  (select section_id from public.maturity_pillars where id = (select id from struct_ids where key = 'pillar_safety')),
  'score',
  'Rate safety systems',
  2,
  true
);

insert into struct_ids (key, id)
select 'question_kpi', public.add_maturity_question(
  (select id from struct_ids where key = 'version_v1'),
  (select section_id from public.maturity_pillars where id = (select id from struct_ids where key = 'pillar_ops')),
  'score',
  'Rate KPI control',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from struct_ids where key = 'criterion_safety'),
    (select id from struct_ids where key = 'question_problem')
  ),
  'misplaced problem-solving question is linked under Safety'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from struct_ids where key = 'criterion_problem'),
    (select id from struct_ids where key = 'question_safety')
  ),
  'safety question linked under Problem Solving criterion'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from struct_ids where key = 'criterion_kpi'),
    (select id from struct_ids where key = 'question_kpi')
  ),
  'KPI question linked'
);

select ok(
  public.publish_maturity_model_version((select id from struct_ids where key = 'version_v1')),
  'published version with structural mistake'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''plant-a'', ''Plant A'', ''site'')',
    (select id from struct_ids where key = 'org_a')
  ),
  'create site for historical assessment'
);

insert into struct_ids (key, id)
select 'unit_a', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from struct_ids where key = 'org_a')
  and organisation_unit.code = 'plant-a';

insert into struct_ids (key, id)
select 'assessment_v1', public.start_maturity_assessment(
  (select id from struct_ids where key = 'version_v1'),
  (select id from struct_ids where key = 'unit_a'),
  'self',
  'site'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 4)',
    (select id from struct_ids where key = 'assessment_v1'),
    (select id from struct_ids where key = 'question_problem')
  ),
  'historical assessment records a score against the original question'
);

select throws_ok(
  format(
    'select public.move_maturity_question(%L::uuid, %L::uuid)',
    (select id from struct_ids where key = 'question_problem'),
    (select id from struct_ids where key = 'criterion_problem')
  ),
  '55000',
  'maturity question is not editable',
  'published version cannot be structurally modified'
);

insert into struct_ids (key, id)
select 'version_v2', public.create_maturity_model_successor_version(
  (select id from struct_ids where key = 'model_a')
);

insert into struct_ids (key, id)
select 'v2_safety_criterion', criterion_row.id
from public.maturity_criteria criterion_row
join public.maturity_pillars pillar_row
  on pillar_row.id = criterion_row.pillar_id
where pillar_row.model_version_id = (select id from struct_ids where key = 'version_v2')
  and criterion_row.name = 'Safety systems';

insert into struct_ids (key, id)
select 'v2_problem_criterion', criterion_row.id
from public.maturity_criteria criterion_row
join public.maturity_pillars pillar_row
  on pillar_row.id = criterion_row.pillar_id
where pillar_row.model_version_id = (select id from struct_ids where key = 'version_v2')
  and criterion_row.name = 'Problem Solving';

insert into struct_ids (key, id)
select 'v2_kpi_criterion', criterion_row.id
from public.maturity_criteria criterion_row
join public.maturity_pillars pillar_row
  on pillar_row.id = criterion_row.pillar_id
where pillar_row.model_version_id = (select id from struct_ids where key = 'version_v2')
  and criterion_row.name = 'KPI Control';

insert into struct_ids (key, id)
select 'v2_ops_pillar', pillar_row.id
from public.maturity_pillars pillar_row
where pillar_row.model_version_id = (select id from struct_ids where key = 'version_v2')
  and pillar_row.name = 'Operational Performance';

insert into struct_ids (key, id)
select 'v2_safety_pillar', pillar_row.id
from public.maturity_pillars pillar_row
where pillar_row.model_version_id = (select id from struct_ids where key = 'version_v2')
  and pillar_row.name = 'Safety';

insert into struct_ids (key, id)
select 'v2_problem_question', question_link.question_id
from public.maturity_criterion_questions question_link
where question_link.criterion_id = (select id from struct_ids where key = 'v2_safety_criterion');

insert into struct_ids (key, id)
select 'v2_safety_question', question_link.question_id
from public.maturity_criterion_questions question_link
where question_link.criterion_id = (select id from struct_ids where key = 'v2_problem_criterion');

select ok(
  public.move_maturity_question(
    (select id from struct_ids where key = 'v2_problem_question'),
    (select id from struct_ids where key = 'v2_problem_criterion')
  ),
  'move question to another criterion in the same pillar'
);

select is(
  (
    select question_link.criterion_id
    from public.maturity_criterion_questions question_link
    where question_link.question_id = (select id from struct_ids where key = 'v2_problem_question')
  ),
  (select id from struct_ids where key = 'v2_problem_criterion'),
  'same-pillar reparent updates criterion link'
);

select ok(
  public.move_maturity_question(
    (select id from struct_ids where key = 'v2_safety_question'),
    (select id from struct_ids where key = 'v2_kpi_criterion')
  ),
  'move question to a criterion in another pillar'
);

select is(
  (
    select question_row.section_id
    from public.template_questions question_row
    where question_row.id = (select id from struct_ids where key = 'v2_safety_question')
  ),
  (
    select pillar_row.section_id
    from public.maturity_pillars pillar_row
    where pillar_row.id = (select id from struct_ids where key = 'v2_ops_pillar')
  ),
  'cross-pillar question move updates template_questions.section_id'
);

select ok(
  public.move_maturity_criterion(
    (select id from struct_ids where key = 'v2_problem_criterion'),
    (select id from struct_ids where key = 'v2_ops_pillar'),
    2
  ),
  'move criterion to another pillar'
);

select is(
  (
    select criterion_row.pillar_id
    from public.maturity_criteria criterion_row
    where criterion_row.id = (select id from struct_ids where key = 'v2_problem_criterion')
  ),
  (select id from struct_ids where key = 'v2_ops_pillar'),
  'moved criterion belongs to the destination pillar'
);

select is(
  (
    select question_row.section_id
    from public.template_questions question_row
    where question_row.id = (select id from struct_ids where key = 'v2_problem_question')
  ),
  (
    select pillar_row.section_id
    from public.maturity_pillars pillar_row
    where pillar_row.id = (select id from struct_ids where key = 'v2_ops_pillar')
  ),
  'questions follow the criterion into the destination pillar section'
);

select throws_ok(
  format(
    'select public.move_maturity_criterion(%L::uuid, %L::uuid)',
    (select id from struct_ids where key = 'v2_kpi_criterion'),
    (select id from struct_ids where key = 'criterion_b')
  ),
  '55000',
  'target maturity pillar is not editable',
  'cross-tenant criterion move is rejected'
);

insert into struct_ids (key, id)
select 'v2_disposable_criterion', public.add_maturity_criterion(
  (select id from struct_ids where key = 'v2_safety_pillar'),
  'Disposable',
  2
);

insert into struct_ids (key, id)
select 'v2_disposable_question', public.add_maturity_question(
  (select id from struct_ids where key = 'version_v2'),
  (select section_id from public.maturity_pillars where id = (select id from struct_ids where key = 'v2_safety_pillar')),
  'score',
  'Disposable question',
  3,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from struct_ids where key = 'v2_disposable_criterion'),
    (select id from struct_ids where key = 'v2_disposable_question')
  ),
  'link disposable question'
);

select ok(
  public.delete_maturity_criterion((select id from struct_ids where key = 'v2_disposable_criterion')),
  'delete draft criterion and contained question'
);

select ok(
  not exists (
    select 1
    from public.template_questions question_row
    where question_row.id = (select id from struct_ids where key = 'v2_disposable_question')
  ),
  'contained question is removed with the criterion'
);

insert into struct_ids (key, id)
select 'v2_replacement_question', public.add_maturity_question(
  (select id from struct_ids where key = 'version_v2'),
  (select section_id from public.maturity_pillars where id = (select id from struct_ids where key = 'v2_safety_pillar')),
  'score',
  'Rate remaining safety systems',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from struct_ids where key = 'v2_safety_criterion'),
    (select id from struct_ids where key = 'v2_replacement_question')
  ),
  'replacement scored question keeps Safety systems publishable'
);

select ok(
  public.publish_maturity_model_version((select id from struct_ids where key = 'version_v2')),
  'corrected successor publishes'
);

select is(
  (
    select assessment_row.model_version_id
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from struct_ids where key = 'assessment_v1')
  ),
  (select id from struct_ids where key = 'version_v1'),
  'historical assessment remains pinned to the original published version'
);

select is(
  (
    select question_link.criterion_id
    from public.maturity_criterion_questions question_link
    where question_link.question_id = (select id from struct_ids where key = 'question_problem')
  ),
  (select id from struct_ids where key = 'criterion_safety'),
  'original published question link is unchanged after successor repair'
);

insert into struct_ids (key, id)
select 'assessment_v2', public.start_maturity_assessment(
  (select id from struct_ids where key = 'version_v2'),
  (select id from struct_ids where key = 'unit_a'),
  'self',
  'site'
);

select is(
  (
    select assessment_row.model_version_id
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from struct_ids where key = 'assessment_v2')
  ),
  (select id from struct_ids where key = 'version_v2'),
  'new assessment uses the corrected successor structure'
);

select * from finish();
rollback;
