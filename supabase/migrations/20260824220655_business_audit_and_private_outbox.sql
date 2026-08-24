create table public.business_audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  actor_membership_id uuid,
  resource_record_id uuid,
  event_action text not null,
  event_outcome text not null,
  request_correlation_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint business_audit_events_organisation_id_id_key
    unique (organisation_id, id),
  constraint business_audit_events_actor_fkey
    foreign key (organisation_id, actor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint business_audit_events_resource_fkey
    foreign key (organisation_id, resource_record_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint business_audit_events_action_check
    check (event_action = btrim(event_action) and char_length(event_action) between 1 and 120),
  constraint business_audit_events_outcome_check
    check (event_outcome in ('succeeded', 'failed', 'denied')),
  constraint business_audit_events_metadata_check
    check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

create index business_audit_events_org_created_idx
  on public.business_audit_events (organisation_id, created_at desc);

create trigger business_audit_events_prevent_update
before update on public.business_audit_events
for each row execute function private.prevent_update_or_delete();

create trigger business_audit_events_prevent_delete
before delete on public.business_audit_events
for each row execute function private.prevent_update_or_delete();

alter table public.business_audit_events enable row level security;
alter table public.business_audit_events force row level security;

revoke all on public.business_audit_events from public, anon, authenticated, service_role;
grant select, insert on public.business_audit_events to lean_hub_private_owner;

create policy private_owner_all_business_audit
on public.business_audit_events
for all
to lean_hub_private_owner
using (true)
with check (true);

create table private.domain_event_outbox (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  resource_record_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  processing_state text not null default 'pending',
  available_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  processed_at timestamptz,
  constraint domain_event_outbox_organisation_id_id_key
    unique (organisation_id, id),
  constraint domain_event_outbox_idempotency_key
    unique (organisation_id, idempotency_key),
  constraint domain_event_outbox_resource_fkey
    foreign key (organisation_id, resource_record_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint domain_event_outbox_type_check
    check (event_type = btrim(event_type) and char_length(event_type) between 1 and 120),
  constraint domain_event_outbox_state_check
    check (processing_state in ('pending', 'processing', 'processed', 'failed')),
  constraint domain_event_outbox_payload_check
    check (pg_catalog.jsonb_typeof(payload) = 'object')
);

create index domain_event_outbox_pending_idx
  on private.domain_event_outbox (processing_state, available_at)
  where processing_state = 'pending';

alter table private.domain_event_outbox enable row level security;
alter table private.domain_event_outbox force row level security;

grant select, insert, update on private.domain_event_outbox to lean_hub_private_owner;

create policy private_owner_all_outbox
on private.domain_event_outbox
for all
to lean_hub_private_owner
using (true)
with check (true);

create or replace function private.append_business_audit(
  event_organisation_id uuid,
  event_action text,
  event_resource_record_id uuid,
  event_outcome text,
  event_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  actor_membership uuid;
begin
  actor_membership :=
    private.current_membership_id(event_organisation_id);

  insert into public.business_audit_events (
    organisation_id,
    actor_membership_id,
    resource_record_id,
    event_action,
    event_outcome,
    request_correlation_id,
    metadata
  )
  values (
    event_organisation_id,
    actor_membership,
    event_resource_record_id,
    event_action,
    event_outcome,
    private.request_correlation_id(),
    coalesce(event_metadata, '{}'::jsonb)
  )
  returning id into event_id;

  return event_id;
end;
$$;

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
  batch_size integer default 10
)
returns setof private.domain_event_outbox
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  with claimed as (
    select outbox_row.id
    from private.domain_event_outbox outbox_row
    where outbox_row.processing_state = 'pending'
      and outbox_row.available_at <= statement_timestamp()
    order by outbox_row.created_at
    limit batch_size
    for update skip locked
  )
  update private.domain_event_outbox outbox_row
  set processing_state = 'processing'
  from claimed
  where outbox_row.id = claimed.id
  returning outbox_row.*;
end;
$$;

create or replace function private.mark_domain_event_processed(
  target_organisation_id uuid,
  target_event_id uuid,
  target_state text default 'processed'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_state not in ('processed', 'failed') then
    return false;
  end if;

  update private.domain_event_outbox outbox_row
  set processing_state = target_state,
      processed_at = statement_timestamp()
  where outbox_row.organisation_id = target_organisation_id
    and outbox_row.id = target_event_id
    and outbox_row.processing_state = 'processing';

  return found;
end;
$$;

alter function private.append_business_audit(uuid, text, uuid, text, jsonb)
  owner to lean_hub_private_owner;
alter function private.enqueue_domain_event(uuid, uuid, text, text, jsonb)
  owner to lean_hub_private_owner;
alter function private.claim_domain_events(integer)
  owner to lean_hub_private_owner;
alter function private.mark_domain_event_processed(uuid, uuid, text)
  owner to lean_hub_private_owner;

revoke all on function private.append_business_audit(uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function private.enqueue_domain_event(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function private.claim_domain_events(integer)
  from public, anon, authenticated;
revoke all on function private.mark_domain_event_processed(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function private.claim_domain_events(integer) to service_role;
grant execute on function private.mark_domain_event_processed(uuid, uuid, text)
  to service_role;
