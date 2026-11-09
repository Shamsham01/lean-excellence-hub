-- Inbox proof is redeemed only on intentional signup POST (not mail-scanner GET).

alter table private.organisation_invitation_deliveries
  add column if not exists inbox_proof_redeemed_at timestamptz;

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

  if exists (
    select 1
    from private.organisation_invitation_deliveries delivery
    where delivery.invitation_id = invitation_row.id
      and delivery.inbox_proof_digest = target_inbox_proof_digest
      and delivery.inbox_proof_redeemed_at is not null
      and delivery.cancelled_at is null
  ) then
    return false;
  end if;

  update private.organisation_invitation_deliveries delivery
  set inbox_attested_at = coalesce(delivery.inbox_attested_at, statement_timestamp()),
      inbox_proof_redeemed_at = statement_timestamp()
  where delivery.organisation_id = invitation_row.organisation_id
    and delivery.invitation_id = invitation_row.id
    and delivery.inbox_proof_digest = target_inbox_proof_digest
    and delivery.cancelled_at is null
    and delivery.sent_at is not null
    and delivery.inbox_proof_redeemed_at is null;

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

alter function public.redeem_organisation_invitation_inbox_proof(bytea, bytea, uuid)
  owner to postgres;
alter function public.authorize_invitation_identity_signup(uuid, text)
  owner to postgres;

revoke all on function public.redeem_organisation_invitation_inbox_proof(bytea, bytea, uuid)
  from public;
grant execute on function public.redeem_organisation_invitation_inbox_proof(bytea, bytea, uuid)
  to anon, authenticated, service_role;

revoke all on function public.authorize_invitation_identity_signup(uuid, text)
  from public, anon, authenticated;
grant execute on function public.authorize_invitation_identity_signup(uuid, text)
  to service_role;
