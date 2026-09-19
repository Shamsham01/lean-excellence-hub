begin;

select plan(20);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '97000000-0000-0000-0000-000000000001',
  'gemba-required-completion@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table gemba_required_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on gemba_required_ids to authenticated;

insert into gemba_required_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '97000000-0000-0000-0000-000000000001',
    'gemba-required-org',
    'Gemba Required Completion Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '97000000-0000-0000-0000-000000000002',
  '97000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"97000000-0000-0000-0000-000000000002","email":"gemba-required-completion@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from gemba_required_ids where key = 'organisation')
  ),
  'owner selects organisation'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''ops-site'', ''Operations Site'', ''site'')',
    (select id from gemba_required_ids where key = 'organisation')
  ),
  'can create site'
);

insert into gemba_required_ids (key, id)
select 'site', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (
  select id from gemba_required_ids where key = 'organisation'
)
  and organisation_unit.code = 'ops-site';

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, ''packing'', ''Packing'', ''area'')',
    (select id from gemba_required_ids where key = 'organisation'),
    (select id from gemba_required_ids where key = 'site')
  ),
  'can create packing unit'
);

insert into gemba_required_ids (key, id)
select 'packing', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (
  select id from gemba_required_ids where key = 'organisation'
)
  and organisation_unit.code = 'packing';

insert into gemba_required_ids (key, id)
select 'definition', public.create_gemba_definition_draft(
  'Required Prompt Walk',
  'Required completeness coverage',
  null,
  array[(select id from gemba_required_ids where key = 'packing')]
);

insert into gemba_required_ids (key, id)
select 'version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (
  select id from gemba_required_ids where key = 'definition'
)
  and version_row.version_number = 1;

insert into gemba_required_ids (key, id)
select 'section', public.add_gemba_section(
  (select id from gemba_required_ids where key = 'version'),
  'Floor',
  1
);

insert into gemba_required_ids (key, id)
select 'required_question', public.add_gemba_question(
  target_definition_version_id := (select id from gemba_required_ids where key = 'version'),
  target_section_id := (select id from gemba_required_ids where key = 'section'),
  target_question_type := 'short_text',
  target_prompt := 'What required condition is visible?',
  target_position := 1,
  target_is_required := true,
  target_allows_not_applicable := false
);

insert into gemba_required_ids (key, id)
select 'required_na_question', public.add_gemba_question(
  target_definition_version_id := (select id from gemba_required_ids where key = 'version'),
  target_section_id := (select id from gemba_required_ids where key = 'section'),
  target_question_type := 'short_text',
  target_prompt := 'What required N/A-capable condition is visible?',
  target_position := 2,
  target_is_required := true,
  target_allows_not_applicable := true
);

insert into gemba_required_ids (key, id)
select 'optional_question', public.add_gemba_question(
  target_definition_version_id := (select id from gemba_required_ids where key = 'version'),
  target_section_id := (select id from gemba_required_ids where key = 'section'),
  target_question_type := 'short_text',
  target_prompt := 'Any optional notes?',
  target_position := 3,
  target_is_required := false,
  target_allows_not_applicable := false
);

select ok(
  public.publish_gemba_definition_version(
    (select id from gemba_required_ids where key = 'version')
  ),
  'can publish gemba definition'
);

insert into gemba_required_ids (key, id)
select 'walk', public.start_gemba_walk(
  (select id from gemba_required_ids where key = 'definition'),
  (select id from gemba_required_ids where key = 'packing')
);

select throws_ok(
  format(
    'select public.complete_gemba_walk(%L::uuid)',
    (select id from gemba_required_ids where key = 'walk')
  ),
  '55000',
  'required gemba walk questions are unanswered',
  'required unanswered questions block completion'
);

select lives_ok(
  format(
    'select public.upsert_gemba_walk_answer(%L::uuid, %L::uuid, false, %L)',
    (select id from gemba_required_ids where key = 'walk'),
    (select id from gemba_required_ids where key = 'required_question'),
    '   '
  ),
  'can persist whitespace-only required answer'
);

select throws_ok(
  format(
    'select public.complete_gemba_walk(%L::uuid)',
    (select id from gemba_required_ids where key = 'walk')
  ),
  '55000',
  'required gemba walk questions are unanswered',
  'whitespace-only required answers do not satisfy completion'
);

