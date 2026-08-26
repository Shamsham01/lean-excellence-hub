-- Milestone 10: benefit forecast versions, periods, lifecycle RPCs, and immutability.

create table public.benefit_forecast_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  benefit_id uuid not null,
  version_number integer not null,
  lifecycle text not null default 'draft',
  realisation_pattern text not null,
  forecast_start_date date not null,
  forecast_end_date date not null,
  forecast_total_amount numeric,
  calculation_basis text,
  assumptions text,
  target_measure_value numeric,
  target_measure_unit text,
  target_date date,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by_membership_id uuid,
  constraint benefit_forecast_versions_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_forecast_versions_benefit_version_key
    unique (organisation_id, benefit_id, version_number),
  constraint benefit_forecast_versions_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_forecast_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_forecast_versions_approver_fkey
    foreign key (organisation_id, approved_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_forecast_versions_lifecycle_check
    check (lifecycle in ('draft', 'submitted', 'approved', 'superseded')),
  constraint benefit_forecast_versions_realisation_pattern_check
    check (realisation_pattern in ('one_off', 'recurring')),
  constraint benefit_forecast_versions_version_number_check
    check (version_number > 0),
  constraint benefit_forecast_versions_date_range_check
    check (forecast_end_date >= forecast_start_date),
  constraint benefit_forecast_versions_target_measure_unit_check
    check (
      target_measure_unit is null
      or (
        target_measure_unit = btrim(target_measure_unit)
        and char_length(target_measure_unit) between 1 and 80
      )
    )
);

create table public.benefit_forecast_periods (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  forecast_version_id uuid not null,
  period_start date not null,
  period_end date not null,
  forecast_amount numeric not null,
  display_order integer not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint benefit_forecast_periods_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_forecast_periods_version_order_key
    unique (organisation_id, forecast_version_id, display_order),
  constraint benefit_forecast_periods_version_fkey
    foreign key (organisation_id, forecast_version_id)
    references public.benefit_forecast_versions(organisation_id, id)
    on delete restrict,
  constraint benefit_forecast_periods_date_range_check
    check (period_end >= period_start),
  constraint benefit_forecast_periods_display_order_check
    check (display_order > 0)
);

alter table public.improvement_benefits
  add constraint improvement_benefits_current_forecast_version_fkey
    foreign key (organisation_id, current_forecast_version_id)
    references public.benefit_forecast_versions(organisation_id, id)
    on delete restrict;

create or replace function private.guard_benefit_forecast_version_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.lifecycle in ('submitted', 'approved', 'superseded') then
      raise exception 'forecast version cannot be deleted'
        using errcode = '55000';
    end if;

    return old;
  end if;

  if old.lifecycle = 'superseded' then
    raise exception 'superseded forecast version is immutable'
      using errcode = '55000';
  end if;

  if old.lifecycle = 'approved' then
    if new.lifecycle = 'superseded'
      and new.organisation_id = old.organisation_id
      and new.benefit_id = old.benefit_id
      and new.version_number = old.version_number
      and new.realisation_pattern = old.realisation_pattern
      and new.forecast_start_date = old.forecast_start_date
      and new.forecast_end_date = old.forecast_end_date
      and new.forecast_total_amount is not distinct from old.forecast_total_amount
      and new.calculation_basis is not distinct from old.calculation_basis
      and new.assumptions is not distinct from old.assumptions
      and new.target_measure_value is not distinct from old.target_measure_value
      and new.target_measure_unit is not distinct from old.target_measure_unit
      and new.target_date is not distinct from old.target_date
      and new.created_by_membership_id = old.created_by_membership_id
      and new.created_at = old.created_at
      and new.submitted_at is not distinct from old.submitted_at
      and new.approved_at is not distinct from old.approved_at
      and new.approved_by_membership_id is not distinct from old.approved_by_membership_id then
      return new;
    end if;

    raise exception 'approved forecast version is immutable'
      using errcode = '55000';
  end if;

  if old.lifecycle = 'submitted' then
    if new.lifecycle = 'approved'
      and new.organisation_id = old.organisation_id
      and new.benefit_id = old.benefit_id
      and new.version_number = old.version_number
      and new.realisation_pattern = old.realisation_pattern
      and new.forecast_start_date = old.forecast_start_date
      and new.forecast_end_date = old.forecast_end_date
      and new.forecast_total_amount is not distinct from old.forecast_total_amount
      and new.calculation_basis is not distinct from old.calculation_basis
      and new.assumptions is not distinct from old.assumptions
      and new.target_measure_value is not distinct from old.target_measure_value
      and new.target_measure_unit is not distinct from old.target_measure_unit
      and new.target_date is not distinct from old.target_date
      and new.created_by_membership_id = old.created_by_membership_id
      and new.created_at = old.created_at
      and new.submitted_at is not distinct from old.submitted_at
      and new.approved_by_membership_id is not null
      and new.approved_at is not null then
      return new;
    end if;

    raise exception 'submitted forecast version is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function private.guard_benefit_forecast_period_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_lifecycle text;
  target_version_id uuid;
  target_organisation_id uuid;
