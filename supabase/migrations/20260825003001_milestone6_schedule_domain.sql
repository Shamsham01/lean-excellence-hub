create table public.schedule_definitions (
  id uuid primary key,
  organisation_id uuid not null,
  activity_resource_id uuid not null,
  title text not null,
  description text,
  unit_id uuid not null,
  owner_membership_id uuid not null,
  timezone text not null,
  is_all_day boolean not null default false,
  local_time time,
  recurrence jsonb not null,
  start_date date not null,
  end_date date,
  status text not null default 'active',
  version_number integer not null default 1,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint schedule_definitions_organisation_id_id_key unique (organisation_id, id),
  constraint schedule_definitions_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint schedule_definitions_activity_resource_fkey
    foreign key (organisation_id, activity_resource_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint schedule_definitions_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint schedule_definitions_owner_fkey
    foreign key (organisation_id, owner_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint schedule_definitions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint schedule_definitions_title_check
    check (title = btrim(title) and char_length(title) between 1 and 160),
  constraint schedule_definitions_timezone_check
    check (char_length(timezone) between 1 and 100),
  constraint schedule_definitions_status_check
    check (status in ('active', 'inactive')),
  constraint schedule_definitions_all_day_time_check
    check (
      (is_all_day and local_time is null)
      or (not is_all_day and local_time is not null)
    ),
  constraint schedule_definitions_end_date_check
    check (end_date is null or end_date >= start_date),
  constraint schedule_definitions_recurrence_check
    check (pg_catalog.jsonb_typeof(recurrence) = 'object')
);

create table public.schedule_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  schedule_definition_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint schedule_participants_organisation_id_id_key unique (organisation_id, id),
  constraint schedule_participants_schedule_membership_key
    unique (organisation_id, schedule_definition_id, membership_id),
  constraint schedule_participants_schedule_fkey
    foreign key (organisation_id, schedule_definition_id)
    references public.schedule_definitions(organisation_id, id)
    on delete restrict,
  constraint schedule_participants_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.schedule_occurrences (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  schedule_definition_id uuid not null,
  planned_local_date date not null,
  is_all_day boolean not null,
  local_time time,
  planned_at timestamptz not null,
  unit_id uuid not null,
  owner_membership_id uuid not null,
  lifecycle_status text not null default 'open',
  completion_resource_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint schedule_occurrences_organisation_id_id_key unique (organisation_id, id),
  constraint schedule_occurrences_schedule_fkey
    foreign key (organisation_id, schedule_definition_id)
    references public.schedule_definitions(organisation_id, id)
    on delete restrict,
  constraint schedule_occurrences_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint schedule_occurrences_owner_fkey
    foreign key (organisation_id, owner_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint schedule_occurrences_completion_resource_fkey
    foreign key (organisation_id, completion_resource_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint schedule_occurrences_lifecycle_status_check
    check (lifecycle_status in ('open', 'completed', 'cancelled')),
  constraint schedule_occurrences_all_day_time_check
    check (
      (is_all_day and local_time is null)
      or (not is_all_day and local_time is not null)
    ),
  constraint schedule_occurrences_completion_check
    check (
      (lifecycle_status = 'completed' and completion_resource_id is not null and completed_at is not null)
      or (lifecycle_status <> 'completed' and completion_resource_id is null and completed_at is null)
    )
);

create unique index schedule_occurrences_idempotency_idx
  on public.schedule_occurrences (
    organisation_id,
    schedule_definition_id,
    planned_local_date,
    coalesce(local_time, '00:00:00'::time without time zone)
  );

create index schedule_definitions_org_status_idx
  on public.schedule_definitions (organisation_id, status);
create index schedule_definitions_unit_idx
  on public.schedule_definitions (organisation_id, unit_id);
create index schedule_definitions_activity_resource_idx
  on public.schedule_definitions (organisation_id, activity_resource_id);
create index schedule_occurrences_schedule_date_idx
  on public.schedule_occurrences (organisation_id, schedule_definition_id, planned_local_date);
create index schedule_occurrences_planned_at_idx
  on public.schedule_occurrences (organisation_id, planned_at);
create index schedule_occurrences_unit_idx
  on public.schedule_occurrences (organisation_id, unit_id);

create trigger schedule_definitions_touch_updated_at
before update on public.schedule_definitions
for each row execute function private.touch_updated_at();

create trigger schedule_definitions_prevent_org_change
before update on public.schedule_definitions
for each row execute function private.prevent_organisation_id_change();

alter table public.schedule_definitions enable row level security;
alter table public.schedule_definitions force row level security;
alter table public.schedule_participants enable row level security;
alter table public.schedule_participants force row level security;
alter table public.schedule_occurrences enable row level security;
alter table public.schedule_occurrences force row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'schedule_definitions',
    'schedule_participants',
    'schedule_occurrences'
  ]
  loop
    execute format(
      'revoke all on public.%I from public, anon, authenticated, service_role',
      relation_name
    );
    execute format(
      'grant select, insert, update, delete on public.%I to lean_hub_private_owner',
      relation_name
    );
    execute format(
      'create policy private_owner_all_%I on public.%I for all to lean_hub_private_owner using (true) with check (true)',
      relation_name,
      relation_name
    );
  end loop;
end
$$;
