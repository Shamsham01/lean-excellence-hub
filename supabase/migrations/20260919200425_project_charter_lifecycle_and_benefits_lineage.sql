-- Issue #92: Project charter lifecycle integrity and Project → Benefit lineage.
-- Forward-only. No historic Project/Benefit rows are rewritten. No RLS/RBAC broadening.

-- ---------------------------------------------------------------------------
-- Charter submit: list the specific missing required fields
-- ---------------------------------------------------------------------------

create or replace function private.assert_ci_project_charter_complete(
  project_row public.ci_projects
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  missing text[] := array[]::text[];
begin
  if btrim(coalesce(project_row.title, '')) = '' then
    missing := array_append(missing, 'title');
  end if;

  if project_row.problem_statement is null
    or btrim(project_row.problem_statement) = '' then
    missing := array_append(missing, 'problem statement');
  end if;

  if project_row.objective is null
    or btrim(project_row.objective) = '' then
    missing := array_append(missing, 'objective');
  end if;

  if project_row.methodology_version_id is null then
    missing := array_append(missing, 'methodology');
  end if;

  if coalesce(array_length(missing, 1), 0) > 0 then
    raise exception 'project charter is incomplete: %', array_to_string(missing, ', ')
      using errcode = '22023';
  end if;
end;
$$;

alter function private.assert_ci_project_charter_complete(public.ci_projects)
  owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- Project detail: human-readable source links (permission-gated href)
-- ---------------------------------------------------------------------------

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
  source_links jsonb;
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

  select coalesce(
    jsonb_agg(summary.payload order by link_row.created_at, link_row.id),
    '[]'::jsonb
  )
  into source_links
  from public.ci_project_source_links link_row
  cross join lateral (
    select private.action_source_summary(org_id, link_row.source_resource_id) as payload
  ) summary
  where link_row.organisation_id = org_id
    and link_row.project_id = target_project_id
    and summary.payload is not null;

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
    'completion_snapshot', completion_snapshot,
    'source_links', source_links
  );
end;
$$;

-- Existing public wrapper keeps lean_hub_private_owner; CREATE OR REPLACE does
-- not change owner. Do not ALTER OWNER here — that role has no CREATE on public.

-- ---------------------------------------------------------------------------
-- Suggestion detail: human-readable linked projects
-- ---------------------------------------------------------------------------

create or replace function public.get_suggestion_detail(target_suggestion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  suggestion_row public.improvement_suggestions%rowtype;
  linked_actions jsonb;
  linked_projects jsonb;
begin
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion detail is not authorised'
      using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', action_row.id,
        'action_number', action_row.action_number,
        'title', action_row.title,
        'status', action_row.status,
        'href', '/platform/actions/' || action_row.id::text,
        'can_open', private.can_read_action(org_id, action_row.id)
      )
      order by action_row.created_at, action_row.id
    ),
    '[]'::jsonb
  )
  into linked_actions
  from public.suggestion_action_context context_row
  join public.actions action_row
    on action_row.organisation_id = context_row.organisation_id
   and action_row.id = context_row.action_id
  where context_row.organisation_id = org_id
    and context_row.suggestion_id = target_suggestion_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', project_row.id,
        'project_number', project_row.project_number,
        'title', project_row.title,
        'status', project_row.status,
        'href', '/platform/projects/' || project_row.id::text,
        'can_open', private.can_read_ci_project(org_id, project_row.id)
      )
      order by project_row.created_at, project_row.id
    ),
    '[]'::jsonb
  )
  into linked_projects
  from public.suggestion_implementation_links link_row
  join public.ci_projects project_row
    on project_row.organisation_id = link_row.organisation_id
   and project_row.id = link_row.implementation_resource_id
  where link_row.organisation_id = org_id
    and link_row.suggestion_id = target_suggestion_id
    and link_row.implementation_role = 'ci_project';

  return jsonb_build_object(
    'id', suggestion_row.id,
    'suggestion_number', suggestion_row.suggestion_number,
    'title', suggestion_row.title,
    'problem_or_opportunity', suggestion_row.problem_or_opportunity,
    'proposed_idea', suggestion_row.proposed_idea,
    'expected_benefit_summary', suggestion_row.expected_benefit_summary,
    'status', suggestion_row.status,
    'programme_name_snapshot', suggestion_row.programme_name_snapshot,
    'category_name_snapshot', suggestion_row.category_name_snapshot,
    'origin_unit_name_snapshot', suggestion_row.origin_unit_name_snapshot,
    'target_unit_name_snapshot', suggestion_row.target_unit_name_snapshot,
    'author_membership_id', suggestion_row.author_membership_id,
    'submitted_at', suggestion_row.submitted_at,
    'implementation_summary', suggestion_row.implementation_summary,
    'implementation_outcome', suggestion_row.implementation_outcome,
    'employee_outcome', suggestion_row.employee_outcome,
    'implemented_at', suggestion_row.implemented_at,
    'linked_actions', linked_actions,
    'linked_projects', linked_projects
  );
