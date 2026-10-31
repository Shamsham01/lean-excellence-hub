-- Platform owner console.
-- Private allowlist, append-only access audit, rate limit, and a
-- transactionally enqueued operator notification outbox.
-- There is no public or authenticated function that inserts platform admins.
-- Possession of /org_admin, an email address, or an organisation-owner grant
-- is not authorisation. Reads require an active allowlist row and aal2.

create table private.platform_admins (
  auth_user_id uuid primary key references auth.users (id) on delete restrict,
  status text not null default 'active',
  mfa_required boolean not null default true,
  label text not null,
  bootstrap_note text,
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  constraint platform_admins_status_check
    check (status in ('active', 'revoked')),
  constraint platform_admins_mfa_required_check
    check (mfa_required),
  constraint platform_admins_label_check
    check (
      label = btrim(label)
      and char_length(label) between 1 and 80
    ),
  constraint platform_admins_bootstrap_note_check
    check (
      bootstrap_note is null
      or (
        bootstrap_note = btrim(bootstrap_note)
        and char_length(bootstrap_note) between 1 and 200
      )
    ),
  constraint platform_admins_revoked_check
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    )
);

comment on table private.platform_admins is
  'Manually provisioned platform-operator allowlist. Authorisation is the Auth user UUID. Do not enrol from a public RPC, email address, JWT metadata, or organisation role.';

create table private.platform_admin_access_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default statement_timestamp(),
  actor_user_id uuid,
  outcome text not null,
  action text not null,
  request_path text,
  resource_id uuid,
  detail jsonb not null default '{}'::jsonb,
  constraint platform_admin_access_events_outcome_check
    check (outcome in ('allowed', 'denied', 'mfa_required', 'rate_limited')),
  constraint platform_admin_access_events_action_check
    check (
      action in (
        'console.read',
        'directory.read',
        'organisation.read',
        'notifications.read',
        'login.attempt'
      )
    ),
  constraint platform_admin_access_events_detail_check
    check (jsonb_typeof(detail) = 'object'),
  constraint platform_admin_access_events_path_check
    check (request_path is null or char_length(request_path) <= 200)
);

comment on table private.platform_admin_access_events is
  'Append-only platform-admin access audit. Ordinary clients cannot update or delete it.';

create index platform_admin_access_events_occurred_idx
  on private.platform_admin_access_events (occurred_at desc);

create trigger platform_admin_access_events_append_only
before update or delete on private.platform_admin_access_events
for each row execute function private.prevent_update_or_delete();

create table private.platform_admin_rate_limits (
  limiter_key text primary key,
  window_started_at timestamptz not null,
  attempt_count integer not null,
  blocked_until timestamptz,
  constraint platform_admin_rate_limits_key_check
    check (char_length(limiter_key) between 16 and 200),
  constraint platform_admin_rate_limits_count_check
    check (attempt_count >= 0)
);

create table private.platform_notification_settings (
  singleton boolean primary key default true,
  recipient_email text not null default 'admin.lean.excellence.hub@gmail.com',
  delivery_enabled boolean not null default false,
  updated_at timestamptz not null default statement_timestamp(),
  constraint platform_notification_settings_singleton_check
    check (singleton),
  constraint platform_notification_settings_recipient_check
    check (
      recipient_email = lower(btrim(recipient_email))
      and recipient_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
);

insert into private.platform_notification_settings (singleton)
values (true);

comment on table private.platform_notification_settings is
  'Operator notification delivery switch. Disabled until a database owner enables it after the email provider is configured. No application RPC updates this table.';

create table private.organisation_stripe_mode (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  livemode boolean not null,
  provider_event_id text not null,
  observed_at timestamptz not null default statement_timestamp(),
  constraint organisation_stripe_mode_event_check
    check (
      provider_event_id = btrim(provider_event_id)
      and char_length(provider_event_id) between 1 and 255
    )
);

comment on table private.organisation_stripe_mode is
  'Stripe livemode observed from a signature-verified webhook. Checkout redirects must not write this table.';

create table private.platform_notification_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  event_kind text not null,
  organisation_id uuid references public.organisations (id) on delete cascade,
  source_event_id text,
  payload jsonb not null default '{}'::jsonb,
  recipient_email text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  processing_started_at timestamptz,
  next_attempt_at timestamptz not null default statement_timestamp(),
  last_error text,
  provider_message_id text,
  suppressed_reason text,
  created_at timestamptz not null default statement_timestamp(),
  sent_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint platform_notification_events_idempotency_key
    unique (idempotency_key),
  constraint platform_notification_events_kind_check
    check (
      event_kind in (
        'founder.email_confirmed',
        'organisation.founded',
        'subscription.entitlement_activated',
        'billing.payment_failed',
        'subscription.cancelled'
      )
    ),
  constraint platform_notification_events_key_check
    check (char_length(idempotency_key) between 8 and 200),
  constraint platform_notification_events_payload_check
    check (jsonb_typeof(payload) = 'object'),
  constraint platform_notification_events_status_check
    check (status in ('pending', 'processing', 'sent', 'failed', 'suppressed')),
  constraint platform_notification_events_attempt_check
    check (attempt_count >= 0),
  constraint platform_notification_events_suppressed_check
    check (
      (
        status = 'suppressed'
        and suppressed_reason is not null
        and char_length(suppressed_reason) between 1 and 80
      )
      or (
        status <> 'suppressed'
        and suppressed_reason is null
      )
    ),
  constraint platform_notification_events_error_check
    check (last_error is null or char_length(last_error) <= 300),
  constraint platform_notification_events_source_check
    check (
      source_event_id is null
      or (
        source_event_id = btrim(source_event_id)
        and char_length(source_event_id) between 1 and 255
      )
    )
);

create index platform_notification_events_claimable_idx
  on private.platform_notification_events (next_attempt_at, created_at)
  where status in ('pending', 'processing');

create index platform_notification_events_created_idx
  on private.platform_notification_events (created_at desc);

create trigger platform_notification_events_touch_updated_at
before update on private.platform_notification_events
for each row execute function private.touch_updated_at();

alter table private.platform_admins enable row level security;
alter table private.platform_admins force row level security;
alter table private.platform_admin_access_events enable row level security;
alter table private.platform_admin_access_events force row level security;
alter table private.platform_admin_rate_limits enable row level security;
alter table private.platform_admin_rate_limits force row level security;
alter table private.platform_notification_settings enable row level security;
alter table private.platform_notification_settings force row level security;
alter table private.organisation_stripe_mode enable row level security;
alter table private.organisation_stripe_mode force row level security;
alter table private.platform_notification_events enable row level security;
alter table private.platform_notification_events force row level security;

revoke all on table private.platform_admins
  from public, anon, authenticated, service_role;
revoke all on table private.platform_admin_access_events
  from public, anon, authenticated, service_role;
