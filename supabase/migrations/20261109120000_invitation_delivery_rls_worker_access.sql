-- FORCE RLS on private.organisation_invitation_deliveries blocked security-definer
-- worker RPCs owned by lean_hub_private_owner (no matching rows on begin/complete).

create policy organisation_invitation_deliveries_private_owner_all
  on private.organisation_invitation_deliveries
  for all
  to lean_hub_private_owner
  using (true)
  with check (true);
