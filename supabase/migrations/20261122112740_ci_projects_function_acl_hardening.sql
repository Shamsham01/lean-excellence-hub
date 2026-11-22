-- #423 removed direct writes to public.ci_projects by authenticated.
-- All application writes go through private SECURITY DEFINER RPCs owned by
-- lean_hub_private_owner.

revoke execute on function
  private.can_edit_ci_project(uuid, uuid),
  private.can_read_ci_project(uuid, uuid),
  private.guard_ci_project_child_completed_immutable(),
  private.instantiate_ci_project_phases(uuid, uuid)
from public, anon;

-- The project and related SELECT policies use this helper as authenticated.
grant execute on function private.can_read_ci_project(uuid, uuid) to authenticated;
