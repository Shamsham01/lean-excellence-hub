-- Founding finalisation reads auth.users, so it must run as postgres
-- like other Auth-identity helpers.

alter function private.finalise_founding_signup(uuid, uuid) owner to postgres;
grant execute on function private.finalise_founding_signup(uuid, uuid)
  to postgres, service_role;
