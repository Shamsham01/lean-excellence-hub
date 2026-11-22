begin;

select plan(157);

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
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'ci-work-link-site-mgr@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f1000000-0000-0000-0000-000000000099',
    'ci-work-link-outsider@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'ci-work-link-viewer@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f1000000-0000-0000-0000-000000000004',
    'ci-work-link-team-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table work_link_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on work_link_ids to authenticated;
grant select on work_link_ids to lean_hub_private_owner;

insert into work_link_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f1000000-0000-0000-0000-000000000001',
    'ci-work-link-org',
    'CI Work Link Org'
  )
);

insert into work_link_ids (key, id)
values (
  'foreign_org',
  private.provision_organisation(
    'f1000000-0000-0000-0000-000000000001',
    'ci-work-link-foreign',
    'CI Work Link Foreign Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'f1100000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f1100000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f1100000-0000-0000-0000-000000000099',
    'f1000000-0000-0000-0000-000000000099',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f1100000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f1100000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000004',
    statement_timestamp(),
    statement_timestamp()
  );

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  (
    (select id from work_link_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  ),
  (
    (select id from work_link_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  ),
  (
    (select id from work_link_ids where key = 'organisation'),
    'f1000000-0000-0000-0000-000000000004',
    'active',
    statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'f1000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000003',
  'f1000000-0000-0000-0000-000000000004'
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
select 'site_b', public.create_organisation_unit(
  (select id from work_link_ids where key = 'organisation'),
  null,
  'site-b',
  'Site B',
  'site'
);

insert into work_link_ids (key, id)
select 'site_b_manager_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from work_link_ids where key = 'organisation')
  and membership_row.user_id = 'f1000000-0000-0000-0000-000000000002';

insert into work_link_ids (key, id)
select 'projects_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from work_link_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'projects'
  and role_version.status = 'published';

insert into work_link_ids (key, id)
select 'actions_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from work_link_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'actions'
  and role_version.status = 'published';

insert into work_link_ids (key, id)
select 'gemba_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from work_link_ids where key = 'organisation')
  and role_row.module_responsibility_key = 'gemba'
  and role_version.status = 'published';

insert into work_link_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.id = role_version.role_id
 and role_row.organisation_id = role_version.organisation_id
where role_version.organisation_id = (select id from work_link_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

insert into work_link_ids (key, id)
select 'team_member_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from work_link_ids where key = 'organisation')
  and membership_row.user_id = 'f1000000-0000-0000-0000-000000000004';

select isnt(
  (
    select count(*)::integer
    from work_link_ids fixture_row
    where fixture_row.key in ('team_member_role_version', 'team_member_membership')
  ),
  0,
  'team-member fixture ids are captured during provisioning'
);

select ok(
  public.grant_role_version(
    (select id from work_link_ids where key = 'organisation'),
    (select id from work_link_ids where key = 'team_member_membership'),
    (select id from work_link_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from work_link_ids where key = 'unit')
  ) is not null,
  'team member receives unit-scoped team-member role'
);

set local role postgres;

with inserted_version as (
  insert into public.role_versions (
    organisation_id,
    role_id,
    version_number,
    status,
    created_by_membership_id
  )
  select
    (select id from work_link_ids where key = 'organisation'),
    role_row.id,
    2,
    'draft',
    membership_row.id
  from public.roles role_row
  join public.organisation_memberships membership_row
    on membership_row.organisation_id = role_row.organisation_id
   and membership_row.user_id = 'f1000000-0000-0000-0000-000000000001'
  where role_row.organisation_id = (select id from work_link_ids where key = 'organisation')
    and role_row.module_responsibility_key = 'actions'
  returning id
)
insert into work_link_ids (key, id)
select 'actions_no_assign_version', inserted_version.id
from inserted_version;

insert into public.role_permissions (
  organisation_id,
  role_version_id,
  permission_key
)
select
  role_permission.organisation_id,
  (select id from work_link_ids where key = 'actions_no_assign_version'),
  role_permission.permission_key
from public.role_permissions role_permission
where role_permission.organisation_id = (select id from work_link_ids where key = 'organisation')
  and role_permission.role_version_id = (select id from work_link_ids where key = 'actions_role_version')
  and role_permission.permission_key is distinct from 'actions.assign';

update public.role_versions role_version
set status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = membership_row.id
from public.organisation_memberships membership_row
where role_version.id = (select id from work_link_ids where key = 'actions_no_assign_version')
  and membership_row.organisation_id = (select id from work_link_ids where key = 'organisation')
  and membership_row.user_id = 'f1000000-0000-0000-0000-000000000001';

update public.role_versions role_version
set status = 'retired',
    retired_at = statement_timestamp(),
    retired_by_membership_id = membership_row.id
from public.organisation_memberships membership_row
where role_version.organisation_id = (select id from work_link_ids where key = 'organisation')
  and role_version.id = (select id from work_link_ids where key = 'actions_role_version')
  and membership_row.user_id = 'f1000000-0000-0000-0000-000000000001';

set local role authenticated;

select ok(
  (
    select role_version.status
    from public.role_versions role_version
    where role_version.id = (select id from work_link_ids where key = 'actions_no_assign_version')
  ) = 'published',
  'actions role without assign is published for site manager coverage'
);

select ok(
  public.grant_role_version(
   (select id from work_link_ids where key = 'organisation'),
    (select id from work_link_ids where key = 'site_b_manager_membership'),
    (select id from work_link_ids where key = 'projects_role_version'),
    'unit_subtree',
    (select id from work_link_ids where key = 'unit')
  ) is not null,
  'site-scoped manager receives projects responsibility on site A'
);

select ok(
  public.grant_role_version(
    (select id from work_link_ids where key = 'organisation'),
    (select id from work_link_ids where key = 'site_b_manager_membership'),
    (select id from work_link_ids where key = 'actions_no_assign_version'),
    'unit_subtree',
    (select id from work_link_ids where key = 'unit')
  ) is not null,
  'site-scoped manager receives actions responsibility on site A without assign'
);

select ok(
  public.grant_role_version(
    (select id from work_link_ids where key = 'organisation'),
    (select id from work_link_ids where key = 'site_b_manager_membership'),
    (select id from work_link_ids where key = 'gemba_role_version'),
    'unit_subtree',
    (select id from work_link_ids where key = 'unit')
  ) is not null,
  'site-scoped manager receives gemba responsibility on site A'
);

insert into work_link_ids (key, id)
select 'viewer_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from work_link_ids where key = 'organisation')
  and membership_row.user_id = 'f1000000-0000-0000-0000-000000000003';

insert into work_link_ids (key, id)
select 'gemba_definition', public.create_gemba_definition_draft(
  'CI work link walk',
  'Work-item link walk coverage',
  null,
  array[(select id from work_link_ids where key = 'unit')]::uuid[]
);

insert into work_link_ids (key, id)
select 'gemba_version', version_row.id
from public.gemba_definition_versions version_row
where version_row.definition_id = (select id from work_link_ids where key = 'gemba_definition')
  and version_row.version_number = 1;

insert into work_link_ids (key, id)
select 'gemba_section', public.add_gemba_section(
  (select id from work_link_ids where key = 'gemba_version'),
  'Floor',
  1
);

select lives_ok(
  format(
    'select public.add_gemba_question(%L::uuid, %L::uuid, ''short_text'', ''What is visible on the floor?'', 1)',
    (select id from work_link_ids where key = 'gemba_version'),
    (select id from work_link_ids where key = 'gemba_section')
  ),
  'add gemba prompt for publish guard'
);

select ok(
  public.set_gemba_definition_applicable_units(
    (select id from work_link_ids where key = 'gemba_definition'),
    array[
      (select id from work_link_ids where key = 'unit'),
      (select id from work_link_ids where key = 'site_b')
    ]::uuid[]
  ),
  'gemba definition applies to site A and site B'
);

select ok(
  public.publish_gemba_definition_version(
    (select id from work_link_ids where key = 'gemba_version')
  ),
  'publish gemba definition for link tests'
);

insert into work_link_ids (key, id)
select 'active_walk', public.start_gemba_walk(
  (select id from work_link_ids where key = 'gemba_definition'),
  (select id from work_link_ids where key = 'unit')
);

insert into work_link_ids (key, id)
select 'completed_walk', public.start_gemba_walk(
  (select id from work_link_ids where key = 'gemba_definition'),
  (select id from work_link_ids where key = 'unit')
);

insert into work_link_ids (key, id)
select 'observation', public.create_gemba_observation(
  (select id from work_link_ids where key = 'active_walk'),
  'Loose cable creates a trip hazard.',
  'issue'
);

insert into work_link_ids (key, id)
select 'completed_observation', public.create_gemba_observation(
  (select id from work_link_ids where key = 'completed_walk'),
  'Completed walk finding.',
  'issue'
);

insert into work_link_ids (key, id)
select 'site_b_walk', public.start_gemba_walk(
  (select id from work_link_ids where key = 'gemba_definition'),
  (select id from work_link_ids where key = 'site_b')
);

insert into work_link_ids (key, id)
select 'site_b_observation', public.create_gemba_observation(
  (select id from work_link_ids where key = 'site_b_walk'),
  'Site B-only observation.',
  'issue'
);

select set_config(
  'test.ci_work_link_completed_walk',
  (select id::text from work_link_ids where key = 'completed_walk'),
  true
);

set local role lean_hub_private_owner;

update public.gemba_walks walk_row
set status = 'completed',
    completed_at = statement_timestamp()
where walk_row.id = current_setting('test.ci_work_link_completed_walk')::uuid;

set local role authenticated;

select ok(
  (
    select walk_row.status
    from public.gemba_walks walk_row
    where walk_row.id = (select id from work_link_ids where key = 'completed_walk')
  ) = 'completed',
  'completed walk seeded for gemba link refusal'
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
select 'project_site_b', public.create_improvement_project(
  'Site B project',
  (select id from work_link_ids where key = 'site_b'),
  'Problem',
  'Objective',
  'Impact'
);

set local role postgres;

with inserted_projects_read_version as (
  insert into public.role_versions (
    organisation_id,
    role_id,
    version_number,
    status,
    created_by_membership_id
  )
  select
    (select id from work_link_ids where key = 'organisation'),
    role_row.id,
    2,
    'draft',
    membership_row.id
  from public.roles role_row
  join public.organisation_memberships membership_row
    on membership_row.organisation_id = role_row.organisation_id
   and membership_row.user_id = 'f1000000-0000-0000-0000-000000000001'
  where role_row.organisation_id = (select id from work_link_ids where key = 'organisation')
    and role_row.module_responsibility_key = 'projects'
  returning id
)
insert into work_link_ids (key, id)
select 'projects_read_only_version', inserted_projects_read_version.id
from inserted_projects_read_version;

insert into public.role_permissions (
  organisation_id,
  role_version_id,
  permission_key
)
values (
  (select id from work_link_ids where key = 'organisation'),
  (select id from work_link_ids where key = 'projects_read_only_version'),
  'projects.read'
);

update public.role_versions role_version
set status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = membership_row.id
from public.organisation_memberships membership_row
where role_version.id = (select id from work_link_ids where key = 'projects_read_only_version')
  and membership_row.organisation_id = (select id from work_link_ids where key = 'organisation')
  and membership_row.user_id = 'f1000000-0000-0000-0000-000000000001';

set local role authenticated;

select ok(
  public.grant_role_version(
    (select id from work_link_ids where key = 'organisation'),
    (select id from work_link_ids where key = 'viewer_membership'),
    (select id from work_link_ids where key = 'projects_read_only_version'),
    'unit_subtree',
    (select id from work_link_ids where key = 'unit')
  ) is not null,
  'viewer receives projects.read on site A'
);

select ok(
  public.grant_role_version(
    (select id from work_link_ids where key = 'organisation'),
    (select id from work_link_ids where key = 'viewer_membership'),
    (select id from work_link_ids where key = 'gemba_role_version'),
    'unit_subtree',
    (select id from work_link_ids where key = 'unit')
  ) is not null,
  'viewer receives gemba walk edit on site A'
);

insert into work_link_ids (key, id)
select 'relink_target_project', public.create_improvement_project(
  'Relink target project',
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
select 'planner_action_guard', public.create_gemba_action(
  'Action for assign-guard coverage',
  (select id from work_link_ids where key = 'active_walk'),
  (select id from work_link_ids where key = 'owner_membership'),
  statement_timestamp() + interval '8 days',
  'f3000000-0000-0000-0000-0000000000aa',
  null,
  null,
  (select id from work_link_ids where key = 'observation'),
  'Guard action context',
  'normal'
);

reset role;
set local role postgres;

select throws_ok(
  format(
    'select private.assign_planner_action_to_creator(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'planner_action_guard'),
    (select id from work_link_ids where key = 'owner_membership')
  ),
  '55000',
  'action already has an assignee',
  'assign_planner_action_to_creator refuses when action already has an assignee'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'owner session after assign_planner guard test'
);

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

set local role lean_hub_private_owner;

select ok(
  exists (
    select 1
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and audit_row.resource_record_id = (select id from work_link_ids where key = 'action')
      and audit_row.event_action = 'ci_project.work_item.linked'
      and audit_row.actor_membership_id = (select id from work_link_ids where key = 'owner_membership')
      and audit_row.metadata ->> 'item_type' = 'action'
      and audit_row.metadata ->> 'to_project_id'
        = (select id::text from work_link_ids where key = 'project')
  ),
  'action link writes business audit with actor and target project'
);

set local role authenticated;

select is(
  (
    select public.get_action_detail((select id from work_link_ids where key = 'action'))
      -> 'linked_project'
      ->> 'id'
  ),
  (select id::text from work_link_ids where key = 'project'),
  'get_action_detail exposes linked_project'
);

select ok(
  (
    public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project'
      ->> 'can_open'
  ) = 'true'
  and (
    public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project'
      ->> 'href'
  ) = '/platform/projects/' || (select id::text from work_link_ids where key = 'project'),
  'readable linked project summary includes can_open and href'
);

select ok(
  (
    public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project'
      ->> 'linked'
  ) = 'true'
  and (
    public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project'
      ->> 'restricted'
  ) = 'false',
  'readable linked project summary includes linked and restricted flags'
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

set local role lean_hub_private_owner;

select ok(
  exists (
    select 1
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and audit_row.resource_record_id = (select id from work_link_ids where key = 'action')
      and audit_row.event_action = 'ci_project.work_item.unlinked'
      and audit_row.actor_membership_id = (select id from work_link_ids where key = 'owner_membership')
      and audit_row.metadata ->> 'from_project_id'
        = (select id::text from work_link_ids where key = 'project')
  ),
  'action unlink writes business audit with actor and from project'
);

set local role authenticated;

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
    select public.get_problem_solving_detail((select id from work_link_ids where key = 'case'))
      -> 'linked_project'
      ->> 'id'
  ),
  (select id::text from work_link_ids where key = 'project'),
  'get_problem_solving_detail exposes linked_project after case link'
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

select throws_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'case'),
    (select id from work_link_ids where key = 'charter_project')
  ),
  '22023',
  'This case already raised this project',
  'case cannot work_item link to its charter project'
);

select lives_ok(
  format(
    'select public.unlink_problem_solving_case_from_ci_project(%L::uuid)',
    (select id from work_link_ids where key = 'case')
  ),
  'unlink_problem_solving_case_from_ci_project succeeds'
);

set local role lean_hub_private_owner;

select ok(
  exists (
    select 1
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and audit_row.resource_record_id = (select id from work_link_ids where key = 'case')
      and audit_row.event_action = 'ci_project.work_item.unlinked'
      and audit_row.actor_membership_id = (select id from work_link_ids where key = 'owner_membership')
      and audit_row.metadata ->> 'from_project_id'
        = (select id::text from work_link_ids where key = 'project')
  ),
  'case unlink writes business audit with actor and from project'
);

set local role authenticated;

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

create temporary table cancelled_project_timestamp on commit drop as
select updated_at from public.ci_projects
where id = (select id from work_link_ids where key = 'cancelled_project');

select ok(
  public.cancel_project(
    (select id from work_link_ids where key = 'cancelled_project'),
    'No longer pursuing'
  ),
  'second project is cancelled'
);

select ok(
  exists (
    select 1 from public.ci_projects project
    where project.id = (select id from work_link_ids where key = 'cancelled_project')
      and project.status = 'cancelled'
      and project.updated_at > (select updated_at from cancelled_project_timestamp)
  ),
  'cancel bumps updated_at'
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
select 'link_methodology', public.create_ci_project_methodology_draft(
  'Work link methodology',
  'work-link-methodology'
);

insert into work_link_ids (key, id)
select 'link_methodology_version', version_row.id
from public.ci_project_methodology_versions version_row
where version_row.methodology_id = (select id from work_link_ids where key = 'link_methodology')
  and version_row.version_number = 1;

select public.add_ci_project_methodology_phase(
  (select id from work_link_ids where key = 'link_methodology_version'),
  'define',
  'Define',
  1
);

select public.publish_ci_project_methodology_version(
  (select id from work_link_ids where key = 'link_methodology_version')
);

reset role;

create function pg_temp.submit_work_link_project(target_project_id uuid)
returns boolean
language plpgsql
as $$
begin
  perform public.update_ci_project_draft(
    target_project_id,
    target_methodology_version_id := (select id from work_link_ids where key = 'link_methodology_version')
  );
  perform public.assign_ci_project_team_member(
    target_project_id,
    (select id from work_link_ids where key = 'owner_membership'),
    'owner'
  );
  return public.submit_project(target_project_id);
end;
$$;

set local role authenticated;

insert into work_link_ids (key, id)
select 'completed_project', public.create_improvement_project(
  'Completed link target',
  (select id from work_link_ids where key = 'unit'),
  'Problem',
  'Objective',
  'Impact'
);

select pg_temp.submit_work_link_project((select id from work_link_ids where key = 'completed_project'));
select public.approve_project((select id from work_link_ids where key = 'completed_project'));
select public.start_project((select id from work_link_ids where key = 'completed_project'));
select public.complete_project(
  (select id from work_link_ids where key = 'completed_project'),
  'Project outcome'
);

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
select 'frozen_case_project', public.create_improvement_project(
  'Case link frozen project',
  (select id from work_link_ids where key = 'unit'),
  'Problem',
  'Objective',
  'Impact'
);

insert into work_link_ids (key, id)
select 'frozen_case', public.create_problem_solving_case_draft(
  'Case on completing project',
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
    (select id from work_link_ids where key = 'frozen_case'),
    (select id from work_link_ids where key = 'frozen_case_project')
  ),
  'frozen case links to project before completion'
);

select pg_temp.submit_work_link_project((select id from work_link_ids where key = 'frozen_case_project'));
select public.approve_project((select id from work_link_ids where key = 'frozen_case_project'));
select public.start_project((select id from work_link_ids where key = 'frozen_case_project'));
select public.complete_project(
  (select id from work_link_ids where key = 'frozen_case_project'),
  'Project outcome'
);

select throws_ok(
  format(
    'select public.unlink_problem_solving_case_from_ci_project(%L::uuid)',
    (select id from work_link_ids where key = 'frozen_case')
  ),
  '55000',
  'This project link is read-only because the project is completed or cancelled.',
  'case unlink refused when work_item project completed'
);

select throws_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'frozen_case'),
    (select id from work_link_ids where key = 'project')
  ),
  '55000',
  'This project link is read-only because the project is completed or cancelled.',
  'case relink from completed project refused'
);

select lives_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'case'),
    (select id from work_link_ids where key = 'project_site_b')
  ),
  'owner links case to site B project for unreadable relink guard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000002","email":"ci-work-link-site-mgr@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'site manager session for case relink denial'
);

