-- Milestone 8: CI project operations and read policies.

create or replace function private.can_read_ci_project(
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
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'projects.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'projects.read',
          null,
          project_row.unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'projects.read',
          project_row.created_by_membership_id,
          null
        )
      )
  )
$$;

create or replace function private.can_manage_ci_project_in_unit(
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
    'projects.manage',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'projects.manage',
    null,
    target_unit_id
  )
$$;

create or replace function private.link_ci_project_source(
  target_organisation_id uuid,
  target_project_id uuid,
  target_source_resource_id uuid,
  target_actor_membership_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_link_id uuid;
begin
  if not private.can_read_ci_project(target_organisation_id, target_project_id) then
    raise exception 'project source link is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_reference_source_resource(
    target_organisation_id,
    target_source_resource_id
  ) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  insert into public.ci_project_source_links (
    organisation_id,
    project_id,
    source_resource_id,
    created_by_membership_id
  )
  values (
    target_organisation_id,
    target_project_id,
    target_source_resource_id,
    target_actor_membership_id
  )
  on conflict (organisation_id, project_id, source_resource_id) do nothing
  returning id into new_link_id;

  if new_link_id is null then
    select link_row.id
    into new_link_id
    from public.ci_project_source_links link_row
    where link_row.organisation_id = target_organisation_id
      and link_row.project_id = target_project_id
      and link_row.source_resource_id = target_source_resource_id;
  end if;

  return new_link_id;
end;
$$;

create or replace function private.create_improvement_project(
  target_title text,
  target_unit_id uuid,
  target_problem_statement text default null,
  target_objective text default null,
  target_expected_impact_summary text default null,
  target_source_resource_id uuid default null
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
  new_project_id uuid;
  project_number text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_ci_project_in_unit(org_id, target_unit_id) then
    raise exception 'improvement project creation is not authorised'
      using errcode = '42501';
  end if;

  if target_source_resource_id is not null
    and not private.can_reference_source_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  new_project_id := private.register_resource_record(
    org_id,
    'ci_project',
    gen_random_uuid(),
    actor_membership_id
  );

  project_number := private.allocate_organisation_document_number(
    org_id,
    'ci_project',
    'PROJ'
  );

  insert into public.ci_projects (
    id,
    organisation_id,
    project_number,
    title,
    problem_statement,
    objective,
    expected_impact_summary,
    unit_id,
    status,
    created_by_membership_id
  )
  values (
    new_project_id,
    org_id,
    project_number,
    btrim(target_title),
    target_problem_statement,
    target_objective,
    target_expected_impact_summary,
    target_unit_id,
    'draft',
    actor_membership_id
  );

  if target_source_resource_id is not null then
    perform private.link_ci_project_source(
      org_id,
      new_project_id,
      target_source_resource_id,
      actor_membership_id
    );
  end if;

  perform private.append_business_audit(
    org_id,
    'ci_project.created',
    new_project_id,
    'succeeded',
    jsonb_build_object('project_number', project_number)
  );

  perform private.enqueue_domain_event(
    org_id,
    new_project_id,
    'CiProjectCreated',
    new_project_id::text,
    jsonb_build_object('project_id', new_project_id)
  );

  return new_project_id;
end;
$$;

create or replace function private.submit_ci_project_charter(
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
    raise exception 'charter submission is not authorised'
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

  if project_row.status <> 'draft' then
    raise exception 'project charter is not submittable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'charter submission is not authorised'
      using errcode = '42501';
  end if;

  if btrim(project_row.title) = ''
    or project_row.problem_statement is null
    or btrim(project_row.problem_statement) = ''
    or project_row.objective is null
    or btrim(project_row.objective) = '' then
    raise exception 'project charter is incomplete'
      using errcode = '22023';
  end if;

  update public.ci_projects project_table
  set status = 'charter_submitted',
      charter_submitted_at = statement_timestamp(),
      charter_submitted_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_business_audit(
    org_id,
    'ci_project.charter_submitted',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectCharterSubmitted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create policy ci_projects_select
on public.ci_projects for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, id)
);

create policy ci_project_source_links_select
on public.ci_project_source_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_ci_project(organisation_id, project_id)
);

create or replace function public.create_improvement_project(
  target_title text,
  target_unit_id uuid,
  target_problem_statement text default null,
  target_objective text default null,
  target_expected_impact_summary text default null,
  target_source_resource_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_improvement_project(
  target_title,
  target_unit_id,
  target_problem_statement,
  target_objective,
  target_expected_impact_summary,
  target_source_resource_id
) $$;

create or replace function public.submit_ci_project_charter(target_project_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.submit_ci_project_charter(target_project_id) $$;

grant execute on function public.create_improvement_project(
  text, uuid, text, text, text, uuid
) to authenticated;
grant execute on function public.submit_ci_project_charter(uuid) to authenticated;

revoke all on function private.create_improvement_project(
  text, uuid, text, text, text, uuid
) from public;
revoke all on function private.submit_ci_project_charter(uuid) from public;
revoke all on function private.link_ci_project_source(uuid, uuid, uuid, uuid) from public;
grant execute on function private.create_improvement_project(
  text, uuid, text, text, text, uuid
) to lean_hub_private_owner;
grant execute on function private.submit_ci_project_charter(uuid) to lean_hub_private_owner;
grant execute on function private.link_ci_project_source(uuid, uuid, uuid, uuid) to lean_hub_private_owner;

alter function private.create_improvement_project(
  text, uuid, text, text, text, uuid
) owner to lean_hub_private_owner;
alter function private.submit_ci_project_charter(uuid) owner to lean_hub_private_owner;
alter function private.link_ci_project_source(uuid, uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_ci_project(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_manage_ci_project_in_unit(uuid, uuid) owner to lean_hub_private_owner;
