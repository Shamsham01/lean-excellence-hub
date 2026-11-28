-- 20261128001500_private_helper_execute_grants_431.sql
--
-- Fixes #431: six private helpers that live paths already use cannot be
-- executed by the role that needs them (42501 permission denied for function).
-- These grants were deliberately left out of the lockdown migration
-- 20261126093000 because they widen access relative to the hosted catalog.
--
-- 1. Benefit RLS helpers (owner lean_hub_private_owner, SECURITY DEFINER).
--    SELECT policies TO authenticated on benefit_overlap_groups,
--    benefit_overlap_allocation_history and benefit_realisation_entries call
--    them, so authenticated needs EXECUTE.
-- 2. Platform-admin in-app notification functions (owner postgres, SECURITY
--    DEFINER). Their public SECURITY INVOKER wrappers are granted only to
--    service_role, so service_role needs EXECUTE on the private callee.
--
-- No PUBLIC or anon grants. No owner, body, search_path or SECURITY changes.
-- Idempotent: GRANT is a no-op on re-run.

grant execute on function private.can_read_benefit_overlap_group(uuid, uuid) to authenticated;
grant execute on function private.can_read_benefit_overlap_allocation(uuid, uuid) to authenticated;
grant execute on function private.can_read_benefit_realisation_entry(uuid, uuid) to authenticated;

grant execute on function private.platform_admin_in_app_notifications(uuid, text, text, integer)
  to service_role;
grant execute on function private.mark_platform_admin_in_app_notification_read(uuid, text, uuid)
  to service_role;
grant execute on function private.mark_all_platform_admin_in_app_notifications_read(uuid, text)
  to service_role;
