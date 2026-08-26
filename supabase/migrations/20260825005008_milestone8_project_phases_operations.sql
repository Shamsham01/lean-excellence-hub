-- Milestone 8: instantiated project phases and sequential phase completion.

create table public.ci_project_phases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null,
  methodology_phase_id uuid,
  phase_key_snapshot text not null,
  title_snapshot text not null,
  description_snapshot text,
  display_order integer not null,
  status text not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint ci_project_phases_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_phases_project_order_key
    unique (organisation_id, project_id, display_order),
  constraint ci_project_phases_project_fkey
    foreign key (organisation_id, project_id)
    references public.ci_projects(organisation_id, id)
    on delete restrict,
  constraint ci_project_phases_methodology_phase_fkey
    foreign key (organisation_id, methodology_phase_id)
    references public.ci_project_methodology_phases(organisation_id, id)
    on delete restrict,
  constraint ci_project_phases_status_check
    check (status in ('not_started', 'in_progress', 'completed', 'skipped')),
  constraint ci_project_phases_display_order_check
    check (display_order > 0),
  constraint ci_project_phases_title_snapshot_check
    check (title_snapshot = btrim(title_snapshot) and char_length(title_snapshot) between 1 and 160)
);

create trigger ci_project_phases_prevent_org_change
before update on public.ci_project_phases
for each row execute function private.prevent_organisation_id_change();

create index ci_project_phases_project_idx
  on public.ci_project_phases (organisation_id, project_id, display_order);

alter table public.ci_project_phases enable row level security;
alter table public.ci_project_phases force row level security;
revoke all on public.ci_project_phases from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.ci_project_phases to lean_hub_private_owner;

create policy private_owner_all_ci_project_phases
on public.ci_project_phases for all to lean_hub_private_owner
using (true) with check (true);

create policy ci_project_phases_select
on public.ci_project_phases for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, project_id)
);

grant select on public.ci_project_phases to authenticated;

create or replace function private.instantiate_ci_project_phases(
  target_organisation_id uuid,
  target_project_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  project_row public.ci_projects%rowtype;
  phase_row record;
  first_phase_id uuid;
begin
  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = target_organisation_id
    and project_table.id = target_project_id;

  if project_row.methodology_version_id is null then
    raise exception 'project has no methodology version for phase instantiation'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.ci_project_phases phase_table
    where phase_table.organisation_id = target_organisation_id
      and phase_table.project_id = target_project_id
  ) then
    return;
  end if;

  for phase_row in
    select
      methodology_phase.id as methodology_phase_id,
      methodology_phase.phase_key,
      methodology_phase.title,
      methodology_phase.description,
      methodology_phase.display_order
    from public.ci_project_methodology_phases methodology_phase
    where methodology_phase.organisation_id = target_organisation_id
      and methodology_phase.methodology_version_id = project_row.methodology_version_id
    order by methodology_phase.display_order
  loop
    insert into public.ci_project_phases (
      organisation_id,
      project_id,
      methodology_phase_id,
      phase_key_snapshot,
      title_snapshot,
      description_snapshot,
      display_order,
      status,
      started_at
    )
    values (
      target_organisation_id,
      target_project_id,
      phase_row.methodology_phase_id,
      phase_row.phase_key,
      phase_row.title,
      phase_row.description,
      phase_row.display_order,
      case when phase_row.display_order = 1 then 'in_progress' else 'not_started' end,
      case when phase_row.display_order = 1 then statement_timestamp() else null end
    )
    returning id into first_phase_id;
  end loop;

  if first_phase_id is null then
    raise exception 'methodology version has no phases to instantiate'
      using errcode = '22023';
  end if;
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

create or replace function private.complete_project_phase(
  target_project_id uuid,
  target_phase_id uuid,
  target_mark_skipped boolean default false
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
  phase_row public.ci_project_phases%rowtype;
  next_phase_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project phase completion is not authorised'
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

  if project_row.status not in ('active', 'on_hold') then
    raise exception 'project phases are not actionable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project phase completion is not authorised'
      using errcode = '42501';
  end if;

  select phase_table.*
  into phase_row
  from public.ci_project_phases phase_table
  where phase_table.organisation_id = org_id
    and phase_table.project_id = target_project_id
    and phase_table.id = target_phase_id
  for update;

  if not found then
    raise exception 'project phase not found'
      using errcode = 'P0002';
  end if;

  if phase_row.status not in ('in_progress', 'not_started') then
    raise exception 'project phase is not completable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.ci_project_phases current_phase
    where current_phase.organisation_id = org_id
      and current_phase.project_id = target_project_id
      and current_phase.status = 'in_progress'
      and current_phase.id = target_phase_id
  ) and not (
    target_mark_skipped
    and phase_row.status = 'not_started'
    and not exists (
      select 1
      from public.ci_project_phases prior_phase
      where prior_phase.organisation_id = org_id
        and prior_phase.project_id = target_project_id
        and prior_phase.display_order < phase_row.display_order
        and prior_phase.status not in ('completed', 'skipped')
    )
  ) then
    raise exception 'project phases must progress sequentially'
      using errcode = '55000';
  end if;

  update public.ci_project_phases phase_table
  set status = case when target_mark_skipped then 'skipped' else 'completed' end,
      started_at = coalesce(phase_table.started_at, statement_timestamp()),
      completed_at = statement_timestamp()
  where phase_table.organisation_id = org_id
    and phase_table.id = target_phase_id;

  if not target_mark_skipped then
    select phase_table.id
    into next_phase_id
    from public.ci_project_phases phase_table
    where phase_table.organisation_id = org_id
      and phase_table.project_id = target_project_id
      and phase_table.display_order > phase_row.display_order
      and phase_table.status = 'not_started'
    order by phase_table.display_order
    limit 1;

    if next_phase_id is not null then
      update public.ci_project_phases phase_table
      set status = 'in_progress',
          started_at = statement_timestamp()
      where phase_table.organisation_id = org_id
        and phase_table.id = next_phase_id;
    end if;
  end if;

  perform private.append_business_audit(
    org_id,
    case when target_mark_skipped then 'ci_project.phase_skipped' else 'ci_project.phase_completed' end,
    target_project_id,
    'succeeded',
    jsonb_build_object('phase_id', target_phase_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    case when target_mark_skipped then 'CiProjectPhaseSkipped' else 'CiProjectPhaseCompleted' end,
    target_phase_id::text,
    jsonb_build_object('project_id', target_project_id, 'phase_id', target_phase_id)
  );

  return true;
end;
$$;

create or replace function public.complete_project_phase(
  target_project_id uuid,
  target_phase_id uuid,
  target_mark_skipped boolean default false
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.complete_project_phase(target_project_id, target_phase_id, target_mark_skipped) $$;

grant execute on function public.complete_project_phase(uuid, uuid, boolean) to authenticated;
revoke all on function public.complete_project_phase(uuid, uuid, boolean) from public, anon;

alter function private.instantiate_ci_project_phases(uuid, uuid) owner to lean_hub_private_owner;
alter function private.start_project(uuid) owner to lean_hub_private_owner;
alter function private.complete_project_phase(uuid, uuid, boolean) owner to lean_hub_private_owner;
