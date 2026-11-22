-- VERIFY draft for PR #391 (Spec A): full assessment-method matrix for
-- public.record_skill_validation, with row-count assertions on
-- public.membership_skill_assessments, plus self-assessment invariants.
-- Complements (does not replace) skills_assessment_methods.test.sql in the PR.
begin;

select plan(37);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('93700000-0000-0000-0000-000000000001', 'method-matrix-owner@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93700000-0000-0000-0000-000000000002', 'method-matrix-operator@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false),
  ('93700000-0000-0000-0000-000000000003', 'method-matrix-outsider@example.test',
   statement_timestamp(), statement_timestamp(), statement_timestamp(),
   '{"provider":"email","providers":["email"]}', '{}', false, false);

create temporary table method_matrix_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on method_matrix_ids to authenticated;

insert into method_matrix_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '93700000-0000-0000-0000-000000000001',
    'method-matrix-org',
    'Method Matrix Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('94700000-0000-0000-0000-000000000001', '93700000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('94700000-0000-0000-0000-000000000002', '93700000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('94700000-0000-0000-0000-000000000003', '93700000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp());

-- Operator (assessed person) and outsider (active member, no role grants).
insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
select (select id from method_matrix_ids where key = 'organisation'), members.user_id::uuid, 'active', statement_timestamp()
from (values
  ('93700000-0000-0000-0000-000000000002'),
  ('93700000-0000-0000-0000-000000000003')
) as members(user_id);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '93700000-0000-0000-0000-000000000002',
  '93700000-0000-0000-0000-000000000003'
);

insert into method_matrix_ids (key, id)
select mapping.key, membership.id
from (values
  ('owner_membership', '93700000-0000-0000-0000-000000000001'),
  ('operator_membership', '93700000-0000-0000-0000-000000000002'),
  ('outsider_membership', '93700000-0000-0000-0000-000000000003')
) as mapping(key, user_id)
join public.organisation_memberships membership
  on membership.organisation_id = (select id from method_matrix_ids where key = 'organisation')
 and membership.user_id = mapping.user_id::uuid;

-- Catalogue invariants (run as postgres) ---------------------------------

select ok(
  pg_catalog.pg_get_function_arguments(
    'public.record_skill_validation(uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text)'::regprocedure
  ) not like '%manager_assessment%',
  'public.record_skill_validation no longer defaults the method to manager_assessment'
);

select ok(
  pg_catalog.pg_get_function_arguments(
    'private.record_skill_validation(uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text)'::regprocedure
  ) not like '%manager_assessment%',
  'private.record_skill_validation no longer defaults the method to manager_assessment'
);

select ok(
  (
    select pg_catalog.pg_get_constraintdef(constraint_row.oid)
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class class_row on class_row.oid = constraint_row.conrelid
    where class_row.relname = 'membership_skill_assessments'
      and constraint_row.conname = 'membership_skill_assessments_method_check'
  ) ~ 'manager_assessment.*practical_observation.*qualification.*self_assessment.*trainer_sign_off.*external_certification',
  'membership_skill_assessments_method_check is unchanged (six canonical tokens)'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.record_skill_validation(uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text)',
    'execute'
  ),
  'anon cannot execute record_skill_validation after CREATE OR REPLACE'
);

-- Owner session: catalogue setup -----------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"93700000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94700000-0000-0000-0000-000000000001","email":"method-matrix-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from method_matrix_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into method_matrix_ids (key, id)
select 'scale', public.create_skill_proficiency_scale_draft('Method Matrix Scale');

insert into method_matrix_ids (key, id)
select 'scale_version', version_row.id
from public.skill_proficiency_scale_versions version_row
where version_row.scale_id = (select id from method_matrix_ids where key = 'scale')
  and version_row.version_number = 1;

select public.add_skill_proficiency_level(
  (select id from method_matrix_ids where key = 'scale_version'), 1, 'Level 1'
);
select public.add_skill_proficiency_level(
  (select id from method_matrix_ids where key = 'scale_version'), 2, 'Level 2'
);

select ok(
  public.publish_skill_proficiency_scale_version(
    (select id from method_matrix_ids where key = 'scale_version')
  ),
  'publish proficiency scale'
);

