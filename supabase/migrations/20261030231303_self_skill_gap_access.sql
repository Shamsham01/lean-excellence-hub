-- Self profiles must also authorise the nested gap calculation when skills exist.
-- Self-only access uses the current published requirements. Explicit versions
-- (including drafts) and other members retain the existing capability gate.
-- No role definitions, grants, assessments or membership records are changed.

create or replace function private.derive_skill_gap(
  target_membership_id uuid,
  target_skill_id uuid,
  target_capability_set_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  capability_version_id uuid;
  requirement_row public.skill_requirements%rowtype;
  current_assessment public.membership_skill_assessments%rowtype;
  current_order integer;
  target_order integer;
begin
  if org_id is null
    or not exists (
      select 1 from public.organisation_memberships membership_row
      where membership_row.organisation_id = org_id
        and membership_row.id = target_membership_id
        and membership_row.status = 'active'
    ) then
    raise exception 'skill gap derivation is not authorised'
      using errcode = '42501';
  end if;

  if not coalesce(
    private.can_read_membership_capability_profile(org_id, target_membership_id)
    or (
      private.is_current_active_membership(org_id, target_membership_id)
      and target_capability_set_version_id is null
    ),
    false
  ) then
    raise exception 'skill gap derivation is not authorised'
      using errcode = '42501';
  end if;

  if target_capability_set_version_id is not null then
    capability_version_id := target_capability_set_version_id;
  else
    select version_row.id
    into capability_version_id
    from public.skill_capability_set_versions version_row
    join public.skill_capability_sets set_row
      on set_row.organisation_id = version_row.organisation_id
     and set_row.id = version_row.capability_set_id
    where version_row.organisation_id = org_id
      and version_row.status = 'published'
      and set_row.status = 'active'
    order by version_row.published_at desc nulls last
    limit 1;
  end if;

  if capability_version_id is null then
    return jsonb_build_object('status', 'not_required');
  end if;

  select requirement_registry.*
  into requirement_row
  from public.skill_requirements requirement_registry
  left join public.membership_job_function_assignments assignment_row
    on assignment_row.organisation_id = org_id
   and assignment_row.membership_id = target_membership_id
   and assignment_row.is_primary = true
   and assignment_row.valid_from <= statement_timestamp()
   and (
     assignment_row.valid_to is null
     or assignment_row.valid_to > statement_timestamp()
   )
  where requirement_registry.organisation_id = org_id
    and requirement_registry.capability_set_version_id = capability_version_id
    and requirement_registry.skill_id = target_skill_id
    and requirement_registry.job_function_id = assignment_row.job_function_id
  limit 1;

  if not found then
    return jsonb_build_object('status', 'not_required');
  end if;

  current_assessment := private.get_current_authoritative_skill_assessment(
    org_id,
    target_membership_id,
    target_skill_id
  );

  select level_row.order_value
  into target_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.id = requirement_row.target_proficiency_level_id;

  if current_assessment.id is null then
    return jsonb_build_object(
      'status', 'not_assessed',
      'target_order', target_order,
      'target_scale_version_id', requirement_row.proficiency_scale_version_id
    );
  end if;

  if current_assessment.proficiency_scale_version_id
    <> requirement_row.proficiency_scale_version_id then
    return jsonb_build_object(
      'status', 'incompatible_scale',
      'target_scale_version_id', requirement_row.proficiency_scale_version_id,
      'assessment_scale_version_id', current_assessment.proficiency_scale_version_id
    );
  end if;

  select level_row.order_value
  into current_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.id = current_assessment.proficiency_level_id;

  return jsonb_build_object(
    'status',
      case
        when current_order < target_order then 'below_requirement'
        when current_order = target_order then 'meets_requirement'
        else 'above_requirement'
      end,
    'current_order', current_order,
    'target_order', target_order,
    'gap', greatest(target_order - current_order, 0),
    'scale_version_id', requirement_row.proficiency_scale_version_id,
    'current_assessment_id', current_assessment.id
  );
end;
$$;

-- This immutable projection uses only built-ins; pin resolution explicitly.
alter function private.workplace_feed_item(uuid, text, text, text, text, timestamptz)
  set search_path = '';