select throws_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'case'),
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'problem solving project link is not authorised',
  'case relink from unreadable project refused'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'owner returns after case unreadable relink denial'
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
  'select private.unlink_action_from_ci_project(gen_random_uuid())',
  '42501',
  'permission denied for function unlink_action_from_ci_project',
  'authenticated cannot execute private unlink_action_from_ci_project'
);

select throws_ok(
  'select private.ci_project_link_summary(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function ci_project_link_summary',
  'authenticated cannot execute private ci_project_link_summary'
);

select throws_ok(
  'select private.set_gemba_observation_linked_project(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function set_gemba_observation_linked_project',
  'authenticated cannot execute private set_gemba_observation_linked_project'
);

select throws_ok(
  'select private.clear_gemba_observation_linked_project(gen_random_uuid())',
  '42501',
  'permission denied for function clear_gemba_observation_linked_project',
  'authenticated cannot execute private clear_gemba_observation_linked_project'
);

select throws_ok(
  'select private.link_problem_solving_case_to_ci_project(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function link_problem_solving_case_to_ci_project',
  'authenticated cannot execute private link_problem_solving_case_to_ci_project'
);

select throws_ok(
  'select private.unlink_problem_solving_case_from_ci_project(gen_random_uuid())',
  '42501',
  'permission denied for function unlink_problem_solving_case_from_ci_project',
  'authenticated cannot execute private unlink_problem_solving_case_from_ci_project'
);

