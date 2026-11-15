-- SEC: tighten EXECUTE on private.set_action_assignee (default PUBLIC grant on hosted).

grant select, insert, delete on public.action_assignees to lean_hub_private_owner;
grant select, update (version, updated_at) on public.actions to lean_hub_private_owner;

create or replace function public.set_action_assignee(
  target_action_id uuid,
  target_membership_id uuid default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_action_assignee(target_action_id, target_membership_id)
$$;

revoke all on function public.set_action_assignee(uuid, uuid) from public, anon;
grant execute on function public.set_action_assignee(uuid, uuid) to authenticated;

alter function private.set_action_assignee(uuid, uuid) owner to lean_hub_private_owner;

revoke all on function private.set_action_assignee(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.set_action_assignee(uuid, uuid)
  to lean_hub_private_owner;