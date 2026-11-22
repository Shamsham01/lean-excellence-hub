grant select, insert, update on public.organisation_ai_credit_periods to lean_hub_private_owner;
grant select, insert, update on public.organisation_ai_credit_reservations to lean_hub_private_owner;

create policy organisation_ai_credit_periods_private_owner_all
  on public.organisation_ai_credit_periods
  for all
  to lean_hub_private_owner
  using (true)
  with check (true);

create policy organisation_ai_credit_reservations_private_owner_all
  on public.organisation_ai_credit_reservations
  for all
  to lean_hub_private_owner
  using (true)
  with check (true);
