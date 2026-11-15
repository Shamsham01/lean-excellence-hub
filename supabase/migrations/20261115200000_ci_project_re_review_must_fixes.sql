-- CI project re-review must-fixes: source link uniqueness, portfolio ordering, link RPC hardening,
-- gemba/5S action idempotency, self-assign, and PPS case link guards.

-- ── Source link uniqueness (lineage vs work_item) ────────────────────────────

alter table public.ci_project_source_links
  drop constraint if exists ci_project_source_links_project_source_key;

create unique index if not exists ci_project_source_links_source_lineage_unique_idx
  on public.ci_project_source_links (organisation_id, project_id, source_resource_id)
  where link_kind = 'source';

create or replace function private.link_ci_project_source(
  target_organisation_id uuid,
  target_project_id uuid,
  target_source_resource_id uuid,
  target_actor_membership_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_link_id uuid;
begin
  if not private.can_read_ci_project(target_organisation_id, target_project_id) then
    raise exception 'project source link is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_reference_source_resource(
    target_organisation_id,
    target_source_resource_id
  ) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  insert into public.ci_project_source_links (
    organisation_id,
    project_id,
    source_resource_id,
    created_by_membership_id,
    link_kind
  )
  values (
    target_organisation_id,
    target_project_id,
    target_source_resource_id,
    target_actor_membership_id,
    'source'
  )
  on conflict (organisation_id, project_id, source_resource_id)
  where link_kind = 'source'
  do nothing
  returning id into new_link_id;

  if new_link_id is null then
    select link_row.id
    into new_link_id
    from public.ci_project_source_links link_row
    where link_row.organisation_id = target_organisation_id
      and link_row.project_id = target_project_id
      and link_row.source_resource_id = target_source_resource_id
      and link_row.link_kind = 'source';
  end if;

  return new_link_id;
end;
$$;

-- ── Project detail: lineage source links only ───────────────────────────────

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
    and link_row.link_kind = 'source'
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

-- ── Portfolio: stable page item ordering ─────────────────────────────────────

create or replace function public.get_ci_projects_portfolio(
  target_search text default null,
  target_status text default null,
  target_unit_id uuid default null,
  target_priority text default null,
  target_page integer default 1,
  target_page_size integer default 25,
  target_site_unit_id uuid default null,
  target_linkable_only boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  page_size integer;
  offset_val integer;
  items jsonb;
  total_count integer;
begin
  if org_id is null then
    raise exception 'project portfolio is not authorised'
      using errcode = '42501';
  end if;

  page_size := least(greatest(coalesce(target_page_size, 25), 1), 100);
  offset_val := greatest((greatest(coalesce(target_page, 1), 1) - 1) * page_size, 0);

  with filtered as (
    select project_row.*
    from public.ci_projects project_row
    where project_row.organisation_id = org_id
      and private.can_read_ci_project(org_id, project_row.id)
      and (target_status is null or project_row.status = target_status)
      and (
        not coalesce(target_linkable_only, false)
        or project_row.status in (
          'draft', 'submitted', 'approved', 'active', 'on_hold'
        )
      )
      and (
        target_unit_id is null
        or exists (
          select 1
          from public.organisation_unit_closure closure
          where closure.organisation_id = org_id
            and closure.ancestor_unit_id = target_unit_id
            and closure.descendant_unit_id = project_row.unit_id
        )
      )
      and (
        target_site_unit_id is null
        or project_row.site_unit_id = target_site_unit_id
      )
      and (target_priority is null or project_row.priority = target_priority)
      and (
        target_search is null
        or btrim(target_search) = ''
        or project_row.title ilike '%' || btrim(target_search) || '%'
        or project_row.project_number ilike '%' || btrim(target_search) || '%'
        or project_row.status ilike '%' || btrim(target_search) || '%'
      )
  ),
  counted as (
    select count(*)::integer as total_count
    from filtered
  ),
  paged as (
    select filtered.*
    from filtered
    order by filtered.updated_at desc, filtered.id
    limit page_size
    offset offset_val
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', project_row.id,
            'project_number', project_row.project_number,
            'title', project_row.title,
            'status', project_row.status,
            'priority', project_row.priority,
            'unit_id', project_row.unit_id,
            'site_unit_id', project_row.site_unit_id,
            'methodology_version_id', project_row.methodology_version_id,
            'planned_start_date', project_row.planned_start_date,
            'planned_end_date', project_row.planned_end_date,
            'actual_start_at', project_row.actual_start_at,
            'actual_end_at', project_row.actual_end_at,
            'created_by_membership_id', project_row.created_by_membership_id,
            'created_at', project_row.created_at,
            'updated_at', project_row.updated_at
          )
          order by project_row.updated_at desc, project_row.id
        )
        from paged project_row
      ),
      '[]'::jsonb
    ),
    (select counted.total_count from counted)
  into items, total_count;

  return jsonb_build_object(
    'items', items,
    'total_count', total_count,
    'page', greatest(coalesce(target_page, 1), 1),
    'page_size', page_size
  );