select throws_ok(
  'select private.set_five_s_audit_finding_linked_project(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function set_five_s_audit_finding_linked_project',
  'authenticated cannot execute private set_five_s_audit_finding_linked_project'
);

select throws_ok(
  'select private.clear_five_s_audit_finding_linked_project(gen_random_uuid())',
  '42501',
  'permission denied for function clear_five_s_audit_finding_linked_project',
  'authenticated cannot execute private clear_five_s_audit_finding_linked_project'
);

select throws_ok(
  'select private.can_update_problem_solving_case_link(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function can_update_problem_solving_case_link',
  'authenticated cannot execute private can_update_problem_solving_case_link'
);

select throws_ok(
  'select private.ci_project_accepts_work_item_links(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function ci_project_accepts_work_item_links',
  'authenticated cannot execute private ci_project_accepts_work_item_links'
);

select throws_ok(
  'select private.assert_ci_project_accepts_work_item_links(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function assert_ci_project_accepts_work_item_links',
  'authenticated cannot execute private assert_ci_project_accepts_work_item_links'
);

select throws_ok(
  'select private.assert_ci_project_work_item_link_mutable(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'permission denied for function assert_ci_project_work_item_link_mutable',
  'authenticated cannot execute private assert_ci_project_work_item_link_mutable'
);

