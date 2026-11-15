-- CI project links for actions, 5S findings, gemba observations, and problem-solving cases.

alter table public.five_s_audit_findings
  add column if not exists linked_project_id uuid;

alter table public.gemba_walk_observations
  add column if not exists linked_project_id uuid;

alter table public.five_s_audit_findings
  add constraint five_s_audit_findings_linked_project_fkey
  foreign key (organisation_id, linked_project_id)
  references public.ci_projects(organisation_id, id)
  on delete restrict;

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
    when project_row.id is null then null
    else jsonb_build_object(
      'id', project_row.id,
      'project_number', project_row.project_number,
      'title', project_row.title,
      'status', project_row.status,
      'href', '/platform/projects/' || project_row.id::text,
      'can_open', private.can_read_ci_project(target_organisation_id, project_row.id)
    )
  end
  from public.ci_projects project_row
  where project_row.organisation_id = target_organisation_id
    and project_row.id = target_project_id;
$$;

alter function private.ci_project_link_summary(uuid, uuid) owner to lean_hub_private_owner;

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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_update_action(org_id, target_action_id)
    or not private.can_read_ci_project(org_id, target_project_id) then
    raise exception 'action project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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
    project_id = excluded.project_id;

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
begin
  if org_id is null
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'action project unlink is not authorised'
      using errcode = '42501';
  end if;

  delete from public.ci_project_action_context context_row
  where context_row.organisation_id = org_id
    and context_row.action_id = target_action_id;

  return true;
end;
$$;

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
begin
  if org_id is null
    or not private.can_read_ci_project(org_id, target_project_id) then
    raise exception '5S finding project link is not authorised'
      using errcode = '42501';
  end if;

  select finding_row.audit_id
  into audit_id
  from public.five_s_audit_findings finding_row
  where finding_row.organisation_id = org_id
    and finding_row.id = target_finding_id;

  if not found
    or not private.can_edit_five_s_audit(org_id, audit_id) then
    raise exception '5S finding project link is not authorised'
      using errcode = '42501';
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
begin
  if org_id is null then
    raise exception '5S finding project unlink is not authorised'
      using errcode = '42501';
  end if;

  select finding_row.audit_id
  into audit_id
  from public.five_s_audit_findings finding_row
  where finding_row.organisation_id = org_id
    and finding_row.id = target_finding_id;

  if not found
    or not private.can_edit_five_s_audit(org_id, audit_id) then
    raise exception '5S finding project unlink is not authorised'
      using errcode = '42501';
  end if;

  update public.five_s_audit_findings finding_row
  set linked_project_id = null
  where finding_row.organisation_id = org_id
    and finding_row.id = target_finding_id;

  return true;
end;
$$;

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
begin
  if org_id is null
    or not private.can_read_ci_project(org_id, target_project_id) then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  select observation_row.walk_id
  into walk_id
  from public.gemba_walk_observations observation_row
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

  if not found
    or not private.can_edit_gemba_walk(org_id, walk_id) then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

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
begin
  if org_id is null then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  select observation_row.walk_id
  into walk_id
  from public.gemba_walk_observations observation_row
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

  if not found
    or not private.can_edit_gemba_walk(org_id, walk_id) then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  update public.gemba_walk_observations observation_row
  set linked_project_id = null
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_update_problem_solving_case_link(org_id, target_case_id)
    or not private.can_read_ci_project(org_id, target_project_id) then
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  delete from public.ci_project_source_links old_link
  where old_link.organisation_id = org_id
    and old_link.source_resource_id = target_case_id;

  insert into public.ci_project_source_links (
    organisation_id,
    project_id,
    source_resource_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_project_id,
    target_case_id,
    actor_membership_id
  )
  on conflict (organisation_id, project_id, source_resource_id) do nothing;

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
begin
  if org_id is null
    or not private.can_update_problem_solving_case_link(org_id, target_case_id) then
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  delete from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id;

  return true;
end;
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

alter function private.link_action_to_ci_project(uuid, uuid) owner to lean_hub_private_owner;
alter function private.unlink_action_from_ci_project(uuid) owner to lean_hub_private_owner;
alter function private.set_five_s_audit_finding_linked_project(uuid, uuid) owner to lean_hub_private_owner;
alter function private.clear_five_s_audit_finding_linked_project(uuid) owner to lean_hub_private_owner;
alter function private.set_gemba_observation_linked_project(uuid, uuid) owner to lean_hub_private_owner;
alter function private.clear_gemba_observation_linked_project(uuid) owner to lean_hub_private_owner;
alter function private.can_update_problem_solving_case_link(uuid, uuid) owner to lean_hub_private_owner;
alter function private.link_problem_solving_case_to_ci_project(uuid, uuid) owner to lean_hub_private_owner;
alter function private.unlink_problem_solving_case_from_ci_project(uuid) owner to lean_hub_private_owner;