begin
  if tg_op = 'DELETE' then
    target_version_id := old.forecast_version_id;
    target_organisation_id := old.organisation_id;
  else
    target_version_id := new.forecast_version_id;
    target_organisation_id := new.organisation_id;
  end if;

  select version_table.lifecycle
  into parent_lifecycle
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = target_organisation_id
    and version_table.id = target_version_id;

  if parent_lifecycle is distinct from 'draft' then
    raise exception 'forecast periods are immutable unless version is draft'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger benefit_forecast_versions_guard_immutable
before update or delete on public.benefit_forecast_versions
for each row execute function private.guard_benefit_forecast_version_immutable();

create trigger benefit_forecast_versions_prevent_org_change
before update on public.benefit_forecast_versions
for each row execute function private.prevent_organisation_id_change();

create trigger benefit_forecast_periods_guard_immutable
before insert or update or delete on public.benefit_forecast_periods
for each row execute function private.guard_benefit_forecast_period_immutable();

create trigger benefit_forecast_periods_prevent_org_change
before update on public.benefit_forecast_periods
for each row execute function private.prevent_organisation_id_change();

create index benefit_forecast_versions_benefit_lifecycle_idx
  on public.benefit_forecast_versions (organisation_id, benefit_id, lifecycle);
create index benefit_forecast_periods_version_order_idx
  on public.benefit_forecast_periods (organisation_id, forecast_version_id, display_order);

alter table public.benefit_forecast_versions enable row level security;
alter table public.benefit_forecast_versions force row level security;
alter table public.benefit_forecast_periods enable row level security;
alter table public.benefit_forecast_periods force row level security;

revoke all on public.benefit_forecast_versions from public, anon, authenticated, service_role;
revoke all on public.benefit_forecast_periods from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.benefit_forecast_versions to lean_hub_private_owner;
grant select, insert, update, delete on public.benefit_forecast_periods to lean_hub_private_owner;

create policy private_owner_all_benefit_forecast_versions
on public.benefit_forecast_versions for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_benefit_forecast_periods
on public.benefit_forecast_periods for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.assert_benefit_forecast_period_integrity(
  target_forecast_version_id uuid,
  target_organisation_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  period_sum numeric;
begin
  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = target_organisation_id
    and version_table.id = target_forecast_version_id;

  if not found then
    raise exception 'forecast version was not found'
      using errcode = 'P0002';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = target_organisation_id
    and benefit_table.id = version_row.benefit_id;

  if benefit_row.benefit_class <> 'financial' then
    return;
  end if;

  if version_row.forecast_total_amount is null then
    raise exception 'financial benefit forecast requires total amount'
      using errcode = '22023';
  end if;

  select coalesce(sum(period_table.forecast_amount), 0)
  into period_sum
  from public.benefit_forecast_periods period_table
  where period_table.organisation_id = target_organisation_id
    and period_table.forecast_version_id = target_forecast_version_id;

  if abs(period_sum - version_row.forecast_total_amount) > 0.01 then
    raise exception 'forecast period totals do not match forecast total'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.create_benefit_forecast_draft(
  target_benefit_id uuid,
  target_realisation_pattern text,
  target_forecast_start_date date,
  target_forecast_end_date date,
  target_forecast_total_amount numeric default null,
  target_calculation_basis text default null,
  target_assumptions text default null,
  target_target_measure_value numeric default null,
  target_target_measure_unit text default null,
  target_target_date date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  benefit_row public.improvement_benefits%rowtype;
  next_version_number integer;
  new_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast draft creation is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast draft creation is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.benefit_forecast_versions version_table
    where version_table.organisation_id = org_id
      and version_table.benefit_id = target_benefit_id
      and version_table.lifecycle = 'draft'
  ) then
    raise exception 'benefit already has a draft forecast version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.benefit_forecast_versions version_table
    where version_table.organisation_id = org_id
      and version_table.benefit_id = target_benefit_id
      and version_table.lifecycle = 'approved'
  ) then
    raise exception 'approved forecast exists; use successor version creation'
      using errcode = '55000';
  end if;

  select coalesce(max(version_table.version_number), 0) + 1
  into next_version_number
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.benefit_id = target_benefit_id;

  insert into public.benefit_forecast_versions (
    organisation_id,
    benefit_id,
    version_number,
    lifecycle,
    realisation_pattern,
    forecast_start_date,
    forecast_end_date,
    forecast_total_amount,
    calculation_basis,
    assumptions,
    target_measure_value,
    target_measure_unit,
    target_date,
    created_by_membership_id
  )
  values (
    org_id,
    target_benefit_id,
    next_version_number,
    'draft',
    target_realisation_pattern,
    target_forecast_start_date,
    target_forecast_end_date,
    target_forecast_total_amount,
    target_calculation_basis,
    target_assumptions,
    target_target_measure_value,
    case
      when target_target_measure_unit is null then null
      else btrim(target_target_measure_unit)
    end,
    target_target_date,
    actor_membership_id
  )
  returning id into new_version_id;

  update public.improvement_benefits benefit_table
  set current_forecast_version_id = new_version_id,
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_business_audit(
    org_id,
    'benefit_forecast.draft_created',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('forecast_version_id', new_version_id)
  );

  return new_version_id;
