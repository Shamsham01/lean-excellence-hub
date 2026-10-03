begin;

select plan(35);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '94000000-0000-0000-0000-000000000001',
    'qnote-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    'qnote-reader@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '94000000-0000-0000-0000-000000000003',
    'qnote-reviewer@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '94000000-0000-0000-0000-000000000004',
    'qnote-sibling@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '94000000-0000-0000-0000-000000000005',
    'qnote-foreign@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table qnote_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on qnote_ids to authenticated;

insert into qnote_ids (key, id)
values
  (
    'organisation',
    private.provision_organisation(
      '94000000-0000-0000-0000-000000000001',
      'qnote-org',
      'Question Note Organisation'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '94000000-0000-0000-0000-000000000005',
      'qnote-org-b',
      'Foreign Question Note Organisation'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '94000000-0000-0000-0000-000000000011',
    '94000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '94000000-0000-0000-0000-000000000012',
    '94000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '94000000-0000-0000-0000-000000000013',
    '94000000-0000-0000-0000-000000000003',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '94000000-0000-0000-0000-000000000014',
    '94000000-0000-0000-0000-000000000004',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '94000000-0000-0000-0000-000000000015',
    '94000000-0000-0000-0000-000000000005',
    statement_timestamp(), statement_timestamp()
  );

insert into qnote_ids (key, id)
select 'owner_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from qnote_ids where key = 'organisation')
  and membership.user_id = '94000000-0000-0000-0000-000000000001';

with inserted_memberships as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values
    (
      (select id from qnote_ids where key = 'organisation'),
      '94000000-0000-0000-0000-000000000002',
      'active',
      statement_timestamp()
    ),
    (
      (select id from qnote_ids where key = 'organisation'),
      '94000000-0000-0000-0000-000000000003',
      'active',
      statement_timestamp()
    ),
    (
      (select id from qnote_ids where key = 'organisation'),
      '94000000-0000-0000-0000-000000000004',
      'active',
      statement_timestamp()
    )
  returning user_id, id
)
insert into qnote_ids (key, id)
select
  case inserted_memberships.user_id
    when '94000000-0000-0000-0000-000000000002' then 'reader_membership'
    when '94000000-0000-0000-0000-000000000003' then 'reviewer_membership'
    when '94000000-0000-0000-0000-000000000004' then 'sibling_membership'
  end,
  inserted_memberships.id
from inserted_memberships;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '94000000-0000-0000-0000-000000000002',
  '94000000-0000-0000-0000-000000000003',
  '94000000-0000-0000-0000-000000000004'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000011","email":"qnote-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from qnote_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into qnote_ids (key, id)
select 'reader_role', public.create_role_draft(
  (select id from qnote_ids where key = 'organisation'),
  'qnote-reader',
  'Question Note Reader',
  'Read only'
);

select ok(
  public.add_role_permission(
    (select id from qnote_ids where key = 'organisation'),
    (select id from qnote_ids where key = 'reader_role'),
    'maturity.read'
  ),
  'reader role receives maturity.read'
);

select ok(
  public.publish_role_version(
    (select id from qnote_ids where key = 'organisation'),
    (select id from qnote_ids where key = 'reader_role')
  ),
  'reader role publishes'
);

insert into qnote_ids (key, id)
select 'reviewer_role', public.create_role_draft(
  (select id from qnote_ids where key = 'organisation'),
  'qnote-reviewer',
  'Question Note Reviewer',
  'Can review'
);

select ok(
  public.add_role_permission(
    (select id from qnote_ids where key = 'organisation'),
    (select id from qnote_ids where key = 'reviewer_role'),
    'maturity.read'
  ) is not null,
  'reviewer role receives maturity.read'
);

select ok(
  public.add_role_permission(
    (select id from qnote_ids where key = 'organisation'),
    (select id from qnote_ids where key = 'reviewer_role'),
    'maturity.review'
  ) is not null,
  'reviewer role receives maturity.review'
);

select ok(
  public.publish_role_version(
    (select id from qnote_ids where key = 'organisation'),
    (select id from qnote_ids where key = 'reviewer_role')
  ),
  'reviewer role publishes'
);

insert into qnote_ids (key, id)
select 'sibling_role', public.create_role_draft(
  (select id from qnote_ids where key = 'organisation'),
  'qnote-sibling',
  'Sibling Site Assessor',
  'Self assess on site B only'
);

select ok(
  public.add_role_permission(
    (select id from qnote_ids where key = 'organisation'),
    (select id from qnote_ids where key = 'sibling_role'),
    'maturity.read'
  ) is not null,
  'sibling role receives maturity.read'
);

