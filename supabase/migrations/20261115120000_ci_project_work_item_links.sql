-- CI project work-item links: consolidated final definitions (PR #405).

alter table public.five_s_audit_findings
  add column if not exists linked_project_id uuid;

alter table public.gemba_walk_observations
  add column if not exists linked_project_id uuid;

alter table public.five_s_audit_findings
  drop constraint if exists five_s_audit_findings_linked_project_fkey;

alter table public.five_s_audit_findings
  add constraint five_s_audit_findings_linked_project_fkey
  foreign key (organisation_id, linked_project_id)
  references public.ci_projects(organisation_id, id)
  on delete restrict;

alter table public.gemba_walk_observations
  drop constraint if exists gemba_walk_observations_linked_project_fkey;

alter table public.gemba_walk_observations
  add constraint gemba_walk_observations_linked_project_fkey
  foreign key (organisation_id, linked_project_id)
  references public.ci_projects(organisation_id, id)
  on delete restrict;

create index if not exists five_s_audit_findings_linked_project_idx
  on public.five_s_audit_findings (organisation_id, linked_project_id)
  where linked_project_id is not null;

create index if not exists gemba_walk_observations_linked_project_idx
  on public.gemba_walk_observations (organisation_id, linked_project_id)
  where linked_project_id is not null;

alter table public.ci_project_source_links
  add column if not exists link_kind text not null default 'source';

alter table public.ci_project_source_links
  drop constraint if exists ci_project_source_links_link_kind_check;

alter table public.ci_project_source_links
  add constraint ci_project_source_links_link_kind_check
  check (link_kind in ('source', 'work_item'));

create unique index if not exists ci_project_source_links_one_work_item_per_source_idx
  on public.ci_project_source_links (organisation_id, source_resource_id)
  where link_kind = 'work_item';

create or replace function private.ci_project_accepts_work_item_links(
  target_organisation_id uuid,
  target_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ci_projects project_row
    where project_row.organisation_id = target_organisation_id
      and project_row.id = target_project_id
      and project_row.status in (
        'draft',
        'submitted',
        'approved',
        'active',
        'on_hold'
      )
  );
$$;

create or replace function private.ci_project_link_summary(
  target_organisation_id uuid,
  target_project_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_project_id is null then null
    when project_row.id is null then null
    when not private.can_read_ci_project(target_organisation_id, project_row.id) then
      jsonb_build_object(
        'linked', true,
        'restricted', true,
        'can_open', false
      )
    else jsonb_build_object(
      'id', project_row.id,
      'project_number', project_row.project_number,
      'title', project_row.title,
      'status', project_row.status,
      'href', '/platform/projects/' || project_row.id::text,
      'can_open', true
    )
  end
  from public.ci_projects project_row
  where project_row.organisation_id = target_organisation_id
    and project_row.id = target_project_id
  limit 1;
$$;

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

drop function if exists public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer, uuid
);

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
  search_pattern text;
begin
  if org_id is null then
    raise exception 'project portfolio is not authorised'
      using errcode = '42501';
  end if;

  page_size := least(greatest(coalesce(target_page_size, 25), 1), 100);
  offset_val := greatest((greatest(coalesce(target_page, 1), 1) - 1) * page_size, 0);

  if target_search is not null and btrim(target_search) <> '' then
    search_pattern := '%' || private.escape_ilike_literal(btrim(target_search)) || '%';
  end if;

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
        search_pattern is null
        or project_row.title ilike search_pattern escape '\'
        or project_row.project_number ilike search_pattern escape '\'
        or project_row.status ilike search_pattern escape '\'
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

grant execute on function public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer, uuid, boolean
) to authenticated;

revoke all on function public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer, uuid, boolean
) from public, anon;

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

  if linked_project_id is not null then
    if not private.can_read_ci_project(org_id, linked_project_id) then
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

-- ── Planner action creator self-assign (create RPCs only) ─────────────────────

create or replace function private.assign_planner_action_to_creator(
  target_action_id uuid,
  target_assignee_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  action_row public.actions%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'action assignment is not authorised'
      using errcode = '42501';
  end if;

  if target_assignee_membership_id is distinct from actor_membership_id then
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

  if action_row.created_by_membership_id is distinct from actor_membership_id then
    raise exception 'action assignment is not authorised'
      using errcode = '42501';
  end if;

  if action_row.status in ('completed', 'verified', 'cancelled') then
    raise exception 'completed actions cannot be reassigned'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.action_assignees assignee_row
    where assignee_row.organisation_id = org_id
      and assignee_row.action_id = target_action_id
  ) then
    raise exception 'action already has an assignee'
      using errcode = '55000';
  end if;

  delete from public.action_assignees assignee_row
  where assignee_row.organisation_id = org_id
    and assignee_row.action_id = target_action_id
    and assignee_row.membership_id is distinct from target_assignee_membership_id;

  insert into public.action_assignees (
    organisation_id,
    action_id,
    membership_id,
    assigned_by_membership_id
  )
  values (
    org_id,
    target_action_id,
    target_assignee_membership_id,
    actor_membership_id
  )
  on conflict (organisation_id, action_id, membership_id) do nothing;

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
      'membership_id', target_assignee_membership_id,
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
      'membership_id', target_assignee_membership_id
    )
  );
end;
$$;

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
  assignee_ok boolean;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'action assignment is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_action(org_id, target_action_id) then
    raise exception 'action assignment is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_assign_action(org_id, target_action_id) then
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
        and (
          action_row.unit_id is null
          or private.membership_is_effective_owner(target_membership_id, org_id)
          or private.membership_can_access_unit_site(
            org_id,
            target_membership_id,
            action_row.unit_id
          )
        )
    )
    into assignee_ok;

    if not assignee_ok then
      raise exception 'action assignment is not authorised'
        using errcode = '42501';
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

alter function private.assign_planner_action_to_creator(uuid, uuid)
  owner to postgres;

