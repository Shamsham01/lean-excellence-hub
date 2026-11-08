-- BILLING-10: LeanAI session creation respects module entitlements.

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
      'case_id', target_problem_solving_case_id
    )
  );

  return new_session_id;
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
