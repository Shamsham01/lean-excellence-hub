begin;

select plan(57);

select is(
  private.five_s_resolve_scoring_scale(null),
  '{"min":0,"max":100,"step":1}'::jsonb,
  'a missing scale resolves to legacy 0-100'
);

select is(
  private.five_s_normalise_score_percent(
    'score',
    3,
    '{"min":1,"max":5,"step":1}'::jsonb
  ),
  50::numeric,
  '1-5 score 3 normalises to 50 percent'
);

select is(
  private.five_s_normalise_score_percent('yes_no', 100, null),
  100::numeric,
  'yes/no values stay on 100/0 and are not remapped'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.set_five_s_standard_scoring_scale(uuid, numeric, numeric, numeric)',
    'execute'
  ),
  'authenticated can set a draft scoring scale'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.set_five_s_standard_scoring_scale(uuid, numeric, numeric, numeric)',
    'execute'
  ),
  'anon cannot set a scoring scale'
);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('a5c00000-0000-0000-0000-000000000001', 'five-s-scale-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('a5c00000-0000-0000-0000-000000000002', 'five-s-scale-bodmin@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('a5c00000-0000-0000-0000-000000000003', 'five-s-scale-other@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false);

create temporary table scale_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on scale_ids to authenticated;

insert into scale_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a5c00000-0000-0000-0000-000000000001',
    'five-s-scale-org',
    'Five S Scale Organisation'
  )
);

insert into scale_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'a5c00000-0000-0000-0000-000000000003',
    'five-s-scale-other-org',
    'Five S Scale Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('a5c00000-0000-0000-0000-000000000011', 'a5c00000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('a5c00000-0000-0000-0000-000000000012', 'a5c00000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('a5c00000-0000-0000-0000-000000000013', 'a5c00000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at
)
values (
  (select id from scale_ids where key = 'organisation'),
  'a5c00000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'a5c00000-0000-0000-0000-000000000002';

insert into scale_ids (key, id)
select 'bodmin_membership', membership.id
from public.organisation_memberships membership
where membership.user_id = 'a5c00000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"a5c00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a5c00000-0000-0000-0000-000000000011","email":"five-s-scale-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from scale_ids where key = 'organisation')),
  'owner selects the scoring scale organisation'
);

insert into scale_ids (key, id)
select 'bodmin_site', public.create_organisation_unit(
  (select id from scale_ids where key = 'organisation'),
  null,
  'bodmin-bakery',
  'Bodmin Bakery',
  'site'
);

insert into scale_ids (key, id)
select 'bodmin_packing', public.create_organisation_unit(
  (select id from scale_ids where key = 'organisation'),
  (select id from scale_ids where key = 'bodmin_site'),
  'bodmin-packing',
  'Packing',
  'department'
);

insert into scale_ids (key, id)
select 'exeter_site', public.create_organisation_unit(
  (select id from scale_ids where key = 'organisation'),
  null,
  'exeter-bakery',
  'Exeter Bakery',
  'site'
);

insert into scale_ids (key, id)
select 'exeter_packing', public.create_organisation_unit(
  (select id from scale_ids where key = 'organisation'),
  (select id from scale_ids where key = 'exeter_site'),
  'exeter-packing',
  'Packing',
  'department'
);

insert into scale_ids (key, id)
select 'standard', public.create_five_s_standard_draft(
  'Bodmin 5S',
  '1 to 5 scoring',
  80,
  array[
    (select id from scale_ids where key = 'bodmin_packing'),
    (select id from scale_ids where key = 'exeter_packing')
  ]
);

insert into scale_ids (key, id)
select 'version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from scale_ids where key = 'standard');

select lives_ok(
  format(
    'select public.set_five_s_standard_scoring_scale(%L::uuid, 1, 5, 1)',
    (select id from scale_ids where key = 'version')
  ),
  'draft accepts a 1 to 5 scale'
);

insert into scale_ids (key, id)
select 'section', public.add_five_s_section(
  (select id from scale_ids where key = 'version'),
  'Sort',
  1
);

select lives_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''score'', ''How sorted is the area?'', 1, true, true, null, null, true, ''{"type":"direct"}''::jsonb, 1)',
    (select id from scale_ids where key = 'version'),
    (select id from scale_ids where key = 'section')
  ),
  'scored question uses the standard scale'
);

