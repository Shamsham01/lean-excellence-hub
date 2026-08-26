-- Milestone 8: CI improvement projects domain.

create table public.ci_projects (
  id uuid primary key,
  organisation_id uuid not null,
  project_number text not null,
  title text not null,
  problem_statement text,
  objective text,
  expected_impact_summary text,
  unit_id uuid not null,
  status text not null default 'draft',
  charter_submitted_at timestamptz,
  charter_submitted_by_membership_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ci_projects_organisation_id_id_key unique (organisation_id, id),
  constraint ci_projects_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint ci_projects_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint ci_projects_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_projects_charter_submitter_fkey
    foreign key (organisation_id, charter_submitted_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_projects_number_org_key unique (organisation_id, project_number),
  constraint ci_projects_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint ci_projects_status_check
    check (status in ('draft', 'charter_submitted', 'active', 'completed', 'cancelled'))
);

create table public.ci_project_source_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null,
  source_resource_id uuid not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ci_project_source_links_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_source_links_project_source_key
    unique (organisation_id, project_id, source_resource_id),
  constraint ci_project_source_links_project_fkey
    foreign key (organisation_id, project_id)
    references public.ci_projects(organisation_id, id)
    on delete restrict,
  constraint ci_project_source_links_source_fkey
    foreign key (organisation_id, source_resource_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint ci_project_source_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create trigger ci_projects_touch_updated_at
before update on public.ci_projects
for each row execute function private.touch_updated_at();

create trigger ci_projects_prevent_org_change
before update on public.ci_projects
for each row execute function private.prevent_organisation_id_change();

create trigger ci_project_source_links_prevent_org_change
before update on public.ci_project_source_links
for each row execute function private.prevent_organisation_id_change();

create index ci_projects_org_status_idx on public.ci_projects (organisation_id, status);
create index ci_projects_org_unit_idx on public.ci_projects (organisation_id, unit_id);
create index ci_project_source_links_project_idx
  on public.ci_project_source_links (organisation_id, project_id);
create index ci_project_source_links_source_idx
  on public.ci_project_source_links (organisation_id, source_resource_id);

alter table public.ci_projects enable row level security;
alter table public.ci_projects force row level security;
alter table public.ci_project_source_links enable row level security;
alter table public.ci_project_source_links force row level security;

revoke all on public.ci_projects from public, anon, authenticated, service_role;
revoke all on public.ci_project_source_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.ci_projects to lean_hub_private_owner;
grant select, insert, update, delete on public.ci_project_source_links to lean_hub_private_owner;

create policy private_owner_all_ci_projects
on public.ci_projects for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ci_project_source_links
on public.ci_project_source_links for all to lean_hub_private_owner
using (true) with check (true);