select ok(
  (
    select jsonb_array_length(
      public.get_ci_projects_portfolio(
        null,
        null,
        null,
        null,
        2,
        1,
        null,
        true
      ) -> 'items'
    ) = 1
  ),
  'portfolio page 2 returns a single item when multiple linkable projects exist'
);

select is(
  public.get_ci_projects_portfolio(
    null,
    null,
    null,
    null,
    1,
    500,
    null,
    true
  ) ->> 'page_size',
  '100',
  'portfolio clamps page_size to 100'
);

select ok(
  (
    select count(*) = 0
    from jsonb_array_elements(
      public.get_ci_projects_portfolio(
        null,
        null,
        null,
        null,
        1,
        100,
        null,
        true
      ) -> 'items'
    ) portfolio_item
    where portfolio_item ->> 'id' = (
      select id::text from work_link_ids where key = 'completed_project'
    )
  ),
  'target_linkable_only excludes completed projects'
);

select set_config(
  'test.ci_work_link_action_id',
  (select id::text from work_link_ids where key = 'action'),
  true
);
select set_config(
  'test.ci_work_link_project_id',
  (select id::text from work_link_ids where key = 'project'),
  true
);

set local role anon;

select throws_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    current_setting('test.ci_work_link_action_id'),
    current_setting('test.ci_work_link_project_id')
  ),
  '42501',
  'permission denied for function link_action_to_ci_project',
  'anon cannot execute link_action_to_ci_project'
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'foreign_org')),
  'switch to foreign organisation for cross-org guard'
);

select throws_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'action'),
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'action project link is not authorised',
  'cross-org cannot link foreign action to home-org project'
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'switch back to home organisation'
);

select lives_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'action'),
    (select id from work_link_ids where key = 'project')
  ),
  'relink setup links standalone action to first project'
);

select set_config(
  'test.ci_work_link_org_id',
  (select id::text from work_link_ids where key = 'organisation'),
  true
);
select set_config(
  'test.ci_work_link_action_id',
  (select id::text from work_link_ids where key = 'action'),
  true
);
select set_config(
  'test.ci_work_link_first_project_id',
  (select id::text from work_link_ids where key = 'project'),
  true
);

set local role lean_hub_private_owner;

update public.ci_project_action_context context_row
set project_phase_id = phase_row.id
from public.ci_project_phases phase_row
where context_row.organisation_id = current_setting('test.ci_work_link_org_id')::uuid
  and context_row.action_id = current_setting('test.ci_work_link_action_id')::uuid
  and phase_row.organisation_id = context_row.organisation_id
  and phase_row.project_id = context_row.project_id;

