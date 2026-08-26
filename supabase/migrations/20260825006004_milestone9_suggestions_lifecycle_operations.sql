-- Milestone 9: suggestion lifecycle operations and atomic review.

create or replace function private.append_suggestion_status_history(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_from_status text,
  target_to_status text,
  target_actor_membership_id uuid,
  target_reason text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  insert into public.suggestion_status_history (
    organisation_id,
    suggestion_id,
    from_status,
    to_status,
    changed_by_membership_id,
    reason
  ) values (
    target_organisation_id,
    target_suggestion_id,
    target_from_status,
    target_to_status,
    target_actor_membership_id,
    target_reason
  );
end;
$$;

create or replace function private.can_submit_suggestion_to_unit(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'suggestions.submit',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'suggestions.submit',
    null,
    target_unit_id
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'suggestions.submit',
    private.current_membership_id(target_organisation_id),
    null
  )
$$;

create or replace function private.can_review_suggestion(
  target_organisation_id uuid,
  target_jurisdiction_unit_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'suggestions.review',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'suggestions.review',
    null,
    target_jurisdiction_unit_id
  )
$$;

create or replace function private.create_suggestion_draft(
  target_programme_version_id uuid,
  target_category_id uuid,
  target_title text,
  target_problem_or_opportunity text,
  target_proposed_idea text,
  target_expected_benefit_summary text default null,
  target_target_unit_id uuid default null,
  target_template_submission_id uuid default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  origin_unit_id uuid;
  new_suggestion_id uuid;
  programme_version_row public.suggestion_programme_versions%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion draft creation is not authorised' using errcode = '42501';
  end if;

  origin_unit_id := private.membership_primary_organisational_unit_id(org_id, actor_membership_id);
  if origin_unit_id is null then
    raise exception 'author has no primary organisational unit' using errcode = '22023';
  end if;

  if not private.can_submit_suggestion_to_unit(org_id, origin_unit_id) then
    raise exception 'suggestion draft creation is not authorised' using errcode = '42501';
  end if;

  select version_table.*
  into programme_version_row
  from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_programme_version_id
    and version_table.lifecycle = 'published';

  if not found then
    raise exception 'programme version is not available for submission' using errcode = '22023';
  end if;

  if target_target_unit_id is not null
    and not private.can_submit_suggestion_to_unit(org_id, target_target_unit_id) then
    raise exception 'target unit is not within submit scope' using errcode = '42501';
  end if;

  new_suggestion_id := private.register_resource_record(
    org_id, 'improvement_suggestion', gen_random_uuid(), actor_membership_id
  );

  insert into public.improvement_suggestions (
    id, organisation_id, programme_version_id, title,
    problem_or_opportunity, proposed_idea, expected_benefit_summary,
    category_id, origin_unit_id, target_unit_id,
    review_jurisdiction_unit_id, author_membership_id,
    template_submission_id, status
  ) values (
    new_suggestion_id, org_id, target_programme_version_id, btrim(target_title),
    btrim(target_problem_or_opportunity), btrim(target_proposed_idea), target_expected_benefit_summary,
    target_category_id, origin_unit_id, target_target_unit_id,
    coalesce(target_target_unit_id, origin_unit_id), actor_membership_id,
    target_template_submission_id, 'draft'
  );

  perform private.append_suggestion_status_history(
    org_id, new_suggestion_id, 'draft', 'draft', actor_membership_id, 'created'
  );

  return new_suggestion_id;
end;
$$;

create or replace function private.update_suggestion_draft(
  target_suggestion_id uuid,
  target_title text,
  target_problem_or_opportunity text,
  target_proposed_idea text,
  target_expected_benefit_summary text default null,
  target_category_id uuid default null,
  target_target_unit_id uuid default null,
  target_template_submission_id uuid default null
)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion update is not authorised' using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found or suggestion_row.status <> 'draft' then
    raise exception 'suggestion is not editable' using errcode = '55000';
  end if;

  if suggestion_row.author_membership_id <> actor_membership_id
    and not private.has_scoped_permission(org_id, 'suggestions.manage', null, suggestion_row.origin_unit_id) then
    raise exception 'suggestion update is not authorised' using errcode = '42501';
  end if;

  if target_target_unit_id is not null
    and not private.can_submit_suggestion_to_unit(org_id, target_target_unit_id) then
    raise exception 'target unit is not within submit scope' using errcode = '42501';
  end if;

  update public.improvement_suggestions suggestion_table
  set title = btrim(target_title),
      problem_or_opportunity = btrim(target_problem_or_opportunity),
      proposed_idea = btrim(target_proposed_idea),
      expected_benefit_summary = target_expected_benefit_summary,
      category_id = coalesce(target_category_id, suggestion_row.category_id),
      target_unit_id = target_target_unit_id,
      review_jurisdiction_unit_id = coalesce(target_target_unit_id, suggestion_row.origin_unit_id),
      template_submission_id = target_template_submission_id,
      updated_at = statement_timestamp()
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  return true;
end;
$$;

create or replace function private.submit_suggestion(target_suggestion_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  programme_row public.suggestion_programmes%rowtype;
  category_row public.suggestion_categories%rowtype;
  origin_unit_row public.organisation_units%rowtype;
  target_unit_row public.organisation_units%rowtype;
  programme_version_row public.suggestion_programme_versions%rowtype;
  submission_version_id uuid;
  allocated_suggestion_number text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found or suggestion_row.status <> 'draft' then
    raise exception 'suggestion is not submittable' using errcode = '55000';
  end if;

  if suggestion_row.author_membership_id <> actor_membership_id then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  if not private.can_submit_suggestion_to_unit(org_id, suggestion_row.origin_unit_id) then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  select version_table.*
  into programme_version_row
  from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = suggestion_row.programme_version_id
    and version_table.lifecycle = 'published';

  if not found then
    raise exception 'programme version is not published' using errcode = '22023';
  end if;

  select programme_table.* into programme_row
  from public.suggestion_programmes programme_table
  where programme_table.organisation_id = org_id
    and programme_table.id = programme_version_row.programme_id;

  select category_table.* into category_row
  from public.suggestion_categories category_table
  where category_table.organisation_id = org_id
    and category_table.id = suggestion_row.category_id;

  select unit_table.* into origin_unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = suggestion_row.origin_unit_id;

  if suggestion_row.target_unit_id is not null then
    select unit_table.* into target_unit_row
    from public.organisation_units unit_table
    where unit_table.organisation_id = org_id
      and unit_table.id = suggestion_row.target_unit_id;
  end if;

  if programme_version_row.template_version_id is not null then
    if suggestion_row.template_submission_id is null then
      raise exception 'template submission is required' using errcode = '22023';
    end if;

    select submission_table.template_version_id
    into submission_version_id
    from public.template_submissions submission_table
    where submission_table.organisation_id = org_id
      and submission_table.id = suggestion_row.template_submission_id;

    if submission_version_id is distinct from programme_version_row.template_version_id then
      raise exception 'template submission does not match programme template version' using errcode = '22023';
    end if;

    perform private.complete_template_submission(suggestion_row.template_submission_id);
  end if;

  allocated_suggestion_number := private.allocate_organisation_document_number(
    org_id, 'improvement_suggestion', 'IDEA'
  );

  update public.improvement_suggestions suggestion_table
  set status = 'submitted',
      suggestion_number = allocated_suggestion_number,
      programme_name_snapshot = programme_row.name,
      programme_code_snapshot = programme_row.code,
      category_name_snapshot = category_row.name,
      category_code_snapshot = category_row.code,
      origin_unit_name_snapshot = origin_unit_row.name,
      origin_unit_code_snapshot = origin_unit_row.code,
      target_unit_name_snapshot = target_unit_row.name,
      target_unit_code_snapshot = target_unit_row.code,
      review_jurisdiction_unit_id = coalesce(suggestion_row.target_unit_id, suggestion_row.origin_unit_id),
      submitted_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  perform private.append_suggestion_status_history(
    org_id, target_suggestion_id, 'draft', 'submitted', actor_membership_id, 'submitted'
  );

  perform private.append_business_audit(org_id, 'suggestion.submitted', target_suggestion_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionSubmitted', target_suggestion_id::text, '{}'::jsonb);

  return true;
end;
$$;

create or replace function private.begin_suggestion_review(target_suggestion_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'review start is not authorised' using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found or suggestion_row.status <> 'submitted' then
    raise exception 'suggestion is not reviewable' using errcode = '55000';
  end if;

  if not private.can_review_suggestion(org_id, suggestion_row.review_jurisdiction_unit_id) then
    raise exception 'review start is not authorised' using errcode = '42501';
  end if;

  update public.improvement_suggestions suggestion_table
  set status = 'under_review', updated_at = statement_timestamp()
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  perform private.append_suggestion_status_history(
    org_id, target_suggestion_id, 'submitted', 'under_review', actor_membership_id, 'review started'
  );

  perform private.append_business_audit(org_id, 'suggestion.review_started', target_suggestion_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionReviewStarted', target_suggestion_id::text, '{}'::jsonb);

  return true;
end;
$$;

create or replace function private.record_suggestion_review(
  target_suggestion_id uuid,
  target_decision text,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_implementation_recommendation text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  new_review_id uuid;
  new_status text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'review recording is not authorised' using errcode = '42501';
  end if;

  if target_decision not in ('accept', 'reject', 'needs_more_information') then
    raise exception 'invalid review decision' using errcode = '22023';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found or suggestion_row.status <> 'under_review' then
    raise exception 'suggestion is not under review' using errcode = '55000';
  end if;

  if not private.can_review_suggestion(org_id, suggestion_row.review_jurisdiction_unit_id) then
    raise exception 'review recording is not authorised' using errcode = '42501';
  end if;

  insert into public.suggestion_reviews (
    organisation_id, suggestion_id, reviewer_membership_id,
    decision, impact_level, effort_level, rationale, implementation_recommendation
  ) values (
    org_id, target_suggestion_id, actor_membership_id,
    target_decision, target_impact_level, target_effort_level,
    btrim(target_rationale), target_implementation_recommendation
  ) returning id into new_review_id;

  if target_decision = 'needs_more_information' then
    -- Keep under_review; keep active reviewer assignment.
    null;
  elsif target_decision = 'accept' then
    new_status := 'accepted';
    update public.suggestion_review_assignments assignment_table
    set status = 'completed', completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.suggestion_id = target_suggestion_id
      and assignment_table.status = 'active';

    update public.improvement_suggestions suggestion_table
    set status = new_status, accepted_at = statement_timestamp(), updated_at = statement_timestamp()
    where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id;

    perform private.append_suggestion_status_history(
      org_id, target_suggestion_id, 'under_review', new_status, actor_membership_id, target_rationale
    );
  elsif target_decision = 'reject' then
    new_status := 'rejected';
    update public.suggestion_review_assignments assignment_table
    set status = 'completed', completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.suggestion_id = target_suggestion_id
      and assignment_table.status = 'active';

    update public.improvement_suggestions suggestion_table
    set status = new_status, rejected_at = statement_timestamp(), updated_at = statement_timestamp()
    where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id;

    perform private.append_suggestion_status_history(
      org_id, target_suggestion_id, 'under_review', new_status, actor_membership_id, target_rationale
    );
  end if;

  perform private.append_business_audit(
    org_id, 'suggestion.review_recorded', target_suggestion_id, 'succeeded',
    jsonb_build_object('decision', target_decision, 'review_id', new_review_id)
  );
  perform private.enqueue_domain_event(
    org_id, target_suggestion_id,
    case target_decision
      when 'accept' then 'SuggestionAccepted'
      when 'reject' then 'SuggestionRejected'
      else 'SuggestionReviewRecorded'
    end,
    new_review_id::text,
    jsonb_build_object('decision', target_decision)
  );

  return new_review_id;
end;
$$;

-- Additional lifecycle + contributor RPCs

create or replace function private.begin_suggestion_implementation(target_suggestion_id uuid)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
begin
  select suggestion_table.* into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id for update;
  if not found or suggestion_row.status <> 'accepted' then
    raise exception 'suggestion cannot begin implementation' using errcode = '55000';
  end if;
  if not private.has_scoped_permission(org_id, 'suggestions.manage', null, suggestion_row.review_jurisdiction_unit_id)
    and not private.has_scoped_permission(org_id, 'suggestions.manage', null, null) then
    raise exception 'implementation start is not authorised' using errcode = '42501';
  end if;
  update public.improvement_suggestions set status = 'implementing',
    implementation_started_at = statement_timestamp(), updated_at = statement_timestamp()
  where organisation_id = org_id and id = target_suggestion_id;
  perform private.append_suggestion_status_history(org_id, target_suggestion_id, 'accepted', 'implementing', actor_membership_id, null);
  return true;
end; $$;

create or replace function private.mark_suggestion_implemented(
  target_suggestion_id uuid,
  target_implementation_summary text,
  target_implementation_outcome text default 'implemented_as_proposed',
  target_follow_up_note text default null
)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  from_status text;
begin
  select suggestion_table.* into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id for update;
  if not found or suggestion_row.status not in ('accepted', 'implementing') then
    raise exception 'suggestion cannot be marked implemented' using errcode = '55000';
  end if;
  if not private.has_scoped_permission(org_id, 'suggestions.manage', null, suggestion_row.review_jurisdiction_unit_id)
    and not private.has_scoped_permission(org_id, 'suggestions.manage', null, null) then
    raise exception 'implementation completion is not authorised' using errcode = '42501';
  end if;
  from_status := suggestion_row.status;
  update public.improvement_suggestions
  set status = 'implemented',
      implementation_summary = target_implementation_summary,
      implementation_outcome = target_implementation_outcome,
      implemented_by_membership_id = actor_membership_id,
      implemented_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where organisation_id = org_id and id = target_suggestion_id;
  perform private.append_suggestion_status_history(org_id, target_suggestion_id, from_status, 'implemented', actor_membership_id, target_follow_up_note);
  perform private.append_business_audit(org_id, 'suggestion.implemented', target_suggestion_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionImplemented', target_suggestion_id::text, '{}'::jsonb);
  return true;
end; $$;

create or replace function private.withdraw_suggestion(target_suggestion_id uuid, target_reason text default null)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
begin
  select suggestion_table.* into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id for update;
  if not found or suggestion_row.status not in ('draft', 'submitted') then
    raise exception 'suggestion cannot be withdrawn' using errcode = '55000';
  end if;
  if suggestion_row.author_membership_id <> actor_membership_id
    and not private.has_scoped_permission(org_id, 'suggestions.manage', null, suggestion_row.origin_unit_id) then
    raise exception 'withdraw is not authorised' using errcode = '42501';
  end if;
  update public.improvement_suggestions
  set status = 'withdrawn', withdrawn_at = statement_timestamp(), updated_at = statement_timestamp()
  where organisation_id = org_id and id = target_suggestion_id;
  perform private.append_suggestion_status_history(org_id, target_suggestion_id, suggestion_row.status, 'withdrawn', actor_membership_id, target_reason);
  return true;
end; $$;

create or replace function private.assign_suggestion_reviewer(
  target_suggestion_id uuid,
  target_reviewer_membership_id uuid
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  membership_status text;
  new_assignment_id uuid;
begin
  select suggestion_table.* into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id;
  if not found then raise exception 'suggestion not found' using errcode = 'P0002'; end if;
  if not private.has_scoped_permission(org_id, 'suggestions.manage', null, suggestion_row.review_jurisdiction_unit_id)
    and not private.has_scoped_permission(org_id, 'suggestions.manage', null, null) then
    raise exception 'reviewer assignment is not authorised' using errcode = '42501';
  end if;
  select membership_table.status into membership_status
  from public.organisation_memberships membership_table
  where membership_table.organisation_id = org_id and membership_table.id = target_reviewer_membership_id;
  if membership_status is distinct from 'active' then
    raise exception 'inactive membership cannot be assigned as reviewer' using errcode = '22023';
  end if;
  insert into public.suggestion_review_assignments (
    organisation_id, suggestion_id, reviewer_membership_id, assigned_by_membership_id
  ) values (org_id, target_suggestion_id, target_reviewer_membership_id, actor_membership_id)
  returning id into new_assignment_id;
  return new_assignment_id;
end; $$;

create or replace function private.add_suggestion_contributor(
  target_suggestion_id uuid,
  target_membership_id uuid,
  target_contribution_role text
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_assignment_id uuid;
begin
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'contributor assignment is not authorised' using errcode = '42501';
  end if;
  insert into public.suggestion_contributor_assignments (
    organisation_id, suggestion_id, membership_id, contribution_role, assigned_by_membership_id
  ) values (org_id, target_suggestion_id, target_membership_id, target_contribution_role, actor_membership_id)
  returning id into new_assignment_id;
  return new_assignment_id;
end; $$;

create or replace function public.create_suggestion_draft(
  target_programme_version_id uuid, target_category_id uuid, target_title text,
  target_problem_or_opportunity text, target_proposed_idea text,
  target_expected_benefit_summary text default null, target_target_unit_id uuid default null,
  target_template_submission_id uuid default null
) returns uuid language sql volatile security definer set search_path = ''
as $$ select private.create_suggestion_draft(
  target_programme_version_id, target_category_id, target_title,
  target_problem_or_opportunity, target_proposed_idea, target_expected_benefit_summary,
  target_target_unit_id, target_template_submission_id) $$;

create or replace function public.update_suggestion_draft(
  target_suggestion_id uuid, target_title text, target_problem_or_opportunity text,
  target_proposed_idea text, target_expected_benefit_summary text default null,
  target_category_id uuid default null, target_target_unit_id uuid default null,
  target_template_submission_id uuid default null
) returns boolean language sql volatile security definer set search_path = ''
as $$ select private.update_suggestion_draft(
  target_suggestion_id, target_title, target_problem_or_opportunity, target_proposed_idea,
  target_expected_benefit_summary, target_category_id, target_target_unit_id, target_template_submission_id) $$;

create or replace function public.submit_suggestion(target_suggestion_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.submit_suggestion(target_suggestion_id) $$;

create or replace function public.begin_suggestion_review(target_suggestion_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.begin_suggestion_review(target_suggestion_id) $$;

create or replace function public.record_suggestion_review(
  target_suggestion_id uuid, target_decision text, target_impact_level text,
  target_effort_level text, target_rationale text, target_implementation_recommendation text default null
) returns uuid language sql volatile security definer set search_path = ''
as $$ select private.record_suggestion_review(
  target_suggestion_id, target_decision, target_impact_level, target_effort_level,
  target_rationale, target_implementation_recommendation) $$;

create or replace function public.begin_suggestion_implementation(target_suggestion_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.begin_suggestion_implementation(target_suggestion_id) $$;

create or replace function public.mark_suggestion_implemented(
  target_suggestion_id uuid, target_implementation_summary text,
  target_implementation_outcome text default 'implemented_as_proposed', target_follow_up_note text default null
) returns boolean language sql volatile security definer set search_path = ''
as $$ select private.mark_suggestion_implemented(
  target_suggestion_id, target_implementation_summary, target_implementation_outcome, target_follow_up_note) $$;

create or replace function public.withdraw_suggestion(target_suggestion_id uuid, target_reason text default null)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.withdraw_suggestion(target_suggestion_id, target_reason) $$;

create or replace function public.assign_suggestion_reviewer(target_suggestion_id uuid, target_reviewer_membership_id uuid)
returns uuid language sql volatile security definer set search_path = ''
as $$ select private.assign_suggestion_reviewer(target_suggestion_id, target_reviewer_membership_id) $$;

create or replace function public.add_suggestion_contributor(
  target_suggestion_id uuid, target_membership_id uuid, target_contribution_role text
) returns uuid language sql volatile security definer set search_path = ''
as $$ select private.add_suggestion_contributor(target_suggestion_id, target_membership_id, target_contribution_role) $$;

grant execute on function public.create_suggestion_draft(uuid, uuid, text, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.update_suggestion_draft(uuid, text, text, text, text, uuid, uuid, uuid) to authenticated;
grant execute on function public.submit_suggestion(uuid) to authenticated;
grant execute on function public.begin_suggestion_review(uuid) to authenticated;
grant execute on function public.record_suggestion_review(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.begin_suggestion_implementation(uuid) to authenticated;
grant execute on function public.mark_suggestion_implemented(uuid, text, text, text) to authenticated;
grant execute on function public.withdraw_suggestion(uuid, text) to authenticated;
grant execute on function public.assign_suggestion_reviewer(uuid, uuid) to authenticated;
grant execute on function public.add_suggestion_contributor(uuid, uuid, text) to authenticated;

alter function private.append_suggestion_status_history(uuid, uuid, text, text, uuid, text) owner to lean_hub_private_owner;
alter function private.create_suggestion_draft(uuid, uuid, text, text, text, text, uuid, uuid) owner to lean_hub_private_owner;
alter function private.update_suggestion_draft(uuid, text, text, text, text, uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.submit_suggestion(uuid) owner to lean_hub_private_owner;
alter function private.begin_suggestion_review(uuid) owner to lean_hub_private_owner;
alter function private.record_suggestion_review(uuid, text, text, text, text, text) owner to lean_hub_private_owner;
alter function private.begin_suggestion_implementation(uuid) owner to lean_hub_private_owner;
alter function private.mark_suggestion_implemented(uuid, text, text, text) owner to lean_hub_private_owner;
alter function private.withdraw_suggestion(uuid, text) owner to lean_hub_private_owner;
alter function private.assign_suggestion_reviewer(uuid, uuid) owner to lean_hub_private_owner;
alter function private.add_suggestion_contributor(uuid, uuid, text) owner to lean_hub_private_owner;
