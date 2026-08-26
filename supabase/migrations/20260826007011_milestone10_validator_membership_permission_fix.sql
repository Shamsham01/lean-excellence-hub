-- Milestone 10: validate assigned validator memberships using existing membership permission probe.

create or replace function private.create_benefit_validation_assignments(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_ci_validator_membership_id uuid,
  target_finance_validator_membership_id uuid,
  target_actor_membership_id uuid,
  target_benefit_class text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  benefit_unit_id uuid;
begin
  select benefit_row.organisational_unit_id
  into benefit_unit_id
  from public.improvement_benefits benefit_row
  where benefit_row.organisation_id = target_organisation_id
    and benefit_row.id = target_benefit_id;

  perform private.assert_benefit_validator_membership_active(
    target_organisation_id,
    target_ci_validator_membership_id
  );

  if not private.membership_has_scoped_permission(
    target_ci_validator_membership_id,
    target_organisation_id,
    'benefits.validate.ci',
    null,
    benefit_unit_id
  ) then
    raise exception 'CI validator lacks validation permission for benefit unit'
      using errcode = '42501';
  end if;

  insert into public.benefit_validation_assignments (
    organisation_id,
    benefit_id,
    validator_membership_id,
    validation_role,
    assigned_by_membership_id
  )
  values (
    target_organisation_id,
    target_benefit_id,
    target_ci_validator_membership_id,
    'ci',
    target_actor_membership_id
  );

  if target_benefit_class = 'financial' then
    if target_finance_validator_membership_id is null then
      raise exception 'financial benefit requires a finance validator'
        using errcode = '22023';
    end if;

    perform private.assert_benefit_validator_membership_active(
      target_organisation_id,
      target_finance_validator_membership_id
    );

    if not private.membership_has_scoped_permission(
      target_finance_validator_membership_id,
      target_organisation_id,
      'benefits.validate.finance',
      null,
      benefit_unit_id
    ) then
      raise exception 'finance validator lacks validation permission for benefit unit'
        using errcode = '42501';
    end if;

    insert into public.benefit_validation_assignments (
      organisation_id,
      benefit_id,
      validator_membership_id,
      validation_role,
      assigned_by_membership_id
    )
    values (
      target_organisation_id,
      target_benefit_id,
      target_finance_validator_membership_id,
      'finance',
      target_actor_membership_id
    );
  elsif target_finance_validator_membership_id is not null then
    raise exception 'non-financial benefits do not require finance validation'
      using errcode = '22023';
  end if;
end;
$$;

alter function private.create_benefit_validation_assignments(
  uuid, uuid, uuid, uuid, uuid, text
) owner to lean_hub_private_owner;
