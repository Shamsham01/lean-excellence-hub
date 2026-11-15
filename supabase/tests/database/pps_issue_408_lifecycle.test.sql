begin;

select plan(19);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b2a00000-0000-0000-0000-000000000001',
  'pps-408-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table pps_408_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on pps_408_ids to authenticated, lean_hub_private_owner;

insert into pps_408_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b2a00000-0000-0000-0000-000000000001',
    'pps-408-org',
    'PPS 408 Lifecycle Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b2a10000-0000-0000-0000-000000000001',
  'b2a00000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b2a00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2a10000-0000-0000-0000-000000000001","email":"pps-408-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from pps_408_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into pps_408_ids (key, id)
select 'unit', public.create_organisation_unit(
  (select id from pps_408_ids where key = 'organisation'),
  null,
  'pps-408-site',
  'PPS 408 Site',
  'site'
);

insert into pps_408_ids (key, id)
select 'method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from pps_408_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into pps_408_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'PPS 408 lifecycle case',
  (select id from pps_408_ids where key = 'unit')
);

select ok(
  public.activate_problem_solving_case(
    (select id from pps_408_ids where key = 'case'),
    (select id from pps_408_ids where key = 'method')
  ),
  'case activated'
);

insert into pps_408_ids (key, id)
select 'membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from pps_408_ids where key = 'organisation')
  and membership_row.user_id = 'b2a00000-0000-0000-0000-000000000001';

select ok(
  public.upsert_problem_solving_sustain_plan(
    (select id from pps_408_ids where key = 'case'),
    'Updated work standard on line 3',
    (select id from pps_408_ids where key = 'membership'),
    'Weekly gemba audit of standard adherence',
    '2027-01-15'::date
  ),
  'sustain plan upserted on open case'
);

select is(
  public.get_problem_solving_detail((select id from pps_408_ids where key = 'case'))->>'sustain_plan_standardised',
  'Updated work standard on line 3',
  'detail exposes sustain_plan_standardised on case'
);

insert into pps_408_ids (key, id)
select 'hypothesis', public.create_hypothesis(
  (select id from pps_408_ids where key = 'case'),
  'Fixture misalignment hypothesis'
);

insert into pps_408_ids (key, id)
select 'pending_test', public.create_hypothesis_test(
  (select id from pps_408_ids where key = 'hypothesis'),
  'Does measurement confirm misalignment?',
  'Runout exceeds tolerance',
  'Measurement / data',
  null,
  null,
  'pps-408-test-mutation-1'
);

select ok(
  public.delete_hypothesis_test((select id from pps_408_ids where key = 'pending_test')),
  'pending hypothesis test deleted'
);

select is(
  (
    select count(*)
    from public.problem_solving_hypothesis_tests test_row
    where test_row.id = (select id from pps_408_ids where key = 'pending_test')
  )::int,
  0,
  'deleted test row removed'
);

insert into pps_408_ids (key, id)
select 'completed_test', public.create_hypothesis_test(
  (select id from pps_408_ids where key = 'hypothesis'),
  'Second measurement check',
  null,
  'Measurement / data'
);

select ok(
  public.complete_hypothesis_test(
    (select id from pps_408_ids where key = 'completed_test'),
    'Runout within tolerance after adjustment',
    'refutes'
  ),
  'hypothesis test completed for delete guard'
);

select throws_ok(
  format(
    'select public.delete_hypothesis_test(%L::uuid)',
    (select id from pps_408_ids where key = 'completed_test')
  ),
  '55000',
  'only pending hypothesis tests can be deleted',
  'completed test cannot be deleted'
);

insert into pps_408_ids (key, id)
select 'fishbone', public.create_analysis(
  (select id from pps_408_ids where key = 'case'),
  'fishbone',
  'Harbourfield fixture fishbone'
);

