begin;

select plan(11);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'c5c10000-0000-0000-0000-000000000001', 'five-s-type-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table type_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on type_ids to authenticated;

insert into type_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c5c10000-0000-0000-0000-000000000001',
    'five-s-type-org',
    'Five S Type Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'c5c10000-0000-0000-0000-000000000011',
  'c5c10000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c5c10000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c5c10000-0000-0000-0000-000000000011","email":"five-s-type-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from type_ids where key = 'organisation')),
  'owner selects the type org'
);

insert into type_ids (key, id)
select 'packing', public.create_organisation_unit(
  (select id from type_ids where key = 'organisation'),
  null,
  'type-packing',
  'Packing',
  'department'
);

insert into type_ids (key, id)
select 'standard', public.create_five_s_standard_draft(
  'Type gate',
  null,
  80,
  array[(select id from type_ids where key = 'packing')]
);

insert into type_ids (key, id)
select 'v1', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from type_ids where key = 'standard');

select lives_ok(
  format(
    'select public.set_five_s_standard_scoring_scale(%L::uuid, 1, 5, 1)',
    (select id from type_ids where key = 'v1')
  ),
  'draft receives a 1 to 5 scale'
);

insert into type_ids (key, id)
select 'section', public.add_five_s_section(
  (select id from type_ids where key = 'v1'),
  'Sort',
  1
);

select throws_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''short_text'', ''Free text prompt'', 1)',
    (select id from type_ids where key = 'v1'),
    (select id from type_ids where key = 'section')
  ),
  '22023',
  '5S question type is not supported',
  'add_five_s_question rejects short_text'
);

select throws_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''number'', ''Numeric prompt'', 1, true, false, null, null, true, ''{"type":"direct"}''::jsonb, 1)',
    (select id from type_ids where key = 'v1'),
    (select id from type_ids where key = 'section')
  ),
  '22023',
  '5S question type is not supported',
  'add_five_s_question rejects number'
);

select throws_ok(
  format(
    $sql$
      select public.create_five_s_standard_draft_from_definition(
        'leh-workplace-5s-standard',
        '{"key":"leh-workplace-5s-standard","name":"Text","description":"Text","thresholdPercent":80,"scoringScale":{"min":1,"max":5,"step":1},"categories":[{"name":"Sort","questions":[{"prompt":"What is wrong?","questionType":"short_text","helpText":null}]}]}'::jsonb,
        array[%L]::uuid[]
      )
    $sql$,
    (select id from type_ids where key = 'packing')
  ),
  '22023',
  '5S standard definition has an unsupported question type',
  'definition writer rejects short_text'
);

create temporary table category_scores (
  category_position integer not null,
  category_name text not null,
  question_index integer not null,
  prompt text not null,
  primary key (category_position, question_index)
) on commit drop;

insert into category_scores (category_position, category_name, question_index, prompt)
values
  (1, 'Sort', 1, 'How consistently is Sort score 1?'),
  (1, 'Sort', 2, 'How consistently is Sort score 2?'),
  (1, 'Sort', 3, 'How consistently is Sort score 3?'),
  (1, 'Sort', 4, 'How consistently is Sort score 4?'),
  (2, 'Set in Order', 1, 'How consistently is Set score 1?'),
  (2, 'Set in Order', 2, 'How consistently is Set score 2?'),
  (2, 'Set in Order', 3, 'How consistently is Set score 3?'),
  (2, 'Set in Order', 4, 'How consistently is Set score 4?'),
  (3, 'Shine', 1, 'How consistently is Shine score 1?'),
  (3, 'Shine', 2, 'How consistently is Shine score 2?'),
  (3, 'Shine', 3, 'How consistently is Shine score 3?'),
  (3, 'Shine', 4, 'How consistently is Shine score 4?'),
  (4, 'Standardise', 1, 'How consistently is Standardise score 1?'),
  (4, 'Standardise', 2, 'How consistently is Standardise score 2?'),
  (4, 'Standardise', 3, 'How consistently is Standardise score 3?'),
  (4, 'Standardise', 4, 'How consistently is Standardise score 4?'),
  (5, 'Sustain', 1, 'How consistently is Sustain score 1?'),
  (5, 'Sustain', 2, 'How consistently is Sustain score 2?'),
  (5, 'Sustain', 3, 'How consistently is Sustain score 3?'),
  (5, 'Sustain', 4, 'How consistently is Sustain score 4?');

insert into type_ids (key, id)
select 'deployed_standard', public.create_five_s_standard_draft_from_definition(
  'leh-workplace-5s-standard',
  jsonb_build_object(
    'key', 'leh-workplace-5s-standard',
    'name', 'LEH Workplace 5S Standard',
    'description', 'Score-only workplace starting point.',
    'thresholdPercent', 80,
    'scoringScale', jsonb_build_object('min', 1, 'max', 5, 'step', 1),
    'categories', (
      select jsonb_agg(
        jsonb_build_object(
          'name', category_row.category_name,
          'questions', category_row.questions
        )
        order by category_row.category_position
      )
      from (
        select
          cs.category_position,
          cs.category_name,
          jsonb_agg(
            jsonb_build_object(
              'prompt', cs.prompt,
              'questionType', 'score',
              'helpText', null
            )
            order by cs.question_index
          ) as questions
        from category_scores cs
        group by cs.category_position, cs.category_name
        order by cs.category_position
      ) category_row
    )
  ),
  array[(select id from type_ids where key = 'packing')]::uuid[]
);

select ok(
  (select id from type_ids where key = 'deployed_standard') is not null,
  'quick-start style definition deploys'
);

insert into type_ids (key, id)
select 'deployed_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from type_ids where key = 'deployed_standard')
  and version_row.status = 'draft';

select is(
  (
    select count(*)::integer
    from public.template_sections section_row
    join public.five_s_standard_versions version_row
      on version_row.template_version_id = section_row.template_version_id
    where version_row.id = (select id from type_ids where key = 'deployed_version')
  ),
  5,
  'deployment creates five categories'
);

select is(
  (
    select count(*)::integer
    from public.template_questions question_row
    join public.five_s_standard_versions version_row
      on version_row.template_version_id = question_row.template_version_id
    where version_row.id = (select id from type_ids where key = 'deployed_version')
  ),
  20,
  'deployment creates twenty score questions'
);

select is(
  (
    select version_row.scoring_scale
    from public.five_s_standard_versions version_row
    where version_row.id = (select id from type_ids where key = 'deployed_version')
  ),
  '{"min":1,"max":5,"step":1}'::jsonb,
  'deployment sets the default 1 to 5 scoring scale'
);

select is(
  (
    select count(*)::integer
    from public.template_questions question_row
    join public.five_s_standard_versions version_row
      on version_row.template_version_id = question_row.template_version_id
    where version_row.id = (select id from type_ids where key = 'deployed_version')
      and question_row.question_type <> 'score'
  ),
  0,
  'deployed questions are all score type'
);

select is(
  (
    select count(*)::integer
    from public.five_s_question_scoring scoring_row
  where scoring_row.standard_version_id = (select id from type_ids where key = 'deployed_version')
      and scoring_row.contributes_to_score = true
      and scoring_row.scoring_metadata = '{"type":"direct"}'::jsonb
  ),
  20,
  'deployed scoring rows use direct scale metadata'
);

select * from finish();
rollback;
