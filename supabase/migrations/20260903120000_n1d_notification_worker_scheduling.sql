-- N1d: notification worker scheduling, shared-outbox cutover, operational diagnostics.

-- ---------------------------------------------------------------------------
-- Extensions (hosted Supabase provides pg_cron/pg_net; local may enable similarly)
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- ---------------------------------------------------------------------------
-- Notification projector consumer cutover (shared domain_event_outbox)
-- ---------------------------------------------------------------------------

create table private.notification_projector_consumer_state (
  singleton_id boolean primary key default true check (singleton_id),
  cutover_at timestamptz not null,
  established_at timestamptz not null default statement_timestamp(),
  established_by_migration text not null default '20260903120000_n1d_notification_worker_scheduling'
);

alter table private.notification_projector_consumer_state enable row level security;
alter table private.notification_projector_consumer_state force row level security;

revoke all on table private.notification_projector_consumer_state from public, anon, authenticated;
grant select on table private.notification_projector_consumer_state to postgres, lean_hub_private_owner;

create policy private_owner_all_notification_projector_consumer_state
on private.notification_projector_consumer_state
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy postgres_all_notification_projector_consumer_state
on private.notification_projector_consumer_state
for all
to postgres
using (true)
with check (true);

create table private.notification_projector_pre_cutover_skips (
  organisation_id uuid not null,
  event_id uuid not null,
  event_type text not null,
  event_created_at timestamptz not null,
  skipped_at timestamptz not null default statement_timestamp(),
  skip_reason text not null default 'pre_cutover_backlog',
  constraint notification_projector_pre_cutover_skips_pkey
    primary key (organisation_id, event_id),
  constraint notification_projector_pre_cutover_skips_outbox_fkey
    foreign key (organisation_id, event_id)
    references private.domain_event_outbox(organisation_id, id)
    on delete restrict,
  constraint notification_projector_pre_cutover_skips_reason_check
    check (skip_reason in ('pre_cutover_backlog'))
);

create index notification_projector_pre_cutover_skips_skipped_at_idx
  on private.notification_projector_pre_cutover_skips (skipped_at);

alter table private.notification_projector_pre_cutover_skips enable row level security;
alter table private.notification_projector_pre_cutover_skips force row level security;

revoke all on table private.notification_projector_pre_cutover_skips
  from public, anon, authenticated;
grant select on table private.notification_projector_pre_cutover_skips to postgres, lean_hub_private_owner;

create policy private_owner_all_notification_projector_pre_cutover_skips
on private.notification_projector_pre_cutover_skips
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy postgres_all_notification_projector_pre_cutover_skips
on private.notification_projector_pre_cutover_skips
for all
to postgres
using (true)
with check (true);

do $$
declare
  cutover_timestamp timestamptz := statement_timestamp();
  skipped_count integer;
begin
  insert into private.notification_projector_consumer_state (singleton_id, cutover_at)
  values (true, cutover_timestamp)
  on conflict (singleton_id) do update
    set cutover_at = excluded.cutover_at,
        established_at = statement_timestamp();

  insert into private.notification_projector_pre_cutover_skips (
    organisation_id,
    event_id,
    event_type,
    event_created_at,
    skip_reason
  )
  select
    outbox_row.organisation_id,
    outbox_row.id,
    outbox_row.event_type,
    outbox_row.created_at,
    'pre_cutover_backlog'
  from private.domain_event_outbox outbox_row
  where outbox_row.created_at < cutover_timestamp
    and outbox_row.processing_state in ('pending', 'processing')
  on conflict (organisation_id, event_id) do nothing;

  get diagnostics skipped_count = row_count;
end;
$$;

create or replace function private.notification_projector_cutover_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select consumer_state.cutover_at
  from private.notification_projector_consumer_state consumer_state
  where consumer_state.singleton_id = true
  limit 1
$$;

create or replace function private.claim_domain_events_for_notification_projector(
  batch_size integer default 10,
  lease_seconds integer default null
)
returns setof private.domain_event_outbox
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cutover_at_value timestamptz;
  effective_lease_seconds integer;
begin
  cutover_at_value := private.notification_projector_cutover_at();

  if cutover_at_value is null then
    raise exception 'notification projector cutover is not configured'
      using errcode = '55000';
  end if;

  if batch_size is null or batch_size < 1 or batch_size > 1000 then
    raise exception 'batch_size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  effective_lease_seconds :=
    coalesce(lease_seconds, private.domain_event_outbox_default_lease_seconds());

  if effective_lease_seconds < 1 or effective_lease_seconds > 3600 then
    raise exception 'lease_seconds must be between 1 and 3600'
      using errcode = '22023';
  end if;

  return query
  with claimable as (
    select outbox_row.id
    from private.domain_event_outbox outbox_row
    where outbox_row.created_at >= cutover_at_value
      and (
        (
          outbox_row.processing_state = 'pending'
          and outbox_row.available_at <= statement_timestamp()
        )
        or (
          outbox_row.processing_state = 'processing'
          and outbox_row.lease_expires_at is not null
          and outbox_row.lease_expires_at <= statement_timestamp()
        )
      )
    order by outbox_row.created_at
    limit batch_size
    for update skip locked
  )
  update private.domain_event_outbox outbox_row
  set processing_state = 'processing',
      processing_started_at = statement_timestamp(),
      lease_expires_at = statement_timestamp()
        + make_interval(secs => effective_lease_seconds),
      lease_token = gen_random_uuid(),
      attempt_count = outbox_row.attempt_count + 1
  from claimable
  where outbox_row.id = claimable.id
  returning outbox_row.*;