select lives_ok(
  format(
    'select public.add_five_s_question(%L::uuid, %L::uuid, ''yes_no'', ''Is the area sorted?'', 2, true, true, null, null, true, ''{"type":"yes_no","yes_value":100,"no_value":0}''::jsonb, 1)',
    (select id from scale_ids where key = 'version'),
    (select id from scale_ids where key = 'section')
  ),
  'yes/no question can share the standard'
);

select is(
  (
    select scoring_row.scoring_metadata
    from public.five_s_question_scoring scoring_row
    join public.template_questions question_row
      on question_row.id = scoring_row.question_id
    where question_row.prompt = 'How sorted is the area?'
  ),
  '{"type":"direct"}'::jsonb,
  'numeric questions do not store a second range'
);

select lives_ok(
  format(
    'select public.publish_five_s_standard_version(%L::uuid)',
    (select id from scale_ids where key = 'version')
  ),
  'scored standard publishes with an explicit scale'
);

insert into scale_ids (key, id)
select 'score_question', question_row.id
from public.template_questions question_row
where question_row.prompt = 'How sorted is the area?';

insert into scale_ids (key, id)
select 'yes_question', question_row.id
from public.template_questions question_row
where question_row.prompt = 'Is the area sorted?';

insert into scale_ids (key, id)
select 'audit', public.start_five_s_audit(
  (select id from scale_ids where key = 'standard'),
  (select id from scale_ids where key = 'bodmin_packing')
);

select lives_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 3)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  'score 3 saves'
);

select lives_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 5)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  'score 5 replaces 3'
);

select is(
  (
    select answer_row.number_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from scale_ids where key = 'audit')
      and answer_row.question_id = (select id from scale_ids where key = 'score_question')
  ),
  5::numeric,
  'the latest permitted score is persisted'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 13)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '22023',
  '5S score is not on the published scale',
  '13 is rejected'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 0)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '22023',
  '5S score is not on the published scale',
  '0 is rejected on a 1-5 scale'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, -1)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '22023',
  '5S score is not on the published scale',
  'a negative score is rejected'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 5.5)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '22023',
  '5S score is not on the published scale',
  'a disallowed decimal is rejected'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, ''NaN''::numeric)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '22023',
  '5S score is not on the published scale',
  'NaN is rejected'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, null)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '22023',
  '5S score is not on the published scale',
  'an empty score does not overwrite the saved answer'
);

select is(
  (
    select answer_row.number_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from scale_ids where key = 'audit')
      and answer_row.question_id = (select id from scale_ids where key = 'score_question')
  ),
  5::numeric,
  'rejected scores leave the last valid answer in place'
);

select lives_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 3)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  'auditor can return to a permitted score'
);

select lives_ok(
  format(
    'select public.complete_five_s_audit(%L::uuid)',
    (select id from scale_ids where key = 'audit')
  ),
  'a permitted score can complete the audit'
);

select is(
  (
    select audit_row.overall_score_percent
    from public.five_s_audits audit_row
    where audit_row.id = (select id from scale_ids where key = 'audit')
  ),
  50::numeric,
  'score 3 on a 1-5 scale is 50 percent'
);

insert into scale_ids (key, id)
select 'mixed_audit', public.start_five_s_audit(
  (select id from scale_ids where key = 'standard'),
  (select id from scale_ids where key = 'bodmin_packing')
);

select public.upsert_five_s_audit_answer(
  (select id from scale_ids where key = 'mixed_audit'),
  (select id from scale_ids where key = 'score_question'),
  false,
  null,
  3
);

select public.upsert_five_s_audit_answer(
  (select id from scale_ids where key = 'mixed_audit'),
  (select id from scale_ids where key = 'yes_question'),
  false,
  'yes',
  null
);

select public.complete_five_s_audit(
  (select id from scale_ids where key = 'mixed_audit')
);

select is(
  (
    select audit_row.overall_score_percent
    from public.five_s_audits audit_row
    where audit_row.id = (select id from scale_ids where key = 'mixed_audit')
  ),
  75::numeric,
  'yes and score 3 average to 75 percent'
);

insert into scale_ids (key, id)
select 'legacy_audit', public.start_five_s_audit(
  (select id from scale_ids where key = 'standard'),
  (select id from scale_ids where key = 'bodmin_packing')
);

select public.upsert_five_s_audit_answer(
  (select id from scale_ids where key = 'legacy_audit'),
  (select id from scale_ids where key = 'score_question'),
  false,
  null,
  4
);

set local role postgres;

update public.template_answers answer_row
set number_value = 13
from public.five_s_audits audit_row
where audit_row.id = (select id from scale_ids where key = 'legacy_audit')
  and answer_row.submission_id = audit_row.submission_id
  and answer_row.question_id = (select id from scale_ids where key = 'score_question');

