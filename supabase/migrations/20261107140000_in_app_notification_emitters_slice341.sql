-- Issue #341: wire high-signal in-app notification emitters (suggestions + LeanAI chases).

-- ---------------------------------------------------------------------------
-- Per-membership chase sync throttle (bell load / RPC; avoids spammy re-upserts)
-- ---------------------------------------------------------------------------

create table if not exists private.in_app_notification_chase_sync_state (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  membership_id uuid not null,
  last_synced_at timestamptz not null default '-infinity'::timestamptz,
  constraint in_app_notification_chase_sync_state_pkey
    primary key (organisation_id, membership_id),
  constraint in_app_notification_chase_sync_state_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete cascade
);

comment on table private.in_app_notification_chase_sync_state is
  'Throttle for operational chase notification sync per active membership.';

alter table private.in_app_notification_chase_sync_state enable row level security;
alter table private.in_app_notification_chase_sync_state force row level security;

revoke all on private.in_app_notification_chase_sync_state from public, anon, authenticated, service_role;
grant select, insert, update, delete on private.in_app_notification_chase_sync_state to lean_hub_private_owner;
grant select, insert, update, delete on private.in_app_notification_chase_sync_state to postgres;

create policy private_owner_all_in_app_notification_chase_sync_state
on private.in_app_notification_chase_sync_state for all to lean_hub_private_owner
using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Suggestion status: fix manager queue on operator submit + author receipt
-- ---------------------------------------------------------------------------

create or replace function private.notify_in_app_for_suggestion_status_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  suggestion_title text;
  suggestion_number text;
  author_id uuid;
  jurisdiction_unit uuid;
  origin_unit uuid;
  resource_href text;
  display_label text;
  body_text text;
  dedupe text;
  type_key text;
  mgr record;