set local role authenticated;

select ok(
  (
    not exists (
      select 1
      from public.ci_project_phases phase_row
      where phase_row.organisation_id = (select id from work_link_ids where key = 'organisation')
        and phase_row.project_id = (select id from work_link_ids where key = 'project')
    )
    or (
      select context_row.project_phase_id is not null
      from public.ci_project_action_context context_row
      where context_row.organisation_id = (select id from work_link_ids where key = 'organisation')
        and context_row.action_id = (select id from work_link_ids where key = 'action')
    )
  ),
  'relink setup seeded project_phase_id when phases exist'
);

select lives_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'action'),
    (select id from work_link_ids where key = 'relink_target_project')
  ),
  'standalone action relinks to second live project'
);

select is(
  (
    select context_row.project_phase_id::text
    from public.ci_project_action_context context_row
    where context_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and context_row.action_id = (select id from work_link_ids where key = 'action')
  ),
  null,
  'relink clears project_phase_id on move'
);

select ok(
  public.link_action_to_ci_project(
    (select id from work_link_ids where key = 'action'),
    (select id from work_link_ids where key = 'project_site_b')
  ),
  'owner links action to site B project for restricted summary setup'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000002","email":"ci-work-link-site-mgr@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'site-scoped manager selects organisation'
);

select throws_ok(
  format(
    'update public.ci_projects set title = %L where id = %L',
    'Manager-edited project',
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'permission denied for table ci_projects',
  'site-scoped manager cannot directly edit the project title'
);

select ok(
  public.update_ci_project_draft(
    (select id from work_link_ids where key = 'project'),
    target_title := 'Manager-edited project',
    target_scope_in := 'Updated charter scope'
  ),
  'site-scoped manager can edit the draft through its RPC'
);

select throws_ok(
  format(
    'update public.ci_projects set status = %L where id = %L',
    'cancelled',
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'permission denied for table ci_projects',
  'authenticated manager lacks the column privilege to update status'
);

reset role;
-- Restore test-only access to exercise the trigger independently of the ACL and RLS.
create policy test_ci_projects_update on public.ci_projects for update to authenticated
using (true);
grant update (status, actual_start_at) on public.ci_projects to authenticated;
set local role authenticated;

select throws_ok(
  format(
    'update public.ci_projects set status = %L where id = %L',
    'cancelled',
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'protected CI project columns must be changed through project operations',
  'lifecycle trigger rejects a direct status change even with the column grant'
);

select throws_ok(
  format(
    'update public.ci_projects set actual_start_at = statement_timestamp() where id = %L',
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'protected CI project columns must be changed through project operations',
  'lifecycle trigger also rejects a direct actual start timestamp change'
);

reset role;
revoke update (status, actual_start_at) on public.ci_projects from authenticated;
drop policy test_ci_projects_update on public.ci_projects;
set local role authenticated;

select throws_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'action'),
    (select id from work_link_ids where key = 'project_site_b')
  ),
  '42501',
  'project link is not authorised',
  'site-scoped manager cannot link to project on another site'
);

select ok(
  (
    public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project'
      ->> 'restricted'
  ) = 'true'
  and (
    public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project'
      ->> 'linked'
  ) = 'true'
  and (
    public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project'
      ->> 'can_open'
  ) = 'false'
  and not (
    public.get_action_detail((select id from work_link_ids where key = 'action')) -> 'linked_project'
      ? 'id'
  ),
  'unreadable linked project returns opaque restricted summary without id'
);

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'observation'),
    (select id from work_link_ids where key = 'project_site_b')
  ),
  '42501',
  'gemba observation project link is not authorised',
  'site-scoped manager cannot set gemba link to unreadable site B project'
);

select lives_ok(
  format(
    'select public.create_action(%L, null, %L, %L::uuid, null, %L::timestamptz, %L)',
  'Site manager planner create_action',
  'normal',
  (select id from work_link_ids where key = 'unit'),
  statement_timestamp() + interval '5 days',
  'f3000000-0000-0000-0000-0000000000c0'
  ),
  'site manager with actions_no_assign can create_action'
);

select throws_ok(
  format(
    'select public.set_action_assignee(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'planner_action_guard'),
    (select id from work_link_ids where key = 'site_b_manager_membership')
  ),
  '42501',
  'action assignment is not authorised',
  'set_action_assignee rejects self-assign without actions.assign'
);

select is(
  (
    select assignee_row.membership_id::text
    from public.action_assignees assignee_row
    where assignee_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and assignee_row.action_id = (select id from work_link_ids where key = 'planner_action_guard')
  ),
  (select id::text from work_link_ids where key = 'owner_membership'),
  'set_action_assignee denial keeps the original assignee'
);

select throws_ok(
  format(
    'select public.clear_gemba_observation_linked_project(%L::uuid)',
    (select id from work_link_ids where key = 'site_b_observation')
  ),
  '42501',
  'gemba observation project unlink is not authorised',
  'site manager cannot clear gemba project link on out-of-scope observation'
);

select throws_ok(
  'select public.set_action_assignee(gen_random_uuid(), gen_random_uuid())',
  '42501',
  'action assignment is not authorised',
  'set_action_assignee returns unified denial for non-existent action'
);

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    gen_random_uuid(),
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'gemba observation project link is not authorised',
  'site manager receives unified denial for non-existent gemba observation'
);

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'site_b_observation'),
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'gemba observation project link is not authorised',
  'site manager receives unified denial for out-of-scope gemba observation'
);

select throws_ok(
  'select public.clear_gemba_observation_linked_project(gen_random_uuid())',
  '42501',
  'gemba observation project unlink is not authorised',
  'site manager receives unified denial for non-existent gemba observation clear'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'owner returns after site-scoped gemba denial'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000003","email":"ci-work-link-viewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'viewer session for read-only project guards'
);

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'observation'),
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'gemba observation project link is not authorised',
  'gemba set refuses target project that is readable but not editable'
);

select throws_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'case'),
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'problem solving project link is not authorised',
  'case link refuses target project that is readable but not editable'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'owner returns after viewer read-only guards'
);

select lives_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'observation'),
    (select id from work_link_ids where key = 'project')
  ),
  'owner sets gemba observation project link'
);