end;
$$;

create or replace function private.update_benefit_forecast_draft(
  target_forecast_version_id uuid,
  target_realisation_pattern text,
  target_forecast_start_date date,
  target_forecast_end_date date,
  target_forecast_total_amount numeric default null,
  target_calculation_basis text default null,
  target_assumptions text default null,
  target_target_measure_value numeric default null,
  target_target_measure_unit text default null,
  target_target_date date default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast draft update is not authorised'
      using errcode = '42501';
  end if;

  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id
  for update;

  if not found or version_row.lifecycle <> 'draft' then
    raise exception 'forecast version is not editable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id
  for update;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast draft update is not authorised'
      using errcode = '42501';
  end if;

  update public.benefit_forecast_versions version_table
  set realisation_pattern = target_realisation_pattern,
      forecast_start_date = target_forecast_start_date,
      forecast_end_date = target_forecast_end_date,
      forecast_total_amount = target_forecast_total_amount,
      calculation_basis = target_calculation_basis,
      assumptions = target_assumptions,
      target_measure_value = target_target_measure_value,
      target_measure_unit = case
        when target_target_measure_unit is null then null
        else btrim(target_target_measure_unit)
      end,
      target_date = target_target_date
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id;

  return true;
end;
$$;

create or replace function private.replace_benefit_forecast_periods(
  target_forecast_version_id uuid,
  target_periods jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  period_row jsonb;
  period_start_value date;
  period_end_value date;
  forecast_amount_value numeric;
  display_order_value integer;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast period replacement is not authorised'
      using errcode = '42501';
  end if;

  if target_periods is null
    or pg_catalog.jsonb_typeof(target_periods) <> 'array' then
    raise exception 'forecast periods must be a JSON array'
      using errcode = '22023';
  end if;

  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id
  for update;

  if not found or version_row.lifecycle <> 'draft' then
    raise exception 'forecast version is not editable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id
  for update;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast period replacement is not authorised'
      using errcode = '42501';
  end if;

  delete from public.benefit_forecast_periods period_table
  where period_table.organisation_id = org_id
    and period_table.forecast_version_id = target_forecast_version_id;

  for period_row in
    select value
    from jsonb_array_elements(target_periods)
  loop
    period_start_value := (period_row ->> 'period_start')::date;
    period_end_value := (period_row ->> 'period_end')::date;
    forecast_amount_value := (period_row ->> 'forecast_amount')::numeric;
    display_order_value := (period_row ->> 'display_order')::integer;

    if period_start_value is null
      or period_end_value is null
      or forecast_amount_value is null
      or display_order_value is null then
      raise exception 'forecast period payload is incomplete'
        using errcode = '22023';
    end if;

    insert into public.benefit_forecast_periods (
      organisation_id,
      forecast_version_id,
      period_start,
      period_end,
      forecast_amount,
      display_order
    )
    values (
      org_id,
      target_forecast_version_id,
      period_start_value,
      period_end_value,
      forecast_amount_value,
      display_order_value
    );
  end loop;

  return true;
end;
$$;

create or replace function private.submit_benefit_forecast(
  target_forecast_version_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast submit is not authorised'
      using errcode = '42501';
  end if;

  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id
  for update;

  if not found or version_row.lifecycle <> 'draft' then
    raise exception 'forecast version is not submittable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id
  for update;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_forecast_period_integrity(
    target_forecast_version_id,
    org_id
  );

  update public.benefit_forecast_versions version_table
  set lifecycle = 'submitted',
      submitted_at = statement_timestamp()
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id;

  update public.improvement_benefits benefit_table
  set current_forecast_version_id = target_forecast_version_id,
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id;

  perform private.append_business_audit(
    org_id,
    'benefit_forecast.submitted',
    version_row.benefit_id,
    'succeeded',
    jsonb_build_object('forecast_version_id', target_forecast_version_id)
  );

  return true;
end;
$$;

create or replace function private.approve_benefit_forecast(
  target_forecast_version_id uuid,
  target_approved_by_membership_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := coalesce(
    target_approved_by_membership_id,
    private.current_membership_id(org_id)
  );
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast approval is not authorised'
      using errcode = '42501';
  end if;

  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id
  for update;

  if not found or version_row.lifecycle <> 'submitted' then
    raise exception 'forecast version is not approvable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id
  for update;

  perform private.assert_benefit_forecast_period_integrity(
    target_forecast_version_id,
    org_id
  );

  update public.benefit_forecast_versions prior_version
  set lifecycle = 'superseded'
  where prior_version.organisation_id = org_id
    and prior_version.benefit_id = version_row.benefit_id
    and prior_version.lifecycle = 'approved'
    and prior_version.id <> target_forecast_version_id;

  update public.benefit_forecast_versions version_table
  set lifecycle = 'approved',
      approved_at = statement_timestamp(),
      approved_by_membership_id = actor_membership_id
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id;

  update public.improvement_benefits benefit_table
  set current_forecast_version_id = target_forecast_version_id,
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id;

  perform private.append_business_audit(
    org_id,
    'benefit_forecast.approved',
    version_row.benefit_id,
    'succeeded',
    jsonb_build_object('forecast_version_id', target_forecast_version_id)
  );

  return true;
end;
$$;

create or replace function private.create_benefit_forecast_successor_version(
  target_benefit_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  benefit_row public.improvement_benefits%rowtype;
  source_version_id uuid;
  source_version_number integer;
  new_version_id uuid;
  period_row record;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast successor creation is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast successor creation is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.benefit_forecast_versions version_table
    where version_table.organisation_id = org_id
      and version_table.benefit_id = target_benefit_id
      and version_table.lifecycle = 'draft'
  ) then
    raise exception 'benefit already has a draft forecast version'
      using errcode = '55000';
  end if;

  select version_table.id, version_table.version_number
  into source_version_id, source_version_number
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.benefit_id = target_benefit_id
    and version_table.lifecycle = 'approved'
  order by version_table.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception 'benefit has no approved forecast version'
      using errcode = '55000';
  end if;

  insert into public.benefit_forecast_versions (
    organisation_id,
    benefit_id,
    version_number,
    lifecycle,
    realisation_pattern,
    forecast_start_date,
    forecast_end_date,
    forecast_total_amount,
    calculation_basis,
    assumptions,
    target_measure_value,
    target_measure_unit,
    target_date,
    created_by_membership_id
  )
  select
    org_id,
    target_benefit_id,
    source_version_number + 1,
    'draft',
    source_version.realisation_pattern,
    source_version.forecast_start_date,
    source_version.forecast_end_date,
    source_version.forecast_total_amount,
    source_version.calculation_basis,
    source_version.assumptions,
    source_version.target_measure_value,
    source_version.target_measure_unit,
    source_version.target_date,
    actor_membership_id
  from public.benefit_forecast_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_version_id;

  for period_row in
    select
      period_table.period_start,
      period_table.period_end,
      period_table.forecast_amount,
      period_table.display_order
    from public.benefit_forecast_periods period_table
    where period_table.organisation_id = org_id
      and period_table.forecast_version_id = source_version_id
    order by period_table.display_order
  loop
    insert into public.benefit_forecast_periods (
      organisation_id,
      forecast_version_id,
      period_start,
      period_end,
      forecast_amount,
      display_order
    )
    values (
      org_id,
      new_version_id,
      period_row.period_start,
      period_row.period_end,
      period_row.forecast_amount,
      period_row.display_order
    );
  end loop;

  perform private.append_business_audit(
    org_id,
    'benefit_forecast.successor_created',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('forecast_version_id', new_version_id)
  );

  return new_version_id;
end;
$$;

create policy benefit_forecast_versions_select
on public.benefit_forecast_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, benefit_id)
);

create policy benefit_forecast_periods_select
on public.benefit_forecast_periods for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.benefit_forecast_versions version_table
    where version_table.organisation_id = benefit_forecast_periods.organisation_id
      and version_table.id = benefit_forecast_periods.forecast_version_id
      and private.can_read_improvement_benefit(
        version_table.organisation_id,
        version_table.benefit_id
      )
  )
);

