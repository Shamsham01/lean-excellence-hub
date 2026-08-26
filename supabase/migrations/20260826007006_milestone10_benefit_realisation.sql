-- Milestone 10: benefit realisation entries, lifecycle RPCs, validated totals, and immutability.

create table public.benefit_realisation_entries (
  id uuid primary key,
  organisation_id uuid not null,
  benefit_id uuid not null,
  period_start date not null,
  period_end date not null,
  financial_amount numeric,
  measure_value numeric,
  measure_unit text,
  entry_kind text not null default 'original',
  data_source text,
  notes text,
  status text not null default 'draft',
  recorded_by_membership_id uuid not null,
  recorded_at timestamptz not null default statement_timestamp(),
  submitted_at timestamptz,
  validated_by_membership_id uuid,
  validated_at timestamptz,
  adjustment_of_entry_id uuid,
  is_correction boolean not null default false,
  constraint benefit_realisation_entries_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_realisation_entries_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint benefit_realisation_entries_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_realisation_entries_recorder_fkey
    foreign key (organisation_id, recorded_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_realisation_entries_validator_fkey
    foreign key (organisation_id, validated_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_realisation_entries_adjustment_parent_fkey
    foreign key (organisation_id, adjustment_of_entry_id)
    references public.benefit_realisation_entries(organisation_id, id)
    on delete restrict,
  constraint benefit_realisation_entries_period_check
    check (period_end >= period_start),
  constraint benefit_realisation_entries_entry_kind_check
    check (entry_kind in ('original', 'adjustment')),
  constraint benefit_realisation_entries_status_check
    check (status in ('draft', 'submitted', 'validated', 'rejected')),
  constraint benefit_realisation_entries_kind_parent_check
    check (
      (
        entry_kind = 'original'
        and adjustment_of_entry_id is null
      )
      or (
        entry_kind = 'adjustment'
        and adjustment_of_entry_id is not null
      )
    ),
  constraint benefit_realisation_entries_measure_unit_check
    check (
      measure_unit is null
      or (
        measure_unit = btrim(measure_unit)
        and char_length(measure_unit) between 1 and 80
      )
    ),
  constraint benefit_realisation_entries_notes_check
    check (notes is null or char_length(notes) <= 8000),
  constraint benefit_realisation_entries_data_source_check
    check (
      data_source is null
      or (
        data_source = btrim(data_source)
        and char_length(data_source) between 1 and 160
      )
    )
);

create or replace function private.benefit_allows_realisation_recording(target_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_status in ('approved', 'realising', 'realised')
$$;

create or replace function private.guard_benefit_realisation_entry_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('submitted', 'validated', 'rejected') then
      raise exception 'realisation entry cannot be deleted'
        using errcode = '55000';
    end if;

    return old;
  end if;

  if old.status = 'validated' then
    raise exception 'validated realisation entry is immutable'
      using errcode = '55000';
  end if;

  if old.status = 'rejected' then
    raise exception 'rejected realisation entry is immutable'
      using errcode = '55000';
  end if;

  if old.status = 'submitted' then
    if new.status = 'validated'
      and new.organisation_id = old.organisation_id
      and new.benefit_id = old.benefit_id
      and new.period_start = old.period_start
      and new.period_end = old.period_end
      and new.financial_amount is not distinct from old.financial_amount
      and new.measure_value is not distinct from old.measure_value
      and new.measure_unit is not distinct from old.measure_unit
      and new.entry_kind = old.entry_kind
      and new.data_source is not distinct from old.data_source
      and new.notes is not distinct from old.notes
      and new.recorded_by_membership_id = old.recorded_by_membership_id
      and new.recorded_at = old.recorded_at
      and new.submitted_at is not distinct from old.submitted_at
      and new.validated_by_membership_id is not null
      and new.validated_at is not null
      and new.adjustment_of_entry_id is not distinct from old.adjustment_of_entry_id
      and new.is_correction = old.is_correction then
      return new;
    end if;

    if new.status = 'rejected'
      and new.organisation_id = old.organisation_id
      and new.benefit_id = old.benefit_id
      and new.period_start = old.period_start
      and new.period_end = old.period_end
      and new.financial_amount is not distinct from old.financial_amount
      and new.measure_value is not distinct from old.measure_value
      and new.measure_unit is not distinct from old.measure_unit
      and new.entry_kind = old.entry_kind
      and new.data_source is not distinct from old.data_source
      and new.recorded_by_membership_id = old.recorded_by_membership_id
      and new.recorded_at = old.recorded_at
      and new.submitted_at is not distinct from old.submitted_at
      and new.validated_by_membership_id is null
      and new.validated_at is null
      and new.adjustment_of_entry_id is not distinct from old.adjustment_of_entry_id
      and new.is_correction = old.is_correction then
      return new;
    end if;

    raise exception 'submitted realisation entry is immutable'
      using errcode = '55000';
  end if;

  if old.entry_kind is distinct from new.entry_kind
    or old.adjustment_of_entry_id is distinct from new.adjustment_of_entry_id
    or old.benefit_id is distinct from new.benefit_id
    or old.recorded_by_membership_id is distinct from new.recorded_by_membership_id
    or old.recorded_at is distinct from new.recorded_at then
    raise exception 'realisation entry identity fields are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger benefit_realisation_entries_guard_immutable
before update or delete on public.benefit_realisation_entries
for each row execute function private.guard_benefit_realisation_entry_immutable();

create trigger benefit_realisation_entries_prevent_org_change
before update on public.benefit_realisation_entries
for each row execute function private.prevent_organisation_id_change();

create index benefit_realisation_entries_benefit_status_idx
  on public.benefit_realisation_entries (organisation_id, benefit_id, status);
create index benefit_realisation_entries_benefit_period_idx
  on public.benefit_realisation_entries (organisation_id, benefit_id, period_start);
create index benefit_realisation_entries_adjustment_parent_idx
  on public.benefit_realisation_entries (organisation_id, adjustment_of_entry_id);

alter table public.benefit_realisation_entries enable row level security;
alter table public.benefit_realisation_entries force row level security;

revoke all on public.benefit_realisation_entries from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.benefit_realisation_entries to lean_hub_private_owner;

create policy private_owner_all_benefit_realisation_entries
on public.benefit_realisation_entries for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.can_record_benefit_realisation(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.realisation.record',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.realisation.record',
    null,
    target_unit_id
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.realisation.record',
    private.current_membership_id(target_organisation_id),
    null
  )
$$;

create or replace function private.can_validate_benefit_realisation(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.realisation.validate',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.realisation.validate',
    null,
    target_unit_id
  )
$$;

create or replace function private.assert_benefit_realisation_entry_payload(
  target_benefit_row public.improvement_benefits,
  target_financial_amount numeric,
  target_measure_value numeric,
  target_measure_unit text,
  target_entry_kind text,
  target_is_correction boolean
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if target_benefit_row.benefit_class = 'financial' then
    if target_financial_amount is null then
      raise exception 'financial benefit realisation requires financial amount'
        using errcode = '22023';
    end if;

    if target_measure_value is not null or target_measure_unit is not null then
      raise exception 'financial benefit realisation cannot include measure values'
        using errcode = '22023';
    end if;
  elsif target_benefit_row.benefit_class = 'non_financial' then
    if target_measure_value is null then
      raise exception 'non-financial benefit realisation requires measure value'
        using errcode = '22023';
    end if;

    if target_financial_amount is not null then
      raise exception 'non-financial benefit realisation cannot include financial amount'
        using errcode = '22023';
    end if;
  else
    raise exception 'invalid benefit class'
      using errcode = '22023';
  end if;

  if target_entry_kind = 'adjustment' and target_is_correction
    and (
      (target_benefit_row.benefit_class = 'financial' and target_financial_amount >= 0)
      or (target_benefit_row.benefit_class = 'non_financial' and target_measure_value >= 0)
    ) then
    raise exception 'correction adjustments require a negative signed delta'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.get_benefit_validated_realised_total(
  target_benefit_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(entry_table.financial_amount), 0)
  from public.benefit_realisation_entries entry_table
  where entry_table.benefit_id = target_benefit_id
    and entry_table.status = 'validated'
$$;

create or replace function private.create_benefit_realisation_entry(
  target_benefit_id uuid,
  target_period_start date,
  target_period_end date,
  target_financial_amount numeric default null,
  target_measure_value numeric default null,
  target_measure_unit text default null,
  target_data_source text default null,
  target_notes text default null
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
  new_entry_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation entry creation is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.benefit_allows_realisation_recording(benefit_row.status) then
    raise exception 'benefit is not in a realisation-recording status'
      using errcode = '55000';
  end if;

  if not private.can_record_benefit_realisation(
    org_id,
    benefit_row.organisational_unit_id
  ) then
    raise exception 'benefit realisation entry creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_realisation_entry_payload(
    benefit_row,
    target_financial_amount,
    target_measure_value,
    target_measure_unit,
    'original',
    false
  );

  new_entry_id := private.register_resource_record(
    org_id,
    'benefit_realisation_entry',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.benefit_realisation_entries (
    id,
    organisation_id,
    benefit_id,
    period_start,
    period_end,
    financial_amount,
    measure_value,
    measure_unit,
    entry_kind,
    data_source,
    notes,
    status,
    recorded_by_membership_id,
    recorded_at
  )
  values (
    new_entry_id,
    org_id,
    target_benefit_id,
    target_period_start,
    target_period_end,
    target_financial_amount,
    target_measure_value,
    case
      when target_measure_unit is null then null
      else btrim(target_measure_unit)
    end,
    'original',
    case
      when target_data_source is null then null
      else btrim(target_data_source)
    end,
    target_notes,
    'draft',
    actor_membership_id,
    statement_timestamp()
  );

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.entry_created',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('entry_id', new_entry_id, 'entry_kind', 'original')
  );

  return new_entry_id;
end;
$$;

create or replace function private.create_benefit_realisation_adjustment(
  target_parent_entry_id uuid,
  target_financial_amount numeric default null,
  target_measure_value numeric default null,
  target_measure_unit text default null,
  target_period_start date default null,
  target_period_end date default null,
  target_data_source text default null,
  target_notes text default null,
  target_is_correction boolean default false
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
  parent_row public.benefit_realisation_entries%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  new_entry_id uuid;
  resolved_period_start date;
  resolved_period_end date;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation adjustment creation is not authorised'
      using errcode = '42501';
  end if;

  select entry_table.*
  into parent_row
  from public.benefit_realisation_entries entry_table
  where entry_table.organisation_id = org_id
    and entry_table.id = target_parent_entry_id;

  if not found then
    raise exception 'parent realisation entry was not found'
      using errcode = 'P0002';
  end if;

  if parent_row.status <> 'validated' or parent_row.entry_kind <> 'original' then
    raise exception 'adjustments must reference a validated original entry'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = parent_row.benefit_id;

  if not private.benefit_allows_realisation_recording(benefit_row.status) then
    raise exception 'benefit is not in a realisation-recording status'
      using errcode = '55000';
  end if;

  if not private.can_record_benefit_realisation(
    org_id,
    benefit_row.organisational_unit_id
  ) then
    raise exception 'benefit realisation adjustment creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_realisation_entry_payload(
    benefit_row,
    target_financial_amount,
    target_measure_value,
    target_measure_unit,
    'adjustment',
    target_is_correction
  );

  resolved_period_start := coalesce(target_period_start, parent_row.period_start);
  resolved_period_end := coalesce(target_period_end, parent_row.period_end);

  if resolved_period_end < resolved_period_start then
    raise exception 'realisation period end must be on or after period start'
      using errcode = '22023';
  end if;

  new_entry_id := private.register_resource_record(
    org_id,
    'benefit_realisation_entry',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.benefit_realisation_entries (
    id,
    organisation_id,
    benefit_id,
    period_start,
    period_end,
    financial_amount,
    measure_value,
    measure_unit,
    entry_kind,
    data_source,
    notes,
    status,
    recorded_by_membership_id,
    recorded_at,
    adjustment_of_entry_id,
    is_correction
  )
  values (
    new_entry_id,
    org_id,
    parent_row.benefit_id,
    resolved_period_start,
    resolved_period_end,
    target_financial_amount,
    target_measure_value,
    case
      when target_measure_unit is null then parent_row.measure_unit
      else btrim(target_measure_unit)
    end,
    'adjustment',
    case
      when target_data_source is null then null
      else btrim(target_data_source)
    end,
    target_notes,
    'draft',
    actor_membership_id,
    statement_timestamp(),
    target_parent_entry_id,
    target_is_correction
  );

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.adjustment_created',
    parent_row.benefit_id,
    'succeeded',
    jsonb_build_object(
      'entry_id', new_entry_id,
      'parent_entry_id', target_parent_entry_id,
      'is_correction', target_is_correction
    )
  );

  return new_entry_id;
end;
$$;

create or replace function private.submit_benefit_realisation_entry(
  target_entry_id uuid
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
  entry_row public.benefit_realisation_entries%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation submit is not authorised'
      using errcode = '42501';
  end if;

  select entry_table.*
  into entry_row
  from public.benefit_realisation_entries entry_table
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id
  for update;

  if not found or entry_row.status <> 'draft' then
    raise exception 'realisation entry is not submittable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = entry_row.benefit_id;

  if not private.benefit_allows_realisation_recording(benefit_row.status) then
    raise exception 'benefit is not in a realisation-recording status'
      using errcode = '55000';
  end if;

  if entry_row.recorded_by_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(
      org_id,
      benefit_row.organisational_unit_id
    ) then
    raise exception 'benefit realisation submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_realisation_entry_payload(
    benefit_row,
    entry_row.financial_amount,
    entry_row.measure_value,
    entry_row.measure_unit,
    entry_row.entry_kind,
    entry_row.is_correction
  );

  update public.benefit_realisation_entries entry_table
  set status = 'submitted',
      submitted_at = statement_timestamp()
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id;

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.submitted',
    entry_row.benefit_id,
    'succeeded',
    jsonb_build_object('entry_id', target_entry_id)
  );

  return true;
end;
$$;

create or replace function private.validate_benefit_realisation_entry(
  target_entry_id uuid
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
  entry_row public.benefit_realisation_entries%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation validation is not authorised'
      using errcode = '42501';
  end if;

  select entry_table.*
  into entry_row
  from public.benefit_realisation_entries entry_table
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id
  for update;

  if not found or entry_row.status <> 'submitted' then
    raise exception 'realisation entry is not validatable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = entry_row.benefit_id;

  if not private.can_validate_benefit_realisation(
    org_id,
    benefit_row.organisational_unit_id
  ) then
    raise exception 'benefit realisation validation is not authorised'
      using errcode = '42501';
  end if;

  if benefit_row.benefit_class = 'financial'
    and entry_row.recorded_by_membership_id = actor_membership_id then
    raise exception 'financial realisation validation requires separation of duties'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_realisation_entry_payload(
    benefit_row,
    entry_row.financial_amount,
    entry_row.measure_value,
    entry_row.measure_unit,
    entry_row.entry_kind,
    entry_row.is_correction
  );

  update public.benefit_realisation_entries entry_table
  set status = 'validated',
      validated_by_membership_id = actor_membership_id,
      validated_at = statement_timestamp()
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id;

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.validated',
    entry_row.benefit_id,
    'succeeded',
    jsonb_build_object('entry_id', target_entry_id)
  );

  return true;
end;
$$;

create or replace function private.reject_benefit_realisation_entry(
  target_entry_id uuid,
  target_reason text default null
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
  entry_row public.benefit_realisation_entries%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation rejection is not authorised'
      using errcode = '42501';
  end if;

  select entry_table.*
  into entry_row
  from public.benefit_realisation_entries entry_table
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id
  for update;

  if not found or entry_row.status <> 'submitted' then
    raise exception 'realisation entry is not rejectable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = entry_row.benefit_id;

  if not private.can_validate_benefit_realisation(
    org_id,
    benefit_row.organisational_unit_id
  )
  and entry_row.recorded_by_membership_id <> actor_membership_id
  and not private.can_manage_benefit_in_unit(
    org_id,
    benefit_row.organisational_unit_id
  ) then
    raise exception 'benefit realisation rejection is not authorised'
      using errcode = '42501';
  end if;

  update public.benefit_realisation_entries entry_table
  set status = 'rejected',
      notes = case
        when target_reason is null then entry_row.notes
        when entry_row.notes is null then btrim(target_reason)
        else entry_row.notes || E'\n' || btrim(target_reason)
      end
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id;

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.rejected',
    entry_row.benefit_id,
    'succeeded',
    jsonb_build_object('entry_id', target_entry_id, 'reason', target_reason)
  );

  return true;
end;
$$;

create policy benefit_realisation_entries_select
on public.benefit_realisation_entries for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, benefit_id)
);

grant select on public.benefit_realisation_entries to authenticated;

create or replace function public.create_benefit_realisation_entry(
  target_benefit_id uuid,
  target_period_start date,
  target_period_end date,
  target_financial_amount numeric default null,
  target_measure_value numeric default null,
  target_measure_unit text default null,
  target_data_source text default null,
  target_notes text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_benefit_realisation_entry(
  target_benefit_id,
  target_period_start,
  target_period_end,
  target_financial_amount,
  target_measure_value,
  target_measure_unit,
  target_data_source,
  target_notes
) $$;

create or replace function public.create_benefit_realisation_adjustment(
  target_parent_entry_id uuid,
  target_financial_amount numeric default null,
  target_measure_value numeric default null,
  target_measure_unit text default null,
  target_period_start date default null,
  target_period_end date default null,
  target_data_source text default null,
  target_notes text default null,
  target_is_correction boolean default false
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_benefit_realisation_adjustment(
  target_parent_entry_id,
  target_financial_amount,
  target_measure_value,
  target_measure_unit,
  target_period_start,
  target_period_end,
  target_data_source,
  target_notes,
  target_is_correction
) $$;

create or replace function public.submit_benefit_realisation_entry(target_entry_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.submit_benefit_realisation_entry(target_entry_id) $$;

create or replace function public.validate_benefit_realisation_entry(target_entry_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.validate_benefit_realisation_entry(target_entry_id) $$;

create or replace function public.reject_benefit_realisation_entry(
  target_entry_id uuid,
  target_reason text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.reject_benefit_realisation_entry(
  target_entry_id,
  target_reason
) $$;

grant execute on function public.create_benefit_realisation_entry(
  uuid, date, date, numeric, numeric, text, text, text
) to authenticated;
grant execute on function public.create_benefit_realisation_adjustment(
  uuid, numeric, numeric, text, date, date, text, text, boolean
) to authenticated;
grant execute on function public.submit_benefit_realisation_entry(uuid) to authenticated;
grant execute on function public.validate_benefit_realisation_entry(uuid) to authenticated;
grant execute on function public.reject_benefit_realisation_entry(uuid, text) to authenticated;

revoke all on function public.create_benefit_realisation_entry(
  uuid, date, date, numeric, numeric, text, text, text
) from public, anon;
revoke all on function public.create_benefit_realisation_adjustment(
  uuid, numeric, numeric, text, date, date, text, text, boolean
) from public, anon;
revoke all on function public.submit_benefit_realisation_entry(uuid) from public, anon;
revoke all on function public.validate_benefit_realisation_entry(uuid) from public, anon;
revoke all on function public.reject_benefit_realisation_entry(uuid, text) from public, anon;

revoke all on function private.create_benefit_realisation_entry(
  uuid, date, date, numeric, numeric, text, text, text
) from public;
revoke all on function private.create_benefit_realisation_adjustment(
  uuid, numeric, numeric, text, date, date, text, text, boolean
) from public;
revoke all on function private.submit_benefit_realisation_entry(uuid) from public;
revoke all on function private.validate_benefit_realisation_entry(uuid) from public;
revoke all on function private.reject_benefit_realisation_entry(uuid, text) from public;
revoke all on function private.get_benefit_validated_realised_total(uuid) from public;

grant execute on function private.create_benefit_realisation_entry(
  uuid, date, date, numeric, numeric, text, text, text
) to lean_hub_private_owner;
grant execute on function private.create_benefit_realisation_adjustment(
  uuid, numeric, numeric, text, date, date, text, text, boolean
) to lean_hub_private_owner;
grant execute on function private.submit_benefit_realisation_entry(uuid) to lean_hub_private_owner;
grant execute on function private.validate_benefit_realisation_entry(uuid) to lean_hub_private_owner;
grant execute on function private.reject_benefit_realisation_entry(uuid, text) to lean_hub_private_owner;
grant execute on function private.get_benefit_validated_realised_total(uuid) to lean_hub_private_owner;

alter function private.benefit_allows_realisation_recording(text) owner to lean_hub_private_owner;
alter function private.guard_benefit_realisation_entry_immutable() owner to lean_hub_private_owner;
alter function private.can_record_benefit_realisation(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_validate_benefit_realisation(uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_benefit_realisation_entry_payload(
  public.improvement_benefits, numeric, numeric, text, text, boolean
) owner to lean_hub_private_owner;
alter function private.get_benefit_validated_realised_total(uuid) owner to lean_hub_private_owner;
alter function private.create_benefit_realisation_entry(
  uuid, date, date, numeric, numeric, text, text, text
) owner to lean_hub_private_owner;
alter function private.create_benefit_realisation_adjustment(
  uuid, numeric, numeric, text, date, date, text, text, boolean
) owner to lean_hub_private_owner;
alter function private.submit_benefit_realisation_entry(uuid) owner to lean_hub_private_owner;
alter function private.validate_benefit_realisation_entry(uuid) owner to lean_hub_private_owner;
alter function private.reject_benefit_realisation_entry(uuid, text) owner to lean_hub_private_owner;
