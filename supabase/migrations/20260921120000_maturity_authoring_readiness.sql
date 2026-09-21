-- Issue #71: enforce per-criterion publish readiness and keep pillar-local question ordering contract.

create or replace function private.publish_maturity_model_version(
  target_model_version_id uuid
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
  target_model_id uuid;
  template_version_id uuid;
  scored_link record;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model publication is not authorised'
      using errcode = '42501';
  end if;

  select model_version.model_id, model_version.template_version_id
  into target_model_id, template_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'draft'
  for update;

  if not found then
    raise exception 'maturity model version is not publishable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_levels level_row
    where level_row.organisation_id = org_id
      and level_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one level'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_pillars pillar_row
    where pillar_row.organisation_id = org_id
      and pillar_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one pillar'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_model_version_assessment_scopes scope_row
    where scope_row.organisation_id = org_id
      and scope_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one assessment scope'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_criteria criterion_row
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
    where criterion_row.organisation_id = org_id
      and pillar_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one criterion'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.maturity_criteria criterion_row
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
    where criterion_row.organisation_id = org_id
      and pillar_row.model_version_id = target_model_version_id
      and not exists (
        select 1
        from public.maturity_criterion_questions question_link
        join public.template_questions question_row
          on question_row.organisation_id = question_link.organisation_id
         and question_row.id = question_link.question_id
        where question_link.organisation_id = org_id
          and question_link.criterion_id = criterion_row.id
          and question_link.contributes_to_score = true
          and btrim(question_row.prompt) <> ''
      )
  ) then
    raise exception 'maturity model version requires a scored question for every criterion'
      using errcode = '55000';
  end if;

  for scored_link in
    select
      question_link.scoring_metadata,
      question_row.question_type
    from public.maturity_criterion_questions question_link
    join public.maturity_criteria criterion_row
      on criterion_row.organisation_id = question_link.organisation_id
     and criterion_row.id = question_link.criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
     and pillar_row.model_version_id = target_model_version_id
    join public.template_questions question_row
      on question_row.organisation_id = question_link.organisation_id
     and question_row.id = question_link.question_id
    where question_link.organisation_id = org_id
      and question_link.contributes_to_score = true
  loop
    if not private.validate_scored_question_metadata(
      scored_link.question_type,
      scored_link.scoring_metadata
    ) then
      raise exception 'scored question has invalid scoring metadata'
        using errcode = '55000';
    end if;
  end loop;

  update public.maturity_model_versions prior_version
  set status = 'archived',
      archived_at = statement_timestamp()
  where prior_version.organisation_id = org_id
    and prior_version.model_id = target_model_id
    and prior_version.status = 'published'
    and prior_version.id <> target_model_version_id;

  update public.maturity_model_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_model_version_id;

  perform private.publish_template_version_internal(
    template_version_id,
    org_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.model.published',
    target_model_id,
    'succeeded',
    jsonb_build_object('model_version_id', target_model_version_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_model_id,
    'MaturityModelPublished',
    target_model_version_id::text,
    jsonb_build_object('model_version_id', target_model_version_id)
  );

  return true;
end;
$$;

alter function private.publish_maturity_model_version(uuid)
  owner to lean_hub_private_owner;
