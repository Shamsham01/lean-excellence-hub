-- Job function authoritative operations and RLS policies.

create or replace function private.can_read_job_functions(
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
    'job_functions.read',
    null,
    null
  )
$$;

create or replace function private.can_manage_job_functions(
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
    'job_functions.manage',
    null,
    null
  )
$$;

create or replace function private.can_read_membership_job_function_assignment(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(
      target_organisation_id,
      'job_functions.read',
      null,
      null
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'people.capability.read',
      null,
      null
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'people.capability.read',
      target_membership_id,
      null
    )
    or (
      target_unit_id is not null
      and private.has_scoped_permission(
        target_organisation_id,
        'people.capability.read',
        null,
        target_unit_id
      )
    )
$$;

create or replace function private.create_job_function(
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
  new_job_function_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_job_functions(org_id) then
    raise exception 'job function creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.job_functions (
    organisation_id,
    name,
    code,
    description,
    created_by_membership_id
  )
  values (
    org_id,
    btrim(target_name),
    lower(btrim(target_code)),
    target_description,
    actor_membership_id
  )
  returning id into new_job_function_id;

  perform private.append_business_audit(
    org_id,
    'job_function.created',
    null,
    'succeeded',
    jsonb_build_object('job_function_id', new_job_function_id, 'code', lower(btrim(target_code)))
  );

  return new_job_function_id;
end;
$$;

create or replace function private.update_job_function(
  target_job_function_id uuid,
  target_name text,
  target_description text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.can_manage_job_functions(org_id) then
    raise exception 'job function update is not authorised'
      using errcode = '42501';
  end if;

  update public.job_functions job_function_row
  set
    name = btrim(target_name),
    description = target_description,
    version = job_function_row.version + 1,
    updated_at = statement_timestamp()
  where job_function_row.organisation_id = org_id
    and job_function_row.id = target_job_function_id
    and job_function_row.status = 'active';

  if not found then
    raise exception 'job function not found or not active'
      using errcode = 'P0002';
  end if;

  perform private.append_business_audit(
    org_id,
    'job_function.updated',
    null,
    'succeeded',
    jsonb_build_object('job_function_id', target_job_function_id)
  );

  return true;
end;
$$;

create or replace function private.deactivate_job_function(
  target_job_function_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.can_manage_job_functions(org_id) then
    raise exception 'job function deactivation is not authorised'
      using errcode = '42501';
  end if;

  update public.job_functions job_function_row
  set
    status = 'deactivated',
    deactivated_at = statement_timestamp(),
    version = job_function_row.version + 1,
    updated_at = statement_timestamp()
  where job_function_row.organisation_id = org_id
    and job_function_row.id = target_job_function_id
    and job_function_row.status = 'active';

  if not found then
    raise exception 'job function not found or not active'
      using errcode = 'P0002';
  end if;

  perform private.enqueue_domain_event(
    org_id,
    null,
    'JobFunctionDeactivated',
    target_job_function_id::text,
    jsonb_build_object('job_function_id', target_job_function_id)
  );

  return true;
end;
$$;

create or replace function private.assign_membership_job_function(
  target_membership_id uuid,
  target_job_function_id uuid,
  target_primary boolean default false,
  target_organisational_unit_id uuid default null,
  target_valid_from timestamptz default statement_timestamp(),
  target_valid_to timestamptz default null,
  target_assignment_reason text default null
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
  membership_row public.organisation_memberships%rowtype;
  job_function_row public.job_functions%rowtype;
  new_assignment_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_job_functions(org_id) then
    raise exception 'job function assignment is not authorised'
      using errcode = '42501';
  end if;

  select membership_registry.*
  into membership_row
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = org_id
    and membership_registry.id = target_membership_id;

  if not found or membership_row.status <> 'active' then
    raise exception 'membership is not active'
      using errcode = '22023';
  end if;

  select job_function_registry.*
  into job_function_row
  from public.job_functions job_function_registry
  where job_function_registry.organisation_id = org_id
    and job_function_registry.id = target_job_function_id
    and job_function_registry.status = 'active';

  if not found then
    raise exception 'job function not found or not active'
      using errcode = 'P0002';
  end if;

  if target_valid_to is not null and target_valid_to <= target_valid_from then
    raise exception 'assignment valid_to must be after valid_from'
      using errcode = '22023';
  end if;

  insert into public.membership_job_function_assignments (
    organisation_id,
    membership_id,
    job_function_id,
    organisational_unit_id,
    is_primary,
    valid_from,
    valid_to,
    job_function_name_snapshot,
    job_function_code_snapshot,
    assigned_by_membership_id,
    assignment_reason
  )
  values (
    org_id,
    target_membership_id,
    target_job_function_id,
    target_organisational_unit_id,
    target_primary,
    target_valid_from,
    target_valid_to,
    job_function_row.name,
    job_function_row.code,
    actor_membership_id,
    target_assignment_reason
  )
  returning id into new_assignment_id;

  perform private.enqueue_domain_event(
    org_id,
    null,
    'JobFunctionAssigned',
    new_assignment_id::text,
    jsonb_build_object(
      'membership_id', target_membership_id,
      'primary', target_primary,
      'job_function_id', target_job_function_id
    )
  );

  return new_assignment_id;
end;
$$;

create or replace function private.end_membership_job_function_assignment(
  target_assignment_id uuid,
  target_valid_to timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  assignment_row public.membership_job_function_assignments%rowtype;
begin
  if org_id is null
    or not private.can_manage_job_functions(org_id) then
    raise exception 'job function assignment end is not authorised'
      using errcode = '42501';
  end if;

  select assignment_registry.*
  into assignment_row
  from public.membership_job_function_assignments assignment_registry
  where assignment_registry.organisation_id = org_id
    and assignment_registry.id = target_assignment_id
    and assignment_registry.valid_to is null;

  if not found then
    raise exception 'active assignment not found'
      using errcode = 'P0002';
  end if;

  if target_valid_to <= assignment_row.valid_from then
    raise exception 'assignment valid_to must be after valid_from'
      using errcode = '22023';
  end if;

  update public.membership_job_function_assignments assignment_registry
  set
    valid_to = target_valid_to,
    updated_at = statement_timestamp()
  where assignment_registry.organisation_id = org_id
    and assignment_registry.id = target_assignment_id;

  return true;
end;
$$;

create policy job_functions_select
on public.job_functions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_job_functions(organisation_id)
);

create policy membership_job_function_assignments_select
on public.membership_job_function_assignments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_membership_job_function_assignment(
    organisation_id,
    membership_id,
    organisational_unit_id
  )
);

grant select on public.job_functions to authenticated;
grant select on public.membership_job_function_assignments to authenticated;

create or replace function public.create_job_function(
  target_name text,
  target_code text,
  target_description text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_job_function(target_name, target_code, target_description) $$;

create or replace function public.update_job_function(
  target_job_function_id uuid,
  target_name text,
  target_description text default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.update_job_function(target_job_function_id, target_name, target_description) $$;

create or replace function public.deactivate_job_function(target_job_function_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.deactivate_job_function(target_job_function_id) $$;

create or replace function public.assign_membership_job_function(
  target_membership_id uuid,
  target_job_function_id uuid,
  target_primary boolean default false,
  target_organisational_unit_id uuid default null,
  target_valid_from timestamptz default statement_timestamp(),
  target_valid_to timestamptz default null,
  target_assignment_reason text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.assign_membership_job_function(
  target_membership_id,
  target_job_function_id,
  target_primary,
  target_organisational_unit_id,
  target_valid_from,
  target_valid_to,
  target_assignment_reason
) $$;

create or replace function public.end_membership_job_function_assignment(
  target_assignment_id uuid,
  target_valid_to timestamptz default statement_timestamp()
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.end_membership_job_function_assignment(target_assignment_id, target_valid_to) $$;

grant execute on function public.create_job_function(text, text, text) to authenticated;
grant execute on function public.update_job_function(uuid, text, text) to authenticated;
grant execute on function public.deactivate_job_function(uuid) to authenticated;
grant execute on function public.assign_membership_job_function(
  uuid, uuid, boolean, uuid, timestamptz, timestamptz, text
) to authenticated;
grant execute on function public.end_membership_job_function_assignment(uuid, timestamptz) to authenticated;

revoke all on function public.create_job_function(text, text, text) from public, anon;
revoke all on function public.update_job_function(uuid, text, text) from public, anon;
revoke all on function public.deactivate_job_function(uuid) from public, anon;
revoke all on function public.assign_membership_job_function(
  uuid, uuid, boolean, uuid, timestamptz, timestamptz, text
) from public, anon;
revoke all on function public.end_membership_job_function_assignment(uuid, timestamptz) from public, anon;

alter function private.can_read_job_functions(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_job_functions(uuid) owner to lean_hub_private_owner;
alter function private.can_read_membership_job_function_assignment(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.create_job_function(text, text, text) owner to lean_hub_private_owner;
alter function private.update_job_function(uuid, text, text) owner to lean_hub_private_owner;
alter function private.deactivate_job_function(uuid) owner to lean_hub_private_owner;
alter function private.assign_membership_job_function(
  uuid, uuid, boolean, uuid, timestamptz, timestamptz, text
) owner to lean_hub_private_owner;
alter function private.end_membership_job_function_assignment(uuid, timestamptz) owner to lean_hub_private_owner;
