begin;

select plan(23);
insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'c1000000-0000-0000-0000-000000000001',
  'ci-projects-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1000000-0000-0000-0000-000000000002',
  'ci-projects-member@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1000000-0000-0000-0000-000000000003',
  'ci-projects-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table project_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on project_ids to authenticated;

insert into project_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c1000000-0000-0000-0000-000000000001',
    'ci-projects-org',
    'CI Projects Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'c2000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'c2000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'c2000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"ci-projects-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from project_ids where key = 'organisation')),
  'owner selects organisation'
);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in ('projects.read', 'projects.manage')
  ),
  'project permissions are registered'
);

insert into project_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from project_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into project_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from project_ids where key = 'organisation')
  and membership_row.user_id = 'c1000000-0000-0000-0000-000000000001';

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from project_ids where key = 'organisation'),
    'c1000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into project_ids (key, id)
select 'team_member_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'c1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000003'
);

insert into project_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'c1000000-0000-0000-0000-000000000003',
    'ci-projects-org-b',
    'CI Projects Organisation B'
  )
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"ci-projects-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from project_ids where key = 'organisation')),
  'owner reselects primary organisation'
);

insert into project_ids (key, id)
select 'methodology', public.create_ci_project_methodology_draft(
  'DMAIC Lite',
  'dmaic-lite',
  'Compact DMAIC methodology'
);

insert into project_ids (key, id)
select 'methodology_version', version_row.id
from public.ci_project_methodology_versions version_row
where version_row.methodology_id = (select id from project_ids where key = 'methodology')
  and version_row.version_number = 1;

select ok(
  public.add_ci_project_methodology_phase(
    (select id from project_ids where key = 'methodology_version'),
    'define',
    'Define',
    1,
    'Define the problem'
  ) is not null,
  'methodology draft accepts phase'
);

select ok(
  public.add_ci_project_methodology_phase(
    (select id from project_ids where key = 'methodology_version'),
    'measure',
    'Measure',
    2,
    'Measure baseline performance'
  ) is not null,
  'methodology draft accepts sequential phase'
);

reset role;

update public.ci_project_methodology_versions version_table
set status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = (select id from project_ids where key = 'owner_membership')
where version_table.id = (select id from project_ids where key = 'methodology_version');

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"ci-projects-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  exists (
    select 1
    from public.ci_project_methodology_versions version_row
    where version_row.id = (select id from project_ids where key = 'methodology_version')
      and version_row.status = 'published'
  ),
  'methodology version is published for project charter'
);

select throws_ok(
  format(
    'select public.add_ci_project_methodology_phase(%L::uuid, %L, %L, %s, %L)',
    (select id from project_ids where key = 'methodology_version'),
    'measure',
    'Measure',
    2,
    'Measure baseline'
  ),
  'methodology version is not editable',
  '55000'
);

insert into project_ids (key, id)
select 'project', public.create_improvement_project(
  'Changeover reduction pilot',
  (select id from project_ids where key = 'unit_root'),
  'Changeovers exceed target on Line 2',
  'Reduce average changeover below 30 minutes',
  'Lower downtime and scrap'
);

reset role;

update public.ci_projects project_table
set methodology_version_id = (select id from project_ids where key = 'methodology_version')
where project_table.id = (select id from project_ids where key = 'project');

insert into public.ci_project_team_assignments (
  organisation_id,
  project_id,
  membership_id,
  team_role,
  assigned_by_membership_id
)
values (
  (select id from project_ids where key = 'organisation'),
  (select id from project_ids where key = 'project'),
  (select id from project_ids where key = 'owner_membership'),
  'owner',
  (select id from project_ids where key = 'owner_membership')
);

insert into public.ci_project_team_assignments (
  organisation_id,
  project_id,
  membership_id,
  team_role,
  assigned_by_membership_id
)
values (
  (select id from project_ids where key = 'organisation'),
  (select id from project_ids where key = 'project'),
  (select id from project_ids where key = 'team_member_membership'),
  'member',
  (select id from project_ids where key = 'owner_membership')
);

