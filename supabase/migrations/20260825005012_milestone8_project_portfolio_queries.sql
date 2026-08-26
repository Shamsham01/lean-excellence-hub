-- Milestone 8: portfolio list and detail query RPCs.

create or replace function public.get_ci_projects_portfolio(
  target_search text default null,
  target_status text default null,
  target_unit_id uuid default null,
  target_priority text default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  offset_val integer;
  items jsonb;
  total_count integer;
begin
  if org_id is null then
    raise exception 'project portfolio is not authorised'
      using errcode = '42501';
  end if;

  offset_val := greatest((target_page - 1) * target_page_size, 0);

  select count(*)
  into total_count
  from public.ci_projects project_row
  where project_row.organisation_id = org_id
    and private.can_read_ci_project(org_id, project_row.id)
    and (target_status is null or project_row.status = target_status)
    and (target_unit_id is null or project_row.unit_id = target_unit_id)
    and (target_priority is null or project_row.priority = target_priority)
    and (
      target_search is null
      or project_row.title ilike '%' || target_search || '%'
      or project_row.project_number ilike '%' || target_search || '%'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', project_row.id,
        'project_number', project_row.project_number,
        'title', project_row.title,
        'status', project_row.status,
        'priority', project_row.priority,
        'unit_id', project_row.unit_id,
        'methodology_version_id', project_row.methodology_version_id,
        'planned_start_date', project_row.planned_start_date,
        'planned_end_date', project_row.planned_end_date,
        'actual_start_at', project_row.actual_start_at,
        'actual_end_at', project_row.actual_end_at,
        'created_by_membership_id', project_row.created_by_membership_id,
        'created_at', project_row.created_at,
        'updated_at', project_row.updated_at
      )
      order by project_row.updated_at desc
    ),
    '[]'::jsonb
  )
  into items
  from public.ci_projects project_row
  where project_row.organisation_id = org_id
    and private.can_read_ci_project(org_id, project_row.id)
    and (target_status is null or project_row.status = target_status)
    and (target_unit_id is null or project_row.unit_id = target_unit_id)
    and (target_priority is null or project_row.priority = target_priority)
    and (
      target_search is null
      or project_row.title ilike '%' || target_search || '%'
      or project_row.project_number ilike '%' || target_search || '%'
    )
  limit target_page_size
  offset offset_val;

  return jsonb_build_object(
    'items', items,
    'total_count', total_count,
    'page', target_page,
    'page_size', target_page_size
  );
end;
$$;

create or replace function public.get_ci_project_detail(
  target_project_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  project_row public.ci_projects%rowtype;
  team_members jsonb;
  status_history jsonb;
  phases jsonb;
  metrics jsonb;
  completion_snapshot jsonb;
begin
  if org_id is null then
    raise exception 'project detail is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_ci_project(org_id, target_project_id) then
    raise exception 'project detail is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', assignment_row.id,
        'membership_id', assignment_row.membership_id,
        'team_role', assignment_row.team_role,
        'valid_from', assignment_row.valid_from,
        'valid_to', assignment_row.valid_to
      )
      order by assignment_row.team_role, assignment_row.valid_from
    ),
    '[]'::jsonb
  )
  into team_members
  from public.ci_project_team_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.project_id = target_project_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', history_row.id,
        'from_status', history_row.from_status,
        'to_status', history_row.to_status,
        'changed_by_membership_id', history_row.changed_by_membership_id,
        'reason', history_row.reason,
        'changed_at', history_row.changed_at
      )
      order by history_row.changed_at
    ),
    '[]'::jsonb
  )
  into status_history
  from public.ci_project_status_history history_row
  where history_row.organisation_id = org_id
    and history_row.project_id = target_project_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', phase_row.id,
        'phase_key_snapshot', phase_row.phase_key_snapshot,
        'title_snapshot', phase_row.title_snapshot,
        'description_snapshot', phase_row.description_snapshot,
        'display_order', phase_row.display_order,
        'status', phase_row.status,
        'started_at', phase_row.started_at,
        'completed_at', phase_row.completed_at
      )
      order by phase_row.display_order
    ),
    '[]'::jsonb
  )
  into phases
  from public.ci_project_phases phase_row
  where phase_row.organisation_id = org_id
    and phase_row.project_id = target_project_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', metric_row.id,
        'metric_key', metric_row.metric_key,
        'display_name', metric_row.display_name,
        'unit_label', metric_row.unit_label,
        'baseline_value', metric_row.baseline_value,
        'target_value', metric_row.target_value,
        'is_locked', metric_row.is_locked
      )
      order by metric_row.display_name
    ),
    '[]'::jsonb
  )
  into metrics
  from public.ci_project_metrics metric_row
  where metric_row.organisation_id = org_id
    and metric_row.project_id = target_project_id;

  select jsonb_build_object(
    'id', snapshot_row.id,
    'outcome_summary', snapshot_row.outcome_summary,
    'lessons_learned', snapshot_row.lessons_learned,
    'sustainment_summary', snapshot_row.sustainment_summary,
    'captured_by_membership_id', snapshot_row.captured_by_membership_id,
    'captured_at', snapshot_row.captured_at
  )
  into completion_snapshot
  from public.ci_project_completion_snapshots snapshot_row
  where snapshot_row.organisation_id = org_id
    and snapshot_row.project_id = target_project_id;

  return jsonb_build_object(
    'id', project_row.id,
    'project_number', project_row.project_number,
    'title', project_row.title,
    'status', project_row.status,
    'priority', project_row.priority,
    'unit_id', project_row.unit_id,
    'problem_statement', project_row.problem_statement,
    'objective', project_row.objective,
    'expected_impact_summary', project_row.expected_impact_summary,
    'scope_in', project_row.scope_in,
    'scope_out', project_row.scope_out,
    'baseline_summary', project_row.baseline_summary,
    'target_summary', project_row.target_summary,
    'constraints_risks', project_row.constraints_risks,
    'sustainment_expectation', project_row.sustainment_expectation,
    'methodology_version_id', project_row.methodology_version_id,
    'planned_start_date', project_row.planned_start_date,
    'planned_end_date', project_row.planned_end_date,
    'actual_start_at', project_row.actual_start_at,
    'actual_end_at', project_row.actual_end_at,
    'charter_submitted_at', project_row.charter_submitted_at,
    'charter_submitted_by_membership_id', project_row.charter_submitted_by_membership_id,
    'created_by_membership_id', project_row.created_by_membership_id,
    'created_at', project_row.created_at,
    'updated_at', project_row.updated_at,
    'team_members', team_members,
    'status_history', status_history,
    'phases', phases,
    'metrics', metrics,
    'completion_snapshot', completion_snapshot
  );
end;
$$;

grant execute on function public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer
) to authenticated;
grant execute on function public.get_ci_project_detail(uuid) to authenticated;

revoke all on function public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer
) from public, anon;
revoke all on function public.get_ci_project_detail(uuid) from public, anon;