revoke all on function private.assign_planner_action_to_creator(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.assign_planner_action_to_creator(uuid, uuid)
  to lean_hub_private_owner;


create or replace function private.namespaced_planner_action_idempotency_key(
  target_namespace text,
  target_membership_id uuid,
  target_client_key text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select target_namespace
    || ':'
    || target_membership_id::text
    || ':'
    || btrim(target_client_key);
$$;

create or replace function private.assert_gemba_planner_action_idempotency_replay(
  target_organisation_id uuid,
  target_actor_membership_id uuid,
  target_action_id uuid,
  target_walk_id uuid,
  target_section_id uuid,
  target_question_id uuid,
  target_observation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  action_row public.actions%rowtype;
  context_row public.gemba_action_context%rowtype;
begin
  select action_item.*
  into action_row
  from public.actions action_item
  where action_item.organisation_id = target_organisation_id
    and action_item.id = target_action_id;

  if not found then
    raise exception 'gemba action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;

  if action_row.created_by_membership_id is distinct from target_actor_membership_id
    or action_row.source_resource_id is distinct from target_walk_id then
    raise exception 'gemba action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;

  select context_item.*
  into context_row
  from public.gemba_action_context context_item
  where context_item.organisation_id = target_organisation_id
    and context_item.action_id = target_action_id;

  if not found then
    return;
  end if;

  if context_row.walk_id is distinct from target_walk_id
    or context_row.section_id is distinct from target_section_id
    or context_row.question_id is distinct from target_question_id
    or context_row.observation_id is distinct from target_observation_id then
    raise exception 'gemba action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;
end;
$$;

create or replace function private.assert_five_s_planner_action_idempotency_replay(
  target_organisation_id uuid,
  target_actor_membership_id uuid,
  target_action_id uuid,
  target_audit_id uuid,
  target_section_id uuid,
  target_question_id uuid,
  target_finding_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  action_row public.actions%rowtype;
  context_row public.five_s_action_context%rowtype;
begin
  select action_item.*
  into action_row
  from public.actions action_item
  where action_item.organisation_id = target_organisation_id
    and action_item.id = target_action_id;

  if not found then
    raise exception '5S action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;

  if action_row.created_by_membership_id is distinct from target_actor_membership_id
    or action_row.source_resource_id is distinct from target_audit_id then
    raise exception '5S action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;

  select context_item.*
  into context_row
  from public.five_s_action_context context_item
  where context_item.organisation_id = target_organisation_id
    and context_item.action_id = target_action_id;

  if not found then
    return;
  end if;

  if context_row.audit_id is distinct from target_audit_id
    or context_row.section_id is distinct from target_section_id
    or context_row.question_id is distinct from target_question_id
    or context_row.finding_id is distinct from target_finding_id then
    raise exception '5S action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;
end;
$$;

alter function private.namespaced_planner_action_idempotency_key(text, uuid, text)
  owner to lean_hub_private_owner;
alter function private.assert_gemba_planner_action_idempotency_replay(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid
) owner to lean_hub_private_owner;
alter function private.assert_five_s_planner_action_idempotency_replay(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid
) owner to lean_hub_private_owner;

revoke all on function private.namespaced_planner_action_idempotency_key(text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_gemba_planner_action_idempotency_replay(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.assert_five_s_planner_action_idempotency_replay(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

grant execute on function private.namespaced_planner_action_idempotency_key(text, uuid, text)
  to lean_hub_private_owner;
grant execute on function private.assert_gemba_planner_action_idempotency_replay(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to lean_hub_private_owner;
grant execute on function private.assert_five_s_planner_action_idempotency_replay(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to lean_hub_private_owner;

-- ── Project link asserts: fold missing projects into 42501 ──────────────────

create or replace function private.assert_ci_project_accepts_work_item_links(
  target_organisation_id uuid,
  target_project_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  project_status text;
begin
  if not private.can_read_ci_project(target_organisation_id, target_project_id) then
    raise exception 'project link is not authorised'
      using errcode = '42501';
  end if;

  select project_row.status
  into project_status
  from public.ci_projects project_row
  where project_row.organisation_id = target_organisation_id
    and project_row.id = target_project_id
  for share;

  if not found then
    raise exception 'project link is not authorised'
      using errcode = '42501';
  end if;

  if not private.ci_project_accepts_work_item_links(
    target_organisation_id,
    target_project_id
  ) then
    raise exception
      'This project is completed or cancelled and cannot accept new links.'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function private.assert_ci_project_work_item_link_mutable(
  target_organisation_id uuid,
  target_project_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  project_status text;
begin
  if target_project_id is null then
    return;
  end if;

  select project_row.status
  into project_status
  from public.ci_projects project_row
  where project_row.organisation_id = target_organisation_id
    and project_row.id = target_project_id
  for share;

  if not found then
    raise exception 'project link is not authorised'
      using errcode = '42501';
  end if;

  if not private.ci_project_accepts_work_item_links(
    target_organisation_id,
    target_project_id
  ) then
    raise exception
      'This project link is read-only because the project is completed or cancelled.'
      using errcode = '55000';
  end if;
end;
$$;

-- ── Gemba observation ↔ project (existence oracle ordering) ───────────────────

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

  if not exists (
    select 1
    from public.gemba_walk_observations observation_row
    join public.gemba_walks walk_row
      on walk_row.organisation_id = observation_row.organisation_id
     and walk_row.id = observation_row.walk_id
    where observation_row.organisation_id = org_id
      and observation_row.id = target_observation_id
      and private.can_read_gemba_walk(org_id, walk_row.id)
  ) then
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
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
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

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  if not private.can_edit_ci_project(org_id, target_project_id) then
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

  if not exists (
    select 1
    from public.gemba_walk_observations observation_row
    join public.gemba_walks walk_row
      on walk_row.organisation_id = observation_row.organisation_id
     and walk_row.id = observation_row.walk_id
    where observation_row.organisation_id = org_id
      and observation_row.id = target_observation_id
      and private.can_read_gemba_walk(org_id, walk_row.id)
  ) then
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
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
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

-- ── Problem-solving case ↔ project (existence oracle ordering) ───────────────

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

  if not (
    private.can_manage_problem_solving_case(org_id, target_case_id)
    or private.can_contribute_problem_solving_case(org_id, target_case_id)
  ) then
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
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  if case_status not in ('draft', 'active') then
    raise exception
      'This case is closed or cancelled and cannot accept project links.'
      using errcode = '55000';
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

  if not (
    private.can_manage_problem_solving_case(org_id, target_case_id)
    or private.can_contribute_problem_solving_case(org_id, target_case_id)
  ) then
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
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  if case_status not in ('draft', 'active') then
    raise exception
      'This case is closed or cancelled and cannot change project links.'
      using errcode = '55000';
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
-- ── Planner actions: namespaced idempotency + FOR SHARE walk/audit ────────────

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
  namespaced_idempotency_key text;
  unit_id uuid;
  walk_template_version_id uuid;
  observation_row public.gemba_walk_observations%rowtype;
  new_action_id uuid;
  resolved_assignee uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_due_at is null then
    raise exception 'gemba actions require a due date'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null
    or btrim(target_idempotency_key) = '' then
    raise exception 'gemba actions require an idempotency key'
      using errcode = '22023';
  end if;

  namespaced_idempotency_key := private.namespaced_planner_action_idempotency_key(
    'gemba',
    actor_membership_id,
    target_idempotency_key
  );

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
    and walk_row.id = target_walk_id
  for share;

  if not found then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');
  perform private.assert_current_organisation_module_entitled('actions');

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
    and action_row.idempotency_key = namespaced_idempotency_key;

  if new_action_id is not null then
    perform private.assert_gemba_planner_action_idempotency_replay(
      org_id,
      actor_membership_id,
      new_action_id,
      target_walk_id,
      target_section_id,
      target_question_id,
      target_observation_id
    );

    if exists (
      select 1
      from public.gemba_action_context context_row
      where context_row.organisation_id = org_id
        and context_row.action_id = new_action_id
    ) then
      return new_action_id;
    end if;
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_walk_id,
    target_due_at,
    namespaced_idempotency_key
  );

  perform private.assert_gemba_planner_action_idempotency_replay(
    org_id,
    actor_membership_id,
    new_action_id,
    target_walk_id,
    target_section_id,
    target_question_id,
    target_observation_id
  );

  if exists (
    select 1
    from public.gemba_action_context context_row
    where context_row.organisation_id = org_id
      and context_row.action_id = new_action_id
  ) then
    return new_action_id;
  end if;

  if resolved_assignee = actor_membership_id then
    perform private.assign_planner_action_to_creator(
      new_action_id,
      resolved_assignee
    );
  else
    perform private.set_action_assignee(new_action_id, resolved_assignee);
  end if;

  begin
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
  exception
    when unique_violation then
      select action_row.id
      into new_action_id
      from public.actions action_row
      where action_row.organisation_id = org_id
        and action_row.idempotency_key = namespaced_idempotency_key;

      perform private.assert_gemba_planner_action_idempotency_replay(
        org_id,
        actor_membership_id,
        new_action_id,
        target_walk_id,
        target_section_id,
        target_question_id,
        target_observation_id
      );
  end;

  return new_action_id;
end;
$$;

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
  namespaced_idempotency_key text;
  unit_id uuid;
  audit_template_version_id uuid;
  finding_row public.five_s_audit_findings%rowtype;
  new_action_id uuid;
  resolved_assignee uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception '5S action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_due_at is null then
    raise exception '5S actions require a due date'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null
    or btrim(target_idempotency_key) = '' then
    raise exception '5S actions require an idempotency key'
      using errcode = '22023';
  end if;

  namespaced_idempotency_key := private.namespaced_planner_action_idempotency_key(
    'five_s',
    actor_membership_id,
    target_idempotency_key
  );

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
    and audit_row.id = target_audit_id
  for share;

  if not found then
    raise exception '5S action creation is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('five_s');
  perform private.assert_current_organisation_module_entitled('actions');

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
    and action_row.idempotency_key = namespaced_idempotency_key;

  if new_action_id is not null then
    perform private.assert_five_s_planner_action_idempotency_replay(
      org_id,
      actor_membership_id,
      new_action_id,
      target_audit_id,
      target_section_id,
      target_question_id,
      target_finding_id
    );

    if exists (
      select 1
      from public.five_s_action_context context_row
      where context_row.organisation_id = org_id
        and context_row.action_id = new_action_id
    ) then
      return new_action_id;
    end if;
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_audit_id,
    target_due_at,
    namespaced_idempotency_key
  );

  perform private.assert_five_s_planner_action_idempotency_replay(
    org_id,
    actor_membership_id,
    new_action_id,
    target_audit_id,
    target_section_id,
    target_question_id,
    target_finding_id
  );

  if exists (
    select 1
    from public.five_s_action_context context_row
    where context_row.organisation_id = org_id
      and context_row.action_id = new_action_id
  ) then
    return new_action_id;
  end if;

  if resolved_assignee = actor_membership_id then
    perform private.assign_planner_action_to_creator(
      new_action_id,
      resolved_assignee
    );
  else
    perform private.set_action_assignee(new_action_id, resolved_assignee);
  end if;

  begin
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
  exception
    when unique_violation then
      select action_row.id
      into new_action_id
      from public.actions action_row
      where action_row.organisation_id = org_id
        and action_row.idempotency_key = namespaced_idempotency_key;

      perform private.assert_five_s_planner_action_idempotency_replay(
        org_id,
        actor_membership_id,
        new_action_id,
        target_audit_id,
        target_section_id,
        target_question_id,
        target_finding_id
      );
  end;

  return new_action_id;
end;
$$;

drop function if exists public.create_gemba_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
);

drop function if exists private.create_gemba_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
);

drop function if exists public.create_five_s_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
);

drop function if exists private.create_five_s_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
);

alter function private.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) owner to lean_hub_private_owner;

revoke all on function private.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function private.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) to lean_hub_private_owner;

alter function private.create_five_s_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) owner to lean_hub_private_owner;

revoke all on function private.create_five_s_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function private.create_five_s_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) to lean_hub_private_owner;

create or replace function public.create_gemba_action(
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
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_gemba_action(
    target_title,
    target_walk_id,
    target_assignee_membership_id,
    target_due_at,
    target_idempotency_key,
    target_section_id,
    target_question_id,
    target_observation_id,
    target_description,
    target_priority
  )
$$;

grant execute on function public.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) to authenticated;

revoke all on function public.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) from public, anon;

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

