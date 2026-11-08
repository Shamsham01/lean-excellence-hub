-- Patch delivery context for suggestions.awaiting_review (SuggestionSubmitted).

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
  profile_display_name text;
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

  select profile_row.display_name
  into profile_display_name
  from public.profiles profile_row
  where profile_row.user_id = membership_row.user_id;

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
  elsif delivery_row.notification_kind = 'suggestions.awaiting_review' then
    select
      coalesce(
        nullif(btrim(suggestion_row.suggestion_number), ''),
        suggestion_row.title
      ),
      'An improvement idea needs your approval',
      '/platform/suggestions/review?queue=all&suggestionId=' || suggestion_row.id::text
    into resolved_title, resolved_detail, resolved_link_path
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = event_row.resource_record_id
    limit 1;

    if resolution_status = 'deliverable'
      and (
        event_row.resource_record_id is null
        or not exists (
          select 1
          from public.improvement_suggestions jurisdiction_row
          cross join lateral private.resolve_suggestion_approval_notification_recipients(
            jurisdiction_row.organisation_id,
            jurisdiction_row.review_jurisdiction_unit_id,
            jurisdiction_row.author_membership_id
          ) resolved
          where jurisdiction_row.organisation_id = target_organisation_id
            and jurisdiction_row.id = event_row.resource_record_id
            and resolved.membership_id = delivery_row.recipient_membership_id
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


  if delivery_row.notification_kind = 'schedule.occurrence_reminder' then
    select
      coalesce(nullif(btrim(schedule_row.title), ''), 'Scheduled activity'),
      concat(
        'Due ',
        to_char(occurrence_row.planned_local_date, 'YYYY-MM-DD'),
        case
          when occurrence_row.is_all_day then ' (all day)'
          else coalesce(' at ' || to_char(occurrence_row.local_time, 'HH24:MI'), '')
        end
      ),
      '/platform/schedule/' || occurrence_row.schedule_definition_id::text
    into resolved_title, resolved_detail, resolved_link_path
    from public.schedule_occurrences occurrence_row
    join public.schedule_definitions schedule_row
      on schedule_row.organisation_id = occurrence_row.organisation_id
     and schedule_row.id = occurrence_row.schedule_definition_id
    where occurrence_row.organisation_id = target_organisation_id
      and occurrence_row.id = nullif(event_row.payload ->> 'occurrence_id', '')::uuid
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/schedule');
  end if;

  return query
  select
    target_organisation_id,
    organisation_row.name,
    delivery_row.id,
    delivery_row.source_domain_event_id,
    delivery_row.notification_kind,
    delivery_row.recipient_membership_id,
    coalesce(
      nullif(btrim(membership_row.display_name), ''),
      nullif(btrim(profile_display_name), '')
    ),
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

