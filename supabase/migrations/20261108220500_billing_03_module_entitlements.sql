-- BILLING-03: Founder-approved module entitlement matrix (Nov 2026).
-- Supersedes plan-level finance/analytics-only gates with per-module keys.

create or replace function private.organisation_plan_capability(
  target_organisation_id uuid,
  target_capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sub public.organisation_subscriptions%rowtype;
begin
  if target_capability not like 'module\_%' escape '\'
    and target_capability not in (
      'advanced_benefits_governance',
      'advanced_analytics',
      'api_access',
      'integrations'
    ) then
    return false;
  end if;

  select *
  into sub
  from public.organisation_subscriptions subscription
  where subscription.organisation_id = target_organisation_id;

  if sub.id is null or sub.plan_code is null then
    return true;
  end if;

  if not private.billing_state_is_operational(
    sub.billing_state,
    sub.grace_expires_at
  ) then
    return false;
  end if;

  return private.plan_code_grants_capability(sub.plan_code, target_capability);
end;
$$;

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
      'advanced_analytics',
      'api_access',
      'integrations'
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

create or replace function public.current_organisation_plan_module_entitled(
  target_module text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_organisation_plan_capability(
    'module_' || target_module
  )
$$;

revoke all on function public.current_organisation_plan_module_entitled(text)
  from public, anon, service_role;
grant execute on function public.current_organisation_plan_module_entitled(text)
  to authenticated;

-- Benefits workflows require module_benefits (Professional+), not a separate finance SKU gate.
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

revoke all on function private.record_benefit_validation(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.record_benefit_validation(uuid, text, text, text)
  to lean_hub_private_owner;
