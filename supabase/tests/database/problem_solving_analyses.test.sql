begin;

select plan(5);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1800000-0000-0000-0000-000000000001',
  'ps-analyses-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_analysis_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_analysis_ids to authenticated;

insert into ps_analysis_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1800000-0000-0000-0000-000000000001',
    'ps-analyses-org',
    'Problem Solving Analyses Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1810000-0000-0000-0000-000000000001',
  'a1800000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1800000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1810000-0000-0000-0000-000000000001","email":"ps-analyses-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_analysis_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_analysis_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_analysis_ids where key = 'organisation'),
  null,
  'analysis-site',
  'Analysis Site',
  'site'
);

insert into ps_analysis_ids (key, id)
select 'five_why_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_analysis_ids where key = 'organisation')
  and method_row.builtin_code = 'five_why';

insert into ps_analysis_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Five why analysis case',
  (select id from ps_analysis_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_analysis_ids where key = 'case'),
    (select id from ps_analysis_ids where key = 'five_why_method')
  ),
  'case activates for analysis tests'
);

insert into ps_analysis_ids (key, id)
select 'analysis', public.create_analysis(
  (select id from ps_analysis_ids where key = 'case'),
  'five_whys',
  'Line stoppage five whys'
);

insert into ps_analysis_ids (key, id)
select 'why_1', public.add_analysis_node(
  (select id from ps_analysis_ids where key = 'analysis'),
  'Why did the line stop?',
  null,
  'problem',
  1
);

insert into ps_analysis_ids (key, id)
select 'why_2', public.add_analysis_node(
  (select id from ps_analysis_ids where key = 'analysis'),
  'Why did the conveyor jam?',
  (select id from ps_analysis_ids where key = 'why_1'),
  'cause',
  2
);

insert into ps_analysis_ids (key, id)
select 'why_3', public.add_analysis_node(
  (select id from ps_analysis_ids where key = 'analysis'),
  'Why was debris present?',
  (select id from ps_analysis_ids where key = 'why_2'),
  'cause',
  3
);

select is(
  (
    select count(*)::integer
    from public.problem_solving_analysis_nodes node_row
    where node_row.analysis_id = (select id from ps_analysis_ids where key = 'analysis')
  ),
  3,
  'five why tree builds parent-child nodes'
);

select ok(
  exists (
    select 1
    from public.problem_solving_analysis_nodes child_row
    join public.problem_solving_analysis_nodes parent_row
      on parent_row.id = child_row.parent_node_id
    where child_row.id = (select id from ps_analysis_ids where key = 'why_3')
      and parent_row.id = (select id from ps_analysis_ids where key = 'why_2')
  ),
  'five why nodes chain through parent references'
);

reset role;

select throws_ok(
  format(
    'update public.problem_solving_analysis_nodes set parent_node_id = %L::uuid where id = %L::uuid',
    (select id from ps_analysis_ids where key = 'why_3'),
    (select id from ps_analysis_ids where key = 'why_1')
  ),
  'cycle detected in analysis node hierarchy',
  '23514'
);

reset role;
set local role authenticated;

select * from finish();
rollback;