set local role authenticated;

select throws_ok(
  format(
    'select public.complete_five_s_audit(%L::uuid)',
    (select id from scale_ids where key = 'legacy_audit')
  ),
  '22023',
  '5S audit has a score outside the published scale',
  'completion rejects a stored out-of-scale score'
);

select is(
  (
    select audit_row.status
    from public.five_s_audits audit_row
    where audit_row.id = (select id from scale_ids where key = 'legacy_audit')
  ),
  'in_progress',
  'a rejected completion leaves the audit in progress'
);

select is(
  (
    select answer_row.number_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from scale_ids where key = 'legacy_audit')
      and answer_row.question_id = (select id from scale_ids where key = 'score_question')
  ),
  13::numeric,
  'the invalid in-progress answer is left for the auditor to correct'
);

set local role postgres;

select throws_ok(
  format(
    $sql$
      update public.five_s_standard_versions
      set scoring_scale = '{"min":0,"max":10,"step":1}'::jsonb
      where id = %L::uuid
    $sql$,
    (select id from scale_ids where key = 'version')
  ),
  '55000',
  'published 5S scoring scale is immutable',
  'a published scale cannot be edited in place'
);

set local role authenticated;

select lives_ok(
  format(
    'select public.create_five_s_standard_successor_version(%L::uuid)',
    (select id from scale_ids where key = 'standard')
  ),
  'a successor draft can be opened'
);

select is(
  (
    select version_row.scoring_scale
    from public.five_s_standard_versions version_row
    where version_row.standard_id = (select id from scale_ids where key = 'standard')
      and version_row.status = 'draft'
  ),
  '{"min":1,"max":5,"step":1}'::jsonb,
  'the successor copies the published scale'
);

insert into scale_ids (key, id)
select 'successor', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from scale_ids where key = 'standard')
  and version_row.status = 'draft';

select public.set_five_s_standard_scoring_scale(
  (select id from scale_ids where key = 'successor'),
  0,
  10,
  1
);

select is(
  (
    select version_row.scoring_scale
    from public.five_s_standard_versions version_row
    where version_row.id = (select id from scale_ids where key = 'version')
  ),
  '{"min":1,"max":5,"step":1}'::jsonb,
  'changing the successor leaves the published scale unchanged'
);

select is(
  (
    select audit_row.overall_score_percent
    from public.five_s_audits audit_row
    where audit_row.id = (select id from scale_ids where key = 'audit')
  ),
  50::numeric,
  'completed results are not recalculated when a successor scale changes'
);

insert into scale_ids (key, id)
select 'hundred_standard', public.create_five_s_standard_draft(
  'Legacy range',
  'Explicit 0 to 100',
  80,
  array[(select id from scale_ids where key = 'bodmin_packing')]
);

insert into scale_ids (key, id)
select 'hundred_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from scale_ids where key = 'hundred_standard');

select public.set_five_s_standard_scoring_scale(
  (select id from scale_ids where key = 'hundred_version'),
  0,
  100,
  1
);

insert into scale_ids (key, id)
select 'hundred_section', public.add_five_s_section(
  (select id from scale_ids where key = 'hundred_version'),
  'Sort',
  1
);

select public.add_five_s_question(
  (select id from scale_ids where key = 'hundred_version'),
  (select id from scale_ids where key = 'hundred_section'),
  'score',
  'Direct score',
  1,
  true,
  false,
  null,
  null,
  true,
  '{"type":"direct"}'::jsonb,
  1
);

select public.publish_five_s_standard_version(
  (select id from scale_ids where key = 'hundred_version')
);

insert into scale_ids (key, id)
select 'hundred_audit', public.start_five_s_audit(
  (select id from scale_ids where key = 'hundred_standard'),
  (select id from scale_ids where key = 'bodmin_packing')
);

insert into scale_ids (key, id)
select 'hundred_question', question_row.id
from public.template_questions question_row
join public.five_s_standard_versions version_row
  on version_row.template_version_id = question_row.template_version_id
where version_row.id = (select id from scale_ids where key = 'hundred_version');

select lives_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 13)',
    (select id from scale_ids where key = 'hundred_audit'),
    (select id from scale_ids where key = 'hundred_question')
  ),
  'an explicit 0-100 scale still accepts 13'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 101)',
    (select id from scale_ids where key = 'hundred_audit'),
    (select id from scale_ids where key = 'hundred_question')
  ),
  '22023',
  '5S score is not on the published scale',
  '101 is outside 0-100'
);

