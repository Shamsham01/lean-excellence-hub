begin;

select plan(47);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '92000000-0000-0000-0000-000000000001',
    'review-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    'review-reader@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '92000000-0000-0000-0000-000000000003',
    'review-reviewer@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '92000000-0000-0000-0000-000000000004',
    'review-foreign@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table review_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on review_ids to authenticated;

insert into review_ids (key, id)
values
  (
    'organisation',
    private.provision_organisation(
      '92000000-0000-0000-0000-000000000001',
      'review-org',
      'Assessor Review Organisation'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '92000000-0000-0000-0000-000000000004',
      'review-org-b',
      'Foreign Review Organisation'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '92000000-0000-0000-0000-000000000011',
    '92000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '92000000-0000-0000-0000-000000000012',
    '92000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '92000000-0000-0000-0000-000000000013',
    '92000000-0000-0000-0000-000000000003',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '92000000-0000-0000-0000-000000000014',
    '92000000-0000-0000-0000-000000000004',
    statement_timestamp(), statement_timestamp()
  );

insert into review_ids (key, id)
select 'owner_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from review_ids where key = 'organisation')
  and membership.user_id = '92000000-0000-0000-0000-000000000001';

with inserted_memberships as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values
    (
      (select id from review_ids where key = 'organisation'),
      '92000000-0000-0000-0000-000000000002',
      'active',
      statement_timestamp()
    ),
    (
      (select id from review_ids where key = 'organisation'),
      '92000000-0000-0000-0000-000000000003',
      'active',
      statement_timestamp()
    )
  returning user_id, id
)
insert into review_ids (key, id)
select
  case inserted_memberships.user_id
    when '92000000-0000-0000-0000-000000000002' then 'reader_membership'
    when '92000000-0000-0000-0000-000000000003' then 'reviewer_membership'
  end,
  inserted_memberships.id
from inserted_memberships;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '92000000-0000-0000-0000-000000000002',
  '92000000-0000-0000-0000-000000000003'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000011","email":"review-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from review_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into review_ids (key, id)
select 'reader_role', public.create_role_draft(
  (select id from review_ids where key = 'organisation'),
  'maturity-reader-only',
  'Maturity Reader Only',
  'Can read maturity without review or approve'
);

select ok(
  public.add_role_permission(
    (select id from review_ids where key = 'organisation'),
    (select id from review_ids where key = 'reader_role'),
    'maturity.read'
  ),
  'reader role receives maturity.read'
);

select ok(
  public.publish_role_version(
    (select id from review_ids where key = 'organisation'),
    (select id from review_ids where key = 'reader_role')
  ),
  'reader role publishes'
);

insert into review_ids (key, id)
select 'reviewer_role', public.create_role_draft(
  (select id from review_ids where key = 'organisation'),
  'maturity-reviewer-only',
  'Maturity Reviewer Only',
  'Can review but not approve'
);

select ok(
  public.add_role_permission(
    (select id from review_ids where key = 'organisation'),
    (select id from review_ids where key = 'reviewer_role'),
    'maturity.read'
  ),
  'reviewer role receives maturity.read'
);

select ok(
  public.add_role_permission(
    (select id from review_ids where key = 'organisation'),
    (select id from review_ids where key = 'reviewer_role'),
    'maturity.review'
  ),
  'reviewer role receives maturity.review'
);

select ok(
  public.add_role_permission(
    (select id from review_ids where key = 'organisation'),
    (select id from review_ids where key = 'reviewer_role'),
    'actions.create'
  ),
  'reviewer role receives actions.create'
);

select ok(
  public.add_role_permission(
    (select id from review_ids where key = 'organisation'),
    (select id from review_ids where key = 'reviewer_role'),
    'actions.read'
  ),
  'reviewer role receives actions.read'
);

select ok(
  public.publish_role_version(
    (select id from review_ids where key = 'organisation'),
    (select id from review_ids where key = 'reviewer_role')
  ),
  'reviewer role publishes'
);

insert into review_ids (key, id)
select 'reader_grant', public.grant_role_version(
  (select id from review_ids where key = 'organisation'),
  (select id from review_ids where key = 'reader_membership'),
  (select id from review_ids where key = 'reader_role'),
  'organisation',
  null
);

insert into review_ids (key, id)
select 'reviewer_grant', public.grant_role_version(
  (select id from review_ids where key = 'organisation'),
  (select id from review_ids where key = 'reviewer_membership'),
  (select id from review_ids where key = 'reviewer_role'),
  'organisation',
  null
);

insert into review_ids (key, id)
select 'model', public.create_maturity_model_draft('Review Framework');

insert into review_ids (key, id)
select 'version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from review_ids where key = 'organisation')
  and model_version.model_id = (select id from review_ids where key = 'model');

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from review_ids where key = 'version')
  ),
  'add level'
);

insert into review_ids (key, id)
select 'pillar_one', public.add_maturity_pillar(
  (select id from review_ids where key = 'version'),
  'Leadership',
  1,
  null,
  1,
  null,
  'Leadership'
);

