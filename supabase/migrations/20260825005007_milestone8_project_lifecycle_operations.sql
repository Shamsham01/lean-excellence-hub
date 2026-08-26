-- Milestone 8: CI project lifecycle RPCs and charter submission compatibility.

create or replace function private.append_ci_project_status_history(
  target_organisation_id uuid,
  target_project_id uuid,
  target_from_status text,
  target_to_status text,
  target_actor_membership_id uuid,
  target_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.ci_project_status_history (
    organisation_id,
    project_id,
    from_status,
    to_status,
    changed_by_membership_id,
    reason
  )
  values (
    target_organisation_id,
    target_project_id,
    target_from_status,
    target_to_status,
    target_actor_membership_id,
    target_reason
  );
end;
$$;

create or replace function private.ci_project_has_exactly_one_active_owner(
  target_organisation_id uuid,
  target_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) = 1
  from public.ci_project_team_assignments assignment_row
  where assignment_row.organisation_id = target_organisation_id
    and assignment_row.project_id = target_project_id
    and assignment_row.team_role = 'owner'
    and assignment_row.valid_to is null
$$;

create or replace function private.assert_ci_project_charter_complete(
  project_row public.ci_projects
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if btrim(project_row.title) = ''
    or project_row.problem_statement is null
    or btrim(project_row.problem_statement) = ''
    or project_row.objective is null
    or btrim(project_row.objective) = ''
    or project_row.methodology_version_id is null then
    raise exception 'project charter is incomplete'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.submit_project(
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
  project_row public.ci_projects%rowtype;
  methodology_published boolean;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project submission is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status <> 'draft' then
    raise exception 'project is not submittable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project submission is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_charter_complete(project_row);

  if not private.ci_project_has_exactly_one_active_owner(org_id, target_project_id) then
    raise exception 'project requires exactly one active owner before submission'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.ci_project_methodology_versions version_table
    where version_table.organisation_id = org_id
      and version_table.id = project_row.methodology_version_id
      and version_table.status = 'published'
  )
  into methodology_published;

  if not methodology_published then
    raise exception 'project methodology version is not published'
      using errcode = '22023';
  end if;

  update public.ci_projects project_table
  set status = 'submitted',
      charter_submitted_at = statement_timestamp(),
      charter_submitted_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'draft',
    'submitted',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.submitted',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectSubmitted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.approve_project(
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
  project_row public.ci_projects%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project approval is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status <> 'submitted' then
    raise exception 'project is not approvable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project approval is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'approved',
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'submitted',
    'approved',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.approved',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectApproved',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.return_project_to_draft(
  target_project_id uuid,
  target_reason text default null
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
  if org_id is null or actor_membership_id is null then
    raise exception 'project return to draft is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status not in ('submitted', 'approved') then
    raise exception 'project cannot be returned to draft'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project return to draft is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'draft',
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    project_row.status,
    'draft',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.returned_to_draft',
    target_project_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectReturnedToDraft',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.start_project(
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
  project_row public.ci_projects%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project start is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status <> 'approved' then
    raise exception 'project is not startable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project start is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'active',
      actual_start_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'approved',
    'active',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.started',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectStarted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.hold_project(
  target_project_id uuid,
  target_reason text default null
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
  if org_id is null or actor_membership_id is null then
    raise exception 'project hold is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status <> 'active' then
    raise exception 'project is not holdable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project hold is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'on_hold',
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'active',
    'on_hold',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.held',
    target_project_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectHeld',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.resume_project(
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
  project_row public.ci_projects%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project resume is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status <> 'on_hold' then
    raise exception 'project is not resumable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project resume is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'active',
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'on_hold',
    'active',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.resumed',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectResumed',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.complete_project(
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
  project_row public.ci_projects%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project completion is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status not in ('active', 'on_hold') then
    raise exception 'project is not completable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project completion is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'completed',
      actual_end_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    project_row.status,
    'completed',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.completed',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectCompleted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.cancel_project(
  target_project_id uuid,
  target_reason text default null
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
  if org_id is null or actor_membership_id is null then
    raise exception 'project cancellation is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status in ('completed', 'cancelled') then
    raise exception 'project is not cancellable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project cancellation is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'cancelled',
      actual_end_at = coalesce(project_table.actual_end_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    project_row.status,
    'cancelled',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.cancelled',
    target_project_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectCancelled',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.submit_ci_project_charter(
  target_project_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return private.submit_project(target_project_id);
end;
$$;

create or replace function public.submit_project(target_project_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.submit_project(target_project_id) $$;

create or replace function public.approve_project(target_project_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.approve_project(target_project_id) $$;

create or replace function public.return_project_to_draft(target_project_id uuid, target_reason text default null)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.return_project_to_draft(target_project_id, target_reason) $$;

create or replace function public.start_project(target_project_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.start_project(target_project_id) $$;

create or replace function public.hold_project(target_project_id uuid, target_reason text default null)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.hold_project(target_project_id, target_reason) $$;

create or replace function public.resume_project(target_project_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.resume_project(target_project_id) $$;

create or replace function public.complete_project(target_project_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.complete_project(target_project_id) $$;

create or replace function public.cancel_project(target_project_id uuid, target_reason text default null)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.cancel_project(target_project_id, target_reason) $$;

grant execute on function public.submit_project(uuid) to authenticated;
grant execute on function public.approve_project(uuid) to authenticated;
grant execute on function public.return_project_to_draft(uuid, text) to authenticated;
grant execute on function public.start_project(uuid) to authenticated;
grant execute on function public.hold_project(uuid, text) to authenticated;
grant execute on function public.resume_project(uuid) to authenticated;
grant execute on function public.complete_project(uuid) to authenticated;
grant execute on function public.cancel_project(uuid, text) to authenticated;

revoke all on function public.submit_project(uuid) from public, anon;
revoke all on function public.approve_project(uuid) from public, anon;
revoke all on function public.return_project_to_draft(uuid, text) from public, anon;
revoke all on function public.start_project(uuid) from public, anon;
revoke all on function public.hold_project(uuid, text) from public, anon;
revoke all on function public.resume_project(uuid) from public, anon;
revoke all on function public.complete_project(uuid) from public, anon;
revoke all on function public.cancel_project(uuid, text) from public, anon;

alter function private.append_ci_project_status_history(uuid, uuid, text, text, uuid, text) owner to lean_hub_private_owner;
alter function private.ci_project_has_exactly_one_active_owner(uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_ci_project_charter_complete(public.ci_projects) owner to lean_hub_private_owner;
alter function private.submit_project(uuid) owner to lean_hub_private_owner;
alter function private.approve_project(uuid) owner to lean_hub_private_owner;
alter function private.return_project_to_draft(uuid, text) owner to lean_hub_private_owner;
alter function private.start_project(uuid) owner to lean_hub_private_owner;
alter function private.hold_project(uuid, text) owner to lean_hub_private_owner;
alter function private.resume_project(uuid) owner to lean_hub_private_owner;
alter function private.complete_project(uuid) owner to lean_hub_private_owner;
alter function private.cancel_project(uuid, text) owner to lean_hub_private_owner;
alter function private.submit_ci_project_charter(uuid) owner to lean_hub_private_owner;
