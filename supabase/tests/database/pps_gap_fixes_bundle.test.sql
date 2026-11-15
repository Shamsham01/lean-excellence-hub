begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2900000-0000-0000-0000-000000000001',
  'pps-gap-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table pps_gap_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on pps_gap_ids to authenticated;

insert into pps_gap_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2900000-0000-0000-0000-000000000001',
    'pps-gap-org',
    'PPS Gap Fixes Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2910000-0000-0000-0000-000000000001',
  'b2900000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2910000-0000-0000-0000-000000000001","email":"pps-gap-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from pps_gap_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into pps_gap_ids (key, id)
select 'unit', public.create_organisation_unit(
  (select id from pps_gap_ids where key = 'organisation'),
  null,
  'pps-gap-site',
  'PPS Gap Site',
  'site'
);

insert into pps_gap_ids (key, id)
select 'method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from pps_gap_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into pps_gap_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'PPS gap verify case',
  (select id from pps_gap_ids where key = 'unit')
);

select ok(
  public.activate_problem_solving_case(
    (select id from pps_gap_ids where key = 'case'),
    (select id from pps_gap_ids where key = 'method')
  ),
  'case activated'
);

insert into pps_gap_ids (key, id)
select 'hypothesis', public.create_hypothesis(
  (select id from pps_gap_ids where key = 'case'),
  'Gap verify interview-only hypothesis'
);

select ok(
  public.update_hypothesis_status(
    (select id from pps_gap_ids where key = 'hypothesis'),
  'testing',
  'Start interview-only path'
  ),
  'hypothesis moved to testing'
);

insert into pps_gap_ids (key, id)
select 'interview_test', public.create_hypothesis_test(
  (select id from pps_gap_ids where key = 'hypothesis'),
  'Did operators confirm the story?',
  null,
  'Interview'
);

select ok(
  public.complete_hypothesis_test(
    (select id from pps_gap_ids where key = 'interview_test'),
  'They said yes',
  'supports'
  ),
  'interview test completed'
);

select ok(
  public.update_hypothesis_status(
    (select id from pps_gap_ids where key = 'hypothesis'),
  'supported',
  'Interview support recorded'
  ),
  'hypothesis marked supported'
);

select throws_ok(
  format(
    'select public.verify_cause_hypothesis(%L::uuid, %L)',
    (select id from pps_gap_ids where key = 'hypothesis'),
    'Interview only'
  ),
  '55000',
  'Confirm with observation, data or a trial',
  'verify blocked for interview-only support at database layer'
);

select ok(
  public.create_hypothesis_test(
    (select id from pps_gap_ids where key = 'hypothesis'),
    'Does measurement data match?',
    null,
    'Measurement / data'
  ) is not null,
  'create_hypothesis_test allows null expected result when method provided'
);

select throws_ok(
  $sql$
    select public.create_hypothesis_test(
      (select id from pps_gap_ids where key = 'hypothesis'),
      'Missing method test',
      'Expected',
      null
    )
  $sql$,
  '22023',
  'verification method is required',
  'create_hypothesis_test requires method'
);

insert into pps_gap_ids (key, id)
select 'effectiveness', public.create_effectiveness_check(
  (select id from pps_gap_ids where key = 'case'),
  'Defect ppm below target',
  null,
  null,
  null,
  null,
  null,
  null
);

select throws_ok(
  format(
    'select public.record_effectiveness_result(%L::uuid, %L, null, null)',
    (select id from pps_gap_ids where key = 'effectiveness'),
    'fail'
  ),
  '22023',
  'result note is required for fail and inconclusive',
  'fail effectiveness requires note'
);

select * from finish();
rollback;