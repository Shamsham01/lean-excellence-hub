-- Milestone 10: benefit overlap groups, append-only allocation history, and overlap RPCs.

create table public.benefit_overlap_groups (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  name text not null,
  reason text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint benefit_overlap_groups_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_overlap_groups_organisation_fkey
    foreign key (organisation_id)
    references public.organisations(id)
    on delete restrict,
  constraint benefit_overlap_groups_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_overlap_groups_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint benefit_overlap_groups_reason_check
    check (reason is null or char_length(reason) <= 2000)
);

create table public.benefit_overlap_allocation_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  overlap_group_id uuid not null,
  benefit_id uuid not null,
  allocation_percentage numeric(5, 2) not null,
  reason text,
  assigned_by_membership_id uuid not null,
  effective_from timestamptz not null default statement_timestamp(),
  superseded_at timestamptz,
  constraint benefit_overlap_allocation_history_organisation_id_id_key
    unique (organisation_id, id),
  constraint benefit_overlap_allocation_history_group_fkey
    foreign key (organisation_id, overlap_group_id)
    references public.benefit_overlap_groups(organisation_id, id)
    on delete restrict,
  constraint benefit_overlap_allocation_history_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_overlap_allocation_history_assigner_fkey
    foreign key (organisation_id, assigned_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_overlap_allocation_history_percentage_check
    check (allocation_percentage > 0 and allocation_percentage <= 100),
  constraint benefit_overlap_allocation_history_reason_check
    check (reason is null or char_length(reason) <= 2000),
  constraint benefit_overlap_allocation_history_superseded_check
    check (superseded_at is null or superseded_at >= effective_from)
);

create unique index benefit_overlap_allocation_active_unique_idx
  on public.benefit_overlap_allocation_history (organisation_id, overlap_group_id, benefit_id)
  where superseded_at is null;

create index benefit_overlap_allocation_history_group_active_idx
  on public.benefit_overlap_allocation_history (organisation_id, overlap_group_id)
  where superseded_at is null;

create index benefit_overlap_allocation_history_benefit_active_idx
  on public.benefit_overlap_allocation_history (organisation_id, benefit_id)
  where superseded_at is null;

create index benefit_overlap_groups_org_created_idx
  on public.benefit_overlap_groups (organisation_id, created_at desc);

create or replace function private.guard_benefit_overlap_allocation_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'benefit overlap allocation history is append-only'
      using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' then
    if old.superseded_at is not null then
      raise exception 'superseded allocation row is immutable'
        using errcode = '55000';
    end if;

    if new.organisation_id is distinct from old.organisation_id
      or new.overlap_group_id is distinct from old.overlap_group_id
      or new.benefit_id is distinct from old.benefit_id
      or new.allocation_percentage is distinct from old.allocation_percentage
      or new.reason is distinct from old.reason
      or new.assigned_by_membership_id is distinct from old.assigned_by_membership_id
      or new.effective_from is distinct from old.effective_from
      or new.id is distinct from old.id then
      raise exception 'benefit overlap allocation history is append-only'
        using errcode = '55000';
    end if;

    if new.superseded_at is null then
      raise exception 'superseded_at can only be set, not cleared'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

create trigger benefit_overlap_groups_prevent_org_change
before update on public.benefit_overlap_groups
for each row execute function private.prevent_organisation_id_change();

create trigger benefit_overlap_allocation_history_prevent_org_change
before update on public.benefit_overlap_allocation_history
for each row execute function private.prevent_organisation_id_change();

create trigger benefit_overlap_allocation_history_guard_mutation
before update or delete on public.benefit_overlap_allocation_history
for each row execute function private.guard_benefit_overlap_allocation_history_mutation();

alter table public.benefit_overlap_groups enable row level security;
alter table public.benefit_overlap_groups force row level security;
alter table public.benefit_overlap_allocation_history enable row level security;
alter table public.benefit_overlap_allocation_history force row level security;

revoke all on public.benefit_overlap_groups from public, anon, authenticated, service_role;
revoke all on public.benefit_overlap_allocation_history from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.benefit_overlap_groups to lean_hub_private_owner;
grant select, insert, update, delete on public.benefit_overlap_allocation_history to lean_hub_private_owner;

