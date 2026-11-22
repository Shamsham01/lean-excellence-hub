-- Authorize signup only via inbox-ready digests (no legacy verified fallback).

drop function if exists public.authorize_invitation_identity_signup(uuid, text, bytea, bytea);

create function public.authorize_invitation_identity_signup(
  target_binding_id uuid,
  target_user_email text,
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
  canonical_email text;
begin
  if invitation_token_digest is null
    or octet_length(invitation_token_digest) <> 32
    or target_inbox_proof_digest is null
    or octet_length(target_inbox_proof_digest) <> 32 then
    return false;
  end if;

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

  if not public.assert_invitation_inbox_ready_for_signup(
    target_binding_id,
    invitation_token_digest,
    target_inbox_proof_digest
  ) then
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

alter function public.authorize_invitation_identity_signup(uuid, text, bytea, bytea)
  owner to postgres;

revoke all on function public.authorize_invitation_identity_signup(uuid, text, bytea, bytea)
  from public, anon;
grant execute on function public.authorize_invitation_identity_signup(uuid, text, bytea, bytea)
  to service_role;
