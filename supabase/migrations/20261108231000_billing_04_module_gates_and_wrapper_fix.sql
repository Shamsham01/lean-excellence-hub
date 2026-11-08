-- BILLING-04: Fix public module entitlement wrapper; central module assert helper;
-- align api_access/integrations with TS catalogue (unshipped); initial RPC gates.

-- ---------------------------------------------------------------------------
-- Capability matrix: api_access / integrations off until product ships them.
-- ---------------------------------------------------------------------------

create or replace function private.plan_code_grants_capability(
  target_plan_code text,
  target_capability text
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select case
  when target_capability in ('api_access', 'integrations') then false
    when target_capability like 'module\_%' escape '\' then
      case
        when target_plan_code is null then true
        when target_plan_code in ('professional', 'founder', 'enterprise') then true
        when target_plan_code = 'essentials' then target_capability in (
          'module_maturity',
          'module_five_s',
          'module_gemba',
          'module_actions',
          'module_suggestions',
          'module_schedule',
          'module_templates'
        )
        else false
      end
    when target_capability in (
      'advanced_benefits_governance',
      'advanced_analytics'
    ) then
      case
        when target_plan_code is null then true
        when target_plan_code = 'essentials' then target_capability in (
          'advanced_benefits_governance',
          'advanced_analytics'
        )
        when target_plan_code in ('professional', 'founder', 'enterprise') then true
        else false
      end
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- Module entitlement helpers (PlanModuleCode slug without module_ prefix)
-- ---------------------------------------------------------------------------

create or replace function private.assert_current_organisation_module_entitled(
  target_module text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_module is null
    or btrim(target_module) = ''
    or target_module !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'invalid module entitlement key'
      using errcode = '22023';
  end if;

  if not private.current_organisation_plan_capability(
    'module_' || btrim(target_module)
  ) then
    raise exception 'module is not entitled on this plan'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.assert_ai_session_module_entitled(
  target_context_type text,
  target_module_key text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mapped_module text;
begin
  if target_context_type = 'problem_solving' then
    perform private.assert_current_organisation_module_entitled('problem_solving');
    return;
  end if;

  if target_context_type <> 'coach' then
    raise exception 'ai session context is not authorised'
      using errcode = '42501';
  end if;

  mapped_module := case target_module_key
    when 'training' then 'training'
    when 'skills' then 'skills'
    when 'recognition' then 'recognition'
    when 'problem_solving' then 'problem_solving'
    when 'people' then 'people_hr'
    when 'maturity' then 'maturity'
    when 'five_s' then 'five_s'
    when 'gemba' then 'gemba'
    when 'suggestions' then 'suggestions'
    else null
  end;

  if mapped_module is null then
    return;
  end if;

  perform private.assert_current_organisation_module_entitled(mapped_module);
end;
$$;

revoke all on function private.assert_current_organisation_module_entitled(text)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_ai_session_module_entitled(text, text)
  from public, anon, authenticated, service_role;

grant execute on function private.assert_current_organisation_module_entitled(text)
  to lean_hub_private_owner;
grant execute on function private.assert_ai_session_module_entitled(text, text)
  to lean_hub_private_owner;

alter function private.assert_current_organisation_module_entitled(text)
  owner to lean_hub_private_owner;
alter function private.assert_ai_session_module_entitled(text, text)
  owner to lean_hub_private_owner;

create or replace function public.current_organisation_plan_module_entitled(
  target_module text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_organisation_plan_capability(
    'module_' || btrim(target_module)
  )
$$;

revoke all on function public.current_organisation_plan_module_entitled(text)
  from public, anon, service_role;
grant execute on function public.current_organisation_plan_module_entitled(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- High-bypass mutations: plan module + existing RBAC
-- ---------------------------------------------------------------------------

create or replace function private.create_improvement_project_from_suggestion(
  target_suggestion_id uuid
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
  new_project_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project creation from suggestion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;

  if suggestion_row.status not in ('accepted', 'implementing') then
    raise exception 'suggestion is not eligible for project creation'
      using errcode = '55000';
  end if;

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'project creation from suggestion is not authorised'
      using errcode = '42501';
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
    organisation_id,
    suggestion_id,
    implementation_resource_id,
    implementation_role,
    created_by_membership_id
  )
  values (
    org_id,
    target_suggestion_id,
    new_project_id,
    'ci_project',
    actor_membership_id
  );

  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    'SuggestionProjectCreated',
    new_project_id::text,
    '{}'::jsonb
  );

  return new_project_id;
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

  perform private.assert_ai_session_module_entitled(
    session_row.context_type,
    session_row.module_key
  );

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

  perform private.ai_credit_try_reserve(
    new_run_id,
    btrim(target_idempotency_key),
    1
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

  return new_run_id;
end;
$$;
