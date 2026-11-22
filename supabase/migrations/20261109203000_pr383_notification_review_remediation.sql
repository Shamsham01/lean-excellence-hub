-- PR #383 review remediation: schedule notification links, delegation reason audience, chase href fix.
-- Hosted: apply separately after merge (do not apply from agent).

update public.in_app_notifications
  set href = '/platform/schedule'
  where href = '/platform/scheduling';

create or replace function private.can_view_suggestion_delegation_reason(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_actor_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_actor_membership_id is null then false
    else exists (
      select 1
      from public.improvement_suggestions suggestion_row
      where suggestion_row.organisation_id = target_organisation_id
        and suggestion_row.id = target_suggestion_id
    )
    and (
      exists (
        select 1
        from public.suggestion_approval_delegations delegation_row
        where delegation_row.organisation_id = target_organisation_id
          and delegation_row.suggestion_id = target_suggestion_id
          and (
            delegation_row.to_membership_id = target_actor_membership_id
            or delegation_row.delegated_by_membership_id = target_actor_membership_id
          )
      )
      or (
        not exists (
          select 1
          from public.improvement_suggestions suggestion_row
          where suggestion_row.organisation_id = target_organisation_id
            and suggestion_row.id = target_suggestion_id
            and suggestion_row.author_membership_id = target_actor_membership_id
        )
        and (
          private.can_assign_suggestion_reviewer(
            target_organisation_id,
            (select review_jurisdiction_unit_id from public.improvement_suggestions s where s.organisation_id = target_organisation_id and s.id = target_suggestion_id)
          )
          or private.can_review_suggestion(
            target_organisation_id,
            (select review_jurisdiction_unit_id from public.improvement_suggestions s where s.organisation_id = target_organisation_id and s.id = target_suggestion_id)
          )
          or private.actor_has_suggestion_manager_override(
            target_organisation_id,
            target_suggestion_id,
            target_actor_membership_id
          )
          or private.can_delegate_suggestion_approval(
            target_organisation_id,
            target_suggestion_id,
            target_actor_membership_id
          )
        )
      )
    )
  end;
$$;

create or replace function private.run_in_app_operational_chase_sync_for_actor(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
  daily_cap integer := 12;
  per_member_limit integer := 8;
  slots_remaining integer := 0;
  v_allow_new_inserts boolean := true;
  upsert_count integer := 0;
  new_insert_count integer := 0;
  stale_after interval := interval '72 hours';
  schedule_grace interval := interval '1 day';
  v_eligibility_watermark timestamptz;
  action_limit integer := 0;
  v_schedule_entitled boolean := false;
  v_gemba_entitled boolean := false;
  v_five_s_entitled boolean := false;
begin

  if not private.organisation_in_app_operational_chases_enabled(target_organisation_id) then
    return 0;
  end if;

  select
    coalesce(max(settings_row.daily_new_chase_cap), 12),
    coalesce(max(settings_row.per_member_chase_limit), 8)
  into daily_cap, per_member_limit
  from private.in_app_operational_chase_scheduler_settings settings_row
  where settings_row.singleton_id = true;

  select worker_cursor.chase_eligibility_watermark
  into v_eligibility_watermark
  from private.in_app_chase_worker_cursor worker_cursor
  where worker_cursor.singleton_id = true;

  v_schedule_entitled := private.organisation_plan_capability(
    target_organisation_id,
    'module_schedule'
  );
  v_gemba_entitled := private.organisation_plan_capability(
    target_organisation_id,
    'module_gemba'
  );
  v_five_s_entitled := private.organisation_plan_capability(
    target_organisation_id,
    'module_five_s'
  );

  slots_remaining := private.lock_in_app_chase_daily_budget(
    target_organisation_id,
    target_membership_id,
    per_member_limit
  );
  v_allow_new_inserts := coalesce(slots_remaining, 0) > 0;

  if not v_allow_new_inserts then
    perform private.upsert_in_app_chase_digest(
      target_organisation_id,
      target_membership_id
    );
  end if;

  action_limit := case
    when v_allow_new_inserts and slots_remaining > 0 then slots_remaining
    else 0
  end;

  with overdue_actions as (
    select
      action_row.organisation_id as organisation_id,
      assignee_row.membership_id as membership_id,
      action_row.id as action_id,
      action_row.title as action_title,
      action_row.due_at as due_at
    from public.actions action_row
    join public.action_assignees assignee_row
      on assignee_row.organisation_id = action_row.organisation_id
     and assignee_row.action_id = action_row.id
    left join public.in_app_notifications existing_chase_row
      on existing_chase_row.organisation_id = action_row.organisation_id
     and existing_chase_row.membership_id = assignee_row.membership_id
     and existing_chase_row.dedupe_key =
       'overdue_action:' || action_row.id::text || ':' || assignee_row.membership_id::text
    where action_row.organisation_id = target_organisation_id
      and assignee_row.membership_id = target_membership_id
      and action_row.status in ('open', 'in_progress')
      and action_row.due_at is not null
      and action_row.due_at < clock_timestamp()
      and (
        v_eligibility_watermark is null
        or action_row.due_at >= v_eligibility_watermark
      )
      and v_allow_new_inserts
    order by (existing_chase_row.id is not null)::int, action_row.due_at
    limit action_limit
  ),
  upserted_actions as (
    insert into public.in_app_notifications (
      organisation_id,
      membership_id,
      notification_type,
      title,
      body,
      href,
      dedupe_key
    )
    select
      overdue_actions.organisation_id,
      overdue_actions.membership_id,
      'leanai.chase_overdue_action',
      'Overdue action',
      left(
        btrim(overdue_actions.action_title) || ' was due '
        || to_char(overdue_actions.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        4000
      ),
      '/platform/actions/' || overdue_actions.action_id::text,
      'overdue_action:' || overdue_actions.action_id::text || ':' || overdue_actions.membership_id::text
    from overdue_actions
    on conflict (organisation_id, membership_id, dedupe_key) do update set
      title = excluded.title,
      body = excluded.body,
      href = excluded.href,
      notification_type = excluded.notification_type
    returning (xmax = 0) as inserted
  )
  select count(*)::integer,
         count(*) filter (where inserted)::integer
  into upsert_count, new_insert_count
  from upserted_actions;
  affected := affected + coalesce(upsert_count, 0);
  perform private.record_in_app_chase_new_inserts(
    target_organisation_id,
    target_membership_id,
    coalesce(new_insert_count, 0)
  );
  slots_remaining := greatest(slots_remaining - coalesce(new_insert_count, 0), 0);
  v_allow_new_inserts := coalesce(slots_remaining, 0) > 0;

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'leanai.chase_overdue_action'
    and notification_row.dedupe_key like 'overdue_action:%'
    and (
      v_eligibility_watermark is null
      or notification_row.created_at >= v_eligibility_watermark
    )
    and not exists (
      select 1
      from public.actions action_row
      join public.action_assignees assignee_row
        on assignee_row.organisation_id = action_row.organisation_id
       and assignee_row.action_id = action_row.id
      where action_row.organisation_id = target_organisation_id
        and assignee_row.membership_id = target_membership_id
        and action_row.status in ('open', 'in_progress')
        and action_row.due_at is not null
        and action_row.due_at < clock_timestamp()
        and (
          v_eligibility_watermark is null
          or action_row.due_at >= v_eligibility_watermark
        )
        and notification_row.dedupe_key = (
          'overdue_action:' || action_row.id::text || ':' || target_membership_id::text
        )
    );

  with overdue_schedules as (
    select
      occurrence_row.organisation_id,
      occurrence_row.owner_membership_id as membership_id,
      occurrence_row.id as occurrence_id,
      occurrence_row.planned_at,
      occurrence_row.planned_local_date,
      unit_row.name as unit_name
    from public.schedule_occurrences occurrence_row
    join public.organisation_units unit_row
      on unit_row.organisation_id = occurrence_row.organisation_id
     and unit_row.id = occurrence_row.unit_id
    left join public.in_app_notifications existing_chase_row
      on existing_chase_row.organisation_id = occurrence_row.organisation_id
     and existing_chase_row.membership_id = occurrence_row.owner_membership_id
     and existing_chase_row.dedupe_key =
       'overdue_schedule:' || occurrence_row.id::text || ':' || occurrence_row.owner_membership_id::text
    where occurrence_row.organisation_id = target_organisation_id
      and occurrence_row.owner_membership_id = target_membership_id
      and occurrence_row.lifecycle_status = 'open'
      and occurrence_row.planned_at < clock_timestamp() - schedule_grace
      and (
        v_eligibility_watermark is null
        or (occurrence_row.planned_at + schedule_grace) >= v_eligibility_watermark
      )
      and v_allow_new_inserts
      and v_schedule_entitled
    order by (existing_chase_row.id is not null)::int, occurrence_row.planned_at
    limit case
      when v_allow_new_inserts and slots_remaining > 0 and v_schedule_entitled
        then greatest(slots_remaining, 0)
      else 0
    end
  ),
  upserted_schedules as (
    insert into public.in_app_notifications (
      organisation_id,
      membership_id,
      notification_type,
      title,
      body,
      href,
      dedupe_key
    )
    select
      overdue_schedules.organisation_id,
      overdue_schedules.membership_id,
      'leanai.chase_overdue_schedule',
      'Overdue scheduled item',
      left(
        coalesce(overdue_schedules.unit_name, 'Scheduled work')
        || ' was due '
        || overdue_schedules.planned_local_date::text,
        4000
      ),
      '/platform/schedule',
      'overdue_schedule:' || overdue_schedules.occurrence_id::text || ':' || overdue_schedules.membership_id::text
    from overdue_schedules
    on conflict (organisation_id, membership_id, dedupe_key) do update set
      title = excluded.title,
      body = excluded.body,
      href = excluded.href,
      notification_type = excluded.notification_type
    returning (xmax = 0) as inserted
  )
  select count(*)::integer,
         count(*) filter (where inserted)::integer
  into upsert_count, new_insert_count
  from upserted_schedules;
  affected := affected + coalesce(upsert_count, 0);
  perform private.record_in_app_chase_new_inserts(
    target_organisation_id,
    target_membership_id,
    coalesce(new_insert_count, 0)
  );
  slots_remaining := greatest(slots_remaining - coalesce(new_insert_count, 0), 0);
  v_allow_new_inserts := coalesce(slots_remaining, 0) > 0;

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'leanai.chase_overdue_schedule'
    and notification_row.dedupe_key like 'overdue_schedule:%'
    and (
      v_eligibility_watermark is null
      or notification_row.created_at >= v_eligibility_watermark
    )
    and not exists (
      select 1
      from public.schedule_occurrences occurrence_row
      where occurrence_row.organisation_id = target_organisation_id
        and occurrence_row.owner_membership_id = target_membership_id
        and occurrence_row.lifecycle_status = 'open'
        and occurrence_row.planned_at < clock_timestamp() - schedule_grace
        and (
          v_eligibility_watermark is null
          or (occurrence_row.planned_at + schedule_grace) >= v_eligibility_watermark
        )
        and notification_row.dedupe_key = (
          'overdue_schedule:' || occurrence_row.id::text || ':' || target_membership_id::text
        )
    );

  with stale_walks as (
    select
      walk_row.organisation_id,
      walk_row.leader_membership_id as membership_id,
      walk_row.id as walk_id,
      coalesce(walk_row.unit_name_snapshot, 'Gemba walk') as label
    from public.gemba_walks walk_row
    left join public.in_app_notifications existing_chase_row
      on existing_chase_row.organisation_id = walk_row.organisation_id
     and existing_chase_row.membership_id = walk_row.leader_membership_id
     and existing_chase_row.dedupe_key =
       'stale_walk:' || walk_row.id::text || ':' || walk_row.leader_membership_id::text
    where walk_row.organisation_id = target_organisation_id
      and walk_row.leader_membership_id = target_membership_id
      and walk_row.status = 'in_progress'
      and coalesce(walk_row.started_at, walk_row.created_at) < clock_timestamp() - stale_after
      and (
        v_eligibility_watermark is null
        or (coalesce(walk_row.started_at, walk_row.created_at) + stale_after) >= v_eligibility_watermark
      )
      and v_allow_new_inserts
      and v_gemba_entitled
    order by (existing_chase_row.id is not null)::int,
      coalesce(walk_row.started_at, walk_row.created_at)
    limit case
      when v_allow_new_inserts and slots_remaining > 0 and v_gemba_entitled
        then greatest(slots_remaining, 0)
      else 0
    end
  ),
  upserted_walks as (
    insert into public.in_app_notifications (
      organisation_id,
      membership_id,
      notification_type,
      title,
      body,
      href,
      dedupe_key
    )
    select
      stale_walks.organisation_id,
      stale_walks.membership_id,
      'leanai.chase_stale_walk',
      'Unfinished gemba walk',
      left(stale_walks.label || ' has been in progress for several days.', 4000),
      '/platform/gemba/walks/' || stale_walks.walk_id::text,
      'stale_walk:' || stale_walks.walk_id::text || ':' || stale_walks.membership_id::text
    from stale_walks
    on conflict (organisation_id, membership_id, dedupe_key) do update set
      title = excluded.title,
      body = excluded.body,
      href = excluded.href,
      notification_type = excluded.notification_type
    returning (xmax = 0) as inserted
  )
  select count(*)::integer,
         count(*) filter (where inserted)::integer
  into upsert_count, new_insert_count
  from upserted_walks;
  affected := affected + coalesce(upsert_count, 0);
  perform private.record_in_app_chase_new_inserts(
    target_organisation_id,
    target_membership_id,
    coalesce(new_insert_count, 0)
  );
  slots_remaining := greatest(slots_remaining - coalesce(new_insert_count, 0), 0);
  v_allow_new_inserts := coalesce(slots_remaining, 0) > 0;

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'leanai.chase_stale_walk'
    and notification_row.dedupe_key like 'stale_walk:%'
    and (
      v_eligibility_watermark is null
      or notification_row.created_at >= v_eligibility_watermark
    )
    and not exists (
      select 1
      from public.gemba_walks walk_row
      where walk_row.organisation_id = target_organisation_id
        and walk_row.leader_membership_id = target_membership_id
        and walk_row.status = 'in_progress'
        and coalesce(walk_row.started_at, walk_row.created_at) < clock_timestamp() - stale_after
        and (
          v_eligibility_watermark is null
          or (coalesce(walk_row.started_at, walk_row.created_at) + stale_after) >= v_eligibility_watermark
        )
        and notification_row.dedupe_key = (
          'stale_walk:' || walk_row.id::text || ':' || target_membership_id::text
        )
    );

  with stale_audits as (
    select
      audit_row.organisation_id,
      audit_row.auditor_membership_id as membership_id,
      audit_row.id as audit_id,
      coalesce(audit_row.unit_name_snapshot, '5S audit') as label
    from public.five_s_audits audit_row
    left join public.in_app_notifications existing_chase_row
      on existing_chase_row.organisation_id = audit_row.organisation_id
     and existing_chase_row.membership_id = audit_row.auditor_membership_id
     and existing_chase_row.dedupe_key =
       'stale_audit:' || audit_row.id::text || ':' || audit_row.auditor_membership_id::text
    where audit_row.organisation_id = target_organisation_id
      and audit_row.auditor_membership_id = target_membership_id
      and audit_row.status = 'in_progress'
      and coalesce(audit_row.started_at, audit_row.created_at) < clock_timestamp() - stale_after
      and (
        v_eligibility_watermark is null
        or (coalesce(audit_row.started_at, audit_row.created_at) + stale_after) >= v_eligibility_watermark
      )
      and v_allow_new_inserts
      and v_five_s_entitled
    order by (existing_chase_row.id is not null)::int,
      coalesce(audit_row.started_at, audit_row.created_at)
    limit case
      when v_allow_new_inserts and slots_remaining > 0 and v_five_s_entitled
        then greatest(slots_remaining, 0)
      else 0
    end
  ),
  upserted_audits as (
    insert into public.in_app_notifications (
      organisation_id,
      membership_id,
      notification_type,
      title,
      body,
      href,
      dedupe_key
    )
    select
      stale_audits.organisation_id,
      stale_audits.membership_id,
      'leanai.chase_stale_audit',
      'Unfinished 5S audit',
      left(stale_audits.label || ' has been in progress for several days.', 4000),
      '/platform/5s/audits/' || stale_audits.audit_id::text,
      'stale_audit:' || stale_audits.audit_id::text || ':' || stale_audits.membership_id::text
    from stale_audits
    on conflict (organisation_id, membership_id, dedupe_key) do update set
      title = excluded.title,
      body = excluded.body,
      href = excluded.href,
      notification_type = excluded.notification_type
    returning (xmax = 0) as inserted
  )
  select count(*)::integer,
         count(*) filter (where inserted)::integer
  into upsert_count, new_insert_count
  from upserted_audits;
  affected := affected + coalesce(upsert_count, 0);
  perform private.record_in_app_chase_new_inserts(
    target_organisation_id,
    target_membership_id,
    coalesce(new_insert_count, 0)
  );
  slots_remaining := greatest(slots_remaining - coalesce(new_insert_count, 0), 0);
  v_allow_new_inserts := coalesce(slots_remaining, 0) > 0;

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'leanai.chase_stale_audit'
    and notification_row.dedupe_key like 'stale_audit:%'
    and (
      v_eligibility_watermark is null
      or notification_row.created_at >= v_eligibility_watermark
    )
    and not exists (
      select 1
      from public.five_s_audits audit_row
      where audit_row.organisation_id = target_organisation_id
        and audit_row.auditor_membership_id = target_membership_id
        and audit_row.status = 'in_progress'
        and coalesce(audit_row.started_at, audit_row.created_at) < clock_timestamp() - stale_after
        and (
          v_eligibility_watermark is null
          or (coalesce(audit_row.started_at, audit_row.created_at) + stale_after) >= v_eligibility_watermark
        )
        and notification_row.dedupe_key = (
          'stale_audit:' || audit_row.id::text || ':' || target_membership_id::text
        )
    );

  perform private.upsert_in_app_chase_digest(
    target_organisation_id,
    target_membership_id
  );

  return coalesce(affected, 0);
end;
$$;

revoke all on function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid)
  to postgres;
alter function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid)
  owner to lean_hub_private_owner;

-- Delegation reason audience + review/detail payloads

create or replace function private.lookup_suggestion_delegation_reason_for_recipient(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_recipient_membership_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(delegation_row.reason, 500)
  from public.suggestion_approval_delegations delegation_row
  where delegation_row.organisation_id = target_organisation_id
    and delegation_row.suggestion_id = target_suggestion_id
    and delegation_row.to_membership_id = target_recipient_membership_id
    and delegation_row.reason is not null
    and btrim(delegation_row.reason) <> ''
    and private.can_view_suggestion_delegation_reason(
      target_organisation_id,
      target_suggestion_id,
      target_recipient_membership_id
    )
  order by delegation_row.created_at desc
  limit 1;
$$;


create or replace function public.get_suggestion_review_context(
  target_suggestion_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid;
  suggestion_row public.improvement_suggestions%rowtype;
  can_view_metadata boolean;
  has_active_reviewer boolean;
  active_reviewer_member_id uuid;
  active_reviewer_display_name text;
  active_reviewer_assignment_kind text;
  active_reviewer_assigned_at timestamptz;
  eligible_assign_reviewers jsonb := '[]'::jsonb;
  eligible_delegate_reviewers jsonb := '[]'::jsonb;
  eligible_reviewers jsonb := '[]'::jsonb;
  primary_approver_member_id uuid;
  primary_approver_display_name text;
  task_owner_member_id uuid;
  task_owner_display_name text;
  delegate_authority text;
  latest_delegation jsonb := null;
  can_view_delegation_reason boolean := false;
begin
  if org_id is null then
    raise exception 'review context is not authorised' using errcode = '42501';
  end if;

  actor_membership_id := private.current_membership_id(org_id);

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;

  can_view_delegation_reason := private.can_view_suggestion_delegation_reason(
    org_id,
    suggestion_row.id,
    actor_membership_id
  );

  can_view_metadata := private.can_view_suggestion_reviewer_metadata(
    org_id,
    suggestion_row.id,
    suggestion_row.review_jurisdiction_unit_id,
    actor_membership_id
  );

  has_active_reviewer := private.suggestion_has_active_reviewer(org_id, suggestion_row.id);

  select
    routing_row.primary_approver_membership_id,
    routing_row.task_owner_membership_id
  into primary_approver_member_id, task_owner_member_id
  from public.suggestion_approval_routing routing_row
  where routing_row.organisation_id = org_id
    and routing_row.suggestion_id = suggestion_row.id;

  if primary_approver_member_id is not null then
    select nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name)), '')
    into primary_approver_display_name
    from public.organisation_memberships membership_row
    left join public.profiles profile_row on profile_row.user_id = membership_row.user_id
    where membership_row.organisation_id = org_id
      and membership_row.id = primary_approver_member_id;
  end if;

  if task_owner_member_id is not null then
    select nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name)), '')
    into task_owner_display_name
    from public.organisation_memberships membership_row
    left join public.profiles profile_row on profile_row.user_id = membership_row.user_id
    where membership_row.organisation_id = org_id
      and membership_row.id = task_owner_member_id;
  end if;

  if can_view_metadata then
    select
      assignment_row.reviewer_membership_id,
      nullif(btrim(coalesce(reviewer_membership.display_name, reviewer_profile.display_name)), ''),
      assignment_row.assignment_kind,
      assignment_row.assigned_at
    into
      active_reviewer_member_id,
      active_reviewer_display_name,
      active_reviewer_assignment_kind,
      active_reviewer_assigned_at
    from public.suggestion_review_assignments assignment_row
    left join public.organisation_memberships reviewer_membership
      on reviewer_membership.organisation_id = assignment_row.organisation_id
      and reviewer_membership.id = assignment_row.reviewer_membership_id
    left join public.profiles reviewer_profile
      on reviewer_profile.user_id = reviewer_membership.user_id
    where assignment_row.organisation_id = org_id
      and assignment_row.suggestion_id = suggestion_row.id
      and assignment_row.status = 'active'
    limit 1;
  end if;

  if private.can_delegate_suggestion_approval(org_id, suggestion_row.id, actor_membership_id) then
    if private.actor_has_suggestion_manager_override(org_id, suggestion_row.id, actor_membership_id) then
      delegate_authority := 'manager_override';
    elsif private.is_active_suggestion_reviewer(org_id, suggestion_row.id, actor_membership_id) then
      delegate_authority := 'active_reviewer';
    else
      delegate_authority := 'primary_approver';
    end if;
  else
    delegate_authority := null;
  end if;

  if private.can_assign_suggestion_reviewer(
    org_id,
    suggestion_row.review_jurisdiction_unit_id
  )
  and suggestion_row.status in ('submitted', 'under_review', 'parked') then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'member_id', eligible_row.member_id,
          'display_name', eligible_row.display_name
        )
        order by eligible_row.display_name nulls last, eligible_row.member_id
      ),
      '[]'::jsonb
    )
    into eligible_assign_reviewers
    from (
      select
        membership_row.id as member_id,
        nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name)), '') as display_name
      from public.organisation_memberships membership_row
      left join public.profiles profile_row on profile_row.user_id = membership_row.user_id
      where membership_row.organisation_id = org_id
        and membership_row.status = 'active'
        and private.membership_can_review_suggestion_jurisdiction(
          org_id,
          membership_row.id,
          suggestion_row.review_jurisdiction_unit_id
        )
    ) eligible_row;
  end if;

  if delegate_authority is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'member_id', eligible_row.member_id,
          'display_name', eligible_row.display_name
        )
        order by eligible_row.display_name nulls last, eligible_row.member_id
      ),
      '[]'::jsonb
    )
    into eligible_delegate_reviewers
    from (
      select
        membership_row.id as member_id,
        nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name)), '') as display_name
      from public.organisation_memberships membership_row
      left join public.profiles profile_row on profile_row.user_id = membership_row.user_id
      where membership_row.organisation_id = org_id
        and membership_row.status = 'active'
        and membership_row.id is distinct from suggestion_row.author_membership_id
        and membership_row.id is distinct from actor_membership_id
        and private.membership_can_review_suggestion_jurisdiction(
          org_id,
          membership_row.id,
          suggestion_row.review_jurisdiction_unit_id
        )
    ) eligible_row;
  end if;

  if private.can_read_improvement_suggestion(org_id, suggestion_row.id) then
    select jsonb_build_object(
      'delegated_by_display_name', nullif(
        btrim(coalesce(by_membership.display_name, by_profile.display_name)),
        ''
      ),
      'delegated_at', delegation_row.created_at,
      'reason', case
        when can_view_delegation_reason then delegation_row.reason
        else null
      end,
      'to_member_id', delegation_row.to_membership_id,
      'delegated_by_member_id', delegation_row.delegated_by_membership_id
    )
    into latest_delegation
    from public.suggestion_approval_delegations delegation_row
    join public.organisation_memberships by_membership
      on by_membership.organisation_id = delegation_row.organisation_id
     and by_membership.id = delegation_row.delegated_by_membership_id
    left join public.profiles by_profile
      on by_profile.user_id = by_membership.user_id
    where delegation_row.organisation_id = org_id
      and delegation_row.suggestion_id = suggestion_row.id
    order by delegation_row.created_at desc
    limit 1;
  end if;

  eligible_reviewers := eligible_assign_reviewers;

  return jsonb_build_object(
    'suggestion', jsonb_build_object(
      'id', suggestion_row.id,
      'suggestion_number', suggestion_row.suggestion_number,
      'title', suggestion_row.title,
      'status', suggestion_row.status,
      'problem_or_opportunity', suggestion_row.problem_or_opportunity,
      'proposed_idea', suggestion_row.proposed_idea,
      'category_name', suggestion_row.category_name_snapshot,
      'programme_name', suggestion_row.programme_name_snapshot,
      'origin_unit_name', suggestion_row.origin_unit_name_snapshot,
      'submitted_at', suggestion_row.submitted_at,
      'created_at', suggestion_row.created_at,
      'updated_at', suggestion_row.updated_at,
      'parked_at', suggestion_row.parked_at,
      'parked_rationale', suggestion_row.parked_rationale
    ),
    'reviewer', case
      when can_view_metadata and active_reviewer_member_id is not null then
        jsonb_build_object(
          'member_id', active_reviewer_member_id,
          'display_name', active_reviewer_display_name,
          'assignment_kind', active_reviewer_assignment_kind,
          'assigned_at', active_reviewer_assigned_at
        )
      else null
    end,
    'pending_approver', case
      when can_view_metadata and primary_approver_member_id is not null then
        jsonb_build_object(
          'member_id', primary_approver_member_id,
          'display_name', primary_approver_display_name
        )
      else null
    end,
    'task_owner', case
      when can_view_metadata and task_owner_member_id is not null then
        jsonb_build_object(
          'member_id', task_owner_member_id,
          'display_name', task_owner_display_name
        )
      else null
    end,
    'permissions', jsonb_build_object(
      'is_active_reviewer', private.is_active_suggestion_reviewer(
        org_id,
        suggestion_row.id,
        actor_membership_id
      ),
      'can_claim',
        suggestion_row.status = 'submitted'
        and not has_active_reviewer
        and private.can_claim_suggestion_for_review(
          org_id,
          suggestion_row.review_jurisdiction_unit_id
        ),
      'can_assign',
        suggestion_row.status in ('submitted', 'under_review', 'parked')
        and private.can_assign_suggestion_reviewer(
          org_id,
          suggestion_row.review_jurisdiction_unit_id
        ),
      'can_delegate', delegate_authority is not null,
      'delegation_authority', delegate_authority,
      'can_begin_review',
        suggestion_row.status in ('submitted', 'parked')
        and private.can_act_as_active_suggestion_reviewer(
          org_id,
          suggestion_row.id,
          actor_membership_id
        ),
      'can_record_review',
        suggestion_row.status = 'under_review'
        and private.can_act_as_active_suggestion_reviewer(
          org_id,
          suggestion_row.id,
          actor_membership_id
        )
    ),
    'eligible_reviewers', eligible_reviewers,
    'eligible_assign_reviewers', eligible_assign_reviewers,
    'eligible_delegate_reviewers', eligible_delegate_reviewers,
    'latest_delegation', latest_delegation
  );
