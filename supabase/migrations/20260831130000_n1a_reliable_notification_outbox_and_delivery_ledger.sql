-- N1a: reliable domain-event outbox processing and notification delivery ledger.
-- Hardens lease/fencing, retry scheduling, and terminal failure without changing event semantics.

drop function if exists private.claim_domain_events(integer);
drop function if exists private.mark_domain_event_processed(uuid, uuid, text);

create or replace function private.reliable_processing_retry_delay(attempt_count integer)
returns interval
language sql
immutable
parallel safe
set search_path = ''
as $$
  select make_interval(
    secs => least(
      3600,
      60 * power(2, greatest(coalesce(attempt_count, 1) - 1, 0))::integer
    )
  )
$$;

create or replace function private.domain_event_outbox_max_attempts()
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 5
$$;

create or replace function private.domain_event_outbox_default_lease_seconds()
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 300
$$;

create or replace function private.notification_delivery_max_attempts()
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 5
$$;

create or replace function private.notification_delivery_default_lease_seconds()
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 300
$$;

alter table private.domain_event_outbox
  add column if not exists processing_started_at timestamptz,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists lease_token uuid,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error_code text,
  add column if not exists last_error_detail text;

alter table private.domain_event_outbox
  drop constraint if exists domain_event_outbox_attempt_count_check;

alter table private.domain_event_outbox
  add constraint domain_event_outbox_attempt_count_check
    check (attempt_count >= 0);

alter table private.domain_event_outbox
  drop constraint if exists domain_event_outbox_last_error_code_check;

alter table private.domain_event_outbox
  add constraint domain_event_outbox_last_error_code_check
    check (
      last_error_code is null
      or (
        last_error_code = btrim(last_error_code)
        and char_length(last_error_code) between 1 and 80
      )
    );

alter table private.domain_event_outbox
  drop constraint if exists domain_event_outbox_last_error_detail_check;

alter table private.domain_event_outbox
  add constraint domain_event_outbox_last_error_detail_check
    check (
      last_error_detail is null
      or (
        last_error_detail = btrim(last_error_detail)
        and char_length(last_error_detail) between 1 and 500
      )
    );

update private.domain_event_outbox outbox_row
set processing_state = 'pending',
    processing_started_at = null,
    lease_expires_at = null,
    lease_token = null
where outbox_row.processing_state = 'processing';

drop index if exists private.domain_event_outbox_pending_idx;

create index domain_event_outbox_claimable_idx
  on private.domain_event_outbox (available_at, created_at)
  where processing_state in ('pending', 'processing');