select public.complete_five_s_audit(
  (select id from scale_ids where key = 'hundred_audit')
);

select is(
  (
    select audit_row.overall_score_percent
    from public.five_s_audits audit_row
    where audit_row.id = (select id from scale_ids where key = 'hundred_audit')
  ),
  13::numeric,
  'a 0-100 score of 13 remains 13 percent'
);

set local role postgres;

alter table public.five_s_standard_versions
  disable trigger five_s_standard_versions_scoring_scale_immutable;

update public.five_s_standard_versions
set scoring_scale = null
where id = (select id from scale_ids where key = 'hundred_version');

alter table public.five_s_standard_versions
  enable trigger five_s_standard_versions_scoring_scale_immutable;

set local role authenticated;

insert into scale_ids (key, id)
select 'null_scale_audit', public.start_five_s_audit(
  (select id from scale_ids where key = 'hundred_standard'),
  (select id from scale_ids where key = 'bodmin_packing')
);

select lives_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 13)',
    (select id from scale_ids where key = 'null_scale_audit'),
    (select id from scale_ids where key = 'hundred_question')
  ),
  'a published null scale keeps the legacy 0-100 interpretation'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 101)',
    (select id from scale_ids where key = 'null_scale_audit'),
    (select id from scale_ids where key = 'hundred_question')
  ),
  '22023',
  '5S score is not on the published scale',
  'legacy 0-100 still rejects 101'
);

select throws_ok(
  format(
    $sql$
      select public.create_five_s_standard_draft_from_definition(
        'leh-workplace-5s-standard',
        jsonb_build_object(
          'key', 'leh-workplace-5s-standard',
          'name', 'Missing scale',
          'description', 'Score without a range',
          'thresholdPercent', 80,
          'categories', jsonb_build_array(
            jsonb_build_object(
              'name', 'Sort',
              'questions', jsonb_build_array(
                jsonb_build_object(
                  'prompt', 'Score the area',
                  'questionType', 'score',
                  'helpText', null
                )
              )
            )
          )
        ),
        array[%L::uuid]
      )
    $sql$,
    (select id from scale_ids where key = 'bodmin_packing')
  ),
  '22023',
  '5S standard definition requires an explicit scoring scale',
  'a scored definition without a scale is rejected'
);

select lives_ok(
  format(
    $sql$
      select public.create_five_s_standard_draft_from_definition(
        'leh-workplace-5s-standard',
        jsonb_build_object(
          'key', 'leh-workplace-5s-standard',
          'name', 'Scaled definition',
          'description', 'Score with a range',
          'thresholdPercent', 80,
          'scoringScale', jsonb_build_object('min', 1, 'max', 5, 'step', 1),
          'categories', jsonb_build_array(
            jsonb_build_object(
              'name', 'Sort',
              'questions', jsonb_build_array(
                jsonb_build_object(
                  'prompt', 'Scaled definition score',
                  'questionType', 'score',
                  'helpText', null
                )
              )
            )
          )
        ),
        array[%L::uuid]
      )
    $sql$,
    (select id from scale_ids where key = 'bodmin_packing')
  ),
  'a definition keeps its scoring scale'
);

select is(
  (
    select version_row.scoring_scale
    from public.five_s_standard_versions version_row
    join public.five_s_standards standard_row
      on standard_row.id = version_row.standard_id
    where standard_row.display_name = 'Scaled definition'
  ),
  '{"min":1,"max":5,"step":1}'::jsonb,
  'the created draft stores the definition scale'
);

insert into scale_ids (key, id)
select 'exeter_audit', public.start_five_s_audit(
  (select id from scale_ids where key = 'standard'),
  (select id from scale_ids where key = 'exeter_packing')
);

select public.upsert_five_s_audit_answer(
  (select id from scale_ids where key = 'exeter_audit'),
  (select id from scale_ids where key = 'score_question'),
  false,
  null,
  4
);

insert into scale_ids (key, id)
select 'team_role', role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from scale_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

select public.grant_role_version(
  (select id from scale_ids where key = 'organisation'),
  (select id from scale_ids where key = 'bodmin_membership'),
  (select id from scale_ids where key = 'team_role'),
  'unit_subtree',
  (select id from scale_ids where key = 'bodmin_site')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a5c00000-0000-0000-0000-000000000002","role":"authenticated","session_id":"a5c00000-0000-0000-0000-000000000012","email":"five-s-scale-bodmin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from scale_ids where key = 'organisation')),
  'Bodmin auditor selects the organisation'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 1)',
    (select id from scale_ids where key = 'exeter_audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '42501',
  '5S audit answer upsert is not authorised',
  'a Bodmin auditor cannot score an Exeter audit'
);

