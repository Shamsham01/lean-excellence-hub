-- Issue #341 completion: scheduled LeanAI chase generation, daily anti-spam cap,
-- optional org preferences, plan-aware chase emission, and worker security hardening.

-- ---------------------------------------------------------------------------
-- Scheduler + anti-spam settings
-- ---------------------------------------------------------------------------

create table if not exists private.in_app_operational_chase_scheduler_settings (
  singleton_id boolean primary key default true check (singleton_id),
  scheduler_enabled boolean not null default true,
  membership_batch_size integer not null default 120
    check (membership_batch_size between 1 and 500),
  daily_new_chase_cap integer not null default 12
    check (daily_new_chase_cap between 1 and 40),
  updated_at timestamptz not null default statement_timestamp()
);

insert into private.in_app_operational_chase_scheduler_settings (singleton_id)
values (true)
on conflict (singleton_id) do nothing;

comment on table private.in_app_operational_chase_scheduler_settings is
  'Operational chase worker tuning (daily cap, batch size). In-app chases only; no email fan-out.';

alter table private.in_app_operational_chase_scheduler_settings enable row level security;
alter table private.in_app_operational_chase_scheduler_settings force row level security;

revoke all on private.in_app_operational_chase_scheduler_settings
  from public, anon, authenticated, service_role;
grant select, update on private.in_app_operational_chase_scheduler_settings to postgres;
grant select on private.in_app_operational_chase_scheduler_settings to lean_hub_private_owner;

create policy postgres_all_in_app_operational_chase_scheduler_settings
on private.in_app_operational_chase_scheduler_settings for all to postgres
using (true) with check (true);

create table if not exists private.in_app_chase_worker_cursor (
  singleton_id boolean primary key default true check (singleton_id),
  last_organisation_id uuid,
  last_membership_id uuid,
  updated_at timestamptz not null default statement_timestamp()
);

insert into private.in_app_chase_worker_cursor (singleton_id)
values (true)
on conflict (singleton_id) do nothing;

alter table private.in_app_chase_worker_cursor enable row level security;
alter table private.in_app_chase_worker_cursor force row level security;

revoke all on private.in_app_chase_worker_cursor
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on private.in_app_chase_worker_cursor to postgres;

create policy postgres_all_in_app_chase_worker_cursor
on private.in_app_chase_worker_cursor for all to postgres
using (true) with check (true);

create table if not exists private.organisation_in_app_notification_prefs (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  operational_chases_enabled boolean not null default true,
  updated_at timestamptz not null default statement_timestamp()
);

comment on table private.organisation_in_app_notification_prefs is
  'Org-level in-app delivery preferences (operational chases). Reading historical rows remains allowed.';

alter table private.organisation_in_app_notification_prefs enable row level security;
alter table private.organisation_in_app_notification_prefs force row level security;

revoke all on private.organisation_in_app_notification_prefs
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on private.organisation_in_app_notification_prefs
  to lean_hub_private_owner;

create policy private_owner_all_organisation_in_app_notification_prefs
on private.organisation_in_app_notification_prefs for all to lean_hub_private_owner
using (true) with check (true);

-- Plan/module gating for chases: wire to `private.organisation_plan_capability`
-- when billing entitlements land (#374). Notifications remain read-only deep links.

create or replace function private.organisation_in_app_operational_chases_enabled(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select prefs_row.operational_chases_enabled
      from private.organisation_in_app_notification_prefs prefs_row
      where prefs_row.organisation_id = target_organisation_id
    ),
    true
  )
$$;

