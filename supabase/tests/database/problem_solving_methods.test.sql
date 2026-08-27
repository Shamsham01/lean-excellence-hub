begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'a1100000-0000-0000-0000-000000000001',
  'ps-methods-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_method_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on ps_method_ids to authenticated;

insert into ps_method_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1100000-0000-0000-0000-000000000001',
    'ps-methods-org',
    'Problem Solving Methods Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'a1110000-0000-0000-0000-000000000001',
  'a1100000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1110000-0000-0000-0000-000000000001","email":"ps-methods-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_method_ids where key = 'organisation')),
  'owner selects organisation'
);

select is(
  (
    select count(*)::integer
    from public.problem_solving_methods method_row
    where method_row.organisation_id = (select id from ps_method_ids where key = 'organisation')
      and method_row.is_builtin = true
  ),
  3,
  'provision_organisation seeds three built-in methods'
);

select ok(
  public.ensure_problem_solving_methods_provisioned(),
  'ensure_problem_solving_methods_provisioned succeeds'
);

select is(
  (
    select count(*)::integer
    from public.problem_solving_methods method_row
    where method_row.organisation_id = (select id from ps_method_ids where key = 'organisation')
      and method_row.is_builtin = true
  ),
  3,
  'built-in method provisioning is idempotent'
);

insert into ps_method_ids (key, id)
select 'a3_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_method_ids where key = 'organisation')
  and method_row.builtin_code = 'a3_structured';

insert into ps_method_ids (key, id)
select 'a3_published_version', version_row.id
from public.problem_solving_method_versions version_row
where version_row.organisation_id = (select id from ps_method_ids where key = 'organisation')
  and version_row.method_id = (select id from ps_method_ids where key = 'a3_method')
  and version_row.status = 'published';

insert into ps_method_ids (key, id)
select 'a3_define_stage', stage_row.id
from public.problem_solving_method_stages stage_row
where stage_row.organisation_id = (select id from ps_method_ids where key = 'organisation')
  and stage_row.method_version_id = (select id from ps_method_ids where key = 'a3_published_version')
  and stage_row.semantic_stage_key = 'DEFINE';

select ok(
  exists (
    select 1
    from public.problem_solving_method_stages stage_row
    where stage_row.organisation_id = (select id from ps_method_ids where key = 'organisation')
      and stage_row.method_version_id = (select id from ps_method_ids where key = 'a3_published_version')
  ),
  'published method version has stages'
);

reset role;

select throws_ok(
  format(
    'update public.problem_solving_method_versions set status = %L where id = %L::uuid',
    'draft',
    (select id from ps_method_ids where key = 'a3_published_version')
  ),
  'published method version can only be archived',
  '55000'
);

select throws_ok(
  format(
    'update public.problem_solving_method_stages set title = %L where id = %L::uuid',
    'Renamed stage',
    (select id from ps_method_ids where key = 'a3_define_stage')
  ),
  'method stages are immutable unless version is draft',
  '55000'
);

reset role;
set local role authenticated;

insert into ps_method_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_method_ids where key = 'organisation'),
  null,
  'methods-site',
  'Methods Site',
  'site'
);

insert into ps_method_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Stage ownership case',
  (select id from ps_method_ids where key = 'unit_root')
);

select ok(
  public.activate_problem_solving_case(
    (select id from ps_method_ids where key = 'case'),
    (select id from ps_method_ids where key = 'a3_method')
  ),
  'case activates with built-in method'
);

insert into ps_method_ids (key, id)
select 'five_why_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from ps_method_ids where key = 'organisation')
  and method_row.builtin_code = 'five_why';

insert into ps_method_ids (key, id)
select 'five_why_stage', stage_row.id
from public.problem_solving_method_stages stage_row
join public.problem_solving_method_versions version_row
  on version_row.organisation_id = stage_row.organisation_id
 and version_row.id = stage_row.method_version_id
where stage_row.organisation_id = (select id from ps_method_ids where key = 'organisation')
  and version_row.method_id = (select id from ps_method_ids where key = 'five_why_method')
  and version_row.status = 'published'
order by stage_row.display_order
limit 1;

select throws_ok(
  format(
    'select public.move_problem_solving_stage(%L::uuid, %L::uuid)',
    (select id from ps_method_ids where key = 'case'),
    (select id from ps_method_ids where key = 'five_why_stage')
  ),
  'target stage does not belong to the pinned method version',
  '22023'
);

select * from finish();
rollback;
