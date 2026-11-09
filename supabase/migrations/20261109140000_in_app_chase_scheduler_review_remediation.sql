-- Issue #341 review remediation: scheduler off by default, eligibility watermark,
-- atomic per-recipient daily quota, bounded per-member work, and digest honesty.

-- ---------------------------------------------------------------------------
-- Settings + cursor watermark (first enable guard)
-- ---------------------------------------------------------------------------

alter table private.in_app_operational_chase_scheduler_settings
  add column if not exists scheduler_enabled_at timestamptz;

alter table private.in_app_operational_chase_scheduler_settings
  add column if not exists per_member_chase_limit integer;

update private.in_app_operational_chase_scheduler_settings
set per_member_chase_limit = 8
where singleton_id = true
  and per_member_chase_limit is null;

alter table private.in_app_operational_chase_scheduler_settings
  alter column per_member_chase_limit set default 8;

alter table private.in_app_operational_chase_scheduler_settings
  alter column per_member_chase_limit set not null;

alter table private.in_app_operational_chase_scheduler_settings
  add constraint in_app_operational_chase_per_member_limit_check
  check (per_member_chase_limit between 1 and 40);

comment on column private.in_app_operational_chase_scheduler_settings.scheduler_enabled_at is
  'Set when scheduler_enabled transitions to true; seeds chase eligibility watermark.';

alter table private.in_app_chase_worker_cursor
  add column if not exists chase_eligibility_watermark timestamptz;

comment on column private.in_app_chase_worker_cursor.chase_eligibility_watermark is
  'When set, operational chase sync only targets work that became due after this instant (no historical backfill).';

grant select, update on private.in_app_operational_chase_scheduler_settings
  to lean_hub_private_owner;

drop policy if exists private_owner_all_in_app_operational_chase_scheduler_settings
  on private.in_app_operational_chase_scheduler_settings;
create policy private_owner_all_in_app_operational_chase_scheduler_settings
on private.in_app_operational_chase_scheduler_settings for all to lean_hub_private_owner
using (true) with check (true);

grant select, update on private.in_app_chase_worker_cursor to lean_hub_private_owner;

drop policy if exists private_owner_all_in_app_chase_worker_cursor
  on private.in_app_chase_worker_cursor;
create policy private_owner_all_in_app_chase_worker_cursor
on private.in_app_chase_worker_cursor for all to lean_hub_private_owner
using (true) with check (true);

update private.in_app_operational_chase_scheduler_settings
set scheduler_enabled = false
where singleton_id = true
  and scheduler_enabled = true
  and scheduler_enabled_at is null;

create or replace function private.tg_in_app_chase_scheduler_enable_watermark()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.scheduler_enabled
    and not coalesce(old.scheduler_enabled, false) then
    new.scheduler_enabled_at :=
      coalesce(new.scheduler_enabled_at, statement_timestamp());

    update private.in_app_chase_worker_cursor worker_cursor
    set chase_eligibility_watermark =
        coalesce(worker_cursor.chase_eligibility_watermark, statement_timestamp()),
        updated_at = statement_timestamp()
    where worker_cursor.singleton_id = true;
  end if;

  return new;
end;
$$;

drop trigger if exists in_app_chase_scheduler_enable_watermark
  on private.in_app_operational_chase_scheduler_settings;

create trigger in_app_chase_scheduler_enable_watermark
before update of scheduler_enabled, scheduler_enabled_at
on private.in_app_operational_chase_scheduler_settings
for each row
execute function private.tg_in_app_chase_scheduler_enable_watermark();

revoke all on function private.tg_in_app_chase_scheduler_enable_watermark()
  from public, anon, authenticated, service_role;
alter function private.tg_in_app_chase_scheduler_enable_watermark()
  owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- Atomic per-recipient daily quota (concurrency-safe cap)
-- ---------------------------------------------------------------------------

create table if not exists private.in_app_chase_recipient_daily_quota (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  membership_id uuid not null,
  quota_utc_day date not null,
  consumed_new_chase_count integer not null default 0,
  constraint in_app_chase_recipient_daily_quota_pkey
    primary key (organisation_id, membership_id, quota_utc_day),
  constraint in_app_chase_recipient_daily_quota_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships (organisation_id, id)
    on delete cascade,
  constraint in_app_chase_recipient_daily_quota_consumed_check
    check (consumed_new_chase_count >= 0)
);

comment on table private.in_app_chase_recipient_daily_quota is
  'Tracks new operational chase notification inserts per recipient per UTC day (not upsert refreshes).';

alter table private.in_app_chase_recipient_daily_quota enable row level security;
alter table private.in_app_chase_recipient_daily_quota force row level security;

revoke all on private.in_app_chase_recipient_daily_quota
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on private.in_app_chase_recipient_daily_quota to postgres;
create policy postgres_all_in_app_chase_recipient_daily_quota
on private.in_app_chase_recipient_daily_quota for all to postgres
using (true) with check (true);

grant select, insert, update on private.in_app_chase_recipient_daily_quota
  to lean_hub_private_owner;

create policy private_owner_all_in_app_chase_recipient_daily_quota
on private.in_app_chase_recipient_daily_quota for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.in_app_chase_quota_utc_day()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (statement_timestamp() at time zone 'UTC')::date
$$;

revoke all on function private.in_app_chase_quota_utc_day()
  from public, anon, authenticated, service_role;
