begin;

select plan(12);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a5100000-0000-0000-0000-000000000001',
  'five-s-answer-na@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table five_s_na_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on five_s_na_ids to authenticated;

insert into five_s_na_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a5100000-0000-0000-0000-000000000001',
    'five-s-answer-na-org',
    'Five S Answer NA Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a5200000-0000-0000-0000-000000000001',
  'a5100000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a5100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a5200000-0000-0000-0000-000000000001","email":"five-s-answer-na@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from five_s_na_ids where key = 'organisation')),
  'five_s owner selects organisation'
);

insert into five_s_na_ids (key, id)
select 'standard', public.create_five_s_standard_draft(
  'Answer NA Standard',
  'N/A to actual answer',
  90
);

insert into five_s_na_ids (key, id)
select 'version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from five_s_na_ids where key = 'standard')
  and version_row.version_number = 1;

insert into five_s_na_ids (key, id)
select 'section', public.add_five_s_section(
  (select id from five_s_na_ids where key = 'version'),
  'Sort',
  1
);

insert into five_s_na_ids (key, id)
select 'question', public.add_five_s_question(
  target_standard_version_id := (select id from five_s_na_ids where key = 'version'),
  target_section_id := (select id from five_s_na_ids where key = 'section'),
  target_question_type := 'yes_no',
  target_prompt := 'Optional housekeeping check?',
  target_position := 1,
  target_is_required := true,
  target_allows_not_applicable := true
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''five-s-na-unit'', ''Five S NA Unit'', ''site'')',
    (select id from five_s_na_ids where key = 'organisation')
  ),
  'can create unit for five_s N/A answer audit'
);

insert into five_s_na_ids (key, id)
select 'unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from five_s_na_ids where key = 'organisation')
  and organisation_unit.code = 'five-s-na-unit';

select public.set_five_s_standard_applicable_units(
  (select id from five_s_na_ids where key = 'standard'),
  array[(select id from five_s_na_ids where key = 'unit')]
);

select lives_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from five_s_na_ids where key = 'version')
  ),
  'can publish five_s N/A answer standard'
);

insert into five_s_na_ids (key, id)
select 'audit', public.start_five_s_audit(
  (select id from five_s_na_ids where key = 'standard'),
  (select id from five_s_na_ids where key = 'unit')
);

select lives_ok(
  format(
    $$
      select public.upsert_five_s_audit_answer(
        target_audit_id := %L::uuid,
        target_question_id := %L::uuid,
        target_is_not_applicable := true
      )
    $$,
    (select id from five_s_na_ids where key = 'audit'),
    (select id from five_s_na_ids where key = 'question')
  ),
  'can persist N/A through upsert_five_s_audit_answer'
);

select is(
  (
    select answer_row.is_not_applicable
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from five_s_na_ids where key = 'audit')
      and answer_row.question_id = (select id from five_s_na_ids where key = 'question')
  ),
  true,
  'N/A upsert sets is_not_applicable true'
);

select is(
  (
    select answer_row.text_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from five_s_na_ids where key = 'audit')
      and answer_row.question_id = (select id from five_s_na_ids where key = 'question')
  ),
  null,
  'N/A upsert leaves text_value null'
);

select lives_ok(
  format(
    $$
      select public.upsert_five_s_audit_answer(
        target_audit_id := %L::uuid,
        target_question_id := %L::uuid,
        target_text_value := 'yes'
      )
    $$,
    (select id from five_s_na_ids where key = 'audit'),
    (select id from five_s_na_ids where key = 'question')
  ),
  'Yes after N/A omits target_is_not_applicable like the JS client'
);

select is(
  (
    select answer_row.is_not_applicable
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from five_s_na_ids where key = 'audit')
      and answer_row.question_id = (select id from five_s_na_ids where key = 'question')
  ),
  false,
  'N/A then Yes clears is_not_applicable'
);

select is(
  (
    select answer_row.text_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from five_s_na_ids where key = 'audit')
      and answer_row.question_id = (select id from five_s_na_ids where key = 'question')
  ),
  'yes',
  'N/A then Yes persists the real Yes answer'
);

select lives_ok(
  format(
    $$
      do $inner$
      begin
        perform public.upsert_five_s_audit_answer(
          target_audit_id := %L::uuid,
          target_question_id := %L::uuid,
          target_is_not_applicable := true
        );
        perform public.upsert_five_s_audit_answer(
          target_audit_id := %L::uuid,
          target_question_id := %L::uuid,
          target_text_value := 'no'
        );
      end
      $inner$;
    $$,
    (select id from five_s_na_ids where key = 'audit'),
    (select id from five_s_na_ids where key = 'question'),
    (select id from five_s_na_ids where key = 'audit'),
    (select id from five_s_na_ids where key = 'question')
  ),
  'No after N/A omits target_is_not_applicable like the JS client'
);

select is(
  (
    select answer_row.is_not_applicable
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from five_s_na_ids where key = 'audit')
      and answer_row.question_id = (select id from five_s_na_ids where key = 'question')
  ),
  false,
  'N/A then No clears is_not_applicable'
);

select is(
  (
    select answer_row.text_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from five_s_na_ids where key = 'audit')
      and answer_row.question_id = (select id from five_s_na_ids where key = 'question')
  ),
  'no',
  'N/A then No persists the real No answer'
);

select * from finish();
rollback;