end;
$$;

-- ── Action ↔ project links ───────────────────────────────────────────────────

create or replace function private.link_action_to_ci_project(
  target_action_id uuid,
  target_project_id uuid
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
  action_row public.actions%rowtype;
  existing_project_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'action project link is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id
  for share;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  if action_row.status in ('completed', 'verified', 'cancelled') then
    raise exception
      'This action is completed, verified, or cancelled and cannot change project links.'
      using errcode = '55000';
  end if;

  select context_row.project_id
  into existing_project_id
  from public.ci_project_action_context context_row
  where context_row.organisation_id = org_id
    and context_row.action_id = target_action_id
  for update;

  if existing_project_id is not null
    and action_row.source_resource_id = existing_project_id then
    raise exception
      'This action belongs to its project and cannot be moved to another project.'
      using errcode = '55000';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  if not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'action project link is not authorised'
      using errcode = '42501';
  end if;

  if existing_project_id is not null
    and existing_project_id <> target_project_id then
    if not private.can_read_ci_project(org_id, existing_project_id) then
      raise exception 'action project link is not authorised'
        using errcode = '42501';
    end if;

    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      existing_project_id
    );
  end if;

  insert into public.ci_project_action_context (
    organisation_id,
    action_id,
    project_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_action_id,
    target_project_id,
    actor_membership_id
  )
  on conflict (organisation_id, action_id)
  do update set
    project_id = excluded.project_id,
    project_phase_id = null;

  return true;
end;
$$;

create or replace function private.unlink_action_from_ci_project(
  target_action_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  linked_project_id uuid;
  action_row public.actions%rowtype;
begin
  if org_id is null
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'action project unlink is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id
  for share;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  if action_row.status in ('completed', 'verified', 'cancelled') then
    raise exception
      'This action is completed, verified, or cancelled and cannot change project links.'
      using errcode = '55000';
  end if;

  select context_row.project_id
  into linked_project_id
  from public.ci_project_action_context context_row
  where context_row.organisation_id = org_id
    and context_row.action_id = target_action_id
  for update;

  if linked_project_id is not null
    and action_row.source_resource_id = linked_project_id then
    raise exception
      'This action belongs to its project and cannot be unlinked.'
      using errcode = '55000';
  end if;

  if linked_project_id is not null
    and not private.can_edit_ci_project(org_id, linked_project_id) then
    raise exception 'action project unlink is not authorised'
      using errcode = '42501';
  end if;

  if linked_project_id is not null then
    if not private.can_read_ci_project(org_id, linked_project_id)
      or not private.ci_project_accepts_work_item_links(org_id, linked_project_id) then
      raise exception 'action project unlink is not authorised'
        using errcode = '42501';
    end if;

    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      linked_project_id
    );
  end if;

  delete from public.ci_project_action_context context_row
  where context_row.organisation_id = org_id
    and context_row.action_id = target_action_id;

  return true;
end;
$$;

-- ── Gemba observation ↔ project links ─────────────────────────────────────────

