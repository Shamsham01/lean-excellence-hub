-- Skills authoritative operations, gap derivation, and RLS policies.

create or replace function private.can_read_skills_catalog(
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
    'skills.read',
    null,
    null
  )
$$;

create or replace function private.can_manage_skills_catalog(
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
    'skills.catalog.manage',
    null,
    null
  )
$$;

create or replace function private.can_manage_skill_requirements(
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
    'skills.requirements.manage',
    null,
    null
  )
$$;

create or replace function private.can_assess_skills(
  target_organisation_id uuid,
  target_membership_id uuid default null,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'skills.assess',
    null,
    null
  )
  or (
    target_membership_id is not null
    and private.has_scoped_permission(
      target_organisation_id,
      'skills.assess',
      target_membership_id,
      null
    )
  )
  or (
    target_unit_id is not null
    and private.has_scoped_permission(
      target_organisation_id,
      'skills.assess',
      null,
      target_unit_id
    )
  )
$$;

create or replace function private.can_read_skill_assessment(
  target_organisation_id uuid,
  target_assessment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membership_skill_assessments assessment_row
    where assessment_row.organisation_id = target_organisation_id
      and assessment_row.id = target_assessment_id
      and (
        private.can_read_skills_catalog(target_organisation_id)
        or private.has_scoped_permission(
          target_organisation_id,
          'people.capability.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'people.capability.read',
          assessment_row.membership_id,
          null
        )
      )
  )
$$;

create or replace function private.create_skill_proficiency_scale_draft(
  target_name text,
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
  new_scale_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_skills_catalog(org_id) then
    raise exception 'proficiency scale creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.skill_proficiency_scales (
    organisation_id, name, description, created_by_membership_id
  )
  values (org_id, btrim(target_name), target_description, actor_membership_id)
  returning id into new_scale_id;

  insert into public.skill_proficiency_scale_versions (
    organisation_id, scale_id, version_number, status, created_by_membership_id
  )
  values (org_id, new_scale_id, 1, 'draft', actor_membership_id);

  return new_scale_id;
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
  new_level_id uuid;
begin
  if org_id is null
    or not private.can_manage_skills_catalog(org_id) then
    raise exception 'proficiency level creation is not authorised'
      using errcode = '42501';
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
    target_scale_version_id,
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
    and version_registry.id = target_scale_version_id;

  return true;
end;
$$;

