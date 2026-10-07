-- Skills authoring stays on the existing private RPCs.
-- Published and archived versions cannot gain levels or requirements.
-- Publish rejects an incomplete scale or skills standard.
-- Hosted Supabase is not modified by this migration file until it is applied there.

create or replace function private.assert_skill_requirement_targets(
  target_organisation_id uuid,
  target_skill_id uuid,
  target_job_function_id uuid,
  target_proficiency_scale_version_id uuid,
  target_target_proficiency_level_id uuid,
  target_organisational_unit_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.skills skill_row
    where skill_row.organisation_id = target_organisation_id
      and skill_row.id = target_skill_id
      and skill_row.status = 'active'
    for share
  ) then
    raise exception 'skill is not active'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.job_functions job_function_row
    where job_function_row.organisation_id = target_organisation_id
      and job_function_row.id = target_job_function_id
      and job_function_row.status = 'active'
    for share
  ) then
    raise exception 'job function is not active'
      using errcode = '22023';
  end if;

  if target_organisational_unit_id is not null
    and not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = target_organisation_id
        and unit_row.id = target_organisational_unit_id
        and unit_row.status = 'active'
      for share
    ) then
    raise exception 'organisational unit is not active'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.skill_proficiency_scale_versions scale_version
    where scale_version.organisation_id = target_organisation_id
      and scale_version.id = target_proficiency_scale_version_id
      and scale_version.status = 'published'
    for share
  ) then
    raise exception 'proficiency scale version is not published'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.skill_proficiency_levels level_row
    where level_row.organisation_id = target_organisation_id
      and level_row.id = target_target_proficiency_level_id
      and level_row.scale_version_id = target_proficiency_scale_version_id
    for share
  ) then
    raise exception 'target proficiency level is incompatible with scale version'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.add_skill_proficiency_level(
  target_scale_version_id uuid,
  target_order_value integer,
  target_label text,
  target_description text default null,
  target_semantic_token text default null,
  target_guidance text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  version_row public.skill_proficiency_scale_versions%rowtype;
  new_level_id uuid;
begin
  if org_id is null
    or not private.can_manage_skills_catalog(org_id) then
    raise exception 'proficiency level creation is not authorised'
      using errcode = '42501';
  end if;

  select version_registry.*
  into version_row
  from public.skill_proficiency_scale_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_scale_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft scale version not found'
      using errcode = 'P0002';
  end if;

  insert into public.skill_proficiency_levels (
    organisation_id,
    scale_version_id,
    order_value,
    label,
    description,
    semantic_token,
    guidance
  )
  values (
    org_id,
    version_row.id,
    target_order_value,
    btrim(target_label),
    target_description,
    target_semantic_token,
    target_guidance
  )
  returning id into new_level_id;

  return new_level_id;
end;
$$;

create or replace function private.publish_skill_proficiency_scale_version(
  target_scale_version_id uuid
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
  version_row public.skill_proficiency_scale_versions%rowtype;
  level_count integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_skills_catalog(org_id) then
    raise exception 'proficiency scale publish is not authorised'
      using errcode = '42501';
  end if;

  select version_registry.*
  into version_row
  from public.skill_proficiency_scale_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_scale_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft scale version not found'
      using errcode = 'P0002';
  end if;

  select count(*)
  into level_count
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.scale_version_id = version_row.id;

  if level_count < 2 then
    raise exception 'proficiency scale needs at least two levels'
      using errcode = '22023';
  end if;

  update public.skill_proficiency_scale_versions published_row
  set status = 'archived', archived_at = statement_timestamp()
  where published_row.organisation_id = org_id
    and published_row.scale_id = version_row.scale_id
    and published_row.status = 'published';

  update public.skill_proficiency_scale_versions version_registry
  set
    status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = actor_membership_id
  where version_registry.organisation_id = org_id
    and version_registry.id = version_row.id;

  return true;
end;
$$;

create or replace function private.add_skill_requirement(
  target_capability_set_version_id uuid,
  target_skill_id uuid,
  target_job_function_id uuid,
  target_proficiency_scale_version_id uuid,
  target_target_proficiency_level_id uuid,
  target_organisational_unit_id uuid default null,
  target_mandatory boolean default true,
  target_evidence_requirement text default null,
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
  version_row public.skill_capability_set_versions%rowtype;
  new_requirement_id uuid;
begin
  if org_id is null
    or not private.can_manage_skill_requirements(org_id) then
    raise exception 'skill requirement creation is not authorised'
      using errcode = '42501';
  end if;

  select version_registry.*
  into version_row
  from public.skill_capability_set_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_capability_set_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft capability set version not found'
      using errcode = 'P0002';
  end if;

  perform private.assert_skill_requirement_targets(
    org_id,
    target_skill_id,
    target_job_function_id,
    target_proficiency_scale_version_id,
    target_target_proficiency_level_id,
    target_organisational_unit_id
  );

  insert into public.skill_requirements (
    organisation_id,
    capability_set_version_id,
    skill_id,
    job_function_id,
    organisational_unit_id,
    proficiency_scale_version_id,
    target_proficiency_level_id,
    mandatory,
    evidence_requirement,
    notes
  )
  values (
    org_id,
    version_row.id,
    target_skill_id,
    target_job_function_id,
    target_organisational_unit_id,
    target_proficiency_scale_version_id,
    target_target_proficiency_level_id,
    target_mandatory,
    target_evidence_requirement,
    target_notes
  )
  returning id into new_requirement_id;

  return new_requirement_id;
end;
$$;

create or replace function private.publish_skill_capability_set_version(
  target_capability_set_version_id uuid
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
  version_row public.skill_capability_set_versions%rowtype;
  requirement_row public.skill_requirements%rowtype;
  requirement_count integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_skill_requirements(org_id) then
    raise exception 'skill capability set publish is not authorised'
      using errcode = '42501';
  end if;

  select version_registry.*
  into version_row
  from public.skill_capability_set_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_capability_set_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft capability set version not found'
      using errcode = 'P0002';
  end if;

  select count(*)
  into requirement_count
  from public.skill_requirements requirement
  where requirement.organisation_id = org_id
    and requirement.capability_set_version_id = version_row.id;

  if requirement_count < 1 then
    raise exception 'skills standard needs at least one requirement'
      using errcode = '22023';
  end if;

  for requirement_row in
    select requirement.*
    from public.skill_requirements requirement
    where requirement.organisation_id = org_id
      and requirement.capability_set_version_id = version_row.id
    order by requirement.id
    for update
  loop
    perform private.assert_skill_requirement_targets(
      org_id,
      requirement_row.skill_id,
      requirement_row.job_function_id,
      requirement_row.proficiency_scale_version_id,
      requirement_row.target_proficiency_level_id,
      requirement_row.organisational_unit_id
    );
  end loop;

  update public.skill_capability_set_versions published_row
  set status = 'archived', archived_at = statement_timestamp()
  where published_row.organisation_id = org_id
    and published_row.capability_set_id = version_row.capability_set_id
    and published_row.status = 'published';

  update public.skill_capability_set_versions version_registry
  set
    status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = actor_membership_id
  where version_registry.organisation_id = org_id
    and version_registry.id = version_row.id;

  return true;
end;
$$;

alter function private.assert_skill_requirement_targets(uuid, uuid, uuid, uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.add_skill_proficiency_level(uuid, integer, text, text, text, text)
  owner to lean_hub_private_owner;
alter function private.publish_skill_proficiency_scale_version(uuid)
  owner to lean_hub_private_owner;
alter function private.add_skill_requirement(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text, text)
  owner to lean_hub_private_owner;
alter function private.publish_skill_capability_set_version(uuid)
  owner to lean_hub_private_owner;

revoke all on function private.assert_skill_requirement_targets(uuid, uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
