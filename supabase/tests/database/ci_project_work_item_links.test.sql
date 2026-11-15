begin;

select plan(20);

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

insert into work_link_ids (key, id)
select 'charter_project', public.create_improvement_project(
  'Charter source project',
  (select id from work_link_ids where key = 'unit'),
  'Problem',
  'Objective',
  'Impact',
  (select id from work_link_ids where key = 'case')
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
    select link_row.project_id::text
    from public.ci_project_source_links link_row
    where link_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and link_row.source_resource_id = (select id from work_link_ids where key = 'case')
      and link_row.link_kind = 'work_item'
  ),
  (select id::text from work_link_ids where key = 'project'),
  'case work_item link is set'
);

select is(
  (
    select count(*)::integer
    from public.ci_project_source_links link_row
    where link_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and link_row.project_id = (select id from work_link_ids where key = 'charter_project')
      and link_row.source_resource_id = (select id from work_link_ids where key = 'case')
  ),
  1,
  'charter source link remains after work-item link'
);

select lives_ok(
  format(
    'select public.unlink_problem_solving_case_from_ci_project(%L::uuid)',
    (select id from work_link_ids where key = 'case')
  ),
  'unlink_problem_solving_case_from_ci_project succeeds'
);

select is(
  (
    select count(*)::integer
    from public.ci_project_source_links link_row
    where link_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and link_row.project_id = (select id from work_link_ids where key = 'charter_project')
      and link_row.source_resource_id = (select id from work_link_ids where key = 'case')
  ),
  1,
  'charter source link survives case unlink'
);

insert into work_link_ids (key, id)
select 'cancelled_project', public.create_improvement_project(
  'Cancelled link target',
  (select id from work_link_ids where key = 'unit'),
  'Problem',
  'Objective',
  'Impact'
);

select ok(
  public.cancel_project(
    (select id from work_link_ids where key = 'cancelled_project'),
    'No longer pursuing'
  ),
  'second project is cancelled'
);

select throws_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'action'),
    (select id from work_link_ids where key = 'cancelled_project')
  ),
  '55000',
  'This project is completed or cancelled and cannot accept new links.',
  'live project guard blocks cancelled'
);

insert into work_link_ids (key, id)
select 'completed_project', public.create_improvement_project(
  'Completed link target',
  (select id from work_link_ids where key = 'unit'),
  'Problem',
  'Objective',
  'Impact'
);

update public.ci_projects
set status = 'completed',
    actual_end_at = statement_timestamp()
where id = (select id from work_link_ids where key = 'completed_project');

select throws_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'action'),
    (select id from work_link_ids where key = 'completed_project')
  ),
  '55000',
  'This project is completed or cancelled and cannot accept new links.',
  'live project guard blocks completed'
);

insert into work_link_ids (key, id)
select 'rapid_method', method_row.id
from public.problem_solving_methods method_row
where method_row.organisation_id = (select id from work_link_ids where key = 'organisation')
  and method_row.builtin_code = 'rapid_rca';

insert into work_link_ids (key, id)
select 'closed_case', public.create_problem_solving_case_draft(
  'Closed case',
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

select ok(
  public.activate_problem_solving_case(
    (select id from work_link_ids where key = 'closed_case'),
    (select id from work_link_ids where key = 'rapid_method')
  ),
  'closed case activates'
);

select ok(
  public.cancel_problem_solving_case(
    (select id from work_link_ids where key = 'closed_case'),
    'Stopped'
  ),
  'closed case cancelled'
);

select throws_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'closed_case'),
    (select id from work_link_ids where key = 'project')
  ),
  '55000',
  'This case is closed or cancelled and cannot accept project links.',
  'closed case cannot link'
);

insert into work_link_ids (key, id)
select 'project_action', public.create_project_action(
  'Project-native action',
  (select id from work_link_ids where key = 'project'),
  null,
  'From project workspace',
  'normal',
  null
);

select throws_ok(
  format(
    'select public.unlink_action_from_ci_project(%L::uuid)',
    (select id from work_link_ids where key = 'project_action')
  ),
  '55000',
  'This action belongs to its project and cannot be unlinked.',
  'native project action cannot unlink'
);

select throws_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'project_action'),
    (select id from work_link_ids where key = 'cancelled_project')
  ),
  '55000',
  'This action belongs to its project and cannot be moved to another project.',
  'native project action cannot relink'
);

select throws_ok(
  'select private.link_action_to_ci_project(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function link_action_to_ci_project',
  'authenticated cannot execute private link_action_to_ci_project'
);

select throws_ok(
  'select private.ci_project_link_summary(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function ci_project_link_summary',
  'authenticated cannot execute private ci_project_link_summary'
);

select * from finish();
rollback;