end;
$$;

create or replace function public.get_suggestion_detail(target_suggestion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  suggestion_row public.improvement_suggestions%rowtype;
  linked_actions jsonb;
  linked_projects jsonb;
  approval_delegations jsonb := '[]'::jsonb;
  actor_membership_id uuid;
  can_view_delegation_reason boolean := false;
begin
  actor_membership_id := private.current_membership_id(org_id);

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion detail is not authorised'
      using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  can_view_delegation_reason := private.can_view_suggestion_delegation_reason(
    org_id,
    suggestion_row.id,
    actor_membership_id
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', action_row.id,
        'action_number', action_row.action_number,
        'title', action_row.title,
        'status', action_row.status,
        'href', '/platform/actions/' || action_row.id::text,
        'can_open', private.can_read_action(org_id, action_row.id)
      )
      order by action_row.created_at, action_row.id
    ),
    '[]'::jsonb
  )
  into linked_actions
  from public.suggestion_action_context context_row
  join public.actions action_row
    on action_row.organisation_id = context_row.organisation_id
   and action_row.id = context_row.action_id
  where context_row.organisation_id = org_id
    and context_row.suggestion_id = target_suggestion_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', project_row.id,
        'project_number', project_row.project_number,
        'title', project_row.title,
        'status', project_row.status,
        'href', '/platform/projects/' || project_row.id::text,
        'can_open', private.can_read_ci_project(org_id, project_row.id)
      )
      order by project_row.created_at, project_row.id
    ),
    '[]'::jsonb
  )
  into linked_projects
  from public.suggestion_implementation_links link_row
  join public.ci_projects project_row
    on project_row.organisation_id = link_row.organisation_id
   and project_row.id = link_row.implementation_resource_id
  where link_row.organisation_id = org_id
    and link_row.suggestion_id = target_suggestion_id
    and link_row.implementation_role = 'ci_project';


  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', delegation_row.id,
        'delegated_at', delegation_row.created_at,
        'reason', case
          when can_view_delegation_reason then delegation_row.reason
          else null
        end,
        'delegated_by_display_name', nullif(
          btrim(coalesce(by_membership.display_name, by_profile.display_name)),
          ''
        ),
        'to_display_name', nullif(
          btrim(coalesce(to_membership.display_name, to_profile.display_name)),
          ''
        )
      )
      order by delegation_row.created_at desc
    ),
    '[]'::jsonb
  )
  into approval_delegations
  from public.suggestion_approval_delegations delegation_row
  join public.organisation_memberships by_membership
    on by_membership.organisation_id = delegation_row.organisation_id
   and by_membership.id = delegation_row.delegated_by_membership_id
  join public.organisation_memberships to_membership
    on to_membership.organisation_id = delegation_row.organisation_id
   and to_membership.id = delegation_row.to_membership_id
  left join public.profiles by_profile
    on by_profile.user_id = by_membership.user_id
  left join public.profiles to_profile
    on to_profile.user_id = to_membership.user_id
  where delegation_row.organisation_id = org_id
    and delegation_row.suggestion_id = target_suggestion_id;

  return jsonb_build_object(
    'id', suggestion_row.id,
    'suggestion_number', suggestion_row.suggestion_number,
    'title', suggestion_row.title,
    'problem_or_opportunity', suggestion_row.problem_or_opportunity,
    'proposed_idea', suggestion_row.proposed_idea,
    'expected_benefit_summary', suggestion_row.expected_benefit_summary,
    'status', suggestion_row.status,
    'programme_name_snapshot', suggestion_row.programme_name_snapshot,
    'category_name_snapshot', suggestion_row.category_name_snapshot,
    'origin_unit_name_snapshot', suggestion_row.origin_unit_name_snapshot,
    'target_unit_name_snapshot', suggestion_row.target_unit_name_snapshot,
    'author_membership_id', suggestion_row.author_membership_id,
    'submitted_at', suggestion_row.submitted_at,
    'implementation_summary', suggestion_row.implementation_summary,
    'implementation_outcome', suggestion_row.implementation_outcome,
    'employee_outcome', suggestion_row.employee_outcome,
    'implemented_at', suggestion_row.implemented_at,
    'linked_actions', linked_actions,
    'linked_projects', linked_projects,
    'approval_delegations', approval_delegations
  );
end;
$$;

revoke all on function private.can_view_suggestion_delegation_reason(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.can_view_suggestion_delegation_reason(uuid, uuid, uuid)
  to postgres, lean_hub_private_owner;
alter function private.can_view_suggestion_delegation_reason(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
