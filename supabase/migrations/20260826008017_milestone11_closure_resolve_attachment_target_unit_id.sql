-- M11 closure: restore attachment unit resolution branches dropped in 08011
-- while preserving problem_solving_case support.

create or replace function private.resolve_attachment_target_unit_id(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select assessment_row.unit_id
      from public.resource_records resource_registry
      join public.maturity_assessments assessment_row
        on assessment_row.organisation_id = resource_registry.organisation_id
       and assessment_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'maturity_assessment'
        and resource_registry.retired_at is null
    ),
    (
      select audit_row.unit_id
      from public.resource_records resource_registry
      join public.five_s_audits audit_row
        on audit_row.organisation_id = resource_registry.organisation_id
       and audit_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'five_s_audit'
        and resource_registry.retired_at is null
    ),
    (
      select walk_row.unit_id
      from public.resource_records resource_registry
      join public.gemba_walks walk_row
        on walk_row.organisation_id = resource_registry.organisation_id
       and walk_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'gemba_walk'
        and resource_registry.retired_at is null
    ),
    (
      select session_row.organisational_unit_id
      from public.resource_records resource_registry
      join public.training_sessions session_row
        on session_row.organisation_id = resource_registry.organisation_id
       and session_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'training_session'
        and resource_registry.retired_at is null
    ),
    (
      select assessment_row.organisational_unit_id
      from public.resource_records resource_registry
      join public.membership_skill_assessments assessment_row
        on assessment_row.organisation_id = resource_registry.organisation_id
       and assessment_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'skill_assessment'
        and resource_registry.retired_at is null
    ),
    (
      select ps_case.organisation_unit_id
      from public.resource_records resource_registry
      join public.problem_solving_cases ps_case
        on ps_case.organisation_id = resource_registry.organisation_id
       and ps_case.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'problem_solving_case'
        and resource_registry.retired_at is null
    )
  )
$$;

alter function private.resolve_attachment_target_unit_id(uuid, uuid)
  owner to lean_hub_private_owner;
