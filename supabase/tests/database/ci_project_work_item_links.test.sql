begin;

select plan(70);

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
  );

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values (
  (select id from work_link_ids where key = 'organisation'),
  'f1000000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'f1000000-0000-0000-0000-000000000002';

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
    (select id from work_link_ids where key = 'actions_role_version'),
    'unit_subtree',
    (select id from work_link_ids where key = 'unit')
  ) is not null,
  'site-scoped manager receives actions responsibility on site A'
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
  'project link is not authorised',
  'site-scoped manager cannot set gemba link to unreadable site B project'
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
    'select public.clear_gemba_observation_linked_project(%L::uuid)',
    (select id from work_link_ids where key = 'observation')
  ),
  'owner clears gemba observation project link'
);

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
  'project link is not authorised',
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

select * from finish();
rollback;