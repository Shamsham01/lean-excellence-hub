-- BILLING-06: Extended Professional module mutation gates (review only).

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

  if case_row.method_version_id is not null then
    raise exception 'case already has a pinned method version'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'case activation is not authorised'
      using errcode = '42501';
  end if;

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

  if case_row.status = 'draft' then
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
  end if;

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

  perform private.assert_current_organisation_module_entitled('people_hr');
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
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  if target_original_filename is null
    or btrim(target_original_filename) = ''
    or char_length(btrim(target_original_filename)) > 255 then
    raise exception 'original filename is invalid'
      using errcode = '22023';
  end if;

  perform private.assert_current_organisation_module_entitled('people_hr');
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