insert into public.ci_project_metrics (
  organisation_id,
  project_id,
  metric_key,
  display_name,
  unit_label,
  baseline_value,
  target_value,
  created_by_membership_id
)
values (
  (select id from project_ids where key = 'organisation'),
  (select id from project_ids where key = 'project'),
  'changeover-minutes',
  'Changeover duration',
  'minutes',
  48,
  28,
  (select id from project_ids where key = 'owner_membership')
);

insert into project_ids (key, id)
select 'metric', metric_row.id
from public.ci_project_metrics metric_row
where metric_row.project_id = (select id from project_ids where key = 'project')
  and metric_row.metric_key = 'changeover-minutes';

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000002","email":"ci-projects-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from project_ids where key = 'organisation')),
  'team member selects organisation'
);

select throws_ok(
  format(
    'select public.get_ci_project_detail(%L::uuid)',
    (select id from project_ids where key = 'project')
  ),
  'project detail is not authorised',
  '42501'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000003","email":"ci-projects-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from project_ids where key = 'organisation_b')),
  'outsider selects other organisation'
);

select throws_ok(
  format(
    'select public.get_ci_project_detail(%L::uuid)',
    (select id from project_ids where key = 'project')
  ),
  'project detail is not authorised',
  '42501'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"ci-projects-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from project_ids where key = 'organisation')),
  'owner returns to primary organisation'
);

select ok(
  public.submit_project((select id from project_ids where key = 'project')),
  'draft project submits'
);

select is(
  (select status from public.ci_projects where id = (select id from project_ids where key = 'project')),
  'submitted',
  'submit transitions project to submitted'
);

select ok(
  public.approve_project((select id from project_ids where key = 'project')),
  'submitted project approves'
);

select ok(
  public.start_project((select id from project_ids where key = 'project')),
  'approved project starts'
);

select ok(
  exists (
    select 1
    from public.ci_project_metrics metric_row
    where metric_row.id = (select id from project_ids where key = 'metric')
      and metric_row.is_locked = true
  ),
  'active project locks metrics'
);

insert into project_ids (key, id)
select 'phase_one', phase_row.id
from public.ci_project_phases phase_row
where phase_row.project_id = (select id from project_ids where key = 'project')
  and phase_row.display_order = 1;

insert into project_ids (key, id)
select 'phase_two', phase_row.id
from public.ci_project_phases phase_row
where phase_row.project_id = (select id from project_ids where key = 'project')
  and phase_row.display_order = 2;

select throws_ok(
  format(
    'select public.complete_project_phase(%L::uuid, %L::uuid, false)',
    (select id from project_ids where key = 'project'),
    (select id from project_ids where key = 'phase_two')
  ),
  'project phases must progress sequentially',
  '55000'
);

select ok(
  public.complete_project_phase(
    (select id from project_ids where key = 'project'),
    (select id from project_ids where key = 'phase_one'),
    false
  ),
  'in-progress phase completes'
);

select ok(
  public.record_metric_measurement(
    (select id from project_ids where key = 'metric'),
    42,
    statement_timestamp(),
    'Weekly measurement'
  ) is not null,
  'active project accepts metric measurement'
);

select ok(
  public.complete_project(
    (select id from project_ids where key = 'project'),
    'Average changeover reduced below target',
    'Early operator involvement helped',
    'Weekly audits sustain gains'
  ),
  'active project completes with snapshot'
);

select ok(
  exists (
    select 1
    from public.ci_project_completion_snapshots snapshot_row
    where snapshot_row.project_id = (select id from project_ids where key = 'project')
  ),
  'completion snapshot is persisted'
);

select throws_ok(
  format(
    'update public.ci_projects set title = %L where id = %L',
    'Renamed',
    (select id from project_ids where key = 'project')
  ),
  '55000',
  null,
  'completed project record is immutable'
);

select * from finish();
rollback;
