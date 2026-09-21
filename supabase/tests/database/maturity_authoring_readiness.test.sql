begin;

select plan(10);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '71000000-0000-0000-0000-000000000001',
  'maturity-authoring@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table maturity_authoring_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on maturity_authoring_ids to authenticated;

insert into maturity_authoring_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '71000000-0000-0000-0000-000000000001',
    'maturity-authoring-org',
    'Maturity Authoring Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '71000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"71000000-0000-0000-0000-000000000002","email":"maturity-authoring@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from maturity_authoring_ids where key = 'organisation')),
  'authoring owner selects organisation'
);

insert into maturity_authoring_ids (key, id)
select 'model', public.create_maturity_model_draft('Authoring Framework');

insert into maturity_authoring_ids (key, id)
select 'model_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from maturity_authoring_ids where key = 'organisation')
  and model_version.model_id = (select id from maturity_authoring_ids where key = 'model')
  and model_version.version_number = 1;

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from maturity_authoring_ids where key = 'model_version')
  ),
  'add maturity level'
);

insert into maturity_authoring_ids (key, id)
select 'pillar', public.add_maturity_pillar(
  (select id from maturity_authoring_ids where key = 'model_version'),
  'Leadership',
  1,
  null,
  1,
  null,
  'Leadership'
);

insert into maturity_authoring_ids (key, id)
select 'criterion_one', public.add_maturity_criterion(
  (select id from maturity_authoring_ids where key = 'pillar'),
  'Gemba walks',
  1
);

insert into maturity_authoring_ids (key, id)
select 'criterion_two', public.add_maturity_criterion(
  (select id from maturity_authoring_ids where key = 'pillar'),
  'Standard work',
  2
);

insert into maturity_authoring_ids (key, id)
select 'question_one', public.add_maturity_question(
  (select id from maturity_authoring_ids where key = 'model_version'),
  (select section_id from public.maturity_pillars where id = (select id from maturity_authoring_ids where key = 'pillar')),
  'score',
  'Rate Gemba walks',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from maturity_authoring_ids where key = 'criterion_one'),
    (select id from maturity_authoring_ids where key = 'question_one')
  ),
  'link first scored question'
);

select throws_ok(
  format(
    'select public.publish_maturity_model_version(%L::uuid)',
    (select id from maturity_authoring_ids where key = 'model_version')
  ),
  '55000',
  'maturity model version requires a scored question for every criterion',
  'publish blocked when criterion lacks scored question'
);

insert into maturity_authoring_ids (key, id)
select 'question_two', public.add_maturity_question(
  (select id from maturity_authoring_ids where key = 'model_version'),
  (select section_id from public.maturity_pillars where id = (select id from maturity_authoring_ids where key = 'pillar')),
  'score',
  'Rate standard work',
  2,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from maturity_authoring_ids where key = 'criterion_two'),
    (select id from maturity_authoring_ids where key = 'question_two')
  ),
  'link second scored question in same pillar without position collision'
);

select ok(
  public.publish_maturity_model_version((select id from maturity_authoring_ids where key = 'model_version')),
  'complete framework publishes'
);

insert into maturity_authoring_ids (key, id)
select 'successor_version', public.create_maturity_model_successor_version(
  (select id from maturity_authoring_ids where key = 'model')
);

select is(
  (
    select count(*)
    from public.template_questions question_row
    join public.maturity_pillars pillar_row
      on pillar_row.section_id = question_row.section_id
    where pillar_row.organisation_id = (select id from maturity_authoring_ids where key = 'organisation')
      and pillar_row.model_version_id = (select id from maturity_authoring_ids where key = 'successor_version')
  ),
  2::bigint,
  'successor draft clones pillar questions'
);

select ok(
  (
    select array_agg(question_row.position order by question_row.position)
    from public.template_questions question_row
    join public.maturity_pillars pillar_row
      on pillar_row.section_id = question_row.section_id
    where pillar_row.organisation_id = (select id from maturity_authoring_ids where key = 'organisation')
      and pillar_row.model_version_id = (select id from maturity_authoring_ids where key = 'successor_version')
  ) = array[1, 2],
  'successor draft preserves deterministic pillar-local positions'
);

select is(
  (
    select count(*)
    from public.maturity_criterion_questions question_link
    join public.maturity_criteria criterion_row
      on criterion_row.id = question_link.criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.id = criterion_row.pillar_id
    where pillar_row.organisation_id = (select id from maturity_authoring_ids where key = 'organisation')
      and pillar_row.model_version_id = (select id from maturity_authoring_ids where key = 'successor_version')
      and question_link.contributes_to_score = true
  ),
  2::bigint,
  'successor draft preserves criterion question links'
);

select throws_ok(
  format(
    'select public.add_maturity_question(%L::uuid, %L::uuid, ''score'', ''Duplicate position'', 1, true)',
    (select id from maturity_authoring_ids where key = 'successor_version'),
    (
      select section_id
      from public.maturity_pillars pillar_row
      where pillar_row.organisation_id = (select id from maturity_authoring_ids where key = 'organisation')
        and pillar_row.model_version_id = (select id from maturity_authoring_ids where key = 'successor_version')
      order by pillar_row.position
      limit 1
    )
  ),
  '23505',
  null,
  'duplicate pillar-local position remains rejected'
);

select * from finish();
rollback;