begin
  select
    coalesce(nullif(btrim(suggestion_row.suggestion_number), ''), suggestion_row.title),
    suggestion_row.title,
    suggestion_row.author_membership_id,
    suggestion_row.review_jurisdiction_unit_id,
    suggestion_row.origin_unit_id
  into suggestion_number, suggestion_title, author_id, jurisdiction_unit, origin_unit
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = new.organisation_id
    and suggestion_row.id = new.suggestion_id;

  if suggestion_title is null then
    return new;
  end if;

  display_label := coalesce(nullif(suggestion_number, suggestion_title), suggestion_title);
  resource_href := '/platform/suggestions/' || new.suggestion_id::text;

  -- Managers / reviewers: idea entered the approval queue (operator submit included).
  if new.to_status = 'submitted' then
    for mgr in
      select distinct membership_row.id as id
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = new.organisation_id
        and membership_row.status = 'active'
        and membership_row.id is distinct from author_id
        and membership_row.id is distinct from new.changed_by_membership_id
        and (
          private.membership_has_scoped_permission(
            membership_row.id,
            new.organisation_id,
            'suggestions.manage',
            null,
            jurisdiction_unit
          )
          or private.membership_has_scoped_permission(
            membership_row.id,
            new.organisation_id,
            'suggestions.manage',
            null,
            origin_unit
          )
          or private.membership_can_review_suggestion_jurisdiction(
            new.organisation_id,
            membership_row.id,
            jurisdiction_unit
          )
        )
    loop
      perform private.insert_membership_in_app_notification(
        new.organisation_id,
        mgr.id,
        'suggestions.awaiting_review',
        'Idea submitted for review',
        display_label || ' was submitted and is waiting for review.',
        '/platform/suggestions/review?queue=all&suggestionId=' || new.suggestion_id::text,
        'suggestion:' || new.suggestion_id::text || ':submitted'
      );
    end loop;

    if author_id is not null then
      perform private.insert_membership_in_app_notification(
        new.organisation_id,
        author_id,
        'suggestions.status_submitted',
        'Idea submitted',
        display_label || ' was submitted successfully.',
        resource_href,
        'suggestion:' || new.suggestion_id::text || ':status:submitted'
      );
    end if;
  end if;

  if author_id is null then
    return new;
  end if;

  if new.to_status = 'under_review' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_under_review';
    body_text := display_label || ' is now under review.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:under_review';
  elsif new.to_status = 'accepted' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_accepted';
    body_text := display_label || ' was accepted.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:accepted';
  elsif new.to_status = 'rejected' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_rejected';
    body_text := display_label || ' was declined.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:rejected';
  elsif new.to_status = 'parked' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_parked';
    body_text := display_label || ' was parked for further consideration.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:parked';
  elsif new.to_status = 'implemented' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_implemented';
    body_text := display_label || ' was marked implemented.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:implemented';
  elsif new.to_status = 'withdrawn' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_withdrawn';
    body_text := display_label || ' was withdrawn.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:withdrawn';
  else
    return new;
  end if;

  perform private.insert_membership_in_app_notification(
    new.organisation_id,
    author_id,
    type_key,
    case new.to_status
      when 'under_review' then 'Idea under review'
      when 'accepted' then 'Idea accepted'
      when 'rejected' then 'Idea declined'
      when 'parked' then 'Idea parked'
      when 'implemented' then 'Idea implemented'
      when 'withdrawn' then 'Idea withdrawn'
      else 'Idea updated'
    end,
    body_text,
    resource_href,
    dedupe
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operational chase sync (overdue actions, schedules, stale audits / walks)
-- ---------------------------------------------------------------------------

grant select on public.actions to lean_hub_private_owner;
grant select on public.action_assignees to lean_hub_private_owner;
grant select on public.schedule_occurrences to lean_hub_private_owner;
grant select on public.organisation_units to lean_hub_private_owner;
grant select on public.gemba_walks to lean_hub_private_owner;
grant select on public.five_s_audits to lean_hub_private_owner;

drop policy if exists private_owner_all_actions on public.actions;
create policy private_owner_all_actions
on public.actions for all to lean_hub_private_owner using (true) with check (true);

drop policy if exists private_owner_all_action_assignees on public.action_assignees;
create policy private_owner_all_action_assignees
on public.action_assignees for all to lean_hub_private_owner using (true) with check (true);

drop policy if exists private_owner_all_schedule_occurrences on public.schedule_occurrences;
create policy private_owner_all_schedule_occurrences
on public.schedule_occurrences for all to lean_hub_private_owner using (true) with check (true);

drop policy if exists private_owner_all_organisation_units_inapp on public.organisation_units;
create policy private_owner_all_organisation_units_inapp
on public.organisation_units for all to lean_hub_private_owner using (true) with check (true);

drop policy if exists private_owner_all_gemba_walks on public.gemba_walks;
create policy private_owner_all_gemba_walks
on public.gemba_walks for all to lean_hub_private_owner using (true) with check (true);

drop policy if exists private_owner_all_five_s_audits on public.five_s_audits;
create policy private_owner_all_five_s_audits
on public.five_s_audits for all to lean_hub_private_owner using (true) with check (true);

create or replace function private.try_begin_in_app_operational_chase_sync(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  chase_interval interval := interval '15 minutes';
  prior_last_synced timestamptz;
begin
  insert into private.in_app_notification_chase_sync_state (
    organisation_id,
    membership_id,
    last_synced_at
  ) values (
    target_organisation_id,
    target_membership_id,
    '-infinity'::timestamptz
  )
  on conflict (organisation_id, membership_id) do nothing;

  select sync_state.last_synced_at
  into prior_last_synced
  from private.in_app_notification_chase_sync_state sync_state
  where sync_state.organisation_id = target_organisation_id
    and sync_state.membership_id = target_membership_id
  for update;

  if prior_last_synced > statement_timestamp() - chase_interval then
    return false;
  end if;

  update private.in_app_notification_chase_sync_state sync_state
  set last_synced_at = statement_timestamp()
  where sync_state.organisation_id = target_organisation_id
    and sync_state.membership_id = target_membership_id;

  return true;
end;
$$;

revoke all on function private.try_begin_in_app_operational_chase_sync(uuid, uuid) from public;
grant execute on function private.try_begin_in_app_operational_chase_sync(uuid, uuid) to postgres;
alter function private.try_begin_in_app_operational_chase_sync(uuid, uuid) owner to lean_hub_private_owner;

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
  upsert_count integer := 0;
  stale_after interval := interval '72 hours';
  schedule_grace interval := interval '1 day';
begin
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
    where action_row.organisation_id = target_organisation_id
      and assignee_row.membership_id = target_membership_id
      and action_row.status in ('open', 'in_progress')
      and action_row.due_at is not null
      and action_row.due_at < clock_timestamp()
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
    returning 1
  )
  select count(*) into upsert_count from upserted_actions;
  affected := affected + coalesce(upsert_count, 0);

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'leanai.chase_overdue_action'
    and notification_row.dedupe_key like 'overdue_action:%'
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
    where occurrence_row.organisation_id = target_organisation_id
      and occurrence_row.owner_membership_id = target_membership_id
      and occurrence_row.lifecycle_status = 'open'
      and occurrence_row.planned_at < clock_timestamp() - schedule_grace
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
      '/platform/scheduling',
      'overdue_schedule:' || overdue_schedules.occurrence_id::text || ':' || overdue_schedules.membership_id::text
    from overdue_schedules
    on conflict (organisation_id, membership_id, dedupe_key) do update set
      title = excluded.title,
      body = excluded.body,
      href = excluded.href,
      notification_type = excluded.notification_type
    returning 1
  )
  select count(*) into upsert_count from upserted_schedules;
  affected := affected + coalesce(upsert_count, 0);

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'leanai.chase_overdue_schedule'
    and notification_row.dedupe_key like 'overdue_schedule:%'
    and not exists (
      select 1
      from public.schedule_occurrences occurrence_row
      where occurrence_row.organisation_id = target_organisation_id
        and occurrence_row.owner_membership_id = target_membership_id
        and occurrence_row.lifecycle_status = 'open'
        and occurrence_row.planned_at < clock_timestamp() - schedule_grace
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
    where walk_row.organisation_id = target_organisation_id
      and walk_row.leader_membership_id = target_membership_id
      and walk_row.status = 'in_progress'
      and coalesce(walk_row.started_at, walk_row.created_at) < clock_timestamp() - stale_after
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
    returning 1
  )
  select count(*) into upsert_count from upserted_walks;
  affected := affected + coalesce(upsert_count, 0);

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'leanai.chase_stale_walk'
    and notification_row.dedupe_key like 'stale_walk:%'
    and not exists (
      select 1
      from public.gemba_walks walk_row
      where walk_row.organisation_id = target_organisation_id
        and walk_row.leader_membership_id = target_membership_id
        and walk_row.status = 'in_progress'
        and coalesce(walk_row.started_at, walk_row.created_at) < clock_timestamp() - stale_after
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
    where audit_row.organisation_id = target_organisation_id
      and audit_row.auditor_membership_id = target_membership_id
      and audit_row.status = 'in_progress'
      and coalesce(audit_row.started_at, audit_row.created_at) < clock_timestamp() - stale_after
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
    returning 1
  )
  select count(*) into upsert_count from upserted_audits;
  affected := affected + coalesce(upsert_count, 0);

  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'leanai.chase_stale_audit'
    and notification_row.dedupe_key like 'stale_audit:%'
    and not exists (
      select 1
      from public.five_s_audits audit_row
      where audit_row.organisation_id = target_organisation_id
        and audit_row.auditor_membership_id = target_membership_id
        and audit_row.status = 'in_progress'
        and coalesce(audit_row.started_at, audit_row.created_at) < clock_timestamp() - stale_after
        and notification_row.dedupe_key = (
          'stale_audit:' || audit_row.id::text || ':' || target_membership_id::text
        )
    );

  return coalesce(affected, 0);
