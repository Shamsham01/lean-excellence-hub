-- Draft-only requirement update/remove and curriculum successor versions.
-- Existing create/add/publish contracts are reused. add_training_requirement is
-- tightened so published history cannot be mutated in place.

create or replace function private.add_training_requirement(
  target_curriculum_version_id uuid,
  target_course_id uuid,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_applies_to_all_members boolean default false,
  target_mandatory boolean default true,
  target_required_within_days integer default null,
  target_validity_days_override integer default null,
  target_grace_period_days integer default null,
  target_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  version_row public.training_curriculum_versions%rowtype;
  new_requirement_id uuid;
begin
  if org_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training requirement creation is not authorised'
      using errcode = '42501';
  end if;

  select version_registry.*
  into version_row
  from public.training_curriculum_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_curriculum_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft curriculum version not found'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.training_courses course_row
    where course_row.organisation_id = org_id
      and course_row.id = target_course_id
  ) then
    raise exception 'training course not found'
      using errcode = 'P0002';
  end if;

  if target_job_function_id is not null
    and not exists (
      select 1
      from public.job_functions job_function_row
      where job_function_row.organisation_id = org_id
        and job_function_row.id = target_job_function_id
    ) then
    raise exception 'job function not found'
      using errcode = 'P0002';
  end if;

  if target_organisational_unit_id is not null
    and not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = target_organisational_unit_id
    ) then
    raise exception 'organisational unit not found'
      using errcode = 'P0002';
  end if;

  insert into public.training_requirements (
    organisation_id,
    curriculum_version_id,
    course_id,
    job_function_id,
    organisational_unit_id,
    applies_to_all_members,
    mandatory,
    required_within_days,
    validity_days_override,
    grace_period_days,
    notes
  )
  values (
    org_id,
    target_curriculum_version_id,
    target_course_id,
    target_job_function_id,
    target_organisational_unit_id,
    target_applies_to_all_members,
    target_mandatory,
    target_required_within_days,
    target_validity_days_override,
    target_grace_period_days,
    target_notes
  )
  returning id into new_requirement_id;

  perform private.enqueue_domain_event(
    org_id,
    target_course_id,
    'TrainingRequirementChanged',
    new_requirement_id::text,
    jsonb_build_object('curriculum_version_id', target_curriculum_version_id)
  );

  return new_requirement_id;
end;
$$;

create or replace function private.update_training_requirement(
  target_requirement_id uuid,
  target_course_id uuid,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_applies_to_all_members boolean default false,
  target_mandatory boolean default true,
  target_required_within_days integer default null,
  target_validity_days_override integer default null,
  target_grace_period_days integer default null,
  target_notes text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  requirement_row public.training_requirements%rowtype;
  version_row public.training_curriculum_versions%rowtype;
begin
  if org_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training requirement update is not authorised'
      using errcode = '42501';
  end if;

  select requirement_registry.*
  into requirement_row
  from public.training_requirements requirement_registry
  where requirement_registry.organisation_id = org_id
    and requirement_registry.id = target_requirement_id;

  if not found then
    raise exception 'training requirement not found'
      using errcode = 'P0002';
  end if;

  select version_registry.*
  into version_row
  from public.training_curriculum_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = requirement_row.curriculum_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft curriculum version not found'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.training_courses course_row
    where course_row.organisation_id = org_id
      and course_row.id = target_course_id
  ) then
    raise exception 'training course not found'
      using errcode = 'P0002';
  end if;

  if target_job_function_id is not null
    and not exists (
      select 1
      from public.job_functions job_function_row
      where job_function_row.organisation_id = org_id
        and job_function_row.id = target_job_function_id
    ) then
    raise exception 'job function not found'
      using errcode = 'P0002';
  end if;

  if target_organisational_unit_id is not null
    and not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = target_organisational_unit_id
    ) then
    raise exception 'organisational unit not found'
      using errcode = 'P0002';
  end if;

  update public.training_requirements requirement_registry
  set
    course_id = target_course_id,
    job_function_id = target_job_function_id,
    organisational_unit_id = target_organisational_unit_id,
    applies_to_all_members = target_applies_to_all_members,
    mandatory = target_mandatory,
    required_within_days = target_required_within_days,
    validity_days_override = target_validity_days_override,
    grace_period_days = target_grace_period_days,
    notes = target_notes
  where requirement_registry.organisation_id = org_id
    and requirement_registry.id = target_requirement_id;

  perform private.enqueue_domain_event(
    org_id,
    target_course_id,
    'TrainingRequirementChanged',
    target_requirement_id::text,
    jsonb_build_object(
      'curriculum_version_id', requirement_row.curriculum_version_id
    )
  );

  return true;
end;
$$;