create table private.notification_delivery_ledger (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  source_domain_event_id uuid not null,
  recipient_membership_id uuid not null,
  notification_kind text not null,
  delivery_key text not null,
  status text not null default 'pending',
  available_at timestamptz not null default statement_timestamp(),
  processing_started_at timestamptz,
  lease_expires_at timestamptz,
  lease_token uuid,
  attempt_count integer not null default 0,
  last_error_code text,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint notification_delivery_ledger_organisation_id_id_key
    unique (organisation_id, id),
  constraint notification_delivery_ledger_delivery_key
    unique (organisation_id, delivery_key),
  constraint notification_delivery_ledger_source_event_fkey
    foreign key (organisation_id, source_domain_event_id)
    references private.domain_event_outbox(organisation_id, id)
    on delete restrict,
  constraint notification_delivery_ledger_recipient_fkey
    foreign key (organisation_id, recipient_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint notification_delivery_ledger_status_check
    check (status in ('pending', 'processing', 'sent', 'needs_remediation')),
  constraint notification_delivery_ledger_kind_check
    check (
      notification_kind = btrim(notification_kind)
      and char_length(notification_kind) between 1 and 120
    ),
  constraint notification_delivery_ledger_delivery_key_check
    check (
      delivery_key = btrim(delivery_key)
      and char_length(delivery_key) between 1 and 200
    ),
  constraint notification_delivery_ledger_attempt_count_check
    check (attempt_count >= 0),
  constraint notification_delivery_ledger_last_error_code_check
    check (
      last_error_code is null
      or (
        last_error_code = btrim(last_error_code)
        and char_length(last_error_code) between 1 and 80
      )
    ),
  constraint notification_delivery_ledger_provider_message_id_check
    check (
      provider_message_id is null
      or (
        provider_message_id = btrim(provider_message_id)
        and char_length(provider_message_id) between 1 and 200
      )
    )
);

create index notification_delivery_ledger_claimable_idx
  on private.notification_delivery_ledger (available_at, created_at)
  where status in ('pending', 'processing');

create trigger notification_delivery_ledger_touch_updated_at
before update on private.notification_delivery_ledger
for each row execute function private.touch_updated_at();

alter table private.notification_delivery_ledger enable row level security;
alter table private.notification_delivery_ledger force row level security;

grant select, insert, update on private.notification_delivery_ledger to lean_hub_private_owner;

create policy private_owner_all_notification_delivery_ledger
on private.notification_delivery_ledger
for all
to lean_hub_private_owner
using (true)
with check (true);

create or replace function private.enqueue_domain_event(
  event_organisation_id uuid,
  event_resource_record_id uuid,
  event_type text,
  event_idempotency_key text,
  event_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  insert into private.domain_event_outbox (
    organisation_id,
    resource_record_id,
    event_type,
    payload,
    idempotency_key
  )
  values (
    event_organisation_id,
    event_resource_record_id,
    event_type,
    coalesce(event_payload, '{}'::jsonb),
    event_idempotency_key
  )
  on conflict (organisation_id, idempotency_key) do nothing
  returning id into event_id;

  if event_id is null then
    select outbox_row.id
    into event_id
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = event_organisation_id
      and outbox_row.idempotency_key = event_idempotency_key;
  end if;

  return event_id;
end;
$$;

create or replace function private.claim_domain_events(
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
  effective_lease_seconds integer;
begin
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
    where (
      outbox_row.processing_state = 'pending'
      and outbox_row.available_at <= statement_timestamp()
    )
    or (
      outbox_row.processing_state = 'processing'
      and outbox_row.lease_expires_at is not null
      and outbox_row.lease_expires_at <= statement_timestamp()
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

create or replace function private.complete_domain_event(
  target_organisation_id uuid,
  target_event_id uuid,
  expected_lease_token uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if expected_lease_token is null then
    return false;
  end if;

  update private.domain_event_outbox outbox_row
  set processing_state = 'processed',
      processed_at = statement_timestamp(),
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null,
      last_error_code = null,
      last_error_detail = null
  where outbox_row.organisation_id = target_organisation_id
    and outbox_row.id = target_event_id
    and outbox_row.processing_state = 'processing'
    and outbox_row.lease_token = expected_lease_token;

  return found;
end;
$$;

create or replace function private.fail_domain_event_retryable(
  target_organisation_id uuid,
  target_event_id uuid,
  expected_lease_token uuid,
  error_code text,
  error_detail text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_attempt_count integer;
begin
  if expected_lease_token is null then
    return false;
  end if;

  select outbox_row.attempt_count
  into current_attempt_count
  from private.domain_event_outbox outbox_row
  where outbox_row.organisation_id = target_organisation_id
    and outbox_row.id = target_event_id
    and outbox_row.processing_state = 'processing'
    and outbox_row.lease_token = expected_lease_token
  for update;

  if not found then
    return false;
  end if;

  if current_attempt_count >= private.domain_event_outbox_max_attempts() then
    return private.fail_domain_event_terminal(
      target_organisation_id,
      target_event_id,
      expected_lease_token,
      error_code,
      error_detail
    );
  end if;

  update private.domain_event_outbox outbox_row
  set processing_state = 'pending',
      available_at = statement_timestamp()
        + private.reliable_processing_retry_delay(current_attempt_count),
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null,
      last_error_code = error_code,
      last_error_detail = error_detail
  where outbox_row.organisation_id = target_organisation_id
    and outbox_row.id = target_event_id
    and outbox_row.processing_state = 'processing'
    and outbox_row.lease_token = expected_lease_token;

  return found;
end;
$$;

create or replace function private.fail_domain_event_terminal(
  target_organisation_id uuid,
  target_event_id uuid,
  expected_lease_token uuid,
  error_code text,
  error_detail text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if expected_lease_token is null then
    return false;
  end if;

  update private.domain_event_outbox outbox_row
  set processing_state = 'failed',
      processed_at = statement_timestamp(),
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null,
      last_error_code = error_code,
      last_error_detail = error_detail
  where outbox_row.organisation_id = target_organisation_id
    and outbox_row.id = target_event_id
    and outbox_row.processing_state = 'processing'
    and outbox_row.lease_token = expected_lease_token;

  return found;
end;
$$;

create or replace function private.mark_domain_event_processed(
  target_organisation_id uuid,
  target_event_id uuid,
  target_state text default 'processed',
  expected_lease_token uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_state = 'processed' then
    if expected_lease_token is null then
      return false;
    end if;

    return private.complete_domain_event(
      target_organisation_id,
      target_event_id,
      expected_lease_token
    );
  end if;

  if target_state = 'failed' then
    if expected_lease_token is null then
      return false;
    end if;

    return private.fail_domain_event_terminal(
      target_organisation_id,
      target_event_id,
      expected_lease_token,
      'legacy_failed',
      null
    );
  end if;

  return false;
end;
$$;

create or replace function private.create_notification_delivery(
  target_organisation_id uuid,
  source_domain_event_id uuid,
  recipient_membership_id uuid,
  notification_kind text,
  delivery_key text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  delivery_id uuid;
  event_org_id uuid;
  membership_org_id uuid;
begin
  select outbox_row.organisation_id
  into event_org_id
  from private.domain_event_outbox outbox_row
  where outbox_row.id = source_domain_event_id;

  if event_org_id is null then
    raise exception 'source domain event does not exist'
      using errcode = '23503';
  end if;

  if event_org_id is distinct from target_organisation_id then
    raise exception 'source domain event organisation mismatch'
      using errcode = '23514';
  end if;

  select membership_row.organisation_id
  into membership_org_id
  from public.organisation_memberships membership_row
  where membership_row.id = recipient_membership_id;

  if membership_org_id is null then
    raise exception 'recipient membership does not exist'
      using errcode = '23503';
  end if;

  if membership_org_id is distinct from target_organisation_id then
    raise exception 'recipient membership organisation mismatch'
      using errcode = '23514';
  end if;

  insert into private.notification_delivery_ledger (
    organisation_id,
    source_domain_event_id,
    recipient_membership_id,
    notification_kind,
    delivery_key
  )
  values (
    target_organisation_id,
    source_domain_event_id,
    recipient_membership_id,
    notification_kind,
    delivery_key
  )
  on conflict (organisation_id, delivery_key) do nothing
  returning id into delivery_id;

  if delivery_id is null then
    select ledger_row.id
    into delivery_id
    from private.notification_delivery_ledger ledger_row
    where ledger_row.organisation_id = target_organisation_id
      and ledger_row.delivery_key = delivery_key;
  end if;

  return delivery_id;
end;
$$;

create or replace function private.claim_notification_deliveries(
  batch_size integer default 10,
  lease_seconds integer default null
)
returns setof private.notification_delivery_ledger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  effective_lease_seconds integer;
begin
  if batch_size is null or batch_size < 1 or batch_size > 1000 then
    raise exception 'batch_size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  effective_lease_seconds :=
    coalesce(lease_seconds, private.notification_delivery_default_lease_seconds());

  if effective_lease_seconds < 1 or effective_lease_seconds > 3600 then
    raise exception 'lease_seconds must be between 1 and 3600'
      using errcode = '22023';
  end if;

  return query
  with claimable as (
    select ledger_row.id
    from private.notification_delivery_ledger ledger_row
    where (
      ledger_row.status = 'pending'
      and ledger_row.available_at <= statement_timestamp()
    )
    or (
      ledger_row.status = 'processing'
      and ledger_row.lease_expires_at is not null
      and ledger_row.lease_expires_at <= statement_timestamp()
    )
    order by ledger_row.created_at
    limit batch_size
    for update skip locked
  )
  update private.notification_delivery_ledger ledger_row
  set status = 'processing',
      processing_started_at = statement_timestamp(),
      lease_expires_at = statement_timestamp()
        + make_interval(secs => effective_lease_seconds),
      lease_token = gen_random_uuid(),
      attempt_count = ledger_row.attempt_count + 1
  from claimable
  where ledger_row.id = claimable.id
  returning ledger_row.*;
end;
$$;

create or replace function private.complete_notification_delivery(
  target_organisation_id uuid,
  target_delivery_id uuid,
  expected_lease_token uuid,
  provider_message_id text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if expected_lease_token is null then
    return false;
  end if;

  update private.notification_delivery_ledger ledger_row
  set status = 'sent',
      sent_at = statement_timestamp(),
      provider_message_id = provider_message_id,
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null,
      last_error_code = null
  where ledger_row.organisation_id = target_organisation_id
    and ledger_row.id = target_delivery_id
    and ledger_row.status = 'processing'
    and ledger_row.lease_token = expected_lease_token;

  return found;
end;
$$;

create or replace function private.fail_notification_delivery_retryable(
  target_organisation_id uuid,
  target_delivery_id uuid,
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
  current_attempt_count integer;
begin
  if expected_lease_token is null then
    return false;
  end if;

  select ledger_row.attempt_count
  into current_attempt_count
  from private.notification_delivery_ledger ledger_row
  where ledger_row.organisation_id = target_organisation_id
    and ledger_row.id = target_delivery_id
    and ledger_row.status = 'processing'
    and ledger_row.lease_token = expected_lease_token
  for update;

  if not found then
    return false;
  end if;

  if current_attempt_count >= private.notification_delivery_max_attempts() then
    return private.fail_notification_delivery_terminal(
      target_organisation_id,
      target_delivery_id,
      expected_lease_token,
      error_code
    );
  end if;

  update private.notification_delivery_ledger ledger_row
  set status = 'pending',
      available_at = statement_timestamp()
        + private.reliable_processing_retry_delay(current_attempt_count),
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null,
      last_error_code = error_code
  where ledger_row.organisation_id = target_organisation_id
    and ledger_row.id = target_delivery_id
    and ledger_row.status = 'processing'
    and ledger_row.lease_token = expected_lease_token;

  return found;
end;
$$;

create or replace function private.fail_notification_delivery_terminal(
  target_organisation_id uuid,
  target_delivery_id uuid,
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
  if expected_lease_token is null then
    return false;
  end if;

  update private.notification_delivery_ledger ledger_row
  set status = 'needs_remediation',
      processing_started_at = null,
      lease_expires_at = null,
      lease_token = null,
      last_error_code = error_code
  where ledger_row.organisation_id = target_organisation_id
    and ledger_row.id = target_delivery_id
    and ledger_row.status = 'processing'
    and ledger_row.lease_token = expected_lease_token;

  return found;
end;
$$;

alter function private.reliable_processing_retry_delay(integer)
  owner to lean_hub_private_owner;
alter function private.domain_event_outbox_max_attempts()
  owner to lean_hub_private_owner;
alter function private.domain_event_outbox_default_lease_seconds()
  owner to lean_hub_private_owner;
alter function private.notification_delivery_max_attempts()
  owner to lean_hub_private_owner;
alter function private.notification_delivery_default_lease_seconds()
  owner to lean_hub_private_owner;
alter function private.enqueue_domain_event(uuid, uuid, text, text, jsonb)
  owner to lean_hub_private_owner;
alter function private.claim_domain_events(integer, integer)
  owner to lean_hub_private_owner;
alter function private.complete_domain_event(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.fail_domain_event_retryable(uuid, uuid, uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.fail_domain_event_terminal(uuid, uuid, uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.mark_domain_event_processed(uuid, uuid, text, uuid)
  owner to lean_hub_private_owner;
alter function private.create_notification_delivery(uuid, uuid, uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.claim_notification_deliveries(integer, integer)
  owner to lean_hub_private_owner;
alter function private.complete_notification_delivery(uuid, uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.fail_notification_delivery_retryable(uuid, uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.fail_notification_delivery_terminal(uuid, uuid, uuid, text)
  owner to lean_hub_private_owner;

revoke all on function private.reliable_processing_retry_delay(integer)
  from public, anon, authenticated;
revoke all on function private.domain_event_outbox_max_attempts()
  from public, anon, authenticated;
revoke all on function private.domain_event_outbox_default_lease_seconds()
  from public, anon, authenticated;
revoke all on function private.notification_delivery_max_attempts()
  from public, anon, authenticated;
revoke all on function private.notification_delivery_default_lease_seconds()
  from public, anon, authenticated;
revoke all on function private.enqueue_domain_event(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function private.claim_domain_events(integer, integer)
  from public, anon, authenticated;
revoke all on function private.complete_domain_event(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.fail_domain_event_retryable(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function private.fail_domain_event_terminal(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function private.mark_domain_event_processed(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function private.create_notification_delivery(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function private.claim_notification_deliveries(integer, integer)
  from public, anon, authenticated;
revoke all on function private.complete_notification_delivery(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.fail_notification_delivery_retryable(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.fail_notification_delivery_terminal(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function private.claim_domain_events(integer, integer) to service_role;
grant execute on function private.complete_domain_event(uuid, uuid, uuid) to service_role;
grant execute on function private.fail_domain_event_retryable(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function private.fail_domain_event_terminal(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function private.mark_domain_event_processed(uuid, uuid, text, uuid)
  to service_role;
grant execute on function private.create_notification_delivery(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function private.claim_notification_deliveries(integer, integer) to service_role;
grant execute on function private.complete_notification_delivery(uuid, uuid, uuid, text)
  to service_role;
grant execute on function private.fail_notification_delivery_retryable(uuid, uuid, uuid, text)
  to service_role;
grant execute on function private.fail_notification_delivery_terminal(uuid, uuid, uuid, text)
  to service_role;