select ok(
  public.add_role_permission(
    (select id from qnote_ids where key = 'organisation'),
    (select id from qnote_ids where key = 'sibling_role'),
    'maturity.assess.self'
  ) is not null,
  'sibling role receives self-assess'
);

select ok(
  public.publish_role_version(
    (select id from qnote_ids where key = 'organisation'),
    (select id from qnote_ids where key = 'sibling_role')
  ),
  'sibling role publishes'
);

insert into qnote_ids (key, id)
select 'reader_grant', public.grant_role_version(
  (select id from qnote_ids where key = 'organisation'),
  (select id from qnote_ids where key = 'reader_membership'),
  (select id from qnote_ids where key = 'reader_role'),
  'organisation',
  null
);

insert into qnote_ids (key, id)
select 'reviewer_grant', public.grant_role_version(
  (select id from qnote_ids where key = 'organisation'),
  (select id from qnote_ids where key = 'reviewer_membership'),
  (select id from qnote_ids where key = 'reviewer_role'),
  'organisation',
  null
);

insert into qnote_ids (key, id)
select 'model', public.create_maturity_model_draft('Question Note Framework');

insert into qnote_ids (key, id)
select 'version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from qnote_ids where key = 'organisation')
  and model_version.model_id = (select id from qnote_ids where key = 'model');

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from qnote_ids where key = 'version')
  ),
  'add level'
);

insert into qnote_ids (key, id)
select 'pillar', public.add_maturity_pillar(
  (select id from qnote_ids where key = 'version'),
  'Leadership',
  1,
  null,
  1,
  null,
  'Leadership'
);

insert into qnote_ids (key, id)
select 'criterion', public.add_maturity_criterion(
  (select id from qnote_ids where key = 'pillar'),
  'Gemba walks',
  1
);

insert into qnote_ids (key, id)
select 'question', public.add_maturity_question(
  (select id from qnote_ids where key = 'version'),
  (select section_id from public.maturity_pillars where id = (select id from qnote_ids where key = 'pillar')),
  'score',
  'Rate Gemba',
  1,
  true
);

select lives_ok(
  format(
    'select public.link_criterion_question(%L::uuid, %L::uuid, true, ''{"type":"direct"}''::jsonb)',
    (select id from qnote_ids where key = 'criterion'),
    (select id from qnote_ids where key = 'question')
  ),
  'link question'
);

insert into qnote_ids (key, id)
select 'other_model', public.create_maturity_model_draft('Other Framework');

insert into qnote_ids (key, id)
select 'other_version', model_version.id
from public.maturity_model_versions model_version
where model_version.organisation_id = (select id from qnote_ids where key = 'organisation')
  and model_version.model_id = (select id from qnote_ids where key = 'other_model');

select lives_ok(
  format(
    'select public.add_maturity_level(%L::uuid, 1, ''Initial'', ''maturity-1'')',
    (select id from qnote_ids where key = 'other_version')
  ),
  'add other level'
);

insert into qnote_ids (key, id)
select 'other_pillar', public.add_maturity_pillar(
  (select id from qnote_ids where key = 'other_version'),
  'Other',
  1,
  null,
  1,
  null,
  'Other'
);

insert into qnote_ids (key, id)
select 'other_question', public.add_maturity_question(
  (select id from qnote_ids where key = 'other_version'),
  (select section_id from public.maturity_pillars where id = (select id from qnote_ids where key = 'other_pillar')),
  'score',
  'Outside question',
  1,
  true
);

select ok(
  public.publish_maturity_model_version((select id from qnote_ids where key = 'version')),
  'publish framework'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''qnote-site-a'', ''Site A'', ''site'')',
    (select id from qnote_ids where key = 'organisation')
  ),
  'create site A'
);

select lives_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, ''qnote-site-b'', ''Site B'', ''site'')',
    (select id from qnote_ids where key = 'organisation')
  ),
  'create site B'
);

insert into qnote_ids (key, id)
select 'site_a', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from qnote_ids where key = 'organisation')
  and organisation_unit.code = 'qnote-site-a';

insert into qnote_ids (key, id)
select 'site_b', organisation_unit.id
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = (select id from qnote_ids where key = 'organisation')
  and organisation_unit.code = 'qnote-site-b';

insert into qnote_ids (key, id)
select 'sibling_grant', public.grant_role_version(
  (select id from qnote_ids where key = 'organisation'),
  (select id from qnote_ids where key = 'sibling_membership'),
  (select id from qnote_ids where key = 'sibling_role'),
  'unit_subtree',
  (select id from qnote_ids where key = 'site_b')
);

