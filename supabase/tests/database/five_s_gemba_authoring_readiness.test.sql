begin;

select plan(28);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '70000000-0000-0000-0000-000000000070',
  'five-s-gemba-authoring@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table authoring_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on authoring_ids to authenticated;

insert into authoring_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '70000000-0000-0000-0000-000000000070',
    'five-s-gemba-authoring-org',
    'Five S Gemba Authoring Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '70000000-0000-0000-0000-000000000071',
  '70000000-0000-0000-0000-000000000070',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-0000-0000-000000000070","role":"authenticated","session_id":"70000000-0000-0000-0000-000000000071","email":"five-s-gemba-authoring@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from authoring_ids where key = 'organisation')),
  'authoring owner selects organisation'
);

insert into authoring_ids (key, id)
select 'five_s_standard', public.create_five_s_standard_draft(
  'Authoring Standard',
  'Issue 70 persistence',
  90
);

insert into authoring_ids (key, id)
select 'five_s_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from authoring_ids where key = 'five_s_standard')
  and version_row.version_number = 1;

insert into authoring_ids (key, id)
select 'five_s_template_version', version_row.template_version_id
from public.five_s_standard_versions version_row
where version_row.id = (select id from authoring_ids where key = 'five_s_version');

select throws_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from authoring_ids where key = 'five_s_version')
  ),
  '55000',
  '5S standard version requires at least one question',
  'empty five_s draft cannot publish'
);

select lives_ok(
  format(
    'select public.add_five_s_section(%L::uuid, %L, 1)',
    (select id from authoring_ids where key = 'five_s_version'),
    'Sort'
  ),
  'can add five_s category'
);

insert into authoring_ids (key, id)
select 'five_s_section', section_row.id
from public.template_sections section_row
where section_row.template_version_id = (
  select id from authoring_ids where key = 'five_s_template_version'
)
  and section_row.position = 1;

select is(
  (
    select section_row.title
    from public.template_sections section_row
    where section_row.template_version_id = (
      select id from authoring_ids where key = 'five_s_template_version'
    )
    order by section_row.position, section_row.id
    limit 1
  ),
  'Sort',
  'five_s authoring read path returns persisted category'
);

select throws_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from authoring_ids where key = 'five_s_version')
  ),
  '55000',
  '5S standard version requires at least one question',
  'five_s draft with only a category cannot publish'
);

select lives_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''yes_no'', ''Is the area clear?'', 1, true, false, null, null, true, ''{"type":"yes_no","yes_value":100,"no_value":0}''::jsonb, 1)',
    (select id from authoring_ids where key = 'five_s_version'),
    (select id from authoring_ids where key = 'five_s_section')
  ),
  'can add first five_s question'
);

select is(
  (
    select question_row.prompt
    from public.template_questions question_row
    where question_row.template_version_id = (
      select id from authoring_ids where key = 'five_s_template_version'
    )
    order by question_row.position, question_row.id
    limit 1
  ),
  'Is the area clear?',
  'five_s authoring read path returns persisted question'
);

select is(
  (
    select count(*)::integer
    from public.template_questions question_row
    where question_row.template_version_id = (
      select id from authoring_ids where key = 'five_s_template_version'
    )
  ),
  1,
  'one five_s question save creates one authoring row'
);

select lives_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''short_text'', ''What still needs attention?'', 2, true, false, null, null, false, null, 1)',
    (select id from authoring_ids where key = 'five_s_version'),
    (select id from authoring_ids where key = 'five_s_section')
  ),
  'can add second five_s question at next position'
);

select is(
  (
    select count(*)::integer
    from public.template_questions question_row
    where question_row.template_version_id = (
      select id from authoring_ids where key = 'five_s_template_version'
    )
  ),
  2,
  'second five_s question save does not create hidden duplicates'
);

select is(
  (
    select array_agg(question_row.prompt order by question_row.position, question_row.id)
    from public.template_questions question_row
    where question_row.template_version_id = (
      select id from authoring_ids where key = 'five_s_template_version'
    )
  ),
  array['Is the area clear?', 'What still needs attention?']::text[],
  'five_s questions remain deterministically ordered'
);

select lives_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from authoring_ids where key = 'five_s_version')
  ),
  'five_s draft with usable questions can publish'
);

select is(
  (
    select version_row.status
    from public.five_s_standard_versions version_row
    where version_row.id = (select id from authoring_ids where key = 'five_s_version')
  ),
  'published',
  'published five_s version remains readable after readiness gate'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''authoring-unit'', ''Authoring Unit'', ''site'')',
    (select id from authoring_ids where key = 'organisation')
  ),
  'can create unit for published five_s and gemba execution'
);

insert into authoring_ids (key, id)
select 'unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from authoring_ids where key = 'organisation')
  and organisation_unit.code = 'authoring-unit';

