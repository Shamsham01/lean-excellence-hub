-- Platform owner in-app signup/billing alerts, neutral operator email default
-- for new rows only (does not overwrite hosted recipient_email), and
-- version-controlled pg_cron for platform-notification-delivery.

create table private.platform_admin_in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  platform_event_id uuid not null references private.platform_notification_events (id) on delete cascade,
  dedupe_key text not null,
  title text not null,
  body text,
  href text,
  notification_type text not null default 'platform_operator',
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint platform_admin_in_app_notifications_dedupe_key
    unique (auth_user_id, dedupe_key),
  constraint platform_admin_in_app_notifications_title_check
    check (
      title = btrim(title)
      and char_length(title) between 1 and 160
    ),
  constraint platform_admin_in_app_notifications_body_check
    check (body is null or char_length(body) <= 400),
  constraint platform_admin_in_app_notifications_href_check
    check (
      href is null
      or (
        href = btrim(href)
        and char_length(href) between 1 and 240
      )
    ),
  constraint platform_admin_in_app_notifications_type_check
    check (notification_type = 'platform_operator')
);

comment on table private.platform_admin_in_app_notifications is
  'In-console alerts for allowlisted platform operators. One row per operator per platform notification event.';

create index platform_admin_in_app_notifications_user_created_idx
  on private.platform_admin_in_app_notifications (auth_user_id, created_at desc);

create index platform_admin_in_app_notifications_user_unread_idx
  on private.platform_admin_in_app_notifications (auth_user_id)
  where read_at is null;

alter table private.platform_admin_in_app_notifications enable row level security;
alter table private.platform_admin_in_app_notifications force row level security;

revoke all on table private.platform_admin_in_app_notifications
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on private.platform_admin_in_app_notifications
  to lean_hub_private_owner;

create policy private_owner_all_platform_admin_in_app_notifications
on private.platform_admin_in_app_notifications
for all
to lean_hub_private_owner
using (true)
with check (true);

alter table private.platform_notification_settings
  alter column recipient_email set default 'notifications-operator@configure.invalid';