create or replace function private.create_skill(
  target_name text,
  target_code text,
  target_category text default null,
  target_description text default null,
  target_evidence_expectations text default null
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
  new_skill_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_skills_catalog(org_id) then
    raise exception 'skill creation is not authorised'
      using errcode = '42501';
  end if;

  new_skill_id := private.register_resource_record(
    org_id,
    'skill',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.skills (
    id,
    organisation_id,
    name,
    code,
    category,
    description,
    evidence_expectations,
    created_by_membership_id
  )
  values (
    new_skill_id,
    org_id,
    btrim(target_name),
    lower(btrim(target_code)),
    target_category,
    target_description,
    target_evidence_expectations,
    actor_membership_id
  );

  return new_skill_id;
end;
$$;

create or replace function private.create_skill_capability_set_draft(
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
  new_set_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_skill_requirements(org_id) then
    raise exception 'skill capability set creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.skill_capability_sets (
    organisation_id, name, code, description, created_by_membership_id
  )
  values (
    org_id,
    btrim(target_name),
    lower(btrim(target_code)),
    target_description,
    actor_membership_id
  )
  returning id into new_set_id;

  insert into public.skill_capability_set_versions (
    organisation_id,
    capability_set_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (org_id, new_set_id, 1, 'draft', actor_membership_id);

  return new_set_id;
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
  new_requirement_id uuid;
begin
  if org_id is null
    or not private.can_manage_skill_requirements(org_id) then
    raise exception 'skill requirement creation is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.skill_proficiency_levels level_row
    where level_row.organisation_id = org_id
      and level_row.id = target_target_proficiency_level_id
      and level_row.scale_version_id = target_proficiency_scale_version_id
  ) then
    raise exception 'target proficiency level is incompatible with scale version'
      using errcode = '22023';
  end if;

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
    target_capability_set_version_id,
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
    and version_registry.id = target_capability_set_version_id;

  return true;
end;
$$;

create or replace function private.record_skill_assessment_internal(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assertion_type text,
  target_is_authoritative boolean,
  target_assessed_at timestamptz,
  target_assessor_membership_id uuid,
  target_organisational_unit_id uuid default null,
  target_assessment_method text default null,
  target_valid_until timestamptz default null,
  target_notes text default null,
  target_supersedes_assessment_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  new_assessment_id uuid;
begin
  if not exists (
    select 1
    from public.skill_proficiency_levels level_row
    where level_row.organisation_id = org_id
      and level_row.id = target_proficiency_level_id
      and level_row.scale_version_id = target_proficiency_scale_version_id
  ) then
    raise exception 'proficiency level is incompatible with scale version'
      using errcode = '22023';
  end if;

  new_assessment_id := private.register_resource_record(
    org_id,
    'skill_assessment',
    gen_random_uuid(),
    target_assessor_membership_id
  );

  insert into public.membership_skill_assessments (
    id,
    organisation_id,
    membership_id,
    skill_id,
    proficiency_scale_version_id,
    proficiency_level_id,
    assertion_type,
    is_authoritative,
    assessed_at,
    assessor_membership_id,
    organisational_unit_id,
    assessment_method,
    valid_until,
    notes,
    supersedes_assessment_id,
    status
  )
  values (
    new_assessment_id,
    org_id,
    target_membership_id,
    target_skill_id,
    target_proficiency_scale_version_id,
    target_proficiency_level_id,
    target_assertion_type,
    target_is_authoritative,
    target_assessed_at,
    target_assessor_membership_id,
    target_organisational_unit_id,
    target_assessment_method,
    target_valid_until,
    target_notes,
    target_supersedes_assessment_id,
    'active'
  );

  if target_assertion_type = 'validated' then
    perform private.enqueue_domain_event(
      org_id,
      new_assessment_id,
      'SkillProficiencyValidated',
      new_assessment_id::text,
      jsonb_build_object('membership_id', target_membership_id, 'skill_id', target_skill_id)
    );
  else
    perform private.enqueue_domain_event(
      org_id,
      new_assessment_id,
      'SkillAssessmentRecorded',
      new_assessment_id::text,
      jsonb_build_object('membership_id', target_membership_id, 'skill_id', target_skill_id)
    );
  end if;

  return new_assessment_id;
end;
$$;

create or replace function private.record_skill_self_assessment(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_assessment_method text default 'self_assessment',
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
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'skill self assessment is not authorised'
      using errcode = '42501';
  end if;

  if target_membership_id <> actor_membership_id then
    raise exception 'self assessment must target own membership'
      using errcode = '42501';
  end if;

  return private.record_skill_assessment_internal(
    target_membership_id,
    target_skill_id,
    target_proficiency_scale_version_id,
    target_proficiency_level_id,
    'self_assessed',
    false,
    target_assessed_at,
    actor_membership_id,
    null,
    target_assessment_method,
    null,
    target_notes,
    null
  );
end;
$$;

create or replace function private.record_skill_validation(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_organisational_unit_id uuid default null,
  target_assessment_method text default 'manager_assessment',
  target_valid_until timestamptz default null,
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
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_assess_skills(
      org_id,
      target_membership_id,
      target_organisational_unit_id
    ) then
    raise exception 'skill validation is not authorised'
      using errcode = '42501';
  end if;

  return private.record_skill_assessment_internal(
    target_membership_id,
    target_skill_id,
    target_proficiency_scale_version_id,
    target_proficiency_level_id,
    'validated',
    true,
    target_assessed_at,
    actor_membership_id,
    target_organisational_unit_id,
    target_assessment_method,
    target_valid_until,
    target_notes,
    null
  );
end;
$$;

create or replace function private.get_current_authoritative_skill_assessment(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_skill_id uuid,
  target_as_of timestamptz default statement_timestamp()
)
returns public.membership_skill_assessments
language sql
stable
security definer
set search_path = ''
as $$
  select assessment_row.*
  from public.membership_skill_assessments assessment_row
  where assessment_row.organisation_id = target_organisation_id
    and assessment_row.membership_id = target_membership_id
    and assessment_row.skill_id = target_skill_id
    and assessment_row.is_authoritative = true
    and assessment_row.status = 'active'
    and assessment_row.assertion_type = 'validated'
    and assessment_row.assessed_at <= target_as_of
    and (
      assessment_row.valid_until is null
      or assessment_row.valid_until > target_as_of
    )
  order by assessment_row.assessed_at desc, assessment_row.created_at desc
  limit 1
$$;

create or replace function private.derive_skill_gap(
  target_membership_id uuid,
  target_skill_id uuid,
  target_capability_set_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  capability_version_id uuid;
  requirement_row public.skill_requirements%rowtype;
  current_assessment public.membership_skill_assessments%rowtype;
  current_order integer;
  target_order integer;
begin
  if org_id is null then
    raise exception 'skill gap derivation is not authorised'
      using errcode = '42501';
  end if;

  if target_capability_set_version_id is not null then
    capability_version_id := target_capability_set_version_id;
  else
    select version_row.id
    into capability_version_id
    from public.skill_capability_set_versions version_row
    join public.skill_capability_sets set_row
      on set_row.organisation_id = version_row.organisation_id
     and set_row.id = version_row.capability_set_id
    where version_row.organisation_id = org_id
      and version_row.status = 'published'
      and set_row.status = 'active'
    order by version_row.published_at desc nulls last
    limit 1;
  end if;

  if capability_version_id is null then
    return jsonb_build_object('status', 'not_required');
  end if;

  select requirement_registry.*
  into requirement_row
  from public.skill_requirements requirement_registry
  left join public.membership_job_function_assignments assignment_row
    on assignment_row.organisation_id = org_id
   and assignment_row.membership_id = target_membership_id
   and assignment_row.is_primary = true
   and assignment_row.valid_from <= statement_timestamp()
   and (
     assignment_row.valid_to is null
     or assignment_row.valid_to > statement_timestamp()
   )
  where requirement_registry.organisation_id = org_id
    and requirement_registry.capability_set_version_id = capability_version_id
    and requirement_registry.skill_id = target_skill_id
    and requirement_registry.job_function_id = assignment_row.job_function_id
  limit 1;

  if not found then
    return jsonb_build_object('status', 'not_required');
  end if;

  current_assessment := private.get_current_authoritative_skill_assessment(
    org_id,
    target_membership_id,
    target_skill_id
  );

  select level_row.order_value
  into target_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.id = requirement_row.target_proficiency_level_id;

  if current_assessment.id is null then
    return jsonb_build_object(
      'status', 'not_assessed',
      'target_order', target_order,
      'target_scale_version_id', requirement_row.proficiency_scale_version_id
    );
  end if;

  if current_assessment.proficiency_scale_version_id
    <> requirement_row.proficiency_scale_version_id then
    return jsonb_build_object(
      'status', 'incompatible_scale',
      'target_scale_version_id', requirement_row.proficiency_scale_version_id,
      'assessment_scale_version_id', current_assessment.proficiency_scale_version_id
    );
  end if;

  select level_row.order_value
  into current_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.id = current_assessment.proficiency_level_id;

  return jsonb_build_object(
    'status',
      case
        when current_order < target_order then 'below_requirement'
        when current_order = target_order then 'meets_requirement'
        else 'above_requirement'
      end,
    'current_order', current_order,
    'target_order', target_order,
    'gap', greatest(target_order - current_order, 0),
    'scale_version_id', requirement_row.proficiency_scale_version_id,
    'current_assessment_id', current_assessment.id
  );
end;
$$;

-- RLS SELECT policies
create policy skill_proficiency_scales_select
on public.skill_proficiency_scales for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_skills_catalog(organisation_id)
);

create policy skill_proficiency_scale_versions_select
on public.skill_proficiency_scale_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_skills_catalog(organisation_id)
);

create policy skill_proficiency_levels_select
on public.skill_proficiency_levels for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_skills_catalog(organisation_id)
);

create policy skills_select
on public.skills for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_skills_catalog(organisation_id)
);

create policy skill_capability_sets_select
on public.skill_capability_sets for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_skills_catalog(organisation_id)
);

create policy skill_capability_set_versions_select
on public.skill_capability_set_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_skills_catalog(organisation_id)
);

