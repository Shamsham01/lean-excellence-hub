-- Milestone 8: CI project methodologies, versions, phases, and publish/successor RPCs.

create table public.ci_project_methodologies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  name text not null,
  code text not null,
  description text,
  status text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ci_project_methodologies_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_methodologies_org_code_key unique (organisation_id, code),
  constraint ci_project_methodologies_organisation_fkey
    foreign key (organisation_id)
    references public.organisations(id)
    on delete restrict,
  constraint ci_project_methodologies_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_project_methodologies_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint ci_project_methodologies_code_check
    check (code = btrim(code) and char_length(code) between 1 and 80),
  constraint ci_project_methodologies_status_check
    check (status in ('active', 'deactivated'))
);

create table public.ci_project_methodology_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  methodology_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  template_version_id uuid,
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ci_project_methodology_versions_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_methodology_versions_methodology_version_key
    unique (organisation_id, methodology_id, version_number),
  constraint ci_project_methodology_versions_template_version_key
    unique (organisation_id, template_version_id),
  constraint ci_project_methodology_versions_methodology_fkey
    foreign key (organisation_id, methodology_id)
    references public.ci_project_methodologies(organisation_id, id)
    on delete restrict,
  constraint ci_project_methodology_versions_template_version_fkey
    foreign key (organisation_id, template_version_id)
    references public.template_versions(organisation_id, id)
    on delete restrict,
  constraint ci_project_methodology_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_project_methodology_versions_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ci_project_methodology_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table public.ci_project_methodology_phases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  methodology_version_id uuid not null,
  phase_key text not null,
  title text not null,
  description text,
  display_order integer not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ci_project_methodology_phases_organisation_id_id_key unique (organisation_id, id),
  constraint ci_project_methodology_phases_version_order_key
    unique (organisation_id, methodology_version_id, display_order),
  constraint ci_project_methodology_phases_version_key_key
    unique (organisation_id, methodology_version_id, phase_key),
  constraint ci_project_methodology_phases_version_fkey
    foreign key (organisation_id, methodology_version_id)
    references public.ci_project_methodology_versions(organisation_id, id)
    on delete restrict,
  constraint ci_project_methodology_phases_phase_key_check
    check (phase_key = btrim(phase_key) and char_length(phase_key) between 1 and 80),
  constraint ci_project_methodology_phases_title_check
    check (title = btrim(title) and char_length(title) between 1 and 160),
  constraint ci_project_methodology_phases_display_order_check
    check (display_order > 0)
);

create trigger ci_project_methodologies_touch_updated_at
before update on public.ci_project_methodologies
for each row execute function private.touch_updated_at();

create trigger ci_project_methodologies_prevent_org_change
before update on public.ci_project_methodologies
for each row execute function private.prevent_organisation_id_change();

create trigger ci_project_methodology_versions_prevent_org_change
before update on public.ci_project_methodology_versions
for each row execute function private.prevent_organisation_id_change();

create trigger ci_project_methodology_phases_prevent_org_change
before update on public.ci_project_methodology_phases
for each row execute function private.prevent_organisation_id_change();

create index ci_project_methodology_versions_methodology_idx
  on public.ci_project_methodology_versions (organisation_id, methodology_id, status);
create index ci_project_methodology_phases_version_idx
  on public.ci_project_methodology_phases (organisation_id, methodology_version_id, display_order);

alter table public.ci_project_methodologies enable row level security;
alter table public.ci_project_methodologies force row level security;
alter table public.ci_project_methodology_versions enable row level security;
alter table public.ci_project_methodology_versions force row level security;
alter table public.ci_project_methodology_phases enable row level security;
alter table public.ci_project_methodology_phases force row level security;

revoke all on public.ci_project_methodologies from public, anon, authenticated, service_role;
revoke all on public.ci_project_methodology_versions from public, anon, authenticated, service_role;
revoke all on public.ci_project_methodology_phases from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.ci_project_methodologies to lean_hub_private_owner;
grant select, insert, update, delete on public.ci_project_methodology_versions to lean_hub_private_owner;
grant select, insert, update, delete on public.ci_project_methodology_phases to lean_hub_private_owner;

create policy private_owner_all_ci_project_methodologies
on public.ci_project_methodologies for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ci_project_methodology_versions
on public.ci_project_methodology_versions for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ci_project_methodology_phases
on public.ci_project_methodology_phases for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.can_read_ci_project_methodology_catalog(
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
    'projects.read',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'projects.manage',
    null,
    null
  )