create policy private_owner_all_benefit_overlap_groups
on public.benefit_overlap_groups for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_benefit_overlap_allocation_history
on public.benefit_overlap_allocation_history for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.can_manage_benefit_overlap(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.manage',
    null,
    null
  )
$$;

create or replace function private.can_read_benefit_overlap_group(
  target_organisation_id uuid,
  target_overlap_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_benefit_overlap(target_organisation_id)
  or exists (
    select 1
    from public.benefit_overlap_allocation_history allocation_row
    where allocation_row.organisation_id = target_organisation_id
      and allocation_row.overlap_group_id = target_overlap_group_id
      and allocation_row.superseded_at is null
      and private.can_read_improvement_benefit(
        target_organisation_id,
        allocation_row.benefit_id
      )
  )
$$;

create or replace function private.can_read_benefit_overlap_allocation(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_improvement_benefit(
    target_organisation_id,
    target_benefit_id
  )
$$;

create or replace function private.sum_active_benefit_overlap_allocations(
  target_organisation_id uuid,
  target_overlap_group_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    sum(allocation_row.allocation_percentage),
    0::numeric
  )
  from public.benefit_overlap_allocation_history allocation_row
  where allocation_row.organisation_id = target_organisation_id
    and allocation_row.overlap_group_id = target_overlap_group_id
    and allocation_row.superseded_at is null
$$;

create or replace function private.get_benefit_portfolio_allocation_percentage(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select allocation_row.allocation_percentage
      from public.benefit_overlap_allocation_history allocation_row
      where allocation_row.organisation_id = target_organisation_id
        and allocation_row.benefit_id = target_benefit_id
        and allocation_row.superseded_at is null
      order by allocation_row.effective_from desc, allocation_row.id desc
      limit 1
    ),
    100::numeric
  )
$$;

create or replace function private.create_benefit_overlap_group(
  target_name text,
  target_reason text default null
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
  new_group_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_overlap(org_id) then
    raise exception 'benefit overlap group creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.benefit_overlap_groups (
    organisation_id,
    name,
    reason,
    created_by_membership_id
  )
  values (
    org_id,
    btrim(target_name),
    target_reason,
    actor_membership_id
  )
  returning id into new_group_id;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_group.created',
    new_group_id,
    'succeeded',
    jsonb_build_object('overlap_group_id', new_group_id)
  );

  return new_group_id;
end;
$$;

create or replace function private.add_benefit_to_overlap_group(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
  target_allocation_percentage numeric,
  target_reason text default null
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
  group_row public.benefit_overlap_groups%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  active_allocation_sum numeric;
  new_allocation_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit overlap allocation is not authorised'
      using errcode = '42501';
  end if;

  select group_table.*
  into group_row
  from public.benefit_overlap_groups group_table
  where group_table.organisation_id = org_id
    and group_table.id = target_overlap_group_id
  for update;

  if not found then
    raise exception 'overlap group was not found'
      using errcode = 'P0002';
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

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit overlap allocation is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.benefit_overlap_allocation_history allocation_row
    where allocation_row.organisation_id = org_id
      and allocation_row.benefit_id = target_benefit_id
      and allocation_row.superseded_at is null
      and allocation_row.overlap_group_id <> target_overlap_group_id
  ) then
    raise exception 'benefit already belongs to another overlap group'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.benefit_overlap_allocation_history allocation_row
    where allocation_row.organisation_id = org_id
      and allocation_row.overlap_group_id = target_overlap_group_id
      and allocation_row.benefit_id = target_benefit_id
      and allocation_row.superseded_at is null
  ) then
    raise exception 'benefit already has an active allocation in this overlap group'
      using errcode = '55000';
  end if;

  active_allocation_sum := private.sum_active_benefit_overlap_allocations(
    org_id,
    target_overlap_group_id
  );

  if active_allocation_sum + target_allocation_percentage > 100 then
    raise exception 'active overlap allocations would exceed 100 percent'
      using errcode = '23514';
  end if;

  insert into public.benefit_overlap_allocation_history (
    organisation_id,
    overlap_group_id,
    benefit_id,
    allocation_percentage,
    reason,
    assigned_by_membership_id
  )
  values (
    org_id,
    target_overlap_group_id,
    target_benefit_id,
    target_allocation_percentage,
    target_reason,
    actor_membership_id
  )
  returning id into new_allocation_id;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_allocation.added',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'overlap_group_id', target_overlap_group_id,
      'allocation_id', new_allocation_id,
      'allocation_percentage', target_allocation_percentage
    )
  );

  return new_allocation_id;
