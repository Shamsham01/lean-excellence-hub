begin;

select plan(13);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1a00000-0000-0000-0000-000000000001',
  'ps-closure-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_closure_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_closure_ids to authenticated;

insert into ps_closure_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1a00000-0000-0000-0000-000000000001',
    'ps-closure-org',
    'Problem Solving Closure Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1a10000-0000-0000-0000-000000000001',
  'a1a00000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1a00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1a10000-0000-0000-0000-000000000001","email":"ps-closure-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_closure_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_closure_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_closure_ids where key = 'organisation'),
  null,
  'closure-site',
  'Closure Site',
  'site'
);

insert into ps_closure_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_closure_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_closure_ids (key, id)
select 'effectiveness_case', public.create_problem_solving_case_draft(
  'Effectiveness gate case',
  (select id from ps_closure_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_closure_ids where key = 'effectiveness_case'),
    (select id from ps_closure_ids where key = 'rapid_method')
  ),
  'effectiveness gate case activates'
);

insert into ps_closure_ids (key, id)
select 'countermeasure', public.create_countermeasure(
  (select id from ps_closure_ids where key = 'effectiveness_case'),
  'Replace worn guide rail',
  'Corrective action for recurring jam'
);

select ok(
  public.select_countermeasure(
    (select id from ps_closure_ids where key = 'countermeasure'),
    'Selected after trial on line 2'
  ),
  'countermeasure is selected for effectiveness gate case'
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from ps_closure_ids where key = 'effectiveness_case'),
    'resolved_without_verified_cause',
    null
  ),
  'resolved_without_verified_cause requires a closure rationale',
  '22023'
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from ps_closure_ids where key = 'effectiveness_case'),
    'resolved_without_verified_cause',
    'Countermeasure implemented but effectiveness not yet checked'
  ),
  'corrective countermeasures require effectiveness checks before closure',
  '22023'
);

insert into ps_closure_ids (key, id)
select 'effectiveness_check', public.create_effectiveness_check(
  (select id from ps_closure_ids where key = 'effectiveness_case'),
  'Defect rate below 1 percent for five days'
);

select ok(
  public.record_effectiveness_result(
    (select id from ps_closure_ids where key = 'effectiveness_check'),
    'pass',
    null,
    'Defect rate below target after countermeasure'
  ),
  'effectiveness check passes for closure gate'
);

select ok(
  public.close_problem_solving_case(
    (select id from ps_closure_ids where key = 'effectiveness_case'),
    'resolved_without_verified_cause',
    'Countermeasure effective without verified root cause'
  ),
  'resolved_without_verified_cause closes after effectiveness checks pass'
);

insert into ps_closure_ids (key, id)
select 'verified_case', public.create_problem_solving_case_draft(
  'Verified cause closure case',
  (select id from ps_closure_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_closure_ids where key = 'verified_case'),
    (select id from ps_closure_ids where key = 'rapid_method')
  ),
  'verified cause case activates'
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from ps_closure_ids where key = 'verified_case'),
    'resolved_verified_cause',
    'Attempting closure without verified hypothesis'
  ),
  'resolved_verified_cause requires at least one verified hypothesis',
  '22023'
);

insert into ps_closure_ids (key, id)
select 'verified_hypothesis', public.create_hypothesis(
  (select id from ps_closure_ids where key = 'verified_case'),
  'Fixture wear causes misalignment'
);

select ok(
  public.update_hypothesis_status(
    (select id from ps_closure_ids where key = 'verified_hypothesis'),
    'supported',
    'Gemba observation supports hypothesis'
  ),
  'hypothesis advances to supported for verification'
);

insert into ps_closure_ids (key, id)
select 'verified_test', public.create_hypothesis_test(
  (select id from ps_closure_ids where key = 'verified_hypothesis'),
  'Does replacing fixture eliminate defect?',
  'Defect rate drops after replacement',
  'replacement trial'
);

select ok(
  public.complete_hypothesis_test(
    (select id from ps_closure_ids where key = 'verified_test'),
    'Defect rate dropped below target after fixture replacement',
    'supports'
  ),
  'verification test completes with supporting conclusion'
);

select ok(
  public.verify_cause_hypothesis(
    (select id from ps_closure_ids where key = 'verified_hypothesis'),
    'Replacement trial confirms fixture wear as verified cause'
  ),
  'hypothesis is verified for closure gate'
);

select ok(
  public.close_problem_solving_case(
    (select id from ps_closure_ids where key = 'verified_case'),
    'resolved_verified_cause',
    'Verified cause confirmed through test and verification'
  ),
  'resolved_verified_cause closes when verified hypothesis exists'
);

select * from finish();
rollback;