select is(
  (
    select observation_row.linked_project_id::text
    from public.gemba_walk_observations observation_row
    where observation_row.id = (select id from work_link_ids where key = 'observation')
  ),
  (select id::text from work_link_ids where key = 'project'),
  'gemba observation linked_project_id is set'
);

select lives_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'observation'),
    (select id from work_link_ids where key = 'project_site_b')
  ),
  'owner links observation to unreadable project for clear guard'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000002","email":"ci-work-link-site-mgr@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'site manager session for unreadable gemba clear guard'
);

select throws_ok(
  format(
    'select public.clear_gemba_observation_linked_project(%L::uuid)',
    (select id from work_link_ids where key = 'observation')
  ),
  '42501',
  'gemba observation project unlink is not authorised',
  'gemba clear refuses when current linked project is unreadable'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'owner returns after unreadable gemba clear guard'
);

select lives_ok(
  format(
    'select public.clear_gemba_observation_linked_project(%L::uuid)',
    (select id from work_link_ids where key = 'observation')
  ),
  'owner clears gemba observation project link'
);

set local role lean_hub_private_owner;

select ok(
  exists (
    select 1
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and audit_row.metadata ->> 'item_id'
        = (select id::text from work_link_ids where key = 'observation')
      and audit_row.event_action = 'ci_project.work_item.unlinked'
      and audit_row.actor_membership_id = (select id from work_link_ids where key = 'owner_membership')
      and audit_row.metadata ->> 'from_project_id'
        = (select id::text from work_link_ids where key = 'project_site_b')
  ),
  'gemba observation unlink writes business audit with actor and from project'
);

set local role authenticated;

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'completed_observation'),
    (select id from work_link_ids where key = 'project')
  ),
  '55000',
  'This walk is completed or cancelled and cannot accept project links.',
  'completed walk refuses gemba project link'
);

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'observation'),
    (select id from work_link_ids where key = 'cancelled_project')
  ),
  '55000',
  'This project is completed or cancelled and cannot accept new links.',
  'gemba set link refuses cancelled project'
);

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'observation'),
    (select id from work_link_ids where key = 'completed_project')
  ),
  '55000',
  'This project is completed or cancelled and cannot accept new links.',
  'gemba set link refuses completed project'
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'foreign_org')),
  'switch to foreign organisation for gemba cross-org guard'
);

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'observation'),
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'gemba observation project link is not authorised',
  'gemba cross-org cannot set home-org observation link'
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'owner returns after gemba cross-org denial'
);

insert into work_link_ids (key, id)
select 'gemba_action_idem', public.create_gemba_action(
  'Gemba action with due date',
  (select id from work_link_ids where key = 'active_walk'),
  (select id from work_link_ids where key = 'owner_membership'),
  statement_timestamp() + interval '7 days',
  'f3000000-0000-0000-0000-000000000001',
  null,
  null,
  (select id from work_link_ids where key = 'observation'),
  'From observation',
  'normal'
);

select is(
  public.create_gemba_action(
    'Gemba action with due date replay',
    (select id from work_link_ids where key = 'active_walk'),
    (select id from work_link_ids where key = 'owner_membership'),
    statement_timestamp() + interval '7 days',
    'f3000000-0000-0000-0000-000000000001',
    null,
    null,
    (select id from work_link_ids where key = 'observation'),
    'From observation',
    'normal'
  ),
  (select id from work_link_ids where key = 'gemba_action_idem'),
  'create_gemba_action idempotency key replay returns the same action'
);

select throws_ok(
  format(
    'select public.create_gemba_action(%L, %L::uuid, %L::uuid, null, %L)',
    'Gemba action missing due date',
    (select id from work_link_ids where key = 'active_walk'),
    (select id from work_link_ids where key = 'owner_membership'),
    'f3000000-0000-0000-0000-000000000002'
  ),
  '22023',
  'gemba actions require a due date',
  'create_gemba_action requires due date in the database'
);

select throws_ok(
  format(
    'select public.create_gemba_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    'Gemba action missing idempotency key',
    (select id from work_link_ids where key = 'active_walk'),
    (select id from work_link_ids where key = 'owner_membership'),
    statement_timestamp() + interval '3 days',
    ''
  ),
  '22023',
  'gemba actions require an idempotency key',
  'create_gemba_action requires idempotency key in the database'
);

select throws_ok(
  format(
    'select public.create_gemba_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    'Gemba action invalid assignee',
    (select id from work_link_ids where key = 'active_walk'),
    gen_random_uuid(),
    statement_timestamp() + interval '3 days',
    'f3000000-0000-0000-0000-000000000003'
  ),
  '42501',
  'assignee is not authorised',
  'create_gemba_action rejects unknown assignee membership'
);

select throws_ok(
  format(
    'select private.create_gemba_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    'Denied private gemba action',
    (select id from work_link_ids where key = 'active_walk'),
    (select id from work_link_ids where key = 'owner_membership'),
    statement_timestamp() + interval '2 days',
    'f3000000-0000-0000-0000-000000000099'
  ),
  '42501',
  'permission denied for function create_gemba_action',
  'authenticated cannot execute private create_gemba_action'
);

select set_config(
  'test.ci_work_link_observation_id',
  (select id::text from work_link_ids where key = 'observation'),
  true
);

set local role anon;

select throws_ok(
  format(
    'select public.set_gemba_observation_linked_project(%L::uuid, %L::uuid)',
    current_setting('test.ci_work_link_observation_id'),
    current_setting('test.ci_work_link_project_id')
  ),
  '42501',
  'permission denied for function set_gemba_observation_linked_project',
  'anon cannot execute set_gemba_observation_linked_project'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000099","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000099","email":"ci-work-link-outsider@example.test"}',
  true
);

select throws_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    current_setting('test.ci_work_link_action_id'),
    current_setting('test.ci_work_link_project_id')
  ),
  '42501',
  'action project link is not authorised',
  'non-member cannot link actions to projects'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'owner session before existence oracle case setup'
);

insert into work_link_ids (key, id)
select 'second_active_walk', public.start_gemba_walk(
  (select id from work_link_ids where key = 'gemba_definition'),
  (select id from work_link_ids where key = 'unit')
);

