-- S2d: employee-facing suggestion feedback, notification policy updates, delivery context.

-- ---------------------------------------------------------------------------
-- Schema: employee-facing feedback on reviews and implementation completion
-- ---------------------------------------------------------------------------

alter table public.suggestion_reviews
  add column if not exists employee_feedback text;

alter table public.suggestion_reviews
  drop constraint if exists suggestion_reviews_employee_feedback_check;

alter table public.suggestion_reviews
  add constraint suggestion_reviews_employee_feedback_check
    check (
      employee_feedback is null
      or (
        employee_feedback = btrim(employee_feedback)
        and char_length(employee_feedback) between 1 and 4000
      )
    );

alter table public.improvement_suggestions
  add column if not exists employee_outcome text;

alter table public.improvement_suggestions
  drop constraint if exists improvement_suggestions_employee_outcome_check;

alter table public.improvement_suggestions
  add constraint improvement_suggestions_employee_outcome_check
    check (
      employee_outcome is null
      or (
        employee_outcome = btrim(employee_outcome)
        and char_length(employee_outcome) between 1 and 4000
      )
    );

-- ---------------------------------------------------------------------------
-- Review feedback lookup for delivery-time authorization
-- ---------------------------------------------------------------------------

create or replace function private.lookup_suggestion_review_employee_feedback(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_review_id uuid,
  expected_decision text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  review_row public.suggestion_reviews%rowtype;
begin
  select review.*
  into review_row
  from public.suggestion_reviews review
  where review.organisation_id = target_organisation_id
    and review.id = target_review_id
  limit 1;

  if review_row.id is null then
    return null;
  end if;

  if review_row.suggestion_id is distinct from target_suggestion_id then
    return null;
  end if;

  if review_row.decision is distinct from expected_decision then
    return null;
  end if;

  if review_row.employee_feedback is null
    or btrim(review_row.employee_feedback) = '' then
    return null;
  end if;

  return review_row.employee_feedback;
end;
$$;

create or replace function private.lookup_suggestion_employee_outcome(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select suggestion_row.employee_outcome
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = target_organisation_id
    and suggestion_row.id = target_suggestion_id
    and suggestion_row.status = 'implemented'
    and suggestion_row.employee_outcome is not null
    and btrim(suggestion_row.employee_outcome) <> ''
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Suggestion review RPC: employee feedback + more-information event
-- ---------------------------------------------------------------------------

drop function if exists public.approve_suggestion(uuid, text, text, text, text);
drop function if exists public.decline_suggestion(uuid, text, text, text);
drop function if exists public.park_suggestion(uuid, text, text, text);
drop function if exists public.record_suggestion_review(uuid, text, text, text, text, text);
drop function if exists public.mark_suggestion_implemented(uuid, text, text, text);
drop function if exists private.approve_suggestion(uuid, text, text, text, text);
drop function if exists private.decline_suggestion(uuid, text, text, text);
drop function if exists private.park_suggestion(uuid, text, text, text);
drop function if exists private.record_suggestion_review(uuid, text, text, text, text, text);
drop function if exists private.mark_suggestion_implemented(uuid, text, text, text);

create or replace function private.record_suggestion_review(
  target_suggestion_id uuid,
  target_decision text,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_implementation_recommendation text default null,
  target_employee_feedback text default null
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
  suggestion_row public.improvement_suggestions%rowtype;
  new_review_id uuid;
  new_status text;
  normalized_employee_feedback text;
begin
  if target_decision not in ('accept', 'reject', 'needs_more_information', 'park') then
    raise exception 'unsupported review decision' using errcode = '22023';
  end if;

  if target_rationale is null or btrim(target_rationale) = '' then
    raise exception 'review rationale is required' using errcode = '22023';
  end if;

  if target_decision in ('accept', 'reject', 'needs_more_information', 'park') then
    if target_employee_feedback is null or btrim(target_employee_feedback) = '' then
      raise exception 'employee feedback is required for this decision'
        using errcode = '22023';
    end if;

    normalized_employee_feedback := btrim(target_employee_feedback);

    if char_length(normalized_employee_feedback) > 4000 then
      raise exception 'employee feedback exceeds maximum length'
        using errcode = '22023';
    end if;
  else
    normalized_employee_feedback := null;
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;

  if target_decision = 'park' then
    if suggestion_row.status <> 'under_review' then
      raise exception 'suggestion cannot be parked' using errcode = '55000';
    end if;
  elsif suggestion_row.status <> 'under_review' then
    raise exception 'suggestion is not under review' using errcode = '55000';
  end if;

  if not private.can_act_as_active_suggestion_reviewer(
    org_id,
    target_suggestion_id,
    actor_membership_id
  ) then
    raise exception 'review recording is not authorised' using errcode = '42501';
  end if;

  insert into public.suggestion_reviews (
    organisation_id,
    suggestion_id,
    reviewer_membership_id,
    decision,
    impact_level,
    effort_level,
    rationale,
    implementation_recommendation,
    employee_feedback
  ) values (
    org_id,
    target_suggestion_id,
    actor_membership_id,
    target_decision,
    target_impact_level,
    target_effort_level,
    btrim(target_rationale),
    target_implementation_recommendation,
    normalized_employee_feedback
  ) returning id into new_review_id;

  if target_decision = 'needs_more_information' then
    null;
  elsif target_decision = 'park' then
    new_status := 'parked';
    update public.improvement_suggestions suggestion_table
    set status = new_status,
        parked_at = statement_timestamp(),
        parked_rationale = normalized_employee_feedback,
        updated_at = statement_timestamp()
    where suggestion_table.organisation_id = org_id
      and suggestion_table.id = target_suggestion_id;

    perform private.append_suggestion_status_history(
      org_id,
      target_suggestion_id,
      'under_review',
      new_status,
      actor_membership_id,
      btrim(target_rationale)
    );
  elsif target_decision = 'accept' then
    new_status := 'accepted';
    perform private.end_active_suggestion_review_assignment(org_id, target_suggestion_id);

    update public.improvement_suggestions suggestion_table
    set status = new_status,
        accepted_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where suggestion_table.organisation_id = org_id
      and suggestion_table.id = target_suggestion_id;

    perform private.append_suggestion_status_history(
      org_id,
      target_suggestion_id,
      'under_review',
      new_status,
      actor_membership_id,
      target_rationale
    );
  elsif target_decision = 'reject' then
    new_status := 'rejected';
    perform private.end_active_suggestion_review_assignment(org_id, target_suggestion_id);

    update public.improvement_suggestions suggestion_table
    set status = new_status,
        rejected_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where suggestion_table.organisation_id = org_id
      and suggestion_table.id = target_suggestion_id;

    perform private.append_suggestion_status_history(
      org_id,
      target_suggestion_id,
      'under_review',
      new_status,
      actor_membership_id,
      target_rationale
    );
  end if;

  perform private.append_business_audit(
    org_id,
    case target_decision
      when 'accept' then 'suggestion.approved'
      when 'reject' then 'suggestion.declined'
      when 'park' then 'suggestion.parked'
      when 'needs_more_information' then 'suggestion.more_information_requested'
      else 'suggestion.review_recorded'
    end,
    target_suggestion_id,
    'succeeded',
    jsonb_build_object('decision', target_decision, 'review_id', new_review_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    case target_decision
      when 'accept' then 'SuggestionAccepted'
      when 'reject' then 'SuggestionRejected'
      when 'park' then 'SuggestionParked'
      when 'needs_more_information' then 'SuggestionMoreInformationRequested'
      else 'SuggestionReviewRecorded'
    end,
    new_review_id::text,
    jsonb_build_object(
      'decision', target_decision,
      'review_id', new_review_id,
      'suggestion_id', target_suggestion_id
    )
  );

  return new_review_id;
end;
$$;

create or replace function private.approve_suggestion(
  target_suggestion_id uuid,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_employee_feedback text,
  target_implementation_recommendation text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return private.record_suggestion_review(
    target_suggestion_id,
    'accept',
    target_impact_level,
    target_effort_level,
    target_rationale,
    target_implementation_recommendation,
    target_employee_feedback
  );
end;
$$;

create or replace function private.decline_suggestion(
  target_suggestion_id uuid,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_employee_feedback text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return private.record_suggestion_review(
    target_suggestion_id,
    'reject',
    target_impact_level,
    target_effort_level,
    target_rationale,
    null,
    target_employee_feedback
  );
end;
$$;

create or replace function private.park_suggestion(
  target_suggestion_id uuid,
  target_rationale text,
  target_impact_level text default 'medium',
  target_effort_level text default 'medium',
  target_employee_feedback text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_rationale is null or btrim(target_rationale) = '' then
    raise exception 'parked suggestions require a rationale' using errcode = '22023';
  end if;

  return private.record_suggestion_review(
    target_suggestion_id,
    'park',
    target_impact_level,
    target_effort_level,
    target_rationale,
    null,
    target_employee_feedback
  );
end;
$$;

create or replace function public.record_suggestion_review(
  target_suggestion_id uuid,
  target_decision text,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_implementation_recommendation text default null,
  target_employee_feedback text default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  return private.record_suggestion_review(
    target_suggestion_id,
    target_decision,
    target_impact_level,
    target_effort_level,
    target_rationale,
    target_implementation_recommendation,
    target_employee_feedback
  );
end;
$$;

create or replace function public.approve_suggestion(
  target_suggestion_id uuid,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_employee_feedback text,
  target_implementation_recommendation text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.approve_suggestion(
    target_suggestion_id,
    target_impact_level,
    target_effort_level,
    target_rationale,
    target_employee_feedback,
    target_implementation_recommendation
  )
$$;

create or replace function public.decline_suggestion(
  target_suggestion_id uuid,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_employee_feedback text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.decline_suggestion(
    target_suggestion_id,
    target_impact_level,
    target_effort_level,
    target_rationale,
    target_employee_feedback
  )
$$;

create or replace function public.park_suggestion(
  target_suggestion_id uuid,
  target_rationale text,
  target_impact_level text default 'medium',
  target_effort_level text default 'medium',
  target_employee_feedback text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.park_suggestion(
    target_suggestion_id,
    target_rationale,
    target_impact_level,
    target_effort_level,
    target_employee_feedback
  )
$$;

-- ---------------------------------------------------------------------------
-- Implementation completion: employee outcome required
-- ---------------------------------------------------------------------------

create or replace function private.mark_suggestion_implemented(
  target_suggestion_id uuid,
  target_implementation_summary text,
  target_implementation_outcome text default 'implemented_as_proposed',
  target_follow_up_note text default null,
  target_employee_outcome text default null
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
  suggestion_row public.improvement_suggestions%rowtype;
  from_status text;
  normalized_employee_outcome text;
begin
  if target_employee_outcome is null or btrim(target_employee_outcome) = '' then
    raise exception 'employee outcome is required when marking implemented'
      using errcode = '22023';
  end if;

  normalized_employee_outcome := btrim(target_employee_outcome);

  if char_length(normalized_employee_outcome) > 4000 then
    raise exception 'employee outcome exceeds maximum length'
      using errcode = '22023';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

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
      employee_outcome = normalized_employee_outcome,
      implemented_by_membership_id = actor_membership_id,
      implemented_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where organisation_id = org_id and id = target_suggestion_id;

  perform private.append_suggestion_status_history(
    org_id,
    target_suggestion_id,
    from_status,
    'implemented',
    actor_membership_id,
    target_follow_up_note
  );
  perform private.append_business_audit(
    org_id,
    'suggestion.implemented',
    target_suggestion_id,
    'succeeded',
    jsonb_build_object('suggestion_id', target_suggestion_id)
  );
  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    'SuggestionImplemented',
    'SuggestionImplemented:' || target_suggestion_id::text,
    jsonb_build_object('suggestion_id', target_suggestion_id)
  );
  return true;
end;
$$;

create or replace function public.mark_suggestion_implemented(
  target_suggestion_id uuid,
  target_implementation_summary text,
  target_implementation_outcome text default 'implemented_as_proposed',
  target_follow_up_note text default null,
  target_employee_outcome text default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.mark_suggestion_implemented(
    target_suggestion_id,
    target_implementation_summary,
    target_implementation_outcome,
    target_follow_up_note,
    target_employee_outcome
  )
$$;

-- ---------------------------------------------------------------------------
-- Delivery context: employee message + new suggestion kinds
-- ---------------------------------------------------------------------------

drop function if exists public.get_notification_delivery_context_for_worker(uuid, uuid, uuid);
drop function if exists private.get_notification_delivery_context(uuid, uuid, uuid);

create or replace function private.get_notification_delivery_context(
  target_organisation_id uuid,
  target_delivery_id uuid,
  target_source_domain_event_id uuid
)
returns table (
  organisation_id uuid,
  organisation_name text,
  delivery_id uuid,
  source_domain_event_id uuid,
  notification_kind text,
  recipient_membership_id uuid,
  recipient_display_name text,
  recipient_resolution_status text,
  deliverable_email text,
  event_type text,
  resource_record_id uuid,
  event_payload jsonb,
  context_title text,
  context_detail text,
  context_link_path text,
  context_employee_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  delivery_row private.notification_delivery_ledger%rowtype;
  event_row private.domain_event_outbox%rowtype;
  membership_row public.organisation_memberships%rowtype;
  organisation_row public.organisations%rowtype;
  notification_contact text;
  auth_email text;
  workforce_status text;
  resolved_email text;
  resolution_status text;
  resolved_title text;
  resolved_detail text;
  resolved_link_path text;
  resolved_employee_message text;
  suggestion_author_membership_id uuid;
  review_id uuid;
  payload_suggestion_id uuid;
begin
  select ledger_row.*
  into delivery_row
  from private.notification_delivery_ledger ledger_row
  where ledger_row.organisation_id = target_organisation_id
    and ledger_row.id = target_delivery_id
    and ledger_row.source_domain_event_id = target_source_domain_event_id;

  if delivery_row.id is null then
    return;
  end if;

  select outbox_row.*
  into event_row
  from private.domain_event_outbox outbox_row
  where outbox_row.organisation_id = target_organisation_id
    and outbox_row.id = target_source_domain_event_id;

  if event_row.id is null then
    return;
  end if;

  select membership.*
  into membership_row
  from public.organisation_memberships membership
  where membership.organisation_id = target_organisation_id
    and membership.id = delivery_row.recipient_membership_id;

  if membership_row.id is null then
    return;
  end if;

  select organisation.*
  into organisation_row
  from public.organisations organisation
  where organisation.id = target_organisation_id;

  if organisation_row.id is null then
    return;
  end if;

  select contact_row.contact_address
  into notification_contact
  from public.membership_notification_contacts contact_row
  where contact_row.organisation_id = target_organisation_id
    and contact_row.membership_id = delivery_row.recipient_membership_id
    and contact_row.channel_type = 'email'
    and contact_row.status = 'active'
  limit 1;

  select lower(btrim(auth_user.email))
  into auth_email
  from auth.users auth_user
  where auth_user.id = membership_row.user_id;

  select workforce_account.status
  into workforce_status
  from private.workforce_accounts workforce_account
  where workforce_account.user_id = membership_row.user_id
  limit 1;

  if membership_row.status <> 'active' then
    resolution_status := 'inactive_membership';
    resolved_email := null;
  elsif workforce_status = 'disabled' then
    resolution_status := 'disabled_workforce_account';
    resolved_email := null;
  elsif notification_contact is not null
    and private.is_deliverable_email_address(notification_contact) then
    resolution_status := 'deliverable';
    resolved_email := notification_contact;
  elsif notification_contact is not null then
    resolution_status := 'invalid_email';
    resolved_email := null;
  elsif auth_email is not null
    and private.is_deliverable_email_address(auth_email) then
    resolution_status := 'deliverable';
    resolved_email := auth_email;
  elsif auth_email is not null
    and (
      auth_email like '%@workforce.invalid'
      or right(auth_email, 8) = '.invalid'
    ) then
    resolution_status := 'synthetic_auth_email';
    resolved_email := null;
  elsif auth_email is not null then
    resolution_status := 'invalid_email';
    resolved_email := null;
  else
    resolution_status := 'no_contact';
    resolved_email := null;
  end if;

  resolved_title := null;
  resolved_detail := null;
  resolved_link_path := null;
  resolved_employee_message := null;

  if delivery_row.notification_kind = 'workforce.job_function_assigned' then
    select
      coalesce(assignment_row.job_function_name_snapshot, 'Job function'),
      case
        when assignment_row.is_primary then 'Primary assignment'
        else 'Assignment update'
      end,
      '/platform/people'
    into resolved_title, resolved_detail, resolved_link_path
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/people');
  elsif delivery_row.notification_kind = 'workforce.training_completed' then
    select
      coalesce(course_row.name, 'Training course'),
      'Training completion recorded',
      case
        when course_row.id is not null
          then '/platform/training/courses/' || course_row.id::text
        else '/platform/training/matrix'
      end
    into resolved_title, resolved_detail, resolved_link_path
    from public.training_completions completion_row
    left join public.training_courses course_row
      on course_row.organisation_id = completion_row.organisation_id
     and course_row.id = completion_row.course_id
    where completion_row.organisation_id = target_organisation_id
      and completion_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/training/matrix');
  elsif delivery_row.notification_kind = 'workforce.skill_proficiency_validated' then
    select
      coalesce(skill_row.name, 'Skill'),
      'Skill proficiency validated',
      case
        when skill_row.id is not null
          then '/platform/skills/' || skill_row.id::text
        else '/platform/skills/matrix'
      end
    into resolved_title, resolved_detail, resolved_link_path
    from public.membership_skill_assessments assessment_row
    left join public.skills skill_row
      on skill_row.organisation_id = assessment_row.organisation_id
     and skill_row.id = assessment_row.skill_id
    where assessment_row.organisation_id = target_organisation_id
      and assessment_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/skills/matrix');
  elsif delivery_row.notification_kind = 'recognition.awarded' then
    select
      coalesce(award_row.title, 'Recognition award'),
      left(award_row.message, 500),
      '/platform/recognition'
    into resolved_title, resolved_detail, resolved_link_path
    from public.recognition_awards award_row
    where award_row.organisation_id = target_organisation_id
      and award_row.id = event_row.resource_record_id
      and award_row.status = 'active'
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/recognition');
  elsif delivery_row.notification_kind in (
    'suggestions.reviewer_assigned',
    'suggestions.reviewer_reassigned',
    'suggestions.more_information_required',
    'suggestions.approved',
    'suggestions.declined',
    'suggestions.parked',
    'suggestions.implemented'
  ) then
    select
      coalesce(
        nullif(btrim(suggestion_row.suggestion_number), ''),
        suggestion_row.title
      ),
      case delivery_row.notification_kind
        when 'suggestions.reviewer_assigned' then 'Assigned to you for review'
        when 'suggestions.reviewer_reassigned' then 'Reassigned to you for review'
        when 'suggestions.more_information_required' then 'More information is needed'
        when 'suggestions.approved' then 'Your suggestion was approved'
        when 'suggestions.declined' then 'Your suggestion was declined'
        when 'suggestions.parked' then 'Your suggestion was parked for further consideration'
        when 'suggestions.implemented' then 'Your suggestion has been implemented'
      end,
      case
        when delivery_row.notification_kind in (
          'suggestions.reviewer_assigned',
          'suggestions.reviewer_reassigned'
        ) then
          '/platform/suggestions/review?queue=mine&suggestionId='
            || suggestion_row.id::text
        else '/platform/suggestions/' || suggestion_row.id::text
      end,
      suggestion_row.author_membership_id
    into
      resolved_title,
      resolved_detail,
      resolved_link_path,
      suggestion_author_membership_id
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = event_row.resource_record_id
    limit 1;

    if delivery_row.notification_kind = 'suggestions.implemented' then
      resolved_employee_message := private.lookup_suggestion_employee_outcome(
        target_organisation_id,
        event_row.resource_record_id
      );

      if resolved_employee_message is null then
        resolution_status := 'not_authorized';
        resolved_email := null;
      end if;
    elsif delivery_row.notification_kind in (
      'suggestions.more_information_required',
      'suggestions.approved',
      'suggestions.declined',
      'suggestions.parked'
    ) then
      review_id := nullif(event_row.payload ->> 'review_id', '')::uuid;
      payload_suggestion_id := nullif(event_row.payload ->> 'suggestion_id', '')::uuid;

      if review_id is null
        or payload_suggestion_id is distinct from event_row.resource_record_id then
        resolution_status := 'not_authorized';
        resolved_email := null;
      else
        resolved_employee_message := private.lookup_suggestion_review_employee_feedback(
          target_organisation_id,
          event_row.resource_record_id,
          review_id,
          case delivery_row.notification_kind
            when 'suggestions.more_information_required' then 'needs_more_information'
            when 'suggestions.approved' then 'accept'
            when 'suggestions.declined' then 'reject'
            when 'suggestions.parked' then 'park'
          end
        );

        if resolved_employee_message is null then
          resolution_status := 'not_authorized';
          resolved_email := null;
        end if;
      end if;
    end if;

    if delivery_row.notification_kind in (
      'suggestions.reviewer_assigned',
      'suggestions.reviewer_reassigned'
    ) then
      if resolution_status = 'deliverable'
        and (
          event_row.resource_record_id is null
          or not private.is_active_suggestion_reviewer(
            target_organisation_id,
            event_row.resource_record_id,
            delivery_row.recipient_membership_id
          )
          or not private.membership_can_read_improvement_suggestion(
            target_organisation_id,
            event_row.resource_record_id,
            delivery_row.recipient_membership_id
          )
        ) then
        resolution_status := 'not_authorized';
        resolved_email := null;
      end if;
    elsif delivery_row.notification_kind in (
      'suggestions.more_information_required',
      'suggestions.approved',
      'suggestions.declined',
      'suggestions.parked',
      'suggestions.implemented'
    ) then
      if resolution_status = 'deliverable'
        and (
          event_row.resource_record_id is null
          or suggestion_author_membership_id is distinct from delivery_row.recipient_membership_id
          or not private.membership_can_read_improvement_suggestion(
            target_organisation_id,
            event_row.resource_record_id,
            delivery_row.recipient_membership_id
          )
        ) then
        resolution_status := 'not_authorized';
        resolved_email := null;
      end if;
    end if;
  end if;

  return query
  select
    target_organisation_id,
    organisation_row.name,
    delivery_row.id,
    delivery_row.source_domain_event_id,
    delivery_row.notification_kind,
    delivery_row.recipient_membership_id,
    coalesce(nullif(btrim(membership_row.display_name), ''), 'Team member'),
    resolution_status,
    resolved_email,
    event_row.event_type,
    event_row.resource_record_id,
    event_row.payload,
    resolved_title,
    resolved_detail,
    resolved_link_path,
    resolved_employee_message;
end;
$$;

create or replace function public.get_notification_delivery_context_for_worker(
  target_organisation_id uuid,
  target_delivery_id uuid,
  target_source_domain_event_id uuid
)
returns table (
  organisation_id uuid,
  organisation_name text,
  delivery_id uuid,
  source_domain_event_id uuid,
  notification_kind text,
  recipient_membership_id uuid,
  recipient_display_name text,
  recipient_resolution_status text,
  deliverable_email text,
  event_type text,
  resource_record_id uuid,
  event_payload jsonb,
  context_title text,
  context_detail text,
  context_link_path text,
  context_employee_message text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_notification_delivery_context(
    target_organisation_id,
    target_delivery_id,
    target_source_domain_event_id
  )
$$;

alter function private.lookup_suggestion_review_employee_feedback(uuid, uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.lookup_suggestion_employee_outcome(uuid, uuid)
  owner to lean_hub_private_owner;

revoke all on function private.lookup_suggestion_review_employee_feedback(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.lookup_suggestion_employee_outcome(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.lookup_suggestion_review_employee_feedback(uuid, uuid, uuid, text)
  to postgres;
grant execute on function private.lookup_suggestion_employee_outcome(uuid, uuid)
  to postgres;

revoke all on function public.approve_suggestion(uuid, text, text, text, text, text)
  from public, anon;
revoke all on function public.decline_suggestion(uuid, text, text, text, text)
  from public, anon;
revoke all on function public.park_suggestion(uuid, text, text, text, text)
  from public, anon;
revoke all on function public.record_suggestion_review(uuid, text, text, text, text, text, text)
  from public, anon;
revoke all on function public.mark_suggestion_implemented(uuid, text, text, text, text)
  from public, anon;

grant execute on function public.approve_suggestion(uuid, text, text, text, text, text)
  to authenticated;
grant execute on function public.decline_suggestion(uuid, text, text, text, text)
  to authenticated;
grant execute on function public.park_suggestion(uuid, text, text, text, text)
  to authenticated;
grant execute on function public.record_suggestion_review(uuid, text, text, text, text, text, text)
  to authenticated;
grant execute on function public.mark_suggestion_implemented(uuid, text, text, text, text)
  to authenticated;
