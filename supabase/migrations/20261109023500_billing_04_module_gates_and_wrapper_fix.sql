-- BILLING-04: Module entitlement helpers + public capability wrapper (mutations in billing_40000).

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
