-- Canonical private write RPC bodies + plan module asserts only.
-- Regenerate: python3 scripts/generate-billing-module-gates.py

create or replace function public.ack_workforce_import_credentials_exported(
  target_import_job_id uuid,
  target_export_session_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);
  perform private.expire_stale_workforce_import_export_sessions(target_import_job_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.credential_export_status = 'exported'
    and job_row.credential_export_session_id is null then
    return;
  end if;

  if job_row.credential_export_status <> 'exporting'
    or job_row.credential_export_session_id is distinct from target_export_session_id then
    raise exception 'credential export session is not active'
      using errcode = '55000';
  end if;

  delete from public.workforce_import_row_credentials credential_row
  where credential_row.import_job_id = target_import_job_id;

  update public.workforce_import_jobs
  set credential_export_status = 'exported',
      credential_export_session_id = null,
      credential_export_session_started_at = null,
      credential_export_session_started_by_membership_id = null,
      updated_at = statement_timestamp()
  where id = target_import_job_id;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    org_id,
    'workforce.import_credentials_exported',
    'workforce_import_job',
    target_import_job_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'row_count', job_row.provisioned_rows,
      'session_id', target_export_session_id
    )
  );
end;
$$;

create or replace function private.activate_problem_solving_case(
  target_case_id uuid,
  target_method_id uuid
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
  case_row public.problem_solving_cases%rowtype;
  pinned_version_row public.problem_solving_method_versions%rowtype;
  resolved_method_version_id uuid;
  first_stage_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case activation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'draft' then
    raise exception 'case activation requires a draft case'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'case activation is not authorised'
      using errcode = '42501';
  end if;

  if case_row.method_version_id is not null then
    select version_row.*
    into pinned_version_row
    from public.problem_solving_method_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = case_row.method_version_id;

    if not found then
      raise exception 'pinned method version not found'
        using errcode = 'P0002';
    end if;

    if pinned_version_row.method_id <> target_method_id then
      raise exception 'activation method does not match pinned method version'
        using errcode = '22023';
    end if;

    if pinned_version_row.status = 'draft' then
      raise exception 'pinned method version is not published'
        using errcode = '55000';
    end if;

    resolved_method_version_id := pinned_version_row.id;
  else
    select mv.id
    into resolved_method_version_id
    from public.problem_solving_method_versions mv
    where mv.organisation_id = org_id
      and mv.method_id = target_method_id
      and mv.status = 'published'
    order by mv.version_number desc
    limit 1;

    if resolved_method_version_id is null then
      raise exception 'no published method version found'
        using errcode = 'P0002';
    end if;
  end if;

  select stage.id
  into first_stage_id
  from public.problem_solving_method_stages stage
  where stage.organisation_id = org_id
    and stage.method_version_id = resolved_method_version_id
  order by stage.display_order asc
  limit 1;

  if first_stage_id is null then
    raise exception 'method version has no stages'
      using errcode = 'P0002';
  end if;

  update public.problem_solving_cases ps_case
  set method_version_id = resolved_method_version_id,
      current_method_stage_id = first_stage_id,
      status = 'active',
      activated_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_status_history (
    organisation_id,
    case_id,
    from_status,
    to_status,
    changed_by_membership_id,
    rationale
  )
  values (
    org_id,
    target_case_id,
    'draft',
    'active',
    actor_membership_id,
    'method activated'
  );

  insert into public.problem_solving_stage_history (
    organisation_id,
    case_id,
    from_stage_id,
    to_stage_id,
    changed_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    null,
    first_stage_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.case_activated',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'method_version_id', resolved_method_version_id,
      'first_stage_id', first_stage_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCaseActivated',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'method_version_id', resolved_method_version_id,
      'first_stage_id', first_stage_id
    )
  );

  return true;
end;
$$;

create or replace function private.add_benefit_source_link(
  target_benefit_id uuid,
  target_source_resource_id uuid,
  target_relationship_role text default 'contributing'
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
  benefit_row public.improvement_benefits%rowtype;
  new_link_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit source link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found or benefit_row.status <> 'draft' then
    raise exception 'benefit source links are only mutable while draft'
      using errcode = '55000';
  end if;

  if not private.can_edit_benefit_draft(org_id, target_benefit_id) then
    raise exception 'benefit source link is not authorised'
      using errcode = '42501';
  end if;

  if benefit_row.is_standalone_initiative then
    raise exception 'standalone benefits cannot have source links'
      using errcode = '22023';
  end if;

  if target_relationship_role = 'primary' then
    return private.link_benefit_primary_source(
      org_id,
      target_benefit_id,
      target_source_resource_id,
      actor_membership_id
    );
  end if;

  if not private.can_reference_source_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  insert into public.benefit_source_links (
    organisation_id,
    benefit_id,
    source_resource_id,
    relationship_role,
    created_by_membership_id
  )
  values (
    org_id,
    target_benefit_id,
    target_source_resource_id,
    target_relationship_role,
    actor_membership_id
  )
  on conflict (organisation_id, benefit_id, source_resource_id) do nothing
  returning id into new_link_id;

  if new_link_id is null then
    select link_row.id
    into new_link_id
    from public.benefit_source_links link_row
    where link_row.organisation_id = org_id
      and link_row.benefit_id = target_benefit_id
      and link_row.source_resource_id = target_source_resource_id;
  end if;

  return new_link_id;
end;
$$;

create or replace function private.add_benefit_to_overlap_group(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
  target_allocation_percentage numeric,
  target_reason text default null
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
  group_row public.benefit_overlap_groups%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  active_allocation_sum numeric;
  new_allocation_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit overlap allocation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select group_table.*
  into group_row
  from public.benefit_overlap_groups group_table
  where group_table.organisation_id = org_id
    and group_table.id = target_overlap_group_id
  for update;

  if not found then
    raise exception 'overlap group was not found'
      using errcode = 'P0002';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit overlap allocation is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.benefit_overlap_allocation_history allocation_row
    where allocation_row.organisation_id = org_id
      and allocation_row.benefit_id = target_benefit_id
      and allocation_row.superseded_at is null
      and allocation_row.overlap_group_id <> target_overlap_group_id
  ) then
    raise exception 'benefit already belongs to another overlap group'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.benefit_overlap_allocation_history allocation_row
    where allocation_row.organisation_id = org_id
      and allocation_row.overlap_group_id = target_overlap_group_id
      and allocation_row.benefit_id = target_benefit_id
      and allocation_row.superseded_at is null
  ) then
    raise exception 'benefit already has an active allocation in this overlap group'
      using errcode = '55000';
  end if;

  active_allocation_sum := private.sum_active_benefit_overlap_allocations(
    org_id,
    target_overlap_group_id
  );

  if active_allocation_sum + target_allocation_percentage > 100 then
    raise exception 'active overlap allocations would exceed 100 percent'
      using errcode = '23514';
  end if;

  insert into public.benefit_overlap_allocation_history (
    organisation_id,
    overlap_group_id,
    benefit_id,
    allocation_percentage,
    reason,
    assigned_by_membership_id
  )
  values (
    org_id,
    target_overlap_group_id,
    target_benefit_id,
    target_allocation_percentage,
    target_reason,
    actor_membership_id
  )
  returning id into new_allocation_id;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_allocation.added',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'overlap_group_id', target_overlap_group_id,
      'allocation_id', new_allocation_id,
      'allocation_percentage', target_allocation_percentage
    )
  );

  return new_allocation_id;
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

  perform private.assert_current_organisation_module_entitled('projects');

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

create or replace function private.add_problem_solving_participant(
  target_case_id uuid,
  target_membership_id uuid,
  target_participant_role text
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
  case_row public.problem_solving_cases%rowtype;
  new_participant_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'participant addition is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'cannot add participants to a closed or cancelled case'
      using errcode = '55000';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, case_row.organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.facilitate', null, null)
    or (case_row.owner_membership_id = actor_membership_id)
    or (case_row.facilitator_membership_id = actor_membership_id)
  ) then
    raise exception 'participant addition is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_participants (
    organisation_id,
    case_id,
    membership_id,
    participant_role,
    added_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_membership_id,
    target_participant_role,
    actor_membership_id
  )
  on conflict (organisation_id, case_id, membership_id, participant_role)
  do update set removed_at = null
  returning id into new_participant_id;

  return new_participant_id;
end;
$$;

create or replace function private.add_problem_solving_source_link(
  target_case_id uuid,
  target_source_resource_id uuid,
  target_link_role text default 'related'
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
  case_row public.problem_solving_cases%rowtype;
  new_link_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'source link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if not private.can_read_problem_solving_case(org_id, target_case_id) then
    raise exception 'source link is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_reference_source_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_source_links (
    organisation_id,
    case_id,
    source_resource_id,
    link_role,
    source_resource_type,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_source_resource_id,
    target_link_role,
    (select rr.resource_type from public.resource_records rr
     where rr.organisation_id = org_id and rr.id = target_source_resource_id),
    actor_membership_id
  )
  on conflict (organisation_id, case_id, source_resource_id, link_role) do nothing
  returning id into new_link_id;

  if new_link_id is null then
    select link_row.id
    into new_link_id
    from public.problem_solving_source_links link_row
    where link_row.organisation_id = org_id
      and link_row.case_id = target_case_id
      and link_row.source_resource_id = target_source_resource_id
      and link_row.link_role = target_link_role;
  end if;

  return new_link_id;
end;
$$;

create or replace function private.add_session_entry(
  target_session_id uuid,
  target_entry_type text,
  target_body text,
  target_reference_hypothesis_id uuid default null,
  target_reference_action_id uuid default null,
  target_reference_attachment_id uuid default null
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
  session_row public.problem_solving_sessions%rowtype;
  new_entry_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'session entry creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_session.*
  into session_row
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = org_id
    and ps_session.id = target_session_id;

  if not found then
    raise exception 'session not found'
      using errcode = 'P0002';
  end if;

  if session_row.status <> 'in_progress' then
    raise exception 'entries can only be added to in-progress sessions'
      using errcode = '55000';
  end if;

  if not private.can_contribute_problem_solving_case(org_id, session_row.case_id) then
    raise exception 'session entry creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_session_entries (
    organisation_id,
    session_id,
    entry_type,
    body,
    reference_hypothesis_id,
    reference_action_id,
    reference_attachment_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_session_id,
    target_entry_type,
    btrim(target_body),
    target_reference_hypothesis_id,
    target_reference_action_id,
    target_reference_attachment_id,
    actor_membership_id
  )
  returning id into new_entry_id;

  insert into public.problem_solving_session_participants (
    organisation_id,
    session_id,
    membership_id,
    added_by_membership_id
  )
  values (
    org_id,
    target_session_id,
    actor_membership_id,
    actor_membership_id
  )
  on conflict (organisation_id, session_id, membership_id) do nothing;

  return new_entry_id;
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

  perform private.assert_current_organisation_module_entitled('skills');

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

  perform private.assert_current_organisation_module_entitled('skills');

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

  perform private.assert_current_organisation_module_entitled('training');

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

create or replace function private.add_training_session_participant(
  target_session_id uuid,
  target_membership_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  new_participant_id uuid;
begin
  if org_id is null
    or not private.can_manage_training_sessions(org_id) then
    raise exception 'training session participant add is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  insert into public.training_session_participants (
    organisation_id,
    session_id,
    membership_id
  )
  values (org_id, target_session_id, target_membership_id)
  returning id into new_participant_id;

  return new_participant_id;
end;
$$;

