-- Primary organisational assignment replacement: atomically close the current
-- active primary and open the replacement without violating the overlap exclusion.

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
  current_primary_assignment public.membership_job_function_assignments%rowtype;
  new_assignment_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'job function assignment is not authorised'
      using errcode = '42501';
  end if;

  if target_primary and target_organisational_unit_id is null then
    raise exception 'primary assignment requires an organisational unit'
      using errcode = '22023';
  end if;

  if not private.can_manage_job_functions_in_unit(
    org_id,
    target_organisational_unit_id
  ) then
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

  if target_organisational_unit_id is not null then
    if not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = target_organisational_unit_id
        and unit_row.status = 'active'
    ) then
      raise exception 'organisational unit not found or not active'
        using errcode = 'P0002';
    end if;

    if not private.has_scoped_permission(
      org_id,
      'hierarchy.read',
      null,
      target_organisational_unit_id
    ) then
      raise exception 'job function assignment unit is not authorised'
        using errcode = '42501';
    end if;
  end if;

  if target_valid_to is not null and target_valid_to <= target_valid_from then
    raise exception 'assignment valid_to must be after valid_from'
      using errcode = '22023';
  end if;

  perform private.assert_membership_placement_site_containment(
    org_id,
    actor_membership_id,
    target_organisational_unit_id
  );

  if target_primary and target_valid_to is null then
    select assignment_registry.*
    into current_primary_assignment
    from public.membership_job_function_assignments assignment_registry
    where assignment_registry.organisation_id = org_id
      and assignment_registry.membership_id = target_membership_id
      and assignment_registry.is_primary = true
      and assignment_registry.valid_to is null
    for update;

    if found then
      if current_primary_assignment.job_function_id = target_job_function_id
        and current_primary_assignment.organisational_unit_id
          is not distinct from target_organisational_unit_id then
        return current_primary_assignment.id;
      end if;

      if target_valid_from <= current_primary_assignment.valid_from then
        raise exception 'replacement valid_from must be after current primary valid_from'
          using errcode = '22023';
      end if;

      update public.membership_job_function_assignments assignment_registry
      set
        valid_to = target_valid_from,
        updated_at = statement_timestamp()
      where assignment_registry.organisation_id = org_id
        and assignment_registry.id = current_primary_assignment.id;
    end if;
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

alter function private.assign_membership_job_function(
  uuid, uuid, boolean, uuid, timestamptz, timestamptz, text
) owner to lean_hub_private_owner;
