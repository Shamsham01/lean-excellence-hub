-- Session-bind can_read_improvement_suggestion (retain authenticated EXECUTE for portfolio/tests).
-- can_submit_suggestion_to_unit: see 20261109020700 (DEFINER-only, revoked from authenticated).

create or replace function private.can_read_improvement_suggestion(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    target_organisation_id is not distinct from private.current_organisation_id()
    and private.membership_can_read_improvement_suggestion(
      target_organisation_id,
      target_suggestion_id,
      private.current_membership_id(target_organisation_id)
    )
  )
$$;

alter function private.can_read_improvement_suggestion(uuid, uuid) owner to lean_hub_private_owner;

revoke all on function private.can_read_improvement_suggestion(uuid, uuid) from public;
grant execute on function private.can_read_improvement_suggestion(uuid, uuid) to authenticated;
