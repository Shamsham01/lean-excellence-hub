begin;

select plan(10);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1700000-0000-0000-0000-000000000001',
  'ps-hypotheses-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_hypothesis_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_hypothesis_ids to authenticated;

insert into ps_hypothesis_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1700000-0000-0000-0000-000000000001',
    'ps-hypotheses-org',
    'Problem Solving Hypotheses Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1710000-0000-0000-0000-000000000001',
  'a1700000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1700000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1710000-0000-0000-0000-000000000001","email":"ps-hypotheses-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_hypothesis_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_hypothesis_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_hypothesis_ids where key = 'organisation'),
  null,
  'hypothesis-site',
  'Hypothesis Site',
  'site'
);

insert into ps_hypothesis_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_hypothesis_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_hypothesis_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Hypothesis verification case',
  (select id from ps_hypothesis_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_hypothesis_ids where key = 'case'),
    (select id from ps_hypothesis_ids where key = 'rapid_method')
  ),
  'case activates for hypothesis tests'
);

insert into ps_hypothesis_ids (key, id)
select 'proposed_hypothesis', public.create_hypothesis(
  (select id from ps_hypothesis_ids where key = 'case'),
  'Incorrect torque setting causes loosening'
);

select throws_ok(
  format(
    'select public.verify_cause_hypothesis(%L::uuid, %L)',
    (select id from ps_hypothesis_ids where key = 'proposed_hypothesis'),
    'Direct verification without advancing status'
  ),
  'proposed hypotheses cannot be directly verified; advance to testing or supported first',
  '55000'
);

insert into ps_hypothesis_ids (key, id)
select 'supported_hypothesis', public.create_hypothesis(
  (select id from ps_hypothesis_ids where key = 'case'),
  'Worn fixture causes misalignment'
);

select ok(
  public.update_hypothesis_status(
    (select id from ps_hypothesis_ids where key = 'supported_hypothesis'),
    'supported',
    'Team consensus from gemba walk'
  ),
  'hypothesis advances to supported'
);

select throws_ok(
  format(
    'select public.verify_cause_hypothesis(%L::uuid, %L)',
    (select id from ps_hypothesis_ids where key = 'supported_hypothesis'),
    'Verification without supporting test or evidence'
  ),
  'verification requires a completed test with supports conclusion or hypothesis evidence with verification rationale',
  '55000'
);

insert into ps_hypothesis_ids (key, id)
select 'test', public.create_hypothesis_test(
  (select id from ps_hypothesis_ids where key = 'supported_hypothesis'),
  'Does fixture wear correlate with defect rate?',
  'Higher wear increases defect rate',
  'visual inspection'
);

select ok(
  public.complete_hypothesis_test(
    (select id from ps_hypothesis_ids where key = 'test'),
    'Fixture wear measured at 80 percent of tolerance',
    'supports'
  ),
  'supporting test completes without auto-verifying hypothesis'
);

select is(
  (
    select status
    from public.problem_solving_hypotheses
    where id = (select id from ps_hypothesis_ids where key = 'supported_hypothesis')
  ),
  'supported',
  'completed test alone does not verify hypothesis'
);

select ok(
  public.verify_cause_hypothesis(
    (select id from ps_hypothesis_ids where key = 'supported_hypothesis'),
    'Supporting test confirms fixture wear drives misalignment'
  ),
  'supported hypothesis verifies after supporting test'
);

insert into ps_hypothesis_ids (key, id)
select 'rejected_hypothesis', public.create_hypothesis(
  (select id from ps_hypothesis_ids where key = 'case'),
  'Ambient humidity is the root cause'
);

select ok(
  public.reject_cause_hypothesis(
    (select id from ps_hypothesis_ids where key = 'rejected_hypothesis'),
    'Humidity remained stable during failure window'
  ),
  'hypothesis can be rejected'
);

select ok(
  exists (
    select 1
    from public.problem_solving_hypotheses hypothesis_row
    where hypothesis_row.id = (select id from ps_hypothesis_ids where key = 'rejected_hypothesis')
      and hypothesis_row.status = 'rejected'
  ),
  'rejected hypothesis remains visible in case data'
);

select * from finish();
rollback;
