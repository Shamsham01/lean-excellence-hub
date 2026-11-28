-- 20261128120000_public_auth_wrapper_execute_revoke_anon.sql
--
-- SENTINEL follow-up N5 (from #428/#435 reviews): the public SECURITY INVOKER
-- wrappers public.current_organisation_id() and public.has_scoped_permission()
-- still carry the default PUBLIC EXECUTE grant. anon (and any role) can call
-- them, and the call then fails inside with 42501 "permission denied for
-- schema private", which is noise in the Postgres logs.
--
-- Revoke EXECUTE from PUBLIC and anon so the call is refused at the wrapper.
-- authenticated keeps its explicit grant (re-asserted here, idempotent).
-- Behaviour is unchanged for every caller: authenticated still works, and anon
-- or other roles already got 42501 because the private callees are not
-- granted to them. The app only calls these RPCs with a user session and
-- handles any error generically (no message matching on the 42501 text).
--
-- No owner, body, search_path or SECURITY changes. Idempotent.

revoke execute on function public.current_organisation_id() from public, anon;
revoke execute on function public.has_scoped_permission(uuid, text, uuid, uuid)
  from public, anon;

grant execute on function public.current_organisation_id() to authenticated;
grant execute on function public.has_scoped_permission(uuid, text, uuid, uuid)
  to authenticated;