select is(
  public.add_analysis_node(
    (select id from pps_408_ids where key = 'fishbone'),
    'Worn locating pin',
    null,
    'Machine',
    1,
    '{}'::jsonb,
    'pps-408-node-mutation-1'
  ),
  public.add_analysis_node(
    (select id from pps_408_ids where key = 'fishbone'),
    'Worn locating pin duplicate',
    null,
    'Machine',
    2,
    '{}'::jsonb,
    'pps-408-node-mutation-1'
  ),
  'add_analysis_node replays same node id for mutation key'
);

select is(
  public.create_hypothesis_test(
    (select id from pps_408_ids where key = 'hypothesis'),
    'Idempotent check question',
    'Expected band',
    'Observation',
    null,
    null,
    'pps-408-test-mutation-2'
  ),
  public.create_hypothesis_test(
    (select id from pps_408_ids where key = 'hypothesis'),
    'Idempotent check question replay',
    'Expected band replay',
    'Observation',
    null,
    null,
    'pps-408-test-mutation-2'
  ),
  'create_hypothesis_test replays same test id for mutation key'
);

insert into pps_408_ids (key, id)
select 'countermeasure', public.create_countermeasure(
  (select id from pps_408_ids where key = 'case'),
  'Replace locating pin',
  'Corrective change'
);

insert into pps_408_ids (key, id)
select 'cm_action', public.create_problem_solving_action(
  'Implement pin replacement',
  (select id from pps_408_ids where key = 'case'),
  'countermeasure',
  null,
  (select id from pps_408_ids where key = 'countermeasure'),
  null,
  'Install new hardened pin',
  'high',
  null,
  null,
  'No runout over 0.05 mm after changeover'
);

select is(
  (
    select action_row.expected_result
    from public.actions action_row
    where action_row.id = (select id from pps_408_ids where key = 'cm_action')
  ),
  'No runout over 0.05 mm after changeover',
  'create_problem_solving_action persists expected_result on action'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.upsert_problem_solving_sustain_plan(uuid, text, uuid, text, date)',
    'execute'
  ),
  'authenticated cannot execute private upsert_problem_solving_sustain_plan'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.delete_hypothesis_test(uuid)',
    'execute'
  ),
  'authenticated cannot execute private delete_hypothesis_test'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.add_analysis_node(uuid, text, uuid, text, integer, jsonb, text)',
    'execute'
  ),
  'authenticated cannot execute private add_analysis_node with mutation key'
);

select set_config(
  'pps_408.case_id',
  (select id::text from pps_408_ids where key = 'case'),
  true
);

select set_config(
  'pps_408.completed_test_id',
  (select id::text from pps_408_ids where key = 'completed_test'),
  true
);

set local role anon;
select throws_ok(
  format(
    'select public.upsert_problem_solving_sustain_plan(%L::uuid, %L)',
    current_setting('pps_408.case_id')::uuid,
    'Anon sustain attempt'
  ),
  '42501',
  null,
  'anon cannot upsert sustain plan'
);

select throws_ok(
  format(
    'select public.delete_hypothesis_test(%L::uuid)',
    current_setting('pps_408.completed_test_id')::uuid
  ),
  '42501',
  null,
  'anon cannot delete hypothesis test'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2a00000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2a10000-0000-0000-0000-000000000001","email":"pps-408-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from pps_408_ids where key = 'organisation')),
  'authenticated restored after anon checks'
);

set local role lean_hub_private_owner;

select ok(
  exists (
    select 1
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from pps_408_ids where key = 'organisation')
      and audit_row.resource_record_id = (select id from pps_408_ids where key = 'case')
      and audit_row.event_action = 'problem_solving.sustain_plan_updated'
  ),
  'sustain plan upsert recorded in business audit'
);

select ok(
  exists (
    select 1
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from pps_408_ids where key = 'organisation')
      and audit_row.resource_record_id = (select id from pps_408_ids where key = 'case')
      and audit_row.event_action = 'hypothesis_test.deleted'
  ),
  'hypothesis test deletion recorded in business audit'
);

select * from finish();
rollback;