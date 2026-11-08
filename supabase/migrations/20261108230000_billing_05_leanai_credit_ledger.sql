-- BILLING-05: LeanAI credit ledger (implementation path). Hard enforcement remains
-- off via organisation_ai_settings until operator enables credit_policy_enforced.

alter table public.organisation_ai_settings
  add column if not exists credit_policy_enforced boolean not null default false,
  add column if not exists credit_period_anchor_day smallint not null default 1;

alter table public.organisation_ai_settings
  add constraint organisation_ai_settings_credit_anchor_day_check
    check (credit_period_anchor_day between 1 and 28);

create table if not exists public.organisation_ai_credit_periods (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  allowance_credits bigint not null,
  reserved_credits bigint not null default 0,
  consumed_credits bigint not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  unique (organisation_id, period_start)
);

create index if not exists organisation_ai_credit_periods_org_idx
  on public.organisation_ai_credit_periods (organisation_id, period_start desc);

create table if not exists public.organisation_ai_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  ai_run_id uuid not null,
  period_id uuid not null references public.organisation_ai_credit_periods(id) on delete cascade,
  reserved_credits bigint not null,
  settled_credits bigint,
  status text not null default 'reserved',
  idempotency_key text not null,
  created_at timestamptz not null default statement_timestamp(),
  settled_at timestamptz,
  unique (organisation_id, idempotency_key),
  unique (organisation_id, ai_run_id),
  constraint organisation_ai_credit_reservations_status_check
    check (status in ('reserved', 'settled', 'released', 'refunded'))
);

alter table public.organisation_ai_credit_periods enable row level security;
alter table public.organisation_ai_credit_reservations enable row level security;

create policy organisation_ai_credit_periods_member_read on public.organisation_ai_credit_periods
  for select to authenticated
  using (organisation_id = private.current_organisation_id());

create policy organisation_ai_credit_reservations_member_read on public.organisation_ai_credit_reservations
  for select to authenticated
  using (organisation_id = private.current_organisation_id());

revoke all on public.organisation_ai_credit_periods from public, anon;
revoke all on public.organisation_ai_credit_reservations from public, anon;
grant select on public.organisation_ai_credit_periods to authenticated;
grant select on public.organisation_ai_credit_reservations to authenticated;

create or replace function private.leanai_credit_policy_enforced(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select settings.credit_policy_enforced
      from public.organisation_ai_settings settings
      where settings.organisation_id = target_organisation_id
    ),
    false
  )
$$;