end;
$$;

create or replace function private.update_benefit_overlap_allocation(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
  target_allocation_percentage numeric,
  target_reason text default null
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
  group_row public.benefit_overlap_groups%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  active_allocation_row public.benefit_overlap_allocation_history%rowtype;
  active_allocation_sum numeric;
  new_allocation_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit overlap allocation update is not authorised'
      using errcode = '42501';
  end if;

  select group_table.*
  into group_row
  from public.benefit_overlap_groups group_table
  where group_table.organisation_id = org_id
    and group_table.id = target_overlap_group_id
  for update;

  if not found then
    raise exception 'overlap group was not found'
      using errcode = 'P0002';
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

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit overlap allocation update is not authorised'
      using errcode = '42501';
  end if;

  select allocation_table.*
  into active_allocation_row
  from public.benefit_overlap_allocation_history allocation_table
  where allocation_table.organisation_id = org_id
    and allocation_table.overlap_group_id = target_overlap_group_id
    and allocation_table.benefit_id = target_benefit_id
    and allocation_table.superseded_at is null;

  if not found then
    raise exception 'active overlap allocation was not found'
      using errcode = 'P0002';
  end if;

  active_allocation_sum := private.sum_active_benefit_overlap_allocations(
    org_id,
    target_overlap_group_id
  );

  if active_allocation_sum - active_allocation_row.allocation_percentage
      + target_allocation_percentage > 100 then
    raise exception 'active overlap allocations would exceed 100 percent'
      using errcode = '23514';
  end if;

  update public.benefit_overlap_allocation_history allocation_table
  set superseded_at = statement_timestamp()
  where allocation_table.organisation_id = org_id
    and allocation_table.id = active_allocation_row.id
    and allocation_table.superseded_at is null;

  insert into public.benefit_overlap_allocation_history (
    organisation_id,
    overlap_group_id,
    benefit_id,
    allocation_percentage,
    reason,
    assigned_by_membership_id
  )
  values (
    org_id,
    target_overlap_group_id,
    target_benefit_id,
    target_allocation_percentage,
    target_reason,
    actor_membership_id
  )
  returning id into new_allocation_id;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_allocation.updated',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'overlap_group_id', target_overlap_group_id,
      'previous_allocation_id', active_allocation_row.id,
      'allocation_id', new_allocation_id,
      'allocation_percentage', target_allocation_percentage
    )
  );

  return new_allocation_id;
end;
$$;

create or replace function private.remove_benefit_from_overlap_group(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
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
  group_row public.benefit_overlap_groups%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  active_allocation_row public.benefit_overlap_allocation_history%rowtype;
  superseded_count integer;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit overlap allocation removal is not authorised'
      using errcode = '42501';
  end if;

  select group_table.*
  into group_row
  from public.benefit_overlap_groups group_table
  where group_table.organisation_id = org_id
    and group_table.id = target_overlap_group_id
  for update;

  if not found then
    raise exception 'overlap group was not found'
      using errcode = 'P0002';
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

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit overlap allocation removal is not authorised'
      using errcode = '42501';
  end if;

  select allocation_table.*
  into active_allocation_row
  from public.benefit_overlap_allocation_history allocation_table
  where allocation_table.organisation_id = org_id
    and allocation_table.overlap_group_id = target_overlap_group_id
    and allocation_table.benefit_id = target_benefit_id
    and allocation_table.superseded_at is null;

  if not found then
    raise exception 'active overlap allocation was not found'
      using errcode = 'P0002';
  end if;

  update public.benefit_overlap_allocation_history allocation_table
  set superseded_at = statement_timestamp()
  where allocation_table.organisation_id = org_id
    and allocation_table.id = active_allocation_row.id
    and allocation_table.superseded_at is null;

  get diagnostics superseded_count = row_count;

  if superseded_count = 0 then
    return false;
  end if;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_allocation.removed',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'overlap_group_id', target_overlap_group_id,
      'allocation_id', active_allocation_row.id,
      'reason', target_reason
    )
  );

  return true;