grant select, update (updated_at) on public.actions to lean_hub_private_owner;
grant select, insert, update, delete on public.ci_project_action_context
  to lean_hub_private_owner;

create or replace function private.set_five_s_audit_finding_linked_project(
  target_finding_id uuid,
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
  audit_id uuid;
  current_linked_project_id uuid;
begin
  if org_id is null then
    raise exception '5S finding project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  select finding_row.audit_id, finding_row.linked_project_id
  into audit_id, current_linked_project_id
  from public.five_s_audit_findings finding_row
  where finding_row.organisation_id = org_id
    and finding_row.id = target_finding_id
  for update;

  if not found then
    raise exception '5S finding not found'
      using errcode = 'P0002';
  end if;

  if not private.can_edit_five_s_audit(org_id, audit_id) then
    raise exception '5S finding project link is not authorised'
      using errcode = '42501';
  end if;

  if current_linked_project_id is not null
    and current_linked_project_id <> target_project_id then
    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      current_linked_project_id
    );
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  update public.five_s_audit_findings finding_row
  set linked_project_id = target_project_id
  where finding_row.organisation_id = org_id
    and finding_row.id = target_finding_id;

  return true;
end;
$$;

create or replace function private.clear_five_s_audit_finding_linked_project(
  target_finding_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  audit_id uuid;
  linked_project_id uuid;
begin
  if org_id is null then
    raise exception '5S finding project unlink is not authorised'
      using errcode = '42501';
  end if;

  select finding_row.audit_id, finding_row.linked_project_id
  into audit_id, linked_project_id
  from public.five_s_audit_findings finding_row
  where finding_row.organisation_id = org_id
    and finding_row.id = target_finding_id
  for update;

  if not found then
    raise exception '5S finding not found'
      using errcode = 'P0002';
  end if;

  if not private.can_edit_five_s_audit(org_id, audit_id) then
    raise exception '5S finding project unlink is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_work_item_link_mutable(
    org_id,
    linked_project_id
  );

  update public.five_s_audit_findings finding_row
  set linked_project_id = null
  where finding_row.organisation_id = org_id
    and finding_row.id = target_finding_id;

  return true;