create or replace function private.organisation_ai_credit_period_bounds(
  target_organisation_id uuid,
  target_at timestamptz default statement_timestamp()
)
returns table (
  period_start timestamptz,
  period_end timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  anchor_day integer;
  at_month date;
begin
  select settings.credit_period_anchor_day
  into anchor_day
  from public.organisation_ai_settings settings
  where settings.organisation_id = target_organisation_id;

  anchor_day := coalesce(anchor_day, 1);
  at_month := date_trunc('month', target_at at time zone 'utc')::date;

  period_start := (
    at_month
    + make_interval(days => anchor_day - 1)
  )::timestamptz at time zone 'utc';

  if target_at < period_start then
    period_start := period_start - interval '1 month';
  end if;

  period_end := period_start + interval '1 month';

  return next;
end;
$$;

create or replace function private.organisation_ai_credit_allowance_for_period(
  target_organisation_id uuid
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sub public.organisation_subscriptions%rowtype;
  sites integer := 1;
  per_site bigint := 30000;
begin
  select subscription.*
  into sub
  from public.organisation_subscriptions subscription
  where subscription.organisation_id = target_organisation_id;

  if sub.id is not null and sub.site_quantity is not null then
    sites := greatest(sub.site_quantity, 1);
  end if;

  if sub.plan_code is null
    or sub.plan_code in ('professional', 'founder', 'enterprise') then
    per_site := 120000;
  elsif sub.plan_code = 'essentials' then
    per_site := 30000;
  end if;

  return per_site * sites;
end;
$$;

create or replace function private.ensure_organisation_ai_credit_period(
  target_organisation_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  bounds record;
  period_id uuid;
  allowance bigint;
begin
  select *
  into bounds
  from private.organisation_ai_credit_period_bounds(target_organisation_id);

  select period_table.id
  into period_id
  from public.organisation_ai_credit_periods period_table
  where period_table.organisation_id = target_organisation_id
    and period_table.period_start = bounds.period_start;

  if period_id is not null then
    return period_id;
  end if;

  allowance := private.organisation_ai_credit_allowance_for_period(
    target_organisation_id
  );

  insert into public.organisation_ai_credit_periods (
    organisation_id,
    period_start,
    period_end,
    allowance_credits
  )
  values (
    target_organisation_id,
    bounds.period_start,
    bounds.period_end,
    allowance
  )
  returning id into period_id;

  return period_id;
end;
$$;

create or replace function private.ai_credit_try_reserve(
  target_ai_run_id uuid,
  target_idempotency_key text,
  target_estimated_credits bigint default 1
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  period_id uuid;
  period_row public.organisation_ai_credit_periods%rowtype;
  existing uuid;
begin
  if org_id is null then
    return false;
  end if;

  if not private.leanai_credit_policy_enforced(org_id) then
    return true;
  end if;

  period_id := private.ensure_organisation_ai_credit_period(org_id);

  select reservation.id
  into existing
  from public.organisation_ai_credit_reservations reservation
  where reservation.organisation_id = org_id
    and reservation.idempotency_key = btrim(target_idempotency_key);

  if existing is not null then
    return true;
  end if;

  select period_table.*
  into period_row
  from public.organisation_ai_credit_periods period_table
  where period_table.id = period_id
  for update;

  if period_row.reserved_credits + period_row.consumed_credits + target_estimated_credits
    > period_row.allowance_credits then
    raise exception 'leanai credit allowance exceeded for this period'
      using errcode = '42501';
  end if;

  update public.organisation_ai_credit_periods period_table
  set reserved_credits = period_table.reserved_credits + target_estimated_credits
  where period_table.id = period_id;

  insert into public.organisation_ai_credit_reservations (
    organisation_id,
    ai_run_id,
    period_id,
    reserved_credits,
    idempotency_key
  )
  values (
    org_id,
    target_ai_run_id,
    period_id,
    target_estimated_credits,
    btrim(target_idempotency_key)
  );

  return true;
end;
$$;

create or replace function private.ai_credit_settle(
  target_ai_run_id uuid,
  target_actual_credits bigint
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  reservation_row public.organisation_ai_credit_reservations%rowtype;
  delta bigint;
begin
  if org_id is null then
    return;
  end if;

  if not private.leanai_credit_policy_enforced(org_id) then
    return;
  end if;

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = org_id
    and reservation_table.ai_run_id = target_ai_run_id
  for update;

  if not found or reservation_row.status <> 'reserved' then
    return;
  end if;

  delta := target_actual_credits - reservation_row.reserved_credits;

  update public.organisation_ai_credit_periods period_table
  set reserved_credits = period_table.reserved_credits - reservation_row.reserved_credits,
      consumed_credits = period_table.consumed_credits + target_actual_credits
  where period_table.id = reservation_row.period_id;

  update public.organisation_ai_credit_reservations reservation_table
  set status = 'settled',
      settled_credits = target_actual_credits,
      settled_at = statement_timestamp()
  where reservation_table.id = reservation_row.id;
end;
$$;

create or replace function private.ai_credit_release(
  target_ai_run_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  reservation_row public.organisation_ai_credit_reservations%rowtype;
begin
  if org_id is null then
    return;
  end if;

  if not private.leanai_credit_policy_enforced(org_id) then
    return;
  end if;

  select reservation_table.*
  into reservation_row
  from public.organisation_ai_credit_reservations reservation_table
  where reservation_table.organisation_id = org_id
    and reservation_table.ai_run_id = target_ai_run_id
    and reservation_table.status = 'reserved'
  for update;

  if not found then
    return;
  end if;

  update public.organisation_ai_credit_periods period_table
  set reserved_credits = greatest(
    0,
    period_table.reserved_credits - reservation_row.reserved_credits
  )
  where period_table.id = reservation_row.period_id;

  update public.organisation_ai_credit_reservations reservation_table
  set status = 'released',
      settled_at = statement_timestamp()
  where reservation_table.id = reservation_row.id;
end;
$$;

revoke all on function private.leanai_credit_policy_enforced(uuid) from public, anon, authenticated, service_role;
revoke all on function private.organisation_ai_credit_period_bounds(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.organisation_ai_credit_allowance_for_period(uuid) from public, anon, authenticated, service_role;
revoke all on function private.ensure_organisation_ai_credit_period(uuid) from public, anon, authenticated, service_role;
revoke all on function private.ai_credit_try_reserve(uuid, text, bigint) from public, anon, authenticated, service_role;
revoke all on function private.ai_credit_settle(uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function private.ai_credit_release(uuid) from public, anon, authenticated, service_role;

grant execute on function private.leanai_credit_policy_enforced(uuid) to lean_hub_private_owner;
grant execute on function private.organisation_ai_credit_period_bounds(uuid, timestamptz) to lean_hub_private_owner;
grant execute on function private.organisation_ai_credit_allowance_for_period(uuid) to lean_hub_private_owner;
grant execute on function private.ensure_organisation_ai_credit_period(uuid) to lean_hub_private_owner;
grant execute on function private.ai_credit_try_reserve(uuid, text, bigint) to lean_hub_private_owner;
grant execute on function private.ai_credit_settle(uuid, bigint) to lean_hub_private_owner;
grant execute on function private.ai_credit_release(uuid) to lean_hub_private_owner;

alter function private.leanai_credit_policy_enforced(uuid) owner to lean_hub_private_owner;
alter function private.organisation_ai_credit_period_bounds(uuid, timestamptz) owner to lean_hub_private_owner;
alter function private.organisation_ai_credit_allowance_for_period(uuid) owner to lean_hub_private_owner;
alter function private.ensure_organisation_ai_credit_period(uuid) owner to lean_hub_private_owner;
alter function private.ai_credit_try_reserve(uuid, text, bigint) owner to lean_hub_private_owner;
alter function private.ai_credit_settle(uuid, bigint) owner to lean_hub_private_owner;
alter function private.ai_credit_release(uuid) owner to lean_hub_private_owner;