end;
$$;

create or replace function private.get_potential_benefit_overlaps(
  target_benefit_id uuid
)
returns table (
  candidate_benefit_id uuid,
  candidate_benefit_number text,
  candidate_title text,
  signal_type text,
  signal_detail text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  source_benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null then
    raise exception 'benefit overlap advisory lookup is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into source_benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.can_read_improvement_benefit(org_id, target_benefit_id) then
    raise exception 'benefit overlap advisory lookup is not authorised'
      using errcode = '42501';
  end if;

  return query
  select
    candidate_benefit.id,
    candidate_benefit.benefit_number,
    candidate_benefit.title,
    'same_source'::text,
    'Shares at least one linked source resource'::text
  from public.improvement_benefits candidate_benefit
  where candidate_benefit.organisation_id = org_id
    and candidate_benefit.id <> target_benefit_id
    and candidate_benefit.status not in ('cancelled', 'withdrawn')
    and private.can_read_improvement_benefit(org_id, candidate_benefit.id)
    and exists (
      select 1
      from public.benefit_source_links source_link
      join public.benefit_source_links candidate_link
        on source_link.organisation_id = candidate_link.organisation_id
       and source_link.source_resource_id = candidate_link.source_resource_id
      where source_link.organisation_id = org_id
        and source_link.benefit_id = target_benefit_id
        and candidate_link.benefit_id = candidate_benefit.id
    )

  union all

  select
    candidate_benefit.id,
    candidate_benefit.benefit_number,
    candidate_benefit.title,
    'same_category'::text,
    'Shares the same benefit category'::text
  from public.improvement_benefits candidate_benefit
  where candidate_benefit.organisation_id = org_id
    and candidate_benefit.id <> target_benefit_id
    and candidate_benefit.status not in ('cancelled', 'withdrawn')
    and source_benefit_row.category_id is not null
    and candidate_benefit.category_id = source_benefit_row.category_id
    and private.can_read_improvement_benefit(org_id, candidate_benefit.id)

  union all

  select
    candidate_benefit.id,
    candidate_benefit.benefit_number,
    candidate_benefit.title,
    'same_unit'::text,
    'Shares the same organisational unit'::text
  from public.improvement_benefits candidate_benefit
  where candidate_benefit.organisation_id = org_id
    and candidate_benefit.id <> target_benefit_id
    and candidate_benefit.status not in ('cancelled', 'withdrawn')
    and candidate_benefit.organisational_unit_id = source_benefit_row.organisational_unit_id
    and private.can_read_improvement_benefit(org_id, candidate_benefit.id)

  union all

  select
    candidate_benefit.id,
    candidate_benefit.benefit_number,
    candidate_benefit.title,
    'overlapping_realisation_period'::text,
    'Planned realisation periods overlap'::text
  from public.improvement_benefits candidate_benefit
  where candidate_benefit.organisation_id = org_id
    and candidate_benefit.id <> target_benefit_id
    and candidate_benefit.status not in ('cancelled', 'withdrawn')
    and source_benefit_row.planned_realisation_start is not null
    and source_benefit_row.planned_realisation_end is not null
    and candidate_benefit.planned_realisation_start is not null
    and candidate_benefit.planned_realisation_end is not null
    and candidate_benefit.planned_realisation_start <= source_benefit_row.planned_realisation_end
    and source_benefit_row.planned_realisation_start <= candidate_benefit.planned_realisation_end
    and private.can_read_improvement_benefit(org_id, candidate_benefit.id);
end;
$$;

grant select on public.benefit_overlap_groups to authenticated;
grant select on public.benefit_overlap_allocation_history to authenticated;

create policy benefit_overlap_groups_select
on public.benefit_overlap_groups for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_benefit_overlap_group(organisation_id, id)
);

create policy benefit_overlap_allocation_history_select
on public.benefit_overlap_allocation_history for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_benefit_overlap_allocation(organisation_id, benefit_id)
);