create or replace function private.approve_benefit_forecast(
  target_forecast_version_id uuid,
  target_approved_by_membership_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := coalesce(
    target_approved_by_membership_id,
    private.current_membership_id(org_id)
  );
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast approval is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id
  for update;

  if not found or version_row.lifecycle <> 'submitted' then
    raise exception 'forecast version is not approvable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id
  for update;

  perform private.assert_benefit_forecast_period_integrity(
    target_forecast_version_id,
    org_id
  );

  update public.benefit_forecast_versions prior_version
  set lifecycle = 'superseded'
  where prior_version.organisation_id = org_id
    and prior_version.benefit_id = version_row.benefit_id
    and prior_version.lifecycle = 'approved'
    and prior_version.id <> target_forecast_version_id;

  update public.benefit_forecast_versions version_table
  set lifecycle = 'approved',
      approved_at = statement_timestamp(),
      approved_by_membership_id = actor_membership_id
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id;

  update public.improvement_benefits benefit_table
  set current_forecast_version_id = target_forecast_version_id,
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id;

  perform private.append_business_audit(
    org_id,
    'benefit_forecast.approved',
    version_row.benefit_id,
    'succeeded',
    jsonb_build_object('forecast_version_id', target_forecast_version_id)
  );

  return true;
end;
$$;

create or replace function private.approve_project(
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
    raise exception 'project approval is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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

  if project_row.status <> 'submitted' then
    raise exception 'project is not approvable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project approval is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'approved',
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'submitted',
    'approved',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.approved',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectApproved',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.archive_benefit_category(
  target_category_id uuid
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
  if org_id is null or not private.can_manage_benefit_categories(org_id) then
    raise exception 'benefit category archive is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  update public.benefit_categories category_table
  set status = 'archived'
  where category_table.organisation_id = org_id
    and category_table.id = target_category_id;

  if not found then
    raise exception 'benefit category not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function public.archive_workforce_import_job(
  target_import_job_id uuid
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
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  update public.workforce_import_jobs import_job
  set archived_from_recent_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
    and import_job.archived_from_recent_at is null;

  if not found then
    return false;
  end if;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    org_id,
    'workforce.import_archived_from_recent',
    'workforce_import_job',
    target_import_job_id,
    'succeeded',
    gen_random_uuid(),
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function public.assert_workforce_import_credential_export_access(
  target_import_job_id uuid,
  target_export_session_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'credential export is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);
  perform private.expire_stale_workforce_import_export_sessions(target_import_job_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.credential_export_status <> 'exporting'
    or job_row.credential_export_session_id is distinct from target_export_session_id then
    raise exception 'credential export session is not active'
      using errcode = '55000';
  end if;

  if job_row.credential_expires_at is not null
    and job_row.credential_expires_at <= statement_timestamp() then
    raise exception 'credential export has expired'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function private.assign_ci_project_team_member(
  target_project_id uuid,
  target_membership_id uuid,
  target_team_role text
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
  project_row public.ci_projects%rowtype;
  assignment_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'project team assignment is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  if target_team_role not in ('owner', 'sponsor', 'facilitator', 'member') then
    raise exception 'invalid project team role'
      using errcode = '22023';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = '22023';
  end if;

  if project_row.status not in ('draft', 'submitted', 'approved') then
    raise exception 'team changes are not allowed in current project status'
      using errcode = '55000';
  end if;

  if target_team_role = 'owner' then
    update public.ci_project_team_assignments assignment_table
    set valid_to = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.project_id = target_project_id
      and assignment_table.team_role = 'owner'
      and assignment_table.valid_to is null;
  end if;

  assignment_id := gen_random_uuid();

  insert into public.ci_project_team_assignments (
    id,
    organisation_id,
    project_id,
    membership_id,
    team_role,
    assigned_by_membership_id
  )
  values (
    assignment_id,
    org_id,
    target_project_id,
    target_membership_id,
    target_team_role,
    actor_membership_id
  );

  return assignment_id;
end;
$$;

create or replace function private.award_recognition(
  target_recognition_type_id uuid,
  target_title text,
  target_message text,
  target_organisational_unit_id uuid,
  target_visibility text,
  target_recipient_membership_ids uuid[],
  target_source_resource_id uuid default null,
  target_contribution_summaries text[] default null
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  type_row public.recognition_types%rowtype;
  new_award_id uuid;
  recipient_id uuid;
  idx integer;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'recognition award is not authorised' using errcode = '42501';
  end if;
  perform private.assert_current_organisation_module_entitled('recognition');

  if target_recipient_membership_ids is null or array_length(target_recipient_membership_ids, 1) is null then
    raise exception 'recipients are required' using errcode = '22023';
  end if;
  select type_table.* into type_row from public.recognition_types type_table
  where type_table.organisation_id = org_id and type_table.id = target_recognition_type_id and type_table.status = 'active';
  if not found then raise exception 'recognition type not found' using errcode = 'P0002'; end if;
  if not private.has_scoped_permission(org_id, 'recognition.award', null, null)
    and not private.has_scoped_permission(org_id, 'recognition.award', null, target_organisational_unit_id) then
    raise exception 'recognition award is not authorised' using errcode = '42501';
  end if;
  foreach recipient_id in array target_recipient_membership_ids loop
    if not private.has_scoped_permission(org_id, 'recognition.award', recipient_id, null)
      and not private.has_scoped_permission(org_id, 'recognition.award', null, target_organisational_unit_id) then
      raise exception 'recognition award scope does not cover recipient' using errcode = '42501';
    end if;
  end loop;
  if target_source_resource_id is not null
    and not private.can_access_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not readable' using errcode = '42501';
  end if;
  new_award_id := private.register_resource_record(org_id, 'recognition_award', gen_random_uuid(), actor_membership_id);
  insert into public.recognition_awards (
    id, organisation_id, recognition_type_id, recognition_type_name_snapshot,
    title, message, awarded_by_membership_id, organisational_unit_id,
    source_resource_id, visibility, status
  ) values (
    new_award_id, org_id, target_recognition_type_id, type_row.name,
    btrim(target_title), btrim(target_message), actor_membership_id,
    target_organisational_unit_id, target_source_resource_id, target_visibility, 'active'
  );
  idx := 1;
  foreach recipient_id in array target_recipient_membership_ids loop
    insert into public.recognition_recipients (
      organisation_id, recognition_award_id, membership_id,
      contribution_summary
    ) values (
      org_id, new_award_id, recipient_id,
      case when target_contribution_summaries is not null then target_contribution_summaries[idx] else null end
    );
    idx := idx + 1;
  end loop;
  perform private.append_business_audit(org_id, 'recognition.awarded', new_award_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, new_award_id, 'RecognitionAwarded', new_award_id::text, '{}'::jsonb);
  return new_award_id;
end; $$;

create or replace function public.begin_workforce_import_credential_export(
  target_import_job_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
  session_id uuid := gen_random_uuid();
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);
  perform private.expire_stale_workforce_import_export_sessions(target_import_job_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.credential_export_status not in ('available', 'exporting') then
    raise exception 'credential export is not available'
      using errcode = '55000';
  end if;

  if job_row.credential_expires_at is not null
    and job_row.credential_expires_at <= statement_timestamp() then
    update public.workforce_import_jobs
    set credential_export_status = 'expired',
        updated_at = statement_timestamp()
    where id = target_import_job_id;

    delete from public.workforce_import_row_credentials credential_row
    where credential_row.import_job_id = target_import_job_id;

    raise exception 'credential export has expired'
      using errcode = '55000';
  end if;

  if job_row.credential_export_status = 'exporting'
    and job_row.credential_export_session_id is not null
    and job_row.credential_export_session_started_at
      > statement_timestamp() - interval '15 minutes' then
    return jsonb_build_object(
      'session_id', job_row.credential_export_session_id,
      'expires_at', job_row.credential_export_session_started_at + interval '15 minutes',
      'resumed', true
    );
  end if;

  update public.workforce_import_jobs
  set credential_export_status = 'exporting',
      credential_export_session_id = session_id,
      credential_export_session_started_at = statement_timestamp(),
      credential_export_session_started_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where id = target_import_job_id;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    org_id,
    'workforce.import_credentials_export_started',
    'workforce_import_job',
    target_import_job_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('session_id', session_id)
  );

  return jsonb_build_object(
    'session_id', session_id,
    'expires_at', statement_timestamp() + interval '15 minutes',
    'resumed', false
  );
end;
$$;

create or replace function private.bulk_record_training_completions(
  target_membership_ids uuid[],
  target_course_version_id uuid,
  target_completed_at timestamptz default statement_timestamp(),
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_completion_method text default null,
  target_session_id uuid default null,
  target_validity_days_override integer default null,
  target_notes text default null
)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  membership_id_item uuid;
  completion_ids uuid[] := '{}';
  new_completion_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_completions(org_id) then
    raise exception 'bulk training completion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  if target_membership_ids is null or cardinality(target_membership_ids) = 0 then
    raise exception 'membership ids are required'
      using errcode = '22023';
  end if;

  foreach membership_id_item in array target_membership_ids
  loop
    new_completion_id := private.record_training_completion_internal(
      membership_id_item,
      target_course_version_id,
      target_completed_at,
      actor_membership_id,
      target_trainer_membership_id,
      target_trainer_name,
      target_completion_method,
      target_session_id,
      target_validity_days_override,
      null,
      target_notes
    );
    completion_ids := array_append(completion_ids, new_completion_id);
  end loop;

  return completion_ids;
end;
$$;

create or replace function private.cancel_benefit(
  target_benefit_id uuid,
  target_reason text default null
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
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit cancellation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if benefit_row.status in ('realised', 'withdrawn', 'cancelled') then
    raise exception 'benefit is not cancellable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit cancellation is not authorised'
      using errcode = '42501';
  end if;

  if benefit_row.status = 'submitted' then
    update public.benefit_validation_assignments assignment_table
    set status = 'completed',
        completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.benefit_id = target_benefit_id
      and assignment_table.status = 'active';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'cancelled',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    benefit_row.status,
    'cancelled',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'benefit.cancelled',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitCancelled',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

create or replace function private.cancel_problem_solving_case(
  target_case_id uuid,
  target_cancellation_rationale text
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
  case_row public.problem_solving_cases%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case cancellation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_cancellation_rationale is null or btrim(target_cancellation_rationale) = '' then
    raise exception 'cancellation requires a rationale'
      using errcode = '22023';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'case cannot be cancelled from current status'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'case cancellation is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_cases ps_case
  set status = 'cancelled',
      cancellation_rationale = btrim(target_cancellation_rationale),
      cancelled_at = statement_timestamp(),
      cancelled_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_status_history (
    organisation_id,
    case_id,
    from_status,
    to_status,
    changed_by_membership_id,
    rationale
  )
  values (
    org_id,
    target_case_id,
    case_row.status,
    'cancelled',
    actor_membership_id,
    target_cancellation_rationale
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.case_cancelled',
    target_case_id,
    'succeeded',
    jsonb_build_object('rationale', target_cancellation_rationale)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCaseCancelled',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'rationale', target_cancellation_rationale
    )
  );

  return true;
end;
$$;

create or replace function private.cancel_project(
  target_project_id uuid,
  target_reason text default null
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
    raise exception 'project cancellation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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

  if project_row.status in ('completed', 'cancelled') then
    raise exception 'project is not cancellable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project cancellation is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'cancelled',
      actual_end_at = coalesce(project_table.actual_end_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    project_row.status,
    'cancelled',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.cancelled',
    target_project_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectCancelled',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.claim_ai_run_execution(
  target_ai_run_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  run_row public.ai_runs%rowtype;
  lease_seconds integer := 70;
  failure record;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run claim is not authorised'
      using errcode = '42501';
  end if;


  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id),
    (select s.module_key from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id)
  );

  select run_table.*
  into run_row
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if run_row.requested_by_membership_id <> actor_membership_id then
    raise exception 'ai run claim is not authorised'
      using errcode = '42501';
  end if;

  if run_row.status = 'completed' then
    return 'completed';
  end if;

  if run_row.status <> 'running' then
    return run_row.status;
  end if;

  if run_row.execution_claimed_at is not null then
    if run_row.execution_claimed_at >
      statement_timestamp() - make_interval(secs => lease_seconds) then
      return 'in_progress';
    end if;

    select *
    into failure
    from private.ai_run_abandoned_failure(
      run_row.provider_dispatched_at,
      run_row.provider_request_id
    );

    perform private.fail_ai_run(
      target_ai_run_id,
      failure.failure_category,
      failure.failure_output
    );

    select run_table.status
    into run_row.status
    from public.ai_runs run_table
    where run_table.organisation_id = org_id
      and run_table.id = target_ai_run_id;

    return run_row.status;
  end if;

  if run_row.started_at <= statement_timestamp() - make_interval(secs => lease_seconds) then
    select *
    into failure
    from private.ai_run_abandoned_failure(
      run_row.provider_dispatched_at,
      run_row.provider_request_id
    );

    perform private.fail_ai_run(
      target_ai_run_id,
      failure.failure_category,
      failure.failure_output
    );

    select run_table.status
    into run_row.status
    from public.ai_runs run_table
    where run_table.organisation_id = org_id
      and run_table.id = target_ai_run_id;

    return run_row.status;
  end if;

  update public.ai_runs
  set execution_claimed_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_ai_run_id
    and status = 'running'
    and execution_claimed_at is null;

  if not found then
    return 'in_progress';
  end if;

  return 'claimed';
end;
$$;

create or replace function public.claim_workforce_import_batch(
  target_import_job_id uuid,
  target_batch_size integer default 25
)
returns table (
  import_row_id uuid,
  provisioning_intent_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  import_row public.workforce_import_rows%rowtype;
  claimed integer := 0;
  intent_id uuid;
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  if target_batch_size < 1 or target_batch_size > 50 then
    raise exception 'batch size must be between 1 and 50'
      using errcode = '22023';
  end if;

  for import_row in
    select import_row_table.*
    from public.workforce_import_rows import_row_table
    where import_row_table.import_job_id = target_import_job_id
      and import_row_table.organisation_id = org_id
      and import_row_table.status in ('valid', 'warning', 'provisioning')
    order by import_row_table.row_number
    for update skip locked
  loop
    exit when claimed >= target_batch_size;

    intent_id := private.preauthorize_workforce_import_row(import_row.id);
    import_row_id := import_row.id;
    provisioning_intent_id := intent_id;
    claimed := claimed + 1;
    return next;
  end loop;
end;
$$;

create or replace function private.close_problem_solving_case(
  target_case_id uuid,
  target_closure_outcome text,
  target_closure_rationale text default null
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
  case_row public.problem_solving_cases%rowtype;
  has_verified_cause boolean;
  has_corrective_countermeasures boolean;
  has_effectiveness_checks boolean;
  all_effectiveness_passed boolean;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case closure is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status not in ('draft', 'active') then
    raise exception 'case cannot be closed from current status'
      using errcode = '55000';
  end if;

  if not private.can_close_problem_solving_case(org_id, target_case_id) then
    raise exception 'case closure is not authorised'
      using errcode = '42501';
  end if;

  if target_closure_outcome not in (
    'resolved_verified_cause',
    'resolved_without_verified_cause',
    'transferred'
  ) then
    raise exception 'invalid closure outcome'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.problem_solving_hypotheses h
    where h.organisation_id = org_id
      and h.problem_solving_case_id = target_case_id
      and h.status = 'verified'
  )
  into has_verified_cause;

  select exists (
    select 1
    from public.problem_solving_countermeasures cm
    where cm.organisation_id = org_id
      and cm.problem_solving_case_id = target_case_id
      and cm.status in ('selected', 'implementing', 'implemented', 'effective')
  )
  into has_corrective_countermeasures;

  if target_closure_outcome = 'resolved_verified_cause' then
    if not has_verified_cause then
      raise exception 'resolved_verified_cause requires at least one verified hypothesis'
        using errcode = '22023';
    end if;
  end if;

  if target_closure_outcome = 'resolved_without_verified_cause' then
    if target_closure_rationale is null or btrim(target_closure_rationale) = '' then
      raise exception 'resolved_without_verified_cause requires a closure rationale'
        using errcode = '22023';
    end if;

    if has_corrective_countermeasures then
      select exists (
        select 1
        from public.problem_solving_effectiveness_checks eff
        where eff.organisation_id = org_id
          and eff.case_id = target_case_id
      )
      into has_effectiveness_checks;

      if not has_effectiveness_checks then
        raise exception 'corrective countermeasures require effectiveness checks before closure'
          using errcode = '22023';
      end if;
    end if;
  end if;

  if has_corrective_countermeasures then
    select not exists (
      select 1
      from public.problem_solving_effectiveness_checks eff
      where eff.organisation_id = org_id
        and eff.case_id = target_case_id
        and (eff.result is null or eff.result = 'fail')
    )
    into all_effectiveness_passed;

    if not all_effectiveness_passed and target_closure_outcome <> 'transferred' then
      raise exception 'all effectiveness checks must pass or be inconclusive before closure'
        using errcode = '22023';
    end if;
  end if;

  update public.problem_solving_cases ps_case
  set status = 'closed',
      closure_outcome = target_closure_outcome,
      closure_rationale = target_closure_rationale,
      closed_at = statement_timestamp(),
      closed_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_status_history (
    organisation_id,
    case_id,
    from_status,
    to_status,
    changed_by_membership_id,
    rationale
  )
  values (
    org_id,
    target_case_id,
    case_row.status,
    'closed',
    actor_membership_id,
    target_closure_outcome || coalesce(': ' || target_closure_rationale, '')
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.case_closed',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'closure_outcome', target_closure_outcome,
      'has_verified_cause', has_verified_cause
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCaseClosed',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'closure_outcome', target_closure_outcome
    )
  );

  return true;
end;
$$;

create or replace function private.complete_hypothesis_test(
  target_hypothesis_test_id uuid,
  target_actual_result text,
  target_conclusion text
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
  test_row public.problem_solving_hypothesis_tests%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis test completion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_conclusion not in ('supports', 'refutes', 'inconclusive') then
    raise exception 'invalid conclusion; must be supports, refutes, or inconclusive'
      using errcode = '22023';
  end if;

  if target_actual_result is null or btrim(target_actual_result) = '' then
    raise exception 'actual_result is required to complete a test'
      using errcode = '22023';
  end if;

  select t.*
  into test_row
  from public.problem_solving_hypothesis_tests t
  where t.organisation_id = org_id
    and t.id = target_hypothesis_test_id
  for update;

  if not found then
    raise exception 'hypothesis test not found'
      using errcode = 'P0002';
  end if;

  if test_row.completed_date is not null then
    raise exception 'hypothesis test is already completed'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    test_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis test completion is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_hypothesis_tests t
  set actual_result  = btrim(target_actual_result),
      conclusion     = target_conclusion,
      completed_date = current_date,
      updated_at     = statement_timestamp()
  where t.organisation_id = org_id
    and t.id = target_hypothesis_test_id;

  perform private.append_business_audit(
    org_id,
    'hypothesis_test.completed',
    test_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'test_id', target_hypothesis_test_id,
      'hypothesis_id', test_row.hypothesis_id,
      'conclusion', target_conclusion
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    test_row.problem_solving_case_id,
    'HypothesisTestCompleted',
    target_hypothesis_test_id::text,
    jsonb_build_object(
      'test_id', target_hypothesis_test_id,
      'hypothesis_id', test_row.hypothesis_id,
      'conclusion', target_conclusion,
      'case_id', test_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

create or replace function private.complete_problem_solving_session(
  target_session_id uuid,
  target_summary text default null
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
  session_row public.problem_solving_sessions%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'session completion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_session.*
  into session_row
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = org_id
    and ps_session.id = target_session_id
  for update;

  if not found then
    raise exception 'session not found'
      using errcode = 'P0002';
  end if;

  if session_row.status <> 'in_progress' then
    raise exception 'only in-progress sessions can be completed'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, session_row.case_id)
    and session_row.facilitator_membership_id <> actor_membership_id then
    raise exception 'session completion is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_sessions ps_session
  set status = 'completed',
      completed_at = statement_timestamp(),
      summary = target_summary,
      updated_at = statement_timestamp()
  where ps_session.organisation_id = org_id
    and ps_session.id = target_session_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.session_completed',
    session_row.case_id,
    'succeeded',
    jsonb_build_object('session_id', target_session_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    session_row.case_id,
    'ProblemSolvingSessionCompleted',
    target_session_id::text,
    jsonb_build_object(
      'case_id', session_row.case_id,
      'session_id', target_session_id
    )
  );

  return true;
end;
$$;

create or replace function private.complete_project(
  target_project_id uuid,
  target_outcome_summary text,
  target_lessons_learned text default null,
  target_sustainment_summary text default null
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
    raise exception 'project completion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  if target_outcome_summary is null or btrim(target_outcome_summary) = '' then
    raise exception 'project completion requires an outcome summary'
      using errcode = '22023';
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

  if project_row.status not in ('active', 'on_hold') then
    raise exception 'project is not completable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project completion is not authorised'
      using errcode = '42501';
  end if;

  insert into public.ci_project_completion_snapshots (
    organisation_id,
    project_id,
    outcome_summary,
    lessons_learned,
    sustainment_summary,
    captured_by_membership_id
  )
  values (
    org_id,
    target_project_id,
    btrim(target_outcome_summary),
    target_lessons_learned,
    target_sustainment_summary,
    actor_membership_id
  );

  update public.ci_projects project_table
  set status = 'completed',
      actual_end_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    project_row.status,
    'completed',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.completed',
    target_project_id,
    'succeeded',
    jsonb_build_object('outcome_summary', btrim(target_outcome_summary))
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectCompleted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.complete_project_phase(
  target_project_id uuid,
  target_phase_id uuid,
  target_mark_skipped boolean default false
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
  phase_row public.ci_project_phases%rowtype;
  next_phase_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project phase completion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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

  if project_row.status not in ('active', 'on_hold') then
    raise exception 'project phases are not actionable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project phase completion is not authorised'
      using errcode = '42501';
  end if;

  select phase_table.*
  into phase_row
  from public.ci_project_phases phase_table
  where phase_table.organisation_id = org_id
    and phase_table.project_id = target_project_id
    and phase_table.id = target_phase_id
  for update;

  if not found then
    raise exception 'project phase not found'
      using errcode = 'P0002';
  end if;

  if phase_row.status not in ('in_progress', 'not_started') then
    raise exception 'project phase is not completable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.ci_project_phases current_phase
    where current_phase.organisation_id = org_id
      and current_phase.project_id = target_project_id
      and current_phase.status = 'in_progress'
      and current_phase.id = target_phase_id
  ) and not (
    target_mark_skipped
    and phase_row.status = 'not_started'
    and not exists (
      select 1
      from public.ci_project_phases prior_phase
      where prior_phase.organisation_id = org_id
        and prior_phase.project_id = target_project_id
        and prior_phase.display_order < phase_row.display_order
        and prior_phase.status not in ('completed', 'skipped')
    )
  ) then
    raise exception 'project phases must progress sequentially'
      using errcode = '55000';
  end if;

  update public.ci_project_phases phase_table
  set status = case when target_mark_skipped then 'skipped' else 'completed' end,
      started_at = coalesce(phase_table.started_at, statement_timestamp()),
      completed_at = statement_timestamp()
  where phase_table.organisation_id = org_id
    and phase_table.id = target_phase_id;

  if not target_mark_skipped then
    select phase_table.id
    into next_phase_id
    from public.ci_project_phases phase_table
    where phase_table.organisation_id = org_id
      and phase_table.project_id = target_project_id
      and phase_table.display_order > phase_row.display_order
      and phase_table.status = 'not_started'
    order by phase_table.display_order
    limit 1;

    if next_phase_id is not null then
      update public.ci_project_phases phase_table
      set status = 'in_progress',
          started_at = statement_timestamp()
      where phase_table.organisation_id = org_id
        and phase_table.id = next_phase_id;
    end if;
  end if;

  perform private.append_business_audit(
    org_id,
    case when target_mark_skipped then 'ci_project.phase_skipped' else 'ci_project.phase_completed' end,
    target_project_id,
    'succeeded',
    jsonb_build_object('phase_id', target_phase_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    case when target_mark_skipped then 'CiProjectPhaseSkipped' else 'CiProjectPhaseCompleted' end,
    target_phase_id::text,
    jsonb_build_object('project_id', target_project_id, 'phase_id', target_phase_id)
  );

  return true;
end;
$$;

create or replace function private.create_ai_coach_session(
  target_module_key text,
  target_intervention_key text,
  target_site_unit_id uuid default null,
  target_title text default null,
  target_context_contract_version text default 'coach-session-v1'
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
  existing_session_id uuid;
  new_session_id uuid;
  normalised_module text := btrim(target_module_key);
  normalised_intervention text := btrim(target_intervention_key);
  normalised_version text := btrim(coalesce(target_context_contract_version, 'coach-session-v1'));
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_use_ai(org_id) then
    raise exception 'ai session creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ai_session_module_entitled('coach', btrim(target_module_key));

  if normalised_module not in (
    'organisation',
    'sites',
    'people',
    'maturity',
    'suggestions',
    'five_s',
    'gemba',
    'training',
    'skills',
    'recognition',
    'lean_ai',
    'problem_solving',
    'setup',
    'onboarding',
    'platform'
  ) then
    raise exception 'invalid coach module key'
      using errcode = '22023';
  end if;

  if normalised_intervention is null
    or normalised_intervention !~ '^[a-z][a-z0-9_]{0,62}$' then
    raise exception 'invalid coach intervention key'
      using errcode = '22023';
  end if;

  if target_site_unit_id is not null
    and not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = target_site_unit_id
        and unit_row.status = 'active'
    ) then
    raise exception 'authorised site context is required'
      using errcode = '42501';
  end if;

  select session_table.id
  into existing_session_id
  from public.ai_sessions session_table
  where session_table.organisation_id = org_id
    and session_table.created_by_membership_id = actor_membership_id
    and session_table.context_type = 'coach'
    and session_table.status = 'active'
    and session_table.module_key = normalised_module
    and session_table.intervention_key = normalised_intervention
    and session_table.site_unit_id is not distinct from target_site_unit_id;

  if existing_session_id is not null then
    return existing_session_id;
  end if;

  new_session_id := private.register_resource_record(
    org_id,
    'ai_session',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.ai_sessions (
    id,
    organisation_id,
    problem_solving_case_id,
    problem_solving_session_id,
    created_by_membership_id,
    mode,
    status,
    title,
    context_type,
    module_key,
    intervention_key,
    site_unit_id,
    context_contract_version
  )
  values (
    new_session_id,
    org_id,
    null,
    null,
    actor_membership_id,
    'ask',
    'active',
    target_title,
    'coach',
    normalised_module,
    normalised_intervention,
    target_site_unit_id,
    normalised_version
  );

  perform private.append_business_audit(
    org_id,
    'ai.session.created',
    new_session_id,
    'succeeded',
    jsonb_build_object(
      'ai_session_id', new_session_id,
      'context_type', 'coach',
      'module_key', normalised_module,
      'intervention_key', normalised_intervention
    )
  );

  return new_session_id;
end;
$$;

create or replace function private.create_ai_session(
  target_problem_solving_case_id uuid,
  target_mode text,
  target_problem_solving_session_id uuid default null,
  target_title text default null
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
  new_session_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_use_ai(org_id)
    or not private.can_read_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'ai session creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_mode not in ('ask', 'facilitate', 'review', 'challenge') then
    raise exception 'invalid ai session mode'
      using errcode = '22023';
  end if;

  if target_problem_solving_session_id is not null then
    if not exists (
      select 1
      from public.problem_solving_sessions ps_session
      where ps_session.organisation_id = org_id
        and ps_session.id = target_problem_solving_session_id
        and ps_session.case_id = target_problem_solving_case_id
    ) then
      raise exception 'problem solving session not found for case'
        using errcode = 'P0002';
    end if;
  end if;

  new_session_id := private.register_resource_record(
    org_id,
    'ai_session',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.ai_sessions (
    id,
    organisation_id,
    problem_solving_case_id,
    problem_solving_session_id,
    created_by_membership_id,
    mode,
    status,
    title
  )
  values (
    new_session_id,
    org_id,
    target_problem_solving_case_id,
    target_problem_solving_session_id,
    actor_membership_id,
    target_mode,
    'active',
    target_title
  );

  perform private.append_business_audit(
    org_id,
    'ai.session.created',
    new_session_id,
    'succeeded',
    jsonb_build_object(
      'ai_session_id', new_session_id,
      'problem_solving_case_id', target_problem_solving_case_id,
      'mode', target_mode
    )
  );

  return new_session_id;
end;
$$;

create or replace function private.create_analysis(
  target_problem_solving_case_id uuid,
  target_analysis_type text,
  target_title text
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
  new_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'analysis creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_analysis_type not in ('five_whys', 'fishbone', 'cause_tree', 'brainstorm') then
    raise exception 'invalid analysis type'
      using errcode = '22023';
  end if;

  insert into public.problem_solving_analyses (
    organisation_id,
    problem_solving_case_id,
    analysis_type,
    title,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    target_analysis_type,
    btrim(target_title),
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'analysis.created',
    target_problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'analysis_id', new_id,
      'case_id', target_problem_solving_case_id,
      'analysis_type', target_analysis_type
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_problem_solving_case_id,
    'AnalysisCreated',
    new_id::text,
    jsonb_build_object(
      'analysis_id', new_id,
      'case_id', target_problem_solving_case_id,
      'analysis_type', target_analysis_type
    )
  );

  return new_id;
end;
$$;

create or replace function private.create_benefit_category(
  target_name text,
  target_code text,
  target_description text default null,
  target_display_order integer default 0
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
  new_category_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_categories(org_id) then
    raise exception 'benefit category creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  insert into public.benefit_categories (
    organisation_id,
    name,
    code,
    description,
    display_order,
    status
  )
  values (
    org_id,
    btrim(target_name),
    btrim(target_code),
    target_description,
    target_display_order,
    'active'
  )
  returning id into new_category_id;

  perform private.append_business_audit(
    org_id,
    'benefit_category.created',
    null,
    'succeeded',
    jsonb_build_object('category_id', new_category_id)
  );

  return new_category_id;
end;
$$;

create or replace function private.create_benefit_draft(
  target_title text,
  target_organisational_unit_id uuid,
  target_benefit_class text,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_owner_membership_id uuid default null,
  target_is_standalone_initiative boolean default false,
  target_primary_source_resource_id uuid default null
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
  resolved_owner_membership_id uuid;
  reporting_currency text;
  new_benefit_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_in_unit(org_id, target_organisational_unit_id) then
    raise exception 'benefit draft creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  if target_benefit_class = 'financial' then
    if target_financial_type is null or target_non_financial_type is not null then
      raise exception 'financial benefit requires a financial type'
        using errcode = '22023';
    end if;
  elsif target_benefit_class = 'non_financial' then
    if target_non_financial_type is null or target_financial_type is not null then
      raise exception 'non-financial benefit requires a non-financial type'
        using errcode = '22023';
    end if;
  else
    raise exception 'invalid benefit class'
      using errcode = '22023';
  end if;

  if target_is_standalone_initiative and target_primary_source_resource_id is not null then
    raise exception 'standalone benefits cannot have a primary source at creation'
      using errcode = '22023';
  end if;

  if target_primary_source_resource_id is not null
    and not private.can_reference_source_resource(org_id, target_primary_source_resource_id) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  resolved_owner_membership_id := coalesce(target_owner_membership_id, actor_membership_id);

  if target_benefit_class = 'financial' then
    select organisation.reporting_currency
    into reporting_currency
    from public.organisations organisation
    where organisation.id = org_id;
  else
    reporting_currency := null;
  end if;

  new_benefit_id := private.register_resource_record(
    org_id,
    'improvement_benefit',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.improvement_benefits (
    id,
    organisation_id,
    title,
    description,
    benefit_class,
    financial_type,
    non_financial_type,
    category_id,
    organisational_unit_id,
    owner_membership_id,
    created_by_membership_id,
    reporting_currency_snapshot,
    status,
    is_standalone_initiative
  )
  values (
    new_benefit_id,
    org_id,
    btrim(target_title),
    target_description,
    target_benefit_class,
    target_financial_type,
    target_non_financial_type,
    target_category_id,
    target_organisational_unit_id,
    resolved_owner_membership_id,
    actor_membership_id,
    reporting_currency,
    'draft',
    target_is_standalone_initiative
  );

  perform private.append_benefit_status_history(
    org_id,
    new_benefit_id,
    'draft',
    'draft',
    actor_membership_id,
    'created'
  );

  if target_primary_source_resource_id is not null then
    perform private.link_benefit_primary_source(
      org_id,
      new_benefit_id,
      target_primary_source_resource_id,
      actor_membership_id
    );
  end if;

  perform private.append_business_audit(
    org_id,
    'benefit.draft_created',
    new_benefit_id,
    'succeeded',
    jsonb_build_object('benefit_class', target_benefit_class)
  );

  perform private.enqueue_domain_event(
    org_id,
    new_benefit_id,
    'BenefitDraftCreated',
    new_benefit_id::text,
    jsonb_build_object('benefit_id', new_benefit_id)
  );

  return new_benefit_id;
end;
$$;

create or replace function private.create_benefit_forecast_draft(
  target_benefit_id uuid,
  target_realisation_pattern text,
  target_forecast_start_date date,
  target_forecast_end_date date,
  target_forecast_total_amount numeric default null,
  target_calculation_basis text default null,
  target_assumptions text default null,
  target_target_measure_value numeric default null,
  target_target_measure_unit text default null,
  target_target_date date default null
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
  benefit_row public.improvement_benefits%rowtype;
  next_version_number integer;
  new_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast draft creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast draft creation is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.benefit_forecast_versions version_table
    where version_table.organisation_id = org_id
      and version_table.benefit_id = target_benefit_id
      and version_table.lifecycle = 'draft'
  ) then
    raise exception 'benefit already has a draft forecast version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.benefit_forecast_versions version_table
    where version_table.organisation_id = org_id
      and version_table.benefit_id = target_benefit_id
      and version_table.lifecycle = 'approved'
  ) then
    raise exception 'approved forecast exists; use successor version creation'
      using errcode = '55000';
  end if;

  select coalesce(max(version_table.version_number), 0) + 1
  into next_version_number
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.benefit_id = target_benefit_id;

  insert into public.benefit_forecast_versions (
    organisation_id,
    benefit_id,
    version_number,
    lifecycle,
    realisation_pattern,
    forecast_start_date,
    forecast_end_date,
    forecast_total_amount,
    calculation_basis,
    assumptions,
    target_measure_value,
    target_measure_unit,
    target_date,
    created_by_membership_id
  )
  values (
    org_id,
    target_benefit_id,
    next_version_number,
    'draft',
    target_realisation_pattern,
    target_forecast_start_date,
    target_forecast_end_date,
    target_forecast_total_amount,
    target_calculation_basis,
    target_assumptions,
    target_target_measure_value,
    case
      when target_target_measure_unit is null then null
      else btrim(target_target_measure_unit)
    end,
    target_target_date,
    actor_membership_id
  )
  returning id into new_version_id;

  update public.improvement_benefits benefit_table
  set current_forecast_version_id = new_version_id,
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_business_audit(
    org_id,
    'benefit_forecast.draft_created',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('forecast_version_id', new_version_id)
  );

  return new_version_id;
end;
$$;

create or replace function private.create_benefit_forecast_successor_version(
  target_benefit_id uuid
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
  benefit_row public.improvement_benefits%rowtype;
  source_version_id uuid;
  source_version_number integer;
  new_version_id uuid;
  period_row record;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast successor creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast successor creation is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.benefit_forecast_versions version_table
    where version_table.organisation_id = org_id
      and version_table.benefit_id = target_benefit_id
      and version_table.lifecycle = 'draft'
  ) then
    raise exception 'benefit already has a draft forecast version'
      using errcode = '55000';
  end if;

  select version_table.id, version_table.version_number
  into source_version_id, source_version_number
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.benefit_id = target_benefit_id
    and version_table.lifecycle = 'approved'
  order by version_table.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception 'benefit has no approved forecast version'
      using errcode = '55000';
  end if;

  insert into public.benefit_forecast_versions (
    organisation_id,
    benefit_id,
    version_number,
    lifecycle,
    realisation_pattern,
    forecast_start_date,
    forecast_end_date,
    forecast_total_amount,
    calculation_basis,
    assumptions,
    target_measure_value,
    target_measure_unit,
    target_date,
    created_by_membership_id
  )
  select
    org_id,
    target_benefit_id,
    source_version_number + 1,
    'draft',
    source_version.realisation_pattern,
    source_version.forecast_start_date,
    source_version.forecast_end_date,
    source_version.forecast_total_amount,
    source_version.calculation_basis,
    source_version.assumptions,
    source_version.target_measure_value,
    source_version.target_measure_unit,
    source_version.target_date,
    actor_membership_id
  from public.benefit_forecast_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_version_id;

  for period_row in
    select
      period_table.period_start,
      period_table.period_end,
      period_table.forecast_amount,
      period_table.display_order
    from public.benefit_forecast_periods period_table
    where period_table.organisation_id = org_id
      and period_table.forecast_version_id = source_version_id
    order by period_table.display_order
  loop
    insert into public.benefit_forecast_periods (
      organisation_id,
      forecast_version_id,
      period_start,
      period_end,
      forecast_amount,
      display_order
    )
    values (
      org_id,
      new_version_id,
      period_row.period_start,
      period_row.period_end,
      period_row.forecast_amount,
      period_row.display_order
    );
  end loop;

  perform private.append_business_audit(
    org_id,
    'benefit_forecast.successor_created',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('forecast_version_id', new_version_id)
  );

  return new_version_id;
end;
$$;

create or replace function private.create_benefit_from_ci_project(
  target_project_id uuid,
  target_benefit_class text,
  target_title text default null,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null
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
  project_row public.ci_projects%rowtype;
  resolved_unit_id uuid;
  resolved_title text;
  resolved_description text;
  resolved_owner_membership_id uuid;
  new_benefit_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit creation from project is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  if not private.can_read_ci_project(org_id, target_project_id) then
    raise exception 'benefit creation from project is not authorised'
      using errcode = '42501';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  resolved_unit_id := coalesce(target_organisational_unit_id, project_row.unit_id);

  if not private.can_create_benefit_in_unit(org_id, resolved_unit_id) then
    raise exception 'benefit creation from project is not authorised'
      using errcode = '42501';
  end if;

  resolved_title := coalesce(nullif(btrim(target_title), ''), project_row.title);
  resolved_description := coalesce(
    target_description,
    private.build_benefit_description_from_ci_project(
      project_row.problem_statement,
      project_row.objective,
      project_row.expected_impact_summary
    )
  );
  resolved_owner_membership_id := coalesce(
    target_owner_membership_id,
    project_row.created_by_membership_id
  );

  new_benefit_id := private.create_benefit_draft(
    resolved_title,
    resolved_unit_id,
    target_benefit_class,
    resolved_description,
    target_financial_type,
    target_non_financial_type,
    target_category_id,
    resolved_owner_membership_id,
    false,
    target_project_id
  );

  perform private.append_business_audit(
    org_id,
    'benefit.created_from_ci_project',
    new_benefit_id,
    'succeeded',
    jsonb_build_object(
      'benefit_id', new_benefit_id,
      'project_id', target_project_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    new_benefit_id,
    'BenefitCreatedFromCiProject',
    new_benefit_id::text,
    jsonb_build_object(
      'benefit_id', new_benefit_id,
      'project_id', target_project_id
    )
  );

  return new_benefit_id;
end;
$$;

create or replace function private.create_benefit_from_suggestion(
  target_suggestion_id uuid,
  target_benefit_class text,
  target_title text default null,
  target_description text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null
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
  suggestion_row public.improvement_suggestions%rowtype;
  resolved_unit_id uuid;
  resolved_title text;
  resolved_description text;
  resolved_owner_membership_id uuid;
  new_benefit_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit creation from suggestion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'benefit creation from suggestion is not authorised'
      using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  if suggestion_row.status not in ('accepted', 'implementing', 'implemented') then
    raise exception 'suggestion is not eligible for benefit creation'
      using errcode = '55000';
  end if;

  resolved_unit_id := coalesce(
    target_organisational_unit_id,
    suggestion_row.target_unit_id,
    suggestion_row.origin_unit_id
  );

  if not private.can_create_benefit_in_unit(org_id, resolved_unit_id) then
    raise exception 'benefit creation from suggestion is not authorised'
      using errcode = '42501';
  end if;

  resolved_title := coalesce(nullif(btrim(target_title), ''), suggestion_row.title);
  resolved_description := coalesce(
    target_description,
    private.build_benefit_description_from_suggestion(
      suggestion_row.problem_or_opportunity,
      suggestion_row.proposed_idea,
      suggestion_row.expected_benefit_summary
    )
  );
  resolved_owner_membership_id := coalesce(
    target_owner_membership_id,
    suggestion_row.author_membership_id
  );

  new_benefit_id := private.create_benefit_draft(
    resolved_title,
    resolved_unit_id,
    target_benefit_class,
    resolved_description,
    target_financial_type,
    target_non_financial_type,
    target_category_id,
    resolved_owner_membership_id,
    false,
    target_suggestion_id
  );

  perform private.append_business_audit(
    org_id,
    'benefit.created_from_suggestion',
    new_benefit_id,
    'succeeded',
    jsonb_build_object(
      'benefit_id', new_benefit_id,
      'suggestion_id', target_suggestion_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    new_benefit_id,
    'BenefitCreatedFromSuggestion',
    new_benefit_id::text,
    jsonb_build_object(
      'benefit_id', new_benefit_id,
      'suggestion_id', target_suggestion_id
    )
  );

  return new_benefit_id;
end;
$$;

create or replace function private.create_benefit_overlap_group(
  target_name text,
  target_reason text default null
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
  new_group_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_overlap(org_id) then
    raise exception 'benefit overlap group creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  insert into public.benefit_overlap_groups (
    organisation_id,
    name,
    reason,
    created_by_membership_id
  )
  values (
    org_id,
    btrim(target_name),
    target_reason,
    actor_membership_id
  )
  returning id into new_group_id;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_group.created',
    null,
    'succeeded',
    jsonb_build_object('overlap_group_id', new_group_id)
  );

  return new_group_id;
end;
$$;

create or replace function private.create_benefit_realisation_adjustment(
  target_parent_entry_id uuid,
  target_financial_amount numeric default null,
  target_measure_value numeric default null,
  target_measure_unit text default null,
  target_period_start date default null,
  target_period_end date default null,
  target_data_source text default null,
  target_notes text default null,
  target_is_correction boolean default false
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
  parent_row public.benefit_realisation_entries%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  new_entry_id uuid;
  resolved_period_start date;
  resolved_period_end date;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation adjustment creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select entry_table.*
  into parent_row
  from public.benefit_realisation_entries entry_table
  where entry_table.organisation_id = org_id
    and entry_table.id = target_parent_entry_id;

  if not found then
    raise exception 'parent realisation entry was not found'
      using errcode = 'P0002';
  end if;

  if parent_row.status <> 'validated' or parent_row.entry_kind <> 'original' then
    raise exception 'adjustments must reference a validated original entry'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = parent_row.benefit_id;

  if not private.benefit_allows_realisation_recording(benefit_row.status) then
    raise exception 'benefit is not in a realisation-recording status'
      using errcode = '55000';
  end if;

  if not private.can_record_benefit_realisation(
    org_id,
    benefit_row.organisational_unit_id
  ) then
    raise exception 'benefit realisation adjustment creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_realisation_entry_payload(
    benefit_row,
    target_financial_amount,
    target_measure_value,
    target_measure_unit,
    'adjustment',
    target_is_correction
  );

  resolved_period_start := coalesce(target_period_start, parent_row.period_start);
  resolved_period_end := coalesce(target_period_end, parent_row.period_end);

  if resolved_period_end < resolved_period_start then
    raise exception 'realisation period end must be on or after period start'
      using errcode = '22023';
  end if;

  new_entry_id := private.register_resource_record(
    org_id,
    'benefit_realisation_entry',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.benefit_realisation_entries (
    id,
    organisation_id,
    benefit_id,
    period_start,
    period_end,
    financial_amount,
    measure_value,
    measure_unit,
    entry_kind,
    data_source,
    notes,
    status,
    recorded_by_membership_id,
    recorded_at,
    adjustment_of_entry_id,
    is_correction
  )
  values (
    new_entry_id,
    org_id,
    parent_row.benefit_id,
    resolved_period_start,
    resolved_period_end,
    target_financial_amount,
    target_measure_value,
    case
      when target_measure_unit is null then parent_row.measure_unit
      else btrim(target_measure_unit)
    end,
    'adjustment',
    case
      when target_data_source is null then null
      else btrim(target_data_source)
    end,
    target_notes,
    'draft',
    actor_membership_id,
    statement_timestamp(),
    target_parent_entry_id,
    target_is_correction
  );

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.adjustment_created',
    parent_row.benefit_id,
    'succeeded',
    jsonb_build_object(
      'entry_id', new_entry_id,
      'parent_entry_id', target_parent_entry_id,
      'is_correction', target_is_correction
    )
  );

  return new_entry_id;
end;
$$;

create or replace function private.create_benefit_realisation_entry(
  target_benefit_id uuid,
  target_period_start date,
  target_period_end date,
  target_financial_amount numeric default null,
  target_measure_value numeric default null,
  target_measure_unit text default null,
  target_data_source text default null,
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
  benefit_row public.improvement_benefits%rowtype;
  new_entry_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation entry creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.benefit_allows_realisation_recording(benefit_row.status) then
    raise exception 'benefit is not in a realisation-recording status'
      using errcode = '55000';
  end if;

  if not private.can_record_benefit_realisation(
    org_id,
    benefit_row.organisational_unit_id
  ) then
    raise exception 'benefit realisation entry creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_realisation_entry_payload(
    benefit_row,
    target_financial_amount,
    target_measure_value,
    target_measure_unit,
    'original',
    false
  );

  new_entry_id := private.register_resource_record(
    org_id,
    'benefit_realisation_entry',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.benefit_realisation_entries (
    id,
    organisation_id,
    benefit_id,
    period_start,
    period_end,
    financial_amount,
    measure_value,
    measure_unit,
    entry_kind,
    data_source,
    notes,
    status,
    recorded_by_membership_id,
    recorded_at
  )
  values (
    new_entry_id,
    org_id,
    target_benefit_id,
    target_period_start,
    target_period_end,
    target_financial_amount,
    target_measure_value,
    case
      when target_measure_unit is null then null
      else btrim(target_measure_unit)
    end,
    'original',
    case
      when target_data_source is null then null
      else btrim(target_data_source)
    end,
    target_notes,
    'draft',
    actor_membership_id,
    statement_timestamp()
  );

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.entry_created',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('entry_id', new_entry_id, 'entry_kind', 'original')
  );

  return new_entry_id;
end;
$$;

create or replace function private.create_capability_action(
  target_title text,
  target_gap_type text,
  target_membership_id uuid,
  target_course_id uuid default null,
  target_skill_id uuid default null,
  target_training_completion_id uuid default null,
  target_skill_assessment_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
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
  unit_id uuid;
  new_action_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'actions.create', null, null) then
    raise exception 'capability action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  if target_gap_type = 'training_gap' then
    if not private.can_read_membership_capability_profile(org_id, target_membership_id) then
      raise exception 'capability action target is not authorised'
        using errcode = '42501';
    end if;
  elsif target_gap_type in ('skill_gap', 'skill_assessment_follow_up') then
    if not private.can_assess_skills(org_id, target_membership_id, null)
      and not private.can_read_membership_capability_profile(org_id, target_membership_id) then
      raise exception 'capability action target is not authorised'
        using errcode = '42501';
    end if;
  else
    raise exception 'invalid capability gap type'
      using errcode = '22023';
  end if;

  select assignment_row.organisational_unit_id
  into unit_id
  from public.membership_job_function_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.membership_id = target_membership_id
    and assignment_row.is_primary = true
    and assignment_row.valid_from <= statement_timestamp()
    and (
      assignment_row.valid_to is null
      or assignment_row.valid_to > statement_timestamp()
    )
  limit 1;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    null,
    target_due_at,
    null
  );

  insert into public.capability_action_context (
    organisation_id,
    action_id,
    gap_type,
    membership_id,
    course_id,
    skill_id,
    training_completion_id,
    skill_assessment_id,
    notes,
    created_by_membership_id
  )
  values (
    org_id,
    new_action_id,
    target_gap_type,
    target_membership_id,
    target_course_id,
    target_skill_id,
    target_training_completion_id,
    target_skill_assessment_id,
    target_notes,
    actor_membership_id
  );

  return new_action_id;
end;
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

  perform private.assert_current_organisation_module_entitled('projects');

  new_methodology_id := private.register_resource_record(
    org_id,
    'ci_project_methodology',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.ci_project_methodologies (
    organisation_id,
    id,
    name,
    code,
    description,
    created_by_membership_id
  )
  values (
    org_id,
    new_methodology_id,
    btrim(target_name),
    btrim(target_code),
    target_description,
    actor_membership_id
  );

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

  perform private.assert_current_organisation_module_entitled('projects');

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

create or replace function private.create_ci_project_metric(
  target_project_id uuid,
  target_metric_key text,
  target_display_name text,
  target_unit_label text default null,
  target_baseline_value numeric default null,
  target_target_value numeric default null
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
  metric_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'project metric creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  if exists (
    select 1
    from public.ci_projects project_table
    where project_table.organisation_id = org_id
      and project_table.id = target_project_id
      and project_table.status not in ('draft', 'submitted', 'approved')
  ) then
    raise exception 'metrics cannot be added in current project status'
      using errcode = '55000';
  end if;

  metric_id := gen_random_uuid();

  insert into public.ci_project_metrics (
    id,
    organisation_id,
    project_id,
    metric_key,
    display_name,
    unit_label,
    baseline_value,
    target_value,
    created_by_membership_id
  )
  values (
    metric_id,
    org_id,
    target_project_id,
    btrim(target_metric_key),
    btrim(target_display_name),
    target_unit_label,
    target_baseline_value,
    target_target_value,
    actor_membership_id
  );

  return metric_id;
end;
$$;

create or replace function private.create_containment(
  target_problem_solving_case_id uuid,
  target_description text,
  target_rationale text default null
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
  new_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'containment creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  insert into public.problem_solving_containments (
    organisation_id,
    problem_solving_case_id,
    description,
    rationale,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    btrim(target_description),
    target_rationale,
    'proposed',
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'containment.created',
    target_problem_solving_case_id,
    'succeeded',
    jsonb_build_object('containment_id', new_id, 'case_id', target_problem_solving_case_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_problem_solving_case_id,
    'ContainmentCreated',
    new_id::text,
    jsonb_build_object(
      'containment_id', new_id,
      'case_id', target_problem_solving_case_id
    )
  );

  return new_id;
end;
$$;

create or replace function private.create_countermeasure(
  target_case_id uuid,
  target_title text,
  target_description text default null,
  target_rationale text default null
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
  case_row public.problem_solving_cases%rowtype;
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'countermeasure creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'active' then
    raise exception 'case is not in a state that accepts countermeasures'
      using errcode = '55000';
  end if;

  if not private.can_contribute_problem_solving_case(org_id, target_case_id) then
    raise exception 'countermeasure creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_countermeasures (
    organisation_id,
    problem_solving_case_id,
    title,
    description,
    rationale,
    status,
    proposed_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_title),
    target_description,
    target_rationale,
    'proposed',
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.countermeasure_created',
    target_case_id,
    'succeeded',
    jsonb_build_object('countermeasure_id', new_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCountermeasureCreated',
    new_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'countermeasure_id', new_id
    )
  );

  return new_id;
end;
$$;

create or replace function private.create_current_condition_item(
  target_case_id uuid,
  target_category text,
  target_statement text,
  target_supersedes_item_id uuid default null
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
  case_row public.problem_solving_cases%rowtype;
  new_item_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'current condition item creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'cannot add items to a closed or cancelled case'
      using errcode = '55000';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.contribute', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.contribute', null, case_row.organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, case_row.organisation_unit_id)
    or (case_row.owner_membership_id = actor_membership_id)
    or (case_row.facilitator_membership_id = actor_membership_id)
  ) then
    raise exception 'current condition item creation is not authorised'
      using errcode = '42501';
  end if;

  if target_supersedes_item_id is not null then
    update public.problem_solving_current_condition_items
    set status = 'superseded',
        superseded_at = statement_timestamp()
    where organisation_id = org_id
      and id = target_supersedes_item_id
      and case_id = target_case_id
      and status = 'active';

    if not found then
      raise exception 'superseded item not found or already superseded'
        using errcode = 'P0002';
    end if;
  end if;

  insert into public.problem_solving_current_condition_items (
    organisation_id,
    case_id,
    category,
    statement,
    status,
    supersedes_item_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_category,
    btrim(target_statement),
    'active',
    null,
    actor_membership_id
  )
  returning id into new_item_id;

  return new_item_id;
end;
$$;

create or replace function private.create_effectiveness_check(
  target_case_id uuid,
  target_criterion text,
  target_baseline_description text default null,
  target_target_description text default null,
  target_baseline_numeric numeric default null,
  target_target_numeric numeric default null,
  target_unit text default null,
  target_observation_window_start date default null,
  target_observation_window_end date default null,
  target_due_date date default null
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
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'effectiveness check creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'effectiveness check creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_effectiveness_checks (
    organisation_id,
    case_id,
    criterion,
    baseline_description,
    target_description,
    baseline_numeric,
    target_numeric,
    unit,
    observation_window_start,
    observation_window_end,
    due_date,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_criterion),
    target_baseline_description,
    target_target_description,
    target_baseline_numeric,
    target_target_numeric,
    target_unit,
    target_observation_window_start,
    target_observation_window_end,
    target_due_date,
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.effectiveness_check_created',
    target_case_id,
    'succeeded',
    jsonb_build_object('effectiveness_check_id', new_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingEffectivenessCheckCreated',
    new_id::text,
    jsonb_build_object('case_id', target_case_id, 'effectiveness_check_id', new_id)
  );

  return new_id;
end;
$$;

create or replace function private.create_hypothesis(
  target_problem_solving_case_id uuid,
  target_statement text,
  target_parent_hypothesis_id uuid default null,
  target_category text default null,
  target_rationale text default null
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
  new_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'hypothesis creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_parent_hypothesis_id is not null then
    if not exists (
      select 1
      from public.problem_solving_hypotheses h
      where h.organisation_id = org_id
        and h.id = target_parent_hypothesis_id
        and h.problem_solving_case_id = target_problem_solving_case_id
    ) then
      raise exception 'parent hypothesis not found in the same case'
        using errcode = 'P0002';
    end if;
  end if;

  insert into public.problem_solving_hypotheses (
    organisation_id,
    problem_solving_case_id,
    statement,
    parent_hypothesis_id,
    category,
    rationale,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    btrim(target_statement),
    target_parent_hypothesis_id,
    target_category,
    target_rationale,
    'proposed',
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_hypothesis_status_history(
    org_id, new_id, 'proposed', 'proposed', actor_membership_id, 'created'
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.created',
    target_problem_solving_case_id,
    'succeeded',
    jsonb_build_object('hypothesis_id', new_id, 'case_id', target_problem_solving_case_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_problem_solving_case_id,
    'HypothesisCreated',
    new_id::text,
    jsonb_build_object(
      'hypothesis_id', new_id,
      'case_id', target_problem_solving_case_id
    )
  );

  return new_id;
end;
$$;

create or replace function private.create_hypothesis_test(
  target_hypothesis_id uuid,
  target_test_question text,
  target_expected_result text,
  target_method text default null,
  target_owner_membership_id uuid default null,
  target_planned_date date default null
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
  resolved_owner_membership_id uuid;
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis test creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis test creation is not authorised'
      using errcode = '42501';
  end if;

  if hypothesis_row.status in ('verified', 'rejected', 'superseded') then
    raise exception 'cannot create tests for a hypothesis in terminal state'
      using errcode = '55000';
  end if;

  resolved_owner_membership_id := coalesce(target_owner_membership_id, actor_membership_id);

  insert into public.problem_solving_hypothesis_tests (
    organisation_id,
    problem_solving_case_id,
    hypothesis_id,
    test_question,
    expected_result,
    method,
    owner_membership_id,
    planned_date,
    created_by_membership_id
  )
  values (
    org_id,
    hypothesis_row.problem_solving_case_id,
    target_hypothesis_id,
    btrim(target_test_question),
    btrim(target_expected_result),
    target_method,
    resolved_owner_membership_id,
    target_planned_date,
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'hypothesis_test.created',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'test_id', new_id,
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisTestCreated',
    new_id::text,
    jsonb_build_object(
      'test_id', new_id,
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return new_id;
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

  perform private.assert_current_organisation_module_entitled('projects');

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

create or replace function private.create_improvement_project_from_suggestion(target_suggestion_id uuid)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  new_project_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project creation from suggestion is not authorised' using errcode = '42501';
  end if;
  perform private.assert_current_organisation_module_entitled('projects');

  select suggestion_table.* into suggestion_row from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id;
  if not found then raise exception 'suggestion not found' using errcode = 'P0002'; end if;
  if suggestion_row.status not in ('accepted', 'implementing') then
    raise exception 'suggestion is not eligible for project creation' using errcode = '55000';
  end if;
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'project creation from suggestion is not authorised' using errcode = '42501';
  end if;
  new_project_id := private.create_improvement_project(
    suggestion_row.title,
    suggestion_row.review_jurisdiction_unit_id,
    suggestion_row.problem_or_opportunity,
    suggestion_row.proposed_idea,
    suggestion_row.expected_benefit_summary,
    target_suggestion_id
  );
  insert into public.suggestion_implementation_links (
    organisation_id, suggestion_id, implementation_resource_id, implementation_role, created_by_membership_id
  ) values (org_id, target_suggestion_id, new_project_id, 'ci_project', actor_membership_id);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionProjectCreated', new_project_id::text, '{}'::jsonb);
  return new_project_id;
end; $$;

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

create or replace function private.create_problem_solving_action(
  target_title text,
  target_problem_solving_case_id uuid,
  target_context_role text,
  target_containment_id uuid default null,
  target_countermeasure_id uuid default null,
  target_sustainment_item_id uuid default null,
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
  case_unit_id uuid;
  new_action_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'problem-solving action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_context_role not in ('containment', 'countermeasure', 'sustainment') then
    raise exception 'invalid context role'
      using errcode = '22023';
  end if;

  if target_context_role = 'containment' and target_containment_id is null then
    raise exception 'containment actions require a containment_id'
      using errcode = '22023';
  end if;
  if target_context_role = 'countermeasure' and target_countermeasure_id is null then
    raise exception 'countermeasure actions require a countermeasure_id'
      using errcode = '22023';
  end if;
  if target_context_role = 'sustainment' and target_sustainment_item_id is null then
    raise exception 'sustainment actions require a sustainment_item_id'
      using errcode = '22023';
  end if;

  select case_row.organisation_unit_id
  into case_unit_id
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_problem_solving_case_id;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    case_unit_id,
    target_problem_solving_case_id,
    target_due_at,
    null
  );

  insert into public.problem_solving_action_context (
    organisation_id,
    problem_solving_case_id,
    action_id,
    context_role,
    containment_id,
    countermeasure_id,
    sustainment_item_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    new_action_id,
    target_context_role,
    target_containment_id,
    target_countermeasure_id,
    target_sustainment_item_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

create or replace function private.create_problem_solving_case_draft(
  target_title text,
  target_organisation_unit_id uuid,
  target_problem_statement text default null,
  target_background text default null,
  target_business_impact text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_target_condition text default null,
  target_detected_at timestamptz default null,
  target_priority text default null,
  target_severity text default null,
  target_owner_membership_id uuid default null,
  target_facilitator_membership_id uuid default null,
  target_method_version_id uuid default null,
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
  resolved_owner_membership_id uuid;
  new_case_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'problem solving case creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.create', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.create', null, target_organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, target_organisation_unit_id)
  ) then
    raise exception 'problem solving case creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.ensure_builtin_problem_solving_methods(org_id);

  resolved_owner_membership_id := coalesce(target_owner_membership_id, actor_membership_id);

  new_case_id := private.register_resource_record(
    org_id,
    'problem_solving_case',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.problem_solving_cases (
    id,
    organisation_id,
    title,
    problem_statement,
    background,
    business_impact,
    scope_in,
    scope_out,
    target_condition,
    detected_at,
    organisation_unit_id,
    priority,
    severity,
    owner_membership_id,
    facilitator_membership_id,
    method_version_id,
    status,
    target_due_at,
    created_by_membership_id
  )
  values (
    new_case_id,
    org_id,
    btrim(target_title),
    target_problem_statement,
    target_background,
    target_business_impact,
    target_scope_in,
    target_scope_out,
    target_target_condition,
    target_detected_at,
    target_organisation_unit_id,
    target_priority,
    target_severity,
    resolved_owner_membership_id,
    target_facilitator_membership_id,
    target_method_version_id,
    'draft',
    null,
    actor_membership_id
  );

  if target_source_resource_id is not null then
    if not private.can_reference_source_resource(org_id, target_source_resource_id) then
      raise exception 'source resource is not referenceable'
        using errcode = '42501';
    end if;

    insert into public.problem_solving_source_links (
      organisation_id,
      case_id,
      source_resource_id,
      link_role,
      created_by_membership_id
    )
    values (
      org_id,
      new_case_id,
      target_source_resource_id,
      'primary',
      actor_membership_id
    );
  end if;

  perform private.append_business_audit(
    org_id,
    'problem_solving_case.created',
    new_case_id,
    'succeeded',
    jsonb_build_object('title', btrim(target_title))
  );

  return new_case_id;
end;
$$;

create or replace function private.create_problem_solving_lessons_learned(
  target_case_id uuid,
  target_what_happened text,
  target_what_learned text,
  target_standardise text default null,
  target_apply_elsewhere text default null,
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
  new_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'lessons learned creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  insert into public.problem_solving_lessons_learned (
    organisation_id,
    case_id,
    what_happened,
    what_learned,
    standardise,
    apply_elsewhere,
    notes,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_what_happened),
    btrim(target_what_learned),
    target_standardise,
    target_apply_elsewhere,
    target_notes,
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.lessons_learned.created',
    target_case_id,
    'succeeded',
    jsonb_build_object('lesson_learned_id', new_id)
  );

  return new_id;
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

  perform private.assert_current_organisation_module_entitled('projects');

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

create or replace function private.create_recognition_type(
  target_name text, target_code text, target_description text default null
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_type_id uuid;
begin
  perform private.assert_current_organisation_module_entitled('recognition');

  if not private.has_scoped_permission(org_id, 'recognition.manage', null, null) then
    raise exception 'recognition type creation is not authorised' using errcode = '42501';
  end if;
  insert into public.recognition_types (
    organisation_id, name, code, description, created_by_membership_id
  ) values (org_id, btrim(target_name), btrim(target_code), target_description, actor_membership_id)
  returning id into new_type_id;
  return new_type_id;
end; $$;

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

  perform private.assert_current_organisation_module_entitled('skills');

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

  perform private.assert_current_organisation_module_entitled('skills');

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

  perform private.assert_current_organisation_module_entitled('skills');

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

create or replace function private.create_skill_setup_draft(
  target_idempotency_key text,
  target_definition jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  definition jsonb;
  source_text text;
  template_key text;
  template_version text;
  title_text text;
  applicability_text text;
  resolution_text text;
  sample_flag boolean;
  scale_json jsonb;
  skills_json jsonb;
  standard_json jsonb;
  requirements_json jsonb;
  unresolved_json jsonb;
  scale_name text;
  scale_description text;
  levels_json jsonb;
  level_item jsonb;
  level_label text;
  level_guidance text;
  level_order integer;
  level_signature text := '';
  seen_labels text[] := '{}';
  seen_orders integer[] := '{}';
  existing_bundle_id uuid;
  existing_bundle_status text;
  existing_request_definition jsonb;
  existing_scale_id uuid;
  existing_version_id uuid;
  incompatible_scale boolean := false;
  scale_id uuid;
  scale_version_id uuid;
  scale_ownership text;
  skill_item jsonb;
  skill_name text;
  skill_code text;
  skill_category text;
  skill_description text;
  skill_evidence text;
  seen_codes text[] := '{}';
  staged_skills jsonb := '[]'::jsonb;
  skill_id uuid;
  skill_ownership text;
  standard_name text;
  standard_code text;
  standard_description text;
  code_suffix integer := 0;
  set_id uuid;
  set_version_id uuid;
  requirement_item jsonb;
  requirement_code text;
  requirement_skill_id uuid;
  requirement_job_function_id uuid;
  requirement_unit_id uuid;
  requirement_level_label text;
  requirement_level_id uuid;
  requirement_evidence text;
  requirement_notes text;
  requirement_id uuid;
  bundle_id uuid;
  level_map jsonb;
  staged_requirements jsonb := '[]'::jsonb;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('skills');

  if target_idempotency_key is null
    or target_idempotency_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  if target_definition is null
    or pg_catalog.jsonb_typeof(target_definition) is distinct from 'object'
    or octet_length(target_definition::text) > 200000 then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(org_id::text || ':skill-setup:' || target_idempotency_key, 0)
  );

  select bundle_row.id, bundle_row.status, bundle_row.request_definition
  into existing_bundle_id, existing_bundle_status, existing_request_definition
  from public.skill_setup_bundles bundle_row
  where bundle_row.organisation_id = org_id
    and bundle_row.idempotency_key = target_idempotency_key;

  if existing_bundle_id is not null then
    if existing_bundle_status = 'draft'
      and existing_request_definition = target_definition then
      return existing_bundle_id;
    end if;
    if existing_bundle_status = 'draft' then
      raise exception 'skill setup creation key does not match this content'
        using errcode = '22023';
    end if;
    raise exception 'skill setup creation key is already finished'
      using errcode = '22023';
  end if;

  definition := private.module_setup_require_object(target_definition, 'definition');
  source_text := private.module_setup_require_text(
    definition -> 'source', 'source', 1, 20, true
  );
  if source_text not in ('manual', 'quick_start', 'leanai') then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  template_key := private.module_setup_require_text(
    definition -> 'template_key', 'template key', 1, 80, false
  );
  template_version := private.module_setup_require_text(
    definition -> 'template_version', 'template version', 1, 40, false
  );
  title_text := private.module_setup_require_text(
    definition -> 'title', 'title', 1, 160, true
  );
  applicability_text := coalesce(
    private.module_setup_require_text(
      definition -> 'applicability', 'applicability', 1, 20, false
    ),
    'organisation'
  );
  if applicability_text not in ('organisation', 'units') then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  resolution_text := coalesce(
    private.module_setup_require_text(
      definition -> 'scale_resolution', 'scale resolution', 1, 32, false
    ),
    'create'
  );
  if resolution_text not in ('create', 'reuse', 'create_alongside') then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  sample_flag := source_text = 'quick_start'
    or coalesce((definition ->> 'sample')::boolean, false);

  scale_json := private.module_setup_require_object(definition -> 'scale', 'scale');
  skills_json := private.module_setup_require_array(
    definition -> 'skills', 'skills', 1, 24
  );
  standard_json := private.module_setup_require_object(
    definition -> 'standard', 'standard'
  );
  requirements_json := private.module_setup_require_array(
    coalesce(definition -> 'requirements', '[]'::jsonb),
    'requirements',
    0,
    80
  );
  unresolved_json := coalesce(definition -> 'unresolved_roles', '[]'::jsonb);
  if pg_catalog.jsonb_typeof(unresolved_json) is distinct from 'array'
    or jsonb_array_length(unresolved_json) > 40 then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  scale_name := private.module_setup_require_text(
    scale_json -> 'name', 'scale name', 1, 160, true
  );
  scale_description := private.module_setup_require_text(
    scale_json -> 'description', 'scale description', 1, 2000, false
  );
  levels_json := private.module_setup_require_array(
    scale_json -> 'levels', 'levels', 2, 8
  );

  for level_item in
    select value from jsonb_array_elements(levels_json)
  loop
    perform private.module_setup_require_object(level_item, 'level');
    level_label := private.module_setup_require_text(
      level_item -> 'label', 'level label', 1, 120, true
    );
    level_guidance := private.module_setup_require_text(
      level_item -> 'guidance', 'level guidance', 1, 2000, false
    );
    if coalesce(level_item ->> 'order', '') !~ '^[0-9]{1,3}$' then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
    level_order := (level_item ->> 'order')::integer;
    if level_order < 0 or level_order > 999
      or lower(level_label) = any (seen_labels)
      or level_order = any (seen_orders) then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
    seen_labels := array_append(seen_labels, lower(level_label));
    seen_orders := array_append(seen_orders, level_order);
    level_signature := level_signature || lower(level_label) || '|';
  end loop;

  select scale_row.id, version_row.id
  into existing_scale_id, existing_version_id
  from public.skill_proficiency_scales scale_row
  join public.skill_proficiency_scale_versions version_row
    on version_row.organisation_id = scale_row.organisation_id
    and version_row.scale_id = scale_row.id
    and version_row.status = 'published'
  where scale_row.organisation_id = org_id
    and scale_row.status = 'active'
    and lower(scale_row.name) = lower(scale_name)
    and (
      select coalesce(string_agg(lower(level_row.label), '|' order by level_row.order_value), '') || '|'
      from public.skill_proficiency_levels level_row
      where level_row.organisation_id = org_id
        and level_row.scale_version_id = version_row.id
    ) = level_signature
  order by version_row.published_at desc nulls last
  limit 1;

  if existing_scale_id is null and exists (
    select 1
    from public.skill_proficiency_scales scale_row
    where scale_row.organisation_id = org_id
      and scale_row.status = 'active'
      and lower(scale_row.name) = lower(scale_name)
  ) then
    incompatible_scale := true;
  end if;

  if existing_scale_id is not null then
    scale_id := existing_scale_id;
    scale_version_id := existing_version_id;
    scale_ownership := 'reused';
  elsif resolution_text = 'reuse' then
    raise exception 'compatible proficiency scale was not found'
      using errcode = '22023';
  elsif incompatible_scale and resolution_text is distinct from 'create_alongside' then
    raise exception 'existing proficiency scale differs'
      using errcode = '22023';
  else
    if incompatible_scale then
      scale_name := left(scale_name, 145) || ' (setup draft)';
    end if;
    if sample_flag and scale_description is not null
      and scale_description not like 'Sample.%' then
      scale_description := left('Sample. ' || scale_description, 2000);
    end if;

    insert into public.skill_proficiency_scales (
      organisation_id, name, description, created_by_membership_id
    )
    values (org_id, scale_name, scale_description, actor_membership_id)
    returning id into scale_id;

    insert into public.skill_proficiency_scale_versions (
      organisation_id, scale_id, version_number, status, created_by_membership_id
    )
    values (org_id, scale_id, 1, 'draft', actor_membership_id)
    returning id into scale_version_id;

    for level_item in
      select value from jsonb_array_elements(levels_json)
    loop
      insert into public.skill_proficiency_levels (
        organisation_id,
        scale_version_id,
        order_value,
        label,
        guidance
      )
      values (
        org_id,
        scale_version_id,
        (level_item ->> 'order')::integer,
        private.module_setup_require_text(level_item -> 'label', 'level label', 1, 120, true),
        private.module_setup_require_text(level_item -> 'guidance', 'level guidance', 1, 2000, false)
      );
    end loop;
    scale_ownership := 'created';
  end if;

  for skill_item in
    select value from jsonb_array_elements(skills_json)
  loop
    perform private.module_setup_require_object(skill_item, 'skill');
    skill_name := private.module_setup_require_text(
      skill_item -> 'name', 'skill name', 1, 160, true
    );
    skill_code := lower(private.module_setup_require_text(
      skill_item -> 'code', 'skill code', 1, 80, true
    ));
    if skill_code !~ '^[a-z0-9][a-z0-9._-]{0,79}$'
      or skill_code = any (seen_codes) then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
    seen_codes := array_append(seen_codes, skill_code);
    skill_category := private.module_setup_require_text(
      skill_item -> 'category', 'skill category', 1, 120, false
    );
    skill_description := private.module_setup_require_text(
      skill_item -> 'description', 'skill description', 1, 2000, false
    );
    skill_evidence := private.module_setup_require_text(
      skill_item -> 'evidence_expectations', 'evidence expectations', 1, 2000, false
    );

    select skill_row.id
    into skill_id
    from public.skills skill_row
    where skill_row.organisation_id = org_id
      and skill_row.status in ('draft', 'active')
      and (
        skill_row.code = skill_code
        or lower(skill_row.name) = lower(skill_name)
      )
    order by case when skill_row.code = skill_code then 0 else 1 end
    limit 1;

    if skill_id is not null then
      skill_ownership := 'reused';
    else
      if sample_flag then
        if skill_description is null or skill_description not like 'Sample.%' then
          skill_description := left(
            'Sample. ' || coalesce(skill_description, 'Review this skill before publishing.'),
            2000
          );
        end if;
      end if;
      skill_id := private.register_resource_record(
        org_id, 'skill', gen_random_uuid(), actor_membership_id
      );
      insert into public.skills (
        id,
        organisation_id,
        name,
        code,
        category,
        description,
        evidence_expectations,
        status,
        created_by_membership_id
      )
      values (
        skill_id,
        org_id,
        skill_name,
        skill_code,
        skill_category,
        skill_description,
        skill_evidence,
        'draft',
        actor_membership_id
      );
      skill_ownership := 'created';
    end if;

    staged_skills := staged_skills || jsonb_build_object(
      'id', skill_id,
      'code', skill_code,
      'name', skill_name,
      'ownership', skill_ownership
    );
  end loop;

  standard_name := private.module_setup_require_text(
    standard_json -> 'name', 'standard name', 1, 160, true
  );
  standard_code := lower(private.module_setup_require_text(
    standard_json -> 'code', 'standard code', 1, 80, true
  ));
  standard_description := private.module_setup_require_text(
    standard_json -> 'description', 'standard description', 1, 2000, false
  );
  if standard_code !~ '^[a-z0-9][a-z0-9._-]{0,79}$' then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;
  if sample_flag and (
    standard_description is null or standard_description not like 'Sample.%'
  ) then
    standard_description := left(
      'Sample. ' || coalesce(standard_description, 'Review before publishing.'),
      2000
    );
  end if;

  while exists (
    select 1
    from public.skill_capability_sets set_row
    where set_row.organisation_id = org_id
      and set_row.code = standard_code
  ) loop
    code_suffix := code_suffix + 1;
    standard_code := left(
      regexp_replace(standard_code, '-[0-9]+$', ''),
      70
    ) || '-' || code_suffix::text;
    if code_suffix > 20 then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
  end loop;

  insert into public.skill_capability_sets (
    organisation_id, name, code, description, created_by_membership_id
  )
  values (
    org_id, standard_name, standard_code, standard_description, actor_membership_id
  )
  returning id into set_id;

  insert into public.skill_capability_set_versions (
    organisation_id, capability_set_id, version_number, status, created_by_membership_id
  )
  values (org_id, set_id, 1, 'draft', actor_membership_id)
  returning id into set_version_id;

  select coalesce(jsonb_object_agg(lower(level_row.label), level_row.id), '{}'::jsonb)
  into level_map
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.scale_version_id = scale_version_id;

  for requirement_item in
    select value from jsonb_array_elements(requirements_json)
  loop
    perform private.module_setup_require_object(requirement_item, 'requirement');
    requirement_code := lower(private.module_setup_require_text(
      requirement_item -> 'skill_code', 'requirement skill', 1, 80, true
    ));
    select (staged.item ->> 'id')::uuid
    into requirement_skill_id
    from jsonb_array_elements(staged_skills) staged(item)
    where staged.item ->> 'code' = requirement_code
    limit 1;
    if requirement_skill_id is null then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;

    requirement_job_function_id := private.skills_setup_uuid(
      requirement_item ->> 'job_function_id', true
    );
    if not exists (
      select 1
      from public.job_functions job_function_row
      where job_function_row.organisation_id = org_id
        and job_function_row.id = requirement_job_function_id
        and job_function_row.status = 'active'
    ) then
      raise exception 'job function is not in this organisation'
        using errcode = '22023';
    end if;

    requirement_unit_id := private.skills_setup_uuid(
      requirement_item ->> 'organisational_unit_id', false
    );
    if applicability_text = 'organisation' then
      requirement_unit_id := null;
    elsif requirement_unit_id is null then
      raise exception 'unit applicability requires an organisational unit'
        using errcode = '22023';
    end if;
    if requirement_unit_id is not null and not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = requirement_unit_id
        and unit_row.status = 'active'
    ) then
      raise exception 'organisational unit is not in this organisation'
        using errcode = '22023';
    end if;

    requirement_level_label := lower(private.module_setup_require_text(
      requirement_item -> 'level_label', 'requirement level', 1, 120, true
    ));
    requirement_level_id := (level_map ->> requirement_level_label)::uuid;
    if requirement_level_id is null then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;

    requirement_evidence := private.module_setup_require_text(
      requirement_item -> 'evidence_requirement', 'evidence requirement', 1, 2000, false
    );
    requirement_notes := private.module_setup_require_text(
      requirement_item -> 'notes', 'requirement notes', 1, 2000, false
    );
    if sample_flag and (
      requirement_notes is null or requirement_notes not like 'Sample.%'
    ) then
      requirement_notes := left(
        'Sample. ' || coalesce(requirement_notes, 'Review this requirement before publishing.'),
        2000
      );
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
      set_version_id,
      requirement_skill_id,
      requirement_job_function_id,
      requirement_unit_id,
      scale_version_id,
      requirement_level_id,
      coalesce((requirement_item ->> 'mandatory')::boolean, true),
      requirement_evidence,
      requirement_notes
    )
    returning id into requirement_id;

    staged_requirements := staged_requirements || jsonb_build_object(
      'id', requirement_id,
      'label', left(requirement_code, 160)
    );
  end loop;

  insert into public.skill_setup_bundles (
    organisation_id,
    source,
    template_key,
    template_version,
    title,
    status,
    idempotency_key,
    applicability,
    sample,
    unresolved,
    request_definition,
    scale_id,
    scale_version_id,
    capability_set_id,
    capability_set_version_id,
    created_by_membership_id
  )
  values (
    org_id,
    source_text,
    template_key,
    template_version,
    title_text,
    'draft',
    target_idempotency_key,
    applicability_text,
    sample_flag,
    unresolved_json,
    target_definition,
    scale_id,
    scale_version_id,
    set_id,
    set_version_id,
    actor_membership_id
  )
  returning id into bundle_id;

  insert into public.skill_setup_bundle_items (
    organisation_id, bundle_id, record_kind, record_id, ownership, label
  )
  select
    org_id,
    bundle_id,
    'requirement',
    (staged.item ->> 'id')::uuid,
    'created',
    staged.item ->> 'label'
  from jsonb_array_elements(staged_requirements) staged(item);

  insert into public.skill_setup_bundle_items (
    organisation_id, bundle_id, record_kind, record_id, ownership, label
  )
  values
    (org_id, bundle_id, 'scale', scale_id, scale_ownership, left(scale_name, 160)),
    (org_id, bundle_id, 'capability_set', set_id, 'created', left(standard_name, 160));

  insert into public.skill_setup_bundle_items (
    organisation_id, bundle_id, record_kind, record_id, ownership, label
  )
  select
    org_id,
    bundle_id,
    'skill',
    (staged.item ->> 'id')::uuid,
    staged.item ->> 'ownership',
    left(staged.item ->> 'name', 160)
  from jsonb_array_elements(staged_skills) staged(item);

  return bundle_id;
end;
$$;

create or replace function private.create_training_course_draft(
  target_name text,
  target_code text,
  target_category text default null,
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
  new_course_id uuid;
  new_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_catalog(org_id) then
    raise exception 'training course creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  new_course_id := private.register_resource_record(
    org_id,
    'training_course',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.training_courses (
    id, organisation_id, name, code, category, description, created_by_membership_id
  )
  values (
    new_course_id,
    org_id,
    btrim(target_name),
    lower(btrim(target_code)),
    target_category,
    target_description,
    actor_membership_id
  );

  insert into public.training_course_versions (
    organisation_id,
    course_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (org_id, new_course_id, 1, 'draft', actor_membership_id)
  returning id into new_version_id;

  perform private.append_business_audit(
    org_id,
    'training.course.created',
    new_course_id,
    'succeeded',
    jsonb_build_object('version_id', new_version_id)
  );

  return new_course_id;
end;
$$;

create or replace function private.create_training_course_successor_version(
  target_course_id uuid
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
  source_version public.training_course_versions%rowtype;
  new_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_catalog(org_id) then
    raise exception 'training course successor creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  select version_row.*
  into source_version
  from public.training_course_versions version_row
  where version_row.organisation_id = org_id
    and version_row.course_id = target_course_id
    and version_row.status = 'published'
  order by version_row.version_number desc
  limit 1;

  if not found then
    raise exception 'published course version not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.training_course_versions draft_row
    where draft_row.organisation_id = org_id
      and draft_row.course_id = target_course_id
      and draft_row.status = 'draft'
  ) then
    raise exception 'draft course version already exists'
      using errcode = '55000';
  end if;

  insert into public.training_course_versions (
    organisation_id,
    course_id,
    version_number,
    status,
    duration_minutes,
    learning_objectives,
    validity_days,
    delivery_method,
    trainer_requirements,
    evidence_requirements,
    created_by_membership_id
  )
  values (
    org_id,
    target_course_id,
    source_version.version_number + 1,
    'draft',
    source_version.duration_minutes,
    source_version.learning_objectives,
    source_version.validity_days,
    source_version.delivery_method,
    source_version.trainer_requirements,
    source_version.evidence_requirements,
    actor_membership_id
  )
  returning id into new_version_id;

  return new_version_id;
end;
$$;

create or replace function private.create_training_curriculum_draft(
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
  new_curriculum_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training curriculum creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  insert into public.training_curricula (
    organisation_id, name, code, description, created_by_membership_id
  )
  values (
    org_id,
    btrim(target_name),
    lower(btrim(target_code)),
    target_description,
    actor_membership_id
  )
  returning id into new_curriculum_id;

  insert into public.training_curriculum_versions (
    organisation_id,
    curriculum_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (org_id, new_curriculum_id, 1, 'draft', actor_membership_id);

  return new_curriculum_id;
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

  perform private.assert_current_organisation_module_entitled('training');

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

create or replace function private.create_training_session(
  target_course_version_id uuid,
  target_title text,
  target_organisational_unit_id uuid default null,
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_scheduled_start timestamptz default null,
  target_scheduled_end timestamptz default null,
  target_location text default null,
  target_online_metadata jsonb default null,
  target_capacity integer default null,
  target_notes text default null,
  target_schedule_occurrence_id uuid default null
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
  new_session_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_sessions(org_id) then
    raise exception 'training session creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  new_session_id := private.register_resource_record(
    org_id,
    'training_session',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.training_sessions (
    id,
    organisation_id,
    course_version_id,
    title,
    organisational_unit_id,
    trainer_membership_id,
    trainer_name,
    scheduled_start,
    scheduled_end,
    location,
    online_metadata,
    capacity,
    notes,
    schedule_occurrence_id,
    created_by_membership_id
  )
  values (
    new_session_id,
    org_id,
    target_course_version_id,
    btrim(target_title),
    target_organisational_unit_id,
    target_trainer_membership_id,
    target_trainer_name,
    target_scheduled_start,
    target_scheduled_end,
    target_location,
    target_online_metadata,
    target_capacity,
    target_notes,
    target_schedule_occurrence_id,
    actor_membership_id
  );

  perform private.enqueue_domain_event(
    org_id,
    new_session_id,
    'TrainingSessionCreated',
    new_session_id::text,
    jsonb_build_object('course_version_id', target_course_version_id)
  );

  return new_session_id;
end;
$$;

create or replace function private.create_training_setup_draft(
  target_idempotency_key text,
  target_definition jsonb
)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  definition jsonb;
  source_text text;
  title_text text;
  sample_flag boolean;
  courses_json jsonb;
  curriculum_json jsonb;
  unresolved_json jsonb;
  course_item jsonb;
  course_name text;
  course_code text;
  course_id uuid;
  course_version_id uuid;
  seen_codes text[] := '{}';
  bundle_id uuid;
  new_curriculum_id uuid;
  new_curriculum_version_id uuid;
  curriculum_name text;
  curriculum_code text;
  requirement_item jsonb;
  requirement_id uuid;
  requirement_course_code text;
  requirement_course_id uuid;
  requirement_job_function_id uuid;
  existing_bundle_id uuid;
  existing_bundle_status text;
  existing_request_definition jsonb;
begin
  if org_id is null or actor_membership_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  perform private.assert_current_organisation_module_entitled('training');

  if target_idempotency_key is null or target_idempotency_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'module setup definition is invalid' using errcode = '22023';
  end if;
  if target_definition is null or jsonb_typeof(target_definition) is distinct from 'object'
    or octet_length(target_definition::text) > 200000 then
    raise exception 'module setup definition is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':training-setup:' || target_idempotency_key, 0));

  select bundle_row.id, bundle_row.status, bundle_row.request_definition
  into existing_bundle_id, existing_bundle_status, existing_request_definition
  from public.training_setup_bundles bundle_row
  where bundle_row.organisation_id = org_id and bundle_row.idempotency_key = target_idempotency_key;

  if existing_bundle_id is not null then
    if existing_bundle_status = 'draft' and existing_request_definition = target_definition then
      return existing_bundle_id;
    end if;
    if existing_bundle_status = 'draft' then
      raise exception 'training setup creation key does not match this content' using errcode = '22023';
    end if;
    raise exception 'training setup creation key is already finished' using errcode = '22023';
  end if;

  definition := private.module_setup_require_object(target_definition, 'definition');
  source_text := private.module_setup_require_text(definition -> 'source', 'source', 1, 20, true);
  if source_text not in ('manual', 'quick_start', 'leanai') then
    raise exception 'module setup definition is invalid' using errcode = '22023';
  end if;
  title_text := private.module_setup_require_text(definition -> 'title', 'title', 1, 160, true);
  sample_flag := source_text = 'quick_start' or coalesce((definition ->> 'sample')::boolean, false);
  courses_json := private.module_setup_require_array(definition -> 'courses', 'courses', 1, 24);
  curriculum_json := definition -> 'curriculum';
  unresolved_json := coalesce(definition -> 'unresolved_roles', '[]'::jsonb);

  insert into public.training_setup_bundles (
    organisation_id, source, template_key, template_version, title, status,
    idempotency_key, sample, unresolved, request_definition, created_by_membership_id
  ) values (
    org_id,
    source_text,
    private.module_setup_require_text(definition -> 'template_key', 'template key', 1, 80, false),
    private.module_setup_require_text(definition -> 'template_version', 'template version', 1, 40, false),
    title_text,
    'draft',
    target_idempotency_key,
    sample_flag,
    unresolved_json,
    target_definition,
    actor_membership_id
  ) returning id into bundle_id;

  for course_item in select value from jsonb_array_elements(courses_json) loop
    perform private.module_setup_require_object(course_item, 'course');
    course_name := private.module_setup_require_text(course_item -> 'name', 'course name', 1, 160, true);
    course_code := lower(private.module_setup_require_text(course_item -> 'code', 'course code', 1, 80, true));
    if course_code = any(seen_codes) then
      raise exception 'module setup definition is invalid' using errcode = '22023';
    end if;
    seen_codes := array_append(seen_codes, course_code);

    course_id := private.register_resource_record(org_id, 'training_course', gen_random_uuid(), actor_membership_id);
    insert into public.training_courses (
      id, organisation_id, name, code, category, description, created_by_membership_id
    ) values (
      course_id, org_id, course_name, course_code,
      private.module_setup_require_text(course_item -> 'category', 'category', 1, 120, false),
      private.module_setup_require_text(course_item -> 'description', 'description', 1, 2000, false),
      actor_membership_id
    );
    insert into public.training_course_versions (
      organisation_id, course_id, version_number, status,
      duration_minutes, learning_objectives, delivery_method, created_by_membership_id
    ) values (
      org_id, course_id, 1, 'draft',
      (course_item ->> 'duration_minutes')::integer,
      private.module_setup_require_text(course_item -> 'learning_objectives', 'objectives', 1, 4000, false),
      private.module_setup_require_text(course_item -> 'delivery_method', 'delivery', 1, 40, false),
      actor_membership_id
    ) returning id into course_version_id;

    insert into public.training_setup_bundle_items (
      organisation_id, bundle_id, record_kind, record_id, ownership, label
    ) values
      (org_id, bundle_id, 'course', course_id, 'created', left(course_name, 160)),
      (org_id, bundle_id, 'course_version', course_version_id, 'created', left(course_name, 160));
  end loop;

  if curriculum_json is not null and jsonb_typeof(curriculum_json) = 'object' then
    curriculum_name := private.module_setup_require_text(curriculum_json -> 'name', 'curriculum name', 1, 160, true);
    curriculum_code := lower(private.module_setup_require_text(curriculum_json -> 'code', 'curriculum code', 1, 80, true));
    insert into public.training_curricula (
      organisation_id, name, code, description, created_by_membership_id
    ) values (
      org_id, curriculum_name, curriculum_code,
      private.module_setup_require_text(curriculum_json -> 'description', 'description', 1, 2000, false),
      actor_membership_id
    ) returning id into new_curriculum_id;

    insert into public.training_curriculum_versions (
      organisation_id, curriculum_id, version_number, status, created_by_membership_id
    ) values (org_id, new_curriculum_id, 1, 'draft', actor_membership_id)
    returning id into new_curriculum_version_id;

    update public.training_setup_bundles bundle_row
    set
      curriculum_id = new_curriculum_id,
      curriculum_version_id = new_curriculum_version_id
    where bundle_row.organisation_id = org_id and bundle_row.id = bundle_id;

    insert into public.training_setup_bundle_items (
      organisation_id, bundle_id, record_kind, record_id, ownership, label
    ) values (org_id, bundle_id, 'curriculum', new_curriculum_id, 'created', left(curriculum_name, 160));

    for requirement_item in
      select value from jsonb_array_elements(coalesce(curriculum_json -> 'requirements', '[]'::jsonb))
    loop
      requirement_course_code := lower(private.module_setup_require_text(requirement_item -> 'course_code', 'course code', 1, 80, true));
      select course_row.id into requirement_course_id
      from public.training_courses course_row
      join public.training_setup_bundle_items item_row
        on item_row.organisation_id = org_id and item_row.bundle_id = bundle_id
        and item_row.record_kind = 'course' and item_row.record_id = course_row.id
      where course_row.organisation_id = org_id and course_row.code = requirement_course_code;
      if requirement_course_id is null then
        raise exception 'module setup definition is invalid' using errcode = '22023';
      end if;
      requirement_job_function_id := (requirement_item ->> 'job_function_id')::uuid;
      requirement_id := private.add_training_requirement(
        new_curriculum_version_id,
        requirement_course_id,
        requirement_job_function_id,
        (requirement_item ->> 'organisational_unit_id')::uuid,
        false,
        coalesce((requirement_item ->> 'mandatory')::boolean, true),
        null,
        null,
        null,
        private.module_setup_require_text(requirement_item -> 'notes', 'notes', 1, 2000, false)
      );
      insert into public.training_setup_bundle_items (
        organisation_id, bundle_id, record_kind, record_id, ownership, label
      ) values (org_id, bundle_id, 'requirement', requirement_id, 'created', left(requirement_course_code, 160));
    end loop;
  end if;

  return bundle_id;
end;
$$;

create or replace function public.create_workforce_import_job(
  target_original_filename text
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
  new_job_id uuid;
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  if target_original_filename is null
    or btrim(target_original_filename) = ''
    or char_length(btrim(target_original_filename)) > 255 then
    raise exception 'original filename is invalid'
      using errcode = '22023';
  end if;

  insert into public.workforce_import_jobs (
    organisation_id,
    created_by_membership_id,
    status,
    original_filename
  )
  values (
    org_id,
    actor_membership_id,
    'draft',
    btrim(target_original_filename)
  )
  returning id into new_job_id;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    org_id,
    'workforce.import_job_created',
    'workforce_import_job',
    new_job_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('original_filename', btrim(target_original_filename))
  );

  return new_job_id;
end;
$$;

create or replace function private.discard_skill_setup_bundle(
  target_bundle_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  bundle_row public.skill_setup_bundles%rowtype;
  preview jsonb;
  removed_item jsonb;
  skill_id uuid;
begin
  if org_id is null or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('skills');

  select bundle.*
  into bundle_row
  from public.skill_setup_bundles bundle
  where bundle.organisation_id = org_id
    and bundle.id = target_bundle_id
  for update;

  if not found then
    raise exception 'skill setup bundle was not found'
      using errcode = 'P0002';
  end if;

  if bundle_row.status = 'published' then
    raise exception 'published setup bundles are kept'
      using errcode = '22023';
  end if;

  if bundle_row.status = 'discarded' then
    return private.preview_skill_setup_bundle_discard(target_bundle_id);
  end if;

  preview := private.preview_skill_setup_bundle_discard(target_bundle_id);

  delete from public.skill_requirements requirement_row
  where requirement_row.organisation_id = org_id
    and requirement_row.capability_set_version_id = bundle_row.capability_set_version_id
    and requirement_row.id in (
      select item_row.record_id
      from public.skill_setup_bundle_items item_row
      where item_row.organisation_id = org_id
        and item_row.bundle_id = bundle_row.id
        and item_row.record_kind = 'requirement'
        and item_row.ownership = 'created'
    );

  for removed_item in
    select value
    from jsonb_array_elements(coalesce(preview -> 'removed', '[]'::jsonb))
  loop
    if removed_item ->> 'kind' <> 'skill' then
      continue;
    end if;
    skill_id := (removed_item ->> 'id')::uuid;
    if private.skills_setup_skill_retain_reason(
      org_id, skill_id, bundle_row.capability_set_version_id
    ) is not null then
      continue;
    end if;
    delete from public.skills skill_row
    where skill_row.organisation_id = org_id
      and skill_row.id = skill_id
      and skill_row.status = 'draft';
    update public.resource_records resource_row
    set retired_at = statement_timestamp()
    where resource_row.organisation_id = org_id
      and resource_row.id = skill_id
      and resource_row.retired_at is null
      and not exists (
        select 1
        from public.skills still_there
        where still_there.organisation_id = org_id
          and still_there.id = skill_id
      );
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(preview -> 'removed', '[]'::jsonb)) removed(item)
    where removed.item ->> 'kind' = 'scale'
  ) and not exists (
    select 1
    from public.skill_requirements requirement_row
    where requirement_row.organisation_id = org_id
      and requirement_row.proficiency_scale_version_id = bundle_row.scale_version_id
  ) and not exists (
    select 1
    from public.membership_skill_assessments assessment_row
    where assessment_row.organisation_id = org_id
      and assessment_row.proficiency_scale_version_id = bundle_row.scale_version_id
  ) then
    update public.skill_setup_bundles bundle
    set scale_id = null, scale_version_id = null
    where bundle.organisation_id = org_id
      and bundle.id = bundle_row.id;
    delete from public.skill_proficiency_levels level_row
    where level_row.organisation_id = org_id
      and level_row.scale_version_id = bundle_row.scale_version_id;
    delete from public.skill_proficiency_scale_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = bundle_row.scale_version_id
      and version_row.status = 'draft';
    delete from public.skill_proficiency_scales scale_row
    where scale_row.organisation_id = org_id
      and scale_row.id = bundle_row.scale_id
      and not exists (
        select 1
        from public.skill_proficiency_scale_versions version_row
        where version_row.organisation_id = org_id
          and version_row.scale_id = scale_row.id
      );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(preview -> 'removed', '[]'::jsonb)) removed(item)
    where removed.item ->> 'kind' = 'capability_set'
  ) then
    update public.skill_setup_bundles bundle
    set capability_set_id = null, capability_set_version_id = null
    where bundle.organisation_id = org_id
      and bundle.id = bundle_row.id
      and exists (
        select 1
        from public.skill_capability_set_versions version_row
        where version_row.organisation_id = org_id
          and version_row.id = bundle_row.capability_set_version_id
          and version_row.status = 'draft'
      );
    delete from public.skill_capability_set_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = bundle_row.capability_set_version_id
      and version_row.status = 'draft'
      and not exists (
        select 1
        from public.skill_requirements requirement_row
        where requirement_row.organisation_id = org_id
          and requirement_row.capability_set_version_id = version_row.id
      );
    delete from public.skill_capability_sets set_row
    where set_row.organisation_id = org_id
      and set_row.id = bundle_row.capability_set_id
      and not exists (
        select 1
        from public.skill_capability_set_versions version_row
        where version_row.organisation_id = org_id
          and version_row.capability_set_id = set_row.id
      );
  end if;

  update public.skill_setup_bundles bundle
  set status = 'discarded', discarded_at = statement_timestamp()
  where bundle.organisation_id = org_id
    and bundle.id = bundle_row.id;

  return preview || jsonb_build_object('status', 'discarded');
end;
$$;

create or replace function private.discard_training_setup_bundle(target_bundle_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  org_id uuid := private.current_organisation_id();
  bundle_row public.training_setup_bundles%rowtype;
  item_row public.training_setup_bundle_items%rowtype;
  removed jsonb := '[]'::jsonb;
begin
  if org_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  perform private.assert_current_organisation_module_entitled('training');

  select bundle.* into bundle_row from public.training_setup_bundles bundle
  where bundle.organisation_id = org_id and bundle.id = target_bundle_id for update;
  if not found then
    raise exception 'training setup bundle was not found' using errcode = 'P0002';
  end if;
  if bundle_row.status = 'published' then
    raise exception 'published setup bundles are kept' using errcode = '22023';
  end if;

  delete from public.training_requirements requirement_row
  where requirement_row.organisation_id = org_id
    and requirement_row.id in (
      select bundle_item_row.record_id
      from public.training_setup_bundle_items bundle_item_row
      where bundle_item_row.organisation_id = org_id
        and bundle_item_row.bundle_id = bundle_row.id
        and bundle_item_row.record_kind = 'requirement'
        and bundle_item_row.ownership = 'created'
    );

  for item_row in
    select item.* from public.training_setup_bundle_items item
    where item.organisation_id = org_id and item.bundle_id = bundle_row.id
      and item.record_kind in ('course', 'course_version', 'curriculum')
  loop
    removed := removed || jsonb_build_array(jsonb_build_object('kind', item_row.record_kind, 'id', item_row.record_id, 'label', item_row.label));
  end loop;

  update public.training_setup_bundles
  set status = 'discarded', discarded_at = statement_timestamp()
  where organisation_id = org_id and id = bundle_row.id;

  return jsonb_build_object('bundle_id', bundle_row.id, 'status', 'discarded', 'removed', removed, 'retained', '[]'::jsonb);
end;
$$;

create or replace function private.fail_ai_run(
  target_ai_run_id uuid,
  target_error_category text,
  target_final_output text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  run_row public.ai_runs%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run failure recording is not authorised'
      using errcode = '42501';
  end if;


  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id),
    (select s.module_key from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id)
  );

  select run_table.*
  into run_row
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id
  for update;

  if not found then
    raise exception 'ai run not found'
      using errcode = 'P0002';
  end if;

  if run_row.requested_by_membership_id <> actor_membership_id then
    raise exception 'ai run failure recording is not authorised'
      using errcode = '42501';
  end if;

  if run_row.status <> 'running' then
    return;
  end if;

  perform private.ai_credit_release(target_ai_run_id);

  update public.ai_runs
  set status = case
        when target_error_category = 'timeout' then 'timed_out'
        when target_error_category = 'denied' then 'denied'
        else 'failed'
      end,
      error_category = btrim(target_error_category),
      final_output = target_final_output,
      completed_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_ai_run_id;

  perform private.append_business_audit(
    org_id,
    'ai.run.failed',
    target_ai_run_id,
    'succeeded',
    jsonb_build_object(
      'ai_run_id', target_ai_run_id,
      'error_category', target_error_category
    )
  );
end;
$$;

create or replace function private.finish_ai_run(
  target_ai_run_id uuid,
  target_assistant_content text,
  target_structured_payload jsonb,
  target_manifest_version text,
  target_manifest_json jsonb,
  target_manifest_hash text,
  target_provider_request_id text default null,
  target_tool_calls jsonb default '[]'::jsonb,
  target_source_references jsonb default '[]'::jsonb,
  target_proposals jsonb default '[]'::jsonb,
  target_input_tokens integer default 0,
  target_output_tokens integer default 0,
  target_cached_input_tokens integer default 0,
  target_reasoning_tokens integer default 0,
  target_tool_call_count integer default 0,
  target_duration_ms integer default 0
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
  run_row public.ai_runs%rowtype;
  session_row public.ai_sessions%rowtype;
  assistant_message_id uuid;
  tool_item jsonb;
  source_item jsonb;
  proposal_item jsonb;
  new_proposal_id uuid;
  proposal_semantic_stage_key text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run completion is not authorised'
      using errcode = '42501';
  end if;


  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id),
    (select s.module_key from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id)
  );

  select run_table.*
  into run_row
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id
  for update;

  if not found then
    raise exception 'ai run not found'
      using errcode = 'P0002';
  end if;

  if run_row.requested_by_membership_id <> actor_membership_id then
    raise exception 'ai run completion is not authorised'
      using errcode = '42501';
  end if;

  if run_row.status <> 'running' then
    raise exception 'ai run is not running'
      using errcode = '55000';
  end if;

  select session_table.*
  into session_row
  from public.ai_sessions session_table
  where session_table.organisation_id = org_id
    and session_table.id = run_row.ai_session_id;

  update public.ai_runs
  set status = 'completed',
      provider_request_id = target_provider_request_id,
      completed_at = statement_timestamp(),
      final_output = btrim(target_assistant_content),
      input_token_count = target_input_tokens,
      output_token_count = target_output_tokens,
      cached_input_token_count = target_cached_input_tokens,
      reasoning_token_count = target_reasoning_tokens,
      tool_call_count = target_tool_call_count
  where organisation_id = org_id
    and id = target_ai_run_id;

  insert into public.ai_messages (
    organisation_id,
    ai_session_id,
    role,
    content,
    ai_run_id,
    structured_payload
  )
  values (
    org_id,
    run_row.ai_session_id,
    'assistant',
    btrim(target_assistant_content),
    target_ai_run_id,
    target_structured_payload
  )
  returning id into assistant_message_id;

  insert into public.ai_run_context_manifest (
    ai_run_id,
    organisation_id,
    manifest_version,
    manifest_json,
    manifest_hash
  )
  values (
    target_ai_run_id,
    org_id,
    btrim(target_manifest_version),
    target_manifest_json,
    btrim(target_manifest_hash)
  );

  proposal_semantic_stage_key :=
    nullif(btrim(coalesce(target_manifest_json ->> 'stage_key', '')), '');

  for tool_item in
    select value
    from jsonb_array_elements(coalesce(target_tool_calls, '[]'::jsonb))
  loop
    insert into public.ai_tool_calls (
      organisation_id,
      ai_run_id,
      sequence_number,
      tool_name,
      arguments_json,
      arguments_hash,
      status,
      result_metadata_json,
      denial_reason,
      duration_ms
    )
    values (
      org_id,
      target_ai_run_id,
      (tool_item ->> 'sequence_number')::integer,
      tool_item ->> 'tool_name',
      tool_item -> 'arguments_json',
      tool_item ->> 'arguments_hash',
      tool_item ->> 'status',
      tool_item -> 'result_metadata_json',
      tool_item ->> 'denial_reason',
      coalesce((tool_item ->> 'duration_ms')::integer, 0)
    );
  end loop;

  for source_item in
    select value
    from jsonb_array_elements(coalesce(target_source_references, '[]'::jsonb))
  loop
    insert into public.ai_source_references (
      organisation_id,
      ai_run_id,
      ai_message_id,
      problem_solving_case_id,
      current_condition_item_id,
      containment_id,
      hypothesis_id,
      hypothesis_test_id,
      countermeasure_id,
      effectiveness_check_id,
      sustainment_item_id,
      problem_solving_session_id,
      action_id,
      lesson_learned_id
    )
    values (
      org_id,
      target_ai_run_id,
      assistant_message_id,
      (source_item ->> 'problem_solving_case_id')::uuid,
      (source_item ->> 'current_condition_item_id')::uuid,
      (source_item ->> 'containment_id')::uuid,
      (source_item ->> 'hypothesis_id')::uuid,
      (source_item ->> 'hypothesis_test_id')::uuid,
      (source_item ->> 'countermeasure_id')::uuid,
      (source_item ->> 'effectiveness_check_id')::uuid,
      (source_item ->> 'sustainment_item_id')::uuid,
      (source_item ->> 'problem_solving_session_id')::uuid,
      (source_item ->> 'action_id')::uuid,
      (source_item ->> 'lesson_learned_id')::uuid
    );
  end loop;

  for proposal_item in
    select value
    from jsonb_array_elements(coalesce(target_proposals, '[]'::jsonb))
  loop
  if proposal_item ->> 'proposal_type' in (
    'verify_root_cause',
    'close_case',
    'approve_benefit',
    'validate_saving',
    'assign_rbac'
  ) then
    raise exception 'forbidden ai proposal type'
      using errcode = '22023';
  end if;

    new_proposal_id := private.register_resource_record(
      org_id,
      'ai_proposal',
      gen_random_uuid(),
      actor_membership_id
    );

    insert into public.ai_proposals (
      id,
      organisation_id,
      ai_session_id,
      ai_run_id,
      ai_message_id,
      proposal_type,
      payload_json,
      human_explanation,
      display_permission_key,
      problem_solving_case_id,
      semantic_stage_key
    )
    values (
      new_proposal_id,
      org_id,
      run_row.ai_session_id,
      target_ai_run_id,
      assistant_message_id,
      proposal_item ->> 'proposal_type',
      proposal_item -> 'payload_json',
      proposal_item ->> 'human_explanation',
      proposal_item ->> 'display_permission_key',
      session_row.problem_solving_case_id,
      proposal_semantic_stage_key
    );
  end loop;

  insert into public.ai_usage_events (
    organisation_id,
    membership_id,
    ai_session_id,
    ai_run_id,
    provider,
    model,
    input_tokens,
    cached_input_tokens,
    output_tokens,
    reasoning_tokens,
    tool_call_count,
    duration_ms
  )
  values (
    org_id,
    actor_membership_id,
    run_row.ai_session_id,
    target_ai_run_id,
    run_row.provider,
    run_row.model,
    target_input_tokens,
    target_cached_input_tokens,
    target_output_tokens,
    target_reasoning_tokens,
    target_tool_call_count,
    target_duration_ms
  );

  perform private.append_business_audit(
    org_id,
    'ai.run.completed',
    target_ai_run_id,
    'succeeded',
    jsonb_build_object(
      'ai_run_id', target_ai_run_id,
      'assistant_message_id', assistant_message_id
    )
  );

  perform private.ai_credit_settle(
    target_ai_run_id,
    greatest(
      1::bigint,
      (coalesce(target_input_tokens, 0) + coalesce(target_output_tokens, 0))::bigint
    )
  );

  return assistant_message_id;
end;
$$;

create or replace function private.hold_project(
  target_project_id uuid,
  target_reason text default null
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
    raise exception 'project hold is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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

  if project_row.status <> 'active' then
    raise exception 'project is not holdable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project hold is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'on_hold',
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'active',
    'on_hold',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.held',
    target_project_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectHeld',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.link_benefit_evidence(
  target_benefit_id uuid,
  target_attachment_id uuid
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
    or not private.can_link_benefit_evidence(org_id, target_benefit_id) then
    raise exception 'benefit evidence link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  insert into public.benefit_evidence_links (
    organisation_id,
    benefit_id,
    attachment_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_benefit_id,
    target_attachment_id,
    actor_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
end;
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

  perform private.assert_current_organisation_module_entitled('projects');

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

create or replace function private.link_countermeasure_causes(
  target_countermeasure_id uuid,
  target_hypothesis_ids uuid[]
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  cm_row public.problem_solving_countermeasures%rowtype;
  inserted_count integer := 0;
  current_hypothesis_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'countermeasure cause linking is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select cm.*
  into cm_row
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.id = target_countermeasure_id;

  if not found then
    raise exception 'countermeasure not found'
      using errcode = 'P0002';
  end if;

  if not private.can_contribute_problem_solving_case(org_id, cm_row.problem_solving_case_id) then
    raise exception 'countermeasure cause linking is not authorised'
      using errcode = '42501';
  end if;

  foreach current_hypothesis_id in array target_hypothesis_ids
  loop
    if not exists (
      select 1
      from public.problem_solving_hypotheses h
      where h.organisation_id = org_id
        and h.id = current_hypothesis_id
        and h.problem_solving_case_id = cm_row.problem_solving_case_id
    ) then
      raise exception 'hypothesis does not belong to the same case'
        using errcode = '22023';
    end if;

    insert into public.problem_solving_countermeasure_cause_links (
      organisation_id,
      countermeasure_id,
      hypothesis_id,
      created_by_membership_id
    )
    values (
      org_id,
      target_countermeasure_id,
      current_hypothesis_id,
      actor_membership_id
    )
    on conflict (organisation_id, countermeasure_id, hypothesis_id) do nothing;

    if found then
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return inserted_count;
end;
$$;

create or replace function private.link_node_hypothesis(
  target_node_id uuid,
  target_hypothesis_id uuid
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
  node_row public.problem_solving_analysis_nodes%rowtype;
  analysis_case_id uuid;
  hypothesis_case_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'node-hypothesis linking is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  select a.problem_solving_case_id
  into analysis_case_id
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'node-hypothesis linking is not authorised'
      using errcode = '42501';
  end if;

  select h.problem_solving_case_id
  into hypothesis_case_id
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  if hypothesis_case_id is null then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if analysis_case_id <> hypothesis_case_id then
    raise exception 'analysis node and hypothesis must belong to the same case'
      using errcode = '22023';
  end if;

  update public.problem_solving_analysis_nodes n
  set linked_hypothesis_id = target_hypothesis_id,
      updated_at           = statement_timestamp()
  where n.organisation_id = org_id
    and n.id = target_node_id;

  return true;
end;
$$;

create or replace function private.link_problem_solving_evidence(
  target_case_id uuid,
  target_attachment_id uuid,
  target_current_condition_item_id uuid default null,
  target_containment_id uuid default null,
  target_hypothesis_id uuid default null,
  target_hypothesis_test_id uuid default null,
  target_countermeasure_id uuid default null,
  target_effectiveness_check_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_session_id uuid default null,
  target_session_entry_id uuid default null,
  target_is_case_level boolean default false,
  target_link_rationale text default null
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
  case_row public.problem_solving_cases%rowtype;
  subject_count integer;
  new_link_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'evidence link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'cannot link evidence to a closed or cancelled case'
      using errcode = '55000';
  end if;

  if not private.can_link_problem_solving_evidence(org_id, target_case_id) then
    raise exception 'evidence link is not authorised'
      using errcode = '42501';
  end if;

  subject_count :=
    (case when target_current_condition_item_id is not null then 1 else 0 end)
    + (case when target_containment_id is not null then 1 else 0 end)
    + (case when target_hypothesis_id is not null then 1 else 0 end)
    + (case when target_hypothesis_test_id is not null then 1 else 0 end)
    + (case when target_countermeasure_id is not null then 1 else 0 end)
    + (case when target_effectiveness_check_id is not null then 1 else 0 end)
    + (case when target_sustainment_item_id is not null then 1 else 0 end)
    + (case when target_session_id is not null then 1 else 0 end)
    + (case when target_session_entry_id is not null then 1 else 0 end)
    + (case when target_is_case_level then 1 else 0 end);

  if subject_count <> 1 then
    raise exception 'exactly one evidence subject must be specified'
      using errcode = '22023';
  end if;

  if target_current_condition_item_id is not null and not exists (
    select 1
    from public.problem_solving_current_condition_items item_row
    where item_row.organisation_id = org_id
      and item_row.id = target_current_condition_item_id
      and item_row.case_id = target_case_id
  ) then
    raise exception 'current condition item does not belong to this case'
      using errcode = '22023';
  end if;

  if target_containment_id is not null and not exists (
    select 1
    from public.problem_solving_containments containment_row
    where containment_row.organisation_id = org_id
      and containment_row.id = target_containment_id
      and containment_row.problem_solving_case_id = target_case_id
  ) then
    raise exception 'containment does not belong to this case'
      using errcode = '22023';
  end if;

  if target_hypothesis_id is not null and not exists (
    select 1
    from public.problem_solving_hypotheses hypothesis_row
    where hypothesis_row.organisation_id = org_id
      and hypothesis_row.id = target_hypothesis_id
      and hypothesis_row.problem_solving_case_id = target_case_id
  ) then
    raise exception 'hypothesis does not belong to this case'
      using errcode = '22023';
  end if;

  if target_hypothesis_test_id is not null and not exists (
    select 1
    from public.problem_solving_hypothesis_tests test_row
    join public.problem_solving_hypotheses hypothesis_row
      on hypothesis_row.organisation_id = test_row.organisation_id
     and hypothesis_row.id = test_row.hypothesis_id
    where test_row.organisation_id = org_id
      and test_row.id = target_hypothesis_test_id
      and hypothesis_row.problem_solving_case_id = target_case_id
  ) then
    raise exception 'hypothesis test does not belong to this case'
      using errcode = '22023';
  end if;

  if target_countermeasure_id is not null and not exists (
    select 1
    from public.problem_solving_countermeasures countermeasure_row
    where countermeasure_row.organisation_id = org_id
      and countermeasure_row.id = target_countermeasure_id
      and countermeasure_row.problem_solving_case_id = target_case_id
  ) then
    raise exception 'countermeasure does not belong to this case'
      using errcode = '22023';
  end if;

  if target_effectiveness_check_id is not null and not exists (
    select 1
    from public.problem_solving_effectiveness_checks effectiveness_row
    where effectiveness_row.organisation_id = org_id
      and effectiveness_row.id = target_effectiveness_check_id
      and effectiveness_row.case_id = target_case_id
  ) then
    raise exception 'effectiveness check does not belong to this case'
      using errcode = '22023';
  end if;

  if target_sustainment_item_id is not null and not exists (
    select 1
    from public.problem_solving_sustainment_items sustainment_row
    where sustainment_row.organisation_id = org_id
      and sustainment_row.id = target_sustainment_item_id
      and sustainment_row.case_id = target_case_id
  ) then
    raise exception 'sustainment item does not belong to this case'
      using errcode = '22023';
  end if;

  if target_session_id is not null and not exists (
    select 1
    from public.problem_solving_sessions session_row
    where session_row.organisation_id = org_id
      and session_row.id = target_session_id
      and session_row.case_id = target_case_id
  ) then
    raise exception 'session does not belong to this case'
      using errcode = '22023';
  end if;

  if target_session_entry_id is not null and not exists (
    select 1
    from public.problem_solving_session_entries entry_row
    join public.problem_solving_sessions session_row
      on session_row.organisation_id = entry_row.organisation_id
     and session_row.id = entry_row.session_id
    where entry_row.organisation_id = org_id
      and entry_row.id = target_session_entry_id
      and session_row.case_id = target_case_id
  ) then
    raise exception 'session entry does not belong to this case'
      using errcode = '22023';
  end if;

  if not private.attachment_is_active_in_organisation(
    case_row.organisation_id,
    target_attachment_id
  ) then
    raise exception 'attachment not found or not active'
      using errcode = 'P0002';
  end if;

  insert into public.problem_solving_evidence_links (
    organisation_id,
    problem_solving_case_id,
    attachment_id,
    current_condition_item_id,
    containment_id,
    hypothesis_id,
    hypothesis_test_id,
    countermeasure_id,
    effectiveness_check_id,
    sustainment_item_id,
    session_id,
    session_entry_id,
    is_case_level,
    link_rationale,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_attachment_id,
    target_current_condition_item_id,
    target_containment_id,
    target_hypothesis_id,
    target_hypothesis_test_id,
    target_countermeasure_id,
    target_effectiveness_check_id,
    target_sustainment_item_id,
    target_session_id,
    target_session_entry_id,
    target_is_case_level,
    nullif(btrim(target_link_rationale), ''),
    actor_membership_id
  )
  returning id into new_link_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.evidence_linked',
    target_case_id,
    'succeeded',
    jsonb_build_object('evidence_link_id', new_link_id)
  );

  return new_link_id;
end;
$$;

create or replace function private.mark_benefit_realised(
  target_benefit_id uuid,
  target_reason text default null
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
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation completion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'realising' then
    raise exception 'benefit cannot be marked realised'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit realisation completion is not authorised'
      using errcode = '42501';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'realised',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    'realising',
    'realised',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'benefit.realised',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitRealised',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

create or replace function public.mark_workforce_import_credentials_exported(
  target_import_job_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  job_row public.workforce_import_jobs%rowtype;
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id;

  if job_row.credential_export_session_id is null then
    raise exception 'credential export acknowledgement requires an active session'
      using errcode = '55000';
  end if;

  perform public.ack_workforce_import_credentials_exported(
    target_import_job_id,
    job_row.credential_export_session_id
  );
end;
$$;

create or replace function private.move_problem_solving_stage(
  target_case_id uuid,
  target_stage_id uuid
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
  case_row public.problem_solving_cases%rowtype;
  stage_belongs boolean;
  previous_stage_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'stage movement is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'active' then
    raise exception 'stage movement requires an active case'
      using errcode = '55000';
  end if;

  if case_row.method_version_id is null then
    raise exception 'case has no pinned method version'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'stage movement is not authorised'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.problem_solving_method_stages stage
    where stage.organisation_id = org_id
      and stage.id = target_stage_id
      and stage.method_version_id = case_row.method_version_id
  )
  into stage_belongs;

  if not stage_belongs then
    raise exception 'target stage does not belong to the pinned method version'
      using errcode = '22023';
  end if;

  previous_stage_id := case_row.current_method_stage_id;

  update public.problem_solving_cases ps_case
  set current_method_stage_id = target_stage_id,
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_stage_history (
    organisation_id,
    case_id,
    from_stage_id,
    to_stage_id,
    changed_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    previous_stage_id,
    target_stage_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.stage_moved',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'from_stage_id', previous_stage_id,
      'to_stage_id', target_stage_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingStageMoved',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'from_stage_id', previous_stage_id,
      'to_stage_id', target_stage_id
    )
  );

  return true;
end;
$$;

create or replace function public.preauthorize_workforce_credential_reset(
  target_membership_id uuid
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
  alias_row private.workforce_aliases%rowtype;
  auth_email text;
  grant_row public.access_grants%rowtype;
  new_intent_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'workforce credential reset is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_credential_reset_authorised(
    org_id,
    actor_membership_id,
    target_membership_id
  );

  select membership_registry.*
  into membership_row
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = org_id
    and membership_registry.id = target_membership_id;

  select workforce_alias.*
  into alias_row
  from private.workforce_aliases workforce_alias
  where workforce_alias.organisation_id = org_id
    and workforce_alias.membership_id = target_membership_id
    and workforce_alias.alias_type = 'username'
    and workforce_alias.status = 'active';

  select auth_user.email
  into auth_email
  from auth.users auth_user
  where auth_user.id = membership_row.user_id;

  if auth_email is null then
    raise exception 'workforce auth identity is unavailable'
      using errcode = '55000';
  end if;

  select grant_source.*
  into grant_row
  from public.access_grants grant_source
  where grant_source.organisation_id = org_id
    and grant_source.grantee_membership_id = target_membership_id
    and grant_source.status = 'active'
  order by grant_source.granted_at
  limit 1;

  if grant_row.role_version_id is null then
    raise exception 'workforce membership has no active access grant'
      using errcode = '55000';
  end if;

  insert into public.workforce_provision_intents (
    organisation_id,
    actor_membership_id,
    intent_kind,
    status,
    target_display_name,
    target_canonical_alias,
    target_alias_type,
    target_membership_id,
    sealed_internal_login_identifier,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    expires_at
  )
  values (
    org_id,
    actor_membership_id,
    'credential_reset',
    'pending',
    coalesce(membership_row.display_name, alias_row.canonical_alias),
    alias_row.canonical_alias,
    'username',
    target_membership_id,
    lower(auth_email),
    grant_row.role_version_id,
    grant_row.scope_type,
    grant_row.scope_unit_id,
    statement_timestamp() + interval '15 minutes'
  )
  returning id into new_intent_id;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    org_id,
    'workforce.credentials_reset_preauthorized',
    'workforce_provision_intent',
    new_intent_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'membership_id', target_membership_id,
      'canonical_alias', alias_row.canonical_alias
    )
  );

  return new_intent_id;
end;
$$;

create or replace function private.preauthorize_workforce_provision(
  target_display_name text,
  target_canonical_alias text,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null,
  target_alias_type text default 'username',
  target_job_title text default null,
  target_notification_email text default null,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_idempotency_key text default null
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
  canonical_alias text := lower(btrim(target_canonical_alias));
  canonical_email text;
  existing_intent_id uuid;
  new_intent_id uuid;
  sealed_login text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'workforce provisioning is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisations organisation
    where organisation.id = org_id
      and organisation.status = 'active'
  ) then
    raise exception 'organisation is not active'
      using errcode = '42501';
  end if;

  if target_idempotency_key is not null then
    select intent_row.id
    into existing_intent_id
    from public.workforce_provision_intents intent_row
    where intent_row.organisation_id = org_id
      and intent_row.idempotency_key = target_idempotency_key
      and intent_row.status in ('pending', 'auth_created', 'completed')
    limit 1;

    if existing_intent_id is not null then
      return existing_intent_id;
    end if;
  end if;

  perform private.assert_workforce_provision_delegation(
    org_id,
    actor_membership_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id
  );

  if not private.workforce_alias_is_available(org_id, canonical_alias) then
    raise exception 'workforce alias is unavailable'
      using errcode = '23505';
  end if;

  if target_job_function_id is not null then
    if not exists (
      select 1
      from public.job_functions job_function_row
      where job_function_row.organisation_id = org_id
        and job_function_row.id = target_job_function_id
        and job_function_row.status = 'active'
    ) then
      raise exception 'job function is invalid'
        using errcode = '23503';
    end if;

    if target_organisational_unit_id is not null
      and not private.membership_has_scoped_permission(
        actor_membership_id,
        org_id,
        'hierarchy.read',
        null,
        target_organisational_unit_id
      ) then
      raise exception 'organisational unit is not accessible'
        using errcode = '42501';
    end if;

    perform private.assert_membership_placement_site_containment(
      org_id,
      actor_membership_id,
      target_organisational_unit_id
    );

    if not private.membership_has_scoped_permission(
      actor_membership_id,
      org_id,
      'job_functions.manage',
      null,
      coalesce(target_organisational_unit_id, null)
    ) then
      raise exception 'job function assignment is not authorised'
        using errcode = '42501';
    end if;
  elsif target_organisational_unit_id is not null then
    raise exception 'job function is required when assigning a primary unit'
      using errcode = '23514';
  end if;

  canonical_email := case
    when target_notification_email is null then null
    else lower(btrim(target_notification_email))
  end;

  sealed_login := private.generate_workforce_internal_login_identifier();

  insert into public.workforce_provision_intents (
    organisation_id,
    actor_membership_id,
    intent_kind,
    status,
    target_display_name,
    target_canonical_alias,
    target_alias_type,
    target_job_title,
    target_notification_email,
    sealed_internal_login_identifier,
    target_job_function_id,
    target_organisational_unit_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    expires_at,
    idempotency_key
  )
  values (
    org_id,
    actor_membership_id,
    'manual_create',
    'pending',
    btrim(target_display_name),
    canonical_alias,
    target_alias_type,
    case when target_job_title is null then null else btrim(target_job_title) end,
    canonical_email,
    sealed_login,
    target_job_function_id,
    target_organisational_unit_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    statement_timestamp() + interval '15 minutes',
    target_idempotency_key
  )
  returning id into new_intent_id;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    org_id,
    'workforce.provision_preauthorized',
    'workforce_provision_intent',
    new_intent_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'intent_kind', 'manual_create',
      'canonical_alias', canonical_alias
    )
  );

  return new_intent_id;
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

  perform private.assert_current_organisation_module_entitled('projects');

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

create or replace function private.publish_problem_solving_method_version(
  target_method_version_id uuid
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
  version_row public.problem_solving_method_versions%rowtype;
  stage_count integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_methods(org_id) then
    raise exception 'method publish is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select version_table.*
  into version_row
  from public.problem_solving_method_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_method_version_id
  for update;

  if not found or version_row.status <> 'draft' then
    raise exception 'method version is not publishable'
      using errcode = '55000';
  end if;

  select count(*)
  into stage_count
  from public.problem_solving_method_stages stage_table
  where stage_table.organisation_id = org_id
    and stage_table.method_version_id = target_method_version_id;

  if stage_count = 0 then
    raise exception 'method version requires at least one stage'
      using errcode = '22023';
  end if;

  update public.problem_solving_method_versions prior_version
  set status = 'archived',
      archived_at = statement_timestamp()
  where prior_version.organisation_id = org_id
    and prior_version.method_id = version_row.method_id
    and prior_version.status = 'published';

  update public.problem_solving_method_versions version_table
  set status = 'published',
      published_at = statement_timestamp(),
      published_by_membership_id = actor_membership_id
  where version_table.organisation_id = org_id
    and version_table.id = target_method_version_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving_method.published',
    version_row.method_id,
    'succeeded',
    jsonb_build_object('method_version_id', target_method_version_id)
  );

  return true;
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

  perform private.assert_current_organisation_module_entitled('skills');

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

  perform private.assert_current_organisation_module_entitled('skills');

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

create or replace function private.publish_skill_setup_bundle(
  target_bundle_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  bundle_row public.skill_setup_bundles%rowtype;
  scale_status text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('skills');

  select bundle.*
  into bundle_row
  from public.skill_setup_bundles bundle
  where bundle.organisation_id = org_id
    and bundle.id = target_bundle_id
  for update;

  if not found then
    raise exception 'skill setup bundle was not found'
      using errcode = 'P0002';
  end if;

  if bundle_row.status = 'published' then
    return true;
  end if;

  if bundle_row.status = 'discarded' then
    raise exception 'discarded setup bundles cannot be published'
      using errcode = '22023';
  end if;

  update public.skills skill_row
  set status = 'active', updated_at = statement_timestamp()
  where skill_row.organisation_id = org_id
    and skill_row.status = 'draft'
    and skill_row.id in (
      select item_row.record_id
      from public.skill_setup_bundle_items item_row
      where item_row.organisation_id = org_id
        and item_row.bundle_id = bundle_row.id
        and item_row.record_kind = 'skill'
    );

  select version_row.status
  into scale_status
  from public.skill_proficiency_scale_versions version_row
  where version_row.organisation_id = org_id
    and version_row.id = bundle_row.scale_version_id;

  if scale_status = 'draft' then
    perform private.publish_skill_proficiency_scale_version(bundle_row.scale_version_id);
  end if;

  perform private.publish_skill_capability_set_version(
    bundle_row.capability_set_version_id
  );

  update public.skill_setup_bundles bundle
  set status = 'published', published_at = statement_timestamp()
  where bundle.organisation_id = org_id
    and bundle.id = bundle_row.id;

  return true;
end;
$$;

create or replace function private.publish_training_course_version(
  target_course_version_id uuid
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
  version_row public.training_course_versions%rowtype;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_catalog(org_id) then
    raise exception 'training course publish is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  select version_registry.*
  into version_row
  from public.training_course_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_course_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft course version not found'
      using errcode = 'P0002';
  end if;

  update public.training_course_versions published_row
  set
    status = 'archived',
    archived_at = statement_timestamp()
  where published_row.organisation_id = org_id
    and published_row.course_id = version_row.course_id
    and published_row.status = 'published';

  update public.training_course_versions version_registry
  set
    status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = actor_membership_id
  where version_registry.organisation_id = org_id
    and version_registry.id = target_course_version_id;

  perform private.enqueue_domain_event(
    org_id,
    version_row.course_id,
    'TrainingCoursePublished',
    target_course_version_id::text,
    jsonb_build_object('course_version_id', target_course_version_id)
  );

  return true;
end;
$$;

create or replace function private.publish_training_curriculum_version(
  target_curriculum_version_id uuid
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
  version_row public.training_curriculum_versions%rowtype;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training curriculum publish is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

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

  update public.training_curriculum_versions published_row
  set
    status = 'archived',
    archived_at = statement_timestamp()
  where published_row.organisation_id = org_id
    and published_row.curriculum_id = version_row.curriculum_id
    and published_row.status = 'published';

  update public.training_curriculum_versions version_registry
  set
    status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = actor_membership_id
  where version_registry.organisation_id = org_id
    and version_registry.id = target_curriculum_version_id;

  return true;
end;
$$;

create or replace function private.publish_training_setup_bundle(target_bundle_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  org_id uuid := private.current_organisation_id();
  bundle_row public.training_setup_bundles%rowtype;
  version_id uuid;
begin
  if org_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  perform private.assert_current_organisation_module_entitled('training');

  select bundle.* into bundle_row from public.training_setup_bundles bundle
  where bundle.organisation_id = org_id and bundle.id = target_bundle_id for update;
  if not found then
    raise exception 'training setup bundle was not found' using errcode = 'P0002';
  end if;
  if bundle_row.status = 'published' then return true; end if;
  if bundle_row.status = 'discarded' then
    raise exception 'discarded setup bundles cannot be published' using errcode = '22023';
  end if;

  for version_id in
    select item_row.record_id
    from public.training_setup_bundle_items item_row
    where item_row.organisation_id = org_id and item_row.bundle_id = bundle_row.id
      and item_row.record_kind = 'course_version'
  loop
    perform private.publish_training_course_version(version_id);
  end loop;

  if bundle_row.curriculum_version_id is not null then
    perform private.publish_training_curriculum_version(bundle_row.curriculum_version_id);
  end if;

  update public.training_setup_bundles
  set status = 'published', published_at = statement_timestamp()
  where organisation_id = org_id and id = bundle_row.id;
  return true;
end;
$$;

create or replace function private.record_ai_proposal_accepted(
  target_ai_proposal_id uuid,
  target_current_condition_item_id uuid default null,
  target_containment_id uuid default null,
  target_hypothesis_id uuid default null,
  target_hypothesis_test_id uuid default null,
  target_countermeasure_id uuid default null,
  target_effectiveness_check_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_problem_solving_session_id uuid default null,
  target_session_entry_id uuid default null,
  target_action_id uuid default null,
  target_lesson_learned_id uuid default null,
  target_problem_solving_case_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  proposal_row public.ai_proposals%rowtype;
  outcome_count int;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai proposal acceptance recording is not authorised'
      using errcode = '42501';
  end if;


  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_proposals p
       join public.ai_runs r on r.id = p.run_id
       join public.ai_sessions s on s.id = r.ai_session_id
     where p.organisation_id = org_id and p.id = target_proposal_id),
    (select s.module_key from public.ai_proposals p
       join public.ai_runs r on r.id = p.run_id
       join public.ai_sessions s on s.id = r.ai_session_id
     where p.organisation_id = org_id and p.id = target_proposal_id)
  );

  select proposal_table.*
  into proposal_row
  from public.ai_proposals proposal_table
  where proposal_table.organisation_id = org_id
    and proposal_table.id = target_ai_proposal_id
  for update;

  if not found then
    raise exception 'ai proposal not found'
      using errcode = 'P0002';
  end if;

  if proposal_row.status <> 'pending' then
    raise exception 'ai proposal is not pending'
      using errcode = '55000';
  end if;

  if not private.can_read_ai_session(org_id, proposal_row.ai_session_id) then
    raise exception 'ai proposal acceptance recording is not authorised'
      using errcode = '42501';
  end if;

  outcome_count := num_nonnulls(
    target_current_condition_item_id,
    target_containment_id,
    target_hypothesis_id,
    target_hypothesis_test_id,
    target_countermeasure_id,
    target_effectiveness_check_id,
    target_sustainment_item_id,
    target_problem_solving_session_id,
    target_session_entry_id,
    target_action_id,
    target_lesson_learned_id,
    target_problem_solving_case_id
  );

  if outcome_count <> 1 then
    raise exception 'ai proposal acceptance requires exactly one outcome reference'
      using errcode = '23514';
  end if;

  if target_problem_solving_case_id is not null
     and target_problem_solving_case_id <> proposal_row.problem_solving_case_id then
    raise exception 'ai proposal outcome case mismatch'
      using errcode = '23514';
  end if;

  update public.ai_proposals
  set status = 'accepted',
      resolved_at = statement_timestamp(),
      resolved_by_membership_id = actor_membership_id
  where organisation_id = org_id
    and id = target_ai_proposal_id;

  insert into public.ai_acceptance_provenance (
    organisation_id,
    ai_proposal_id,
    accepted_by_membership_id,
    ai_run_id,
    current_condition_item_id,
    containment_id,
    hypothesis_id,
    hypothesis_test_id,
    countermeasure_id,
    effectiveness_check_id,
    sustainment_item_id,
    problem_solving_session_id,
    session_entry_id,
    action_id,
    lesson_learned_id,
    problem_solving_case_id
  )
  values (
    org_id,
    target_ai_proposal_id,
    actor_membership_id,
    proposal_row.ai_run_id,
    target_current_condition_item_id,
    target_containment_id,
    target_hypothesis_id,
    target_hypothesis_test_id,
    target_countermeasure_id,
    target_effectiveness_check_id,
    target_sustainment_item_id,
    target_problem_solving_session_id,
    target_session_entry_id,
    target_action_id,
    target_lesson_learned_id,
    target_problem_solving_case_id
  );

  perform private.append_business_audit(
    org_id,
    'ai.proposal.accepted',
    target_ai_proposal_id,
    'succeeded',
    jsonb_build_object('ai_proposal_id', target_ai_proposal_id)
  );
end;
$$;

create or replace function private.record_ai_run_provider_dispatch(
  target_ai_run_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  run_row public.ai_runs%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run dispatch recording is not authorised'
      using errcode = '42501';
  end if;


  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id),
    (select s.module_key from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id)
  );

  select run_table.*
  into run_row
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.id = target_ai_run_id
  for update;

  if not found then
    raise exception 'ai run not found'
      using errcode = 'P0002';
  end if;

  if run_row.requested_by_membership_id <> actor_membership_id then
    raise exception 'ai run dispatch recording is not authorised'
      using errcode = '42501';
  end if;

  if run_row.status <> 'running' then
    return;
  end if;

  if run_row.provider_dispatched_at is not null then
    return;
  end if;

  update public.ai_runs
  set provider_dispatched_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_ai_run_id
    and status = 'running'
    and provider_dispatched_at is null;
end;
$$;

create or replace function private.record_benefit_validation(
  target_benefit_id uuid,
  target_validation_role text,
  target_decision text,
  target_rationale text
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
  benefit_row public.improvement_benefits%rowtype;
  assignment_row public.benefit_validation_assignments%rowtype;
  submission_snapshot_id uuid;
  forecast_version_id uuid;
  new_validation_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit validation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  if not private.current_organisation_plan_capability('module_benefits') then
    raise exception 'benefits module is not entitled on this plan'
      using errcode = '42501';
  end if;

  if target_validation_role not in ('ci', 'finance') then
    raise exception 'invalid validation role'
      using errcode = '22023';
  end if;

  if target_decision not in ('approve', 'reject', 'needs_more_information') then
    raise exception 'invalid validation decision'
      using errcode = '22023';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'submitted' then
    raise exception 'benefit is not awaiting validation'
      using errcode = '55000';
  end if;

  select assignment_table.*
  into assignment_row
  from public.benefit_validation_assignments assignment_table
  where assignment_table.organisation_id = org_id
    and assignment_table.benefit_id = target_benefit_id
    and assignment_table.validator_membership_id = actor_membership_id
    and assignment_table.validation_role = target_validation_role
    and assignment_table.status = 'active';

  if not found then
    raise exception 'active validation assignment was not found'
      using errcode = '42501';
  end if;

  if target_validation_role = 'ci' then
    if not private.can_validate_benefit_ci(org_id, benefit_row.organisational_unit_id) then
      raise exception 'CI validation is not authorised'
        using errcode = '42501';
    end if;
  elsif not private.can_validate_benefit_finance(org_id, benefit_row.organisational_unit_id) then
    raise exception 'finance validation is not authorised'
      using errcode = '42501';
  end if;

  select snapshot_table.id, snapshot_table.forecast_version_id
  into submission_snapshot_id, forecast_version_id
  from public.benefit_submission_snapshots snapshot_table
  where snapshot_table.organisation_id = org_id
    and snapshot_table.benefit_id = target_benefit_id
  order by snapshot_table.submitted_at desc, snapshot_table.id desc
  limit 1;

  if submission_snapshot_id is null then
    raise exception 'benefit submission snapshot was not found'
      using errcode = 'P0002';
  end if;

  perform private.assert_benefit_validation_separation_of_duties(
    benefit_row,
    submission_snapshot_id,
    target_validation_role,
    target_decision,
    actor_membership_id
  );

  insert into public.benefit_validations (
    organisation_id,
    benefit_id,
    submission_snapshot_id,
    forecast_version_id,
    validator_membership_id,
    validation_role,
    decision,
    rationale
  )
  values (
    org_id,
    target_benefit_id,
    submission_snapshot_id,
    forecast_version_id,
    actor_membership_id,
    target_validation_role,
    target_decision,
    btrim(target_rationale)
  )
  returning id into new_validation_id;

  if target_decision = 'needs_more_information' then
    null;
  elsif target_decision = 'reject' then
    update public.benefit_validation_assignments assignment_table
    set status = 'completed',
        completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.benefit_id = target_benefit_id
      and assignment_table.status = 'active';

    update public.improvement_benefits benefit_table
    set status = 'rejected',
        updated_at = statement_timestamp()
    where benefit_table.organisation_id = org_id
      and benefit_table.id = target_benefit_id;

    perform private.append_benefit_status_history(
      org_id,
      target_benefit_id,
      'submitted',
      'rejected',
      actor_membership_id,
      target_rationale
    );
  elsif target_decision = 'approve' then
    update public.benefit_validation_assignments assignment_table
    set status = 'completed',
        completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.benefit_id = target_benefit_id
      and assignment_table.validator_membership_id = actor_membership_id
      and assignment_table.validation_role = target_validation_role
      and assignment_table.status = 'active';

    if private.benefit_submission_has_required_approvals(
      org_id,
      target_benefit_id,
      submission_snapshot_id,
      benefit_row.benefit_class
    ) then
      perform private.approve_benefit_forecast(
        forecast_version_id,
        actor_membership_id
      );

      update public.improvement_benefits benefit_table
      set status = 'approved',
          updated_at = statement_timestamp()
      where benefit_table.organisation_id = org_id
        and benefit_table.id = target_benefit_id;

      perform private.append_benefit_status_history(
        org_id,
        target_benefit_id,
        'submitted',
        'approved',
        actor_membership_id,
        target_rationale
      );
    end if;
  end if;

  perform private.append_business_audit(
    org_id,
    'benefit.validation_recorded',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'decision', target_decision,
      'validation_role', target_validation_role,
      'validation_id', new_validation_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    case
      when target_decision = 'approve'
        and private.benefit_submission_has_required_approvals(
          org_id,
          target_benefit_id,
          submission_snapshot_id,
          benefit_row.benefit_class
        ) then 'BenefitApproved'
      when target_decision = 'reject' then 'BenefitRejected'
      else 'BenefitValidationRecorded'
    end,
    new_validation_id::text,
    jsonb_build_object(
      'decision', target_decision,
      'validation_role', target_validation_role
    )
  );

  return new_validation_id;
end;
$$;

create or replace function private.record_effectiveness_result(
  target_effectiveness_check_id uuid,
  target_result text,
  target_actual_numeric numeric default null,
  target_verification_rationale text default null
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
  check_row public.problem_solving_effectiveness_checks%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'effectiveness result recording is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_result not in ('pass', 'fail', 'inconclusive') then
    raise exception 'invalid effectiveness result'
      using errcode = '22023';
  end if;

  select eff.*
  into check_row
  from public.problem_solving_effectiveness_checks eff
  where eff.organisation_id = org_id
    and eff.id = target_effectiveness_check_id
  for update;

  if not found then
    raise exception 'effectiveness check not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(org_id, check_row.case_id) then
    raise exception 'effectiveness result recording is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_effectiveness_checks eff
  set result = target_result,
      actual_numeric = target_actual_numeric,
      verified_by_membership_id = actor_membership_id,
      verified_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where eff.organisation_id = org_id
    and eff.id = target_effectiveness_check_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.effectiveness_recorded',
    check_row.case_id,
    'succeeded',
    jsonb_build_object(
      'effectiveness_check_id', target_effectiveness_check_id,
      'result', target_result
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    check_row.case_id,
    'ProblemSolvingEffectivenessRecorded',
    target_effectiveness_check_id::text,
    jsonb_build_object(
      'case_id', check_row.case_id,
      'effectiveness_check_id', target_effectiveness_check_id,
      'result', target_result
    )
  );

  return true;
end;
$$;

create or replace function private.record_leanai_semantic_event(
  target_event_key text,
  target_event_version integer default 1,
  target_module_key text default null,
  target_intervention_key text default null,
  target_site_unit_id uuid default null,
  target_metadata jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default null
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
  occurred_at timestamptz := coalesce(target_occurred_at, statement_timestamp());
  recent_event_count integer;
  new_event_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'leanai semantic event recording is not authorised'
      using errcode = '42501';
  end if;

  if coalesce(target_module_key, '') not in ('onboarding') then
    perform private.assert_current_organisation_module_entitled('problem_solving');
  end if;

  perform private.leanai_validate_semantic_event_payload(
    target_event_key,
    target_event_version,
    target_module_key,
    target_intervention_key,
    coalesce(target_metadata, '{}'::jsonb)
  );

  if occurred_at > statement_timestamp() + interval '5 minutes' then
    raise exception 'leanai event occurred_at cannot be in the future'
      using errcode = '23514';
  end if;

  if target_site_unit_id is not null and not exists (
    select 1
    from public.organisation_units unit_row
    where unit_row.organisation_id = org_id
      and unit_row.id = target_site_unit_id
  ) then
    raise exception 'leanai event site is not in the current organisation'
      using errcode = '42501';
  end if;

  select count(*)
  into recent_event_count
  from public.leanai_semantic_events event_row
  where event_row.organisation_id = org_id
    and event_row.membership_id = actor_membership_id
    and event_row.created_at > statement_timestamp() - interval '5 minutes';

  if recent_event_count >= 60 then
    raise exception 'leanai semantic event rate limit exceeded'
      using errcode = '54000';
  end if;

  insert into public.leanai_semantic_events (
    organisation_id,
    membership_id,
    event_key,
    event_version,
    module_key,
    intervention_key,
    site_unit_id,
    metadata,
    occurred_at
  )
  values (
    org_id,
    actor_membership_id,
    target_event_key,
    target_event_version,
    target_module_key,
    target_intervention_key,
    target_site_unit_id,
    coalesce(target_metadata, '{}'::jsonb),
    occurred_at
  )
  returning id into new_event_id;

  perform private.leanai_upsert_journey_from_event(
    org_id,
    actor_membership_id,
    target_event_key,
    target_module_key,
    target_intervention_key,
    coalesce(target_metadata, '{}'::jsonb),
    occurred_at
  );

  return new_event_id;
end;
$$;

create or replace function private.record_metric_measurement(
  target_metric_id uuid,
  target_measured_value numeric,
  target_measured_at timestamptz default null,
  target_note text default null
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
  metric_row public.ci_project_metrics%rowtype;
  project_row public.ci_projects%rowtype;
  new_measurement_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'metric measurement is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  select metric_table.*
  into metric_row
  from public.ci_project_metrics metric_table
  where metric_table.organisation_id = org_id
    and metric_table.id = target_metric_id
  for update;

  if not found then
    raise exception 'metric not found'
      using errcode = 'P0002';
  end if;

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = metric_row.project_id;

  if project_row.status not in ('active', 'on_hold', 'completed') then
    raise exception 'metric measurements are not allowed for project status'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'metric measurement is not authorised'
      using errcode = '42501';
  end if;

  insert into public.ci_project_metric_measurements (
    organisation_id,
    metric_id,
    measured_value,
    measured_at,
    note,
    recorded_by_membership_id
  )
  values (
    org_id,
    target_metric_id,
    target_measured_value,
    coalesce(target_measured_at, statement_timestamp()),
    target_note,
    actor_membership_id
  )
  returning id into new_measurement_id;

  perform private.append_business_audit(
    org_id,
    'ci_project.metric_recorded',
    metric_row.project_id,
    'succeeded',
    jsonb_build_object('metric_id', target_metric_id, 'measurement_id', new_measurement_id)
  );

  return new_measurement_id;
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

  perform private.assert_current_organisation_module_entitled('skills');

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
  resolved_unit_id uuid := target_organisational_unit_id;
begin
  if resolved_unit_id is null then
    resolved_unit_id := private.membership_primary_organisational_unit_id(
      org_id,
      target_membership_id
    );
  end if;

  if org_id is null
    or actor_membership_id is null
    or not private.can_assess_skills(
      org_id,
      target_membership_id,
      resolved_unit_id
    ) then
    raise exception 'skill validation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('skills');

  return private.record_skill_assessment_internal(
    target_membership_id,
    target_skill_id,
    target_proficiency_scale_version_id,
    target_proficiency_level_id,
    'validated',
    true,
    target_assessed_at,
    actor_membership_id,
    resolved_unit_id,
    target_assessment_method,
    target_valid_until,
    target_notes,
    null
  );
end;
$$;

create or replace function private.record_training_completion(
  target_membership_id uuid,
  target_course_version_id uuid,
  target_completed_at timestamptz default statement_timestamp(),
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_completion_method text default null,
  target_session_id uuid default null,
  target_validity_days_override integer default null,
  target_external_certificate_reference text default null,
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
    or not private.can_manage_training_completions(org_id) then
    raise exception 'training completion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  return private.record_training_completion_internal(
    target_membership_id,
    target_course_version_id,
    target_completed_at,
    actor_membership_id,
    target_trainer_membership_id,
    target_trainer_name,
    target_completion_method,
    target_session_id,
    target_validity_days_override,
    target_external_certificate_reference,
    target_notes
  );
end;
$$;

create or replace function private.recover_stale_ai_runs_for_problem_solving_case(
  target_problem_solving_case_id uuid,
  target_stale_after_seconds integer default 65
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  stale_seconds integer := greatest(coalesce(target_stale_after_seconds, 65), 65);
  cutoff timestamptz;
  recovered integer := 0;
  run_row record;
  failure record;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai stale recovery is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if not private.can_read_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'problem solving case access required'
      using errcode = '42501';
  end if;

  cutoff := statement_timestamp() - make_interval(secs => stale_seconds);

  for run_row in
    select
      run_table.id,
      run_table.provider_dispatched_at,
      run_table.provider_request_id
    from public.ai_runs run_table
    inner join public.ai_sessions session_table
      on session_table.organisation_id = run_table.organisation_id
      and session_table.id = run_table.ai_session_id
    where run_table.organisation_id = org_id
      and session_table.problem_solving_case_id = target_problem_solving_case_id
      and run_table.status = 'running'
      and run_table.requested_by_membership_id = actor_membership_id
      and greatest(
        run_table.started_at,
        coalesce(run_table.execution_claimed_at, run_table.started_at),
        coalesce(run_table.provider_dispatched_at, run_table.started_at)
      ) <= cutoff
    order by run_table.started_at asc
    limit 20
    for update of run_table skip locked
  loop
    select *
    into failure
    from private.ai_run_abandoned_failure(
      run_row.provider_dispatched_at,
      run_row.provider_request_id
    );

    perform private.fail_ai_run(
      run_row.id,
      failure.failure_category,
      failure.failure_output
    );
    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;

create or replace function private.reject_ai_proposal(
  target_ai_proposal_id uuid,
  target_rejection_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  proposal_row public.ai_proposals%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai proposal rejection is not authorised'
      using errcode = '42501';
  end if;


  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_proposals p
       join public.ai_runs r on r.id = p.run_id
       join public.ai_sessions s on s.id = r.ai_session_id
     where p.organisation_id = org_id and p.id = target_proposal_id),
    (select s.module_key from public.ai_proposals p
       join public.ai_runs r on r.id = p.run_id
       join public.ai_sessions s on s.id = r.ai_session_id
     where p.organisation_id = org_id and p.id = target_proposal_id)
  );

  select proposal_table.*
  into proposal_row
  from public.ai_proposals proposal_table
  where proposal_table.organisation_id = org_id
    and proposal_table.id = target_ai_proposal_id
  for update;

  if not found then
    raise exception 'ai proposal not found'
      using errcode = 'P0002';
  end if;

  if proposal_row.status <> 'pending' then
    raise exception 'ai proposal is not pending'
      using errcode = '55000';
  end if;

  if not private.can_read_ai_session(org_id, proposal_row.ai_session_id) then
    raise exception 'ai proposal rejection is not authorised'
      using errcode = '42501';
  end if;

  update public.ai_proposals
  set status = 'rejected',
      resolved_at = statement_timestamp(),
      resolved_by_membership_id = actor_membership_id,
      rejection_reason = target_rejection_reason
  where organisation_id = org_id
    and id = target_ai_proposal_id;

  perform private.append_business_audit(
    org_id,
    'ai.proposal.rejected',
    target_ai_proposal_id,
    'succeeded',
    jsonb_build_object('ai_proposal_id', target_ai_proposal_id)
  );
end;
$$;

create or replace function private.reject_benefit_realisation_entry(
  target_entry_id uuid,
  target_reason text default null
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
  entry_row public.benefit_realisation_entries%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation rejection is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select entry_table.*
  into entry_row
  from public.benefit_realisation_entries entry_table
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id
  for update;

  if not found or entry_row.status <> 'submitted' then
    raise exception 'realisation entry is not rejectable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = entry_row.benefit_id;

  if not private.can_validate_benefit_realisation(
    org_id,
    benefit_row.organisational_unit_id
  )
  and entry_row.recorded_by_membership_id <> actor_membership_id
  and not private.can_manage_benefit_in_unit(
    org_id,
    benefit_row.organisational_unit_id
  ) then
    raise exception 'benefit realisation rejection is not authorised'
      using errcode = '42501';
  end if;

  update public.benefit_realisation_entries entry_table
  set status = 'rejected',
      notes = case
        when target_reason is null then entry_row.notes
        when entry_row.notes is null then btrim(target_reason)
        else entry_row.notes || E'\n' || btrim(target_reason)
      end
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id;

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.rejected',
    entry_row.benefit_id,
    'succeeded',
    jsonb_build_object('entry_id', target_entry_id, 'reason', target_reason)
  );

  return true;
end;
$$;

create or replace function private.reject_cause_hypothesis(
  target_hypothesis_id uuid,
  target_rejection_rationale text default null
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis rejection is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id
  for update;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if hypothesis_row.status in ('verified', 'rejected', 'superseded') then
    raise exception 'hypothesis is not in a rejectable state'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis rejection is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_hypotheses h
  set status                  = 'rejected',
      rejected_by_membership_id = actor_membership_id,
      rejected_at             = statement_timestamp(),
      rejection_rationale     = target_rejection_rationale,
      updated_at              = statement_timestamp()
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  perform private.append_hypothesis_status_history(
    org_id, target_hypothesis_id,
    hypothesis_row.status, 'rejected',
    actor_membership_id, target_rejection_rationale
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.rejected',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from_status', hypothesis_row.status,
      'rationale', target_rejection_rationale
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisRejected',
    target_hypothesis_id::text,
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

create or replace function private.reject_countermeasure(
  target_countermeasure_id uuid,
  target_rationale text default null
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
  cm_row public.problem_solving_countermeasures%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'countermeasure rejection is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select cm.*
  into cm_row
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.id = target_countermeasure_id
  for update;

  if not found then
    raise exception 'countermeasure not found'
      using errcode = 'P0002';
  end if;

  if cm_row.status <> 'proposed' then
    raise exception 'countermeasure is not in proposed status'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, cm_row.problem_solving_case_id) then
    raise exception 'countermeasure rejection is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_countermeasures cm_table
  set status = 'rejected',
      rejected_by_membership_id = actor_membership_id,
      rejected_at = statement_timestamp(),
      rejected_rationale = target_rationale,
      updated_at = statement_timestamp()
  where cm_table.organisation_id = org_id
    and cm_table.id = target_countermeasure_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.countermeasure_rejected',
    cm_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object('countermeasure_id', target_countermeasure_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    cm_row.problem_solving_case_id,
    'ProblemSolvingCountermeasureRejected',
    target_countermeasure_id::text,
    jsonb_build_object(
      'case_id', cm_row.problem_solving_case_id,
      'countermeasure_id', target_countermeasure_id
    )
  );

  return true;
end;
$$;

create or replace function private.release_containment(
  target_containment_id uuid,
  target_release_rationale text default null
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
  containment_row public.problem_solving_containments%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'containment release is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select c.*
  into containment_row
  from public.problem_solving_containments c
  where c.organisation_id = org_id
    and c.id = target_containment_id
  for update;

  if not found then
    raise exception 'containment not found'
      using errcode = 'P0002';
  end if;

  if containment_row.status = 'released' then
    raise exception 'containment is already released'
      using errcode = '55000';
  end if;

  if containment_row.status = 'proposed' then
    raise exception 'proposed containments cannot be released without activation'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    containment_row.problem_solving_case_id
  ) then
    raise exception 'containment release is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_containments c
  set status            = 'released',
      is_still_required = false,
      released_at       = statement_timestamp(),
      release_rationale = target_release_rationale,
      updated_at        = statement_timestamp()
  where c.organisation_id = org_id
    and c.id = target_containment_id;

  perform private.append_business_audit(
    org_id,
    'containment.released',
    containment_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'containment_id', target_containment_id,
      'release_rationale', target_release_rationale
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    containment_row.problem_solving_case_id,
    'ContainmentReleased',
    target_containment_id::text,
    jsonb_build_object(
      'containment_id', target_containment_id,
      'case_id', containment_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

create or replace function private.remove_benefit_from_overlap_group(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
  target_reason text default null
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
  group_row public.benefit_overlap_groups%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  active_allocation_row public.benefit_overlap_allocation_history%rowtype;
  superseded_count integer;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit overlap allocation removal is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select group_table.*
  into group_row
  from public.benefit_overlap_groups group_table
  where group_table.organisation_id = org_id
    and group_table.id = target_overlap_group_id
  for update;

  if not found then
    raise exception 'overlap group was not found'
      using errcode = 'P0002';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit overlap allocation removal is not authorised'
      using errcode = '42501';
  end if;

  select allocation_table.*
  into active_allocation_row
  from public.benefit_overlap_allocation_history allocation_table
  where allocation_table.organisation_id = org_id
    and allocation_table.overlap_group_id = target_overlap_group_id
    and allocation_table.benefit_id = target_benefit_id
    and allocation_table.superseded_at is null;

  if not found then
    raise exception 'active overlap allocation was not found'
      using errcode = 'P0002';
  end if;

  update public.benefit_overlap_allocation_history allocation_table
  set superseded_at = statement_timestamp()
  where allocation_table.organisation_id = org_id
    and allocation_table.id = active_allocation_row.id
    and allocation_table.superseded_at is null;

  get diagnostics superseded_count = row_count;

  if superseded_count = 0 then
    return false;
  end if;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_allocation.removed',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'overlap_group_id', target_overlap_group_id,
      'allocation_id', active_allocation_row.id,
      'reason', target_reason
    )
  );

  return true;
end;
$$;

create or replace function private.remove_benefit_source_link(
  target_benefit_id uuid,
  target_source_resource_id uuid
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
  benefit_row public.improvement_benefits%rowtype;
  deleted_count integer;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit source link removal is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found or benefit_row.status <> 'draft' then
    raise exception 'benefit source links are only mutable while draft'
      using errcode = '55000';
  end if;

  if not private.can_edit_benefit_draft(org_id, target_benefit_id) then
    raise exception 'benefit source link removal is not authorised'
      using errcode = '42501';
  end if;

  delete from public.benefit_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.benefit_id = target_benefit_id
    and link_row.source_resource_id = target_source_resource_id;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

create or replace function private.remove_problem_solving_source_link(
  target_link_id uuid
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
  link_row public.problem_solving_source_links%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'source link removal is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select link_table.*
  into link_row
  from public.problem_solving_source_links link_table
  where link_table.organisation_id = org_id
    and link_table.id = target_link_id
  for update;

  if not found then
    raise exception 'source link not found'
      using errcode = 'P0002';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or link_row.created_by_membership_id = actor_membership_id
  ) then
    raise exception 'source link removal is not authorised'
      using errcode = '42501';
  end if;

  delete from public.problem_solving_source_links
  where organisation_id = org_id
    and id = target_link_id;

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

  perform private.assert_current_organisation_module_entitled('training');

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

create or replace function private.remove_training_session_participant(
  target_session_id uuid,
  target_participant_id uuid
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
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'operation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  return private.update_training_session_participant_status(
    target_session_id,
    target_participant_id,
    'cancelled'
  );
end;
$$;

create or replace function private.replace_benefit_forecast_periods(
  target_forecast_version_id uuid,
  target_periods jsonb
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
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  period_row jsonb;
  period_start_value date;
  period_end_value date;
  forecast_amount_value numeric;
  display_order_value integer;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast period replacement is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  if target_periods is null
    or pg_catalog.jsonb_typeof(target_periods) <> 'array' then
    raise exception 'forecast periods must be a JSON array'
      using errcode = '22023';
  end if;

  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id
  for update;

  if not found or version_row.lifecycle <> 'draft' then
    raise exception 'forecast version is not editable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id
  for update;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast period replacement is not authorised'
      using errcode = '42501';
  end if;

  delete from public.benefit_forecast_periods period_table
  where period_table.organisation_id = org_id
    and period_table.forecast_version_id = target_forecast_version_id;

  for period_row in
    select value
    from jsonb_array_elements(target_periods)
  loop
    period_start_value := (period_row ->> 'period_start')::date;
    period_end_value := (period_row ->> 'period_end')::date;
    forecast_amount_value := (period_row ->> 'forecast_amount')::numeric;
    display_order_value := (period_row ->> 'display_order')::integer;

    if period_start_value is null
      or period_end_value is null
      or forecast_amount_value is null
      or display_order_value is null then
      raise exception 'forecast period payload is incomplete'
        using errcode = '22023';
    end if;

    insert into public.benefit_forecast_periods (
      organisation_id,
      forecast_version_id,
      period_start,
      period_end,
      forecast_amount,
      display_order
    )
    values (
      org_id,
      target_forecast_version_id,
      period_start_value,
      period_end_value,
      forecast_amount_value,
      display_order_value
    );
  end loop;

  return true;
end;
$$;

create or replace function private.resume_project(
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
    raise exception 'project resume is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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

  if project_row.status <> 'on_hold' then
    raise exception 'project is not resumable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project resume is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'active',
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'on_hold',
    'active',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.resumed',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectResumed',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function public.retry_workforce_import_failed_rows(
  target_import_job_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  reset_count integer := 0;
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  update public.workforce_import_rows import_row
  set status = 'valid',
      error_code = null,
      error_message = null,
      updated_at = statement_timestamp()
  where import_row.import_job_id = target_import_job_id
    and import_row.organisation_id = org_id
    and import_row.status = 'failed';

  get diagnostics reset_count = row_count;

  if reset_count > 0 then
    update public.workforce_import_jobs
    set status = 'provisioning',
        failed_rows = greatest(failed_rows - reset_count, 0),
        completed_at = null,
        updated_at = statement_timestamp()
    where id = target_import_job_id
      and organisation_id = org_id;
  end if;

  return reset_count;
end;
$$;

create or replace function private.return_benefit_to_draft(
  target_benefit_id uuid,
  target_reason text default null
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
  benefit_row public.improvement_benefits%rowtype;
  forecast_version_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit return to draft is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'submitted' then
    raise exception 'benefit cannot be returned to draft'
      using errcode = '55000';
  end if;

  if benefit_row.owner_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit return to draft is not authorised'
      using errcode = '42501';
  end if;

  update public.benefit_validation_assignments assignment_table
  set status = 'completed',
      completed_at = statement_timestamp()
  where assignment_table.organisation_id = org_id
    and assignment_table.benefit_id = target_benefit_id
    and assignment_table.status = 'active';

  forecast_version_id := benefit_row.current_forecast_version_id;

  if forecast_version_id is not null then
    update public.benefit_forecast_versions version_table
    set lifecycle = 'draft',
        submitted_at = null
    where version_table.organisation_id = org_id
      and version_table.id = forecast_version_id
      and version_table.lifecycle = 'submitted';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'draft',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    'submitted',
    'draft',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'benefit.returned_to_draft',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitReturnedToDraft',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

create or replace function private.return_project_to_draft(
  target_project_id uuid,
  target_reason text default null
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
    raise exception 'project return to draft is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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

  if project_row.status not in ('submitted', 'approved') then
    raise exception 'project cannot be returned to draft'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project return to draft is not authorised'
      using errcode = '42501';
  end if;

  update public.ci_projects project_table
  set status = 'draft',
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    project_row.status,
    'draft',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.returned_to_draft',
    target_project_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectReturnedToDraft',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function private.revoke_recognition(target_award_id uuid, target_reason text)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  award_row public.recognition_awards%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'recognition revoke is not authorised' using errcode = '42501';
  end if;
  perform private.assert_current_organisation_module_entitled('recognition');

  select award_table.* into award_row from public.recognition_awards award_table
  where award_table.organisation_id = org_id and award_table.id = target_award_id for update;
  if not found then raise exception 'recognition award not found' using errcode = 'P0002'; end if;
  if award_row.status = 'revoked' then
    raise exception 'recognition award is already revoked' using errcode = '55000';
  end if;
  if not private.has_scoped_permission(org_id, 'recognition.manage', null, null)
    and not private.has_scoped_permission(org_id, 'recognition.manage', null, award_row.organisational_unit_id) then
    raise exception 'recognition revoke is not authorised' using errcode = '42501';
  end if;
  insert into public.recognition_revocations (
    organisation_id, recognition_award_id, revoked_by_membership_id, reason
  ) values (org_id, target_award_id, actor_membership_id, btrim(target_reason));
  update public.recognition_awards set status = 'revoked'
  where organisation_id = org_id and id = target_award_id;
  perform private.append_business_audit(org_id, 'recognition.revoked', target_award_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, target_award_id, 'RecognitionRevoked', target_award_id::text, '{}'::jsonb);
  return true;
end; $$;

create or replace function private.revoke_training_completion(
  target_completion_id uuid,
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
begin
  if org_id is null
    or not private.can_manage_training_completions(org_id) then
    raise exception 'training completion revoke is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('training');

  update public.training_completions completion_row
  set
    status = 'revoked',
    notes = coalesce(target_notes, completion_row.notes),
    updated_at = statement_timestamp()
  where completion_row.organisation_id = org_id
    and completion_row.id = target_completion_id
    and completion_row.status = 'completed';

  if not found then
    raise exception 'active completion not found'
      using errcode = 'P0002';
  end if;

  perform private.enqueue_domain_event(
    org_id,
    target_completion_id,
    'TrainingCompletionRevoked',
    target_completion_id::text,
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function private.save_skill_setup_preparation(
  target_source text,
  target_template_key text,
  target_state jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  preparation_id uuid;
  template_key text := coalesce(target_template_key, '');
begin
  if org_id is null
    or actor_membership_id is null
    or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('skills');

  if target_source not in ('manual', 'quick_start', 'leanai')
    or char_length(template_key) > 80
    or target_state is null
    or pg_catalog.jsonb_typeof(target_state) is distinct from 'object'
    or octet_length(target_state::text) > 100000 then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  insert into public.skill_setup_preparations (
    organisation_id, membership_id, source, template_key, state
  )
  values (org_id, actor_membership_id, target_source, template_key, target_state)
  on conflict on constraint skill_setup_preparations_identity_key
  do update set state = excluded.state, updated_at = statement_timestamp()
  returning id into preparation_id;

  return preparation_id;
end;
$$;

create or replace function private.save_training_setup_preparation(
  target_source text,
  target_template_key text,
  target_state jsonb
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  preparation_id uuid;
  template_key text := coalesce(target_template_key, '');
begin
  if org_id is null or actor_membership_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  perform private.assert_current_organisation_module_entitled('training');

  if target_source not in ('manual', 'quick_start', 'leanai') or char_length(template_key) > 80
    or target_state is null or jsonb_typeof(target_state) is distinct from 'object'
    or octet_length(target_state::text) > 100000 then
    raise exception 'module setup definition is invalid' using errcode = '22023';
  end if;
  insert into public.training_setup_preparations (organisation_id, membership_id, source, template_key, state)
  values (org_id, actor_membership_id, target_source, template_key, target_state)
  on conflict on constraint training_setup_preparations_identity_key
  do update set state = excluded.state, updated_at = statement_timestamp()
  returning id into preparation_id;
  return preparation_id;
end;
$$;

create or replace function private.select_countermeasure(
  target_countermeasure_id uuid,
  target_rationale text default null
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
  cm_row public.problem_solving_countermeasures%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'countermeasure selection is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select cm.*
  into cm_row
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.id = target_countermeasure_id
  for update;

  if not found then
    raise exception 'countermeasure not found'
      using errcode = 'P0002';
  end if;

  if cm_row.status <> 'proposed' then
    raise exception 'countermeasure is not in proposed status'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, cm_row.problem_solving_case_id) then
    raise exception 'countermeasure selection is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_countermeasures cm_table
  set status = 'selected',
      selected_by_membership_id = actor_membership_id,
      selected_at = statement_timestamp(),
      selected_rationale = target_rationale,
      updated_at = statement_timestamp()
  where cm_table.organisation_id = org_id
    and cm_table.id = target_countermeasure_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.countermeasure_selected',
    cm_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object('countermeasure_id', target_countermeasure_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    cm_row.problem_solving_case_id,
    'ProblemSolvingCountermeasureSelected',
    target_countermeasure_id::text,
    jsonb_build_object(
      'case_id', cm_row.problem_solving_case_id,
      'countermeasure_id', target_countermeasure_id
    )
  );

  return true;
end;
$$;

create or replace function private.start_ai_run(
  target_ai_session_id uuid,
  target_user_message text,
  target_idempotency_key text,
  target_provider text,
  target_model text,
  target_prompt_key text,
  target_prompt_version text,
  target_prompt_hash text
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
  session_row public.ai_sessions%rowtype;
  settings_row public.organisation_ai_settings%rowtype;
  existing_run_id uuid;
  new_run_id uuid;
  new_message_id uuid;
  monthly_usage bigint;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'ai run start is not authorised'
      using errcode = '42501';
  end if;


  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_sessions s
     where s.organisation_id = org_id and s.id = target_ai_session_id),
    (select s.module_key from public.ai_sessions s
     where s.organisation_id = org_id and s.id = target_ai_session_id)
  );

  if not private.can_use_ai(org_id) then
    raise exception 'ai is not enabled for this organisation'
      using errcode = '42501';
  end if;

  select session_table.*
  into session_row
  from public.ai_sessions session_table
  where session_table.organisation_id = org_id
    and session_table.id = target_ai_session_id;

  if not found then
    raise exception 'ai session not found'
      using errcode = 'P0002';
  end if;

  if session_row.status <> 'active' then
    raise exception 'ai session is not active'
      using errcode = '55000';
  end if;

  if session_row.created_by_membership_id <> actor_membership_id then
    raise exception 'only the ai session creator may start runs'
      using errcode = '42501';
  end if;

  if session_row.context_type = 'problem_solving' then
    if session_row.problem_solving_case_id is null
      or not private.can_read_problem_solving_case(
        org_id,
        session_row.problem_solving_case_id
      ) then
      raise exception 'problem solving case access required'
        using errcode = '42501';
    end if;
  elsif session_row.context_type <> 'coach' then
    raise exception 'ai session context is not authorised'
      using errcode = '42501';
  end if;

  select settings_table.*
  into settings_row
  from public.organisation_ai_settings settings_table
  where settings_table.organisation_id = org_id;

  monthly_usage := private.organisation_ai_monthly_token_usage(org_id);
  if settings_row.monthly_token_ceiling is not null
    and monthly_usage >= settings_row.monthly_token_ceiling then
    raise exception 'organisation ai monthly token ceiling reached'
      using errcode = '42501';
  end if;

  if (
    select count(*)
    from public.ai_runs recent_run
    where recent_run.organisation_id = org_id
      and recent_run.requested_by_membership_id = actor_membership_id
      and recent_run.started_at >= statement_timestamp() - interval '5 minutes'
  ) >= 30 then
    raise exception 'ai rate limit exceeded'
      using errcode = '42501';
  end if;

  select run_table.id
  into existing_run_id
  from public.ai_runs run_table
  where run_table.organisation_id = org_id
    and run_table.idempotency_key = btrim(target_idempotency_key);

  if existing_run_id is not null then
    return existing_run_id;
  end if;

  insert into public.ai_messages (
    organisation_id,
    ai_session_id,
    role,
    content
  )
  values (
    org_id,
    target_ai_session_id,
    'user',
    btrim(target_user_message)
  )
  returning id into new_message_id;

  new_run_id := private.register_resource_record(
    org_id,
    'ai_run',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.ai_runs (
    id,
    organisation_id,
    ai_session_id,
    requested_by_membership_id,
    provider,
    model,
    prompt_key,
    prompt_version,
    prompt_hash,
    status,
    idempotency_key
  )
  values (
    new_run_id,
    org_id,
    target_ai_session_id,
    actor_membership_id,
    btrim(target_provider),
    btrim(target_model),
    btrim(target_prompt_key),
    btrim(target_prompt_version),
    btrim(target_prompt_hash),
    'running',
    btrim(target_idempotency_key)
  );

  perform private.append_business_audit(
    org_id,
    'ai.run.started',
    new_run_id,
    'succeeded',
    jsonb_build_object(
      'ai_run_id', new_run_id,
      'ai_session_id', target_ai_session_id,
      'user_message_id', new_message_id,
      'context_type', session_row.context_type
    )
  );


  if not coalesce(
    private.ai_credit_try_reserve(
      new_run_id,
      btrim(target_idempotency_key),
      greatest(1::bigint, 1::bigint)
    ),
    true
  ) then
    raise exception 'leanai credit allowance exceeded for this period'
      using errcode = '42501';
  end if;

  return new_run_id;
end;
$$;

create or replace function private.start_benefit_realisation(
  target_benefit_id uuid
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
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation start is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'approved' then
    raise exception 'benefit cannot start realisation'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit realisation start is not authorised'
      using errcode = '42501';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'realising',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    'approved',
    'realising',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'benefit.realisation_started',
    target_benefit_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitRealisationStarted',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

create or replace function private.start_problem_solving_session(
  target_case_id uuid,
  target_title text,
  target_facilitator_membership_id uuid default null,
  target_scheduled_at timestamptz default null
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
  case_row public.problem_solving_cases%rowtype;
  resolved_facilitator uuid;
  new_session_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'session creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'active' then
    raise exception 'sessions can only be started on active cases'
      using errcode = '55000';
  end if;

  if not private.can_contribute_problem_solving_case(org_id, target_case_id) then
    raise exception 'session creation is not authorised'
      using errcode = '42501';
  end if;

  resolved_facilitator := coalesce(target_facilitator_membership_id, actor_membership_id);

  insert into public.problem_solving_sessions (
    organisation_id,
    case_id,
    title,
    facilitator_membership_id,
    scheduled_at,
    started_at,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_title),
    resolved_facilitator,
    target_scheduled_at,
    statement_timestamp(),
    'in_progress',
    actor_membership_id
  )
  returning id into new_session_id;

  insert into public.problem_solving_session_participants (
    organisation_id,
    session_id,
    membership_id,
    added_by_membership_id
  )
  values (
    org_id,
    new_session_id,
    resolved_facilitator,
    actor_membership_id
  )
  on conflict (organisation_id, session_id, membership_id) do nothing;

  if resolved_facilitator <> actor_membership_id then
    insert into public.problem_solving_session_participants (
      organisation_id,
      session_id,
      membership_id,
      added_by_membership_id
    )
    values (
      org_id,
      new_session_id,
      actor_membership_id,
      actor_membership_id
    )
    on conflict (organisation_id, session_id, membership_id) do nothing;
  end if;

  perform private.append_business_audit(
    org_id,
    'problem_solving.session_started',
    target_case_id,
    'succeeded',
    jsonb_build_object('session_id', new_session_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingSessionStarted',
    new_session_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'session_id', new_session_id
    )
  );

  return new_session_id;
end;
$$;

create or replace function private.start_project(
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
    raise exception 'project start is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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

  if project_row.status <> 'approved' then
    raise exception 'project is not startable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project start is not authorised'
      using errcode = '42501';
  end if;

  perform private.instantiate_ci_project_phases(org_id, target_project_id);

  update public.ci_projects project_table
  set status = 'active',
      actual_start_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.lock_ci_project_metrics(org_id, target_project_id);

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'approved',
    'active',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.started',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectStarted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function public.start_workforce_import_provisioning(
  target_import_job_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.status <> 'validated' or job_row.error_rows > 0 then
    raise exception 'import job cannot be provisioned until validation succeeds'
      using errcode = '55000';
  end if;

  update public.workforce_import_jobs
  set status = 'provisioning',
      started_at = coalesce(started_at, statement_timestamp()),
      credential_export_status = 'none',
      credential_expires_at = null,
      updated_at = statement_timestamp()
  where id = target_import_job_id;
end;
$$;

create or replace function private.submit_benefit(
  target_benefit_id uuid,
  target_ci_validator_membership_id uuid,
  target_finance_validator_membership_id uuid default null
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
  benefit_row public.improvement_benefits%rowtype;
  forecast_row public.benefit_forecast_versions%rowtype;
  category_row public.benefit_categories%rowtype;
  unit_row public.organisation_units%rowtype;
  owner_display_name text;
  allocated_benefit_number text;
  new_submission_snapshot_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'draft' then
    raise exception 'benefit is not submittable'
      using errcode = '55000';
  end if;

  if benefit_row.owner_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_source_ready_for_submit(
    org_id,
    target_benefit_id,
    benefit_row.is_standalone_initiative
  );
  perform private.assert_benefit_baseline_ready_for_submit(benefit_row);

  if benefit_row.current_forecast_version_id is null then
    raise exception 'benefit requires a submitted forecast before submission'
      using errcode = '22023';
  end if;

  select version_table.*
  into forecast_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = benefit_row.current_forecast_version_id
  for update;

  if not found or forecast_row.lifecycle <> 'submitted' then
    raise exception 'benefit forecast must be submitted before benefit submission'
      using errcode = '22023';
  end if;

  perform private.assert_benefit_forecast_period_integrity(
    forecast_row.id,
    org_id
  );

  perform private.assert_benefit_ci_validator_eligible(
    org_id,
    target_benefit_id,
    target_ci_validator_membership_id
  );

  if benefit_row.benefit_class = 'financial' then
    perform private.assert_benefit_finance_validator_eligible(
      org_id,
      target_benefit_id,
      target_finance_validator_membership_id
    );
    perform private.assert_benefit_financial_separation_of_duties(
      org_id,
      target_benefit_id,
      target_ci_validator_membership_id,
      target_finance_validator_membership_id,
      benefit_row.created_by_membership_id
    );
  elsif target_finance_validator_membership_id is not null then
    raise exception 'non-financial benefits do not require finance validation'
      using errcode = '22023';
  end if;

  if benefit_row.benefit_number is null then
    allocated_benefit_number := private.allocate_organisation_document_number(
      org_id,
      'improvement_benefit',
      'BEN'
    );
  else
    allocated_benefit_number := benefit_row.benefit_number;
  end if;

  if benefit_row.category_id is not null then
    select category_table.*
    into category_row
    from public.benefit_categories category_table
    where category_table.organisation_id = org_id
      and category_table.id = benefit_row.category_id;
  end if;

  select unit_table.*
  into unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = benefit_row.organisational_unit_id;

  select coalesce(membership_row.display_name, profile_row.display_name)
  into owner_display_name
  from public.organisation_memberships membership_row
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where membership_row.organisation_id = org_id
    and membership_row.id = benefit_row.owner_membership_id;

  insert into public.benefit_submission_snapshots (
    organisation_id,
    benefit_id,
    benefit_number,
    title,
    description,
    benefit_class,
    financial_type,
    non_financial_type,
    category_id,
    category_name_snapshot,
    category_code_snapshot,
    organisational_unit_id,
    unit_name_snapshot,
    unit_code_snapshot,
    owner_membership_id,
    owner_display_name_snapshot,
    baseline_description,
    baseline_period_start,
    baseline_period_end,
    baseline_measure_value,
    baseline_measure_unit,
    baseline_financial_value,
    source_links_summary,
    forecast_version_id,
    forecast_total_amount,
    target_measure_value,
    target_measure_unit,
    target_date,
    reporting_currency_snapshot,
    planned_realisation_start,
    planned_realisation_end,
    is_standalone_initiative,
    submitted_by_membership_id
  )
  values (
    org_id,
    target_benefit_id,
    allocated_benefit_number,
    benefit_row.title,
    benefit_row.description,
    benefit_row.benefit_class,
    benefit_row.financial_type,
    benefit_row.non_financial_type,
    benefit_row.category_id,
    category_row.name,
    category_row.code,
    benefit_row.organisational_unit_id,
    unit_row.name,
    unit_row.code,
    benefit_row.owner_membership_id,
    owner_display_name,
    benefit_row.baseline_description,
    benefit_row.baseline_period_start,
    benefit_row.baseline_period_end,
    benefit_row.baseline_measure_value,
    benefit_row.baseline_measure_unit,
    benefit_row.baseline_financial_value,
    private.build_benefit_source_links_summary(org_id, target_benefit_id),
    forecast_row.id,
    forecast_row.forecast_total_amount,
    forecast_row.target_measure_value,
    forecast_row.target_measure_unit,
    forecast_row.target_date,
    benefit_row.reporting_currency_snapshot,
    benefit_row.planned_realisation_start,
    benefit_row.planned_realisation_end,
    benefit_row.is_standalone_initiative,
    actor_membership_id
  )
  returning id into new_submission_snapshot_id;

  perform private.create_benefit_validation_assignments(
    org_id,
    target_benefit_id,
    target_ci_validator_membership_id,
    target_finance_validator_membership_id,
    actor_membership_id,
    benefit_row.benefit_class
  );

  update public.improvement_benefits benefit_table
  set status = 'submitted',
      benefit_number = allocated_benefit_number,
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    'draft',
    'submitted',
    actor_membership_id,
    'submitted'
  );

  perform private.append_business_audit(
    org_id,
    'benefit.submitted',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'submission_snapshot_id', new_submission_snapshot_id,
      'forecast_version_id', forecast_row.id,
      'ci_validator_membership_id', target_ci_validator_membership_id,
      'finance_validator_membership_id', target_finance_validator_membership_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitSubmitted',
    new_submission_snapshot_id::text,
    jsonb_build_object(
      'benefit_id', target_benefit_id,
      'submission_snapshot_id', new_submission_snapshot_id
    )
  );

  return new_submission_snapshot_id;
end;
$$;

create or replace function private.submit_benefit_forecast(
  target_forecast_version_id uuid
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
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id
  for update;

  if not found or version_row.lifecycle <> 'draft' then
    raise exception 'forecast version is not submittable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id
  for update;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_forecast_period_integrity(
    target_forecast_version_id,
    org_id
  );

  update public.benefit_forecast_versions version_table
  set lifecycle = 'submitted',
      submitted_at = statement_timestamp()
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id;

  update public.improvement_benefits benefit_table
  set current_forecast_version_id = target_forecast_version_id,
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id;

  perform private.append_business_audit(
    org_id,
    'benefit_forecast.submitted',
    version_row.benefit_id,
    'succeeded',
    jsonb_build_object('forecast_version_id', target_forecast_version_id)
  );

  return true;
end;
$$;

create or replace function private.submit_benefit_realisation_entry(
  target_entry_id uuid
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
  entry_row public.benefit_realisation_entries%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select entry_table.*
  into entry_row
  from public.benefit_realisation_entries entry_table
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id
  for update;

  if not found or entry_row.status <> 'draft' then
    raise exception 'realisation entry is not submittable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = entry_row.benefit_id;

  if not private.benefit_allows_realisation_recording(benefit_row.status) then
    raise exception 'benefit is not in a realisation-recording status'
      using errcode = '55000';
  end if;

  if entry_row.recorded_by_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(
      org_id,
      benefit_row.organisational_unit_id
    ) then
    raise exception 'benefit realisation submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_realisation_entry_payload(
    benefit_row,
    entry_row.financial_amount,
    entry_row.measure_value,
    entry_row.measure_unit,
    entry_row.entry_kind,
    entry_row.is_correction
  );

  update public.benefit_realisation_entries entry_table
  set status = 'submitted',
      submitted_at = statement_timestamp()
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id;

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.submitted',
    entry_row.benefit_id,
    'succeeded',
    jsonb_build_object('entry_id', target_entry_id)
  );

  return true;
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
begin
  perform private.assert_current_organisation_module_entitled('projects');

  return private.submit_project(target_project_id);
end;
$$;

create or replace function private.submit_project(
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
  methodology_published boolean;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project submission is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

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
    raise exception 'project is not submittable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project submission is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_charter_complete(project_row);

  if not private.ci_project_has_exactly_one_active_owner(org_id, target_project_id) then
    raise exception 'project requires exactly one active owner before submission'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.ci_project_methodology_versions version_table
    where version_table.organisation_id = org_id
      and version_table.id = project_row.methodology_version_id
      and version_table.status = 'published'
  )
  into methodology_published;

  if not methodology_published then
    raise exception 'project methodology version is not published'
      using errcode = '22023';
  end if;

  update public.ci_projects project_table
  set status = 'submitted',
      charter_submitted_at = statement_timestamp(),
      charter_submitted_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  perform private.append_ci_project_status_history(
    org_id,
    target_project_id,
    'draft',
    'submitted',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'ci_project.submitted',
    target_project_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_project_id,
    'CiProjectSubmitted',
    target_project_id::text,
    jsonb_build_object('project_id', target_project_id)
  );

  return true;
end;
$$;

create or replace function public.submit_workforce_import_rows(
  target_import_job_id uuid,
  target_rows jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
  row_item jsonb;
  row_index integer := 0;
  row_count integer;
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.status <> 'draft' then
    raise exception 'import job cannot accept rows in its current state'
      using errcode = '55000';
  end if;

  if target_rows is null or jsonb_typeof(target_rows) <> 'array' then
    raise exception 'rows payload must be a JSON array'
      using errcode = '22023';
  end if;

  row_count := jsonb_array_length(target_rows);

  if row_count = 0 then
    raise exception 'import file is empty'
      using errcode = '22023';
  end if;

  if row_count > 1000 then
    raise exception 'import exceeds the maximum of 1000 rows'
      using errcode = '22023';
  end if;

  delete from public.workforce_import_rows import_row
  where import_row.import_job_id = target_import_job_id;

  for row_item in
    select value
    from jsonb_array_elements(target_rows) as payload(value)
  loop
    row_index := row_index + 1;
    insert into public.workforce_import_rows (
      import_job_id,
      organisation_id,
      row_number,
      input_payload,
      status
    )
    values (
      target_import_job_id,
      org_id,
      row_index,
      row_item,
      'pending'
    );
  end loop;

  update public.workforce_import_jobs
  set total_rows = row_count,
      valid_rows = 0,
      error_rows = 0,
      warning_rows = 0,
      provisioned_rows = 0,
      failed_rows = 0,
      remediation_rows = 0,
      updated_at = statement_timestamp()
  where id = target_import_job_id;
end;
$$;

create or replace function private.sync_leanai_operational_chase_notifications()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_id uuid;
begin
  if org_id is null then
    raise exception 'sync operational chase notifications is not authorised'
      using errcode = '42501';
  end if;

  actor_id := private.current_membership_id(org_id);
  if actor_id is null then
    raise exception 'sync operational chase notifications is not authorised'
      using errcode = '42501';
  end if;

  if not private.try_begin_in_app_operational_chase_sync(org_id, actor_id) then
    return 0;
  end if;

  return private.run_in_app_operational_chase_sync_for_actor(org_id, actor_id);
end;
$$;

create or replace function private.update_benefit_category(
  target_category_id uuid,
  target_name text,
  target_description text default null,
  target_display_order integer default null
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
  if org_id is null or not private.can_manage_benefit_categories(org_id) then
    raise exception 'benefit category update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  update public.benefit_categories category_table
  set
    name = btrim(target_name),
    description = target_description,
    display_order = coalesce(target_display_order, category_table.display_order)
  where category_table.organisation_id = org_id
    and category_table.id = target_category_id;

  if not found then
    raise exception 'benefit category not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.update_benefit_draft(
  target_benefit_id uuid,
  target_title text,
  target_description text default null,
  target_benefit_class text default null,
  target_financial_type text default null,
  target_non_financial_type text default null,
  target_category_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_owner_membership_id uuid default null,
  target_baseline_description text default null,
  target_baseline_period_start date default null,
  target_baseline_period_end date default null,
  target_baseline_measure_value numeric default null,
  target_baseline_measure_unit text default null,
  target_baseline_financial_value numeric default null,
  target_planned_realisation_start date default null,
  target_planned_realisation_end date default null,
  target_is_standalone_initiative boolean default null
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
  benefit_row public.improvement_benefits%rowtype;
  next_benefit_class text;
  next_financial_type text;
  next_non_financial_type text;
  next_reporting_currency text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'draft' then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if benefit_row.owner_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit update is not authorised'
      using errcode = '42501';
  end if;

  if target_organisational_unit_id is not null
    and not private.can_manage_benefit_in_unit(org_id, target_organisational_unit_id) then
    raise exception 'target unit is not within manage scope'
      using errcode = '42501';
  end if;

  next_benefit_class := coalesce(target_benefit_class, benefit_row.benefit_class);
  next_financial_type := case
    when next_benefit_class = 'financial'
      then coalesce(target_financial_type, benefit_row.financial_type)
    else null
  end;
  next_non_financial_type := case
    when next_benefit_class = 'non_financial'
      then coalesce(target_non_financial_type, benefit_row.non_financial_type)
    else null
  end;

  if next_benefit_class = 'financial' then
    if next_financial_type is null or next_non_financial_type is not null then
      raise exception 'financial benefit requires a financial type'
        using errcode = '22023';
    end if;

    select organisation.reporting_currency
    into next_reporting_currency
    from public.organisations organisation
    where organisation.id = org_id;
  elsif next_benefit_class = 'non_financial' then
    if next_non_financial_type is null or next_financial_type is not null then
      raise exception 'non-financial benefit requires a non-financial type'
        using errcode = '22023';
    end if;

    next_reporting_currency := null;
  else
    raise exception 'invalid benefit class'
      using errcode = '22023';
  end if;

  if coalesce(target_is_standalone_initiative, benefit_row.is_standalone_initiative)
    and exists (
      select 1
      from public.benefit_source_links link_row
      where link_row.organisation_id = org_id
        and link_row.benefit_id = target_benefit_id
    ) then
    raise exception 'standalone benefits cannot retain source links'
      using errcode = '22023';
  end if;

  update public.improvement_benefits benefit_table
  set title = btrim(target_title),
      description = target_description,
      benefit_class = next_benefit_class,
      financial_type = next_financial_type,
      non_financial_type = next_non_financial_type,
      category_id = coalesce(target_category_id, benefit_row.category_id),
      organisational_unit_id = coalesce(
        target_organisational_unit_id,
        benefit_row.organisational_unit_id
      ),
      owner_membership_id = coalesce(
        target_owner_membership_id,
        benefit_row.owner_membership_id
      ),
      reporting_currency_snapshot = next_reporting_currency,
      baseline_description = target_baseline_description,
      baseline_period_start = target_baseline_period_start,
      baseline_period_end = target_baseline_period_end,
      baseline_measure_value = case
        when next_benefit_class = 'non_financial'
          then coalesce(target_baseline_measure_value, benefit_row.baseline_measure_value)
        else null
      end,
      baseline_measure_unit = case
        when next_benefit_class = 'non_financial'
          then coalesce(target_baseline_measure_unit, benefit_row.baseline_measure_unit)
        else null
      end,
      baseline_financial_value = case
        when next_benefit_class = 'financial'
          then coalesce(target_baseline_financial_value, benefit_row.baseline_financial_value)
        else null
      end,
      planned_realisation_start = target_planned_realisation_start,
      planned_realisation_end = target_planned_realisation_end,
      is_standalone_initiative = coalesce(
        target_is_standalone_initiative,
        benefit_row.is_standalone_initiative
      ),
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  return true;
end;
$$;

create or replace function private.update_benefit_forecast_draft(
  target_forecast_version_id uuid,
  target_realisation_pattern text,
  target_forecast_start_date date,
  target_forecast_end_date date,
  target_forecast_total_amount numeric default null,
  target_calculation_basis text default null,
  target_assumptions text default null,
  target_target_measure_value numeric default null,
  target_target_measure_unit text default null,
  target_target_date date default null
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
  version_row public.benefit_forecast_versions%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit forecast draft update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select version_table.*
  into version_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id
  for update;

  if not found or version_row.lifecycle <> 'draft' then
    raise exception 'forecast version is not editable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = version_row.benefit_id
  for update;

  if not private.benefit_is_editable(benefit_row.status) then
    raise exception 'benefit is not editable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit forecast draft update is not authorised'
      using errcode = '42501';
  end if;

  update public.benefit_forecast_versions version_table
  set realisation_pattern = target_realisation_pattern,
      forecast_start_date = target_forecast_start_date,
      forecast_end_date = target_forecast_end_date,
      forecast_total_amount = target_forecast_total_amount,
      calculation_basis = target_calculation_basis,
      assumptions = target_assumptions,
      target_measure_value = target_target_measure_value,
      target_measure_unit = case
        when target_target_measure_unit is null then null
        else btrim(target_target_measure_unit)
      end,
      target_date = target_target_date
  where version_table.organisation_id = org_id
    and version_table.id = target_forecast_version_id;

  return true;
end;
$$;

create or replace function private.update_benefit_overlap_allocation(
  target_overlap_group_id uuid,
  target_benefit_id uuid,
  target_allocation_percentage numeric,
  target_reason text default null
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
  group_row public.benefit_overlap_groups%rowtype;
  benefit_row public.improvement_benefits%rowtype;
  active_allocation_row public.benefit_overlap_allocation_history%rowtype;
  active_allocation_sum numeric;
  new_allocation_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit overlap allocation update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select group_table.*
  into group_row
  from public.benefit_overlap_groups group_table
  where group_table.organisation_id = org_id
    and group_table.id = target_overlap_group_id
  for update;

  if not found then
    raise exception 'overlap group was not found'
      using errcode = 'P0002';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit overlap allocation update is not authorised'
      using errcode = '42501';
  end if;

  select allocation_table.*
  into active_allocation_row
  from public.benefit_overlap_allocation_history allocation_table
  where allocation_table.organisation_id = org_id
    and allocation_table.overlap_group_id = target_overlap_group_id
    and allocation_table.benefit_id = target_benefit_id
    and allocation_table.superseded_at is null;

  if not found then
    raise exception 'active overlap allocation was not found'
      using errcode = 'P0002';
  end if;

  active_allocation_sum := private.sum_active_benefit_overlap_allocations(
    org_id,
    target_overlap_group_id
  );

  if active_allocation_sum - active_allocation_row.allocation_percentage
      + target_allocation_percentage > 100 then
    raise exception 'active overlap allocations would exceed 100 percent'
      using errcode = '23514';
  end if;

  update public.benefit_overlap_allocation_history allocation_table
  set superseded_at = statement_timestamp()
  where allocation_table.organisation_id = org_id
    and allocation_table.id = active_allocation_row.id
    and allocation_table.superseded_at is null;

  insert into public.benefit_overlap_allocation_history (
    organisation_id,
    overlap_group_id,
    benefit_id,
    allocation_percentage,
    reason,
    assigned_by_membership_id
  )
  values (
    org_id,
    target_overlap_group_id,
    target_benefit_id,
    target_allocation_percentage,
    target_reason,
    actor_membership_id
  )
  returning id into new_allocation_id;

  perform private.append_business_audit(
    org_id,
    'benefit_overlap_allocation.updated',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'overlap_group_id', target_overlap_group_id,
      'previous_allocation_id', active_allocation_row.id,
      'allocation_id', new_allocation_id,
      'allocation_percentage', target_allocation_percentage
    )
  );

  return new_allocation_id;
end;
$$;

create or replace function private.update_ci_project_draft(
  target_project_id uuid,
  target_title text default null,
  target_problem_statement text default null,
  target_objective text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_baseline_summary text default null,
  target_target_summary text default null,
  target_expected_impact_summary text default null,
  target_constraints_risks text default null,
  target_sustainment_expectation text default null,
  target_methodology_version_id uuid default null,
  target_planned_start_date date default null,
  target_planned_end_date date default null,
  target_priority text default null
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
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'project draft update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  select project_table.*
  into project_row
  from public.ci_projects project_table
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id
    and project_table.status = 'draft'
  for update;

  if not found then
    raise exception 'only draft projects can be edited'
      using errcode = '55000';
  end if;

  if target_methodology_version_id is not null then
    if not exists (
      select 1
      from public.ci_project_methodology_versions version_table
      where version_table.organisation_id = org_id
        and version_table.id = target_methodology_version_id
        and version_table.status = 'published'
    ) then
      raise exception 'methodology version is not published'
        using errcode = '22023';
    end if;
  end if;

  update public.ci_projects project_table
  set
    title = coalesce(target_title, project_table.title),
    problem_statement = coalesce(target_problem_statement, project_table.problem_statement),
    objective = coalesce(target_objective, project_table.objective),
    scope_in = coalesce(target_scope_in, project_table.scope_in),
    scope_out = coalesce(target_scope_out, project_table.scope_out),
    baseline_summary = coalesce(target_baseline_summary, project_table.baseline_summary),
    target_summary = coalesce(target_target_summary, project_table.target_summary),
    expected_impact_summary = coalesce(
      target_expected_impact_summary,
      project_table.expected_impact_summary
    ),
    constraints_risks = coalesce(target_constraints_risks, project_table.constraints_risks),
    sustainment_expectation = coalesce(
      target_sustainment_expectation,
      project_table.sustainment_expectation
    ),
    methodology_version_id = coalesce(
      target_methodology_version_id,
      project_table.methodology_version_id
    ),
    planned_start_date = coalesce(target_planned_start_date, project_table.planned_start_date),
    planned_end_date = coalesce(target_planned_end_date, project_table.planned_end_date),
    priority = coalesce(target_priority, project_table.priority),
    updated_at = statement_timestamp()
  where project_table.organisation_id = org_id
    and project_table.id = target_project_id;

  return true;
end;
$$;

create or replace function private.update_containment(
  target_containment_id uuid,
  target_description text default null,
  target_rationale text default null,
  target_is_still_required boolean default null
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
  containment_row public.problem_solving_containments%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'containment update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select c.*
  into containment_row
  from public.problem_solving_containments c
  where c.organisation_id = org_id
    and c.id = target_containment_id
  for update;

  if not found then
    raise exception 'containment not found'
      using errcode = 'P0002';
  end if;

  if containment_row.status = 'released' then
    raise exception 'released containments are immutable'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    containment_row.problem_solving_case_id
  ) then
    raise exception 'containment update is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_containments c
  set description   = coalesce(btrim(target_description), c.description),
      rationale      = coalesce(target_rationale, c.rationale),
      is_still_required = coalesce(target_is_still_required, c.is_still_required),
      updated_at     = statement_timestamp()
  where c.organisation_id = org_id
    and c.id = target_containment_id;

  perform private.append_business_audit(
    org_id,
    'containment.updated',
    containment_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object('containment_id', target_containment_id)
  );

  return true;
end;
$$;

create or replace function private.update_hypothesis_status(
  target_hypothesis_id uuid,
  target_status text,
  target_reason text default null
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis status update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if target_status not in ('testing', 'supported') then
    raise exception 'only testing and supported transitions are allowed via this RPC'
      using errcode = '22023';
  end if;

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id
  for update;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis status update is not authorised'
      using errcode = '42501';
  end if;

  if target_status = 'testing' and hypothesis_row.status not in ('proposed') then
    raise exception 'only proposed hypotheses can move to testing'
      using errcode = '55000';
  end if;

  if target_status = 'supported' and hypothesis_row.status not in ('proposed', 'testing') then
    raise exception 'only proposed or testing hypotheses can move to supported'
      using errcode = '55000';
  end if;

  update public.problem_solving_hypotheses h
  set status     = target_status,
      updated_at = statement_timestamp()
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  perform private.append_hypothesis_status_history(
    org_id, target_hypothesis_id,
    hypothesis_row.status, target_status,
    actor_membership_id, target_reason
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.status_updated',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from', hypothesis_row.status,
      'to', target_status
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisStatusUpdated',
    target_hypothesis_id::text,
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from_status', hypothesis_row.status,
      'to_status', target_status
    )
  );

  return true;
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

create or replace function private.update_problem_solving_case_draft(
  target_case_id uuid,
  target_title text default null,
  target_problem_statement text default null,
  target_background text default null,
  target_business_impact text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_target_condition text default null,
  target_detected_at timestamptz default null,
  target_priority text default null,
  target_severity text default null,
  target_owner_membership_id uuid default null,
  target_facilitator_membership_id uuid default null,
  target_method_version_id uuid default null,
  target_target_due_at timestamptz default null
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
  case_row public.problem_solving_cases%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'draft update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'draft' then
    raise exception 'only draft cases can be updated via this function'
      using errcode = '55000';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, case_row.organisation_unit_id)
    or (case_row.created_by_membership_id = actor_membership_id)
    or (case_row.owner_membership_id = actor_membership_id)
  ) then
    raise exception 'draft update is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_cases case_table
  set title = coalesce(btrim(target_title), case_table.title),
      problem_statement = coalesce(target_problem_statement, case_table.problem_statement),
      background = coalesce(target_background, case_table.background),
      business_impact = coalesce(target_business_impact, case_table.business_impact),
      scope_in = coalesce(target_scope_in, case_table.scope_in),
      scope_out = coalesce(target_scope_out, case_table.scope_out),
      target_condition = coalesce(target_target_condition, case_table.target_condition),
      detected_at = coalesce(target_detected_at, case_table.detected_at),
      priority = coalesce(target_priority, case_table.priority),
      severity = coalesce(target_severity, case_table.severity),
      owner_membership_id = coalesce(target_owner_membership_id, case_table.owner_membership_id),
      facilitator_membership_id = coalesce(target_facilitator_membership_id, case_table.facilitator_membership_id),
      method_version_id = coalesce(target_method_version_id, case_table.method_version_id),
      target_due_at = coalesce(target_target_due_at, case_table.target_due_at)
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  return true;
end;
$$;

create or replace function private.update_problem_solving_problem_statement(
  target_case_id uuid,
  target_problem_statement text
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
  case_row public.problem_solving_cases%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'problem statement update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if btrim(coalesce(target_problem_statement, '')) = '' then
    raise exception 'problem statement is required'
      using errcode = '22023';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status not in ('draft', 'active') then
    raise exception 'case is not open for problem statement updates'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'problem statement update is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_cases case_table
  set problem_statement = btrim(target_problem_statement)
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  return true;
end;
$$;

create or replace function private.update_problem_solving_target_condition(
  target_case_id uuid,
  target_target_condition text
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
  case_row public.problem_solving_cases%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'target condition update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if btrim(coalesce(target_target_condition, '')) = '' then
    raise exception 'target condition is required'
      using errcode = '22023';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status not in ('draft', 'active') then
    raise exception 'case is not open for target condition updates'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'target condition update is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_cases case_table
  set target_condition = btrim(target_target_condition)
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  return true;
end;
$$;

create or replace function private.upsert_benefit_reporting_settings(
  target_fiscal_year_start_month integer
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_benefit_categories(org_id) then
    raise exception 'benefit reporting settings update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  if target_fiscal_year_start_month < 1 or target_fiscal_year_start_month > 12 then
    raise exception 'fiscal year start month must be between 1 and 12'
      using errcode = '22023';
  end if;

  insert into public.benefit_reporting_settings (
    organisation_id,
    fiscal_year_start_month,
    created_by_membership_id,
    updated_by_membership_id
  )
  values (
    org_id,
    target_fiscal_year_start_month,
    actor_membership_id,
    actor_membership_id
  )
  on conflict (organisation_id) do update
  set
    fiscal_year_start_month = excluded.fiscal_year_start_month,
    updated_by_membership_id = actor_membership_id,
    updated_at = statement_timestamp();

  return true;
end;
$$;

create or replace function private.validate_benefit_realisation_entry(
  target_entry_id uuid
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
  entry_row public.benefit_realisation_entries%rowtype;
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation validation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select entry_table.*
  into entry_row
  from public.benefit_realisation_entries entry_table
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id
  for update;

  if not found or entry_row.status <> 'submitted' then
    raise exception 'realisation entry is not validatable'
      using errcode = '55000';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = entry_row.benefit_id;

  if not private.can_validate_benefit_realisation(
    org_id,
    benefit_row.organisational_unit_id
  ) then
    raise exception 'benefit realisation validation is not authorised'
      using errcode = '42501';
  end if;

  if benefit_row.benefit_class = 'financial'
    and entry_row.recorded_by_membership_id = actor_membership_id then
    raise exception 'financial realisation validation requires separation of duties'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_realisation_entry_payload(
    benefit_row,
    entry_row.financial_amount,
    entry_row.measure_value,
    entry_row.measure_unit,
    entry_row.entry_kind,
    entry_row.is_correction
  );

  update public.benefit_realisation_entries entry_table
  set status = 'validated',
      validated_by_membership_id = actor_membership_id,
      validated_at = statement_timestamp()
  where entry_table.organisation_id = org_id
    and entry_table.id = target_entry_id;

  perform private.append_business_audit(
    org_id,
    'benefit_realisation.validated',
    entry_row.benefit_id,
    'succeeded',
    jsonb_build_object('entry_id', target_entry_id)
  );

  return true;
end;
$$;

create or replace function public.validate_workforce_import_job(
  target_import_job_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
  import_row public.workforce_import_rows%rowtype;
  seen_usernames jsonb := '{}'::jsonb;
  username text;
  row_status text;
  resolved jsonb;
  validation_field_errors jsonb;
  valid_count integer := 0;
  error_count integer := 0;
  warning_count integer := 0;
begin
  perform private.assert_current_organisation_module_entitled('people_hr');

  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  for import_row in
    select import_row_table.*
    from public.workforce_import_rows import_row_table
    where import_row_table.import_job_id = target_import_job_id
    order by import_row_table.row_number
  loop
    username := lower(btrim(coalesce(import_row.input_payload ->> 'username', '')));

    if username <> '' and seen_usernames ? username then
      row_status := 'error';
      validation_field_errors := jsonb_build_array(
        jsonb_build_object(
          'field', 'username',
          'issue', format('Username ''%s'' is duplicated in this file.', username),
          'suggestion', 'Use a unique username for each row.'
        )
      );
      resolved := null;
    else
      if username <> '' then
        seen_usernames := seen_usernames || jsonb_build_object(username, true);
      end if;

      select
        validation.row_status,
        validation.resolved,
        validation.field_errors
      into row_status, resolved, validation_field_errors
      from private.validate_workforce_import_row_payload(
        org_id,
        actor_membership_id,
        import_row.input_payload
      ) as validation;
    end if;

    update public.workforce_import_rows import_row_target
    set status = row_status,
        resolved_payload = resolved,
        field_errors = validation_field_errors,
        error_code = case when row_status = 'error' then 'validation_failed' else null end,
        error_message = case
          when row_status = 'error' then 'Row failed validation.'
          else null
        end,
        updated_at = statement_timestamp()
    where import_row_target.id = import_row.id;

    if row_status = 'valid' then
      valid_count := valid_count + 1;
    elsif row_status = 'warning' then
      warning_count := warning_count + 1;
      valid_count := valid_count + 1;
    else
      error_count := error_count + 1;
    end if;
  end loop;

  update public.workforce_import_jobs
  set status = case when error_count = 0 then 'validated' else 'validation_failed' end,
      valid_rows = valid_count,
      error_rows = error_count,
      warning_rows = warning_count,
      validation_completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = target_import_job_id;

  return jsonb_build_object(
    'total_rows', job_row.total_rows,
    'valid_rows', valid_count,
    'error_rows', error_count,
    'warning_rows', warning_count,
    'can_provision', error_count = 0
  );
end;
$$;

create or replace function private.verify_cause_hypothesis(
  target_hypothesis_id uuid,
  target_verification_rationale text
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis verification is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id
  for update;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_verify_cause_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'verify_cause permission is required'
      using errcode = '42501';
  end if;

  if hypothesis_row.status = 'proposed' then
    raise exception 'proposed hypotheses cannot be directly verified; advance to testing or supported first'
      using errcode = '55000';
  end if;

  if hypothesis_row.status not in ('testing', 'supported') then
    raise exception 'hypothesis is not in a verifiable state'
      using errcode = '55000';
  end if;

  if target_verification_rationale is null
    or btrim(target_verification_rationale) = '' then
    raise exception 'verification_rationale is required'
      using errcode = '22023';
  end if;

  if not private.hypothesis_has_verification_basis(
    org_id,
    target_hypothesis_id,
    target_verification_rationale
  ) then
    raise exception 'verification requires a completed test with supports conclusion or hypothesis evidence with verification rationale'
      using errcode = '55000';
  end if;

  update public.problem_solving_hypotheses h
  set status                  = 'verified',
      verified_by_membership_id = actor_membership_id,
      verified_at             = statement_timestamp(),
      verification_rationale  = btrim(target_verification_rationale),
      updated_at              = statement_timestamp()
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  perform private.append_hypothesis_status_history(
    org_id, target_hypothesis_id,
    hypothesis_row.status, 'verified',
    actor_membership_id, target_verification_rationale
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.verified',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from_status', hypothesis_row.status,
      'rationale', target_verification_rationale
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisVerified',
    target_hypothesis_id::text,
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

create or replace function private.verify_current_condition_item(
  target_item_id uuid,
  target_verification_rationale text default null
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
  item_row public.problem_solving_current_condition_items%rowtype;
  case_row public.problem_solving_cases%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'verification is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select item_table.*
  into item_row
  from public.problem_solving_current_condition_items item_table
  where item_table.organisation_id = org_id
    and item_table.id = target_item_id
  for update;

  if not found then
    raise exception 'current condition item not found'
      using errcode = 'P0002';
  end if;

  if item_row.status <> 'active' then
    raise exception 'only active items can be verified'
      using errcode = '55000';
  end if;

  if item_row.verified_at is not null then
    raise exception 'item is already verified'
      using errcode = '55000';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = item_row.case_id;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.verify_cause', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.verify_cause', null, case_row.organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
  ) then
    raise exception 'verification is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_current_condition_items
  set verified_by_membership_id = actor_membership_id,
      verified_at = statement_timestamp(),
      verification_rationale = target_verification_rationale
  where organisation_id = org_id
    and id = target_item_id;

  return true;
end;
$$;

create or replace function private.withdraw_benefit(
  target_benefit_id uuid,
  target_reason text default null
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
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit withdraw is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('benefits');

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status not in ('draft', 'submitted') then
    raise exception 'benefit cannot be withdrawn'
      using errcode = '55000';
  end if;

  if benefit_row.owner_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit withdraw is not authorised'
      using errcode = '42501';
  end if;

  if benefit_row.status = 'submitted' then
    update public.benefit_validation_assignments assignment_table
    set status = 'completed',
        completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.benefit_id = target_benefit_id
      and assignment_table.status = 'active';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'withdrawn',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    benefit_row.status,
    'withdrawn',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'benefit.withdrawn',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitWithdrawn',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;
