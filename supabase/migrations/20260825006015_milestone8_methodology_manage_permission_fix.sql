-- Align methodology management authorization with active grant probe.

create or replace function private.can_manage_ci_project_methodologies(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.member_has_permission('projects.manage')
$$;

alter function private.can_manage_ci_project_methodologies(uuid)
  owner to lean_hub_private_owner;