end;
$$;

create or replace function private.can_update_problem_solving_case_link(
  target_organisation_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.problem_solving_cases case_row
    where case_row.organisation_id = target_organisation_id
      and case_row.id = target_case_id
      and case_row.status in ('draft', 'active')
      and (
        private.can_manage_problem_solving_case(target_organisation_id, target_case_id)
        or private.can_contribute_problem_solving_case(target_organisation_id, target_case_id)
      )
  );
$$;

create or replace function public.link_action_to_ci_project(
  target_action_id uuid,
  target_project_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.link_action_to_ci_project(target_action_id, target_project_id);
$$;

create or replace function public.unlink_action_from_ci_project(
  target_action_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.unlink_action_from_ci_project(target_action_id);
$$;

create or replace function public.set_five_s_audit_finding_linked_project(
  target_finding_id uuid,
  target_project_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_five_s_audit_finding_linked_project(
    target_finding_id,
    target_project_id
  );
$$;

create or replace function public.clear_five_s_audit_finding_linked_project(
  target_finding_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.clear_five_s_audit_finding_linked_project(target_finding_id);
$$;

create or replace function public.set_gemba_observation_linked_project(
  target_observation_id uuid,
  target_project_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_gemba_observation_linked_project(
    target_observation_id,
    target_project_id
  );
$$;

create or replace function public.clear_gemba_observation_linked_project(
  target_observation_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.clear_gemba_observation_linked_project(target_observation_id);
$$;

create or replace function public.link_problem_solving_case_to_ci_project(
  target_case_id uuid,
  target_project_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.link_problem_solving_case_to_ci_project(
    target_case_id,
    target_project_id
  );
$$;

create or replace function public.unlink_problem_solving_case_from_ci_project(
  target_case_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.unlink_problem_solving_case_from_ci_project(target_case_id);
$$;

create or replace function public.get_action_detail(
  target_action_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  action_row public.actions%rowtype;
  creator_name text;
  unit_name text;
  assignees jsonb;
  history jsonb;
  labels jsonb;
  checklist jsonb;
  comment_count integer;
  cover jsonb;
  linked_project jsonb;
begin
  if org_id is null
    or not private.can_read_action(org_id, target_action_id) then
    raise exception 'action detail is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  select nullif(
    btrim(coalesce(membership_row.display_name, profile_row.display_name, '')),
    ''
  )
  into creator_name
  from public.organisation_memberships membership_row
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where membership_row.organisation_id = org_id
    and membership_row.id = action_row.created_by_membership_id;

  select unit_row.name
  into unit_name
  from public.organisation_units unit_row
  where unit_row.organisation_id = org_id
    and unit_row.id = action_row.unit_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'membership_id', assignee_row.membership_id,
        'display_name', coalesce(
          nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name, '')), ''),
          'Team member'
        ),
        'assigned_at', assignee_row.assigned_at
      )
      order by assignee_row.assigned_at
    ),
    '[]'::jsonb
  )
  into assignees
  from public.action_assignees assignee_row
  left join public.organisation_memberships membership_row
    on membership_row.organisation_id = assignee_row.organisation_id
   and membership_row.id = assignee_row.membership_id
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where assignee_row.organisation_id = org_id
    and assignee_row.action_id = target_action_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', transition_row.id,
        'from_status', transition_row.from_status,
        'to_status', transition_row.to_status,
        'reason', transition_row.reason,
        'created_at', transition_row.created_at,
        'actor_membership_id', transition_row.actor_membership_id,
        'actor_display_name', coalesce(
          nullif(btrim(coalesce(actor_membership.display_name, actor_profile.display_name, '')), ''),
          'Team member'
        )
      )
      order by transition_row.created_at, transition_row.id
    ),
    '[]'::jsonb
  )
  into history
  from public.action_status_transitions transition_row
  left join public.organisation_memberships actor_membership
    on actor_membership.organisation_id = transition_row.organisation_id
   and actor_membership.id = transition_row.actor_membership_id
  left join public.profiles actor_profile
    on actor_profile.user_id = actor_membership.user_id
  where transition_row.organisation_id = org_id
    and transition_row.action_id = target_action_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', label_row.id,
        'name', label_row.name,
        'color', label_row.color
      )
      order by label_row.sort_order, label_row.name
    ),
    '[]'::jsonb
  )
  into labels
  from public.action_label_assignments assignment_row
  join public.action_labels label_row
    on label_row.organisation_id = assignment_row.organisation_id
   and label_row.id = assignment_row.label_id
  where assignment_row.organisation_id = org_id
    and assignment_row.action_id = target_action_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item_row.id,
        'title', item_row.title,
        'is_done', item_row.is_done,
        'sort_order', item_row.sort_order,
        'completed_at', item_row.completed_at
      )
      order by item_row.sort_order, item_row.created_at
    ),
    '[]'::jsonb
  )
  into checklist
  from public.action_checklist_items item_row
  where item_row.organisation_id = org_id
    and item_row.action_id = target_action_id;

  select count(*)::integer
  into comment_count
  from public.comments comment_row
  where comment_row.organisation_id = org_id
    and comment_row.target_resource_id = target_action_id;

  select case
    when action_row.card_cover_attachment_id is null then null
    else jsonb_build_object(
      'id', attachment_row.id,
      'filename', attachment_row.filename,
      'mime_type', attachment_row.mime_type,
      'storage_object_path', attachment_row.storage_object_path
    )
  end
  into cover
  from public.attachments attachment_row
  join public.resource_records resource_row
    on resource_row.organisation_id = attachment_row.organisation_id
   and resource_row.id = attachment_row.target_resource_id
  where attachment_row.organisation_id = org_id
    and attachment_row.id = action_row.card_cover_attachment_id
    and attachment_row.target_resource_id = target_action_id
    and resource_row.resource_type = 'action'
    and attachment_row.lifecycle = 'active';

  select private.ci_project_link_summary(org_id, context_row.project_id)
  into linked_project
  from public.ci_project_action_context context_row
  where context_row.organisation_id = org_id
    and context_row.action_id = target_action_id;

  return jsonb_build_object(
    'id', action_row.id,
    'action_number', action_row.action_number,
    'title', action_row.title,
    'description', action_row.description,
    'status', action_row.status,
    'priority', action_row.priority,
    'due_at', action_row.due_at,
    'completed_at', action_row.completed_at,
    'verified_at', action_row.verified_at,
    'unit_id', action_row.unit_id,
    'unit_name', unit_name,
    'site_unit_id', action_row.site_unit_id,
    'source_resource_id', action_row.source_resource_id,
    'source', private.action_source_summary(org_id, action_row.source_resource_id),
    'created_by_membership_id', action_row.created_by_membership_id,
    'created_by_display_name', coalesce(creator_name, 'Team member'),
    'created_at', action_row.created_at,
    'updated_at', action_row.updated_at,
    'version', action_row.version,
    'assignees', assignees,
    'status_history', history,
    'labels', labels,
    'checklist_items', checklist,
    'comment_count', coalesce(comment_count, 0),
    'card_cover_attachment', cover,
    'linked_project', linked_project,
    'permissions', jsonb_build_object(
      'can_update', private.can_update_action(org_id, target_action_id),
      'can_assign', private.can_assign_action(org_id, target_action_id),
      'can_complete', private.can_complete_action(org_id, target_action_id),
      'can_start', private.can_transition_action_status(org_id, target_action_id, 'in_progress'),
      'can_reopen', private.can_update_action(org_id, target_action_id),
      'can_cancel', private.can_update_action(org_id, target_action_id)
    )
  );
