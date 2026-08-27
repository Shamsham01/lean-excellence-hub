-- Milestone 11: problem solving access helpers, resource access extension, attachment upload scope.

-- Full can_read_problem_solving_case: org/unit_subtree/self via owner/facilitator/participant

create or replace function private.can_read_problem_solving_case(
  target_organisation_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.problem_solving_cases ps_case
    where ps_case.organisation_id = target_organisation_id
      and ps_case.id = target_case_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.view',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.view',
          null,
          ps_case.organisation_unit_id
        )
        or ps_case.owner_membership_id = private.current_membership_id(target_organisation_id)
        or ps_case.facilitator_membership_id = private.current_membership_id(target_organisation_id)
        or exists (
          select 1
          from public.problem_solving_participants pp
          where pp.organisation_id = target_organisation_id
            and pp.case_id = target_case_id
            and pp.membership_id = private.current_membership_id(target_organisation_id)
            and pp.removed_at is null
        )
      )
  )
$$;

-- can_contribute: owner, facilitator, participants, or unit-scoped contribute permission

create or replace function private.can_contribute_problem_solving_case(
  target_organisation_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.problem_solving_cases ps_case
    where ps_case.organisation_id = target_organisation_id
      and ps_case.id = target_case_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.contribute',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.contribute',
          null,
          ps_case.organisation_unit_id
        )
        or ps_case.owner_membership_id = private.current_membership_id(target_organisation_id)
        or ps_case.facilitator_membership_id = private.current_membership_id(target_organisation_id)
        or exists (
          select 1
          from public.problem_solving_participants pp
          where pp.organisation_id = target_organisation_id
            and pp.case_id = target_case_id
            and pp.membership_id = private.current_membership_id(target_organisation_id)
            and pp.removed_at is null
        )
      )
  )
$$;

-- can_manage: org-wide or unit-scoped manage permission, or owner

create or replace function private.can_manage_problem_solving_case(
  target_organisation_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.problem_solving_cases ps_case
    where ps_case.organisation_id = target_organisation_id
      and ps_case.id = target_case_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.manage',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.manage',
          null,
          ps_case.organisation_unit_id
        )
        or ps_case.owner_membership_id = private.current_membership_id(target_organisation_id)
      )
  )
$$;

-- can_verify_cause: org-wide or unit-scoped verify permission

create or replace function private.can_verify_cause_problem_solving_case(
  target_organisation_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.problem_solving_cases ps_case
    where ps_case.organisation_id = target_organisation_id
      and ps_case.id = target_case_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.verify_cause',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.verify_cause',
          null,
          ps_case.organisation_unit_id
        )
      )
  )
$$;

-- can_close: delegated to can_manage