revoke all on function private.organisation_in_app_operational_chases_enabled(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.organisation_in_app_operational_chases_enabled(uuid)
  to postgres, lean_hub_private_owner;
alter function private.organisation_in_app_operational_chases_enabled(uuid)
  owner to lean_hub_private_owner;

create or replace function private.in_app_chase_new_rows_created_today(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type like 'leanai.chase_%'
    and notification_row.notification_type <> 'leanai.chase_digest'
    and notification_row.created_at >= (
      date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC'
    )
$$;

revoke all on function private.in_app_chase_new_rows_created_today(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.in_app_chase_new_rows_created_today(uuid, uuid)
  to postgres, lean_hub_private_owner;
alter function private.in_app_chase_new_rows_created_today(uuid, uuid)
  owner to lean_hub_private_owner;

create or replace function private.upsert_in_app_chase_digest(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  digest_day text := to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD');
  backlog_count integer;
begin
  select count(*)::integer
  into backlog_count
  from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type like 'leanai.chase_%'
    and notification_row.notification_type <> 'leanai.chase_digest'
    and notification_row.read_at is null;

  if backlog_count < 2 then
    return;
  end if;

  perform private.insert_membership_in_app_notification(
    target_organisation_id,
    target_membership_id,
    'leanai.chase_digest',
    'Several items need attention',
    backlog_count::text || ' operational reminders are waiting. Open Actions or Scheduling to review.',
    '/platform/actions',
    'chase_digest:' || digest_day
  );
end;
$$;

revoke all on function private.upsert_in_app_chase_digest(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.upsert_in_app_chase_digest(uuid, uuid)
  to postgres, lean_hub_private_owner;
alter function private.upsert_in_app_chase_digest(uuid, uuid)
  owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- Chase sync (plan hooks, org prefs, daily cap — existing dedupe unchanged)

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
  created_today integer := 0;
  allow_new_inserts boolean := true;
  upsert_count integer := 0;
  stale_after interval := interval '72 hours';
  schedule_grace interval := interval '1 day';
begin

  if not private.organisation_in_app_operational_chases_enabled(target_organisation_id) then
    return 0;
  end if;

  select coalesce(settings_row.daily_new_chase_cap, 12)
  into daily_cap
  from private.in_app_operational_chase_scheduler_settings settings_row
  where settings_row.singleton_id = true;

  created_today := private.in_app_chase_new_rows_created_today(
    target_organisation_id,
    target_membership_id
  );
  allow_new_inserts := coalesce(created_today, 0) < coalesce(daily_cap, 12);

  if not allow_new_inserts then
    perform private.upsert_in_app_chase_digest(
      target_organisation_id,
      target_membership_id
    );
  end if;

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
      and allow_new_inserts
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
      and allow_new_inserts
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
      and allow_new_inserts
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
      and allow_new_inserts
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

  if allow_new_inserts then
    perform private.upsert_in_app_chase_digest(
      target_organisation_id,
      target_membership_id
    );
  end if;

  return coalesce(affected, 0);
end;
$$;

revoke all on function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid)
  to postgres;
alter function private.run_in_app_operational_chase_sync_for_actor(uuid, uuid)
  owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- Scheduled worker (idempotent; dedupe keys prevent duplicate chase rows)
-- ---------------------------------------------------------------------------

create or replace function private.invoke_in_app_operational_chase_worker()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  settings_row private.in_app_operational_chase_scheduler_settings%rowtype;
  cursor_row private.in_app_chase_worker_cursor%rowtype;
  batch_size integer;
  processed integer := 0;
  membership_row record;
  last_org uuid;
  last_member uuid;
  found_any boolean := false;
begin
  select *
  into settings_row
  from private.in_app_operational_chase_scheduler_settings scheduler_settings
  where scheduler_settings.singleton_id = true;

  if not coalesce(settings_row.scheduler_enabled, true) then
    return 0;
  end if;

  batch_size := coalesce(settings_row.membership_batch_size, 120);

  select *
  into cursor_row
  from private.in_app_chase_worker_cursor worker_cursor
  where worker_cursor.singleton_id = true
  for update;

  last_org := cursor_row.last_organisation_id;
  last_member := cursor_row.last_membership_id;

  for membership_row in
    with active_memberships as (
      select
        membership_record.organisation_id,
        membership_record.id as membership_id,
        membership_record.activated_at
      from public.organisation_memberships membership_record
      where membership_record.status = 'active'
    )
    select
      batch_row.organisation_id,
      batch_row.membership_id
    from active_memberships batch_row
    where (
      last_org is null
      or last_member is null
      or (batch_row.organisation_id, batch_row.membership_id)
        > (last_org, last_member)
    )
    order by batch_row.organisation_id, batch_row.membership_id
    limit batch_size
  loop
    found_any := true;
    processed := processed
      + private.run_in_app_operational_chase_sync_for_actor(
        membership_row.organisation_id,
        membership_row.membership_id
      );
    last_org := membership_row.organisation_id;
    last_member := membership_row.membership_id;
  end loop;

  if not found_any then
    -- wrap: start from beginning if cursor exhausted this batch window
    for membership_row in
      select
        membership_record.organisation_id,
        membership_record.id as membership_id
      from public.organisation_memberships membership_record
      where membership_record.status = 'active'
      order by membership_record.organisation_id, membership_record.id
      limit batch_size
    loop
      processed := processed
        + private.run_in_app_operational_chase_sync_for_actor(
          membership_row.organisation_id,
          membership_row.membership_id
        );
      last_org := membership_row.organisation_id;
      last_member := membership_row.membership_id;
    end loop;
  end if;

  update private.in_app_chase_worker_cursor worker_cursor
  set last_organisation_id = last_org,
      last_membership_id = last_member,
      updated_at = statement_timestamp()
  where worker_cursor.singleton_id = true;

  return processed;
end;
$$;

revoke all on function private.invoke_in_app_operational_chase_worker()
  from public, anon, authenticated, service_role;
grant execute on function private.invoke_in_app_operational_chase_worker() to postgres;
alter function private.invoke_in_app_operational_chase_worker() owner to postgres;

select cron.unschedule(jobid)
from cron.job
where job.jobname = 'leh_in_app_operational_chase_every_fifteen_minutes';

select cron.schedule(
  'leh_in_app_operational_chase_every_fifteen_minutes',
  '*/15 * * * *',
  $$select private.invoke_in_app_operational_chase_worker();$$
);

-- ---------------------------------------------------------------------------
-- Explicit revokes for authenticated callers on private chase entrypoints
-- ---------------------------------------------------------------------------

revoke all on function private.try_begin_in_app_operational_chase_sync(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_leanai_operational_chase_notifications()
  from public, anon, authenticated, service_role;
revoke all on function private.sync_overdue_action_chase_notifications()
  from public, anon, authenticated, service_role;

revoke all on function private.insert_membership_in_app_notification(
  uuid, uuid, text, text, text, text, text
) from public, anon, authenticated, service_role;

revoke all on function private.notify_in_app_for_suggestion_status_change()
  from public, anon, authenticated, service_role;