select throws_ok(
  format(
    'select public.create_gemba_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    'Gemba walk mismatch replay',
    (select id from work_link_ids where key = 'second_active_walk'),
    (select id from work_link_ids where key = 'owner_membership'),
    statement_timestamp() + interval '4 days',
    'f3000000-0000-0000-0000-000000000001'
  ),
  '23505',
  'gemba action idempotency key reuse mismatch',
  'create_gemba_action rejects idempotency replay on a different walk'
);

insert into work_link_ids (key, id)
select 'closed_case_site_b', public.create_problem_solving_case_draft(
  'Closed case on site B',
  (select id from work_link_ids where key = 'site_b'),
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
    (select id from work_link_ids where key = 'closed_case_site_b'),
    (select id from work_link_ids where key = 'rapid_method')
  ),
  'closed site B case activates'
);

select ok(
  public.cancel_problem_solving_case(
    (select id from work_link_ids where key = 'closed_case_site_b'),
    'Stopped on site B'
  ),
  'closed site B case cancelled'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000002","email":"ci-work-link-site-mgr@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'site manager session for existence oracle guards'
);

select throws_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
  gen_random_uuid(),
    (select id from work_link_ids where key = 'project')
  ),
  '42501',
  'problem solving project link is not authorised',
  'site manager receives unified denial for non-existent case'
);

select throws_ok(
  format(
    'select public.link_problem_solving_case_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'closed_case_site_b'),
    (select id from work_link_ids where key = 'project_site_b')
  ),
  '42501',
  'problem solving project link is not authorised',
  'site manager receives unified denial for closed case on another site'
);

select throws_ok(
  'select public.unlink_problem_solving_case_from_ci_project(gen_random_uuid())',
  '42501',
  'problem solving project unlink is not authorised',
  'site manager receives unified denial for non-existent case unlink'
);

select throws_ok(
  format(
    'select public.unlink_problem_solving_case_from_ci_project(%L::uuid)',
    (select id from work_link_ids where key = 'closed_case_site_b')
  ),
  '42501',
  'problem solving project unlink is not authorised',
  'site manager receives unified denial for out-of-scope case unlink'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  format(
    'select public.switch_organisation(%L::uuid)',
    (select id from work_link_ids where key = 'organisation')
  ),
  'owner returns after existence oracle guards'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000004","email":"ci-work-link-team-member@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'team member selects organisation'
);

insert into work_link_ids (key, id)
select 'team_member_gemba_action', public.create_gemba_action(
  'Team member self-assigned walk action',
  (select id from work_link_ids where key = 'active_walk'),
  (select id from work_link_ids where key = 'team_member_membership'),
  statement_timestamp() + interval '3 days',
  'f1100000-0000-0000-0000-0000000000a1'
);

select is(
  (
    select assignee_row.membership_id::text
    from public.action_assignees assignee_row
    where assignee_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and assignee_row.action_id = (select id from work_link_ids where key = 'team_member_gemba_action')
  ),
  (select id::text from work_link_ids where key = 'team_member_membership'),
  'team member create_gemba_action self-assign sets creator as assignee'
);

select throws_ok(
  format(
    'select public.create_gemba_action(%L, %L::uuid, %L::uuid, %L::timestamptz, %L)',
    'Team member other assign denied',
    (select id from work_link_ids where key = 'active_walk'),
    (select id from work_link_ids where key = 'owner_membership'),
    statement_timestamp() + interval '4 days',
    'f1100000-0000-0000-0000-0000000000a2'
  ),
  '42501',
  'action assignment is not authorised',
  'team member create_gemba_action refuses assignee without actions.assign'
);

select is(
  (
    select count(*)::integer
    from public.actions action_row
    where action_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and action_row.idempotency_key = format(
        'gemba:%s:f1100000-0000-0000-0000-0000000000a2',
        (select id::text from work_link_ids where key = 'team_member_membership')
      )
  ),
  0,
  'denied team member gemba action assign leaves no action row'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f1100000-0000-0000-0000-000000000001","email":"ci-work-link-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from work_link_ids where key = 'organisation')),
  'owner returns for five_s audit link coverage'
);

insert into work_link_ids (key, id)
select 'five_s_standard', public.create_five_s_standard_draft(
  'CI work link 5S',
  'Five S link audit coverage',
  90
);

insert into work_link_ids (key, id)
select 'five_s_version', version_row.id
from public.five_s_standard_versions version_row
where version_row.standard_id = (select id from work_link_ids where key = 'five_s_standard')
  and version_row.version_number = 1;

insert into work_link_ids (key, id)
select 'five_s_section', public.add_five_s_section(
  (select id from work_link_ids where key = 'five_s_version'),
  'Sort',
  1
);

insert into work_link_ids (key, id)
select 'five_s_question', public.add_five_s_question(
  target_standard_version_id := (select id from work_link_ids where key = 'five_s_version'),
  target_section_id := (select id from work_link_ids where key = 'five_s_section'),
  target_question_type := 'yes_no',
  target_prompt := 'Tools stored correctly?',
  target_position := 1,
  target_is_required := true
);

select public.set_five_s_standard_applicable_units(
  (select id from work_link_ids where key = 'five_s_standard'),
  array[(select id from work_link_ids where key = 'unit')]
);

select ok(
  public.publish_five_s_standard_version((select id from work_link_ids where key = 'five_s_version')),
  'five_s standard published for link audit test'
);

insert into work_link_ids (key, id)
select 'five_s_audit', public.start_five_s_audit(
  (select id from work_link_ids where key = 'five_s_standard'),
  (select id from work_link_ids where key = 'unit')
);

insert into work_link_ids (key, id)
select 'five_s_finding', public.create_five_s_finding(
  (select id from work_link_ids where key = 'five_s_audit'),
  'Loose tool storage',
  (select id from work_link_ids where key = 'five_s_section'),
  (select id from work_link_ids where key = 'five_s_question'),
  'low',
  'normal',
  false
);

set local role lean_hub_private_owner;

select ok(
  private.set_five_s_audit_finding_linked_project(
    (select id from work_link_ids where key = 'five_s_finding'),
    (select id from work_link_ids where key = 'project')
  ),
  'owner private set links five_s finding to project'
);

select ok(
  private.clear_five_s_audit_finding_linked_project(
    (select id from work_link_ids where key = 'five_s_finding')
  ),
  'owner private clear unlinks five_s finding'
);

