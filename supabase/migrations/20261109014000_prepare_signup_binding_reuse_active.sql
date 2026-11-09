-- Reuse the active signup binding for an invitation so parallel activation
-- attempts share one binding instead of invalidating each other mid-flight.

create or replace function public.prepare_organisation_invitation_signup_binding(
  invitation_token_digest bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  preview jsonb;
  invitation_row public.organisation_invitations%rowtype;
  binding_id uuid;
  binding_expires_at timestamptz;
begin
  preview := private.preview_organisation_invitation(invitation_token_digest);

  if preview ->> 'state' <> 'valid' then
    raise exception 'invitation is unavailable'
      using errcode = '42501';
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest;

  perform pg_advisory_xact_lock(hashtext(invitation_row.id::text));

  select binding.id
  into binding_id
  from public.organisation_invitation_signup_bindings binding
  where binding.invitation_id = invitation_row.id
    and binding.consumed_at is null
    and binding.invalidated_at is null
    and binding.expires_at > statement_timestamp()
  order by binding.created_at desc
  limit 1;

  if binding_id is not null then
    return binding_id;
  end if;

  perform private.invalidate_organisation_invitation_signup_bindings(
    invitation_row.id,
    'Superseded by a new signup binding'
  );

  binding_expires_at := least(
    invitation_row.expires_at,
    statement_timestamp() + interval '2 hours'
  );

  insert into public.organisation_invitation_signup_bindings (
    invitation_id,
    canonical_recipient,
    expires_at
  )
  values (
    invitation_row.id,
    invitation_row.canonical_recipient,
    binding_expires_at
  )
  returning id into binding_id;

  return binding_id;
end;
$$;
