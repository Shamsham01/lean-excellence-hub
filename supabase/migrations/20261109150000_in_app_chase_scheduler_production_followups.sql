-- Production follow-ups (#378): digest staleness, quota retention sweep, and
-- long-lived pre-watermark chase expiry (sync cleanup still never deletes fresh pre-watermark rows).

-- ---------------------------------------------------------------------------
-- Digest staleness guard (drop summary when unread backlog no longer warrants it)
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
    delete from public.in_app_notifications notification_row
    where notification_row.organisation_id = target_organisation_id
      and notification_row.membership_id = target_membership_id
      and notification_row.notification_type = 'leanai.chase_digest'
      and notification_row.dedupe_key = 'chase_digest:' || digest_day;
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

revoke all on function private.upsert_in_app_chase_digest(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.upsert_in_app_chase_digest(uuid, uuid)
  to postgres, lean_hub_private_owner;
alter function private.upsert_in_app_chase_digest(uuid, uuid)
  owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- Daily quota table retention (bounded growth)
-- ---------------------------------------------------------------------------

create or replace function private.sweep_in_app_chase_recipient_daily_quota(
  keep_days integer default 45
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed integer;
  cutoff date;
begin
  if keep_days < 7 or keep_days > 400 then
    raise exception 'invalid chase quota retention keep_days';
  end if;

  cutoff := (statement_timestamp() at time zone 'UTC')::date - keep_days;

  with deleted_rows as (
    delete from private.in_app_chase_recipient_daily_quota quota_row
    where quota_row.quota_utc_day < cutoff
    returning 1
  )
  select count(*)::integer into removed from deleted_rows;

  return coalesce(removed, 0);
end;
$$;

revoke all on function private.sweep_in_app_chase_recipient_daily_quota(integer)
  from public, anon, authenticated, service_role;
grant execute on function private.sweep_in_app_chase_recipient_daily_quota(integer)
  to postgres, lean_hub_private_owner;
alter function private.sweep_in_app_chase_recipient_daily_quota(integer)
  owner to lean_hub_private_owner;

grant select, insert, update, delete on private.in_app_chase_recipient_daily_quota to postgres;
grant delete on private.in_app_chase_recipient_daily_quota to lean_hub_private_owner;

create or replace function private.invoke_in_app_chase_recipient_quota_retention_sweep()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.sweep_in_app_chase_recipient_daily_quota(45);
$$;

revoke all on function private.invoke_in_app_chase_recipient_quota_retention_sweep()
  from public, anon, authenticated, service_role;
grant execute on function private.invoke_in_app_chase_recipient_quota_retention_sweep()
  to postgres;
alter function private.invoke_in_app_chase_recipient_quota_retention_sweep()
  owner to postgres;

select cron.unschedule(jobid)
from cron.job
where job.jobname = 'leh_in_app_chase_quota_retention_daily';

select cron.schedule(
  'leh_in_app_chase_quota_retention_daily',
  '15 4 * * *',
  $$select private.invoke_in_app_chase_recipient_quota_retention_sweep();$$
);

-- ---------------------------------------------------------------------------
-- Expire ancient pre-watermark chase rows (TTL; does not affect post-watermark cleanup)
-- ---------------------------------------------------------------------------

create or replace function private.sweep_expired_pre_watermark_chase_notifications(
  max_age interval default interval '180 days'
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed integer;
  watermark timestamptz;
begin
  if max_age < interval '30 days' or max_age > interval '730 days' then
    raise exception 'invalid pre-watermark chase max_age';
  end if;

  select worker_cursor.chase_eligibility_watermark
  into watermark
  from private.in_app_chase_worker_cursor worker_cursor
  where worker_cursor.singleton_id = true;

  if watermark is null then
    return 0;
  end if;

  with deleted_rows as (
    delete from public.in_app_notifications notification_row
    where notification_row.notification_type like 'leanai.chase_%'
      and notification_row.notification_type <> 'leanai.chase_digest'
      and notification_row.created_at < watermark
      and notification_row.created_at < statement_timestamp() - max_age
    returning 1
  )
  select count(*)::integer into removed from deleted_rows;

  return coalesce(removed, 0);
end;
$$;

revoke all on function private.sweep_expired_pre_watermark_chase_notifications(interval)
  from public, anon, authenticated, service_role;
grant execute on function private.sweep_expired_pre_watermark_chase_notifications(interval)
  to postgres, lean_hub_private_owner;
alter function private.sweep_expired_pre_watermark_chase_notifications(interval)
  owner to lean_hub_private_owner;

create or replace function private.invoke_in_app_pre_watermark_chase_expiry_sweep()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.sweep_expired_pre_watermark_chase_notifications(interval '180 days');
$$;

revoke all on function private.invoke_in_app_pre_watermark_chase_expiry_sweep()
  from public, anon, authenticated, service_role;
grant execute on function private.invoke_in_app_pre_watermark_chase_expiry_sweep()
  to postgres;
alter function private.invoke_in_app_pre_watermark_chase_expiry_sweep()
  owner to postgres;

select cron.unschedule(jobid)
from cron.job
where job.jobname = 'leh_in_app_chase_prewatermark_expiry_weekly';

select cron.schedule(
  'leh_in_app_chase_prewatermark_expiry_weekly',
  '30 5 * * 0',
  $$select private.invoke_in_app_pre_watermark_chase_expiry_sweep();$$
);