select ok(
  private.has_scoped_permission(
    (select id from scale_ids where key = 'organisation'),
    'five_s.audit.perform',
    null,
    (select id from scale_ids where key = 'bodmin_packing')
  ),
  'the Bodmin auditor can perform a 5S audit in their packing area'
);

select ok(
  not private.has_scoped_permission(
    (select id from scale_ids where key = 'organisation'),
    'submissions.create',
    null,
    null
  ),
  'a valid 5S answer does not require organisation-wide submissions.create'
);

select lives_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 2)',
    (select id from scale_ids where key = 'legacy_audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  'a Bodmin auditor can save a valid answer on their Bodmin audit'
);

set local role postgres;

select is(
  (
    select answer_row.number_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from scale_ids where key = 'legacy_audit')
      and answer_row.question_id = (select id from scale_ids where key = 'score_question')
  ),
  2::numeric,
  'the site-scoped save replaces the invalid in-progress score'
);

set local role authenticated;

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 13)',
    (select id from scale_ids where key = 'legacy_audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '22023',
  '5S score is not on the published scale',
  'an authorised site auditor is still rejected for an invalid score'
);

set local role postgres;

select is(
  (
    select answer_row.number_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from scale_ids where key = 'legacy_audit')
      and answer_row.question_id = (select id from scale_ids where key = 'score_question')
  ),
  2::numeric,
  'a rejected score does not overwrite the site auditor''s valid answer'
);

set local role authenticated;

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 1)',
    (select id from scale_ids where key = 'legacy_audit'),
    (select id from scale_ids where key = 'hundred_question')
  ),
  '23503',
  'question does not belong to audit template version',
  'a question outside the audit template version is rejected'
);

set local role postgres;

select is(
  (
    select answer_row.number_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from scale_ids where key = 'hundred_audit')
      and answer_row.question_id = (select id from scale_ids where key = 'hundred_question')
  ),
  13::numeric,
  'the 5S answer writer does not modify an unrelated submission'
);

set local role authenticated;

select throws_ok(
  format(
    $sql$
      select public.upsert_template_answer(
        (select submission_id from public.five_s_audits where id = %L::uuid),
        %L::uuid,
        false,
        null,
        1
      )
    $sql$,
    (select id from scale_ids where key = 'legacy_audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '42501',
  'template answer upsert is not authorised',
  'the shared template writer still requires organisation-wide submissions.create'
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 1)',
    (select id from scale_ids where key = 'audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '42501',
  '5S audit answer upsert is not authorised',
  'a completed audit rejects modifications'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a5c00000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a5c00000-0000-0000-0000-000000000013","email":"five-s-scale-other@example.test"}',
  true
);

select public.switch_organisation(
  (select id from scale_ids where key = 'other_organisation')
);

select throws_ok(
  format(
    'select public.upsert_five_s_audit_answer(%L::uuid, %L::uuid, false, null, 1)',
    (select id from scale_ids where key = 'legacy_audit'),
    (select id from scale_ids where key = 'score_question')
  ),
  '42501',
  '5S audit answer upsert is not authorised',
  'another organisation cannot score the Bodmin audit'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a5c00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a5c00000-0000-0000-0000-000000000011","email":"five-s-scale-owner@example.test"}',
  true
);

select public.switch_organisation(
  (select id from scale_ids where key = 'organisation')
);

select is(
  (
    select answer_row.number_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from scale_ids where key = 'exeter_audit')
      and answer_row.question_id = (select id from scale_ids where key = 'score_question')
  ),
  4::numeric,
  'hostile score attempts leave the Exeter answer unchanged'
);

select is(
  (
    select answer_row.number_value
    from public.template_answers answer_row
    join public.five_s_audits audit_row
      on audit_row.submission_id = answer_row.submission_id
    where audit_row.id = (select id from scale_ids where key = 'legacy_audit')
      and answer_row.question_id = (select id from scale_ids where key = 'score_question')
  ),
  2::numeric,
  'hostile attempts leave the Bodmin answer unchanged'
);

select is(
  (
    select audit_row.overall_score_percent
    from public.five_s_audits audit_row
    where audit_row.id = (select id from scale_ids where key = 'audit')
  ),
  50::numeric,
  'a completed audit keeps its historical percentage'
);

select * from finish();
rollback;