create or replace function private.platform_admin_in_app_copy(
  event_kind text,
  event_organisation_id uuid,
  payload jsonb
)
returns table (
  title text,
  body text,
  href text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  organisation_name text;
  organisation_code text;
  founder_email text;
begin
  organisation_name := nullif(btrim(payload ->> 'organisation_name'), '');
  organisation_code := nullif(btrim(payload ->> 'organisation_code'), '');
  founder_email := nullif(btrim(payload ->> 'email'), '');

  if event_kind = 'founder.email_confirmed' then
    title := 'Founder confirmed email';
    body := coalesce(founder_email, 'A founding account') || ' confirmed. Not a paid customer yet.';
    href := '/org_admin';
    return next;
  end if;

  if event_kind = 'organisation.founded' then
    title := 'Organisation founded';
    body := coalesce(organisation_name, 'An organisation')
      || coalesce(' (' || organisation_code || ')', '')
      || ' is provisioning.';
    href := case
      when event_organisation_id is not null then
        '/org_admin/organisations/' || event_organisation_id::text
      else '/org_admin/organisations'
    end;
    return next;
  end if;

  if event_kind = 'subscription.entitlement_activated' then
    title := 'Subscription entitlement active';
    body := coalesce(organisation_name, 'A customer')
      || ' has verified Stripe subscription entitlement.';
    href := case
      when event_organisation_id is not null then
        '/org_admin/organisations/' || event_organisation_id::text
      else '/org_admin'
    end;
    return next;
  end if;

  if event_kind = 'billing.payment_failed' then
    title := 'Billing payment failed';
    body := coalesce(organisation_name, 'A customer') || ' reported a failed Stripe payment.';
    href := case
      when event_organisation_id is not null then
        '/org_admin/organisations/' || event_organisation_id::text
      else '/org_admin'
    end;
    return next;
  end if;

  if event_kind = 'subscription.cancelled' then
    title := 'Subscription cancelled';
    body := coalesce(organisation_name, 'A customer') || ' has a Stripe cancellation update.';
    href := case
      when event_organisation_id is not null then
        '/org_admin/organisations/' || event_organisation_id::text
      else '/org_admin'
    end;
    return next;
  end if;

  title := 'Platform event';
  body := 'Recorded platform event: ' || event_kind;
  href := '/org_admin/notifications';
  return next;
end;
$$;

create or replace function private.fan_out_platform_admin_in_app_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_row record;
  copy_row record;
begin
  select *
  into copy_row
  from private.platform_admin_in_app_copy(
    new.event_kind,
    new.organisation_id,
    new.payload
  )
  limit 1;

  for admin_row in
    select admin.auth_user_id
    from private.platform_admins admin
    where admin.status = 'active'
  loop
    insert into private.platform_admin_in_app_notifications (
      auth_user_id,
      platform_event_id,
      dedupe_key,
      title,
      body,
      href,
      notification_type
    )
    values (
      admin_row.auth_user_id,
      new.id,
      new.idempotency_key || ':' || admin_row.auth_user_id::text,
      copy_row.title,
      copy_row.body,
      copy_row.href,
      'platform_operator'
    )
    on conflict on constraint platform_admin_in_app_notifications_dedupe_key do nothing;
  end loop;

  return new;
end;
$$;

create trigger platform_admin_in_app_alert_fan_out
after insert on private.platform_notification_events
for each row
execute function private.fan_out_platform_admin_in_app_alert();

create or replace function private.platform_admin_in_app_notifications(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  result_limit integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  bounded_limit integer;
  unread integer;
  items jsonb;
begin
  perform private.platform_admin_require(
    actor_user_id,
    authenticator_assurance_level
  );

  bounded_limit := greatest(1, least(coalesce(result_limit, 20), 50));

  select count(*)::integer
  into unread
  from private.platform_admin_in_app_notifications notification_row
  where notification_row.auth_user_id = actor_user_id
    and notification_row.read_at is null;

  select coalesce(
    jsonb_agg(notification_row order by notification_row ->> 'created_at' desc),
    '[]'::jsonb
  )
  into items
  from (
    select jsonb_build_object(
      'id', notification_row.id,
      'title', notification_row.title,
      'body', notification_row.body,
      'href', notification_row.href,
      'read_at', notification_row.read_at,
      'created_at', notification_row.created_at,
      'notification_type', notification_row.notification_type,
      'event_kind', event.event_kind
    ) as notification_row
    from private.platform_admin_in_app_notifications notification_row
    join private.platform_notification_events event
      on event.id = notification_row.platform_event_id
    where notification_row.auth_user_id = actor_user_id
    order by notification_row.created_at desc
    limit bounded_limit
  ) page;

  perform private.record_platform_admin_access(
    actor_user_id,
    'allowed',
    'notifications.read',
    request_path,
    null,
    jsonb_build_object('in_app', true, 'unread', unread)
  );

  return jsonb_build_object('unread_count', unread, 'items', items);
end;
$$;

create or replace function private.mark_platform_admin_in_app_notification_read(
  actor_user_id uuid,
  authenticator_assurance_level text,
  target_notification_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.platform_admin_require(
    actor_user_id,
    authenticator_assurance_level
  );

  if target_notification_id is null then
    return false;
  end if;

  update private.platform_admin_in_app_notifications notification_row
  set read_at = coalesce(notification_row.read_at, statement_timestamp())
  where notification_row.id = target_notification_id
    and notification_row.auth_user_id = actor_user_id;

  return found;
end;
$$;

create or replace function private.mark_all_platform_admin_in_app_notifications_read(
  actor_user_id uuid,
  authenticator_assurance_level text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.platform_admin_require(
    actor_user_id,
    authenticator_assurance_level
  );

  update private.platform_admin_in_app_notifications notification_row
  set read_at = coalesce(notification_row.read_at, statement_timestamp())
  where notification_row.auth_user_id = actor_user_id
    and notification_row.read_at is null;

  return true;
end;
$$;

create or replace function public.platform_admin_in_app_notifications(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  result_limit integer
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.platform_admin_in_app_notifications(
    actor_user_id,
    authenticator_assurance_level,
    request_path,
    result_limit
  )
$$;

create or replace function public.mark_platform_admin_in_app_notification_read(
  actor_user_id uuid,
  authenticator_assurance_level text,
  target_notification_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.mark_platform_admin_in_app_notification_read(
    actor_user_id,
    authenticator_assurance_level,
    target_notification_id
  )
$$;

create or replace function public.mark_all_platform_admin_in_app_notifications_read(
  actor_user_id uuid,
  authenticator_assurance_level text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.mark_all_platform_admin_in_app_notifications_read(
    actor_user_id,
    authenticator_assurance_level
  )
$$;

revoke all on function private.platform_admin_in_app_copy(text, uuid, jsonb) from public;
revoke all on function private.fan_out_platform_admin_in_app_alert() from public;
revoke all on function private.platform_admin_in_app_notifications(uuid, text, text, integer) from public;
revoke all on function private.mark_platform_admin_in_app_notification_read(uuid, text, uuid) from public;
revoke all on function private.mark_all_platform_admin_in_app_notifications_read(uuid, text) from public;

revoke all on function public.platform_admin_in_app_notifications(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.mark_platform_admin_in_app_notification_read(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.mark_all_platform_admin_in_app_notifications_read(uuid, text)
  from public, anon, authenticated;

grant execute on function private.platform_admin_in_app_copy(text, uuid, jsonb) to postgres;
grant execute on function private.fan_out_platform_admin_in_app_alert() to postgres;
grant execute on function private.platform_admin_in_app_notifications(uuid, text, text, integer) to postgres;
grant execute on function private.mark_platform_admin_in_app_notification_read(uuid, text, uuid) to postgres;
grant execute on function private.mark_all_platform_admin_in_app_notifications_read(uuid, text) to postgres;

grant execute on function public.platform_admin_in_app_notifications(uuid, text, text, integer)
  to service_role;
grant execute on function public.mark_platform_admin_in_app_notification_read(uuid, text, uuid)
  to service_role;
grant execute on function public.mark_all_platform_admin_in_app_notifications_read(uuid, text)
  to service_role;

alter function private.platform_admin_in_app_copy(text, uuid, jsonb) owner to postgres;
alter function private.fan_out_platform_admin_in_app_alert() owner to postgres;
alter function private.platform_admin_in_app_notifications(uuid, text, text, integer) owner to postgres;
alter function private.mark_platform_admin_in_app_notification_read(uuid, text, uuid) owner to postgres;
alter function private.mark_all_platform_admin_in_app_notifications_read(uuid, text) owner to postgres;

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
  if target_function_name not in (
    'notification-projector',
    'notification-delivery',
    'platform-notification-delivery'
  ) then
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

create or replace function private.invoke_platform_notification_delivery_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_enabled boolean;
begin
  select settings.delivery_enabled
  into delivery_enabled
  from private.platform_notification_settings settings
  where settings.singleton;

  if not coalesce(delivery_enabled, false) then
    return null;
  end if;

  return private.invoke_notification_edge_worker(
    'platform-notification-delivery',
    10
  );
end;
$$;

revoke all on function private.invoke_platform_notification_delivery_worker() from public;
grant execute on function private.invoke_platform_notification_delivery_worker() to postgres;
alter function private.invoke_platform_notification_delivery_worker() owner to postgres;

select cron.unschedule(jobid)
from cron.job
where job.jobname = 'leh_platform_notification_delivery_every_minute';

select cron.schedule(
  'leh_platform_notification_delivery_every_minute',
  '* * * * *',
  $$select private.invoke_platform_notification_delivery_worker();$$
);