insert into method_matrix_ids (key, id)
select 'level_1', level_row.id
from public.skill_proficiency_levels level_row
where level_row.scale_version_id = (select id from method_matrix_ids where key = 'scale_version')
  and level_row.order_value = 1;

insert into method_matrix_ids (key, id)
select 'skill', public.create_skill('Forklift Operation', 'forklift-method-matrix');

-- 1. All five canonical validation methods insert one validated row each --

select ok(
  public.record_skill_validation(
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    statement_timestamp(), null, 'manager_assessment'
  ) is not null,
  'manager_assessment accepted'
);

select ok(
  public.record_skill_validation(
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    statement_timestamp(), null, 'practical_observation'
  ) is not null,
  'practical_observation accepted'
);

select ok(
  public.record_skill_validation(
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    statement_timestamp(), null, 'qualification'
  ) is not null,
  'qualification accepted'
);

select ok(
  public.record_skill_validation(
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    statement_timestamp(), null, 'trainer_sign_off'
  ) is not null,
  'trainer_sign_off accepted'
);

select ok(
  public.record_skill_validation(
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    statement_timestamp(), null, 'external_certification'
  ) is not null,
  'external_certification accepted'
);

select is(
  (
    select array_agg(assessment_row.assessment_method order by assessment_row.assessment_method)
    from public.membership_skill_assessments assessment_row
    where assessment_row.membership_id = (select id from method_matrix_ids where key = 'operator_membership')
      and assessment_row.skill_id = (select id from method_matrix_ids where key = 'skill')
  ),
  array[
    'external_certification',
    'manager_assessment',
    'practical_observation',
    'qualification',
    'trainer_sign_off'
  ]::text[],
  'exactly one row per canonical method was stored, verbatim'
);

select is(
  (
    select count(*)::integer
    from public.membership_skill_assessments assessment_row
    where assessment_row.membership_id = (select id from method_matrix_ids where key = 'operator_membership')
      and assessment_row.skill_id = (select id from method_matrix_ids where key = 'skill')
      and (assessment_row.assertion_type <> 'validated' or not assessment_row.is_authoritative)
  ),
  0,
  'every validation row is validated + authoritative'
);

-- 2. Invalid / omitted methods raise 22023 and insert nothing -------------

select throws_ok(
  format(
    'select public.record_skill_validation(%L::uuid, %L::uuid, %L::uuid, %L::uuid, statement_timestamp(), null, %L)',
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    invalid.token
  ),
  '22023',
  'skill validation requires a recognised assessment method',
  format('legacy/invalid token %s rejected with 22023', coalesce(quote_literal(invalid.token), 'NULL'))
)
from (values
  (1, 'observation'),
  (2, 'portfolio_review'),
  (3, 'certification'),
  (4, 'practical_test'),
  (5, 'self_assessment'),
  (6, ''),
  (7, 'Manager_Assessment'),
  (8, ' manager_assessment'),
  (9, null)
) as invalid(ordinal, token)
order by invalid.ordinal;

select throws_ok(
  format(
    'select public.record_skill_validation(%L::uuid, %L::uuid, %L::uuid, %L::uuid)',
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1')
  ),
  '22023',
  'skill validation requires a recognised assessment method',
  'omitted method (4-arg call) rejected with 22023'
);

select throws_ok(
  format(
    'select public.record_skill_validation(target_membership_id => %L::uuid, target_skill_id => %L::uuid, target_proficiency_scale_version_id => %L::uuid, target_proficiency_level_id => %L::uuid, target_notes => %L)',
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    'named-args call without a method (PostgREST shape)'
  ),
  '22023',
  'skill validation requires a recognised assessment method',
  'omitted method via named args (supabase-js shape) rejected with 22023'
);

select is(
  (
    select count(*)::integer
    from public.membership_skill_assessments assessment_row
    where assessment_row.organisation_id = (select id from method_matrix_ids where key = 'organisation')
  ),
  5,
  'no row was inserted by any rejected call (org-wide count still 5)'
);

