begin;

select plan(16);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1300000-0000-0000-0000-000000000001',
  'ps-lifecycle-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_lifecycle_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_lifecycle_ids to authenticated;

insert into ps_lifecycle_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1300000-0000-0000-0000-000000000001',
    'ps-lifecycle-org',
    'Problem Solving Lifecycle Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1310000-0000-0000-0000-000000000001',
  'a1300000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1300000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1310000-0000-0000-0000-000000000001","email":"ps-lifecycle-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_lifecycle_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_lifecycle_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_lifecycle_ids where key = 'organisation'),
  null,
  'lifecycle-site',
  'Lifecycle Site',
  'site'
);

insert into ps_lifecycle_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_lifecycle_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_lifecycle_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Lifecycle case',
  (select id from ps_lifecycle_ids where key = 'unit_root'),
  'Recurring downtime on line 2'
);

select is(
  (select status from public.problem_solving_cases
   where id = (select id from ps_lifecycle_ids where key = 'case')),
  'draft',
  'new case starts in draft status'
);

select ok(
  public.update_problem_solving_case_draft(
    (select id from ps_lifecycle_ids where key = 'case'),
    'Lifecycle case',
    'Recurring downtime on line 2',
    null,
    null,
    null,
    null,
    null,
    null,
    'high',
    'major'
  ),
  'draft case can be updated'
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_lifecycle_ids where key = 'case'),
    (select id from ps_lifecycle_ids where key = 'rapid_method')
  ),
  'draft case activates with published method'
);

select is(
  (select status from public.problem_solving_cases
   where id = (select id from ps_lifecycle_ids where key = 'case')),
  'active',
  'activation transitions case to active'
);

insert into ps_lifecycle_ids (key, id)
select 'rca_stage', stage_row.id
from public.problem_solving_method_stages stage_row
join public.problem_solving_cases case_row
  on case_row.organisation_id = stage_row.organisation_id
 and case_row.method_version_id = stage_row.method_version_id
where case_row.id = (select id from ps_lifecycle_ids where key = 'case')
  and stage_row.semantic_stage_key = 'ROOT_CAUSE_ANALYSIS';

select ok(
  public.move_problem_solving_stage(
    (select id from ps_lifecycle_ids where key = 'case'),
    (select id from ps_lifecycle_ids where key = 'rca_stage')
  ),
  'active case moves to another stage in pinned version'
);

select ok(
  exists (
    select 1
    from public.problem_solving_stage_history history_row
    where history_row.case_id = (select id from ps_lifecycle_ids where key = 'case')
      and history_row.to_stage_id = (select id from ps_lifecycle_ids where key = 'rca_stage')
  ),
  'stage move records stage history'
);

select ok(
  public.close_problem_solving_case(
    (select id from ps_lifecycle_ids where key = 'case'),
    'resolved_without_verified_cause',
    'Containment restored stability without verified root cause'
  ),
  'active case closes with resolved_without_verified_cause'
);

select is(
  (select status from public.problem_solving_cases
   where id = (select id from ps_lifecycle_ids where key = 'case')),
  'closed',
  'close transitions case to closed'
);

select is(
  (select closure_outcome from public.problem_solving_cases
   where id = (select id from ps_lifecycle_ids where key = 'case')),
  'resolved_without_verified_cause',
  'closed case records closure outcome'
);

insert into ps_lifecycle_ids (key, id)
select 'cancel_case', public.create_problem_solving_case_draft(
  'Cancellation case',
  (select id from ps_lifecycle_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_lifecycle_ids where key = 'cancel_case'),
    (select id from ps_lifecycle_ids where key = 'rapid_method')
  ),
  'second case activates for cancellation flow'
);

select ok(
  public.cancel_problem_solving_case(
    (select id from ps_lifecycle_ids where key = 'cancel_case'),
    'Duplicate investigation already underway'
  ),
  'active case can be cancelled'
);

select is(
  (select status from public.problem_solving_cases
   where id = (select id from ps_lifecycle_ids where key = 'cancel_case')),
  'cancelled',
  'cancel transitions case to cancelled'
);

select ok(
  (select closure_outcome from public.problem_solving_cases
   where id = (select id from ps_lifecycle_ids where key = 'cancel_case')) is null,
  'cancelled case does not use closure outcome'
);

select isnt(
  (select status from public.problem_solving_cases
   where id = (select id from ps_lifecycle_ids where key = 'cancel_case')),
  'closed',
  'cancelled is distinct from closed resolved outcome'
);

select throws_ok(
  format(
    'select public.move_problem_solving_stage(%L::uuid, %L::uuid)',
    (select id from ps_lifecycle_ids where key = 'case'),
    (select id from ps_lifecycle_ids where key = 'rca_stage')
  ),
  'stage movement requires an active case',
  '55000'
);

select * from finish();
rollback;