grant select on public.benefit_forecast_versions to authenticated;
grant select on public.benefit_forecast_periods to authenticated;

create or replace function public.create_benefit_forecast_draft(
  target_benefit_id uuid,
  target_realisation_pattern text,
  target_forecast_start_date date,
  target_forecast_end_date date,
  target_forecast_total_amount numeric default null,
  target_calculation_basis text default null,
  target_assumptions text default null,
  target_target_measure_value numeric default null,
  target_target_measure_unit text default null,
  target_target_date date default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_benefit_forecast_draft(
  target_benefit_id,
  target_realisation_pattern,
  target_forecast_start_date,
  target_forecast_end_date,
  target_forecast_total_amount,
  target_calculation_basis,
  target_assumptions,
  target_target_measure_value,
  target_target_measure_unit,
  target_target_date
) $$;

create or replace function public.update_benefit_forecast_draft(
  target_forecast_version_id uuid,
  target_realisation_pattern text,
  target_forecast_start_date date,
  target_forecast_end_date date,
  target_forecast_total_amount numeric default null,
  target_calculation_basis text default null,
  target_assumptions text default null,
  target_target_measure_value numeric default null,
  target_target_measure_unit text default null,
  target_target_date date default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.update_benefit_forecast_draft(
  target_forecast_version_id,
  target_realisation_pattern,
  target_forecast_start_date,
  target_forecast_end_date,
  target_forecast_total_amount,
  target_calculation_basis,
  target_assumptions,
  target_target_measure_value,
  target_target_measure_unit,
  target_target_date
) $$;

create or replace function public.replace_benefit_forecast_periods(
  target_forecast_version_id uuid,
  target_periods jsonb
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.replace_benefit_forecast_periods(
  target_forecast_version_id,
  target_periods
) $$;

create or replace function public.submit_benefit_forecast(target_forecast_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.submit_benefit_forecast(target_forecast_version_id) $$;

create or replace function public.approve_benefit_forecast(target_forecast_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.approve_benefit_forecast(target_forecast_version_id) $$;

create or replace function public.create_benefit_forecast_successor_version(target_benefit_id uuid)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_benefit_forecast_successor_version(target_benefit_id) $$;

grant execute on function public.create_benefit_forecast_draft(
  uuid, text, date, date, numeric, text, text, numeric, text, date
) to authenticated;
grant execute on function public.update_benefit_forecast_draft(
  uuid, text, date, date, numeric, text, text, numeric, text, date
) to authenticated;
grant execute on function public.replace_benefit_forecast_periods(uuid, jsonb) to authenticated;
grant execute on function public.submit_benefit_forecast(uuid) to authenticated;
grant execute on function public.approve_benefit_forecast(uuid) to authenticated;
grant execute on function public.create_benefit_forecast_successor_version(uuid) to authenticated;

revoke all on function public.create_benefit_forecast_draft(
  uuid, text, date, date, numeric, text, text, numeric, text, date
) from public, anon;
revoke all on function public.update_benefit_forecast_draft(
  uuid, text, date, date, numeric, text, text, numeric, text, date
) from public, anon;
revoke all on function public.replace_benefit_forecast_periods(uuid, jsonb) from public, anon;
revoke all on function public.submit_benefit_forecast(uuid) from public, anon;
revoke all on function public.approve_benefit_forecast(uuid) from public, anon;
revoke all on function public.create_benefit_forecast_successor_version(uuid) from public, anon;

alter function private.guard_benefit_forecast_version_immutable() owner to lean_hub_private_owner;
alter function private.guard_benefit_forecast_period_immutable() owner to lean_hub_private_owner;
alter function private.assert_benefit_forecast_period_integrity(uuid, uuid) owner to lean_hub_private_owner;
alter function private.create_benefit_forecast_draft(
  uuid, text, date, date, numeric, text, text, numeric, text, date
) owner to lean_hub_private_owner;
alter function private.update_benefit_forecast_draft(
  uuid, text, date, date, numeric, text, text, numeric, text, date
) owner to lean_hub_private_owner;
alter function private.replace_benefit_forecast_periods(uuid, jsonb) owner to lean_hub_private_owner;
alter function private.submit_benefit_forecast(uuid) owner to lean_hub_private_owner;
alter function private.approve_benefit_forecast(uuid, uuid) owner to lean_hub_private_owner;
alter function private.create_benefit_forecast_successor_version(uuid) owner to lean_hub_private_owner;
