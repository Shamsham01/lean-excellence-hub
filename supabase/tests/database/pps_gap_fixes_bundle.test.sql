begin;

select plan(29);

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

insert into pps_gap_ids (key, id)
select 'closure_case', public.create_problem_solving_case_draft(
  'Closure inconclusive gate',
  (select id from pps_gap_ids where key = 'unit')
);

select ok(
  public.activate_problem_solving_case(
    (select id from pps_gap_ids where key = 'closure_case'),
    (select id from pps_gap_ids where key = 'method')
  ),
  'closure gate case activates'
);

insert into pps_gap_ids (key, id)
select 'closure_cm', public.create_countermeasure(
  (select id from pps_gap_ids where key = 'closure_case'),
  'Stabilise process',
  'Corrective change for closure test'
);

select ok(
  public.select_countermeasure(
    (select id from pps_gap_ids where key = 'closure_cm'),
    'Selected for trial'
  ),
  'closure gate countermeasure selected'
);

insert into pps_gap_ids (key, id)
select 'closure_eff', public.create_effectiveness_check(
  (select id from pps_gap_ids where key = 'closure_case'),
  'Throughput within target band'
);

select ok(
  public.record_effectiveness_result(
    (select id from pps_gap_ids where key = 'closure_eff'),
    'inconclusive',
    null,
    'Sample window too short for a pass call'
  ),
  'inconclusive effectiveness recorded for closure gate'
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from pps_gap_ids where key = 'closure_case'),
    'resolved_without_verified_cause',
    'Should not close with inconclusive effectiveness'
  ),
  '22023',
  'all effectiveness checks must pass before closing as resolved',
  'inconclusive blocks resolved_without_verified_cause'
);

insert into pps_gap_ids (key, id)
select 'closure_hypothesis', public.create_hypothesis(
  (select id from pps_gap_ids where key = 'closure_case'),
  'Fixture misalignment causes defects'
);

select ok(
  public.update_hypothesis_status(
    (select id from pps_gap_ids where key = 'closure_hypothesis'),
    'supported',
    'Data supports alignment issue'
  ),
  'closure gate hypothesis supported'
);

insert into pps_gap_ids (key, id)
select 'closure_verify_test', public.create_hypothesis_test(
  (select id from pps_gap_ids where key = 'closure_hypothesis'),
  'Does alignment data match?',
  'Defects drop when aligned',
  'Measurement / data'
);

select ok(
  public.complete_hypothesis_test(
    (select id from pps_gap_ids where key = 'closure_verify_test'),
    'Defect rate improved after alignment',
    'supports'
  ),
  'closure gate verification test completed'
);

select ok(
  public.verify_cause_hypothesis(
    (select id from pps_gap_ids where key = 'closure_hypothesis'),
    'Verified for closure gate'
  ),
  'closure gate hypothesis verified'
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from pps_gap_ids where key = 'closure_case'),
    'resolved_verified_cause',
    'Should not close with inconclusive effectiveness'
  ),
  '22023',
  'all effectiveness checks must pass before closing as resolved',
  'inconclusive blocks resolved_verified_cause'
);

select ok(
  public.record_effectiveness_result(
    (select id from pps_gap_ids where key = 'closure_eff'),
    'fail',
    null,
    'Throughput still below target'
  ),
  'fail effectiveness recorded for closure gate'
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from pps_gap_ids where key = 'closure_case'),
    'resolved_without_verified_cause',
    'Should not close with fail effectiveness'
  ),
  '22023',
  'all effectiveness checks must pass before closing as resolved',
  'fail blocks resolved_without_verified_cause'
);

set local role postgres;
update public.problem_solving_countermeasures
set status = 'ineffective',
    updated_at = statement_timestamp()
where id = (select id from pps_gap_ids where key = 'closure_cm');
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2910000-0000-0000-0000-000000000001","email":"pps-gap-owner@example.test"}',
  true
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from pps_gap_ids where key = 'closure_case'),
    'resolved_verified_cause',
    'Should not close with fail check after cm ineffective'
  ),
  '22023',
  'all effectiveness checks must pass before closing as resolved',
  'fail blocks resolved_verified when countermeasure is ineffective'
);

