-- Milestone 8: project metrics, append-only measurements, and lock-on-active enforcement.

create table public.ci_project_metrics (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null,
  metric_key text not null,
  display_name text not null,
  unit_label text,
  baseline_value numeric,
  target_value numeric,
  is_locked boolean not null default false,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ci_project_metrics_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_metrics_project_key_key
    unique (organisation_id, project_id, metric_key),
  constraint ci_project_metrics_project_fkey
    foreign key (organisation_id, project_id)
    references public.ci_projects(organisation_id, id)
    on delete restrict,
  constraint ci_project_metrics_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_project_metrics_metric_key_check
    check (metric_key = btrim(metric_key) and char_length(metric_key) between 1 and 80),
  constraint ci_project_metrics_display_name_check
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 160)
);

create table public.ci_project_metric_measurements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  metric_id uuid not null,
  measured_value numeric not null,
  measured_at timestamptz not null default statement_timestamp(),
  note text,
  recorded_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ci_project_metric_measurements_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_metric_measurements_metric_fkey
    foreign key (organisation_id, metric_id)
    references public.ci_project_metrics(organisation_id, id)
    on delete restrict,
  constraint ci_project_metric_measurements_recorder_fkey
    foreign key (organisation_id, recorded_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create trigger ci_project_metrics_touch_updated_at
before update on public.ci_project_metrics
for each row execute function private.touch_updated_at();

create trigger ci_project_metrics_prevent_org_change
before update on public.ci_project_metrics
for each row execute function private.prevent_organisation_id_change();

create trigger ci_project_metric_measurements_prevent_org_change
before update on public.ci_project_metric_measurements
for each row execute function private.prevent_organisation_id_change();

create trigger ci_project_metric_measurements_prevent_update
before update on public.ci_project_metric_measurements
for each row execute function private.prevent_update_or_delete();

create trigger ci_project_metric_measurements_prevent_delete
before delete on public.ci_project_metric_measurements
for each row execute function private.prevent_update_or_delete();

create index ci_project_metrics_project_idx
  on public.ci_project_metrics (organisation_id, project_id);
create index ci_project_metric_measurements_metric_idx
  on public.ci_project_metric_measurements (organisation_id, metric_id, measured_at);

alter table public.ci_project_metrics enable row level security;
alter table public.ci_project_metrics force row level security;
alter table public.ci_project_metric_measurements enable row level security;
alter table public.ci_project_metric_measurements force row level security;

revoke all on public.ci_project_metrics from public, anon, authenticated, service_role;
revoke all on public.ci_project_metric_measurements from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.ci_project_metrics to lean_hub_private_owner;
grant select, insert, update, delete on public.ci_project_metric_measurements to lean_hub_private_owner;

create policy private_owner_all_ci_project_metrics
on public.ci_project_metrics for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ci_project_metric_measurements
on public.ci_project_metric_measurements for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.lock_ci_project_metrics(
  target_organisation_id uuid,
  target_project_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.ci_project_metrics metric_table
  set is_locked = true,
      updated_at = statement_timestamp()
  where metric_table.organisation_id = target_organisation_id
    and metric_table.project_id = target_project_id
    and metric_table.is_locked = false;
end;
$$;

create or replace function private.guard_ci_project_metric_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  metric_locked boolean;
begin
  select metric_row.is_locked
  into metric_locked
  from public.ci_project_metrics metric_row
  where metric_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and metric_row.id = coalesce(new.id, old.id);

  if metric_locked then
    raise exception 'project metrics are locked while project is active'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger ci_project_metrics_guard_locked
before update or delete on public.ci_project_metrics
for each row execute function private.guard_ci_project_metric_locked();

create or replace function private.record_metric_measurement(
  target_metric_id uuid,
  target_measured_value numeric,
  target_measured_at timestamptz default null,
  target_note text default null
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
  metric_row public.ci_project_metrics%rowtype;
  project_row public.ci_projects%rowtype;
  new_measurement_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'metric measurement is not authorised'
      using errcode = '42501';
  end if;

  select metric_table.*
  into metric_row
  from public.ci_project_metrics metric_table
  where metric_table.organisation_id = org_id
    and metric_table.id = target_metric_id
  for update;

  if not found then
    raise exception 'metric not found'
      using errcode = 'P0002';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = metric_row.project_id;

  if project_row.status not in ('active', 'on_hold', 'completed') then
    raise exception 'metric measurements are not allowed for project status'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'metric measurement is not authorised'
      using errcode = '42501';
  end if;

  insert into public.ci_project_metric_measurements (
    organisation_id,
    metric_id,
    measured_value,
    measured_at,
    note,
    recorded_by_membership_id
  )
  values (
    org_id,
    target_metric_id,
    target_measured_value,
    coalesce(target_measured_at, statement_timestamp()),
    target_note,
    actor_membership_id
  )
  returning id into new_measurement_id;

  perform private.append_business_audit(
    org_id,
    'ci_project.metric_recorded',
    metric_row.project_id,
    'succeeded',
    jsonb_build_object('metric_id', target_metric_id, 'measurement_id', new_measurement_id)
  );

  return new_measurement_id;
end;
$$;

create or replace function private.start_project(
  target_project_id uuid
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
  project_row public.ci_projects%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project start is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if project_row.status <> 'approved' then
    raise exception 'project is not startable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project start is not authorised'
      using errcode = '42501';
  end if;

  perform private.instantiate_ci_project_phases(org_id, target_project_id);

  update public.ci_projects project_table
  set status = 'active',
      actual_start_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.lock_ci_project_metrics(org_id, target_project_id);

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'approved',
    'active',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.started',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectStarted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create policy ci_project_metrics_select
on public.ci_project_metrics for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, project_id)
);

create policy ci_project_metric_measurements_select
on public.ci_project_metric_measurements for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.ci_project_metrics metric_row
    where metric_row.organisation_id = ci_project_metric_measurements.organisation_id
      and metric_row.id = ci_project_metric_measurements.metric_id
      and private.can_read_ci_project(metric_row.organisation_id, metric_row.project_id)
  )
);

grant select on public.ci_project_metrics to authenticated;
grant select on public.ci_project_metric_measurements to authenticated;

create or replace function public.record_metric_measurement(
  target_metric_id uuid,
  target_measured_value numeric,
  target_measured_at timestamptz default null,
  target_note text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.record_metric_measurement(
  target_metric_id,
  target_measured_value,
  target_measured_at,
  target_note
) $$;

grant execute on function public.record_metric_measurement(uuid, numeric, timestamptz, text) to authenticated;
revoke all on function public.record_metric_measurement(uuid, numeric, timestamptz, text) from public, anon;

alter function private.lock_ci_project_metrics(uuid, uuid) owner to lean_hub_private_owner;
alter function private.guard_ci_project_metric_locked() owner to lean_hub_private_owner;
alter function private.record_metric_measurement(uuid, numeric, timestamptz, text) owner to lean_hub_private_owner;
alter function private.start_project(uuid) owner to lean_hub_private_owner;