create or replace function private.set_gemba_observation_linked_project(
  target_observation_id uuid,
  target_project_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  walk_id uuid;
  walk_status text;
  current_linked_project_id uuid;
begin
  if org_id is null then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  if not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  select observation_row.walk_id, observation_row.linked_project_id
  into walk_id, current_linked_project_id
  from public.gemba_walk_observations observation_row
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id
  for update;

  if not found then
    raise exception 'gemba observation not found'
      using errcode = 'P0002';
  end if;

  select walk_row.status
  into walk_status
  from public.gemba_walks walk_row
  where walk_row.organisation_id = org_id
    and walk_row.id = walk_id
  for share;

  if walk_status not in ('draft', 'in_progress') then
    raise exception
      'This walk is completed or cancelled and cannot accept project links.'
      using errcode = '55000';
  end if;

  if not private.can_edit_gemba_walk(org_id, walk_id) then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  if current_linked_project_id is not null
    and current_linked_project_id <> target_project_id then
    if not private.can_read_ci_project(org_id, current_linked_project_id) then
      raise exception 'gemba observation project link is not authorised'
        using errcode = '42501';
    end if;

    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      current_linked_project_id
    );
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');
  perform private.assert_current_organisation_module_entitled('projects');

  update public.gemba_walk_observations observation_row
  set linked_project_id = target_project_id
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

  return true;
end;
$$;

create or replace function private.clear_gemba_observation_linked_project(
  target_observation_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  walk_id uuid;
  walk_status text;
  linked_project_id uuid;
begin
  if org_id is null then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  select observation_row.walk_id, observation_row.linked_project_id
  into walk_id, linked_project_id
  from public.gemba_walk_observations observation_row
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id
  for update;

  if not found then
    raise exception 'gemba observation not found'
      using errcode = 'P0002';
  end if;

  select walk_row.status
  into walk_status
  from public.gemba_walks walk_row
  where walk_row.organisation_id = org_id
    and walk_row.id = walk_id
  for share;

  if walk_status not in ('draft', 'in_progress') then
    raise exception
      'This walk is completed or cancelled and cannot change project links.'
      using errcode = '55000';
  end if;

  if not private.can_edit_gemba_walk(org_id, walk_id) then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  if linked_project_id is not null then
    if not private.can_read_ci_project(org_id, linked_project_id) then
      raise exception 'gemba observation project unlink is not authorised'
        using errcode = '42501';
    end if;

    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      linked_project_id
    );
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');

  update public.gemba_walk_observations observation_row
  set linked_project_id = null
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

  return true;
end;
$$;

-- ── Problem-solving case ↔ project links ─────────────────────────────────────

create or replace function private.link_problem_solving_case_to_ci_project(
  target_case_id uuid,
  target_project_id uuid
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
  case_status text;
  current_work_item_project_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  select case_row.status
  into case_status
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_status not in ('draft', 'active') then
    raise exception
      'This case is closed or cancelled and cannot accept project links.'
      using errcode = '55000';
  end if;

  if not (
    private.can_manage_problem_solving_case(org_id, target_case_id)
    or private.can_contribute_problem_solving_case(org_id, target_case_id)
  ) then
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  if not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.ci_project_source_links link_row
    where link_row.organisation_id = org_id
      and link_row.project_id = target_project_id
      and link_row.source_resource_id = target_case_id
      and link_row.link_kind = 'source'
  ) then
    raise exception 'This case already raised this project'
      using errcode = '22023';
  end if;

  select link_row.project_id
  into current_work_item_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  for update;

  if current_work_item_project_id is not null
    and current_work_item_project_id <> target_project_id then
    if not private.can_read_ci_project(org_id, current_work_item_project_id) then
      raise exception 'problem solving project link is not authorised'
        using errcode = '42501';
    end if;

    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      current_work_item_project_id
    );
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  delete from public.ci_project_source_links old_link
  where old_link.organisation_id = org_id
    and old_link.source_resource_id = target_case_id
    and old_link.link_kind = 'work_item';

  insert into public.ci_project_source_links (
    organisation_id,
    project_id,
    source_resource_id,
    created_by_membership_id,
    link_kind
  )
  values (
    org_id,
    target_project_id,
    target_case_id,
    actor_membership_id,
    'work_item'
  );

  return true;
end;
$$;

