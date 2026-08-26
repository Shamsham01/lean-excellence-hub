-- Milestone 8 closure: draft editing, team assignment, and metric creation RPCs.

create or replace function private.update_ci_project_draft(
  target_project_id uuid,
  target_title text default null,
  target_problem_statement text default null,
  target_objective text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_baseline_summary text default null,
  target_target_summary text default null,
  target_expected_impact_summary text default null,
  target_constraints_risks text default null,
  target_sustainment_expectation text default null,
  target_methodology_version_id uuid default null,
  target_planned_start_date date default null,
  target_planned_end_date date default null,
  target_priority text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  project_row public.ci_projects%rowtype;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'project draft update is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
    and project_table.status = 'draft'
  for update;

  if not found then
    raise exception 'only draft projects can be edited'
      using errcode = '55000';
  end if;

  if target_methodology_version_id is not null then
    if not exists (
      select 1
      from public.ci_project_methodology_versions version_table
      where version_table.organisation_id = org_id
        and version_table.id = target_methodology_version_id
        and version_table.status = 'published'
    ) then
      raise exception 'methodology version is not published'
        using errcode = '22023';
    end if;
  end if;

  update public.ci_projects project_table
  set
    title = coalesce(target_title, project_table.title),
    problem_statement = coalesce(target_problem_statement, project_table.problem_statement),
    objective = coalesce(target_objective, project_table.objective),
    scope_in = coalesce(target_scope_in, project_table.scope_in),
    scope_out = coalesce(target_scope_out, project_table.scope_out),
    baseline_summary = coalesce(target_baseline_summary, project_table.baseline_summary),
    target_summary = coalesce(target_target_summary, project_table.target_summary),
    expected_impact_summary = coalesce(
      target_expected_impact_summary,
      project_table.expected_impact_summary
    ),
    constraints_risks = coalesce(target_constraints_risks, project_table.constraints_risks),
    sustainment_expectation = coalesce(
      target_sustainment_expectation,
      project_table.sustainment_expectation
    ),
    methodology_version_id = coalesce(
      target_methodology_version_id,
      project_table.methodology_version_id
    ),
    planned_start_date = coalesce(target_planned_start_date, project_table.planned_start_date),
    planned_end_date = coalesce(target_planned_end_date, project_table.planned_end_date),
    priority = coalesce(target_priority, project_table.priority),
    updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  return true;
end;
$$;

create or replace function private.assign_ci_project_team_member(
  target_project_id uuid,
  target_membership_id uuid,
  target_team_role text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  project_row public.ci_projects%rowtype;
  assignment_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'project team assignment is not authorised'
      using errcode = '42501';
  end if;

  if target_team_role not in ('owner', 'sponsor', 'facilitator', 'member') then
    raise exception 'invalid project team role'
      using errcode = '22023';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = '22023';
  end if;

  if project_row.status not in ('draft', 'submitted', 'approved') then
    raise exception 'team changes are not allowed in current project status'
      using errcode = '55000';
  end if;

  if target_team_role = 'owner' then
    update public.ci_project_team_assignments assignment_table
    set valid_to = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.project_id = target_project_id
      and assignment_table.team_role = 'owner'
      and assignment_table.valid_to is null;
  end if;

  assignment_id := gen_random_uuid();

  insert into public.ci_project_team_assignments (
    id,
    organisation_id,
    project_id,
    membership_id,
    team_role,
    assigned_by_membership_id
  )
  values (
    assignment_id,
    org_id,
    target_project_id,
    target_membership_id,
    target_team_role,
    actor_membership_id
  );

  return assignment_id;
end;
$$;

create or replace function private.create_ci_project_metric(
  target_project_id uuid,
  target_metric_key text,
  target_display_name text,
  target_unit_label text default null,
  target_baseline_value numeric default null,
  target_target_value numeric default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  metric_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'project metric creation is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.ci_projects project_table
    where project_table.organisation_id = org_id
      and project_table.id = target_project_id
      and project_table.status not in ('draft', 'submitted', 'approved')
  ) then
    raise exception 'metrics cannot be added in current project status'
      using errcode = '55000';
  end if;

  metric_id := gen_random_uuid();

  insert into public.ci_project_metrics (
    id,
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
    metric_id,
    org_id,
    target_project_id,
    btrim(target_metric_key),
    btrim(target_display_name),
    target_unit_label,
    target_baseline_value,
    target_target_value,
    actor_membership_id
  );

  return metric_id;
end;
$$;

create or replace function public.update_ci_project_draft(
  target_project_id uuid,
  target_title text default null,
  target_problem_statement text default null,
  target_objective text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_baseline_summary text default null,
  target_target_summary text default null,
  target_expected_impact_summary text default null,
  target_constraints_risks text default null,
  target_sustainment_expectation text default null,
  target_methodology_version_id uuid default null,
  target_planned_start_date date default null,
  target_planned_end_date date default null,
  target_priority text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_ci_project_draft(
    target_project_id,
    target_title,
    target_problem_statement,
    target_objective,
    target_scope_in,
    target_scope_out,
    target_baseline_summary,
    target_target_summary,
    target_expected_impact_summary,
    target_constraints_risks,
    target_sustainment_expectation,
    target_methodology_version_id,
    target_planned_start_date,
    target_planned_end_date,
    target_priority
  )
$$;

create or replace function public.assign_ci_project_team_member(
  target_project_id uuid,
  target_membership_id uuid,
  target_team_role text
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.assign_ci_project_team_member(
    target_project_id,
    target_membership_id,
    target_team_role
  )
$$;

create or replace function public.create_ci_project_metric(
  target_project_id uuid,
  target_metric_key text,
  target_display_name text,
  target_unit_label text default null,
  target_baseline_value numeric default null,
  target_target_value numeric default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_ci_project_metric(
    target_project_id,
    target_metric_key,
    target_display_name,
    target_unit_label,
    target_baseline_value,
    target_target_value
  )
$$;

grant execute on function public.update_ci_project_draft(
  uuid, text, text, text, text, text, text, text, text, text, text, uuid, date, date, text
) to authenticated;
grant execute on function public.assign_ci_project_team_member(uuid, uuid, text) to authenticated;
grant execute on function public.create_ci_project_metric(
  uuid, text, text, text, numeric, numeric
) to authenticated;

revoke all on function public.update_ci_project_draft(
  uuid, text, text, text, text, text, text, text, text, text, text, uuid, date, date, text
) from public, anon;
revoke all on function public.assign_ci_project_team_member(uuid, uuid, text) from public, anon;
revoke all on function public.create_ci_project_metric(
  uuid, text, text, text, numeric, numeric
) from public, anon;

alter function private.update_ci_project_draft(
  uuid, text, text, text, text, text, text, text, text, text, text, uuid, date, date, text
) owner to lean_hub_private_owner;
alter function private.assign_ci_project_team_member(uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.create_ci_project_metric(uuid, text, text, text, numeric, numeric)
  owner to lean_hub_private_owner;
