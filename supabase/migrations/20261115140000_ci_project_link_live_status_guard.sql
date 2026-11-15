-- Only live CI projects (not completed/cancelled) accept new work-item links; terminal links are read-only.

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
begin
  if not private.can_read_ci_project(target_organisation_id, target_project_id) then
    raise exception 'project link is not authorised'
      using errcode = '42501';
  end if;

  if not private.ci_project_accepts_work_item_links(
    target_organisation_id,
    target_project_id
  ) then
    raise exception
      'This project is completed or cancelled and cannot accept new links.'
      using errcode = '22023';
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
begin
  if target_project_id is null then
    return;
  end if;

  if not private.ci_project_accepts_work_item_links(
    target_organisation_id,
    target_project_id
  ) then
    raise exception
      'This project link is read-only because the project is completed or cancelled.'
      using errcode = '22023';
  end if;
end;
$$;

alter function private.ci_project_accepts_work_item_links(uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_ci_project_accepts_work_item_links(uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_ci_project_work_item_link_mutable(uuid, uuid) owner to lean_hub_private_owner;

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
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'action project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

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
  linked_project_id uuid;
begin
  if org_id is null
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'action project unlink is not authorised'
      using errcode = '42501';
  end if;

  select context_row.project_id
  into linked_project_id
  from public.ci_project_action_context context_row
  where context_row.organisation_id = org_id
    and context_row.action_id = target_action_id;

  perform private.assert_ci_project_work_item_link_mutable(
    org_id,
    linked_project_id
  );

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
  if org_id is null then
    raise exception '5S finding project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

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
    and finding_row.id = target_finding_id;

  if not found
    or not private.can_edit_five_s_audit(org_id, audit_id) then
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
  if org_id is null then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

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
    and observation_row.id = target_observation_id;

  if not found
    or not private.can_edit_gemba_walk(org_id, walk_id) then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_work_item_link_mutable(
    org_id,
    linked_project_id
  );

  update public.gemba_walk_observations observation_row
  set linked_project_id = null
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

  return true;
end;
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
    or not private.can_update_problem_solving_case_link(org_id, target_case_id) then
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

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
  linked_project_id uuid;
begin
  if org_id is null
    or not private.can_update_problem_solving_case_link(org_id, target_case_id) then
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  select link_row.project_id
  into linked_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
  limit 1;

  perform private.assert_ci_project_work_item_link_mutable(
    org_id,
    linked_project_id
  );

  delete from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id;

  return true;
end;
$$;