-- Milestone 8: project completion snapshots and completed-project immutability.

create table public.ci_project_completion_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null,
  outcome_summary text not null,
  lessons_learned text,
  sustainment_summary text,
  captured_by_membership_id uuid not null,
  captured_at timestamptz not null default statement_timestamp(),
  constraint ci_project_completion_snapshots_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_completion_snapshots_project_key unique (organisation_id, project_id),
  constraint ci_project_completion_snapshots_project_fkey
    foreign key (organisation_id, project_id)
    references public.ci_projects(organisation_id, id)
    on delete restrict,
  constraint ci_project_completion_snapshots_capturer_fkey
    foreign key (organisation_id, captured_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_project_completion_snapshots_outcome_check
    check (
      outcome_summary = btrim(outcome_summary)
      and char_length(outcome_summary) between 1 and 8000
    )
);

create trigger ci_project_completion_snapshots_prevent_update
before update on public.ci_project_completion_snapshots
for each row execute function private.prevent_update_or_delete();

create trigger ci_project_completion_snapshots_prevent_delete
before delete on public.ci_project_completion_snapshots
for each row execute function private.prevent_update_or_delete();

alter table public.ci_project_completion_snapshots enable row level security;
alter table public.ci_project_completion_snapshots force row level security;
revoke all on public.ci_project_completion_snapshots from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.ci_project_completion_snapshots to lean_hub_private_owner;

create policy private_owner_all_ci_project_completion_snapshots
on public.ci_project_completion_snapshots for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.guard_ci_project_child_completed_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_status text;
  target_project_id uuid;
begin
  target_project_id := coalesce(new.project_id, old.project_id);

  select project_row.status
  into project_status
  from public.ci_projects project_row
  where project_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and project_row.id = target_project_id;

  if project_status = 'completed' then
    raise exception 'completed CI project child records are immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger ci_projects_guard_completed_immutable
before update on public.ci_projects
for each row
when (old.status = 'completed')
execute function private.prevent_update_or_delete();

create trigger ci_project_phases_guard_completed_immutable
before update or delete on public.ci_project_phases
for each row execute function private.guard_ci_project_child_completed_immutable();

create trigger ci_project_action_context_guard_completed_immutable
before update or delete on public.ci_project_action_context
for each row execute function private.guard_ci_project_child_completed_immutable();

create trigger ci_project_evidence_links_guard_completed_immutable
before update or delete on public.ci_project_evidence_links
for each row execute function private.guard_ci_project_child_completed_immutable();

create trigger ci_project_metrics_guard_completed_immutable
before update or delete on public.ci_project_metrics
for each row execute function private.guard_ci_project_child_completed_immutable();

create or replace function private.complete_project(
  target_project_id uuid,
  target_outcome_summary text,
  target_lessons_learned text default null,
  target_sustainment_summary text default null
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
    raise exception 'project completion is not authorised'
      using errcode = '42501';
  end if;

  if target_outcome_summary is null or btrim(target_outcome_summary) = '' then
    raise exception 'project completion requires an outcome summary'
      using errcode = '22023';
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
    raise exception 'project is not completable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project completion is not authorised'
      using errcode = '42501';
  end if;

  insert into public.ci_project_completion_snapshots (
    organisation_id,
    project_id,
    outcome_summary,
    lessons_learned,
    sustainment_summary,
    captured_by_membership_id
  )
  values (
    org_id,
    target_project_id,
    btrim(target_outcome_summary),
    target_lessons_learned,
    target_sustainment_summary,
    actor_membership_id
  );

  update public.ci_projects project_table
  set status = 'completed',
      actual_end_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    project_row.status,
    'completed',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.completed',
    target_project_id,
    'succeeded',
    jsonb_build_object('outcome_summary', btrim(target_outcome_summary))
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectCompleted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create policy ci_project_completion_snapshots_select
on public.ci_project_completion_snapshots for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, project_id)
);

grant select on public.ci_project_completion_snapshots to authenticated;

create or replace function public.complete_project(
  target_project_id uuid,
  target_outcome_summary text,
  target_lessons_learned text default null,
  target_sustainment_summary text default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.complete_project(
  target_project_id,
  target_outcome_summary,
  target_lessons_learned,
  target_sustainment_summary
) $$;

revoke execute on function public.complete_project(uuid) from authenticated;
grant execute on function public.complete_project(uuid, text, text, text) to authenticated;
revoke all on function public.complete_project(uuid, text, text, text) from public, anon;

alter function private.guard_ci_project_child_completed_immutable() owner to lean_hub_private_owner;
alter function private.complete_project(uuid, text, text, text) owner to lean_hub_private_owner;