end;
$$;

-- Existing public wrapper keeps lean_hub_private_owner; CREATE OR REPLACE does
-- not change owner. Do not ALTER OWNER here — that role has no CREATE on public.

-- ---------------------------------------------------------------------------
-- Benefit source links: human-readable labels. href only when the caller
-- can already read the source (does not broaden project/suggestion RLS).
-- Existing snapshot rows are not rewritten.
-- ---------------------------------------------------------------------------

create or replace function private.build_benefit_source_links_summary(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source_resource_id', link_row.source_resource_id,
        'relationship_role', link_row.relationship_role,
        'resource_type', resource_row.resource_type,
        'display_label', case resource_row.resource_type
          when 'ci_project' then (
            select coalesce(project_row.project_number, project_row.title)
            from public.ci_projects project_row
            where project_row.organisation_id = target_organisation_id
              and project_row.id = link_row.source_resource_id
          )
          when 'improvement_suggestion' then (
            select coalesce(suggestion_row.suggestion_number, suggestion_row.title)
            from public.improvement_suggestions suggestion_row
            where suggestion_row.organisation_id = target_organisation_id
              and suggestion_row.id = link_row.source_resource_id
          )
          else null
        end,
        'title', case resource_row.resource_type
          when 'ci_project' then (
            select project_row.title
            from public.ci_projects project_row
            where project_row.organisation_id = target_organisation_id
              and project_row.id = link_row.source_resource_id
          )
          when 'improvement_suggestion' then (
            select suggestion_row.title
            from public.improvement_suggestions suggestion_row
            where suggestion_row.organisation_id = target_organisation_id
              and suggestion_row.id = link_row.source_resource_id
          )
          else null
        end,
        'href', case
          when resource_row.resource_type = 'ci_project'
            and private.can_read_ci_project(
              target_organisation_id,
              link_row.source_resource_id
            )
            then '/platform/projects/' || link_row.source_resource_id::text
          when resource_row.resource_type = 'improvement_suggestion'
            and private.can_read_improvement_suggestion(
              target_organisation_id,
              link_row.source_resource_id
            )
            then '/platform/suggestions/' || link_row.source_resource_id::text
          else null
        end,
        'context', case resource_row.resource_type
          when 'improvement_suggestion' then (
            select jsonb_build_object(
              'suggestion_number', suggestion_row.suggestion_number,
              'programme_name_snapshot', suggestion_row.programme_name_snapshot,
              'programme_code_snapshot', suggestion_row.programme_code_snapshot,
              'category_name_snapshot', suggestion_row.category_name_snapshot,
              'category_code_snapshot', suggestion_row.category_code_snapshot,
              'origin_unit_name_snapshot', suggestion_row.origin_unit_name_snapshot,
              'origin_unit_code_snapshot', suggestion_row.origin_unit_code_snapshot,
              'target_unit_name_snapshot', suggestion_row.target_unit_name_snapshot,
              'target_unit_code_snapshot', suggestion_row.target_unit_code_snapshot
            )
            from public.improvement_suggestions suggestion_row
            where suggestion_row.organisation_id = target_organisation_id
              and suggestion_row.id = link_row.source_resource_id
          )
          when 'ci_project' then (
            select jsonb_build_object(
              'project_number', project_row.project_number,
              'title', project_row.title
            )
            from public.ci_projects project_row
            where project_row.organisation_id = target_organisation_id
              and project_row.id = link_row.source_resource_id
          )
          else jsonb_build_object()
        end
      )
      order by
        case link_row.relationship_role when 'primary' then 0 else 1 end,
        link_row.created_at
    ),
    '[]'::jsonb
  )
  from public.benefit_source_links link_row
  join public.resource_records resource_row
    on resource_row.organisation_id = link_row.organisation_id
   and resource_row.id = link_row.source_resource_id
  where link_row.organisation_id = target_organisation_id
    and link_row.benefit_id = target_benefit_id
$$;

alter function private.build_benefit_source_links_summary(uuid, uuid)
  owner to lean_hub_private_owner;
revoke all on function private.build_benefit_source_links_summary(uuid, uuid)
  from public;
grant execute on function private.build_benefit_source_links_summary(uuid, uuid)
  to lean_hub_private_owner;