select ok(
  exists (
    select 1
    from public.business_audit_events audit_row
    where audit_row.organisation_id = (select id from work_link_ids where key = 'organisation')
      and audit_row.metadata ->> 'item_id'
        = (select id::text from work_link_ids where key = 'five_s_finding')
      and audit_row.event_action = 'ci_project.work_item.unlinked'
      and audit_row.actor_membership_id = (select id from work_link_ids where key = 'owner_membership')
      and audit_row.metadata ->> 'from_project_id'
        = (select id::text from work_link_ids where key = 'project')
  ),
  'five_s finding unlink writes business audit with actor and from project'
);

set local role authenticated;

insert into work_link_ids (key, id)
select 'status_test_project', public.create_improvement_project(
  'Project action status guard',
  (select id from work_link_ids where key = 'unit'),
  'Problem',
  'Objective',
  'Impact'
);

insert into work_link_ids (key, id)
select 'status_test_action', public.create_action(
  'Test supported project link statuses',
  target_unit_id := (select id from work_link_ids where key = 'unit')
);

select ok(
  public.link_action_to_ci_project(
    (select id from work_link_ids where key = 'status_test_action'),
    (select id from work_link_ids where key = 'status_test_project')
  ),
  'a Draft project accepts an action link'
);

select is(
  (select status from public.ci_projects where id =
    (select id from work_link_ids where key = 'status_test_project')),
  'draft',
  'linking the action leaves the project in Draft'
);

select lives_ok(
  format(
    'select public.create_project_action(%L, %L::uuid)',
    'New action from Draft project',
    (select id from work_link_ids where key = 'status_test_project')
  ),
  'creating a new linked action on a Draft project succeeds'
);

select public.unlink_action_from_ci_project(
  (select id from work_link_ids where key = 'status_test_action')
);

select ok(
  pg_temp.submit_work_link_project((select id from work_link_ids where key = 'status_test_project')),
  'draft project submits through the lifecycle RPC'
);

select lives_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'status_test_action'),
    (select id from work_link_ids where key = 'status_test_project')
  ),
  'Submitted projects accept links from existing actions'
);

select lives_ok(
  format(
    'select public.create_project_action(%L, %L::uuid)',
    'New action from Submitted project',
    (select id from work_link_ids where key = 'status_test_project')
  ),
  'Submitted projects can create linked actions'
);

select is(
  (select status from public.ci_projects where id =
    (select id from work_link_ids where key = 'status_test_project')),
  'submitted',
  'linking actions leaves the project in Submitted'
);

select public.unlink_action_from_ci_project(
  (select id from work_link_ids where key = 'status_test_action')
);

select ok(
  public.approve_project((select id from work_link_ids where key = 'status_test_project')),
  'submitted project approves through the lifecycle RPC'
);

select lives_ok(
  format(
    'select public.link_action_to_ci_project(%L::uuid, %L::uuid)',
    (select id from work_link_ids where key = 'status_test_action'),
    (select id from work_link_ids where key = 'status_test_project')
  ),
  'Approved projects accept links from existing actions'
);

select lives_ok(
  format(
    'select public.create_project_action(%L, %L::uuid)',
    'New action from Approved project',
    (select id from work_link_ids where key = 'status_test_project')
  ),
  'Approved projects can create linked actions'
);

select is(
  (select status from public.ci_projects where id =
    (select id from work_link_ids where key = 'status_test_project')),
  'approved',
  'linking actions leaves the project in Approved'
);

select ok(
  public.start_project((select id from work_link_ids where key = 'status_test_project')),
  'approved project activates through the lifecycle RPC'
);

select ok(
  public.hold_project((select id from work_link_ids where key = 'status_test_project')),
  'active project goes on hold through the lifecycle RPC'
);

select lives_ok(
  format(
    'select public.create_project_action(%L, %L::uuid)',
    'New action from On hold project',
    (select id from work_link_ids where key = 'status_test_project')
  ),
  'creating a new linked action on an On hold project succeeds'
);

insert into work_link_ids (key, id)
select 'direct_link_action', public.create_action(
  'Test direct action context writes',
  target_unit_id := (select id from work_link_ids where key = 'unit')
);

set local role lean_hub_private_owner;

select throws_ok(
  format(
    'insert into public.ci_project_action_context
       (organisation_id, action_id, project_id, created_by_membership_id)
     values (%L, %L, %L, %L)',
    (select id from work_link_ids where key = 'organisation'),
    (select id from work_link_ids where key = 'direct_link_action'),
    attempt.project_id,
    (select id from work_link_ids where key = 'owner_membership')
  ),
  attempt.errcode,
  attempt.message,
  attempt.description
)
from (
  values
    (
      (select id from work_link_ids where key = 'cancelled_project'),
      '55000',
      'This project is completed or cancelled and cannot accept new links.',
      'action context trigger rejects a direct insert for a cancelled project'
    ),
    (
      (select id from work_link_ids where key = 'completed_project'),
      '55000',
      'This project is completed or cancelled and cannot accept new links.',
      'action context trigger rejects a direct insert for a completed project'
    ),
    (
      gen_random_uuid(),
      '42501',
      'project link is not authorised',
      'action context trigger rejects a direct insert for a missing project'
    )
) as attempt(project_id, errcode, message, description);

select throws_ok(
  format(
    'update public.ci_project_action_context set project_id = %L
     where organisation_id = %L and action_id = %L',
    (select id from work_link_ids where key = 'cancelled_project'),
    (select id from work_link_ids where key = 'organisation'),
    (select id from work_link_ids where key = 'status_test_action')
  ),
  '55000',
  'This project is completed or cancelled and cannot accept new links.',
  'action context trigger rejects moving an existing link to a cancelled project'
);

reset role;

select is(
  pg_get_userbyid(proowner)::text,
  'lean_hub_private_owner',
  'action link guard is owned by the private application role'
)
from pg_proc
where oid = 'private.guard_action_project_link_status()'::regprocedure;

select ok(
  not exists (
    select 1
    from aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
    where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute the action link guard'
)
from pg_proc proc
where proc.oid = 'private.guard_action_project_link_status()'::regprocedure;

select ok(
  not has_function_privilege(role_name, 'private.guard_action_project_link_status()', 'EXECUTE'),
  role_name || ' cannot execute the action link guard'
)
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name);

select * from finish();
rollback;