$$;

create or replace function private.can_manage_ci_project_methodologies(
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
    'projects.manage',
    null,
    null
  )
$$;

create or replace function private.create_ci_project_methodology_draft(
  target_name text,
  target_code text,
  target_description text default null
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
  new_methodology_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_ci_project_methodologies(org_id) then
    raise exception 'methodology creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.ci_project_methodologies (
    organisation_id,
    name,
    code,
    description,
    created_by_membership_id
  )
  values (
    org_id,
    btrim(target_name),
    btrim(target_code),
    target_description,
    actor_membership_id
  )
  returning id into new_methodology_id;

  insert into public.ci_project_methodology_versions (
    organisation_id,
    methodology_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    new_methodology_id,
    1,
    'draft',
    actor_membership_id
  );

  return new_methodology_id;
end;
$$;

create or replace function private.add_ci_project_methodology_phase(
  target_methodology_version_id uuid,
  target_phase_key text,
  target_title text,
  target_display_order integer,
  target_description text default null
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
  version_row public.ci_project_methodology_versions%rowtype;
  new_phase_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_ci_project_methodologies(org_id) then
    raise exception 'methodology phase creation is not authorised'
      using errcode = '42501';
  end if;

  select version_table.*
  into version_row
  from public.ci_project_methodology_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_methodology_version_id
  for update;

  if not found or version_row.status <> 'draft' then
    raise exception 'methodology version is not editable'
      using errcode = '55000';
  end if;

  insert into public.ci_project_methodology_phases (
    organisation_id,
    methodology_version_id,
    phase_key,
    title,
    description,
    display_order
  )
  values (
    org_id,
    target_methodology_version_id,
    btrim(target_phase_key),
    btrim(target_title),
    target_description,
    target_display_order
  )
  returning id into new_phase_id;

  return new_phase_id;
end;
$$;

create or replace function private.publish_ci_project_methodology_version(
  target_methodology_version_id uuid
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
  version_row public.ci_project_methodology_versions%rowtype;
  phase_count integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_ci_project_methodologies(org_id) then
    raise exception 'methodology publish is not authorised'
      using errcode = '42501';
  end if;

  select version_table.*
  into version_row
  from public.ci_project_methodology_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_methodology_version_id
  for update;

  if not found or version_row.status <> 'draft' then
    raise exception 'methodology version is not publishable'
      using errcode = '55000';
  end if;

  select count(*)
  into phase_count
  from public.ci_project_methodology_phases phase_table
  where phase_table.organisation_id = org_id
    and phase_table.methodology_version_id = target_methodology_version_id;

  if phase_count = 0 then
    raise exception 'methodology version requires at least one phase'
      using errcode = '22023';
  end if;

  update public.ci_project_methodology_versions prior_version
  set status = 'archived',
      archived_at = statement_timestamp()
  where prior_version.organisation_id = org_id
    and prior_version.methodology_id = version_row.methodology_id
    and prior_version.status = 'published';

  update public.ci_project_methodology_versions version_table
  set status = 'published',
      published_at = statement_timestamp(),
      published_by_membership_id = actor_membership_id
  where version_table.organisation_id = org_id
    and version_table.id = target_methodology_version_id;

  if version_row.template_version_id is not null then
    perform private.publish_template_version_internal(
      version_row.template_version_id,
      org_id,
      actor_membership_id
    );
  end if;

  perform private.append_business_audit(
    org_id,
    'ci_project_methodology.published',
    version_row.methodology_id,
    'succeeded',
    jsonb_build_object('methodology_version_id', target_methodology_version_id)
  );

  return true;
end;
$$;

create or replace function private.create_ci_project_methodology_successor_version(
  target_methodology_id uuid
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
  source_version_id uuid;
  source_version_number integer;
  new_version_id uuid;
  phase_row record;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_ci_project_methodologies(org_id) then
    raise exception 'methodology successor creation is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.ci_project_methodologies methodology_table
    where methodology_table.organisation_id = org_id
      and methodology_table.id = target_methodology_id
  ) then
    raise exception 'methodology was not found'
      using errcode = 'P0002';
  end if;

  select version_table.id, version_table.version_number
  into source_version_id, source_version_number
  from public.ci_project_methodology_versions version_table
  where version_table.organisation_id = org_id
    and version_table.methodology_id = target_methodology_id
    and version_table.status = 'published'
  order by version_table.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception 'methodology has no published version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.ci_project_methodology_versions version_table
    where version_table.organisation_id = org_id
      and version_table.methodology_id = target_methodology_id
      and version_table.status = 'draft'
  ) then
    raise exception 'methodology already has a draft version'
      using errcode = '55000';
  end if;

  insert into public.ci_project_methodology_versions (
    organisation_id,
    methodology_id,
    version_number,
    status,
    template_version_id,
    created_by_membership_id
  )
  select
    org_id,
    target_methodology_id,
    source_version_number + 1,
    'draft',
    source_version.template_version_id,
    actor_membership_id
  from public.ci_project_methodology_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_version_id;

  for phase_row in
    select
      phase_table.phase_key,
      phase_table.title,
      phase_table.description,
      phase_table.display_order
    from public.ci_project_methodology_phases phase_table
    where phase_table.organisation_id = org_id
      and phase_table.methodology_version_id = source_version_id
    order by phase_table.display_order
  loop
    insert into public.ci_project_methodology_phases (
      organisation_id,
      methodology_version_id,
      phase_key,
      title,
      description,
      display_order
    )
    values (
      org_id,
      new_version_id,
      phase_row.phase_key,
      phase_row.title,
      phase_row.description,
      phase_row.display_order
    );
  end loop;

  perform private.append_business_audit(
    org_id,
    'ci_project_methodology.successor_created',
    target_methodology_id,
    'succeeded',
    jsonb_build_object('methodology_version_id', new_version_id)
  );

  return new_version_id;
end;
$$;

create policy ci_project_methodologies_select
on public.ci_project_methodologies for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project_methodology_catalog(organisation_id)
);