insert into qnote_ids (key, id)
select 'self_assessment', public.start_maturity_assessment(
  (select id from qnote_ids where key = 'version'),
  (select id from qnote_ids where key = 'site_a'),
  'self',
  'site',
  (select id from qnote_ids where key = 'owner_membership')
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_question_note(%L::uuid, %L::uuid, %L)',
    (select id from qnote_ids where key = 'self_assessment'),
    (select id from qnote_ids where key = 'question'),
    'Self assessor observation'
  ),
  'authorised self assessor can save a question note while editable'
);

select throws_ok(
  format(
    'select public.upsert_maturity_assessment_question_note(%L::uuid, %L::uuid, %L)',
    (select id from qnote_ids where key = 'self_assessment'),
    (select id from qnote_ids where key = 'other_question'),
    'Wrong framework'
  ),
  '23503',
  'question does not belong to assessment framework version',
  'question outside pinned framework is denied'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000012","email":"qnote-reader@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from qnote_ids where key = 'organisation')),
  'reader selects organisation'
);

select throws_ok(
  format(
    'select public.upsert_maturity_assessment_question_note(%L::uuid, %L::uuid, %L)',
    (select id from qnote_ids where key = 'self_assessment'),
    (select id from qnote_ids where key = 'question'),
    'Reader should not write'
  ),
  '42501',
  'maturity assessment question note upsert is not authorised',
  'unauthorised reader cannot save question notes'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000014","email":"qnote-sibling@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from qnote_ids where key = 'organisation')),
  'sibling selects organisation'
);

select throws_ok(
  format(
    'select public.upsert_maturity_assessment_question_note(%L::uuid, %L::uuid, %L)',
    (select id from qnote_ids where key = 'self_assessment'),
    (select id from qnote_ids where key = 'question'),
    'Sibling site write'
  ),
  '42501',
  'maturity assessment question note upsert is not authorised',
  'sibling-site user cannot save notes on another site assessment'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000015","email":"qnote-foreign@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from qnote_ids where key = 'org_b')),
  'foreign owner selects their organisation'
);

select is(
  (
    select count(*)
    from public.maturity_assessment_question_notes
    where assessment_id = (select id from qnote_ids where key = 'self_assessment')
  ),
  0::bigint,
  'tenant isolation hides question notes from another organisation'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000011","email":"qnote-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from qnote_ids where key = 'organisation')),
  'owner resumes'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 3)',
    (select id from qnote_ids where key = 'self_assessment'),
    (select id from qnote_ids where key = 'question')
  ),
  'answer required question'
);

select ok(
  public.complete_self_assessment((select id from qnote_ids where key = 'self_assessment')),
  'complete self assessment'
);

select throws_ok(
  format(
    'select public.upsert_maturity_assessment_question_note(%L::uuid, %L::uuid, %L)',
    (select id from qnote_ids where key = 'self_assessment'),
    (select id from qnote_ids where key = 'question'),
    'Should be frozen'
  ),
  '42501',
  'maturity assessment question note upsert is not authorised',
  'question notes cannot be edited after completion'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000012","email":"qnote-reader@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from qnote_ids where key = 'organisation')),
  'reader resumes after completion'
);

select is(
  (
    select note_row.comment_text
    from public.maturity_assessment_question_notes note_row
    where note_row.assessment_id = (select id from qnote_ids where key = 'self_assessment')
      and note_row.question_id = (select id from qnote_ids where key = 'question')
  ),
  'Self assessor observation',
  'question notes remain readable after completion'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000011","email":"qnote-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from qnote_ids where key = 'organisation')),
  'owner starts formal review path'
);

insert into qnote_ids (key, id)
select 'formal_assessment', public.start_maturity_assessment(
  (select id from qnote_ids where key = 'version'),
  (select id from qnote_ids where key = 'site_a'),
  'formal',
  'site',
  (select id from qnote_ids where key = 'owner_membership')
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_answer(%L::uuid, %L::uuid, false, null, 2)',
    (select id from qnote_ids where key = 'formal_assessment'),
    (select id from qnote_ids where key = 'question')
  ),
  'score formal assessment'
);

select ok(
  public.submit_maturity_assessment((select id from qnote_ids where key = 'formal_assessment')),
  'submit formal assessment'
);

select ok(
  public.begin_assessor_review((select id from qnote_ids where key = 'formal_assessment')),
  'begin assessor review'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000013","email":"qnote-reviewer@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from qnote_ids where key = 'organisation')),
  'reviewer selects organisation'
);

select lives_ok(
  format(
    'select public.upsert_maturity_assessment_question_note(%L::uuid, %L::uuid, %L)',
    (select id from qnote_ids where key = 'formal_assessment'),
    (select id from qnote_ids where key = 'question'),
    'Reviewer observation during assessor review'
  ),
  'authorised formal reviewer can save a question note during assessor_review'
);

select * from finish();
rollback;
