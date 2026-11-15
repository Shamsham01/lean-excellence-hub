begin;

select plan(10);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'ci-work-link-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table work_link_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on work_link_ids to authenticated;

insert into work_link_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f1000000-0000-0000-0000-000000000001',
    'ci-work-link-org',
    'CI Work Link Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'f1100000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'organisation selected'
);

insert into work_link_ids (key, id)
select 'unit', public.create_organisation_unit(
  (select id from work_link_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into work_link_ids (key, id)
select 'project', public.create_improvement_project(
  'Link target project',
  (select id from work_link_ids where key = 'unit'),
  'Problem',
  'Objective',
  'Impact'
);

insert into work_link_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from work_link_ids where key = 'organisation')
  and membership_row.user_id = 'f1000000-0000-0000-0000-000000000001';

insert into work_link_ids (key, id)
select 'action', public.create_action(
  'Standalone action for link test',
  null,
  'normal',
  (select id from work_link_ids where key = 'unit'),
  null,
  null,
  null
);

select lives_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'action'),
    (select id from work_link_ids where key = 'project')
  ),
  'link_action_to_ci_project succeeds'
);

select is(
  (
    select public.get_action_detail((select id from work_link_ids where key = 'action'))
      -> 'linked_project'
      ->> 'id'
  ),
  (select id::text from work_link_ids where key = 'project'),
  'get_action_detail exposes linked_project'
);

select lives_ok(
  format(
    'select public.unlink_action_from_ci_project(%L::uuid)',
    (select id from work_link_ids where key = 'action')
  ),
  'unlink_action_from_ci_project succeeds'
);

select is(
  public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project',
  'null'::jsonb,
  'linked_project cleared after unlink'
);

insert into work_link_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Linked case',
  (select id from work_link_ids where key = 'unit'),
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  (select id from work_link_ids where key = 'owner_membership'),
  null,
  null,
  null
);

select lives_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'case'),
    (select id from work_link_ids where key = 'project')
  ),
  'link_problem_solving_case_to_ci_project succeeds'
);

select is(
  (
    select count(*)::integer
    from public.ci_project_source_links link_row
    where link_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and link_row.project_id = (select id from work_link_ids where key = 'project')
      and link_row.source_resource_id = (select id from work_link_ids where key = 'case')
  ),
  1,
  'case appears in ci_project_source_links'
);

select lives_ok(
  format(
    'select public.unlink_problem_solving_case_from_ci_project(%L::uuid)',
    (select id from work_link_ids where key = 'case')
  ),
  'unlink_problem_solving_case_from_ci_project succeeds'
);

select * from finish();
rollback;