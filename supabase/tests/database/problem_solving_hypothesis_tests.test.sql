begin;

select plan(6);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1900000-0000-0000-0000-000000000001',
  'ps-hypothesis-tests-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1900000-0000-0000-0000-000000000003',
  'ps-hypothesis-tests-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_hypothesis_test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_hypothesis_test_ids to authenticated;

insert into ps_hypothesis_test_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1900000-0000-0000-0000-000000000001',
    'ps-hypothesis-tests-org',
    'Problem Solving Hypothesis Tests Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1910000-0000-0000-0000-000000000001',
  'a1900000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1910000-0000-0000-0000-000000000003',
  'a1900000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1910000-0000-0000-0000-000000000001","email":"ps-hypothesis-tests-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_hypothesis_test_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_hypothesis_test_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_hypothesis_test_ids where key = 'organisation'),
  null,
  'hypothesis-test-site',
  'Hypothesis Test Site',
  'site'
);

insert into ps_hypothesis_test_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_hypothesis_test_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_hypothesis_test_ids (key, id)
select 'case_a', public.create_problem_solving_case_draft(
  'Case A',
  (select id from ps_hypothesis_test_ids where key = 'unit_root')
);

insert into ps_hypothesis_test_ids (key, id)
select 'case_b', public.create_problem_solving_case_draft(
  'Case B',
  (select id from ps_hypothesis_test_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_hypothesis_test_ids where key = 'case_a'),
    (select id from ps_hypothesis_test_ids where key = 'rapid_method')
  ),
  'case A activates'
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_hypothesis_test_ids where key = 'case_b'),
    (select id from ps_hypothesis_test_ids where key = 'rapid_method')
  ),
  'case B activates'
);

insert into ps_hypothesis_test_ids (key, id)
select 'hypothesis_a', public.create_hypothesis(
  (select id from ps_hypothesis_test_ids where key = 'case_a'),
  'Case A root cause hypothesis'
);

insert into ps_hypothesis_test_ids (key, id)
select 'hypothesis_b', public.create_hypothesis(
  (select id from ps_hypothesis_test_ids where key = 'case_b'),
  'Case B root cause hypothesis'
);

insert into ps_hypothesis_test_ids (key, id)
select 'test_a', public.create_hypothesis_test(
  (select id from ps_hypothesis_test_ids where key = 'hypothesis_a'),
  'Does the adjustment reproduce the defect?',
  'Defect reproduces after adjustment',
  'trial run'
);

reset role;

insert into ps_hypothesis_test_ids (key, id)
values (
  'organisation_outsider',
  private.provision_organisation(
    'a1900000-0000-0000-0000-000000000003',
    'ps-hypothesis-tests-org-b',
    'Problem Solving Hypothesis Tests Organisation B'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1900000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a1910000-0000-0000-0000-000000000003","email":"ps-hypothesis-tests-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_hypothesis_test_ids where key = 'organisation_outsider')),
  'outsider selects other organisation'
);

select throws_ok(
  format(
    'select public.complete_hypothesis_test(%L::uuid, %L, %L)',
    (select id from ps_hypothesis_test_ids where key = 'test_a'),
    'Observed no reproduction',
    'refutes'
  ),
  'hypothesis test not found',
  'P0002'
);

select ok(
  not exists (
    select 1
    from public.problem_solving_hypothesis_tests test_row
    where test_row.id = (select id from ps_hypothesis_test_ids where key = 'test_a')
  ),
  'cross-tenant user cannot read hypothesis tests from another organisation'
);

select * from finish();
rollback;