create or replace function private.unlink_problem_solving_case_from_ci_project(
  target_case_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  case_status text;
  linked_project_id uuid;
begin
  if org_id is null then
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  select case_row.status
  into case_status
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_status not in ('draft', 'active') then
    raise exception
      'This case is closed or cancelled and cannot change project links.'
      using errcode = '55000';
  end if;

  if not (
    private.can_manage_problem_solving_case(org_id, target_case_id)
    or private.can_contribute_problem_solving_case(org_id, target_case_id)
  ) then
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  select link_row.project_id
  into linked_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  for update;

  if linked_project_id is null then
    return true;
  end if;

  if not private.can_read_ci_project(org_id, linked_project_id) then
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_work_item_link_mutable(
    org_id,
    linked_project_id
  );

  delete from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item';

  return true;
end;
$$;

-- ── Self-assign on actions ────────────────────────────────────────────────────

create or replace function private.set_action_assignee(
  target_action_id uuid,
  target_membership_id uuid default null
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
  action_row public.actions%rowtype;
  assignee_exists boolean;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'action assignment is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id
  for update;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  if target_membership_id is distinct from actor_membership_id
    and not private.can_assign_action(org_id, target_action_id) then
    raise exception 'action assignment is not authorised'
      using errcode = '42501';
  end if;

  if action_row.status in ('completed', 'verified', 'cancelled') then
    raise exception 'completed actions cannot be reassigned'
      using errcode = '55000';
  end if;

  if target_membership_id is not null then
    select exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = org_id
        and membership_row.id = target_membership_id
        and membership_row.status = 'active'
    )
    into assignee_exists;

    if not assignee_exists then
      raise exception 'assignee is not an active organisation member'
        using errcode = '22023';
    end if;
  end if;

  delete from public.action_assignees assignee_row
  where assignee_row.organisation_id = org_id
    and assignee_row.action_id = target_action_id
    and (
      target_membership_id is null
      or assignee_row.membership_id is distinct from target_membership_id
    );

  if target_membership_id is not null then
    insert into public.action_assignees (
      organisation_id,
      action_id,
      membership_id,
      assigned_by_membership_id
    )
    values (
      org_id,
      target_action_id,
      target_membership_id,
      actor_membership_id
    )
    on conflict (organisation_id, action_id, membership_id) do nothing;
  end if;

  update public.actions action_table
  set version = action_row.version + 1,
      updated_at = statement_timestamp()
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id;

  perform private.append_business_audit(
    org_id,
    'action.assigned',
    target_action_id,
    'succeeded',
    jsonb_build_object(
      'membership_id', target_membership_id,
      'version', action_row.version + 1
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_action_id,
    'ActionAssigned',
    format('action-assigned:%s:%s', target_action_id, action_row.version + 1),
    jsonb_build_object(
      'action_id', target_action_id,
      'membership_id', target_membership_id
    )
  );

  return true;
end;
$$;

-- ── Gemba action: idempotent replay hardening ────────────────────────────────

create or replace function private.create_gemba_action(
  target_title text,
  target_walk_id uuid,
  target_assignee_membership_id uuid,
  target_due_at timestamptz,
  target_idempotency_key text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null,
  target_description text default null,
  target_priority text default 'normal'
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
  unit_id uuid;
  walk_template_version_id uuid;
  observation_row public.gemba_walk_observations%rowtype;
  new_action_id uuid;
  resolved_assignee uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');
  perform private.assert_current_organisation_module_entitled('actions');

  if target_due_at is null then
    raise exception 'gemba actions require a due date'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null
    or btrim(target_idempotency_key) = '' then
    raise exception 'gemba actions require an idempotency key'
      using errcode = '22023';
  end if;

  resolved_assignee := coalesce(
    target_assignee_membership_id,
    actor_membership_id
  );

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.id = resolved_assignee
  ) then
    raise exception 'assignee is not authorised'
      using errcode = '42501';
  end if;

  select walk_row.unit_id, definition_version.template_version_id
  into unit_id, walk_template_version_id
  from public.gemba_walks walk_row
  join public.gemba_definition_versions definition_version
    on definition_version.organisation_id = walk_row.organisation_id
   and definition_version.id = walk_row.definition_version_id
  where walk_row.organisation_id = org_id
    and walk_row.id = target_walk_id;

  if not found then
    raise exception 'gemba walk not found'
      using errcode = 'P0002';
  end if;

  if target_observation_id is not null then
    select observation_item.*
    into observation_row
    from public.gemba_walk_observations observation_item
    where observation_item.organisation_id = org_id
      and observation_item.id = target_observation_id
      and observation_item.walk_id = target_walk_id;

    if not found then
      raise exception 'gemba observation was not found on this walk'
        using errcode = 'P0002';
    end if;

    if target_section_id is not null
      and observation_row.section_id is distinct from target_section_id then
      raise exception 'observation section does not match walk context'
        using errcode = '22023';
    end if;

    if target_question_id is not null
      and observation_row.question_id is distinct from target_question_id then
      raise exception 'observation question does not match walk context'
        using errcode = '22023';
    end if;

    target_section_id := coalesce(target_section_id, observation_row.section_id);
    target_question_id := coalesce(
      target_question_id,
      observation_row.question_id
    );
  end if;

  if target_section_id is not null
    and not exists (
      select 1
      from public.template_sections section_row
      where section_row.organisation_id = org_id
        and section_row.id = target_section_id
        and section_row.template_version_id = walk_template_version_id
    ) then
    raise exception 'section does not belong to this walk'
      using errcode = '22023';
  end if;

  if target_question_id is not null
    and not exists (
      select 1
      from public.template_questions question_row
      where question_row.organisation_id = org_id
        and question_row.id = target_question_id
        and question_row.template_version_id = walk_template_version_id
        and (
          target_section_id is null
          or question_row.section_id = target_section_id
        )
    ) then
    raise exception 'question does not belong to this walk'
      using errcode = '22023';
  end if;

  select action_row.id
  into new_action_id
  from public.actions action_row
  where action_row.organisation_id = org_id
    and action_row.idempotency_key = target_idempotency_key;

  if new_action_id is not null
    and exists (
      select 1
      from public.gemba_action_context context_row
      where context_row.organisation_id = org_id
        and context_row.action_id = new_action_id
    ) then
    if exists (
      select 1
      from public.actions action_row
      where action_row.organisation_id = org_id
        and action_row.id = new_action_id
        and action_row.source_resource_id is distinct from target_walk_id
    ) then
      raise exception
        'gemba action idempotency key is already used for a different walk'
        using errcode = '22023';
    end if;

    return new_action_id;
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_walk_id,
    target_due_at,
    target_idempotency_key
  );

  if exists (
    select 1
    from public.actions action_row
    where action_row.organisation_id = org_id
      and action_row.id = new_action_id
      and action_row.source_resource_id is distinct from target_walk_id
  ) then
    raise exception
      'gemba action idempotency key is already used for a different walk'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.gemba_action_context context_row
    where context_row.organisation_id = org_id
      and context_row.action_id = new_action_id
  ) then
    return new_action_id;
  end if;

  perform private.set_action_assignee(new_action_id, resolved_assignee);

  insert into public.gemba_action_context (
    organisation_id,
    action_id,
    walk_id,
    section_id,
    question_id,
    observation_id,
    created_by_membership_id
  )
  values (
    org_id,
    new_action_id,
    target_walk_id,
    target_section_id,
    target_question_id,
    target_observation_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

-- ── 5S action: gemba-aligned signature and idempotency ─────────────────────

drop function if exists public.create_five_s_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
);

