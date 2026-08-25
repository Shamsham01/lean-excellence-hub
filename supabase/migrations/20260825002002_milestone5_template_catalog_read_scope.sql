-- Unit-scoped templates.read grants must still allow reading published template metadata.

create or replace function private.can_read_template_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'templates.read',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'templates.read',
    private.current_membership_id(target_organisation_id),
    null
  )
  or exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.status = 'active'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key = 'templates.read'
    where grant_row.organisation_id = target_organisation_id
      and grant_row.grantee_membership_id =
        private.current_membership_id(target_organisation_id)
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
      and grant_row.scope_type in ('organisation', 'unit_subtree')
  )
$$;

alter function private.can_read_template_catalog(uuid)
  owner to lean_hub_private_owner;

drop policy if exists templates_select on public.templates;
create policy templates_select
on public.templates for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_template_catalog(organisation_id)
);

drop policy if exists template_versions_select on public.template_versions;
create policy template_versions_select
on public.template_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_template_catalog(organisation_id)
);

drop policy if exists template_sections_select on public.template_sections;
create policy template_sections_select
on public.template_sections for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_template_catalog(organisation_id)
);

drop policy if exists template_questions_select on public.template_questions;
create policy template_questions_select
on public.template_questions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_template_catalog(organisation_id)
);

create or replace function private.can_access_resource(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_row public.resource_records%rowtype;
begin
  select resource_registry.*
  into resource_row
  from public.resource_records resource_registry
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_resource_id
    and resource_registry.retired_at is null;

  if not found then
    return false;
  end if;

  case resource_row.resource_type
    when 'action' then
      return private.can_read_action(target_organisation_id, target_resource_id);
    when 'template' then
      return private.can_read_template_catalog(target_organisation_id);
    when 'template_submission' then
      return private.can_read_template_submission(
        target_organisation_id,
        target_resource_id
      );
    when 'attachment' then
      return private.can_access_attachment_target(
        target_organisation_id,
        target_resource_id
      );
    when 'comment' then
      return private.can_access_comment_target(
        target_organisation_id,
        target_resource_id
      );
    when 'maturity_model' then
      return private.can_read_maturity_catalog(target_organisation_id);
    when 'maturity_assessment' then
      return private.can_read_maturity_assessment(
        target_organisation_id,
        target_resource_id
      );
    else
      return false;
  end case;
end;
$$;
