-- Milestone 12: organisation-wide AI settings require organisation-scoped ai.manage_settings.

create or replace function private.can_manage_ai_settings(target_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'ai.manage_settings',
    null,
    null
  )
$$;

alter function private.can_manage_ai_settings(uuid) owner to lean_hub_private_owner;