drop function if exists private.create_five_s_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
);

create or replace function private.create_five_s_action(
  target_title text,
  target_audit_id uuid,
  target_assignee_membership_id uuid,
  target_due_at timestamptz,
  target_idempotency_key text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_finding_id uuid default null,
  target_description text default null,
  target_priority text default 'normal'
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
  unit_id uuid;
  audit_template_version_id uuid;
  finding_row public.five_s_audit_findings%rowtype;
  new_action_id uuid;
  resolved_assignee uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('five_s');
  perform private.assert_current_organisation_module_entitled('actions');

  if target_due_at is null then
    raise exception '5S actions require a due date'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null
    or btrim(target_idempotency_key) = '' then
    raise exception '5S actions require an idempotency key'
      using errcode = '22023';
  end if;

  resolved_assignee := coalesce(
    target_assignee_membership_id,
    actor_membership_id
  );

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.id = resolved_assignee
  ) then
    raise exception 'assignee is not authorised'
      using errcode = '42501';
  end if;

  select audit_row.unit_id, standard_version.template_version_id
  into unit_id, audit_template_version_id
  from public.five_s_audits audit_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = audit_row.organisation_id
   and standard_version.id = audit_row.standard_version_id
  where audit_row.organisation_id = org_id
    and audit_row.id = target_audit_id;

  if not found then
    raise exception '5S audit not found'
      using errcode = 'P0002';
  end if;

  if target_finding_id is not null then
    select finding_item.*
    into finding_row
    from public.five_s_audit_findings finding_item
    where finding_item.organisation_id = org_id
      and finding_item.id = target_finding_id
      and finding_item.audit_id = target_audit_id;

    if not found then
      raise exception '5S finding was not found on this audit'
        using errcode = 'P0002';
    end if;

    if target_section_id is not null
      and finding_row.section_id is distinct from target_section_id then
      raise exception 'finding section does not match audit context'
        using errcode = '22023';
    end if;

    if target_question_id is not null
      and finding_row.question_id is distinct from target_question_id then
      raise exception 'finding question does not match audit context'
        using errcode = '22023';
    end if;

    target_section_id := coalesce(target_section_id, finding_row.section_id);
    target_question_id := coalesce(
      target_question_id,
      finding_row.question_id
    );
  end if;

  if target_section_id is not null
    and not exists (
      select 1
      from public.template_sections section_row
      where section_row.organisation_id = org_id
        and section_row.id = target_section_id
        and section_row.template_version_id = audit_template_version_id
    ) then
    raise exception 'section does not belong to this audit'
      using errcode = '22023';
  end if;

  if target_question_id is not null
    and not exists (
      select 1
      from public.template_questions question_row
      where question_row.organisation_id = org_id
        and question_row.id = target_question_id
        and question_row.template_version_id = audit_template_version_id
        and (
          target_section_id is null
          or question_row.section_id = target_section_id
        )
    ) then
    raise exception 'question does not belong to this audit'
      using errcode = '22023';
  end if;

  select action_row.id
  into new_action_id
  from public.actions action_row
  where action_row.organisation_id = org_id
    and action_row.idempotency_key = target_idempotency_key;

  if new_action_id is not null
    and exists (
      select 1
      from public.five_s_action_context context_row
      where context_row.organisation_id = org_id
        and context_row.action_id = new_action_id
    ) then
    if exists (
      select 1
      from public.actions action_row
      where action_row.organisation_id = org_id
        and action_row.id = new_action_id
        and action_row.source_resource_id is distinct from target_audit_id
    ) then
      raise exception
        '5S action idempotency key is already used for a different audit'
        using errcode = '22023';
    end if;

    return new_action_id;
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_audit_id,
    target_due_at,
    target_idempotency_key
  );

  if exists (
    select 1
    from public.actions action_row
    where action_row.organisation_id = org_id
      and action_row.id = new_action_id
      and action_row.source_resource_id is distinct from target_audit_id
  ) then
    raise exception
      '5S action idempotency key is already used for a different audit'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.five_s_action_context context_row
    where context_row.organisation_id = org_id
      and context_row.action_id = new_action_id
  ) then
    return new_action_id;
  end if;

  perform private.set_action_assignee(new_action_id, resolved_assignee);

  insert into public.five_s_action_context (
    organisation_id,
    action_id,
    audit_id,
    section_id,
    question_id,
    finding_id,
    created_by_membership_id
  )
  values (
    org_id,
    new_action_id,
    target_audit_id,
    target_section_id,
    target_question_id,
    target_finding_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

alter function private.create_five_s_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) owner to lean_hub_private_owner;