revoke all on table private.platform_admin_rate_limits
  from public, anon, authenticated, service_role;
revoke all on table private.platform_notification_settings
  from public, anon, authenticated, service_role;
revoke all on table private.organisation_stripe_mode
  from public, anon, authenticated, service_role;
revoke all on table private.platform_notification_events
  from public, anon, authenticated, service_role;

grant select, insert, update on private.platform_admins to lean_hub_private_owner;
grant select, insert on private.platform_admin_access_events to lean_hub_private_owner;
grant select, insert, update, delete on private.platform_admin_rate_limits
  to lean_hub_private_owner;
grant select, update on private.platform_notification_settings to lean_hub_private_owner;
grant select, insert, update on private.organisation_stripe_mode to lean_hub_private_owner;
grant select, insert, update on private.platform_notification_events
  to lean_hub_private_owner;

create policy private_owner_all_platform_admins
on private.platform_admins
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_select_platform_admin_access_events
on private.platform_admin_access_events
for select
to lean_hub_private_owner
using (true);

create policy private_owner_insert_platform_admin_access_events
on private.platform_admin_access_events
for insert
to lean_hub_private_owner
with check (true);

create policy private_owner_all_platform_admin_rate_limits
on private.platform_admin_rate_limits
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_platform_notification_settings
on private.platform_notification_settings
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_organisation_stripe_mode
on private.organisation_stripe_mode
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_platform_notification_events
on private.platform_notification_events
for all
to lean_hub_private_owner
using (true)
with check (true);