create or replace function public.create_benefit_overlap_group(
  target_name text,
  target_reason text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_benefit_overlap_group(target_name, target_reason) $$;

create or replace function public.add_benefit_to_overlap_group(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
  target_allocation_percentage numeric,
  target_reason text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.add_benefit_to_overlap_group(
  target_overlap_group_id,
  target_benefit_id,
  target_allocation_percentage,
  target_reason
) $$;

create or replace function public.update_benefit_overlap_allocation(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
  target_allocation_percentage numeric,
  target_reason text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.update_benefit_overlap_allocation(
  target_overlap_group_id,
  target_benefit_id,
  target_allocation_percentage,
  target_reason
) $$;

create or replace function public.remove_benefit_from_overlap_group(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
  target_reason text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.remove_benefit_from_overlap_group(
  target_overlap_group_id,
  target_benefit_id,
  target_reason
) $$;

create or replace function public.get_potential_benefit_overlaps(
  target_benefit_id uuid
)
returns table (
  candidate_benefit_id uuid,
  candidate_benefit_number text,
  candidate_title text,
  signal_type text,
  signal_detail text
)
language sql
stable
security definer
set search_path = ''
as $$ select * from private.get_potential_benefit_overlaps(target_benefit_id) $$;

grant execute on function public.create_benefit_overlap_group(text, text) to authenticated;
grant execute on function public.add_benefit_to_overlap_group(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.update_benefit_overlap_allocation(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.remove_benefit_from_overlap_group(uuid, uuid, text) to authenticated;
grant execute on function public.get_potential_benefit_overlaps(uuid) to authenticated;

revoke all on function private.create_benefit_overlap_group(text, text) from public;
revoke all on function private.add_benefit_to_overlap_group(uuid, uuid, numeric, text) from public;
revoke all on function private.update_benefit_overlap_allocation(uuid, uuid, numeric, text) from public;
revoke all on function private.remove_benefit_from_overlap_group(uuid, uuid, text) from public;
revoke all on function private.get_potential_benefit_overlaps(uuid) from public;
revoke all on function private.get_benefit_portfolio_allocation_percentage(uuid, uuid) from public;
revoke all on function private.sum_active_benefit_overlap_allocations(uuid, uuid) from public;
revoke all on function private.can_manage_benefit_overlap(uuid) from public;
revoke all on function private.can_read_benefit_overlap_group(uuid, uuid) from public;
revoke all on function private.can_read_benefit_overlap_allocation(uuid, uuid) from public;

grant execute on function private.create_benefit_overlap_group(text, text) to lean_hub_private_owner;
grant execute on function private.add_benefit_to_overlap_group(uuid, uuid, numeric, text) to lean_hub_private_owner;
grant execute on function private.update_benefit_overlap_allocation(uuid, uuid, numeric, text) to lean_hub_private_owner;
grant execute on function private.remove_benefit_from_overlap_group(uuid, uuid, text) to lean_hub_private_owner;
grant execute on function private.get_potential_benefit_overlaps(uuid) to lean_hub_private_owner;
grant execute on function private.get_benefit_portfolio_allocation_percentage(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.sum_active_benefit_overlap_allocations(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.can_manage_benefit_overlap(uuid) to lean_hub_private_owner;
grant execute on function private.can_read_benefit_overlap_group(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.can_read_benefit_overlap_allocation(uuid, uuid) to lean_hub_private_owner;

alter function private.guard_benefit_overlap_allocation_history_mutation() owner to lean_hub_private_owner;
alter function private.can_manage_benefit_overlap(uuid) owner to lean_hub_private_owner;
alter function private.can_read_benefit_overlap_group(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_benefit_overlap_allocation(uuid, uuid) owner to lean_hub_private_owner;
alter function private.sum_active_benefit_overlap_allocations(uuid, uuid) owner to lean_hub_private_owner;
alter function private.get_benefit_portfolio_allocation_percentage(uuid, uuid) owner to lean_hub_private_owner;
alter function private.create_benefit_overlap_group(text, text) owner to lean_hub_private_owner;
alter function private.add_benefit_to_overlap_group(uuid, uuid, numeric, text) owner to lean_hub_private_owner;
alter function private.update_benefit_overlap_allocation(uuid, uuid, numeric, text) owner to lean_hub_private_owner;
alter function private.remove_benefit_from_overlap_group(uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.get_potential_benefit_overlaps(uuid) owner to lean_hub_private_owner;
