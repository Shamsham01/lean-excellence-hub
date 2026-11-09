-- Lock can_submit_suggestion_to_unit (DEFINER-only callers); session-bound probe from 20600.

create or replace function private.can_submit_suggestion_to_unit(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    target_organisation_id is not distinct from private.current_organisation_id()
    and (
      private.has_scoped_permission(
        target_organisation_id,
        'suggestions.submit',
        null,
        null
      )
      or private.has_scoped_permission(
        target_organisation_id,
        'suggestions.submit',
        null,
        target_unit_id
      )
      or private.has_scoped_permission(
        target_organisation_id,
        'suggestions.submit',
        private.current_membership_id(target_organisation_id),
        null
      )
    )
  )
$$;

alter function private.can_submit_suggestion_to_unit(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_submit_suggestion_to_unit(uuid, uuid) set search_path = '';

revoke all on function private.can_submit_suggestion_to_unit(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.can_submit_suggestion_to_unit(uuid, uuid)
  to lean_hub_private_owner, postgres;
