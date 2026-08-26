-- Milestone 10: resolve submit validators without relying on membership directory visibility.

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
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  benefit_row public.improvement_benefits%rowtype;
  resolved_ci_validator_membership_id uuid;
  resolved_finance_validator_membership_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'benefit submit validator resolution is not authorised'
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
    raise exception 'benefit submit validator resolution is not authorised'
      using errcode = '42501';
  end if;

  if private.membership_has_scoped_permission(
    benefit_row.owner_membership_id,
    org_id,
    'benefits.validate.ci',
    null,
    benefit_row.organisational_unit_id
  ) then
    resolved_ci_validator_membership_id := benefit_row.owner_membership_id;
  else
    select membership_row.id
    into resolved_ci_validator_membership_id
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.status = 'active'
      and private.membership_has_scoped_permission(
        membership_row.id,
        org_id,
        'benefits.validate.ci',
        null,
        benefit_row.organisational_unit_id
      )
    order by coalesce(membership_row.display_name, membership_row.job_title, membership_row.id::text)
    limit 1;
  end if;

  if resolved_ci_validator_membership_id is null then
    raise exception 'no CI validator is available for this benefit'
      using errcode = '22023';
  end if;

  if benefit_row.benefit_class = 'financial' then
    select membership_row.id
    into resolved_finance_validator_membership_id
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.status = 'active'
      and membership_row.id <> benefit_row.created_by_membership_id
      and membership_row.id <> resolved_ci_validator_membership_id
      and private.membership_has_scoped_permission(
        membership_row.id,
        org_id,
        'benefits.validate.finance',
        null,
        benefit_row.organisational_unit_id
      )
    order by coalesce(membership_row.display_name, membership_row.job_title, membership_row.id::text)
    limit 1;

    if resolved_finance_validator_membership_id is null then
      raise exception 'no finance validator is available for this benefit'
        using errcode = '22023';
    end if;
  end if;

  return jsonb_build_object(
    'ci_validator_membership_id', resolved_ci_validator_membership_id,
    'finance_validator_membership_id', resolved_finance_validator_membership_id
  );
end;
$$;

create or replace function public.resolve_benefit_submit_validators(target_benefit_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select private.resolve_benefit_submit_validators(target_benefit_id) $$;

grant execute on function public.resolve_benefit_submit_validators(uuid) to authenticated;
revoke all on function public.resolve_benefit_submit_validators(uuid) from public, anon;

alter function private.resolve_benefit_submit_validators(uuid) owner to lean_hub_private_owner;
