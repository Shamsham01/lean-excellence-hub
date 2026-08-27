begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1500000-0000-0000-0000-000000000001',
  'ps-current-condition-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_condition_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_condition_ids to authenticated;

insert into ps_condition_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1500000-0000-0000-0000-000000000001',
    'ps-current-condition-org',
    'Problem Solving Current Condition Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1510000-0000-0000-0000-000000000001',
  'a1500000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1500000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1510000-0000-0000-0000-000000000001","email":"ps-current-condition-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_condition_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_condition_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_condition_ids where key = 'organisation'),
  null,
  'condition-site',
  'Condition Site',
  'site'
);

insert into ps_condition_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_condition_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_condition_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Current condition case',
  (select id from ps_condition_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_condition_ids where key = 'case'),
    (select id from ps_condition_ids where key = 'rapid_method')
  ),
  'case activates for current condition tests'
);

insert into ps_condition_ids (key, id)
select 'assumption', public.create_current_condition_item(
  (select id from ps_condition_ids where key = 'case'),
  'assumption',
  'Operator believes the sensor is miscalibrated'
);

select set_config(
  'test.ps_assumption_id',
  (select id::text from ps_condition_ids where key = 'assumption'),
  true
);

reset role;

select throws_ok(
  $throws$
  do $do$
  begin
    set local role lean_hub_private_owner;
    update public.problem_solving_current_condition_items
    set category = 'measured_fact'
    where id = (current_setting('test.ps_assumption_id')::uuid);
  end;
  $do$;
  $throws$,
  'assumption cannot be reclassified to fact without supersession; create a new item that supersedes it',
  '55000'
);

reset role;
set local role authenticated;

insert into ps_condition_ids (key, id)
select 'measured_fact', public.create_current_condition_item(
  (select id from ps_condition_ids where key = 'case'),
  'measured_fact',
  'Gauge reading is 12 percent above target',
  (select id from ps_condition_ids where key = 'assumption')
);

select is(
  (
    select status
    from public.problem_solving_current_condition_items
    where id = (select id from ps_condition_ids where key = 'assumption')
  ),
  'superseded',
  'superseding item retires prior assumption'
);

select is(
  (
    select category
    from public.problem_solving_current_condition_items
    where id = (select id from ps_condition_ids where key = 'measured_fact')
  ),
  'measured_fact',
  'replacement item records measured fact via supersession'
);

select ok(
  public.verify_current_condition_item(
    (select id from ps_condition_ids where key = 'measured_fact'),
    'Gauge calibration certificate confirms reading'
  ),
  'owner verifies current condition item'
);

select ok(
  (
    select verified_by_membership_id is not null
       and verified_at is not null
       and verification_rationale is not null
    from public.problem_solving_current_condition_items
    where id = (select id from ps_condition_ids where key = 'measured_fact')
  ),
  'verification records provenance fields'
);

insert into ps_condition_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from ps_condition_ids where key = 'organisation')
  and membership_row.user_id = 'a1500000-0000-0000-0000-000000000001';

select is(
  (
    select verified_by_membership_id
    from public.problem_solving_current_condition_items
    where id = (select id from ps_condition_ids where key = 'measured_fact')
  ),
  (select id from ps_condition_ids where key = 'owner_membership'),
  'verification provenance records verifier membership'
);

select * from finish();
rollback;
