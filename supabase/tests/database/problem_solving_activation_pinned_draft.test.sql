begin;

select plan(11);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1400000-0000-0000-0000-000000000001',
  'ps-activation-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_activation_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_activation_ids to authenticated;

insert into ps_activation_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1400000-0000-0000-0000-000000000001',
    'ps-activation-org',
    'Problem Solving Activation Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1410000-0000-0000-0000-000000000001',
  'a1400000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1400000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1410000-0000-0000-0000-000000000001","email":"ps-activation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_activation_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_activation_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_activation_ids where key = 'organisation'),
  null,
  'activation-site',
  'Activation Site',
  'site'
);

insert into ps_activation_ids (key, id)
select 'a3_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_activation_ids where key = 'organisation')
  and method_row.builtin_code = 'a3_structured';

insert into ps_activation_ids (key, id)
select 'five_why_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_activation_ids where key = 'organisation')
  and method_row.builtin_code = 'five_why';

insert into ps_activation_ids (key, id)
select 'a3_published_version', version_row.id
from public.problem_solving_method_versions version_row
where version_row.organisation_id = (select id from ps_activation_ids where key = 'organisation')
  and version_row.method_id = (select id from ps_activation_ids where key = 'a3_method')
  and version_row.status = 'published'
order by version_row.version_number desc
limit 1;

insert into ps_activation_ids (key, id)
select 'pinned_case', public.create_problem_solving_case_draft(
  'Pinned draft case',
  (select id from ps_activation_ids where key = 'unit_root'),
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  (select id from ps_activation_ids where key = 'a3_published_version')
);

insert into ps_activation_ids (key, id)
select 'unpinned_case', public.create_problem_solving_case_draft(
  'Unpinned draft case',
  (select id from ps_activation_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_activation_ids where key = 'pinned_case'),
    (select id from ps_activation_ids where key = 'a3_method')
  ),
  'pinned draft activates with matching method'
);

select is(
  (select method_version_id from public.problem_solving_cases
   where id = (select id from ps_activation_ids where key = 'pinned_case')),
  (select id from ps_activation_ids where key = 'a3_published_version'),
  'activation keeps the exact pinned method version'
);

select is(
  (select status from public.problem_solving_cases
   where id = (select id from ps_activation_ids where key = 'pinned_case')),
  'active',
  'pinned draft transitions to active'
);

select cmp_ok(
  (select count(*)::integer from public.problem_solving_status_history
   where case_id = (select id from ps_activation_ids where key = 'pinned_case')
     and from_status = 'draft'
     and to_status = 'active'),
  '>=',
  1,
  'activation records status history'
);

select cmp_ok(
  (select count(*)::integer from public.problem_solving_stage_history
   where case_id = (select id from ps_activation_ids where key = 'pinned_case')),
  '>=',
  1,
  'activation records initial stage history'
);

select throws_ok(
  format(
    'select public.activate_problem_solving_case(%L::uuid, %L::uuid)',
    (select id from ps_activation_ids where key = 'pinned_case'),
    (select id from ps_activation_ids where key = 'a3_method')
  ),
  'case activation requires a draft case',
  '55000'
);

insert into ps_activation_ids (key, id)
select 'wrong_method_case', public.create_problem_solving_case_draft(
  'Wrong method pinned case',
  (select id from ps_activation_ids where key = 'unit_root'),
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  (select id from ps_activation_ids where key = 'a3_published_version')
);

select throws_ok(
  format(
    'select public.activate_problem_solving_case(%L::uuid, %L::uuid)',
    (select id from ps_activation_ids where key = 'wrong_method_case'),
    (select id from ps_activation_ids where key = 'five_why_method')
  ),
  'activation method does not match pinned method version',
  '22023'
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_activation_ids where key = 'unpinned_case'),
    (select id from ps_activation_ids where key = 'a3_method')
  ),
  'unpinned draft still activates via latest published version'
);

insert into ps_activation_ids (key, id)
select 'draft_only_case', public.create_problem_solving_case_draft(
  'Draft session guard case',
  (select id from ps_activation_ids where key = 'unit_root')
);

select throws_ok(
  format(
    'select public.start_problem_solving_session(%L::uuid, %L)',
    (select id from ps_activation_ids where key = 'draft_only_case'),
    'Draft-only session attempt'
  ),
  'sessions can only be started on active cases',
  '55000'
);

insert into ps_activation_ids (key, id)
select 'session', public.start_problem_solving_session(
  (select id from ps_activation_ids where key = 'pinned_case'),
  'Pinned activation workshop'
);

select ok(
  (select id from ps_activation_ids where key = 'session') is not null,
  'active pinned case can start a session'
);

select * from finish();
rollback;