create policy skill_requirements_select
on public.skill_requirements for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_skills_catalog(organisation_id)
);

create policy membership_skill_assessments_select
on public.membership_skill_assessments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_skill_assessment(organisation_id, id)
);

grant select on public.skill_proficiency_scales to authenticated;
grant select on public.skill_proficiency_scale_versions to authenticated;
grant select on public.skill_proficiency_levels to authenticated;
grant select on public.skills to authenticated;
grant select on public.skill_capability_sets to authenticated;
grant select on public.skill_capability_set_versions to authenticated;
grant select on public.skill_requirements to authenticated;
grant select on public.membership_skill_assessments to authenticated;

create or replace function public.create_skill_proficiency_scale_draft(
  target_name text,
  target_description text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_skill_proficiency_scale_draft(target_name, target_description) $$;

create or replace function public.add_skill_proficiency_level(
  target_scale_version_id uuid,
  target_order_value integer,
  target_label text,
  target_description text default null,
  target_semantic_token text default null,
  target_guidance text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_skill_proficiency_level(
  target_scale_version_id, target_order_value, target_label,
  target_description, target_semantic_token, target_guidance
) $$;

create or replace function public.publish_skill_proficiency_scale_version(target_scale_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.publish_skill_proficiency_scale_version(target_scale_version_id) $$;

create or replace function public.create_skill(
  target_name text,
  target_code text,
  target_category text default null,
  target_description text default null,
  target_evidence_expectations text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_skill(
  target_name, target_code, target_category, target_description, target_evidence_expectations
) $$;

create or replace function public.create_skill_capability_set_draft(
  target_name text,
  target_code text,
  target_description text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_skill_capability_set_draft(target_name, target_code, target_description) $$;

create or replace function public.add_skill_requirement(
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
language sql volatile security definer set search_path = ''
as $$ select private.add_skill_requirement(
  target_capability_set_version_id,
  target_skill_id,
  target_job_function_id,
  target_proficiency_scale_version_id,
  target_target_proficiency_level_id,
  target_organisational_unit_id,
  target_mandatory,
  target_evidence_requirement,
  target_notes
) $$;

create or replace function public.publish_skill_capability_set_version(target_capability_set_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.publish_skill_capability_set_version(target_capability_set_version_id) $$;

create or replace function public.record_skill_self_assessment(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_assessment_method text default 'self_assessment',
  target_notes text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.record_skill_self_assessment(
  target_membership_id,
  target_skill_id,
  target_proficiency_scale_version_id,
  target_proficiency_level_id,
  target_assessed_at,
  target_assessment_method,
  target_notes
) $$;

create or replace function public.record_skill_validation(
  target_membership_id uuid,
  target_skill_id uuid,
  target_proficiency_scale_version_id uuid,
  target_proficiency_level_id uuid,
  target_assessed_at timestamptz default statement_timestamp(),
  target_organisational_unit_id uuid default null,
  target_assessment_method text default 'manager_assessment',
  target_valid_until timestamptz default null,
  target_notes text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.record_skill_validation(
  target_membership_id,
  target_skill_id,
  target_proficiency_scale_version_id,
  target_proficiency_level_id,
  target_assessed_at,
  target_organisational_unit_id,
  target_assessment_method,
  target_valid_until,
  target_notes
) $$;

create or replace function public.derive_skill_gap(
  target_membership_id uuid,
  target_skill_id uuid,
  target_capability_set_version_id uuid default null
)
returns jsonb
language sql stable security definer set search_path = ''
as $$ select private.derive_skill_gap(
  target_membership_id, target_skill_id, target_capability_set_version_id
) $$;

grant execute on function public.create_skill_proficiency_scale_draft(text, text) to authenticated;
grant execute on function public.add_skill_proficiency_level(
  uuid, integer, text, text, text, text
) to authenticated;
grant execute on function public.publish_skill_proficiency_scale_version(uuid) to authenticated;
grant execute on function public.create_skill(text, text, text, text, text) to authenticated;
grant execute on function public.create_skill_capability_set_draft(text, text, text) to authenticated;
grant execute on function public.add_skill_requirement(
  uuid, uuid, uuid, uuid, uuid, uuid, boolean, text, text
) to authenticated;
grant execute on function public.publish_skill_capability_set_version(uuid) to authenticated;
grant execute on function public.record_skill_self_assessment(
  uuid, uuid, uuid, uuid, timestamptz, text, text
) to authenticated;
grant execute on function public.record_skill_validation(
  uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text
) to authenticated;
grant execute on function public.derive_skill_gap(uuid, uuid, uuid) to authenticated;

revoke all on function public.create_skill_proficiency_scale_draft(text, text) from public, anon;
revoke all on function public.add_skill_proficiency_level(
  uuid, integer, text, text, text, text
) from public, anon;
revoke all on function public.publish_skill_proficiency_scale_version(uuid) from public, anon;
revoke all on function public.create_skill(text, text, text, text, text) from public, anon;
revoke all on function public.create_skill_capability_set_draft(text, text, text) from public, anon;
revoke all on function public.add_skill_requirement(
  uuid, uuid, uuid, uuid, uuid, uuid, boolean, text, text
) from public, anon;
revoke all on function public.publish_skill_capability_set_version(uuid) from public, anon;
revoke all on function public.record_skill_self_assessment(
  uuid, uuid, uuid, uuid, timestamptz, text, text
) from public, anon;
revoke all on function public.record_skill_validation(
  uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text
) from public, anon;
revoke all on function public.derive_skill_gap(uuid, uuid, uuid) from public, anon;

alter function private.can_read_skills_catalog(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_skills_catalog(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_skill_requirements(uuid) owner to lean_hub_private_owner;
alter function private.can_assess_skills(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_skill_assessment(uuid, uuid) owner to lean_hub_private_owner;
alter function private.create_skill_proficiency_scale_draft(text, text) owner to lean_hub_private_owner;
alter function private.add_skill_proficiency_level(
  uuid, integer, text, text, text, text
) owner to lean_hub_private_owner;
alter function private.publish_skill_proficiency_scale_version(uuid) owner to lean_hub_private_owner;
alter function private.create_skill(text, text, text, text, text) owner to lean_hub_private_owner;
alter function private.create_skill_capability_set_draft(text, text, text) owner to lean_hub_private_owner;
alter function private.add_skill_requirement(
  uuid, uuid, uuid, uuid, uuid, uuid, boolean, text, text
) owner to lean_hub_private_owner;
alter function private.publish_skill_capability_set_version(uuid) owner to lean_hub_private_owner;
alter function private.record_skill_assessment_internal(
  uuid, uuid, uuid, uuid, text, boolean, timestamptz, uuid, uuid, text, timestamptz, text, uuid
) owner to lean_hub_private_owner;
alter function private.record_skill_self_assessment(
  uuid, uuid, uuid, uuid, timestamptz, text, text
) owner to lean_hub_private_owner;
alter function private.record_skill_validation(
  uuid, uuid, uuid, uuid, timestamptz, uuid, text, timestamptz, text
) owner to lean_hub_private_owner;
alter function private.get_current_authoritative_skill_assessment(uuid, uuid, uuid, timestamptz) owner to lean_hub_private_owner;
alter function private.derive_skill_gap(uuid, uuid, uuid) owner to lean_hub_private_owner;