create or replace function private.can_close_problem_solving_case(
  target_organisation_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_problem_solving_case(
    target_organisation_id,
    target_case_id
  )
$$;

-- verify_cause_hypothesis: honour unit-scoped verify_cause grants

create or replace function private.verify_cause_hypothesis(
  target_hypothesis_id uuid,
  target_verification_rationale text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis verification is not authorised'
      using errcode = '42501';
  end if;

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id
  for update;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_verify_cause_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'verify_cause permission is required'
      using errcode = '42501';
  end if;

  if hypothesis_row.status = 'proposed' then
    raise exception 'proposed hypotheses cannot be directly verified; advance to testing or supported first'
      using errcode = '55000';
  end if;

  if hypothesis_row.status not in ('testing', 'supported') then
    raise exception 'hypothesis is not in a verifiable state'
      using errcode = '55000';
  end if;

  if target_verification_rationale is null
    or btrim(target_verification_rationale) = '' then
    raise exception 'verification_rationale is required'
      using errcode = '22023';
  end if;

  if not private.hypothesis_has_verification_basis(
    org_id,
    target_hypothesis_id,
    target_verification_rationale
  ) then
    raise exception 'verification requires a completed test with supports conclusion or hypothesis evidence with verification rationale'
      using errcode = '55000';
  end if;

  update public.problem_solving_hypotheses h
  set status                  = 'verified',
      verified_by_membership_id = actor_membership_id,
      verified_at             = statement_timestamp(),
      verification_rationale  = btrim(target_verification_rationale),
      updated_at              = statement_timestamp()
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  perform private.append_hypothesis_status_history(
    org_id, target_hypothesis_id,
    hypothesis_row.status, 'verified',
    actor_membership_id, target_verification_rationale
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.verified',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from_status', hypothesis_row.status,
      'rationale', target_verification_rationale
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisVerified',
    target_hypothesis_id::text,
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

-- Extend can_access_resource for problem_solving_case

create or replace function private.can_access_resource(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_row public.resource_records%rowtype;
begin
  select resource_registry.*
  into resource_row
  from public.resource_records resource_registry
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_resource_id
    and resource_registry.retired_at is null;

  if not found then
    return false;
  end if;

  case resource_row.resource_type
    when 'action' then
      return private.can_read_action(target_organisation_id, target_resource_id);
    when 'template' then
      return private.has_scoped_permission(
        target_organisation_id,
        'templates.read',
        null,
        null
      );
    when 'template_submission' then
      return private.can_read_template_submission(
        target_organisation_id,
        target_resource_id
      );
    when 'attachment' then
      return private.can_access_attachment_target(
        target_organisation_id,
        target_resource_id
      );
    when 'comment' then
      return private.can_access_comment_target(
        target_organisation_id,
        target_resource_id
      );
    when 'maturity_model' then
      return private.can_read_maturity_catalog(target_organisation_id);
    when 'maturity_assessment' then
      return private.can_read_maturity_assessment(
        target_organisation_id,
        target_resource_id
      );
    when 'schedule_definition' then
      return private.can_read_schedule_definition(
        target_organisation_id,
        target_resource_id
      );
    when 'five_s_standard' then
      return private.can_read_five_s_catalog(target_organisation_id);
    when 'five_s_audit' then
      return private.can_read_five_s_audit(
        target_organisation_id,
        target_resource_id
      );
    when 'gemba_definition' then
      return private.can_read_gemba_catalog(target_organisation_id);
    when 'gemba_walk' then
      return private.can_read_gemba_walk(
        target_organisation_id,
        target_resource_id
      );
    when 'training_course' then
      return private.can_read_training_catalog(target_organisation_id);
    when 'training_session' then
      return private.can_read_training_session(
        target_organisation_id,
        target_resource_id
      );
    when 'training_completion' then
      return private.can_read_training_completion(
        target_organisation_id,
        target_resource_id
      );
    when 'skill' then
      return private.can_read_skills_catalog(target_organisation_id);
    when 'skill_assessment' then
      return private.can_read_skill_assessment(
        target_organisation_id,
        target_resource_id
      );
    when 'ci_project' then
      return private.can_read_ci_project(
        target_organisation_id,
        target_resource_id
      );
    when 'improvement_suggestion' then
      return private.can_read_improvement_suggestion(
        target_organisation_id,
        target_resource_id
      );
    when 'recognition_award' then
      return private.can_read_recognition_award(
        target_organisation_id,
        target_resource_id
      );
    when 'improvement_benefit' then
      return private.can_read_improvement_benefit(
        target_organisation_id,
        target_resource_id
      );
    when 'benefit_realisation_entry' then
      return private.can_read_benefit_realisation_entry(
        target_organisation_id,
        target_resource_id
      );
    when 'problem_solving_case' then
      return private.can_read_problem_solving_case(
        target_organisation_id,
        target_resource_id
      );
    else
      return false;
  end case;
end;
$$;

-- Extend resolve_attachment_target_unit_id for PS case

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

-- Evidence link authorization for problem solving

create or replace function private.can_link_problem_solving_evidence(
  target_organisation_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.problem_solving_cases ps_case
    where ps_case.organisation_id = target_organisation_id
      and ps_case.id = target_case_id
      and ps_case.status in ('draft', 'active')
      and (
        private.can_contribute_problem_solving_case(
          target_organisation_id,
          target_case_id
        )
        or private.can_manage_problem_solving_case(
          target_organisation_id,
          target_case_id
        )
      )
  )
$$;

-- Ownership and grants

alter function private.can_read_problem_solving_case(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_contribute_problem_solving_case(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_manage_problem_solving_case(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_verify_cause_problem_solving_case(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_close_problem_solving_case(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_link_problem_solving_evidence(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_access_resource(uuid, uuid) owner to lean_hub_private_owner;
alter function private.resolve_attachment_target_unit_id(uuid, uuid) owner to lean_hub_private_owner;

revoke all on function private.can_read_problem_solving_case(uuid, uuid) from public;
revoke all on function private.can_contribute_problem_solving_case(uuid, uuid) from public;
revoke all on function private.can_manage_problem_solving_case(uuid, uuid) from public;
revoke all on function private.can_verify_cause_problem_solving_case(uuid, uuid) from public;
revoke all on function private.can_close_problem_solving_case(uuid, uuid) from public;
revoke all on function private.can_link_problem_solving_evidence(uuid, uuid) from public;

grant execute on function private.can_read_problem_solving_case(uuid, uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.can_contribute_problem_solving_case(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.can_manage_problem_solving_case(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.can_verify_cause_problem_solving_case(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.can_close_problem_solving_case(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.can_link_problem_solving_evidence(uuid, uuid) to lean_hub_private_owner;
