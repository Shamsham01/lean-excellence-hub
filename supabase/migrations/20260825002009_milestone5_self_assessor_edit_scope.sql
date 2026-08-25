-- Self-scoped assessors must edit and complete assessments they can start.

create or replace function private.can_edit_maturity_assessment(
  target_organisation_id uuid,
  target_assessment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  assessment_row public.maturity_assessments%rowtype;
  permission_key text;
  actor_membership_id uuid := private.current_membership_id(target_organisation_id);
begin
  select assessment_item.*
  into assessment_row
  from public.maturity_assessments assessment_item
  where assessment_item.organisation_id = target_organisation_id
    and assessment_item.id = target_assessment_id;

  if not found then
    return false;
  end if;

  if assessment_row.status not in ('draft', 'in_progress') then
    return false;
  end if;

  permission_key := case assessment_row.assessment_type
    when 'self' then 'maturity.assess.self'
    else 'maturity.assess.formal'
  end;

  return private.has_scoped_permission(
    target_organisation_id,
    permission_key,
    null,
    assessment_row.unit_id
  )
  or private.has_scoped_permission(
    target_organisation_id,
    permission_key,
    assessment_row.created_by_membership_id,
    null
  )
  or (
    actor_membership_id is not null
    and private.has_scoped_permission(
      target_organisation_id,
      permission_key,
      actor_membership_id,
      null
    )
  )
  or (
    assessment_row.lead_assessor_membership_id is not null
    and private.has_scoped_permission(
      target_organisation_id,
      permission_key,
      assessment_row.lead_assessor_membership_id,
      null
    )
  );
end;
$$;
