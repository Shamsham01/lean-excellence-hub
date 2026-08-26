-- Milestone 8: project team assignments (non-RBAC), status history, and active-member helper.

create table public.ci_project_team_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null,
  membership_id uuid not null,
  team_role text not null,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  assigned_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ci_project_team_assignments_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_team_assignments_project_member_role_from_key
    unique (organisation_id, project_id, membership_id, team_role, valid_from),
  constraint ci_project_team_assignments_project_fkey
    foreign key (organisation_id, project_id)
    references public.ci_projects(organisation_id, id)
    on delete restrict,
  constraint ci_project_team_assignments_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_project_team_assignments_assigner_fkey
    foreign key (organisation_id, assigned_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_project_team_assignments_role_check
    check (
      team_role in (
        'owner',
        'sponsor',
        'facilitator',
        'member'
      )
    ),
  constraint ci_project_team_assignments_valid_range_check
    check (valid_to is null or valid_to > valid_from)
);

create table public.ci_project_status_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null,
  from_status text not null,
  to_status text not null,
  changed_by_membership_id uuid not null,
  reason text,
  changed_at timestamptz not null default statement_timestamp(),
  constraint ci_project_status_history_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_status_history_project_fkey
    foreign key (organisation_id, project_id)
    references public.ci_projects(organisation_id, id)
    on delete restrict,
  constraint ci_project_status_history_actor_fkey
    foreign key (organisation_id, changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create trigger ci_project_team_assignments_prevent_org_change
before update on public.ci_project_team_assignments
for each row execute function private.prevent_organisation_id_change();

create trigger ci_project_status_history_prevent_update
before update on public.ci_project_status_history
for each row execute function private.prevent_update_or_delete();

create trigger ci_project_status_history_prevent_delete
before delete on public.ci_project_status_history
for each row execute function private.prevent_update_or_delete();

create index ci_project_team_assignments_project_idx
  on public.ci_project_team_assignments (organisation_id, project_id, team_role);
create index ci_project_team_assignments_member_idx
  on public.ci_project_team_assignments (organisation_id, membership_id);
create index ci_project_status_history_project_idx
  on public.ci_project_status_history (organisation_id, project_id, changed_at);

alter table public.ci_project_team_assignments enable row level security;
alter table public.ci_project_team_assignments force row level security;
alter table public.ci_project_status_history enable row level security;
alter table public.ci_project_status_history force row level security;

revoke all on public.ci_project_team_assignments from public, anon, authenticated, service_role;
revoke all on public.ci_project_status_history from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.ci_project_team_assignments to lean_hub_private_owner;
grant select, insert, update, delete on public.ci_project_status_history to lean_hub_private_owner;

create policy private_owner_all_ci_project_team_assignments
on public.ci_project_team_assignments for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ci_project_status_history
on public.ci_project_status_history for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.is_active_ci_project_team_member(
  target_organisation_id uuid,
  target_project_id uuid,
  target_membership_id uuid,
  target_team_role text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ci_project_team_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.project_id = target_project_id
      and assignment_row.membership_id = target_membership_id
      and assignment_row.valid_to is null
      and (
        target_team_role is null
        or assignment_row.team_role = target_team_role
      )
  )
$$;

create policy ci_project_team_assignments_select
on public.ci_project_team_assignments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, project_id)
);

create policy ci_project_status_history_select
on public.ci_project_status_history for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, project_id)
);

grant select on public.ci_project_team_assignments to authenticated;
grant select on public.ci_project_status_history to authenticated;

alter function private.is_active_ci_project_team_member(uuid, uuid, uuid, text) owner to lean_hub_private_owner;
