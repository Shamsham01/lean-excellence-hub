-- Milestone 10: explicit benefit validator selection (supersedes silent resolver behaviour in 07012).

create or replace function private.benefit_validator_display_name(
  target_membership_id uuid,
  target_organisation_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(membership_row.display_name), ''),
    nullif(btrim(profile_row.display_name), ''),
    nullif(btrim(membership_row.job_title), ''),
    'Member'
  )
  from public.organisation_memberships membership_row
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where membership_row.organisation_id = target_organisation_id
    and membership_row.id = target_membership_id
$$;

create or replace function private.is_eligible_benefit_ci_validator(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_membership_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  benefit_unit_id uuid;
  membership_status text;
begin
  select benefit_row.organisational_unit_id
  into benefit_unit_id
  from public.improvement_benefits benefit_row
  where benefit_row.organisation_id = target_organisation_id
    and benefit_row.id = target_benefit_id;

  if benefit_unit_id is null then
    return false;
  end if;

  select membership_row.status
  into membership_status
  from public.organisation_memberships membership_row
  where membership_row.organisation_id = target_organisation_id
    and membership_row.id = target_membership_id;

  if membership_status is distinct from 'active' then
    return false;
  end if;

  return private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'benefits.validate.ci',
    null,
    benefit_unit_id
  );
end;
$$;

create or replace function private.is_eligible_benefit_finance_validator(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_membership_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  benefit_unit_id uuid;
  created_by_membership_id uuid;
  membership_status text;
begin
  select
    benefit_row.organisational_unit_id,
    benefit_row.created_by_membership_id
  into benefit_unit_id, created_by_membership_id
  from public.improvement_benefits benefit_row
  where benefit_row.organisation_id = target_organisation_id
    and benefit_row.id = target_benefit_id;

  if benefit_unit_id is null then
    return false;
  end if;

  if target_membership_id = created_by_membership_id then
    return false;
  end if;

  select membership_row.status
  into membership_status
  from public.organisation_memberships membership_row
  where membership_row.organisation_id = target_organisation_id
    and membership_row.id = target_membership_id;

  if membership_status is distinct from 'active' then
    return false;
  end if;

  return private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'benefits.validate.finance',
    null,
    benefit_unit_id
  );
end;
$$;

create or replace function private.assert_benefit_ci_validator_eligible(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_membership_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_membership_id is null then
    raise exception 'CI validator selection is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = target_organisation_id
      and membership_row.id = target_membership_id
  ) then
    raise exception 'CI validator is not eligible for this benefit'
      using errcode = '42501';
  end if;

  if not private.is_eligible_benefit_ci_validator(
    target_organisation_id,
    target_benefit_id,
    target_membership_id
  ) then
    raise exception 'CI validator is not eligible for this benefit'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.assert_benefit_finance_validator_eligible(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_membership_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_membership_id is null then
    raise exception 'financial benefit requires explicit finance validator selection'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = target_organisation_id
      and membership_row.id = target_membership_id
  ) then
    raise exception 'finance validator is not eligible for this benefit'
      using errcode = '42501';
  end if;

  if not private.is_eligible_benefit_finance_validator(
    target_organisation_id,
    target_benefit_id,
    target_membership_id
  ) then
    raise exception 'finance validator is not eligible for this benefit'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.get_eligible_benefit_validators(
  target_benefit_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  benefit_row public.improvement_benefits%rowtype;
  candidates jsonb := '[]'::jsonb;
  candidate_row record;
  ci_eligible_count integer := 0;
  finance_eligible_count integer := 0;
  default_ci_validator_membership_id uuid;
  default_finance_validator_membership_id uuid;
  can_validate_ci boolean;
  can_validate_finance boolean;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit validator eligibility is not authorised'
      using errcode = '42501';
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
    raise exception 'benefit validator eligibility is not authorised'
      using errcode = '42501';
  end if;

  for candidate_row in
    select membership_row.id as membership_id
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.status = 'active'
    order by private.benefit_validator_display_name(membership_row.id, org_id), membership_row.id
  loop
    can_validate_ci := private.is_eligible_benefit_ci_validator(
      org_id,
      target_benefit_id,
      candidate_row.membership_id
    );
    can_validate_finance := benefit_row.benefit_class = 'financial'
      and private.is_eligible_benefit_finance_validator(
        org_id,
        target_benefit_id,
        candidate_row.membership_id
      );

    if can_validate_ci or can_validate_finance then
      candidates := candidates || jsonb_build_array(
        jsonb_build_object(
          'membership_id', candidate_row.membership_id,
          'display_name', private.benefit_validator_display_name(candidate_row.membership_id, org_id),
          'can_validate_ci', can_validate_ci,
          'can_validate_finance', can_validate_finance
        )
      );

      if can_validate_ci then
        ci_eligible_count := ci_eligible_count + 1;
        default_ci_validator_membership_id := candidate_row.membership_id;
      end if;

      if can_validate_finance then
        finance_eligible_count := finance_eligible_count + 1;
        default_finance_validator_membership_id := candidate_row.membership_id;
      end if;
    end if;
  end loop;

  if ci_eligible_count <> 1 then
    default_ci_validator_membership_id := null;
  end if;

  if benefit_row.benefit_class = 'financial' then
    if finance_eligible_count <> 1 then
      default_finance_validator_membership_id := null;
    end if;
  else
    default_finance_validator_membership_id := null;
  end if;

  return jsonb_build_object(
    'benefit_class', benefit_row.benefit_class,
    'candidates', candidates,
    'default_ci_validator_membership_id', default_ci_validator_membership_id,
    'default_finance_validator_membership_id', default_finance_validator_membership_id,
    'requires_explicit_ci_selection', ci_eligible_count <> 1,
    'requires_explicit_finance_selection',
      case
        when benefit_row.benefit_class = 'financial' then finance_eligible_count <> 1
        else false
      end
  );
end;
$$;

create or replace function public.get_eligible_benefit_validators(target_benefit_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select private.get_eligible_benefit_validators(target_benefit_id) $$;

grant execute on function public.get_eligible_benefit_validators(uuid) to authenticated;
revoke all on function public.get_eligible_benefit_validators(uuid) from public, anon;

create or replace function private.resolve_benefit_submit_validators(
  target_benefit_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  eligibility_payload jsonb;
begin
  eligibility_payload := private.get_eligible_benefit_validators(target_benefit_id);

  return jsonb_build_object(
    'ci_validator_membership_id', eligibility_payload->>'default_ci_validator_membership_id',
    'finance_validator_membership_id', eligibility_payload->>'default_finance_validator_membership_id',
    'candidates', eligibility_payload->'candidates',
    'requires_explicit_ci_selection', eligibility_payload->'requires_explicit_ci_selection',
    'requires_explicit_finance_selection', eligibility_payload->'requires_explicit_finance_selection'
  );
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

alter function private.benefit_validator_display_name(uuid, uuid) owner to lean_hub_private_owner;
alter function private.is_eligible_benefit_ci_validator(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.is_eligible_benefit_finance_validator(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_benefit_ci_validator_eligible(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_benefit_finance_validator_eligible(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.get_eligible_benefit_validators(uuid) owner to lean_hub_private_owner;
alter function private.resolve_benefit_submit_validators(uuid) owner to lean_hub_private_owner;
alter function private.submit_benefit(uuid, uuid, uuid) owner to lean_hub_private_owner;