select lives_ok(
  format(
    'select public.start_five_s_audit(%L::uuid, %L::uuid)',
    (select id from authoring_ids where key = 'five_s_standard'),
    (select id from authoring_ids where key = 'unit')
  ),
  'published five_s standard remains executable'
);

insert into authoring_ids (key, id)
select 'gemba_definition', public.create_gemba_definition_draft(
  'Authoring Walk',
  'Issue 70 gemba persistence'
);

insert into authoring_ids (key, id)
select 'gemba_version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (select id from authoring_ids where key = 'gemba_definition')
  and version_row.version_number = 1;

insert into authoring_ids (key, id)
select 'gemba_template_version', version_row.template_version_id
from public.gemba_definition_versions version_row
where version_row.id = (select id from authoring_ids where key = 'gemba_version');

select throws_ok(
  format(
    'select public.publish_gemba_definition_version(%L::uuid)',
    (select id from authoring_ids where key = 'gemba_version')
  ),
  '55000',
  'gemba definition version requires at least one question',
  'empty gemba draft cannot publish'
);

select lives_ok(
  format(
    'select public.add_gemba_section(%L::uuid, %L, 1)',
    (select id from authoring_ids where key = 'gemba_version'),
    'Safety'
  ),
  'can add gemba section'
);

insert into authoring_ids (key, id)
select 'gemba_section', section_row.id
from public.template_sections section_row
where section_row.template_version_id = (
  select id from authoring_ids where key = 'gemba_template_version'
)
  and section_row.position = 1;

select is(
  (
    select section_row.title
    from public.template_sections section_row
    where section_row.template_version_id = (
      select id from authoring_ids where key = 'gemba_template_version'
    )
    order by section_row.position, section_row.id
    limit 1
  ),
  'Safety',
  'gemba authoring read path returns persisted section'
);

select throws_ok(
  format(
    'select public.publish_gemba_definition_version(%L::uuid)',
    (select id from authoring_ids where key = 'gemba_version')
  ),
  '55000',
  'gemba definition version requires at least one question',
  'gemba draft with only a section cannot publish'
);

select lives_ok(
  format(
    'select public.add_gemba_question(%L::uuid, %L::uuid, ''short_text'', ''What abnormal condition is visible?'', 1)',
    (select id from authoring_ids where key = 'gemba_version'),
    (select id from authoring_ids where key = 'gemba_section')
  ),
  'can add first gemba prompt'
);

select is(
  (
    select question_row.prompt
    from public.template_questions question_row
    where question_row.template_version_id = (
      select id from authoring_ids where key = 'gemba_template_version'
    )
    order by question_row.position, question_row.id
    limit 1
  ),
  'What abnormal condition is visible?',
  'gemba authoring read path returns persisted prompt'
);

select is(
  (
    select count(*)::integer
    from public.template_questions question_row
    where question_row.template_version_id = (
      select id from authoring_ids where key = 'gemba_template_version'
    )
  ),
  1,
  'one gemba prompt save creates one authoring row'
);

select lives_ok(
  format(
    'select public.add_gemba_question(%L::uuid, %L::uuid, ''short_text'', ''What help does the team need?'', 2)',
    (select id from authoring_ids where key = 'gemba_version'),
    (select id from authoring_ids where key = 'gemba_section')
  ),
  'can add second gemba prompt at next position'
);

select is(
  (
    select count(*)::integer
    from public.template_questions question_row
    where question_row.template_version_id = (
      select id from authoring_ids where key = 'gemba_template_version'
    )
  ),
  2,
  'second gemba prompt save does not create hidden duplicates'
);

select is(
  (
    select array_agg(question_row.prompt order by question_row.position, question_row.id)
    from public.template_questions question_row
    where question_row.template_version_id = (
      select id from authoring_ids where key = 'gemba_template_version'
    )
  ),
  array['What abnormal condition is visible?', 'What help does the team need?']::text[],
  'gemba prompts remain deterministically ordered'
);

select lives_ok(
  format(
    'select public.publish_gemba_definition_version(%L::uuid)',
    (select id from authoring_ids where key = 'gemba_version')
  ),
  'gemba draft with usable prompts can publish'
);

select is(
  (
    select version_row.status
    from public.gemba_definition_versions version_row
    where version_row.id = (select id from authoring_ids where key = 'gemba_version')
  ),
  'published',
  'published gemba version remains readable after readiness gate'
);

select lives_ok(
  format(
    'select public.start_gemba_walk(%L::uuid, %L::uuid)',
    (select id from authoring_ids where key = 'gemba_definition'),
    (select id from authoring_ids where key = 'unit')
  ),
  'published gemba definition remains executable'
);

select * from finish();
rollback;