create policy ci_project_methodology_versions_select
on public.ci_project_methodology_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project_methodology_catalog(organisation_id)
);

create policy ci_project_methodology_phases_select
on public.ci_project_methodology_phases for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project_methodology_catalog(organisation_id)
);

grant select on public.ci_project_methodologies to authenticated;
grant select on public.ci_project_methodology_versions to authenticated;
grant select on public.ci_project_methodology_phases to authenticated;

create or replace function public.create_ci_project_methodology_draft(
  target_name text,
  target_code text,
  target_description text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_ci_project_methodology_draft(target_name, target_code, target_description) $$;

create or replace function public.add_ci_project_methodology_phase(
  target_methodology_version_id uuid,
  target_phase_key text,
  target_title text,
  target_display_order integer,
  target_description text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_ci_project_methodology_phase(
  target_methodology_version_id,
  target_phase_key,
  target_title,
  target_display_order,
  target_description
) $$;

create or replace function public.publish_ci_project_methodology_version(target_methodology_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.publish_ci_project_methodology_version(target_methodology_version_id) $$;

create or replace function public.create_ci_project_methodology_successor_version(target_methodology_id uuid)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_ci_project_methodology_successor_version(target_methodology_id) $$;

grant execute on function public.create_ci_project_methodology_draft(text, text, text) to authenticated;
grant execute on function public.add_ci_project_methodology_phase(uuid, text, text, integer, text) to authenticated;
grant execute on function public.publish_ci_project_methodology_version(uuid) to authenticated;
grant execute on function public.create_ci_project_methodology_successor_version(uuid) to authenticated;

revoke all on function public.create_ci_project_methodology_draft(text, text, text) from public, anon;
revoke all on function public.add_ci_project_methodology_phase(uuid, text, text, integer, text) from public, anon;
revoke all on function public.publish_ci_project_methodology_version(uuid) from public, anon;
revoke all on function public.create_ci_project_methodology_successor_version(uuid) from public, anon;

alter function private.can_read_ci_project_methodology_catalog(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_ci_project_methodologies(uuid) owner to lean_hub_private_owner;
alter function private.create_ci_project_methodology_draft(text, text, text) owner to lean_hub_private_owner;
alter function private.add_ci_project_methodology_phase(uuid, text, text, integer, text) owner to lean_hub_private_owner;
alter function private.publish_ci_project_methodology_version(uuid) owner to lean_hub_private_owner;
alter function private.create_ci_project_methodology_successor_version(uuid) owner to lean_hub_private_owner;