revoke all on function private.create_five_s_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function private.create_five_s_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) to lean_hub_private_owner;

create or replace function public.create_five_s_action(
  target_title text,
  target_audit_id uuid,
  target_assignee_membership_id uuid,
  target_due_at timestamptz,
  target_idempotency_key text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_finding_id uuid default null,
  target_description text default null,
  target_priority text default 'normal'
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_five_s_action(
    target_title,
    target_audit_id,
    target_assignee_membership_id,
    target_due_at,
    target_idempotency_key,
    target_section_id,
    target_question_id,
    target_finding_id,
    target_description,
    target_priority
  )
$$;

grant execute on function public.create_five_s_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) to authenticated;

revoke all on function public.create_five_s_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) from public, anon;

grant select on public.actions to lean_hub_private_owner;

alter function private.link_action_to_ci_project(uuid, uuid)
  owner to postgres;
alter function private.unlink_action_from_ci_project(uuid)
  owner to postgres;
grant execute on function private.link_action_to_ci_project(uuid, uuid)
  to lean_hub_private_owner;
grant execute on function private.unlink_action_from_ci_project(uuid)
  to lean_hub_private_owner;
alter function private.set_gemba_observation_linked_project(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.clear_gemba_observation_linked_project(uuid)
  owner to lean_hub_private_owner;
alter function private.link_problem_solving_case_to_ci_project(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.unlink_problem_solving_case_from_ci_project(uuid)
  owner to lean_hub_private_owner;