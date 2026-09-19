-- Issue #93: schedule edit rematerialisation, reactivate, reminder outbox,
-- and delivery-context for schedule.occurrence_reminder.
-- Forward-only. Does not broaden RLS/RBAC. Activity resource stays create-only.

create or replace function private.ensure_schedule_occurrences(
  target_schedule_definition_id uuid,
  target_horizon_days integer default 90
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  schedule_row public.schedule_definitions%rowtype;
  horizon_end_date date;
  today_local date;
  cursor_date date;
  inserted_count integer := 0;
  planned_at_value timestamptz;
  reopened_count integer := 0;
begin
  select schedule_item.*
  into schedule_row
  from public.schedule_definitions schedule_item
  where schedule_item.organisation_id = org_id
    and schedule_item.id = target_schedule_definition_id
  for update;

  if not found then
    raise exception 'schedule definition was not found'
      using errcode = '23503';
  end if;

  if schedule_row.status <> 'active' then
    return 0;
  end if;

  today_local := timezone(schedule_row.timezone, statement_timestamp())::date;
  horizon_end_date := today_local + target_horizon_days;
  cursor_date := schedule_row.start_date;

  while cursor_date <= horizon_end_date loop
    if private.schedule_recurrence_matches_date(
      schedule_row.recurrence,
      schedule_row.start_date,
      schedule_row.end_date,
      cursor_date
    ) then
      planned_at_value := private.schedule_local_to_timestamptz(
        cursor_date,
        schedule_row.local_time,
        schedule_row.is_all_day,
        schedule_row.timezone
      );

      insert into public.schedule_occurrences (
        organisation_id,
        schedule_definition_id,
        planned_local_date,
        is_all_day,
        local_time,
        planned_at,
        unit_id,
        owner_membership_id,
        lifecycle_status
      )
      values (
        org_id,
        schedule_row.id,
        cursor_date,
        schedule_row.is_all_day,
        schedule_row.local_time,
        planned_at_value,
        schedule_row.unit_id,
        schedule_row.owner_membership_id,
        'open'
      )
      on conflict do nothing;

      if found then
        inserted_count := inserted_count + 1;
      else
        update public.schedule_occurrences occurrence_row
        set lifecycle_status = 'open',
            is_all_day = schedule_row.is_all_day,
            local_time = schedule_row.local_time,
            planned_at = planned_at_value,
            unit_id = schedule_row.unit_id,
            owner_membership_id = schedule_row.owner_membership_id
        where occurrence_row.organisation_id = org_id
          and occurrence_row.schedule_definition_id = schedule_row.id
          and occurrence_row.planned_local_date = cursor_date
          and coalesce(occurrence_row.local_time, '00:00:00'::time)
            = coalesce(schedule_row.local_time, '00:00:00'::time)
          and occurrence_row.lifecycle_status = 'cancelled'
          and occurrence_row.completion_resource_id is null
          and occurrence_row.planned_local_date >= today_local;

        get diagnostics reopened_count = row_count;
        if reopened_count > 0 then
          inserted_count := inserted_count + 1;
        end if;
      end if;
    end if;

    cursor_date := cursor_date + 1;
  end loop;

  return inserted_count;
end;
$$;

create or replace function private.update_schedule_definition(
  target_schedule_definition_id uuid,
  target_title text,
  target_unit_id uuid,
  target_owner_membership_id uuid,
  target_recurrence jsonb,
  target_start_date date,
  target_is_all_day boolean default false,
  target_local_time time default null,
  target_end_date date default null,
  target_description text default null,
  target_participant_membership_ids uuid[] default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  schedule_row public.schedule_definitions%rowtype;
  participant_id uuid;
  next_version integer;
begin
  if org_id is null
    or not private.can_manage_schedule_definition(org_id, target_schedule_definition_id) then
    raise exception 'schedule update is not authorised'
      using errcode = '42501';
  end if;

  if not private.validate_schedule_recurrence(target_recurrence) then
    raise exception 'schedule recurrence is invalid'
      using errcode = '22023';
  end if;

  if target_is_all_day and target_local_time is not null then
    raise exception 'all-day schedules cannot include local time'
      using errcode = '22023';
  end if;

  if not target_is_all_day and target_local_time is null then
    raise exception 'timed schedules require local time'
      using errcode = '22023';
  end if;

  select schedule_item.*
  into schedule_row
  from public.schedule_definitions schedule_item
  where schedule_item.organisation_id = org_id
    and schedule_item.id = target_schedule_definition_id
    and schedule_item.status = 'active'
  for update;

  if not found then
    raise exception 'schedule definition is not active'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.id = target_owner_membership_id
      and membership_row.status = 'active'
  ) then
    raise exception 'schedule owner membership is invalid'
      using errcode = '23503';
  end if;

  if not private.can_reference_schedule_activity_resource(
    org_id,
    schedule_row.activity_resource_id,
    target_unit_id
  ) then
    raise exception 'schedule activity resource is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_activity_unit_is_applicable(
    org_id,
    schedule_row.activity_resource_id,
    target_unit_id
  );

  next_version := schedule_row.version_number + 1;

  update public.schedule_definitions definition_row
  set title = target_title,
      description = target_description,
      unit_id = target_unit_id,
      owner_membership_id = target_owner_membership_id,
      is_all_day = target_is_all_day,
      local_time = case when target_is_all_day then null else target_local_time end,
      recurrence = target_recurrence,
      start_date = target_start_date,
      end_date = target_end_date,
      version_number = next_version,
      updated_at = statement_timestamp()
  where definition_row.organisation_id = org_id
    and definition_row.id = target_schedule_definition_id
    and definition_row.status = 'active';

  update public.schedule_occurrences occurrence_row
  set lifecycle_status = 'cancelled'
  where occurrence_row.organisation_id = org_id
    and occurrence_row.schedule_definition_id = target_schedule_definition_id
    and occurrence_row.lifecycle_status = 'open'
    and occurrence_row.planned_local_date >= timezone(schedule_row.timezone, statement_timestamp())::date;

  if target_participant_membership_ids is not null then
    delete from public.schedule_participants participant_row
    where participant_row.organisation_id = org_id
      and participant_row.schedule_definition_id = target_schedule_definition_id;

    foreach participant_id in array target_participant_membership_ids loop
      if exists (
        select 1
        from public.organisation_memberships membership_row
        where membership_row.organisation_id = org_id
          and membership_row.id = participant_id
          and membership_row.status = 'active'
      ) then
        insert into public.schedule_participants (
          organisation_id,
          schedule_definition_id,
          membership_id
        )
        values (org_id, target_schedule_definition_id, participant_id)
        on conflict (organisation_id, schedule_definition_id, membership_id) do nothing;
      end if;
    end loop;
  end if;

  perform private.ensure_schedule_occurrences(target_schedule_definition_id, 90);

  perform private.append_business_audit(
    org_id,
    'schedule.updated',
    target_schedule_definition_id,
    'succeeded',
    jsonb_build_object(
      'schedule_definition_id', target_schedule_definition_id,
      'version_number', next_version
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_schedule_definition_id,
    'ScheduleUpdated',
    target_schedule_definition_id::text || ':updated:' || next_version::text,
    jsonb_build_object(
      'status', 'active',
      'version_number', next_version
    )
  );

  return true;
end;
$$;

create or replace function private.reactivate_schedule_definition(
  target_schedule_definition_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  schedule_row public.schedule_definitions%rowtype;
  next_version integer;
begin
  if org_id is null
    or not private.can_manage_schedule_definition(org_id, target_schedule_definition_id) then
    raise exception 'schedule reactivation is not authorised'
      using errcode = '42501';
  end if;

  select schedule_item.*
  into schedule_row
  from public.schedule_definitions schedule_item
  where schedule_item.organisation_id = org_id
    and schedule_item.id = target_schedule_definition_id
    and schedule_item.status = 'inactive'
  for update;

  if not found then
    raise exception 'schedule definition is not inactive'
      using errcode = '55000';
  end if;

  if not private.can_reference_schedule_activity_resource(
    org_id,
    schedule_row.activity_resource_id,
    schedule_row.unit_id
  ) then
    raise exception 'schedule activity resource is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_activity_unit_is_applicable(
    org_id,
    schedule_row.activity_resource_id,
    schedule_row.unit_id
  );

  next_version := schedule_row.version_number + 1;

  update public.schedule_definitions definition_row
  set status = 'active',
      version_number = next_version,
      updated_at = statement_timestamp()
  where definition_row.organisation_id = org_id
    and definition_row.id = target_schedule_definition_id
    and definition_row.status = 'inactive';

  perform private.ensure_schedule_occurrences(target_schedule_definition_id, 90);

  perform private.append_business_audit(
    org_id,
    'schedule.reactivated',
    target_schedule_definition_id,
    'succeeded',
    jsonb_build_object(
      'schedule_definition_id', target_schedule_definition_id,
      'version_number', next_version
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_schedule_definition_id,
    'ScheduleUpdated',
    target_schedule_definition_id::text || ':reactivated:' || next_version::text,
    jsonb_build_object(
      'status', 'active',
      'version_number', next_version
    )
  );

  return true;
end;
$$;

create or replace function public.reactivate_schedule_definition(
  target_schedule_definition_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reactivate_schedule_definition(target_schedule_definition_id)
$$;

create or replace function private.enqueue_due_schedule_occurrence_reminders(
  target_organisation_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  occurrence_row record;
  recipient_ids uuid[];
  enqueued_count integer := 0;
begin
  for occurrence_row in
    select
      occurrence_item.id,
      occurrence_item.organisation_id,
      occurrence_item.schedule_definition_id,
      occurrence_item.planned_local_date,
      occurrence_item.owner_membership_id,
      schedule_item.title
    from public.schedule_occurrences occurrence_item
    join public.schedule_definitions schedule_item
      on schedule_item.organisation_id = occurrence_item.organisation_id
     and schedule_item.id = occurrence_item.schedule_definition_id
    where occurrence_item.lifecycle_status = 'open'
      and schedule_item.status = 'active'
      and occurrence_item.planned_local_date
        = timezone(schedule_item.timezone, statement_timestamp())::date
      and (
        target_organisation_id is null
        or occurrence_item.organisation_id = target_organisation_id
      )
  loop
    select array_agg(distinct recipient_id)
    into recipient_ids
    from (
      select occurrence_row.owner_membership_id as recipient_id
      union
      select participant_row.membership_id
      from public.schedule_participants participant_row
      where participant_row.organisation_id = occurrence_row.organisation_id
        and participant_row.schedule_definition_id
          = occurrence_row.schedule_definition_id
    ) recipients;

    if recipient_ids is null or cardinality(recipient_ids) = 0 then
      continue;
    end if;

    perform private.enqueue_domain_event(
      occurrence_row.organisation_id,
      occurrence_row.schedule_definition_id,
      'ScheduleOccurrenceReminderDue',
      'schedule-occurrence-reminder:' || occurrence_row.id::text || ':morning-of',
      jsonb_build_object(
        'occurrence_id', occurrence_row.id,
        'schedule_definition_id', occurrence_row.schedule_definition_id,
        'reminder_kind', 'morning-of',
        'planned_local_date', occurrence_row.planned_local_date,
        'title', occurrence_row.title,
        'recipient_membership_ids', to_jsonb(recipient_ids),
        'context_title', occurrence_row.title,
        'context_detail', 'Due ' || occurrence_row.planned_local_date::text,
        'context_link_path', '/platform/schedule/' || occurrence_row.schedule_definition_id::text
      )
    );

    enqueued_count := enqueued_count + 1;
  end loop;

  return enqueued_count;
end;
$$;

create or replace function public.enqueue_due_schedule_occurrence_reminders()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'schedules.manage', null, null) then
    raise exception 'schedule reminder sweep is not authorised'
      using errcode = '42501';
  end if;

  return private.enqueue_due_schedule_occurrence_reminders(org_id);
end;
$$;

create or replace function private.invoke_notification_projector_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_size integer;
begin
  perform private.enqueue_due_schedule_occurrence_reminders(null);

  select scheduler_settings.projector_batch_size
  into batch_size
  from private.notification_worker_scheduler_settings scheduler_settings
  where scheduler_settings.singleton_id = true;

  return private.invoke_notification_edge_worker(
    'notification-projector',
    coalesce(batch_size, 10)
  );
end;
$$;

grant execute on function public.reactivate_schedule_definition(uuid) to authenticated;
grant execute on function public.enqueue_due_schedule_occurrence_reminders() to authenticated;

alter function private.ensure_schedule_occurrences(uuid, integer)
  owner to lean_hub_private_owner;
alter function private.update_schedule_definition(
  uuid, text, uuid, uuid, jsonb, date, boolean, time, date, text, uuid[]
) owner to lean_hub_private_owner;
alter function private.reactivate_schedule_definition(uuid)
  owner to lean_hub_private_owner;
alter function private.enqueue_due_schedule_occurrence_reminders(uuid)
  owner to lean_hub_private_owner;
alter function private.invoke_notification_projector_worker()
  owner to postgres;

grant execute on function private.enqueue_due_schedule_occurrence_reminders(uuid)
  to postgres, lean_hub_private_owner;

revoke all on function public.reactivate_schedule_definition(uuid)
  from public, anon;
revoke all on function public.enqueue_due_schedule_occurrence_reminders()
  from public, anon;

-- Delivery context: add schedule.occurrence_reminder without changing worker grants.

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

alter function private.get_notification_delivery_context(uuid, uuid, uuid)
  owner to postgres;

revoke all on function private.get_notification_delivery_context(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.get_notification_delivery_context(uuid, uuid, uuid)
  to service_role;

revoke all on function public.get_notification_delivery_context_for_worker(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.get_notification_delivery_context_for_worker(uuid, uuid, uuid)
  to service_role;