insert into review_ids (key, id)
select 'pillar_two', public.add_maturity_pillar(
  (select id from review_ids where key = 'version'),
  'Operational Performance',
  2,
  null,
  1,
  null,
  'Operational Performance'
);

insert into review_ids (key, id)
select 'criterion_one', public.add_maturity_criterion(
  (select id from review_ids where key = 'pillar_one'),
  'Gemba walks',
  1
);

insert into review_ids (key, id)
select 'criterion_two', public.add_maturity_criterion(
  (select id from review_ids where key = 'pillar_two'),
  'KPI Control',
  1
);

insert into review_ids (key, id)
select 'question_one', public.add_maturity_question(
  (select id from review_ids where key = 'version'),
  (select section_id from public.maturity_pillars where id = (select id from review_ids where key = 'pillar_one')),
  'score',
  'Rate Gemba',
  1,
  true
);

insert into review_ids (key, id)
select 'question_two', public.add_maturity_question(
  (select id from review_ids where key = 'version'),
  (select section_id from public.maturity_pillars where id = (select id from review_ids where key = 'pillar_two')),
  'score',
  'Rate KPI control',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from review_ids where key = 'criterion_one'),
    (select id from review_ids where key = 'question_one')
  ),
  'link first question'
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from review_ids where key = 'criterion_two'),
    (select id from review_ids where key = 'question_two')
  ),
  'link second question'
);

select ok(
  public.publish_maturity_model_version((select id from review_ids where key = 'version')),
  'publish review framework'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''review-site'', ''Review Site'', ''site'')',
    (select id from review_ids where key = 'organisation')
  ),
  'create site'
);

insert into review_ids (key, id)
select 'unit', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from review_ids where key = 'organisation')
  and organisation_unit.code = 'review-site';

insert into review_ids (key, id)
select 'self_assessment', public.start_maturity_assessment(
  (select id from review_ids where key = 'version'),
  (select id from review_ids where key = 'unit'),
  'self',
  'site',
  (select id from review_ids where key = 'owner_membership')
);

select is(
  (
    select assessment_row.lead_assessor_membership_id
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from review_ids where key = 'self_assessment')
  ),
  null,
  'self assessment does not store a lead assessor'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 3)',
    (select id from review_ids where key = 'self_assessment'),
    (select id from review_ids where key = 'question_one')
  ),
  'self assessment can be scored'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 3)',
    (select id from review_ids where key = 'self_assessment'),
    (select id from review_ids where key = 'question_two')
  ),
  'self assessment answers remaining required questions'
);

select ok(
  public.complete_self_assessment((select id from review_ids where key = 'self_assessment')),
  'self assessment completes without reviewer'
);

select is(
  (
    select count(*)
    from public.maturity_official_results result_row
    where result_row.assessment_id = (select id from review_ids where key = 'self_assessment')
  ),
  0::bigint,
  'self assessment does not create an official result'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'', ''site'')',
    (select id from review_ids where key = 'version'),
    (select id from review_ids where key = 'unit')
  ),
  '22023',
  'formal assessment requires a lead assessor',
  'formal assessment cannot start without a lead assessor'
);

insert into review_ids (key, id)
select 'formal_assessment', public.start_maturity_assessment(
  (select id from review_ids where key = 'version'),
  (select id from review_ids where key = 'unit'),
  'formal',
  'site',
  (select id from review_ids where key = 'owner_membership')
);

select is(
  (
    select assessment_row.lead_assessor_membership_id
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from review_ids where key = 'formal_assessment')
  ),
  (select id from review_ids where key = 'owner_membership'),
  'formal assessment stores the selected lead assessor'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 2)',
    (select id from review_ids where key = 'formal_assessment'),
    (select id from review_ids where key = 'question_one')
  ),
  'formal capture score for first criterion'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 3)',
    (select id from review_ids where key = 'formal_assessment'),
    (select id from review_ids where key = 'question_two')
  ),
  'formal capture score for second criterion'
);

insert into review_ids (key, id)
select 'action_criterion_two', public.create_maturity_action(
  'Improve KPI control',
  (select id from review_ids where key = 'formal_assessment'),
  (select id from review_ids where key = 'pillar_two'),
  (select id from review_ids where key = 'criterion_two'),
  (select id from review_ids where key = 'question_two')
);

select is(
  (
    select context_row.criterion_id
    from public.maturity_action_context context_row
    where context_row.action_id = (select id from review_ids where key = 'action_criterion_two')
  ),
  (select id from review_ids where key = 'criterion_two'),
  'action created from criterion B stores criterion B, not the first criterion'
);

select is(
  (
    select context_row.question_id
    from public.maturity_action_context context_row
    where context_row.action_id = (select id from review_ids where key = 'action_criterion_two')
  ),
  (select id from review_ids where key = 'question_two'),
  'question-level action stores the selected question_id'
);

select is(
  (
    select action_row.source_resource_id
    from public.actions action_row
    where action_row.id = (select id from review_ids where key = 'action_criterion_two')
  ),
  (select id from review_ids where key = 'formal_assessment'),
  'maturity action source_resource_id points at the assessment'
);