grant execute on function private.in_app_chase_quota_utc_day() to postgres, lean_hub_private_owner;
alter function private.in_app_chase_quota_utc_day() owner to lean_hub_private_owner;

create or replace function private.lock_in_app_chase_daily_budget(
  target_organisation_id uuid,
  target_membership_id uuid,
  per_run_limit integer
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  day_key date := private.in_app_chase_quota_utc_day();
  daily_cap integer := 12;
  consumed integer := 0;
  remaining integer;
begin
  select coalesce(max(settings_row.daily_new_chase_cap), 12)
  into daily_cap
  from private.in_app_operational_chase_scheduler_settings settings_row
  where settings_row.singleton_id = true;

  insert into private.in_app_chase_recipient_daily_quota (
    organisation_id,
    membership_id,
    quota_utc_day,
    consumed_new_chase_count
  ) values (
    target_organisation_id,
    target_membership_id,
    day_key,
    0
  )
  on conflict (organisation_id, membership_id, quota_utc_day) do nothing;

  select quota_row.consumed_new_chase_count
  into consumed
  from private.in_app_chase_recipient_daily_quota quota_row
  where quota_row.organisation_id = target_organisation_id
    and quota_row.membership_id = target_membership_id
    and quota_row.quota_utc_day = day_key
  for update;

  remaining := greatest(coalesce(daily_cap, 12) - coalesce(consumed, 0), 0);
  return least(greatest(coalesce(per_run_limit, 12), 0), remaining);
end;
$$;

create or replace function private.record_in_app_chase_new_inserts(
  target_organisation_id uuid,
  target_membership_id uuid,
  new_insert_count integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  day_key date := private.in_app_chase_quota_utc_day();
begin
  if coalesce(new_insert_count, 0) <= 0 then
    return;
  end if;

  update private.in_app_chase_recipient_daily_quota quota_row
  set consumed_new_chase_count =
      quota_row.consumed_new_chase_count + new_insert_count
  where quota_row.organisation_id = target_organisation_id
    and quota_row.membership_id = target_membership_id
    and quota_row.quota_utc_day = day_key;
end;
$$;

revoke all on function private.lock_in_app_chase_daily_budget(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.lock_in_app_chase_daily_budget(uuid, uuid, integer)
  to postgres, lean_hub_private_owner;
alter function private.lock_in_app_chase_daily_budget(uuid, uuid, integer)
  owner to lean_hub_private_owner;

revoke all on function private.record_in_app_chase_new_inserts(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.record_in_app_chase_new_inserts(uuid, uuid, integer)
  to postgres, lean_hub_private_owner;
alter function private.record_in_app_chase_new_inserts(uuid, uuid, integer)
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
  select coalesce(
    (
      select quota_row.consumed_new_chase_count
      from private.in_app_chase_recipient_daily_quota quota_row
      where quota_row.organisation_id = target_organisation_id
        and quota_row.membership_id = target_membership_id
        and quota_row.quota_utc_day = private.in_app_chase_quota_utc_day()
    ),
    (
      select count(*)::integer
      from public.in_app_notifications notification_row
      where notification_row.organisation_id = target_organisation_id
        and notification_row.membership_id = target_membership_id
        and notification_row.notification_type like 'leanai.chase_%'
        and notification_row.notification_type <> 'leanai.chase_digest'
        and notification_row.created_at >= (
          date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC'
        )
    ),
    0
  )
$$;

-- ---------------------------------------------------------------------------
-- Supporting indexes for bounded chase selection
-- ---------------------------------------------------------------------------

create index if not exists actions_org_open_due_chase_idx
  on public.actions (organisation_id, due_at)
  where status in ('open', 'in_progress')
    and due_at is not null;

create index if not exists action_assignees_org_member_action_idx
  on public.action_assignees (organisation_id, membership_id, action_id);

create index if not exists schedule_occurrences_org_owner_open_planned_idx
  on public.schedule_occurrences (organisation_id, owner_membership_id, planned_at)
  where lifecycle_status = 'open';

create index if not exists gemba_walks_org_leader_stale_chase_idx
  on public.gemba_walks (organisation_id, leader_membership_id, started_at, created_at)
  where status = 'in_progress';

create index if not exists five_s_audits_org_auditor_stale_chase_idx
  on public.five_s_audits (organisation_id, auditor_membership_id, started_at, created_at)
  where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- Digest helper (summary row when cap reached; UI groups unread chases)
-- ---------------------------------------------------------------------------

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
    backlog_count::text
      || ' unread operational reminders are grouped in this summary. Open Actions or Scheduling to review.',
    '/platform/actions',
    'chase_digest:' || digest_day
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Operational chase sync (watermark, quota slots, per-type limits)
-- ---------------------------------------------------------------------------

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
      '/platform/scheduling',
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

  if not coalesce(settings_row.scheduler_enabled, false) then
    return 0;
  end if;

  if settings_row.scheduler_enabled_at is null then
    update private.in_app_operational_chase_scheduler_settings scheduler_settings
    set scheduler_enabled_at = statement_timestamp()
  where scheduler_settings.singleton_id = true;

    update private.in_app_chase_worker_cursor worker_cursor
    set chase_eligibility_watermark =
        coalesce(worker_cursor.chase_eligibility_watermark, statement_timestamp()),
        updated_at = statement_timestamp()
    where worker_cursor.singleton_id = true;
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