create or replace function private.platform_notification_address_is_synthetic(
  target_email text
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select target_email is not null
    and (
      lower(btrim(target_email)) ~ '@(.+\.)?(test|invalid|example|localhost)$'
      or lower(btrim(target_email)) ~ '@example\.(com|org|net)$'
      or lower(btrim(target_email)) like '%@workforce.invalid'
    )
$$;

create or replace function private.platform_subscription_is_verified_customer(
  target_provider text,
  target_billing_state text
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    target_provider = 'stripe'
      and target_billing_state in (
        'trialing',
        'active',
        'past_due',
        'cancel_at_period_end'
      ),
    false
  )
$$;

create or replace function private.platform_admin_is_active(actor_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.platform_admins admin
    where admin.auth_user_id = actor_user_id
      and admin.status = 'active'
  )
$$;

create or replace function private.platform_admin_require(
  actor_user_id uuid,
  authenticator_assurance_level text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if actor_user_id is null
    or authenticator_assurance_level is distinct from 'aal2'
    or not private.platform_admin_is_active(actor_user_id) then
    raise exception 'platform admin access is not authorised'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.record_platform_admin_access(
  actor_user_id uuid,
  event_outcome text,
  event_action text,
  request_path text,
  resource_id uuid,
  event_detail jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  stored_detail jsonb := coalesce(event_detail, '{}'::jsonb);
begin
  if event_outcome not in ('allowed', 'denied', 'mfa_required', 'rate_limited')
    or event_action not in (
      'console.read',
      'directory.read',
      'organisation.read',
      'notifications.read',
      'login.attempt'
    )
    or jsonb_typeof(stored_detail) is distinct from 'object'
    or char_length(stored_detail::text) > 1000 then
    raise exception 'platform admin audit event is invalid'
      using errcode = '22023';
  end if;

  insert into private.platform_admin_access_events (
    actor_user_id,
    outcome,
    action,
    request_path,
    resource_id,
    detail
  )
  values (
    actor_user_id,
    event_outcome,
    event_action,
    left(request_path, 200),
    resource_id,
    stored_detail
  );
end;
$$;

create or replace function private.consume_platform_admin_rate_limit(
  limiter_key text,
  maximum_attempts integer,
  window_seconds integer,
  block_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_row private.platform_admin_rate_limits%rowtype;
begin
  if limiter_key is null
    or char_length(limiter_key) < 16
    or maximum_attempts < 1
    or window_seconds < 1
    or block_seconds < 1 then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(consume_platform_admin_rate_limit.limiter_key, 0)
  );

  select *
  into current_row
  from private.platform_admin_rate_limits limiter
  where limiter.limiter_key = consume_platform_admin_rate_limit.limiter_key
  for update;

  if current_row.blocked_until is not null
    and current_row.blocked_until > statement_timestamp() then
    return false;
  end if;

  if current_row.limiter_key is null
    or current_row.window_started_at
      <= statement_timestamp() - make_interval(secs => window_seconds) then
    insert into private.platform_admin_rate_limits (
      limiter_key,
      window_started_at,
      attempt_count,
      blocked_until
    )
    values (
      consume_platform_admin_rate_limit.limiter_key,
      statement_timestamp(),
      1,
      null
    )
    on conflict on constraint platform_admin_rate_limits_pkey do update
    set window_started_at = statement_timestamp(),
        attempt_count = 1,
        blocked_until = null;
    return true;
  end if;

  if current_row.attempt_count + 1 > maximum_attempts then
    update private.platform_admin_rate_limits limiter
    set attempt_count = current_row.attempt_count + 1,
        blocked_until = statement_timestamp() + make_interval(secs => block_seconds)
    where limiter.limiter_key = consume_platform_admin_rate_limit.limiter_key;
    return false;
  end if;

  update private.platform_admin_rate_limits limiter
  set attempt_count = current_row.attempt_count + 1,
      blocked_until = null
  where limiter.limiter_key = consume_platform_admin_rate_limit.limiter_key;
  return true;
end;
$$;

create or replace function private.enqueue_platform_notification(
  event_kind text,
  idempotency_key text,
  event_organisation_id uuid,
  source_event_id text,
  payload jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  settings private.platform_notification_settings%rowtype;
  existing_id uuid;
  inserted_id uuid;
  synthetic boolean;
  next_status text;
  next_reason text;
begin
  if event_kind not in (
    'founder.email_confirmed',
    'organisation.founded',
    'subscription.entitlement_activated',
    'billing.payment_failed',
    'subscription.cancelled'
  )
    or idempotency_key is null
    or char_length(idempotency_key) < 8
    or jsonb_typeof(coalesce(payload, 'null'::jsonb)) is distinct from 'object' then
    raise exception 'platform notification is invalid'
      using errcode = '22023';
  end if;

  select event.id
  into existing_id
  from private.platform_notification_events event
  where event.idempotency_key = enqueue_platform_notification.idempotency_key;

  if existing_id is not null then
    return existing_id;
  end if;

  select *
  into settings
  from private.platform_notification_settings
  where singleton;

  if settings.recipient_email is null then
    raise exception 'platform notification recipient is not configured'
      using errcode = '55000';
  end if;

  synthetic := private.platform_notification_address_is_synthetic(payload ->> 'email');
  next_status := case when synthetic then 'suppressed' else 'pending' end;
  next_reason := case when synthetic then 'synthetic_identity' else null end;

  insert into private.platform_notification_events (
    idempotency_key,
    event_kind,
    organisation_id,
    source_event_id,
    payload,
    recipient_email,
    status,
    suppressed_reason
  )
  values (
    enqueue_platform_notification.idempotency_key,
    enqueue_platform_notification.event_kind,
    enqueue_platform_notification.event_organisation_id,
    nullif(btrim(enqueue_platform_notification.source_event_id), ''),
    enqueue_platform_notification.payload,
    settings.recipient_email,
    next_status,
    next_reason
  )
  on conflict on constraint platform_notification_events_idempotency_key do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    return inserted_id;
  end if;

  select event.id
  into existing_id
  from private.platform_notification_events event
  where event.idempotency_key = enqueue_platform_notification.idempotency_key;

  return existing_id;
end;
$$;

create or replace function private.platform_notify_founder_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  founder_email text;
  founder_confirmed boolean;
begin
  if new.consumed_at is null
    or new.consumed_user_id is null
    or old.consumed_at is not null then
    return new;
  end if;

  select auth_user.email, auth_user.email_confirmed_at is not null
  into founder_email, founder_confirmed
  from auth.users auth_user
  where auth_user.id = new.consumed_user_id;

  if coalesce(founder_confirmed, false) is not true then
    return new;
  end if;

  perform private.enqueue_platform_notification(
    'founder.email_confirmed',
    'founder.email_confirmed:' || new.consumed_user_id::text,
    null,
    new.id::text,
    jsonb_build_object(
      'founder_user_id', new.consumed_user_id,
      'email', founder_email,
      'confirmed', true
    )
  );

  return new;
end;
$$;

create trigger platform_notify_founder_confirmed
after update of consumed_at, consumed_user_id
on public.founding_signup_bindings
for each row
when (
  new.consumed_at is not null
  and new.consumed_user_id is not null
  and old.consumed_at is null
)
execute function private.platform_notify_founder_confirmed();

create or replace function private.platform_notify_organisation_founded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_email text;
  owner_name text;
begin
  if new.status is distinct from 'provisioning' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'provisioning' then
    return new;
  end if;

  select auth_user.email, membership.display_name
  into owner_email, owner_name
  from public.organisation_memberships membership
  join public.access_grants grant_row
    on grant_row.organisation_id = membership.organisation_id
    and grant_row.grantee_membership_id = membership.id
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
  join public.role_versions role_version
    on role_version.organisation_id = grant_row.organisation_id
    and role_version.id = grant_row.role_version_id
  join public.roles role
    on role.organisation_id = role_version.organisation_id
    and role.id = role_version.role_id
    and role.is_owner_role
  join auth.users auth_user
    on auth_user.id = membership.user_id
  where membership.organisation_id = new.id
    and membership.status = 'active'
  order by membership.activated_at nulls last
  limit 1;

  perform private.enqueue_platform_notification(
    'organisation.founded',
    'organisation.founded:' || new.id::text,
    new.id,
    new.id::text,
    jsonb_build_object(
      'organisation_name', new.name,
      'organisation_code', new.code,
      'country_code', new.country_code,
      'email', owner_email,
      'owner_display_name', owner_name,
      'multi_site_intent', new.multi_site_intent
    )
  );

  return new;
end;
$$;

create trigger platform_notify_organisation_founded
after insert or update of status on public.organisations
for each row
when (new.status = 'provisioning')
execute function private.platform_notify_organisation_founded();

create or replace function private.platform_notify_subscription_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stripe_mode boolean;
  org_name text;
  org_code text;
  base_payload jsonb;
  entered_entitlement boolean;
begin
  if new.provider is distinct from 'stripe' then
    return new;
  end if;

  select organisation.name, organisation.code
  into org_name, org_code
  from public.organisations organisation
  where organisation.id = new.organisation_id;

  select mode.livemode
  into stripe_mode
  from private.organisation_stripe_mode mode
  where mode.organisation_id = new.organisation_id;

  base_payload := jsonb_build_object(
    'organisation_name', org_name,
    'organisation_code', org_code,
    'plan_code', new.plan_code,
    'billing_interval', new.billing_interval,
    'billing_state', new.billing_state,
    'site_quantity', new.site_quantity,
    'current_period_end', new.current_period_end,
    'stripe_livemode', stripe_mode,
    'provider_subscription_id', new.provider_subscription_id
  );

  entered_entitlement := new.billing_state in ('active', 'trialing');
  if entered_entitlement and tg_op <> 'INSERT' then
    entered_entitlement :=
      old.provider is distinct from 'stripe'
      or old.billing_state is null
      or old.billing_state not in (
        'active',
        'trialing',
        'past_due',
        'cancel_at_period_end'
      );
  end if;

  if entered_entitlement then
    perform private.enqueue_platform_notification(
      'subscription.entitlement_activated',
      'subscription.entitlement_activated:'
        || new.organisation_id::text
        || ':'
        || coalesce(new.provider_subscription_id, 'none'),
      new.organisation_id,
      new.provider_subscription_id,
      base_payload
    );
  end if;

  if new.billing_state = 'past_due'
    and (
      tg_op = 'INSERT'
      or old.billing_state is distinct from 'past_due'
    ) then
    perform private.enqueue_platform_notification(
      'billing.payment_failed',
      'billing.payment_failed:'
        || new.organisation_id::text
        || ':'
        || coalesce(new.provider_subscription_id, 'none')
        || ':'
        || coalesce(new.last_provider_event_at::text, 'none'),
      new.organisation_id,
      new.provider_subscription_id,
      base_payload
    );
  end if;

  if new.billing_state = 'cancel_at_period_end'
    and (
      tg_op = 'INSERT'
      or old.billing_state is distinct from 'cancel_at_period_end'
    ) then
    perform private.enqueue_platform_notification(
      'subscription.cancelled',
      'subscription.cancelled:'
        || new.organisation_id::text
        || ':'
        || coalesce(new.provider_subscription_id, 'none')
        || ':scheduled',
      new.organisation_id,
      new.provider_subscription_id,
      base_payload || jsonb_build_object('cancellation', 'scheduled')
    );
  end if;

  if new.billing_state = 'ended'
    and (tg_op = 'INSERT' or old.billing_state is distinct from 'ended') then
    perform private.enqueue_platform_notification(
      'subscription.cancelled',
      'subscription.cancelled:'
        || new.organisation_id::text
        || ':'
        || coalesce(new.provider_subscription_id, 'none')
        || ':ended',
      new.organisation_id,
      new.provider_subscription_id,
      base_payload || jsonb_build_object('cancellation', 'ended')
    );
  end if;

  return new;
end;
$$;

create trigger platform_notify_subscription_transition
after insert or update of billing_state, provider, provider_subscription_id,
  last_provider_event_at, current_period_end
on public.organisation_subscriptions
for each row
execute function private.platform_notify_subscription_transition();

create or replace function private.record_platform_stripe_mode(
  target_organisation_id uuid,
  livemode boolean,
  provider_event_id text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_organisation_id is null
    or livemode is null
    or provider_event_id is null
    or btrim(provider_event_id) = '' then
    raise exception 'stripe mode observation is invalid'
      using errcode = '22023';
  end if;

  insert into private.organisation_stripe_mode (
    organisation_id,
    livemode,
    provider_event_id,
    observed_at
  )
  values (
    target_organisation_id,
    livemode,
    btrim(provider_event_id),
    statement_timestamp()
  )
  on conflict (organisation_id) do update
  set livemode = excluded.livemode,
      provider_event_id = excluded.provider_event_id,
      observed_at = excluded.observed_at;
end;
$$;

create or replace function private.platform_admin_page_bounds(
  result_limit integer,
  result_offset integer
)
returns table (
  bounded_limit integer,
  bounded_offset integer
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if result_limit is null then
    result_limit := 25;
  end if;
  if result_offset is null then
    result_offset := 0;
  end if;
  if result_limit < 1 or result_limit > 50
    or result_offset < 0 or result_offset > 10000 then
    raise exception 'page bounds are invalid'
      using errcode = '22023';
  end if;
  bounded_limit := result_limit;
  bounded_offset := result_offset;
  return next;
end;
$$;

create or replace function private.platform_admin_overview(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform private.platform_admin_require(
    actor_user_id,
    authenticator_assurance_level
  );

  with organisation_picture as (
    select
      organisation.id,
      organisation.code,
      organisation.name,
      organisation.status,
      organisation.created_at,
      organisation.onboarding_required,
      subscription.provider as subscription_provider,
      subscription.billing_state,
      subscription.plan_code,
      subscription.billing_interval,
      subscription.site_quantity,
      subscription.current_period_end,
      stripe_mode.livemode as stripe_livemode,
      private.platform_subscription_is_verified_customer(
        subscription.provider,
        subscription.billing_state
      ) as verified_customer,
      exists (
        select 1
        from public.billing_webhook_events webhook
        where webhook.organisation_id = organisation.id
          and webhook.processing_state = 'failed'
      ) as webhook_failed
    from public.organisations organisation
    left join public.organisation_subscriptions subscription
      on subscription.organisation_id = organisation.id
    left join private.organisation_stripe_mode stripe_mode
      on stripe_mode.organisation_id = organisation.id
  )
  select jsonb_build_object(
    'registered_identities', (
      select count(*)::integer from auth.users
    ),
    'confirmed_identities', (
      select count(*)::integer
      from auth.users auth_user
      where auth_user.email_confirmed_at is not null
    ),
    'confirmed_founders', (
      select count(*)::integer
      from public.founding_signup_bindings binding
      where binding.consumed_at is not null
    ),
    'unconfirmed_founder_bindings', (
      select count(*)::integer
      from public.founding_signup_bindings binding
      where binding.consumed_at is null
        and binding.expires_at > statement_timestamp()
    ),
    'organisations', jsonb_build_object(
      'provisioning', count(*) filter (where picture.status = 'provisioning'),
      'active', count(*) filter (where picture.status = 'active'),
      'suspended', count(*) filter (where picture.status = 'suspended'),
      'closed', count(*) filter (where picture.status = 'closed')
    ),
    'verified_customers', count(*) filter (where picture.verified_customer),
    'verified_customers_test_mode', count(*) filter (
      where picture.verified_customer and picture.stripe_livemode is false
    ),
    'verified_customers_live_mode', count(*) filter (
      where picture.verified_customer and picture.stripe_livemode is true
    ),
    'verified_customers_mode_unknown', count(*) filter (
      where picture.verified_customer and picture.stripe_livemode is null
    ),
    'active_sites', (
      select count(*)::integer
      from public.organisation_units unit
      join public.organisations organisation
        on organisation.id = unit.organisation_id
      where unit.unit_type = 'site'
        and unit.status = 'active'
        and organisation.status <> 'closed'
    ),
    'subscribed_site_capacity', coalesce(
      sum(picture.site_quantity) filter (where picture.verified_customer),
      0
    ),
    'attention', jsonb_build_object(
      'no_subscription_count', count(*) filter (
        where not picture.verified_customer
      ),
      'incomplete_onboarding_count', count(*) filter (
        where picture.onboarding_required
      ),
      'failed_billing_count', count(*) filter (
        where picture.webhook_failed
          or picture.billing_state in ('past_due', 'suspended', 'ended')
      ),
      'no_subscription', coalesce((
        select jsonb_agg(item order by item ->> 'created_at' desc)
        from (
          select jsonb_build_object(
            'id', row.id,
            'code', row.code,
            'name', row.name,
            'status', row.status,
            'created_at', row.created_at
          ) as item
          from organisation_picture row
          where not row.verified_customer
          order by row.created_at desc
          limit 8
        ) limited
      ), '[]'::jsonb),
      'incomplete_onboarding', coalesce((
        select jsonb_agg(item order by item ->> 'created_at' desc)
        from (
          select jsonb_build_object(
            'id', row.id,
            'code', row.code,
            'name', row.name,
            'status', row.status,
            'created_at', row.created_at
          ) as item
          from organisation_picture row
          where row.onboarding_required
          order by row.created_at desc
          limit 8
        ) limited
      ), '[]'::jsonb),
      'failed_billing', coalesce((
        select jsonb_agg(item order by item ->> 'created_at' desc)
        from (
          select jsonb_build_object(
            'id', row.id,
            'code', row.code,
            'name', row.name,
            'status', row.status,
            'billing_state', row.billing_state,
            'created_at', row.created_at
          ) as item
          from organisation_picture row
          where row.webhook_failed
            or row.billing_state in ('past_due', 'suspended', 'ended')
          order by row.created_at desc
          limit 8
        ) limited
      ), '[]'::jsonb)
    ),
    'plans', coalesce((
      select jsonb_agg(plan_row order by plan_row ->> 'plan_code', plan_row ->> 'billing_interval')
      from (
        select jsonb_build_object(
          'plan_code', picture.plan_code,
          'billing_interval', picture.billing_interval,
          'organisations', count(*)::integer,
          'subscribed_sites', coalesce(sum(picture.site_quantity), 0),
          'earliest_period_end', min(picture.current_period_end)
        ) as plan_row
        from organisation_picture picture
        where picture.verified_customer
        group by picture.plan_code, picture.billing_interval
      ) grouped
    ), '[]'::jsonb),
    'notification_delivery_enabled', (
      select settings.delivery_enabled
      from private.platform_notification_settings settings
      where settings.singleton
    ),
    'notification_recipient', (
      select settings.recipient_email
      from private.platform_notification_settings settings
      where settings.singleton
    ),
    'recent_access', coalesce((
      select jsonb_agg(access_row order by access_row ->> 'occurred_at' desc)
      from (
        select jsonb_build_object(
          'occurred_at', access_event.occurred_at,
          'outcome', access_event.outcome,
          'action', access_event.action,
          'request_path', access_event.request_path
        ) as access_row
        from private.platform_admin_access_events access_event
        order by access_event.occurred_at desc
        limit 8
      ) recent
    ), '[]'::jsonb)
  )
  into result
  from organisation_picture picture;

  perform private.record_platform_admin_access(
    actor_user_id,
    'allowed',
    'console.read',
    request_path,
    null,
    '{}'::jsonb
  );

  return result;
end;
$$;

create or replace function private.platform_admin_organisation_directory(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  search text,
  status_filter text,
  result_limit integer,
  result_offset integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  bounds record;
  search_pattern text;
  normalised_filter text := coalesce(nullif(lower(btrim(status_filter)), ''), 'all');
  result jsonb;
begin
  perform private.platform_admin_require(
    actor_user_id,
    authenticator_assurance_level
  );

  if normalised_filter not in (
    'all',
    'provisioning',
    'active',
    'suspended',
    'closed',
    'attention'
  ) or char_length(coalesce(search, '')) > 80 then
    raise exception 'directory filter is invalid'
      using errcode = '22023';
  end if;

  select *
  into bounds
  from private.platform_admin_page_bounds(result_limit, result_offset);

  if nullif(btrim(search), '') is null then
    search_pattern := null;
  else
    search_pattern :=
      '%'
      || replace(
        replace(replace(lower(btrim(search)), '\', '\\'), '%', '\%'),
        '_',
        '\_'
      )
      || '%';
  end if;

  with picture as (
    select
      organisation.id,
      organisation.code,
      organisation.name,
      organisation.status,
      organisation.country_code,
      organisation.created_at,
      organisation.onboarding_required,
      owner.email as owner_email,
      owner.display_name as owner_display_name,
      subscription.plan_code,
      subscription.billing_interval,
      subscription.billing_state,
      subscription.provider as subscription_provider,
      subscription.site_quantity,
      subscription.current_period_end,
      subscription.cancel_at_period_end,
      subscription.provider_subscription_id,
      account.provider_customer_id,
      account.open_checkout_session_id is not null as checkout_open,
      stripe_mode.livemode as stripe_livemode,
      (
        select count(*)::integer
        from public.organisation_units unit
        where unit.organisation_id = organisation.id
          and unit.unit_type = 'site'
          and unit.status = 'active'
      ) as active_site_count,
      private.platform_subscription_is_verified_customer(
        subscription.provider,
        subscription.billing_state
      ) as verified_customer,
      exists (
        select 1
        from public.billing_webhook_events webhook
        where webhook.organisation_id = organisation.id
          and webhook.processing_state = 'failed'
      ) as webhook_failed
    from public.organisations organisation
    left join lateral (
      select auth_user.email, membership.display_name
      from public.organisation_memberships membership
      join public.access_grants grant_row
        on grant_row.organisation_id = membership.organisation_id
        and grant_row.grantee_membership_id = membership.id
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
        and role_version.id = grant_row.role_version_id
      join public.roles role
        on role.organisation_id = role_version.organisation_id
        and role.id = role_version.role_id
        and role.is_owner_role
      join auth.users auth_user
        on auth_user.id = membership.user_id
      where membership.organisation_id = organisation.id
        and membership.status = 'active'
      order by membership.activated_at nulls last
      limit 1
    ) owner on true
    left join public.organisation_subscriptions subscription
      on subscription.organisation_id = organisation.id
    left join public.organisation_billing_accounts account
      on account.organisation_id = organisation.id
    left join private.organisation_stripe_mode stripe_mode
      on stripe_mode.organisation_id = organisation.id
  ),
  filtered as (
    select *
    from picture
    where (
      search_pattern is null
      or lower(picture.name) like search_pattern escape '\'
      or lower(picture.code) like search_pattern escape '\'
      or lower(coalesce(picture.owner_email, '')) like search_pattern escape '\'
      or lower(coalesce(picture.country_code, '')) like search_pattern escape '\'
    )
    and (
      normalised_filter = 'all'
      or (normalised_filter <> 'attention' and picture.status = normalised_filter)
      or (
        normalised_filter = 'attention'
        and (
          picture.onboarding_required
          or not picture.verified_customer
          or picture.webhook_failed
          or picture.billing_state in ('past_due', 'suspended', 'ended')
        )
      )
    )
  )
  select jsonb_build_object(
    'total', (select count(*)::integer from filtered),
    'limit', bounds.bounded_limit,
    'offset', bounds.bounded_offset,
    'rows', coalesce((
      select jsonb_agg(row_json order by row_json ->> 'created_at' desc)
      from (
        select jsonb_build_object(
          'id', filtered.id,
          'code', filtered.code,
          'name', filtered.name,
          'status', filtered.status,
          'country_code', filtered.country_code,
          'created_at', filtered.created_at,
          'onboarding_required', filtered.onboarding_required,
          'owner_email', filtered.owner_email,
          'owner_display_name', filtered.owner_display_name,
          'plan_code', filtered.plan_code,
          'billing_interval', filtered.billing_interval,
          'billing_state', filtered.billing_state,
          'subscription_provider', filtered.subscription_provider,
          'site_quantity', filtered.site_quantity,
          'active_site_count', filtered.active_site_count,
          'current_period_end', filtered.current_period_end,
          'cancel_at_period_end', filtered.cancel_at_period_end,
          'provider_subscription_id', filtered.provider_subscription_id,
          'provider_customer_id', filtered.provider_customer_id,
          'checkout_open', filtered.checkout_open,
          'stripe_livemode', filtered.stripe_livemode,
          'verified_customer', filtered.verified_customer
        ) as row_json
        from filtered
        order by filtered.created_at desc, filtered.code
        limit bounds.bounded_limit
        offset bounds.bounded_offset
      ) page
    ), '[]'::jsonb)
  )
  into result;

  perform private.record_platform_admin_access(
    actor_user_id,
    'allowed',
    'directory.read',
    request_path,
    null,
    jsonb_build_object('filter', normalised_filter)
  );

  return result;
end;
$$;

create or replace function private.platform_admin_organisation_detail(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  target_organisation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform private.platform_admin_require(
    actor_user_id,
    authenticator_assurance_level
  );

  if target_organisation_id is null then
    raise exception 'organisation is required'
      using errcode = '22023';
  end if;

  with picture as (
    select
      organisation.id,
      organisation.code,
      organisation.name,
      organisation.status,
      organisation.status_reason,
      organisation.status_changed_at,
      organisation.country_code,
      organisation.created_at,
      organisation.onboarding_required,
      organisation.locale,
      organisation.time_zone,
      organisation.multi_site_intent,
      owner.email as owner_email,
      owner.display_name as owner_display_name,
      subscription.plan_code,
      subscription.billing_interval,
      subscription.billing_state,
      subscription.provider as subscription_provider,
      subscription.site_quantity,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.cancel_at_period_end,
      subscription.provider_subscription_id,
      subscription.grace_expires_at,
      account.provider as account_provider,
      account.provider_customer_id,
      account.intended_site_quantity,
      account.open_checkout_session_id is not null as checkout_open,
      stripe_mode.livemode as stripe_livemode,
      stripe_mode.observed_at as stripe_mode_observed_at,
      private.platform_subscription_is_verified_customer(
        subscription.provider,
        subscription.billing_state
      ) as verified_customer
    from public.organisations organisation
    left join lateral (
      select auth_user.email, membership.display_name
      from public.organisation_memberships membership
      join public.access_grants grant_row
        on grant_row.organisation_id = membership.organisation_id
        and grant_row.grantee_membership_id = membership.id
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
        and role_version.id = grant_row.role_version_id
      join public.roles role
        on role.organisation_id = role_version.organisation_id
        and role.id = role_version.role_id
        and role.is_owner_role
      join auth.users auth_user
        on auth_user.id = membership.user_id
      where membership.organisation_id = organisation.id
        and membership.status = 'active'
      order by membership.activated_at nulls last
      limit 1
    ) owner on true
    left join public.organisation_subscriptions subscription
      on subscription.organisation_id = organisation.id
    left join public.organisation_billing_accounts account
      on account.organisation_id = organisation.id
    left join private.organisation_stripe_mode stripe_mode
      on stripe_mode.organisation_id = organisation.id
    where organisation.id = target_organisation_id
  )
  select case
    when picture.id is null then jsonb_build_object('found', false)
    else jsonb_build_object(
      'found', true,
      'organisation', jsonb_build_object(
        'id', picture.id,
        'code', picture.code,
        'name', picture.name,
        'status', picture.status,
        'status_reason', picture.status_reason,
        'status_changed_at', picture.status_changed_at,
        'country_code', picture.country_code,
        'created_at', picture.created_at,
        'onboarding_required', picture.onboarding_required,
        'locale', picture.locale,
        'time_zone', picture.time_zone,
        'multi_site_intent', picture.multi_site_intent,
        'owner_email', picture.owner_email,
        'owner_display_name', picture.owner_display_name
      ),
      'access', jsonb_build_object(
        'organisation_status', picture.status,
        'onboarding_required', picture.onboarding_required,
        'billing_state', picture.billing_state,
        'verified_customer', picture.verified_customer,
        'checkout_open', picture.checkout_open
      ),
      'billing', jsonb_build_object(
        'plan_code', picture.plan_code,
        'billing_interval', picture.billing_interval,
        'billing_state', picture.billing_state,
        'subscription_provider', picture.subscription_provider,
        'account_provider', picture.account_provider,
        'site_quantity', picture.site_quantity,
        'intended_site_quantity', picture.intended_site_quantity,
        'current_period_start', picture.current_period_start,
        'current_period_end', picture.current_period_end,
        'cancel_at_period_end', picture.cancel_at_period_end,
        'grace_expires_at', picture.grace_expires_at,
        'provider_subscription_id', picture.provider_subscription_id,
        'provider_customer_id', picture.provider_customer_id,
        'stripe_livemode', picture.stripe_livemode,
        'stripe_mode_observed_at', picture.stripe_mode_observed_at,
        'checkout_open', picture.checkout_open
      ),
      'sites', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', unit.id,
            'name', unit.name,
            'code', unit.code,
            'status', unit.status
          )
          order by unit.name
        )
        from public.organisation_units unit
        where unit.organisation_id = picture.id
          and unit.unit_type = 'site'
      ), '[]'::jsonb),
      'webhooks', coalesce((
        select jsonb_agg(hook order by hook ->> 'received_at' desc)
        from (
          select jsonb_build_object(
            'event_type', webhook.event_type,
            'processing_state', webhook.processing_state,
            'provider', webhook.provider,
            'provider_event_id', webhook.provider_event_id,
            'received_at', webhook.received_at,
            'processed_at', webhook.processed_at,
            'last_error', left(webhook.last_error, 180)
          ) as hook
          from public.billing_webhook_events webhook
          where webhook.organisation_id = picture.id
          order by webhook.received_at desc
          limit 20
        ) recent_hooks
      ), '[]'::jsonb),
      'security_events', coalesce((
        select jsonb_agg(security_row order by security_row ->> 'occurred_at' desc)
        from (
          select jsonb_build_object(
            'action', audit_event.action,
            'outcome', audit_event.outcome,
            'occurred_at', audit_event.occurred_at
          ) as security_row
          from public.security_audit_events audit_event
          where audit_event.organisation_id = picture.id
          order by audit_event.occurred_at desc
          limit 20
        ) recent_security
      ), '[]'::jsonb),
      'notifications', coalesce((
        select jsonb_agg(notification_row order by notification_row ->> 'created_at' desc)
        from (
          select jsonb_build_object(
            'id', event.id,
            'event_kind', event.event_kind,
            'status', event.status,
            'attempt_count', event.attempt_count,
            'last_error', event.last_error,
            'suppressed_reason', event.suppressed_reason,
            'created_at', event.created_at,
            'sent_at', event.sent_at
          ) as notification_row
          from private.platform_notification_events event
          where event.organisation_id = picture.id
          order by event.created_at desc
          limit 20
        ) recent_notifications
      ), '[]'::jsonb)
    )
  end
  into result
  from picture
  right join (select 1) anchor on true;

  if result is null then
    result := jsonb_build_object('found', false);
  end if;

  perform private.record_platform_admin_access(
    actor_user_id,
    'allowed',
    'organisation.read',
    request_path,
    target_organisation_id,
    jsonb_build_object('found', coalesce(result ->> 'found', 'false') = 'true')
  );

  return result;
end;
$$;

create or replace function private.platform_admin_notification_history(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  result_limit integer,
  result_offset integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  bounds record;
  result jsonb;
begin
  perform private.platform_admin_require(
    actor_user_id,
    authenticator_assurance_level
  );
  select *
  into bounds
  from private.platform_admin_page_bounds(result_limit, result_offset);

  select jsonb_build_object(
    'total', (select count(*)::integer from private.platform_notification_events),
    'limit', bounds.bounded_limit,
    'offset', bounds.bounded_offset,
    'delivery_enabled', (
      select settings.delivery_enabled
      from private.platform_notification_settings settings
      where settings.singleton
    ),
    'recipient_email', (
      select settings.recipient_email
      from private.platform_notification_settings settings
      where settings.singleton
    ),
    'rows', coalesce((
      select jsonb_agg(notification_row order by notification_row ->> 'created_at' desc)
      from (
        select jsonb_build_object(
          'id', event.id,
          'event_kind', event.event_kind,
          'status', event.status,
          'attempt_count', event.attempt_count,
          'last_error', event.last_error,
          'suppressed_reason', event.suppressed_reason,
          'created_at', event.created_at,
          'sent_at', event.sent_at,
          'next_attempt_at', event.next_attempt_at,
          'organisation_id', event.organisation_id,
          'organisation_name', organisation.name,
          'idempotency_key', event.idempotency_key,
          'source_event_id', event.source_event_id,
          'payload', event.payload
        ) as notification_row
        from private.platform_notification_events event
        left join public.organisations organisation
          on organisation.id = event.organisation_id
        order by event.created_at desc
        limit bounds.bounded_limit
        offset bounds.bounded_offset
      ) page
    ), '[]'::jsonb)
  )
  into result;

  perform private.record_platform_admin_access(
    actor_user_id,
    'allowed',
    'notifications.read',
    request_path,
    null,
    '{}'::jsonb
  );

  return result;
end;
$$;

create or replace function private.claim_platform_notifications(
  batch_size integer,
  lease_seconds integer
)
returns table (
  event_id uuid,
  idempotency_key text,
  event_kind text,
  organisation_id uuid,
  payload jsonb,
  recipient_email text,
  attempt_count integer,
  lease_token uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  effective_batch integer := least(greatest(coalesce(batch_size, 10), 1), 50);
  effective_lease integer := least(greatest(coalesce(lease_seconds, 300), 30), 900);
begin
  if not exists (
    select 1
    from private.platform_notification_settings settings
    where settings.singleton
      and settings.delivery_enabled
  ) then
    return;
  end if;

  return query
  with claimable as (
    select event.id
    from private.platform_notification_events event
    where (
      event.status = 'pending'
      and event.next_attempt_at <= statement_timestamp()
    )
    or (
      event.status = 'processing'
      and event.lease_expires_at is not null
      and event.lease_expires_at <= statement_timestamp()
    )
    order by event.created_at
    limit effective_batch
    for update skip locked
  )
  update private.platform_notification_events event
  set status = 'processing',
      processing_started_at = statement_timestamp(),
      lease_expires_at = statement_timestamp() + make_interval(secs => effective_lease),
      lease_token = gen_random_uuid(),
      attempt_count = event.attempt_count + 1
  from claimable
  where event.id = claimable.id
  returning
    event.id,
    event.idempotency_key,
    event.event_kind,
    event.organisation_id,
    event.payload,
    event.recipient_email,
    event.attempt_count,
    event.lease_token;
end;
$$;

create or replace function private.complete_platform_notification(
  target_event_id uuid,
  expected_lease_token uuid,
  target_provider_message_id text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if expected_lease_token is null
    or target_provider_message_id is null
    or btrim(target_provider_message_id) = '' then
    return false;
  end if;

  update private.platform_notification_events event
  set status = 'sent',
      sent_at = statement_timestamp(),
      provider_message_id = left(btrim(target_provider_message_id), 200),
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null,
      last_error = null,
      next_attempt_at = statement_timestamp()
  where event.id = target_event_id
    and event.status = 'processing'
    and event.lease_token = expected_lease_token;

  return found;
end;
$$;

create or replace function private.fail_platform_notification_terminal(
  target_event_id uuid,
  expected_lease_token uuid,
  error_code text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if expected_lease_token is null or error_code is null then
    return false;
  end if;

  update private.platform_notification_events event
  set status = 'failed',
      last_error = left(btrim(error_code), 300),
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null
  where event.id = target_event_id
    and event.status = 'processing'
    and event.lease_token = expected_lease_token;

  return found;
end;
$$;

create or replace function private.fail_platform_notification_retryable(
  target_event_id uuid,
  expected_lease_token uuid,
  error_code text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_attempt integer;
begin
  if expected_lease_token is null or error_code is null then
    return false;
  end if;

  select event.attempt_count
  into current_attempt
  from private.platform_notification_events event
  where event.id = target_event_id
    and event.status = 'processing'
    and event.lease_token = expected_lease_token
  for update;

  if not found then
    return false;
  end if;

  if current_attempt >= 5 then
    return private.fail_platform_notification_terminal(
      target_event_id,
      expected_lease_token,
      error_code
    );
  end if;

  update private.platform_notification_events event
  set status = 'pending',
      last_error = left(btrim(error_code), 300),
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null,
      next_attempt_at = statement_timestamp()
        + private.reliable_processing_retry_delay(current_attempt)
  where event.id = target_event_id
    and event.lease_token = expected_lease_token;

  return found;
end;
$$;

create or replace function public.platform_admin_identity_active(
  target_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.platform_admin_is_active(target_user_id)
$$;

create or replace function public.record_platform_admin_access(
  actor_user_id uuid,
  event_outcome text,
  event_action text,
  request_path text,
  resource_id uuid,
  event_detail jsonb
)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_platform_admin_access(
    actor_user_id,
    event_outcome,
    event_action,
    request_path,
    resource_id,
    event_detail
  )
$$;

create or replace function public.consume_platform_admin_rate_limit(
  limiter_key text,
  maximum_attempts integer,
  window_seconds integer,
  block_seconds integer
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.consume_platform_admin_rate_limit(
    limiter_key,
    maximum_attempts,
    window_seconds,
    block_seconds
  )
$$;

create or replace function public.platform_admin_overview(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.platform_admin_overview(
    actor_user_id,
    authenticator_assurance_level,
    request_path
  )
$$;

create or replace function public.platform_admin_organisation_directory(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  search text,
  status_filter text,
  result_limit integer,
  result_offset integer
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.platform_admin_organisation_directory(
    actor_user_id,
    authenticator_assurance_level,
    request_path,
    search,
    status_filter,
    result_limit,
    result_offset
  )
$$;

create or replace function public.platform_admin_organisation_detail(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  target_organisation_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.platform_admin_organisation_detail(
    actor_user_id,
    authenticator_assurance_level,
    request_path,
    target_organisation_id
  )
$$;

create or replace function public.platform_admin_notification_history(
  actor_user_id uuid,
  authenticator_assurance_level text,
  request_path text,
  result_limit integer,
  result_offset integer
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.platform_admin_notification_history(
    actor_user_id,
    authenticator_assurance_level,
    request_path,
    result_limit,
    result_offset
  )
$$;

create or replace function public.record_platform_stripe_mode(
  target_organisation_id uuid,
  livemode boolean,
  provider_event_id text
)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_platform_stripe_mode(
    target_organisation_id,
    livemode,
    provider_event_id
  )
$$;

create or replace function public.claim_platform_notifications_for_worker(
  batch_size integer default 10,
  lease_seconds integer default 300
)
returns table (
  event_id uuid,
  idempotency_key text,
  event_kind text,
  organisation_id uuid,
  payload jsonb,
  recipient_email text,
  attempt_count integer,
  lease_token uuid
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select
    claimed.event_id,
    claimed.idempotency_key,
    claimed.event_kind,
    claimed.organisation_id,
    claimed.payload,
    claimed.recipient_email,
    claimed.attempt_count,
    claimed.lease_token
  from private.claim_platform_notifications(batch_size, lease_seconds) claimed
$$;

create or replace function public.complete_platform_notification_for_worker(
  target_event_id uuid,
  expected_lease_token uuid,
  target_provider_message_id text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.complete_platform_notification(
    target_event_id,
    expected_lease_token,
    target_provider_message_id
  )
$$;

create or replace function public.fail_platform_notification_retryable_for_worker(
  target_event_id uuid,
  expected_lease_token uuid,
  error_code text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.fail_platform_notification_retryable(
    target_event_id,
    expected_lease_token,
    error_code
  )
$$;

create or replace function public.fail_platform_notification_terminal_for_worker(
  target_event_id uuid,
  expected_lease_token uuid,
  error_code text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.fail_platform_notification_terminal(
    target_event_id,
    expected_lease_token,
    error_code
  )
$$;

revoke all on function private.platform_notification_address_is_synthetic(text)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_subscription_is_verified_customer(text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_admin_is_active(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_admin_require(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.record_platform_admin_access(uuid, text, text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.consume_platform_admin_rate_limit(text, integer, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.enqueue_platform_notification(text, text, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_notify_founder_confirmed()
  from public, anon, authenticated, service_role;
revoke all on function private.platform_notify_organisation_founded()
  from public, anon, authenticated, service_role;
revoke all on function private.platform_notify_subscription_transition()
  from public, anon, authenticated, service_role;
revoke all on function private.record_platform_stripe_mode(uuid, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_admin_page_bounds(integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_admin_overview(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_admin_organisation_directory(uuid, text, text, text, text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_admin_organisation_detail(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_admin_notification_history(uuid, text, text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.claim_platform_notifications(integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.complete_platform_notification(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.fail_platform_notification_terminal(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.fail_platform_notification_retryable(uuid, uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function public.platform_admin_identity_active(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.record_platform_admin_access(uuid, text, text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.consume_platform_admin_rate_limit(text, integer, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.platform_admin_overview(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.platform_admin_organisation_directory(uuid, text, text, text, text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.platform_admin_organisation_detail(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.platform_admin_notification_history(uuid, text, text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.record_platform_stripe_mode(uuid, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_platform_notifications_for_worker(integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_platform_notification_for_worker(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_platform_notification_retryable_for_worker(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_platform_notification_terminal_for_worker(uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function private.platform_admin_is_active(uuid) to service_role;
grant execute on function private.record_platform_admin_access(uuid, text, text, text, uuid, jsonb)
  to service_role;
grant execute on function private.consume_platform_admin_rate_limit(text, integer, integer, integer)
  to service_role;
grant execute on function private.record_platform_stripe_mode(uuid, boolean, text)
  to service_role;
grant execute on function private.platform_admin_overview(uuid, text, text) to service_role;
grant execute on function private.platform_admin_organisation_directory(uuid, text, text, text, text, integer, integer)
  to service_role;
grant execute on function private.platform_admin_organisation_detail(uuid, text, text, uuid)
  to service_role;
grant execute on function private.platform_admin_notification_history(uuid, text, text, integer, integer)
  to service_role;
grant execute on function private.claim_platform_notifications(integer, integer) to service_role;
grant execute on function private.complete_platform_notification(uuid, uuid, text) to service_role;
grant execute on function private.fail_platform_notification_retryable(uuid, uuid, text)
  to service_role;
grant execute on function private.fail_platform_notification_terminal(uuid, uuid, text)
  to service_role;

grant execute on function public.platform_admin_identity_active(uuid) to service_role;
grant execute on function public.record_platform_admin_access(uuid, text, text, text, uuid, jsonb)
  to service_role;
grant execute on function public.consume_platform_admin_rate_limit(text, integer, integer, integer)
  to service_role;
grant execute on function public.platform_admin_overview(uuid, text, text) to service_role;
grant execute on function public.platform_admin_organisation_directory(uuid, text, text, text, text, integer, integer)
  to service_role;
grant execute on function public.platform_admin_organisation_detail(uuid, text, text, uuid)
  to service_role;
grant execute on function public.platform_admin_notification_history(uuid, text, text, integer, integer)
  to service_role;
grant execute on function public.record_platform_stripe_mode(uuid, boolean, text) to service_role;
grant execute on function public.claim_platform_notifications_for_worker(integer, integer)
  to service_role;
grant execute on function public.complete_platform_notification_for_worker(uuid, uuid, text)
  to service_role;
grant execute on function public.fail_platform_notification_retryable_for_worker(uuid, uuid, text)
  to service_role;
grant execute on function public.fail_platform_notification_terminal_for_worker(uuid, uuid, text)
  to service_role;

alter function private.platform_notification_address_is_synthetic(text) owner to postgres;
alter function private.platform_subscription_is_verified_customer(text, text) owner to postgres;
alter function private.platform_admin_is_active(uuid) owner to postgres;
alter function private.platform_admin_require(uuid, text) owner to postgres;
alter function private.record_platform_admin_access(uuid, text, text, text, uuid, jsonb)
  owner to postgres;
alter function private.consume_platform_admin_rate_limit(text, integer, integer, integer)
  owner to postgres;
alter function private.enqueue_platform_notification(text, text, uuid, text, jsonb)
  owner to postgres;
alter function private.platform_notify_founder_confirmed() owner to postgres;
alter function private.platform_notify_organisation_founded() owner to postgres;
alter function private.platform_notify_subscription_transition() owner to postgres;
alter function private.record_platform_stripe_mode(uuid, boolean, text) owner to postgres;
alter function private.platform_admin_page_bounds(integer, integer) owner to postgres;
alter function private.platform_admin_overview(uuid, text, text) owner to postgres;
alter function private.platform_admin_organisation_directory(uuid, text, text, text, text, integer, integer)
  owner to postgres;
alter function private.platform_admin_organisation_detail(uuid, text, text, uuid) owner to postgres;
alter function private.platform_admin_notification_history(uuid, text, text, integer, integer)
  owner to postgres;
alter function private.claim_platform_notifications(integer, integer) owner to postgres;
alter function private.complete_platform_notification(uuid, uuid, text) owner to postgres;
alter function private.fail_platform_notification_terminal(uuid, uuid, text) owner to postgres;
alter function private.fail_platform_notification_retryable(uuid, uuid, text) owner to postgres;
