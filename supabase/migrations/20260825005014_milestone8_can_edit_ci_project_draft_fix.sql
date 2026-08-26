-- Milestone 8 closure: allow draft-phase project editing for creators and managers.

create or replace function private.can_edit_ci_project(
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
      and (
        (
          project_row.status in ('draft', 'submitted', 'approved')
          and (
            private.can_manage_ci_project_in_unit(
              target_organisation_id,
              project_row.unit_id
            )
            or project_row.created_by_membership_id =
              private.current_membership_id(target_organisation_id)
          )
        )
        or (
          project_row.status in ('active', 'on_hold')
          and private.can_manage_ci_project_in_unit(
            target_organisation_id,
            project_row.unit_id
          )
        )
      )
  )
$$;

alter function private.can_edit_ci_project(uuid, uuid) owner to lean_hub_private_owner;

grant select on public.ci_projects to authenticated;
grant select on public.ci_project_source_links to authenticated;
grant update on public.ci_projects to authenticated;

create policy ci_projects_update_manage
on public.ci_projects for update to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_manage_ci_project_in_unit(organisation_id, unit_id)
)
with check (
  organisation_id = private.current_organisation_id()
  and private.can_manage_ci_project_in_unit(organisation_id, unit_id)
);