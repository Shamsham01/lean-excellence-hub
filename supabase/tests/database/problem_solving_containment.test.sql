begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1600000-0000-0000-0000-000000000001',
  'ps-containment-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_containment_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_containment_ids to authenticated;

insert into ps_containment_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1600000-0000-0000-0000-000000000001',
    'ps-containment-org',
    'Problem Solving Containment Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1610000-0000-0000-0000-000000000001',
  'a1600000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1600000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1610000-0000-0000-0000-000000000001","email":"ps-containment-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_containment_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_containment_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_containment_ids where key = 'organisation'),
  null,
  'containment-site',
  'Containment Site',
  'site'
);

insert into ps_containment_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_containment_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into ps_containment_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Containment case',
  (select id from ps_containment_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_containment_ids where key = 'case'),
    (select id from ps_containment_ids where key = 'rapid_method')
  ),
  'case activates for containment tests'
);

insert into ps_containment_ids (key, id)
select 'containment', public.create_containment(
  (select id from ps_containment_ids where key = 'case'),
  'Segregate suspect material',
  'Prevent further contamination while investigating'
);

select ok(
  (select id from ps_containment_ids where key = 'containment') is not null,
  'containment record is created'
);

select throws_ok(
  format(
    'select public.create_problem_solving_action(%L, %L::uuid, %L, null, null, null)',
    'Containment follow-up',
    (select id from ps_containment_ids where key = 'case'),
    'containment'
  ),
  'containment actions require a containment_id',
  '22023'
);

insert into ps_containment_ids (key, id)
select 'containment_action', public.create_problem_solving_action(
  'Inspect segregated lot',
  (select id from ps_containment_ids where key = 'case'),
  'containment',
  (select id from ps_containment_ids where key = 'containment')
);

select ok(
  (select id from ps_containment_ids where key = 'containment_action') is not null,
  'containment action is created with exact containment context'
);

select isnt(
  (select id from ps_containment_ids where key = 'containment_action'),
  (select id from ps_containment_ids where key = 'containment'),
  'containment action id is distinct from containment id'
);

select ok(
  exists (
    select 1
    from public.problem_solving_action_context context_row
    where context_row.action_id = (select id from ps_containment_ids where key = 'containment_action')
      and context_row.containment_id = (select id from ps_containment_ids where key = 'containment')
      and context_row.context_role = 'containment'
      and context_row.countermeasure_id is null
      and context_row.sustainment_item_id is null
  ),
  'action context pins exactly one containment foreign key'
);

select throws_ok(
  format(
    'select public.create_problem_solving_action(%L, %L::uuid, %L, %L::uuid, null, null)',
    'Wrong containment context',
    (select id from ps_containment_ids where key = 'case'),
    'countermeasure',
    (select id from ps_containment_ids where key = 'containment')
  ),
  'countermeasure actions require a countermeasure_id',
  '22023'
);

select ok(
  exists (
    select 1
    from public.problem_solving_containments containment_row
    where containment_row.id = (select id from ps_containment_ids where key = 'containment')
      and containment_row.problem_solving_case_id = (select id from ps_containment_ids where key = 'case')
  ),
  'containment remains a first-class record separate from actions'
);

select * from finish();
rollback;