end;
$$;
create or replace function public.get_problem_solving_detail(
  target_case_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  case_row public.problem_solving_cases%rowtype;
  unit_row public.organisation_units%rowtype;
  status_history jsonb;
  stage_history jsonb;
  hypotheses jsonb;
  countermeasures jsonb;
  effectiveness_checks jsonb;
  sustainment_items jsonb;
  lessons_learned jsonb;
  sessions jsonb;
  actions jsonb;
  evidence_links jsonb;
  source_links jsonb;
  current_stage jsonb;
  membership_display_names jsonb;
  linked_project_id uuid;
  linked_project jsonb;
begin
  if org_id is null then
    raise exception 'problem solving detail is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_problem_solving_case(org_id, target_case_id) then
    raise exception 'problem solving detail is not authorised'
      using errcode = '42501';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  select unit_table.*
  into unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = case_row.organisation_unit_id;

  -- Status history
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sh.id,
        'from_status', sh.from_status,
        'to_status', sh.to_status,
        'changed_by_membership_id', sh.changed_by_membership_id,
        'rationale', sh.rationale,
        'changed_at', sh.changed_at
      )
      order by sh.changed_at
    ),
    '[]'::jsonb
  )
  into status_history
  from public.problem_solving_status_history sh
  where sh.organisation_id = org_id
    and sh.case_id = target_case_id;

  -- Stage history
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sth.id,
        'from_stage_id', sth.from_stage_id,
        'to_stage_id', sth.to_stage_id,
        'from_stage', (
          select jsonb_build_object('title', fs.title, 'display_order', fs.display_order)
          from public.problem_solving_method_stages fs
          where fs.organisation_id = org_id and fs.id = sth.from_stage_id
        ),
        'to_stage', (
          select jsonb_build_object('title', ts.title, 'display_order', ts.display_order)
          from public.problem_solving_method_stages ts
          where ts.organisation_id = org_id and ts.id = sth.to_stage_id
        ),
        'changed_by_membership_id', sth.changed_by_membership_id,
        'changed_at', sth.changed_at,
        'notes', sth.notes
      )
      order by sth.changed_at
    ),
    '[]'::jsonb
  )
  into stage_history
  from public.problem_solving_stage_history sth
  where sth.organisation_id = org_id
    and sth.case_id = target_case_id;

  -- Current stage
  if case_row.current_method_stage_id is not null then
    select jsonb_build_object(
      'id', ms.id,
      'title', ms.title,
      'display_order', ms.display_order,
      'description', ms.description,
      'semantic_stage_key', ms.semantic_stage_key
    )
    into current_stage
    from public.problem_solving_method_stages ms
    where ms.organisation_id = org_id
      and ms.id = case_row.current_method_stage_id;
  end if;

  -- Hypotheses with cause links
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'statement', h.statement,
        'category', h.category,
        'status', h.status,
        'rationale', h.rationale,
        'verification_rationale', h.verification_rationale,
        'verified_by_membership_id', h.verified_by_membership_id,
        'verified_at', h.verified_at,
        'rejection_rationale', h.rejection_rationale,
        'rejected_by_membership_id', h.rejected_by_membership_id,
        'rejected_at', h.rejected_at,
        'parent_hypothesis_id', h.parent_hypothesis_id,
        'created_by_membership_id', h.created_by_membership_id,
        'created_at', h.created_at,
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id,
                'link_rationale', el.link_rationale
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.hypothesis_id = h.id
          ),
          '[]'::jsonb
        )
      )
      order by h.created_at
    ),
    '[]'::jsonb
  )
  into hypotheses
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.problem_solving_case_id = target_case_id;

  -- Countermeasures with cause links
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cm.id,
        'title', cm.title,
        'description', cm.description,
        'rationale', cm.rationale,
        'status', cm.status,
        'proposed_by_membership_id', cm.proposed_by_membership_id,
        'selected_by_membership_id', cm.selected_by_membership_id,
        'selected_at', cm.selected_at,
        'selected_rationale', cm.selected_rationale,
        'rejected_by_membership_id', cm.rejected_by_membership_id,
        'rejected_at', cm.rejected_at,
        'rejected_rationale', cm.rejected_rationale,
        'created_at', cm.created_at,
        'cause_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', cl.id,
                'hypothesis_id', cl.hypothesis_id,
                'hypothesis_statement', (
                  select hh.statement
                  from public.problem_solving_hypotheses hh
                  where hh.organisation_id = org_id and hh.id = cl.hypothesis_id
                )
              )
            )
            from public.problem_solving_countermeasure_cause_links cl
            where cl.organisation_id = org_id
              and cl.countermeasure_id = cm.id
          ),
          '[]'::jsonb
        ),
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.countermeasure_id = cm.id
          ),
          '[]'::jsonb
        )
      )
      order by cm.created_at
    ),
    '[]'::jsonb
  )
  into countermeasures
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.problem_solving_case_id = target_case_id;

  -- Effectiveness checks
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', eff.id,
        'criterion', eff.criterion,
        'baseline_description', eff.baseline_description,
        'target_description', eff.target_description,
        'baseline_numeric', eff.baseline_numeric,
        'target_numeric', eff.target_numeric,
        'actual_numeric', eff.actual_numeric,
        'unit', eff.unit,
        'observation_window_start', eff.observation_window_start,
        'observation_window_end', eff.observation_window_end,
        'due_date', eff.due_date,
        'result', eff.result,
        'result_rationale', eff.result_rationale,
        'verified_by_membership_id', eff.verified_by_membership_id,
        'verified_at', eff.verified_at,
        'created_by_membership_id', eff.created_by_membership_id,
        'created_at', eff.created_at,
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id,
                'link_rationale', el.link_rationale
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.effectiveness_check_id = eff.id
          ),
          '[]'::jsonb
        )
      )
      order by eff.created_at
    ),
    '[]'::jsonb
  )
  into effectiveness_checks
  from public.problem_solving_effectiveness_checks eff
  where eff.organisation_id = org_id
    and eff.case_id = target_case_id;

  -- Sustainment items
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', si.id,
        'what', si.what,
        'owner_membership_id', si.owner_membership_id,
        'check_method', si.check_method,
        'follow_up_date', si.follow_up_date,
        'result', si.result,
        'training_session_id', si.training_session_id,
        'schedule_definition_id', si.schedule_definition_id,
        'evidence', si.evidence,
        'created_by_membership_id', si.created_by_membership_id,
        'created_at', si.created_at
      )
      order by si.created_at
    ),
    '[]'::jsonb
  )
  into sustainment_items
  from public.problem_solving_sustainment_items si
  where si.organisation_id = org_id
    and si.case_id = target_case_id;

  -- Lessons learned
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ll.id,
        'what_happened', ll.what_happened,
        'what_learned', ll.what_learned,
        'standardise', ll.standardise,
        'apply_elsewhere', ll.apply_elsewhere,
        'notes', ll.notes,
        'created_by_membership_id', ll.created_by_membership_id,
        'created_at', ll.created_at
      )
      order by ll.created_at
    ),
    '[]'::jsonb
  )
  into lessons_learned
  from public.problem_solving_lessons_learned ll
  where ll.organisation_id = org_id
    and ll.case_id = target_case_id;

  -- Sessions with participants and entry counts
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ps_session.id,
        'title', ps_session.title,
        'facilitator_membership_id', ps_session.facilitator_membership_id,
        'scheduled_at', ps_session.scheduled_at,
        'started_at', ps_session.started_at,
        'completed_at', ps_session.completed_at,
        'summary', ps_session.summary,
        'status', ps_session.status,
        'created_at', ps_session.created_at,
        'participants', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', sp.id,
                'membership_id', sp.membership_id,
                'added_at', sp.added_at
              )
            )
            from public.problem_solving_session_participants sp
            where sp.organisation_id = org_id
              and sp.session_id = ps_session.id
          ),
          '[]'::jsonb
        ),
        'entry_count', (
          select count(*)
          from public.problem_solving_session_entries se
          where se.organisation_id = org_id
            and se.session_id = ps_session.id
        )
      )
      order by ps_session.started_at desc nulls last, ps_session.created_at desc
    ),
    '[]'::jsonb
  )
  into sessions
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = org_id
    and ps_session.case_id = target_case_id;

  -- Actions
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'description', a.description,
        'status', a.status,
        'priority', a.priority,
        'due_at', a.due_at,
        'completed_at', a.completed_at,
        'created_by_membership_id', a.created_by_membership_id,
        'context_role', ac.context_role,
        'countermeasure_id', ac.countermeasure_id,
        'containment_id', ac.containment_id,
        'sustainment_item_id', ac.sustainment_item_id,
        'created_at', a.created_at,
        'assignees', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'membership_id', aa.membership_id
              )
            )
            from public.action_assignees aa
            where aa.organisation_id = org_id
              and aa.action_id = a.id
          ),
          '[]'::jsonb
        )
      )
      order by a.created_at
    ),
    '[]'::jsonb
  )
  into actions
  from public.problem_solving_action_context ac
  join public.actions a
    on a.organisation_id = ac.organisation_id
   and a.id = ac.action_id
  where ac.organisation_id = org_id
    and ac.problem_solving_case_id = target_case_id
    and private.can_read_action(org_id, a.id);

  -- Evidence links (case-level)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', el.id,
        'attachment_id', el.attachment_id,
        'current_condition_item_id', el.current_condition_item_id,
        'containment_id', el.containment_id,
        'hypothesis_id', el.hypothesis_id,
        'hypothesis_test_id', el.hypothesis_test_id,
        'countermeasure_id', el.countermeasure_id,
        'effectiveness_check_id', el.effectiveness_check_id,
        'sustainment_item_id', el.sustainment_item_id,
        'session_id', el.session_id,
        'session_entry_id', el.session_entry_id,
        'is_case_level', el.is_case_level,
        'link_rationale', el.link_rationale,
        'created_by_membership_id', el.created_by_membership_id,
        'created_at', el.created_at
      )
      order by el.created_at
    ),
    '[]'::jsonb
  )
  into evidence_links
  from public.problem_solving_evidence_links el
  where el.organisation_id = org_id
    and el.problem_solving_case_id = target_case_id;

  -- Source links
  source_links := private.build_problem_solving_source_links_summary(org_id, target_case_id);
  membership_display_names := private.membership_public_display_names(
    org_id,
    (
      select coalesce(array_agg(distinct referenced.membership_id), '{}'::uuid[])
      from (
        select case_row.owner_membership_id as membership_id
        union
        select case_row.facilitator_membership_id
        union
        select case_row.created_by_membership_id
        union
        select case_row.closed_by_membership_id
        union
        select case_row.cancelled_by_membership_id
        union
        select (history_entry->>'changed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(status_history, '[]'::jsonb)) history_entry
        union
        select (history_entry->>'changed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(stage_history, '[]'::jsonb)) history_entry
        union
        select (hypothesis_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (hypothesis_entry->>'verified_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (hypothesis_entry->>'rejected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (countermeasure_entry->>'proposed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (countermeasure_entry->>'selected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (countermeasure_entry->>'rejected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (effectiveness_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(effectiveness_checks, '[]'::jsonb)) effectiveness_entry
        union
        select (effectiveness_entry->>'verified_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(effectiveness_checks, '[]'::jsonb)) effectiveness_entry
        union
        select (sustainment_entry->>'owner_membership_id')::uuid
        from jsonb_array_elements(coalesce(sustainment_items, '[]'::jsonb)) sustainment_entry
        union
        select (sustainment_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(sustainment_items, '[]'::jsonb)) sustainment_entry
        union
        select (lesson_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(lessons_learned, '[]'::jsonb)) lesson_entry
        union
        select (session_entry->>'facilitator_membership_id')::uuid
        from jsonb_array_elements(coalesce(sessions, '[]'::jsonb)) session_entry
        union
        select (participant_entry->>'membership_id')::uuid
        from jsonb_array_elements(coalesce(sessions, '[]'::jsonb)) session_entry
        cross join lateral jsonb_array_elements(
          coalesce(session_entry->'participants', '[]'::jsonb)
        ) participant_entry
        union
        select (evidence_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(evidence_links, '[]'::jsonb)) evidence_entry
        union
        select (action_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(actions, '[]'::jsonb)) action_entry
        union
        select (assignee_entry->>'membership_id')::uuid
        from jsonb_array_elements(coalesce(actions, '[]'::jsonb)) action_entry
        cross join lateral jsonb_array_elements(
          coalesce(action_entry->'assignees', '[]'::jsonb)
        ) assignee_entry
      ) referenced
      where referenced.membership_id is not null
    )
  );

  select link_row.project_id
  into linked_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  limit 1;

  select private.ci_project_link_summary(org_id, linked_project_id)
  into linked_project;

  return jsonb_build_object(
    'id', case_row.id,
    'case_number', case_row.case_number,
    'title', case_row.title,
    'problem_statement', case_row.problem_statement,
    'background', case_row.background,
    'business_impact', case_row.business_impact,
    'scope_in', case_row.scope_in,
    'scope_out', case_row.scope_out,
    'target_condition', case_row.target_condition,
    'detected_at', case_row.detected_at,
    'status', case_row.status,
    'severity', case_row.severity,
    'priority', case_row.priority,
    'organisation_unit_id', case_row.organisation_unit_id,
    'unit_name', unit_row.name,
    'owner_membership_id', case_row.owner_membership_id,
    'owner_display_name', private.membership_public_display_name(
      org_id,
      case_row.owner_membership_id
    ),
    'facilitator_membership_id', case_row.facilitator_membership_id,
    'facilitator_display_name', private.membership_public_display_name(
      org_id,
      case_row.facilitator_membership_id
    ),
    'method_version_id', case_row.method_version_id,
    'current_method_stage_id', case_row.current_method_stage_id,
    'current_stage', current_stage,
    'closure_outcome', case_row.closure_outcome,
    'closure_rationale', case_row.closure_rationale,
    'transferred_to_reference', case_row.transferred_to_reference,
    'closed_at', case_row.closed_at,
    'closed_by_membership_id', case_row.closed_by_membership_id,
    'cancellation_rationale', case_row.cancellation_rationale,
    'cancelled_at', case_row.cancelled_at,
    'cancelled_by_membership_id', case_row.cancelled_by_membership_id,
    'target_due_at', case_row.target_due_at,
    'activated_at', case_row.activated_at,
    'created_by_membership_id', case_row.created_by_membership_id,
    'created_at', case_row.created_at,
    'updated_at', case_row.updated_at,
    'status_history', status_history,
    'stage_history', stage_history,
    'hypotheses', hypotheses,
    'countermeasures', countermeasures,
    'effectiveness_checks', effectiveness_checks,
    'sustainment_items', sustainment_items,
    'lessons_learned', lessons_learned,
    'sessions', sessions,
    'actions', actions,
    'evidence_links', evidence_links,
    'source_links', source_links,
    'membership_display_names', membership_display_names,
    'linked_project', linked_project
  );
end;
$$;


alter function private.link_action_to_ci_project(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.unlink_action_from_ci_project(uuid)
  owner to lean_hub_private_owner;

alter function private.ci_project_accepts_work_item_links(uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_ci_project_accepts_work_item_links(uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_ci_project_work_item_link_mutable(uuid, uuid) owner to lean_hub_private_owner;
alter function private.ci_project_link_summary(uuid, uuid) owner to lean_hub_private_owner;
alter function private.set_five_s_audit_finding_linked_project(uuid, uuid) owner to lean_hub_private_owner;
alter function private.clear_five_s_audit_finding_linked_project(uuid) owner to lean_hub_private_owner;
alter function private.set_gemba_observation_linked_project(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.clear_gemba_observation_linked_project(uuid)
  owner to lean_hub_private_owner;
alter function private.can_update_problem_solving_case_link(uuid, uuid) owner to lean_hub_private_owner;
alter function private.link_problem_solving_case_to_ci_project(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.unlink_problem_solving_case_from_ci_project(uuid)
  owner to lean_hub_private_owner;

do $grant$
declare
  fn regprocedure;
begin
  foreach fn in array array[
    'private.ci_project_link_summary(uuid,uuid)'::regprocedure,
    'private.link_action_to_ci_project(uuid,uuid)'::regprocedure,
    'private.unlink_action_from_ci_project(uuid)'::regprocedure,
    'private.set_five_s_audit_finding_linked_project(uuid,uuid)'::regprocedure,
    'private.clear_five_s_audit_finding_linked_project(uuid)'::regprocedure,
    'private.set_gemba_observation_linked_project(uuid,uuid)'::regprocedure,
    'private.clear_gemba_observation_linked_project(uuid)'::regprocedure,
    'private.can_update_problem_solving_case_link(uuid,uuid)'::regprocedure,
    'private.link_problem_solving_case_to_ci_project(uuid,uuid)'::regprocedure,
    'private.unlink_problem_solving_case_from_ci_project(uuid)'::regprocedure,
    'private.ci_project_accepts_work_item_links(uuid,uuid)'::regprocedure,
    'private.assert_ci_project_accepts_work_item_links(uuid,uuid)'::regprocedure,
    'private.assert_ci_project_work_item_link_mutable(uuid,uuid)'::regprocedure
  ]
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      fn
    );
    execute format(
      'grant execute on function %s to lean_hub_private_owner',
      fn
    );
  end loop;
end;
$grant$;

revoke all on function public.link_action_to_ci_project(uuid, uuid) from public, anon;
revoke all on function public.unlink_action_from_ci_project(uuid) from public, anon;
revoke all on function public.set_five_s_audit_finding_linked_project(uuid, uuid) from public, anon;
revoke all on function public.clear_five_s_audit_finding_linked_project(uuid) from public, anon;
revoke all on function public.set_gemba_observation_linked_project(uuid, uuid) from public, anon;
revoke all on function public.clear_gemba_observation_linked_project(uuid) from public, anon;
revoke all on function public.link_problem_solving_case_to_ci_project(uuid, uuid) from public, anon;
revoke all on function public.unlink_problem_solving_case_from_ci_project(uuid) from public, anon;

grant execute on function public.link_action_to_ci_project(uuid, uuid) to authenticated;
grant execute on function public.unlink_action_from_ci_project(uuid) to authenticated;
grant execute on function public.set_five_s_audit_finding_linked_project(uuid, uuid) to authenticated;
grant execute on function public.clear_five_s_audit_finding_linked_project(uuid) to authenticated;
grant execute on function public.set_gemba_observation_linked_project(uuid, uuid) to authenticated;
grant execute on function public.clear_gemba_observation_linked_project(uuid) to authenticated;
grant execute on function public.link_problem_solving_case_to_ci_project(uuid, uuid) to authenticated;
grant execute on function public.unlink_problem_solving_case_from_ci_project(uuid) to authenticated;

revoke execute on function public.set_five_s_audit_finding_linked_project(uuid, uuid)
  from authenticated;
revoke execute on function public.clear_five_s_audit_finding_linked_project(uuid)
  from authenticated;