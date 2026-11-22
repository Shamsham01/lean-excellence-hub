-- Invitation signup finalisation, inbox-ready authorization, resend supersession, worker RLS.

create policy organisation_invitation_deliveries_private_owner_all
  on private.organisation_invitation_deliveries
  for all
  to lean_hub_private_owner
  using (true)
  with check (true);

create or replace function private.cancel_superseded_organisation_invitation_deliveries(
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
  set cancelled_at = coalesce(delivery.cancelled_at, statement_timestamp())
  where delivery.organisation_id = target_organisation_id
    and delivery.invitation_id = target_invitation_id
    and delivery.cancelled_at is null;
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
  perform private.cancel_superseded_organisation_invitation_deliveries(
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
      and delivery.id = (
        select latest.id
        from private.organisation_invitation_deliveries latest
        where latest.invitation_id = invitation_row.id
          and latest.cancelled_at is null
        order by latest.created_at desc
        limit 1
      )
  );
end;
$$;

create or replace function public.assert_invitation_inbox_ready_for_signup(
  target_binding_id uuid,
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
  binding_row public.organisation_invitation_signup_bindings%rowtype;
  invitation_row public.organisation_invitations%rowtype;
begin
  if target_binding_id is null
    or invitation_token_digest is null
    or octet_length(invitation_token_digest) <> 32
    or target_inbox_proof_digest is null
    or octet_length(target_inbox_proof_digest) <> 32 then
    return false;
  end if;

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id;

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

  return exists (
    select 1
    from private.organisation_invitation_deliveries delivery
    where delivery.organisation_id = invitation_row.organisation_id
      and delivery.invitation_id = invitation_row.id
      and delivery.inbox_proof_digest = target_inbox_proof_digest
      and delivery.recipient_email = binding_row.canonical_recipient
      and delivery.cancelled_at is null
      and delivery.sent_at is not null
      and delivery.inbox_proof_redeemed_at is null
      and delivery.redeemed_signup_binding_id is null
      and delivery.id = (
        select latest.id
        from private.organisation_invitation_deliveries latest
        where latest.invitation_id = invitation_row.id
          and latest.cancelled_at is null
        order by latest.created_at desc
        limit 1
      )
  );
end;
$$;

create or replace function public.authorize_invitation_identity_signup(
  target_binding_id uuid,
  target_user_email text,
  invitation_token_digest bytea default null,
  target_inbox_proof_digest bytea default null
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
  inbox_ok boolean;
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

  if invitation_token_digest is not null and target_inbox_proof_digest is not null then
    inbox_ok := public.assert_invitation_inbox_ready_for_signup(
      target_binding_id,
      invitation_token_digest,
      target_inbox_proof_digest
    );
  else
    inbox_ok := public.assert_invitation_inbox_verified_for_binding(target_binding_id);
  end if;

  if not inbox_ok then
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

create or replace function public.finalise_invitation_identity_signup(
  target_binding_id uuid,
  target_user_id uuid
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
  user_email text;
begin
  if target_binding_id is null or target_user_id is null then
    return false;
  end if;

  if not private.auth_user_exists(target_user_id) then
    return false;
  end if;

  select lower(auth_user.email)
  into user_email
  from auth.users auth_user
  where auth_user.id = target_user_id;

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or binding_row.canonical_recipient <> user_email
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp() then
    return false;
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id
  for update;

  if invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.canonical_recipient <> user_email then
    return false;
  end if;

  if not public.assert_invitation_inbox_verified_for_binding(target_binding_id) then
    return false;
  end if;

  update public.organisation_invitation_signup_bindings binding
  set auth_user_id = target_user_id
  where binding.id = target_binding_id
    and binding.auth_user_id is null;

  if not found then
    return false;
  end if;

  return private.finalise_identity_enrolment(target_user_id);
end;
$$;

revoke all on function public.assert_invitation_inbox_ready_for_signup(uuid, bytea, bytea)
  from public, anon;
grant execute on function public.assert_invitation_inbox_ready_for_signup(uuid, bytea, bytea)
  to service_role;

revoke all on function public.finalise_invitation_identity_signup(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalise_invitation_identity_signup(uuid, uuid)
  to service_role;

alter function public.authorize_invitation_identity_signup(uuid, text, bytea, bytea)
  owner to postgres;

revoke all on function public.authorize_invitation_identity_signup(uuid, text, bytea, bytea)
  from public, anon;
grant execute on function public.authorize_invitation_identity_signup(uuid, text, bytea, bytea)
  to service_role;

alter function private.cancel_superseded_organisation_invitation_deliveries(uuid, uuid)
  owner to lean_hub_private_owner;