select throws_ok(
  format(
    'select public.create_maturity_action(%L, %L::uuid, %L::uuid, %L::uuid)',
    'Cross-tenant action',
    (select id from review_ids where key = 'formal_assessment'),
    (select id from review_ids where key = 'pillar_two'),
    (select id from review_ids where key = 'criterion_one')
  ),
  '23503',
  'maturity action context is invalid',
  'action cannot use a criterion from a different pillar'
);

select ok(
  public.submit_maturity_assessment((select id from review_ids where key = 'formal_assessment')),
  'submit formal assessment'
);

select ok(
  public.begin_assessor_review((select id from review_ids where key = 'formal_assessment')),
  'begin assessor review'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000012","email":"review-reader@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from review_ids where key = 'organisation')),
  'reader selects organisation'
);

select throws_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 5)',
    (select id from review_ids where key = 'formal_assessment'),
    (select id from review_ids where key = 'question_two')
  ),
  '42501',
  'maturity assessment answer upsert is not authorised',
  'user without maturity.review cannot edit during assessor review'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000013","email":"review-reviewer@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from review_ids where key = 'organisation')),
  'reviewer selects organisation'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 4)',
    (select id from review_ids where key = 'formal_assessment'),
    (select id from review_ids where key = 'question_two')
  ),
  'reviewer can change a score during assessor review'
);

reset role;

select ok(
  exists (
    select 1
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from review_ids where key = 'organisation')
      and audit_row.resource_record_id = (select id from review_ids where key = 'formal_assessment')
      and audit_row.event_action = 'maturity.assessment.answer_changed'
      and audit_row.metadata ->> 'previous_number_value' = '3'
      and audit_row.metadata ->> 'new_number_value' = '4'
  ),
  'score change records previous and new values in business audit'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000013","email":"review-reviewer@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from review_ids where key = 'organisation')),
  'reviewer resumes after audit assertion'
);

insert into review_ids (key, id)
select 'review_action', public.create_maturity_action(
  'Reviewer follow-up',
  (select id from review_ids where key = 'formal_assessment'),
  (select id from review_ids where key = 'pillar_two'),
  (select id from review_ids where key = 'criterion_two')
);

select throws_ok(
  format(
    'select public.approve_maturity_assessment(%L::uuid)',
    (select id from review_ids where key = 'formal_assessment')
  ),
  '42501',
  'maturity assessment approval is not authorised',
  'reviewer cannot approve without maturity.approve'
);

select throws_ok(
  format(
    'select public.return_maturity_assessment_for_correction(%L::uuid, '''')',
    (select id from review_ids where key = 'formal_assessment')
  ),
  '22023',
  'return for correction requires a reason',
  'return for correction requires a reason'
);

select ok(
  public.return_maturity_assessment_for_correction(
    (select id from review_ids where key = 'formal_assessment'),
    'Scores need shop-floor evidence'
  ),
  'return for correction restores in_progress on the same assessment'
);

select is(
  (
    select assessment_row.status
    from public.maturity_assessments assessment_row
    where assessment_row.id = (select id from review_ids where key = 'formal_assessment')
  ),
  'in_progress',
  'returned assessment is in_progress, not duplicated'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000011","email":"review-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from review_ids where key = 'organisation')),
  'owner resumes after return'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 5)',
    (select id from review_ids where key = 'formal_assessment'),
    (select id from review_ids where key = 'question_two')
  ),
  'author can correct the returned assessment'
);

select ok(
  public.submit_maturity_assessment((select id from review_ids where key = 'formal_assessment')),
  'resubmit after correction'
);

select ok(
  public.begin_assessor_review((select id from review_ids where key = 'formal_assessment')),
  'begin assessor review again'
);

select ok(
  public.approve_maturity_assessment((select id from review_ids where key = 'formal_assessment')),
  'approve assessment'
);

insert into review_ids (key, id)
select 'official_result', public.publish_official_maturity_result(
  (select id from review_ids where key = 'formal_assessment')
);

select ok(
  (
    select count(*)
    from public.maturity_official_results result_row
    where result_row.id = (select id from review_ids where key = 'official_result')
  ) = 1,
  'official result snapshot exists after publish'
);

select throws_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 1)',
    (select id from review_ids where key = 'formal_assessment'),
    (select id from review_ids where key = 'question_two')
  ),
  '42501',
  'maturity assessment answer upsert is not authorised',
  'published assessment cannot be mutated'
);

reset role;

insert into review_ids (key, id)
select 'foreign_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from review_ids where key = 'org_b')
  and membership.user_id = '92000000-0000-0000-0000-000000000004';

select set_config(
  'request.jwt.claims',
  '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000011","email":"review-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from review_ids where key = 'organisation')),
  'owner resumes for cross-tenant lead assessor denial'
);

select throws_ok(
  format(
    'select public.start_maturity_assessment(%L::uuid, %L::uuid, ''formal'', ''site'', %L::uuid)',
    (select id from review_ids where key = 'version'),
    (select id from review_ids where key = 'unit'),
    (select id from review_ids where key = 'foreign_membership')
  ),
  '22023',
  'lead assessor is not valid in this organisation',
  'cross-tenant lead assessor ids cannot be used'
);

select * from finish();
rollback;
