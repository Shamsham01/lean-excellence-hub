-- Organisation invitation email delivery ledger and inbox attestation.
-- Raw invitation tokens never persist in PostgreSQL; only digests and inbox proofs.

create table private.organisation_invitation_deliveries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  invitation_id uuid not null references public.organisation_invitations(id) on delete restrict,
  delivery_key text not null,
  recipient_email text not null,
  inbox_proof_digest bytea not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default statement_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_idempotency_key text not null,
  provider_message_id text,
  last_error_code text,
  last_error_detail text,
  sent_at timestamptz,
  inbox_attested_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint organisation_invitation_deliveries_status_check
    check (
      status in ('pending', 'sending', 'sent', 'failed', 'cancelled')
    ),
  constraint organisation_invitation_deliveries_attempt_count_check
    check (attempt_count >= 0),
  constraint organisation_invitation_deliveries_max_attempts_check
    check (max_attempts between 1 and 20),
  constraint organisation_invitation_deliveries_delivery_key_check
    check (
      delivery_key = btrim(delivery_key)
      and char_length(delivery_key) between 8 and 160
    ),
  constraint organisation_invitation_deliveries_recipient_email_check
    check (recipient_email = lower(btrim(recipient_email)))
);

create unique index organisation_invitation_deliveries_delivery_key_idx
  on private.organisation_invitation_deliveries (delivery_key);

create index organisation_invitation_deliveries_claimable_idx
  on private.organisation_invitation_deliveries (next_attempt_at, created_at)
  where status in ('pending', 'sending') and cancelled_at is null;

create index organisation_invitation_deliveries_invitation_idx
  on private.organisation_invitation_deliveries (organisation_id, invitation_id, created_at desc);

alter table private.organisation_invitation_deliveries owner to lean_hub_private_owner;