select lives_ok(
  format(
    'select public.upsert_gemba_walk_answer(%L::uuid, %L::uuid, false, %L)',
    (select id from gemba_required_ids where key = 'walk'),
    (select id from gemba_required_ids where key = 'required_question'),
    'Visual standard is current.'
  ),
  'can persist required text answer'
);

select throws_ok(
  format(
    'select public.complete_gemba_walk(%L::uuid)',
    (select id from gemba_required_ids where key = 'walk')
  ),
  '55000',
  'required gemba walk questions are unanswered',
  'remaining required unanswered questions still block completion'
);

select lives_ok(
  format(
    'select public.upsert_gemba_walk_answer(%L::uuid, %L::uuid, true)',
    (select id from gemba_required_ids where key = 'walk'),
    (select id from gemba_required_ids where key = 'required_na_question')
  ),
  'can persist allowed N/A on required prompt'
);

insert into gemba_required_ids (key, id)
select 'observation', public.create_gemba_observation(
  (select id from gemba_required_ids where key = 'walk'),
  'Intentional remaining observation.',
  'positive_practice'
);

select ok(
  public.complete_gemba_walk(
    (select id from gemba_required_ids where key = 'walk'),
    'Completed with required answers and optional blank.'
  ),
  'optional unanswered questions do not block completion'
);

select is(
  (
    select walk_row.status
    from public.gemba_walks walk_row
    where walk_row.id = (select id from gemba_required_ids where key = 'walk')
  ),
  'completed',
  'completed walk status is recorded'
);

select throws_ok(
  format(
    'select public.upsert_gemba_walk_answer(%L::uuid, %L::uuid, false, %L)',
    (select id from gemba_required_ids where key = 'walk'),
    (select id from gemba_required_ids where key = 'required_question'),
    'Attempted rewrite after completion'
  ),
  '42501',
  'gemba walk answer upsert is not authorised',
  'completed walk answers remain immutable'
);

select throws_ok(
  format(
    'select public.update_gemba_observation(%L::uuid, %L::uuid, %L, %L)',
    (select id from gemba_required_ids where key = 'walk'),
    (select id from gemba_required_ids where key = 'observation'),
    'Attempted rewrite after completion',
    'issue'
  ),
  '42501',
  'gemba observation change is not authorised',
  'completed walk observations remain immutable'
);

select is(
  (
    select observation_item.observation_text
    from public.gemba_walk_observations observation_item
    where observation_item.id = (
      select id from gemba_required_ids where key = 'observation'
    )
  ),
  'Intentional remaining observation.',
  'completed observation text is unchanged'
);

insert into gemba_required_ids (key, id)
select 'na_disallowed_walk', public.start_gemba_walk(
  (select id from gemba_required_ids where key = 'definition'),
  (select id from gemba_required_ids where key = 'packing')
);

select lives_ok(
  format(
    'select public.upsert_gemba_walk_answer(%L::uuid, %L::uuid, true)',
    (select id from gemba_required_ids where key = 'na_disallowed_walk'),
    (select id from gemba_required_ids where key = 'required_question')
  ),
  'can persist N/A on a question that does not allow it'
);

select lives_ok(
  format(
    'select public.upsert_gemba_walk_answer(%L::uuid, %L::uuid, true)',
    (select id from gemba_required_ids where key = 'na_disallowed_walk'),
    (select id from gemba_required_ids where key = 'required_na_question')
  ),
  'can persist allowed N/A on the second required prompt'
);

select throws_ok(
  format(
    'select public.complete_gemba_walk(%L::uuid)',
    (select id from gemba_required_ids where key = 'na_disallowed_walk')
  ),
  '55000',
  'required gemba walk questions are unanswered',
  'N/A does not satisfy required questions that forbid N/A'
);

select lives_ok(
  format(
    'select public.upsert_gemba_walk_answer(%L::uuid, %L::uuid, false, %L)',
    (select id from gemba_required_ids where key = 'na_disallowed_walk'),
    (select id from gemba_required_ids where key = 'required_question'),
    'Usable required answer after invalid N/A'
  ),
  'can replace invalid N/A with a usable required answer'
);

select ok(
  public.complete_gemba_walk(
    (select id from gemba_required_ids where key = 'na_disallowed_walk')
  ),
  'required answered questions allow completion'
);

select * from finish();
rollback;
