-- Redeem inbox proof only after Auth user + enrolment succeed; release on rollback.

drop function if exists public.authorize_invitation_identity_signup(uuid, text);

create or replace function public.clear_invitation_signup_binding_auth_user(
  target_binding_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_binding_id is null then
    return false;
  end if;

  update public.organisation_invitation_signup_bindings binding
  set auth_user_id = null
  where binding.id = target_binding_id
    and binding.consumed_at is null;

  return found;
end;
$$;

create or replace function public.release_organisation_invitation_inbox_proof_redemption(
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
  updated_count integer;
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
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null then
    return false;
  end if;

  update private.organisation_invitation_deliveries delivery
  set inbox_proof_redeemed_at = null,
      redeemed_signup_binding_id = null
  from public.organisation_invitations invitation
  where delivery.invitation_id = invitation.id
    and invitation.token_digest = invitation_token_digest
    and delivery.inbox_proof_digest = target_inbox_proof_digest
    and delivery.recipient_email = binding_row.canonical_recipient
    and delivery.redeemed_signup_binding_id = target_binding_id
    and delivery.inbox_proof_redeemed_at is not null;

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    return false;
  end if;

  perform public.clear_invitation_signup_binding_auth_user(target_binding_id);

  return true;
end;
$$;

drop function if exists public.finalise_invitation_identity_signup(uuid, uuid);

create or replace function public.finalise_invitation_identity_signup(
  target_binding_id uuid,
  target_user_id uuid,
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
  user_email text;
begin
  if target_binding_id is null
    or target_user_id is null
    or invitation_token_digest is null
    or target_inbox_proof_digest is null then
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

  if not public.assert_invitation_inbox_ready_for_signup(
    target_binding_id,
    invitation_token_digest,
    target_inbox_proof_digest
  ) then
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

revoke all on function public.clear_invitation_signup_binding_auth_user(uuid)
  from public, anon, authenticated;
grant execute on function public.clear_invitation_signup_binding_auth_user(uuid)
  to service_role;

revoke all on function public.release_organisation_invitation_inbox_proof_redemption(uuid, bytea, bytea)
  from public, anon, authenticated;
grant execute on function public.release_organisation_invitation_inbox_proof_redemption(uuid, bytea, bytea)
  to service_role;

revoke all on function public.finalise_invitation_identity_signup(uuid, uuid, bytea, bytea)
  from public, anon, authenticated;
grant execute on function public.finalise_invitation_identity_signup(uuid, uuid, bytea, bytea)
  to service_role;