set local role postgres;
update public.problem_solving_countermeasures
set status = 'superseded',
    updated_at = statement_timestamp()
where id = (select id from pps_gap_ids where key = 'closure_cm');
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2910000-0000-0000-0000-000000000001","email":"pps-gap-owner@example.test"}',
  true
);

select throws_ok(
  format(
    'select public.close_problem_solving_case(%L::uuid, %L, %L)',
    (select id from pps_gap_ids where key = 'closure_case'),
    'resolved_verified_cause',
    'Should not close with fail check after cm superseded'
  ),
  '22023',
  'all effectiveness checks must pass before closing as resolved',
  'fail blocks resolved_verified when countermeasure is superseded'
);

select ok(
  public.record_effectiveness_result(
    (select id from pps_gap_ids where key = 'closure_eff'),
    'pass',
    null,
    null
  ),
  'pass effectiveness re-check recorded for closure gate'
);

select ok(
  public.close_problem_solving_case(
    (select id from pps_gap_ids where key = 'closure_case'),
    'resolved_verified_cause',
    'All checks passed after fail re-check'
  ),
  'resolved_verified allowed after effectiveness pass'
);

select set_config(
  'pps_gap.closure_case_id',
  (select id::text from pps_gap_ids where key = 'closure_case'),
  true
);
select set_config(
  'pps_gap.closure_eff_id',
  (select id::text from pps_gap_ids where key = 'closure_eff'),
  true
);
select set_config(
  'pps_gap.closure_hypothesis_id',
  (select id::text from pps_gap_ids where key = 'closure_hypothesis'),
  true
);
select set_config(
  'pps_gap.closure_cm_id',
  (select id::text from pps_gap_ids where key = 'closure_cm'),
  true
);

select throws_ok(
  format(
    'select public.verify_cause_hypothesis(%L::uuid, %L)',
    current_setting('pps_gap.closure_hypothesis_id')::uuid,
    'Verify after case closed'
  ),
  '55000',
  'case is closed; hypothesis cannot be changed',
  'verify blocked on closed case'
);

select throws_ok(
  format(
    'select public.record_effectiveness_result(%L::uuid, %L, null, null)',
    current_setting('pps_gap.closure_eff_id')::uuid,
    'pass'
  ),
  '55000',
  'case is closed; effectiveness cannot be changed',
  'record_effectiveness blocked on closed case'
);

select throws_ok(
  format(
    'select public.create_problem_solving_action(%L, %L::uuid, %L, null, %L::uuid, null)',
    'Post-close countermeasure action',
    current_setting('pps_gap.closure_case_id')::uuid,
    'countermeasure',
    current_setting('pps_gap.closure_cm_id')::uuid
  ),
  '55000',
  'case is closed; problem-solving action cannot be created',
  'create_problem_solving_action blocked on closed case'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.create_problem_solving_action(text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid)',
    'execute'
  ),
  'authenticated cannot execute private create_problem_solving_action overload'
);

select set_config(
  'pps_gap.case_id',
  (select id::text from pps_gap_ids where key = 'case'),
  true
);

set local role anon;
select throws_ok(
  format(
    'select public.get_problem_solving_case_audit_activity(%L::uuid)',
    current_setting('pps_gap.case_id')::uuid
  ),
  '42501',
  null,
  'anon cannot read case audit activity'
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2900000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2910000-0000-0000-0000-000000000001","email":"pps-gap-owner@example.test"}',
  true
);

select set_config(
  'pps_gap.closure_hypothesis_id',
  (select id::text from pps_gap_ids where key = 'closure_hypothesis'),
  true
);

select throws_ok(
  format(
    'select public.create_hypothesis_test(%L::uuid, %L, null, %L)',
    current_setting('pps_gap.closure_hypothesis_id')::uuid,
    'Post-close test attempt',
    'Measurement / data'
  ),
  '55000',
  'case is closed; hypothesis cannot be changed',
  'create_hypothesis_test blocked when case is closed'
);

select * from finish();
rollback;