end;
$$;

revoke all on function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid) from public;
grant execute on function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid) to postgres;
alter function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid) owner to lean_hub_private_owner;

create or replace function private.sync_leanai_operational_chase_notifications()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_id uuid;
begin
  if org_id is null then
    raise exception 'sync operational chase notifications is not authorised'
      using errcode = '42501';
  end if;

  actor_id := private.current_membership_id(org_id);
  if actor_id is null then
    raise exception 'sync operational chase notifications is not authorised'
      using errcode = '42501';
  end if;

  if not private.try_begin_in_app_operational_chase_sync(org_id, actor_id) then
    return 0;
  end if;

  return private.run_in_app_operational_chase_sync_for_actor(org_id, actor_id);
end;
$$;

revoke all on function private.sync_leanai_operational_chase_notifications() from public;
grant execute on function private.sync_leanai_operational_chase_notifications() to postgres;

alter function private.sync_leanai_operational_chase_notifications() owner to lean_hub_private_owner;

create or replace function public.sync_leanai_operational_chase_notifications()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.sync_leanai_operational_chase_notifications()
$$;

revoke all on function public.sync_leanai_operational_chase_notifications() from public, anon;
grant execute on function public.sync_leanai_operational_chase_notifications() to authenticated;

-- Back-compat entry point used by the bell snapshot loader today.
create or replace function private.sync_overdue_action_chase_notifications()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.sync_leanai_operational_chase_notifications()
$$;

create or replace function public.sync_overdue_action_chase_notifications()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.sync_leanai_operational_chase_notifications()
$$;
