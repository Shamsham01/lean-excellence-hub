-- Milestone 8: project action context, evidence links, and create_project_action RPC.

create table public.ci_project_action_context (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  project_id uuid not null,
  project_phase_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ci_project_action_context_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_action_context_action_key unique (organisation_id, action_id),
  constraint ci_project_action_context_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint ci_project_action_context_project_fkey
    foreign key (organisation_id, project_id)
    references public.ci_projects(organisation_id, id)
    on delete restrict,
  constraint ci_project_action_context_phase_fkey
    foreign key (organisation_id, project_phase_id)
    references public.ci_project_phases(organisation_id, id)
    on delete restrict,
  constraint ci_project_action_context_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.ci_project_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null,
  attachment_id uuid not null,
  project_phase_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ci_project_evidence_links_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_evidence_links_project_attachment_key
    unique (organisation_id, project_id, attachment_id),
  constraint ci_project_evidence_links_project_fkey
    foreign key (organisation_id, project_id)
    references public.ci_projects(organisation_id, id)
    on delete restrict,
  constraint ci_project_evidence_links_attachment_fkey
    foreign key (organisation_id, attachment_id)
    references public.attachments(organisation_id, id)
    on delete restrict,
  constraint ci_project_evidence_links_phase_fkey
    foreign key (organisation_id, project_phase_id)
    references public.ci_project_phases(organisation_id, id)
    on delete restrict,
  constraint ci_project_evidence_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create trigger ci_project_action_context_prevent_org_change
before update on public.ci_project_action_context
for each row execute function private.prevent_organisation_id_change();

create trigger ci_project_evidence_links_prevent_org_change
before update on public.ci_project_evidence_links
for each row execute function private.prevent_organisation_id_change();

create index ci_project_action_context_project_idx
  on public.ci_project_action_context (organisation_id, project_id);
create index ci_project_evidence_links_project_idx
  on public.ci_project_evidence_links (organisation_id, project_id);

alter table public.ci_project_action_context enable row level security;
alter table public.ci_project_action_context force row level security;
alter table public.ci_project_evidence_links enable row level security;
alter table public.ci_project_evidence_links force row level security;

revoke all on public.ci_project_action_context from public, anon, authenticated, service_role;
revoke all on public.ci_project_evidence_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.ci_project_action_context to lean_hub_private_owner;
grant select, insert, update, delete on public.ci_project_evidence_links to lean_hub_private_owner;

create policy private_owner_all_ci_project_action_context
on public.ci_project_action_context for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ci_project_evidence_links
on public.ci_project_evidence_links for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.can_edit_ci_project(
  target_organisation_id uuid,
  target_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ci_projects project_row
    where project_row.organisation_id = target_organisation_id
      and project_row.id = target_project_id
      and project_row.status in ('active', 'on_hold')
      and private.can_manage_ci_project_in_unit(
        target_organisation_id,
        project_row.unit_id
      )
  )
$$;

create or replace function private.link_ci_project_evidence(
  target_project_id uuid,
  target_attachment_id uuid,
  target_project_phase_id uuid default null
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
  new_link_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'project evidence link is not authorised'
      using errcode = '42501';
  end if;

  insert into public.ci_project_evidence_links (
    organisation_id,
    project_id,
    attachment_id,
    project_phase_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_project_id,
    target_attachment_id,
    target_project_phase_id,
    actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
end;
$$;

create or replace function private.create_project_action(
  target_title text,
  target_project_id uuid,
  target_project_phase_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
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
  unit_id uuid;
  new_action_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'project action creation is not authorised'
      using errcode = '42501';
  end if;

  select project_row.unit_id
  into unit_id
  from public.ci_projects project_row
  where project_row.organisation_id = org_id
    and project_row.id = target_project_id;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_project_id,
    target_due_at,
    null
  );

  insert into public.ci_project_action_context (
    organisation_id,
    action_id,
    project_id,
    project_phase_id,
    created_by_membership_id
  )
  values (
    org_id,
    new_action_id,
    target_project_id,
    target_project_phase_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

create policy ci_project_action_context_select
on public.ci_project_action_context for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, project_id)
);

create policy ci_project_evidence_links_select
on public.ci_project_evidence_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, project_id)
);

grant select on public.ci_project_action_context to authenticated;
grant select on public.ci_project_evidence_links to authenticated;

create or replace function public.link_ci_project_evidence(
  target_project_id uuid,
  target_attachment_id uuid,
  target_project_phase_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.link_ci_project_evidence(
  target_project_id,
  target_attachment_id,
  target_project_phase_id
) $$;

create or replace function public.create_project_action(
  target_title text,
  target_project_id uuid,
  target_project_phase_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_project_action(
  target_title,
  target_project_id,
  target_project_phase_id,
  target_description,
  target_priority,
  target_due_at
) $$;

grant execute on function public.link_ci_project_evidence(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_project_action(
  text, uuid, uuid, text, text, timestamptz
) to authenticated;

revoke all on function public.link_ci_project_evidence(uuid, uuid, uuid) from public, anon;
revoke all on function public.create_project_action(
  text, uuid, uuid, text, text, timestamptz
) from public, anon;

alter function private.can_edit_ci_project(uuid, uuid) owner to lean_hub_private_owner;
alter function private.link_ci_project_evidence(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.create_project_action(
  text, uuid, uuid, text, text, timestamptz
) owner to lean_hub_private_owner;