create or replace function private.remove_training_requirement(
  target_requirement_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  requirement_row public.training_requirements%rowtype;
  version_row public.training_curriculum_versions%rowtype;
begin
  if org_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training requirement removal is not authorised'
      using errcode = '42501';
  end if;

  select requirement_registry.*
  into requirement_row
  from public.training_requirements requirement_registry
  where requirement_registry.organisation_id = org_id
    and requirement_registry.id = target_requirement_id;

  if not found then
    raise exception 'training requirement not found'
      using errcode = 'P0002';
  end if;

  select version_registry.*
  into version_row
  from public.training_curriculum_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = requirement_row.curriculum_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft curriculum version not found'
      using errcode = 'P0002';
  end if;

  delete from public.training_requirements requirement_registry
  where requirement_registry.organisation_id = org_id
    and requirement_registry.id = target_requirement_id;

  perform private.enqueue_domain_event(
    org_id,
    requirement_row.course_id,
    'TrainingRequirementChanged',
    target_requirement_id::text,
    jsonb_build_object(
      'curriculum_version_id', requirement_row.curriculum_version_id,
      'removed', true
    )
  );

  return true;
end;
$$;

create or replace function private.create_training_curriculum_successor_version(
  target_curriculum_id uuid
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
  source_version public.training_curriculum_versions%rowtype;
  new_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training curriculum successor creation is not authorised'
      using errcode = '42501';
  end if;

  select version_row.*
  into source_version
  from public.training_curriculum_versions version_row
  where version_row.organisation_id = org_id
    and version_row.curriculum_id = target_curriculum_id
    and version_row.status = 'published'
  order by version_row.version_number desc
  limit 1
  for update;

  if not found then
    raise exception 'published curriculum version not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.training_curriculum_versions draft_row
    where draft_row.organisation_id = org_id
      and draft_row.curriculum_id = target_curriculum_id
      and draft_row.status = 'draft'
  ) then
    raise exception 'draft curriculum version already exists'
      using errcode = '55000';
  end if;

  insert into public.training_curriculum_versions (
    organisation_id,
    curriculum_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    target_curriculum_id,
    source_version.version_number + 1,
    'draft',
    actor_membership_id
  )
  returning id into new_version_id;

  insert into public.training_requirements (
    organisation_id,
    curriculum_version_id,
    course_id,
    job_function_id,
    organisational_unit_id,
    applies_to_all_members,
    mandatory,
    required_within_days,
    validity_days_override,
    grace_period_days,
    notes
  )
  select
    org_id,
    new_version_id,
    requirement_row.course_id,
    requirement_row.job_function_id,
    requirement_row.organisational_unit_id,
    requirement_row.applies_to_all_members,
    requirement_row.mandatory,
    requirement_row.required_within_days,
    requirement_row.validity_days_override,
    requirement_row.grace_period_days,
    requirement_row.notes
  from public.training_requirements requirement_row
  where requirement_row.organisation_id = org_id
    and requirement_row.curriculum_version_id = source_version.id;

  return new_version_id;
end;
$$;

create or replace function public.update_training_requirement(
  target_requirement_id uuid,
  target_course_id uuid,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_applies_to_all_members boolean default false,
  target_mandatory boolean default true,
  target_required_within_days integer default null,
  target_validity_days_override integer default null,
  target_grace_period_days integer default null,
  target_notes text default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$
  select private.update_training_requirement(
    target_requirement_id,
    target_course_id,
    target_job_function_id,
    target_organisational_unit_id,
    target_applies_to_all_members,
    target_mandatory,
    target_required_within_days,
    target_validity_days_override,
    target_grace_period_days,
    target_notes
  )
$$;

create or replace function public.remove_training_requirement(
  target_requirement_id uuid
)
returns boolean
language sql volatile security definer set search_path = ''
as $$
  select private.remove_training_requirement(target_requirement_id)
$$;

create or replace function public.create_training_curriculum_successor_version(
  target_curriculum_id uuid
)
returns uuid
language sql volatile security definer set search_path = ''
as $$
  select private.create_training_curriculum_successor_version(target_curriculum_id)
$$;

grant execute on function public.update_training_requirement(
  uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text
) to authenticated;
grant execute on function public.remove_training_requirement(uuid) to authenticated;
grant execute on function public.create_training_curriculum_successor_version(uuid) to authenticated;

revoke all on function public.update_training_requirement(
  uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text
) from public, anon;
revoke all on function public.remove_training_requirement(uuid) from public, anon;
revoke all on function public.create_training_curriculum_successor_version(uuid) from public, anon;

alter function private.add_training_requirement(
  uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text
) owner to lean_hub_private_owner;
alter function private.update_training_requirement(
  uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text
) owner to lean_hub_private_owner;
alter function private.remove_training_requirement(uuid) owner to lean_hub_private_owner;
alter function private.create_training_curriculum_successor_version(uuid) owner to lean_hub_private_owner;
