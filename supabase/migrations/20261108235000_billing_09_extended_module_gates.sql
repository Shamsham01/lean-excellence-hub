-- BILLING-09: Further Professional module mutation gates.

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
create or replace function private.complete_project(
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
    raise exception 'project completion is not authorised'
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
    raise exception 'project is not completable'
      using errcode = '55000';
  end if;

  if not private.can_manage_ci_project_in_unit(org_id, project_row.unit_id) then
    raise exception 'project completion is not authorised'
      using errcode = '42501';
  end if;

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
    '{}'::jsonb
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
    target_organisational_unit_id,
    target_assessment_method,
    target_valid_until,
    target_notes,
    null
  );
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