create or replace function private.invitation_delivery_key(
  target_invitation_id uuid,
  target_status_changed_at timestamptz
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select format(
    'organisation-invitation-email:%s:%s',
  target_invitation_id::text,
    coalesce(
      to_char(target_status_changed_at at time zone 'UTC', 'YYYYMMDDHH24MISSUS'),
      'unknown'
    )
  )
$$;

create or replace function private.cancel_organisation_invitation_deliveries(
  target_organisation_id uuid,
  target_invitation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update private.organisation_invitation_deliveries delivery
  set status = case
      when delivery.status in ('sent', 'failed') then delivery.status
      else 'cancelled'
    end,
    cancelled_at = coalesce(delivery.cancelled_at, statement_timestamp())
  where delivery.organisation_id = target_organisation_id
    and delivery.invitation_id = target_invitation_id
    and delivery.cancelled_at is null
    and delivery.status in ('pending', 'sending');
end;
$$;

create or replace function public.register_organisation_invitation_delivery(
  target_invitation_id uuid,
  target_inbox_proof_digest bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  invitation_row public.organisation_invitations%rowtype;
  delivery_id uuid;
  delivery_key text;
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      org_id,
      'invitations.manage',
      null,
      null
    ) then
    raise exception 'invitation delivery registration is not authorised'
      using errcode = '42501';
  end if;

  if target_inbox_proof_digest is null
    or octet_length(target_inbox_proof_digest) <> 32 then
    raise exception 'invitation inbox proof digest is invalid'
      using errcode = '22023';
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.organisation_id = org_id
    and invitation.id = target_invitation_id;

  if invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.offer_sealed_at is null
    or invitation_row.expires_at <= statement_timestamp() then
    raise exception 'invitation is not available for delivery'
      using errcode = '22023';
  end if;

  perform private.cancel_organisation_invitation_deliveries(
    org_id,
    target_invitation_id
  );

  delivery_key := private.invitation_delivery_key(
    invitation_row.id,
    invitation_row.status_changed_at
  );

  insert into private.organisation_invitation_deliveries (
    organisation_id,
    invitation_id,
    delivery_key,
    recipient_email,
    inbox_proof_digest,
    provider_idempotency_key,
    status,
    next_attempt_at
  )
  values (
    org_id,
    invitation_row.id,
    delivery_key,
    invitation_row.canonical_recipient,
    target_inbox_proof_digest,
    delivery_key,
    'pending',
    statement_timestamp()
  )
  returning id into delivery_id;

  return delivery_id;
end;
$$;

create or replace function public.attest_organisation_invitation_inbox(
  invitation_token_digest bytea,
  target_inbox_proof_digest bytea
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invitation_row public.organisation_invitations%rowtype;
  updated_count integer;
begin
  if invitation_token_digest is null
    or octet_length(invitation_token_digest) <> 32
    or target_inbox_proof_digest is null
    or octet_length(target_inbox_proof_digest) <> 32 then
    return false;
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest
    and invitation.status = 'pending'
    and invitation.offer_sealed_at is not null
    and invitation.expires_at > statement_timestamp();

  if invitation_row.id is null then
    return false;
  end if;

  update private.organisation_invitation_deliveries delivery
  set inbox_attested_at = coalesce(delivery.inbox_attested_at, statement_timestamp())
  where delivery.organisation_id = invitation_row.organisation_id
    and delivery.invitation_id = invitation_row.id
    and delivery.inbox_proof_digest = target_inbox_proof_digest
    and delivery.cancelled_at is null
    and delivery.inbox_attested_at is null
    and delivery.sent_at is not null;

  get diagnostics updated_count = row_count;

  return updated_count > 0 or exists (
    select 1
    from private.organisation_invitation_deliveries delivery
    where delivery.organisation_id = invitation_row.organisation_id
      and delivery.invitation_id = invitation_row.id
      and delivery.inbox_proof_digest = target_inbox_proof_digest
      and delivery.cancelled_at is null
      and delivery.inbox_attested_at is not null
      and delivery.sent_at is not null
  );
end;
$$;

create or replace function public.assert_invitation_inbox_verified_for_binding(
  target_binding_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  binding_row public.organisation_invitation_signup_bindings%rowtype;
begin
  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id;

  if binding_row.id is null then
    return false;
  end if;

  return exists (
    select 1
    from private.organisation_invitation_deliveries delivery
    where delivery.invitation_id = binding_row.invitation_id
      and delivery.recipient_email = binding_row.canonical_recipient
      and delivery.cancelled_at is null
      and delivery.sent_at is not null
      and delivery.inbox_attested_at is not null
  );
end;
$$;

create or replace function private.claim_organisation_invitation_deliveries_for_worker(
  batch_size integer default 10,
  lease_seconds integer default 300
)
returns setof private.organisation_invitation_deliveries
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed_row private.organisation_invitation_deliveries%rowtype;
begin
  if batch_size < 1 or batch_size > 100 then
    raise exception 'batch_size must be between 1 and 100'
      using errcode = '22023';
  end if;

  for claimed_row in
    select delivery.*
    from private.organisation_invitation_deliveries delivery
    where delivery.status in ('pending', 'sending')
      and delivery.cancelled_at is null
      and delivery.next_attempt_at <= statement_timestamp()
      and delivery.attempt_count < delivery.max_attempts
      and (
        delivery.lease_expires_at is null
        or delivery.lease_expires_at <= statement_timestamp()
      )
    order by delivery.next_attempt_at, delivery.created_at
    limit batch_size
    for update skip locked
  loop
    update private.organisation_invitation_deliveries delivery
    set status = 'sending',
        lease_token = gen_random_uuid(),
        lease_expires_at = statement_timestamp() + make_interval(secs => lease_seconds),
        attempt_count = delivery.attempt_count + 1
    where delivery.id = claimed_row.id
    returning * into claimed_row;

    return next claimed_row;
  end loop;
end;
$$;

create or replace function private.complete_organisation_invitation_delivery_for_worker(
  target_delivery_id uuid,
  target_lease_token uuid,
  target_provider_message_id text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  delivery_row private.organisation_invitation_deliveries%rowtype;
begin
  update private.organisation_invitation_deliveries delivery
  set status = 'sent',
      sent_at = statement_timestamp(),
      provider_message_id = nullif(btrim(target_provider_message_id), ''),
      lease_token = null,
      lease_expires_at = null,
      last_error_code = null,
      last_error_detail = null
  where delivery.id = target_delivery_id
    and delivery.lease_token = target_lease_token
    and delivery.status = 'sending'
    and delivery.cancelled_at is null
  returning * into delivery_row;

  return delivery_row.id is not null;
end;
$$;

create or replace function private.fail_organisation_invitation_delivery_for_worker(
  target_delivery_id uuid,
  target_lease_token uuid,
  target_error_code text,
  target_error_detail text,
  target_retryable boolean default true
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  delivery_row private.organisation_invitation_deliveries%rowtype;
begin
  update private.organisation_invitation_deliveries delivery
  set status = case
      when not target_retryable
        or delivery.attempt_count >= delivery.max_attempts then 'failed'
      else 'pending'
    end,
      next_attempt_at = case
        when not target_retryable
          or delivery.attempt_count >= delivery.max_attempts then delivery.next_attempt_at
        else statement_timestamp()
          + make_interval(secs => least(3600, 60 * power(2, greatest(delivery.attempt_count - 1, 0))::integer))
      end,
      lease_token = null,
      lease_expires_at = null,
      last_error_code = left(nullif(btrim(target_error_code), ''), 80),
      last_error_detail = left(nullif(btrim(target_error_detail), ''), 500)
  where delivery.id = target_delivery_id
    and delivery.lease_token = target_lease_token
    and delivery.status = 'sending'
  returning * into delivery_row;

  return delivery_row.id is not null;
end;
$$;

create or replace function private.begin_organisation_invitation_delivery_send(
  target_delivery_id uuid
)
returns table (
  delivery_id uuid,
  lease_token uuid,
  delivery_key text,
  provider_idempotency_key text,
  recipient_email text,
  organisation_name text,
  intended_display_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  delivery_row private.organisation_invitation_deliveries%rowtype;
  invitation_row public.organisation_invitations%rowtype;
  organisation_name_value text;
  intended_name_value text;
  issued_lease uuid;
begin
  update private.organisation_invitation_deliveries delivery
  set status = 'sending',
      lease_token = gen_random_uuid(),
      lease_expires_at = statement_timestamp() + interval '5 minutes',
      attempt_count = delivery.attempt_count + 1
  where delivery.id = target_delivery_id
    and delivery.status = 'pending'
    and delivery.cancelled_at is null
    and delivery.attempt_count < delivery.max_attempts
  returning * into delivery_row;

  if delivery_row.id is null then
    return;
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = delivery_row.invitation_id;

  if invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.expires_at <= statement_timestamp() then
    update private.organisation_invitation_deliveries
    set status = 'failed',
        lease_token = null,
        lease_expires_at = null,
        last_error_code = 'invitation_unavailable'
    where id = delivery_row.id;
    return;
  end if;

  select organisation.name
  into organisation_name_value
  from public.organisations organisation
  where organisation.id = delivery_row.organisation_id;

  select provisioning.intended_display_name
  into intended_name_value
  from public.organisation_invitation_provisioning provisioning
  where provisioning.organisation_id = delivery_row.organisation_id
    and provisioning.invitation_id = delivery_row.invitation_id;

  issued_lease := delivery_row.lease_token;
  delivery_id := delivery_row.id;
  lease_token := issued_lease;
  delivery_key := delivery_row.delivery_key;
  provider_idempotency_key := delivery_row.provider_idempotency_key;
  recipient_email := delivery_row.recipient_email;
  organisation_name := coalesce(organisation_name_value, 'your organisation');
  intended_display_name := intended_name_value;
  return next;
end;
$$;

create or replace function private.get_organisation_invitation_delivery_context_for_worker(
  target_delivery_id uuid,
  target_lease_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  delivery_row private.organisation_invitation_deliveries%rowtype;
  invitation_row public.organisation_invitations%rowtype;
  organisation_row public.organisations%rowtype;
  intended_name text;
begin
  select *
  into delivery_row
  from private.organisation_invitation_deliveries delivery
  where delivery.id = target_delivery_id
    and delivery.lease_token = target_lease_token
    and delivery.status = 'sending'
    and delivery.cancelled_at is null;

  if delivery_row.id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = delivery_row.invitation_id;

  if invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.expires_at <= statement_timestamp() then
    return jsonb_build_object('state', 'invitation_unavailable');
  end if;

  select organisation.name
  into organisation_row.name
  from public.organisations organisation
  where organisation.id = delivery_row.organisation_id;

  select provisioning.intended_display_name
  into intended_name
  from public.organisation_invitation_provisioning provisioning
  where provisioning.organisation_id = delivery_row.organisation_id
    and provisioning.invitation_id = delivery_row.invitation_id;

  return jsonb_build_object(
    'state', 'ready',
    'delivery_id', delivery_row.id,
    'delivery_key', delivery_row.delivery_key,
    'provider_idempotency_key', delivery_row.provider_idempotency_key,
    'recipient_email', delivery_row.recipient_email,
    'organisation_name', coalesce(organisation_row.name, 'your organisation'),
    'intended_display_name', intended_name,
    'expires_at', invitation_row.expires_at
  );
end;
$$;

create or replace function public.get_organisation_invitation_delivery_status(
  target_invitation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  latest_delivery private.organisation_invitation_deliveries%rowtype;
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      org_id,
      'invitations.manage',
      null,
      null
    ) then
    raise exception 'invitation delivery status is not authorised'
      using errcode = '42501';
  end if;

  select delivery.*
  into latest_delivery
  from private.organisation_invitation_deliveries delivery
  where delivery.organisation_id = org_id
    and delivery.invitation_id = target_invitation_id
  order by delivery.created_at desc
  limit 1;

  if latest_delivery.id is null then
    return jsonb_build_object('state', 'none');
  end if;

  return jsonb_build_object(
    'state', latest_delivery.status,
    'sent_at', latest_delivery.sent_at,
    'inbox_attested_at', latest_delivery.inbox_attested_at,
    'attempt_count', latest_delivery.attempt_count,
    'last_error_code', latest_delivery.last_error_code
  );
end;
$$;

create or replace function public.resend_organisation_invitation_email(
  target_invitation_id uuid,
  target_inbox_proof_digest bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return public.register_organisation_invitation_delivery(
    target_invitation_id,
    target_inbox_proof_digest
  );
end;
$$;

-- Cancel pending deliveries when invitations leave the pending state (revoke, reissue, accept).
create or replace function private.organisation_invitations_cancel_deliveries_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'pending'
    and new.status is distinct from 'pending' then
    perform private.cancel_organisation_invitation_deliveries(
      new.organisation_id,
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists organisation_invitations_cancel_deliveries
  on public.organisation_invitations;

create trigger organisation_invitations_cancel_deliveries
  after update of status on public.organisation_invitations
  for each row
  execute function private.organisation_invitations_cancel_deliveries_trg();

alter function private.invitation_delivery_key(uuid, timestamptz)
  owner to lean_hub_private_owner;
alter function private.cancel_organisation_invitation_deliveries(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.claim_organisation_invitation_deliveries_for_worker(integer, integer)
  owner to lean_hub_private_owner;
alter function private.complete_organisation_invitation_delivery_for_worker(uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.fail_organisation_invitation_delivery_for_worker(uuid, uuid, text, text, boolean)
  owner to lean_hub_private_owner;
alter function private.get_organisation_invitation_delivery_context_for_worker(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.begin_organisation_invitation_delivery_send(uuid)
  owner to lean_hub_private_owner;

alter function public.register_organisation_invitation_delivery(uuid, bytea)
  owner to postgres;
alter function public.attest_organisation_invitation_inbox(bytea, bytea)
  owner to postgres;
alter function public.assert_invitation_inbox_verified_for_binding(uuid)
  owner to postgres;
alter function public.get_organisation_invitation_delivery_status(uuid)
  owner to postgres;
alter function public.resend_organisation_invitation_email(uuid, bytea)
  owner to postgres;

revoke all on table private.organisation_invitation_deliveries
  from public, anon, authenticated, service_role;

revoke all on function private.invitation_delivery_key(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.cancel_organisation_invitation_deliveries(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.claim_organisation_invitation_deliveries_for_worker(integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.complete_organisation_invitation_delivery_for_worker(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.fail_organisation_invitation_delivery_for_worker(uuid, uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.get_organisation_invitation_delivery_context_for_worker(uuid, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.register_organisation_invitation_delivery(uuid, bytea)
  from public, anon;
grant execute on function public.register_organisation_invitation_delivery(uuid, bytea)
  to authenticated, service_role;

revoke all on function public.attest_organisation_invitation_inbox(bytea, bytea)
  from public;
grant execute on function public.attest_organisation_invitation_inbox(bytea, bytea)
  to anon, authenticated, service_role;

revoke all on function public.assert_invitation_inbox_verified_for_binding(uuid)
  from public, anon;
grant execute on function public.assert_invitation_inbox_verified_for_binding(uuid)
  to authenticated, service_role;

revoke all on function public.get_organisation_invitation_delivery_status(uuid)
  from public, anon;
grant execute on function public.get_organisation_invitation_delivery_status(uuid)
  to authenticated, service_role;

revoke all on function public.resend_organisation_invitation_email(uuid, bytea)
  from public, anon;
grant execute on function public.resend_organisation_invitation_email(uuid, bytea)
  to authenticated, service_role;

grant execute on function private.claim_organisation_invitation_deliveries_for_worker(integer, integer)
  to service_role;
grant execute on function private.complete_organisation_invitation_delivery_for_worker(uuid, uuid, text)
  to service_role;
grant execute on function private.fail_organisation_invitation_delivery_for_worker(uuid, uuid, text, text, boolean)
  to service_role;
grant execute on function private.get_organisation_invitation_delivery_context_for_worker(uuid, uuid)
  to service_role;
grant execute on function private.begin_organisation_invitation_delivery_send(uuid)
  to service_role;

create or replace function public.begin_organisation_invitation_delivery_send(
  target_delivery_id uuid
)
returns table (
  delivery_id uuid,
  lease_token uuid,
  delivery_key text,
  provider_idempotency_key text,
  recipient_email text,
  organisation_name text,
  intended_display_name text
)
language sql
volatile
security definer
set search_path = ''
as $$
  select *
  from private.begin_organisation_invitation_delivery_send(target_delivery_id)
$$;

create or replace function public.complete_organisation_invitation_delivery_for_worker(
  target_delivery_id uuid,
  target_lease_token uuid,
  target_provider_message_id text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.complete_organisation_invitation_delivery_for_worker(
    target_delivery_id,
    target_lease_token,
    target_provider_message_id
  )
$$;

create or replace function public.fail_organisation_invitation_delivery_for_worker(
  target_delivery_id uuid,
  target_lease_token uuid,
  target_error_code text,
  target_error_detail text,
  target_retryable boolean default true
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.fail_organisation_invitation_delivery_for_worker(
    target_delivery_id,
    target_lease_token,
    target_error_code,
    target_error_detail,
    target_retryable
  )
$$;

alter function public.begin_organisation_invitation_delivery_send(uuid)
  owner to postgres;
alter function public.complete_organisation_invitation_delivery_for_worker(uuid, uuid, text)
  owner to postgres;
alter function public.fail_organisation_invitation_delivery_for_worker(uuid, uuid, text, text, boolean)
  owner to postgres;

revoke all on function public.begin_organisation_invitation_delivery_send(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_organisation_invitation_delivery_send(uuid)
  to service_role;

revoke all on function public.complete_organisation_invitation_delivery_for_worker(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_organisation_invitation_delivery_for_worker(uuid, uuid, text)
  to service_role;

revoke all on function public.fail_organisation_invitation_delivery_for_worker(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.fail_organisation_invitation_delivery_for_worker(uuid, uuid, text, text, boolean)
  to service_role;
