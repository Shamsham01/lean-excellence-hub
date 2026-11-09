-- Harden organisation invitation inbox proof: no GET attestation, binding-scoped redeem,
-- unique delivery keys, tightened grants, and worker send validation fields.

alter table private.organisation_invitation_deliveries
  add column if not exists redeemed_signup_binding_id uuid
    references public.organisation_invitation_signup_bindings (id) on delete restrict;

alter table private.organisation_invitation_deliveries
  drop column if exists inbox_attested_at;

alter table private.organisation_invitation_deliveries enable row level security;
alter table private.organisation_invitation_deliveries force row level security;

create or replace function public.validate_organisation_invitation_inbox_proof_staging(
  invitation_token_digest bytea,
  target_inbox_proof_digest bytea
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  invitation_row public.organisation_invitations%rowtype;
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

  return exists (
    select 1
    from private.organisation_invitation_deliveries delivery
    where delivery.organisation_id = invitation_row.organisation_id
      and delivery.invitation_id = invitation_row.id
      and delivery.inbox_proof_digest = target_inbox_proof_digest
      and delivery.cancelled_at is null
      and delivery.sent_at is not null
      and delivery.inbox_proof_redeemed_at is null
      and delivery.redeemed_signup_binding_id is null
  );
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

  delivery_key := format(
    'organisation-invitation-email:%s:%s',
    invitation_row.id::text,
    gen_random_uuid()::text
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

create or replace function public.redeem_organisation_invitation_inbox_proof(
  invitation_token_digest bytea,
  target_inbox_proof_digest bytea,
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
  invitation_row public.organisation_invitations%rowtype;
  updated_count integer;
begin
  if invitation_token_digest is null
    or octet_length(invitation_token_digest) <> 32
    or target_inbox_proof_digest is null
    or octet_length(target_inbox_proof_digest) <> 32
    or target_binding_id is null then
    return false;
  end if;

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp() then
    return false;
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id
    and invitation.token_digest = invitation_token_digest
    and invitation.status = 'pending'
    and invitation.offer_sealed_at is not null
    and invitation.expires_at > statement_timestamp()
    and invitation.canonical_recipient = binding_row.canonical_recipient;

  if invitation_row.id is null then
    return false;
  end if;

  update private.organisation_invitation_deliveries delivery
  set inbox_proof_redeemed_at = statement_timestamp(),
      redeemed_signup_binding_id = target_binding_id
  where delivery.organisation_id = invitation_row.organisation_id
    and delivery.invitation_id = invitation_row.id
    and delivery.inbox_proof_digest = target_inbox_proof_digest
    and delivery.recipient_email = binding_row.canonical_recipient
    and delivery.cancelled_at is null
    and delivery.sent_at is not null
    and delivery.inbox_proof_redeemed_at is null
    and delivery.redeemed_signup_binding_id is null;

  get diagnostics updated_count = row_count;

  return updated_count = 1;
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
      and delivery.inbox_proof_redeemed_at is not null
      and delivery.redeemed_signup_binding_id = target_binding_id
  );
end;
$$;

create or replace function public.authorize_invitation_identity_signup(
  target_binding_id uuid,
  target_user_email text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  binding_row public.organisation_invitation_signup_bindings%rowtype;
  invitation_row public.organisation_invitations%rowtype;
  canonical_email text;
begin
  canonical_email := lower(btrim(target_user_email));
  if canonical_email is null or canonical_email = '' then
    return false;
  end if;

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id;

  if binding_row.id is null
    or binding_row.canonical_recipient <> canonical_email
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp() then
    return false;
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id;

  if invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.canonical_recipient <> canonical_email then
    return false;
  end if;

  if not public.assert_invitation_inbox_verified_for_binding(target_binding_id) then
    return false;
  end if;

  if exists (
    select 1
    from auth.users auth_user
    where lower(auth_user.email) = canonical_email
      and auth_user.email_confirmed_at is not null
  ) then
    return false;
  end if;

  return true;
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
begin
  return false;
end;
$$;

drop function if exists public.begin_organisation_invitation_delivery_send(uuid);
drop function if exists private.begin_organisation_invitation_delivery_send(uuid);

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
  intended_display_name text,
  invitation_token_digest bytea,
  inbox_proof_digest bytea
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
  invitation_token_digest := invitation_row.token_digest;
  inbox_proof_digest := delivery_row.inbox_proof_digest;
  return next;
end;
$$;

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
  intended_display_name text,
  invitation_token_digest bytea,
  inbox_proof_digest bytea
)
language sql
volatile
security definer
set search_path = ''
as $$
  select *
  from private.begin_organisation_invitation_delivery_send(target_delivery_id)
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
    'inbox_proof_redeemed_at', latest_delivery.inbox_proof_redeemed_at,
    'attempt_count', latest_delivery.attempt_count,
    'last_error_code', latest_delivery.last_error_code
  );
end;
$$;

alter function public.validate_organisation_invitation_inbox_proof_staging(bytea, bytea)
  owner to postgres;
alter function public.register_organisation_invitation_delivery(uuid, bytea)
  owner to postgres;
alter function public.redeem_organisation_invitation_inbox_proof(bytea, bytea, uuid)
  owner to postgres;
alter function public.assert_invitation_inbox_verified_for_binding(uuid)
  owner to postgres;
alter function public.authorize_invitation_identity_signup(uuid, text)
  owner to postgres;
alter function public.attest_organisation_invitation_inbox(bytea, bytea)
  owner to postgres;
alter function public.get_organisation_invitation_delivery_status(uuid)
  owner to postgres;
alter function private.begin_organisation_invitation_delivery_send(uuid)
  owner to lean_hub_private_owner;
alter function public.begin_organisation_invitation_delivery_send(uuid)
  owner to postgres;

revoke all on function public.validate_organisation_invitation_inbox_proof_staging(bytea, bytea)
  from public;
grant execute on function public.validate_organisation_invitation_inbox_proof_staging(bytea, bytea)
  to anon, authenticated, service_role;

revoke all on function public.redeem_organisation_invitation_inbox_proof(bytea, bytea, uuid)
  from public, anon, authenticated;
grant execute on function public.redeem_organisation_invitation_inbox_proof(bytea, bytea, uuid)
  to service_role;

revoke all on function public.assert_invitation_inbox_verified_for_binding(uuid)
  from public, anon, authenticated;
grant execute on function public.assert_invitation_inbox_verified_for_binding(uuid)
  to service_role;

revoke all on function public.attest_organisation_invitation_inbox(bytea, bytea)
  from public, anon, authenticated, service_role;

revoke all on function private.begin_organisation_invitation_delivery_send(uuid)
  from public, anon, authenticated;
grant execute on function private.begin_organisation_invitation_delivery_send(uuid)
  to service_role;

revoke all on function public.begin_organisation_invitation_delivery_send(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_organisation_invitation_delivery_send(uuid)
  to service_role;

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
revoke all on function private.invitation_delivery_key(uuid, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function private.claim_organisation_invitation_deliveries_for_worker(integer, integer)
  to service_role;
grant execute on function private.complete_organisation_invitation_delivery_for_worker(uuid, uuid, text)
  to service_role;
grant execute on function private.fail_organisation_invitation_delivery_for_worker(uuid, uuid, text, text, boolean)
  to service_role;
grant execute on function private.get_organisation_invitation_delivery_context_for_worker(uuid, uuid)
  to service_role;