end;
$$;

create or replace function public.claim_domain_events_for_worker(
  batch_size integer default 10,
  lease_seconds integer default null
)
returns table (
  organisation_id uuid,
  event_id uuid,
  resource_record_id uuid,
  event_type text,
  payload jsonb,
  lease_token uuid,
  attempt_count integer
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select
    claimed.organisation_id,
    claimed.id,
    claimed.resource_record_id,
    claimed.event_type,
    claimed.payload,
    claimed.lease_token,
    claimed.attempt_count
  from private.claim_domain_events_for_notification_projector(
    batch_size,
    lease_seconds
  ) as claimed
$$;

-- ---------------------------------------------------------------------------
-- Scheduler settings (non-secret) and Vault-backed worker invocation
-- ---------------------------------------------------------------------------

create table private.notification_worker_scheduler_settings (
  singleton_id boolean primary key default true check (singleton_id),
  scheduler_enabled boolean not null default true,
  projector_batch_size integer not null default 10,
  delivery_batch_size integer not null default 10,
  updated_at timestamptz not null default statement_timestamp(),
  constraint notification_worker_scheduler_settings_projector_batch_check
    check (projector_batch_size between 1 and 1000),
  constraint notification_worker_scheduler_settings_delivery_batch_check
    check (delivery_batch_size between 1 and 1000)
);

insert into private.notification_worker_scheduler_settings (singleton_id)
values (true)
on conflict (singleton_id) do nothing;

alter table private.notification_worker_scheduler_settings enable row level security;
alter table private.notification_worker_scheduler_settings force row level security;

revoke all on table private.notification_worker_scheduler_settings
  from public, anon, authenticated;
grant select, update on table private.notification_worker_scheduler_settings to postgres;

create policy postgres_all_notification_worker_scheduler_settings
on private.notification_worker_scheduler_settings
for all
to postgres
using (true)
with check (true);

create or replace function private.invoke_notification_edge_worker(
  target_function_name text,
  target_batch_size integer default 10
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  worker_secret text;
  request_id bigint;
  settings_row private.notification_worker_scheduler_settings%rowtype;
begin
  if target_function_name not in ('notification-projector', 'notification-delivery') then
    raise exception 'unsupported notification worker function'
      using errcode = '22023';
  end if;

  if target_batch_size < 1 or target_batch_size > 1000 then
    raise exception 'batch_size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  select scheduler_settings.*
  into settings_row
  from private.notification_worker_scheduler_settings scheduler_settings
  where scheduler_settings.singleton_id = true;

  if not coalesce(settings_row.scheduler_enabled, false) then
    return null;
  end if;

  select secret_row.decrypted_secret
  into project_url
  from vault.decrypted_secrets secret_row
  where secret_row.name = 'leh_supabase_project_url'
  limit 1;

  select secret_row.decrypted_secret
  into worker_secret
  from vault.decrypted_secrets secret_row
  where secret_row.name = 'leh_notification_worker_secret'
  limit 1;

  if project_url is null or btrim(project_url) = '' or worker_secret is null then
    raise warning 'notification worker scheduler skipped %: secrets not configured', target_function_name;
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || target_function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', worker_secret
    ),
    body := jsonb_build_object('batch_size', target_batch_size)
  )
  into request_id;

  return request_id;
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

create or replace function private.invoke_notification_delivery_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_size integer;
begin
  select scheduler_settings.delivery_batch_size
  into batch_size
  from private.notification_worker_scheduler_settings scheduler_settings
  where scheduler_settings.singleton_id = true;

  return private.invoke_notification_edge_worker(
    'notification-delivery',
    coalesce(batch_size, 10)
  );
end;
$$;

-- Minute-level schedules. Safe to overlap; workers use SKIP LOCKED leases.
select cron.unschedule(jobid)
from cron.job
where job.jobname in (
  'leh_notification_projector_every_minute',
  'leh_notification_delivery_every_minute'
);

select cron.schedule(
  'leh_notification_projector_every_minute',
  '* * * * *',
  $$select private.invoke_notification_projector_worker();$$
);

select cron.schedule(
  'leh_notification_delivery_every_minute',
  '* * * * *',
  $$select private.invoke_notification_delivery_worker();$$
);

-- ---------------------------------------------------------------------------
-- Operational diagnostics (no recipient emails or message bodies)
-- ---------------------------------------------------------------------------