-- 3. Authorisation still fails closed with a valid method ------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93700000-0000-0000-0000-000000000003","role":"authenticated","session_id":"94700000-0000-0000-0000-000000000003","email":"method-matrix-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from method_matrix_ids where key = 'organisation')),
  'outsider (no grants) selects organisation'
);

select throws_ok(
  format(
    'select public.record_skill_validation(%L::uuid, %L::uuid, %L::uuid, %L::uuid, statement_timestamp(), null, %L)',
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    'practical_observation'
  ),
  '42501',
  'skill validation is not authorised',
  'member without skills.assess cannot validate even with a canonical method'
);

-- Repo convention: auth (42501) is decided before argument validation (22023).
-- Fixed in #391 da73c120 (head a3a3616f); was a todo against b5fa0594.
select throws_ok(
  format(
    'select public.record_skill_validation(%L::uuid, %L::uuid, %L::uuid, %L::uuid, statement_timestamp(), null, %L)',
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    'observation'
  ),
  '42501',
  'skill validation is not authorised',
  'unauthorised caller with an invalid method gets 42501, not 22023'
);

-- 4. Self-assessment path is unchanged ------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93700000-0000-0000-0000-000000000002","role":"authenticated","session_id":"94700000-0000-0000-0000-000000000002","email":"method-matrix-operator@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from method_matrix_ids where key = 'organisation')),
  'operator selects organisation'
);

insert into method_matrix_ids (key, id)
select 'self_assessment', public.record_skill_self_assessment(
  (select id from method_matrix_ids where key = 'operator_membership'),
  (select id from method_matrix_ids where key = 'skill'),
  (select id from method_matrix_ids where key = 'scale_version'),
  (select id from method_matrix_ids where key = 'level_1')
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93700000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94700000-0000-0000-0000-000000000001","email":"method-matrix-owner@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation((select id from method_matrix_ids where key = 'organisation')),
  'owner re-selects organisation for self-assessment assertions'
);

select is(
  (
    select assessment_row.assessment_method
    from public.membership_skill_assessments assessment_row
    where assessment_row.id = (select id from method_matrix_ids where key = 'self_assessment')
  ),
  'self_assessment',
  'self path still defaults to self_assessment'
);

select is(
  (
    select assessment_row.assertion_type
    from public.membership_skill_assessments assessment_row
    where assessment_row.id = (select id from method_matrix_ids where key = 'self_assessment')
  ),
  'self_assessed',
  'self path assertion_type unchanged'
);

select is(
  (
    select assessment_row.is_authoritative
    from public.membership_skill_assessments assessment_row
    where assessment_row.id = (select id from method_matrix_ids where key = 'self_assessment')
  ),
  false,
  'self assessment is never authoritative'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"93700000-0000-0000-0000-000000000002","role":"authenticated","session_id":"94700000-0000-0000-0000-000000000002","email":"method-matrix-operator@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation((select id from method_matrix_ids where key = 'organisation')),
  'operator re-selects organisation for negative self/validation checks'
);

select throws_ok(
  format(
    'select public.record_skill_validation(%L::uuid, %L::uuid, %L::uuid, %L::uuid, statement_timestamp(), null, %L)',
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    'manager_assessment'
  ),
  '42501',
  'skill validation is not authorised',
  'operator cannot validate themself through record_skill_validation'
);

select throws_ok(
  format(
    'select public.record_skill_self_assessment(%L::uuid, %L::uuid, %L::uuid, %L::uuid, statement_timestamp(), %L)',
    (select id from method_matrix_ids where key = 'operator_membership'),
    (select id from method_matrix_ids where key = 'skill'),
    (select id from method_matrix_ids where key = 'scale_version'),
    (select id from method_matrix_ids where key = 'level_1'),
    'external_certification'
  ),
  '22023',
  'skill self assessment requires the self_assessment method',
  'self path rejects a validation-only method token'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.membership_skill_assessments assessment_row
    where assessment_row.organisation_id = (select id from method_matrix_ids where key = 'organisation')
      and assessment_row.assertion_type = 'validated'
  ),
  5,
  'validated row count unchanged by self path and rejected calls'
);

select * from finish();
rollback;