create or replace function private.notification_operational_health()
returns table (
  projector_cutover_at timestamptz,
  scheduler_enabled boolean,
  projector_cron_job_count integer,
  delivery_cron_job_count integer,
  pending_outbox_count bigint,
  oldest_pending_outbox_age_seconds numeric,
  claimable_post_cutover_outbox_count bigint,
  pre_cutover_skip_count bigint,
  pending_delivery_count bigint,
  needs_remediation_delivery_count bigint,
  failed_outbox_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with cutover as (
    select private.notification_projector_cutover_at() as cutover_at
  ),
  pending_outbox as (
    select
      count(*)::bigint as pending_count,
      extract(
        epoch from (
          statement_timestamp() - min(outbox_row.created_at)
        )
      ) as oldest_age_seconds
    from private.domain_event_outbox outbox_row
    cross join cutover
    where outbox_row.processing_state = 'pending'
      and outbox_row.available_at <= statement_timestamp()
      and outbox_row.created_at >= cutover.cutover_at
  ),
  claimable_post_cutover as (
    select count(*)::bigint as claimable_count
    from private.domain_event_outbox outbox_row
    cross join cutover
    where (
      (
        outbox_row.processing_state = 'pending'
        and outbox_row.available_at <= statement_timestamp()
      )
      or (
        outbox_row.processing_state = 'processing'
        and outbox_row.lease_expires_at is not null
        and outbox_row.lease_expires_at <= statement_timestamp()
      )
    )
      and outbox_row.created_at >= cutover.cutover_at
  )
  select
    cutover.cutover_at,
    coalesce(scheduler_settings.scheduler_enabled, false),
    (
      select count(*)::integer
      from cron.job cron_job
      where cron_job.jobname = 'leh_notification_projector_every_minute'
        and cron_job.active
    ),
    (
      select count(*)::integer
      from cron.job cron_job
      where cron_job.jobname = 'leh_notification_delivery_every_minute'
        and cron_job.active
    ),
    coalesce(pending_outbox.pending_count, 0),
    pending_outbox.oldest_age_seconds,
    coalesce(claimable_post_cutover.claimable_count, 0),
    (
      select count(*)::bigint
      from private.notification_projector_pre_cutover_skips skip_row
    ),
    (
      select count(*)::bigint
      from private.notification_delivery_ledger ledger_row
      where ledger_row.status = 'pending'
    ),
    (
      select count(*)::bigint
      from private.notification_delivery_ledger ledger_row
      where ledger_row.status = 'needs_remediation'
    ),
    (
      select count(*)::bigint
      from private.domain_event_outbox outbox_row
      where outbox_row.processing_state = 'failed'
    )
  from cutover
  left join private.notification_worker_scheduler_settings scheduler_settings
    on scheduler_settings.singleton_id = true
  left join pending_outbox on true
  left join claimable_post_cutover on true
$$;

create or replace function private.set_notification_worker_scheduler_enabled(
  target_enabled boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update private.notification_worker_scheduler_settings scheduler_settings
  set scheduler_enabled = target_enabled,
      updated_at = statement_timestamp()
  where scheduler_settings.singleton_id = true;

  return found;
end;
$$;

alter function private.notification_projector_cutover_at()
  owner to lean_hub_private_owner;
alter function private.claim_domain_events_for_notification_projector(integer, integer)
  owner to lean_hub_private_owner;
alter function private.invoke_notification_edge_worker(text, integer)
  owner to postgres;
alter function private.invoke_notification_projector_worker()
  owner to postgres;
alter function private.invoke_notification_delivery_worker()
  owner to postgres;
alter function private.notification_operational_health()
  owner to postgres;
alter function private.set_notification_worker_scheduler_enabled(boolean)
  owner to postgres;

revoke all on function private.notification_projector_cutover_at()
  from public, anon, authenticated;
revoke all on function private.claim_domain_events_for_notification_projector(integer, integer)
  from public, anon, authenticated;
revoke all on function private.invoke_notification_edge_worker(text, integer)
  from public, anon, authenticated;
revoke all on function private.invoke_notification_projector_worker()
  from public, anon, authenticated;
revoke all on function private.invoke_notification_delivery_worker()
  from public, anon, authenticated;
revoke all on function private.notification_operational_health()
  from public, anon, authenticated;
revoke all on function private.set_notification_worker_scheduler_enabled(boolean)
  from public, anon, authenticated;

grant execute on function private.notification_projector_cutover_at()
  to postgres, lean_hub_private_owner;
grant execute on function private.claim_domain_events_for_notification_projector(integer, integer)
  to postgres, service_role, lean_hub_private_owner;
grant execute on function private.invoke_notification_edge_worker(text, integer)
  to postgres;
grant execute on function private.invoke_notification_projector_worker()
  to postgres;
grant execute on function private.invoke_notification_delivery_worker()
  to postgres;
grant execute on function private.notification_operational_health()
  to postgres;
grant execute on function private.set_notification_worker_scheduler_enabled(boolean)
  to postgres;
