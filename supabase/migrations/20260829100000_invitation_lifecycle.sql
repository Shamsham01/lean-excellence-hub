-- Invitation lifecycle: preview, authenticated resolution, reissue, and signup gate.

create or replace function private.invitation_default_ttl()
returns interval
language sql
immutable
as $$
  select interval '7 days';
$$;

create or replace function private.mask_invitation_email(target_email text)
returns text
language sql
immutable
as $$
  select case
    when target_email is null or position('@' in target_email) = 0 then '***'
    else
      left(split_part(target_email, '@', 1), 1)
      || '***@'
      || split_part(target_email, '@', 2)
  end;
$$;

create or replace function private.invitation_scope_label(
  target_scope_type text,
  target_scope_unit_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  unit_name text;
begin
  if target_scope_type = 'organisation' then
    return 'Entire organisation';
  end if;

  if target_scope_type = 'self' then
    return 'Personal access';
  end if;

  if target_scope_type = 'unit_subtree' and target_scope_unit_id is not null then
    select unit_row.name
    into unit_name
    from public.organisation_units unit_row
    where unit_row.id = target_scope_unit_id;

    return coalesce(unit_name, 'Scoped access');
  end if;

  return 'Scoped access';
end;
$$;

create or replace function private.preview_organisation_invitation(
  invitation_token_digest bytea
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  invitation_row public.organisation_invitations%rowtype;
  organisation_name text;
  grant_row record;
  role_display_name text;
  scope_label text;
begin
  if invitation_token_digest is null
    or octet_length(invitation_token_digest) <> 32 then
    return jsonb_build_object('state', 'invalid');
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest;

  if invitation_row.id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select organisation.name
  into organisation_name
  from public.organisations organisation
  where organisation.id = invitation_row.organisation_id;

  if invitation_row.status = 'revoked' then
    return jsonb_build_object('state', 'revoked');
  end if;

  if invitation_row.status = 'accepted' then
    return jsonb_build_object(
      'state', 'accepted',
      'organisation_name', organisation_name
    );
  end if;

  if invitation_row.status = 'expired'
    or (
      invitation_row.status = 'pending'
      and invitation_row.expires_at <= statement_timestamp()
    ) then
    return jsonb_build_object('state', 'expired');
  end if;

  if invitation_row.status <> 'pending'
    or invitation_row.offer_sealed_at is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select
    role_row.display_name,
    private.invitation_scope_label(
      offered_grant.scope_type,
      offered_grant.scope_unit_id
    )
  into role_display_name, scope_label
  from public.organisation_invitation_grants offered_grant
  join public.role_versions role_version
    on role_version.organisation_id = offered_grant.organisation_id
   and role_version.id = offered_grant.role_version_id
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where offered_grant.organisation_id = invitation_row.organisation_id
    and offered_grant.invitation_id = invitation_row.id
  order by offered_grant.created_at
  limit 1;

  return jsonb_build_object(
    'state', 'valid',
    'organisation_name', organisation_name,
    'recipient_email', invitation_row.canonical_recipient,
    'recipient_email_masked',
      private.mask_invitation_email(invitation_row.canonical_recipient),
    'role_display_name', coalesce(role_display_name, 'Application access'),
    'scope_label', coalesce(scope_label, 'Scoped access'),
    'expires_at', invitation_row.expires_at
  );
end;
$$;

create or replace function public.preview_organisation_invitation(
  invitation_token_digest bytea
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.preview_organisation_invitation(invitation_token_digest);
$$;

create or replace function public.resolve_organisation_invitation_session(
  invitation_token_digest bytea
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  preview jsonb;
  invitation_row public.organisation_invitations%rowtype;
  actor_email text;
  membership_status text;
begin
  preview := private.preview_organisation_invitation(invitation_token_digest);

  if preview ->> 'state' <> 'valid' then
    return preview;
  end if;

  if actor_user_id is null then
    return preview || jsonb_build_object('session_state', 'unauthenticated');
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest;

  actor_email := lower(coalesce(private.auth_jwt() ->> 'email', ''));

  if actor_email <> invitation_row.canonical_recipient then
    return preview || jsonb_build_object('session_state', 'wrong_account');
  end if;

  if not private.auth_email_is_confirmed(
    actor_user_id,
    invitation_row.canonical_recipient
  ) then
    return preview || jsonb_build_object('session_state', 'email_unconfirmed');
  end if;

  select membership.status
  into membership_status
  from public.organisation_memberships membership
  where membership.organisation_id = invitation_row.organisation_id
    and membership.user_id = actor_user_id;

  if membership_status = 'active' then
    return preview || jsonb_build_object(
      'session_state', 'already_member',
      'organisation_id', invitation_row.organisation_id
    );
  end if;

  return preview || jsonb_build_object('session_state', 'ready_to_accept');
end;
$$;

create or replace function private.reissue_organisation_invitation(
  target_organisation_id uuid,
  target_invitation_id uuid,
  replacement_token_digest bytea,
  replacement_expires_at timestamptz
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_membership_id uuid :=
    private.current_membership_id(target_organisation_id);
  source_invitation public.organisation_invitations%rowtype;
  source_grant public.organisation_invitation_grants%rowtype;
  source_provisioning public.organisation_invitation_provisioning%rowtype;
  replacement_invitation_id uuid;
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'invitations.manage',
      null,
      null
    ) then
    raise exception 'invitation reissue is not authorised'
      using errcode = '42501';
  end if;

  select *
  into source_invitation
  from public.organisation_invitations invitation
  where invitation.organisation_id = target_organisation_id
    and invitation.id = target_invitation_id
  for update;

  if source_invitation.id is null then
    raise exception 'invitation not found'
      using errcode = 'P0002';
  end if;

  if source_invitation.status <> 'pending' then
    raise exception 'invitation cannot be reissued'
      using errcode = '42501';
  end if;

  update public.organisation_invitations invitation
  set status = 'revoked',
      revoked_at = statement_timestamp(),
      status_changed_at = statement_timestamp(),
      status_changed_by_membership_id = actor_membership_id,
      status_reason = 'Reissued by administrator'
  where invitation.organisation_id = target_organisation_id
    and invitation.id = target_invitation_id;

  insert into public.organisation_invitations (
    organisation_id,
    recipient_type,
    canonical_recipient,
    token_digest,
    inviter_membership_id,
    expires_at
  )
  values (
    source_invitation.organisation_id,
    source_invitation.recipient_type,
    source_invitation.canonical_recipient,
    replacement_token_digest,
    actor_membership_id,
    replacement_expires_at
  )
  returning id into replacement_invitation_id;

  for source_grant in
    select offered_grant.*
    from public.organisation_invitation_grants offered_grant
    where offered_grant.organisation_id = target_organisation_id
      and offered_grant.invitation_id = target_invitation_id
  loop
    insert into public.organisation_invitation_grants (
      organisation_id,
      invitation_id,
      role_version_id,
      scope_type,
      scope_unit_id
    )
    values (
      source_grant.organisation_id,
      replacement_invitation_id,
      source_grant.role_version_id,
      source_grant.scope_type,
      source_grant.scope_unit_id
    );
  end loop;

  select provisioning.*
  into source_provisioning
  from public.organisation_invitation_provisioning provisioning
  where provisioning.organisation_id = target_organisation_id
    and provisioning.invitation_id = target_invitation_id;

  if source_provisioning.invitation_id is not null then
    insert into public.organisation_invitation_provisioning (
      organisation_id,
      invitation_id,
      intended_display_name,
      intended_job_function_id,
      intended_organisational_unit_id
    )
    values (
      source_provisioning.organisation_id,
      replacement_invitation_id,
      source_provisioning.intended_display_name,
      source_provisioning.intended_job_function_id,
      source_provisioning.intended_organisational_unit_id
    );
  end if;

  update public.organisation_invitations invitation
  set offer_sealed_at = statement_timestamp()
  where invitation.organisation_id = target_organisation_id
    and invitation.id = replacement_invitation_id;

  perform private.append_security_audit(
    target_organisation_id,
    'invitation.reissued',
    'invitation',
    replacement_invitation_id,
    'succeeded',
    jsonb_build_object('replaced_invitation_id', target_invitation_id)
  );

  return replacement_invitation_id;
end;
$$;

create or replace function public.reissue_organisation_member_invitation(
  target_invitation_id uuid,
  replacement_token_digest bytea,
  replacement_expires_at timestamptz
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  return private.reissue_organisation_invitation(
    org_id,
    target_invitation_id,
    replacement_token_digest,
    replacement_expires_at
  );
end;
$$;

create or replace function public.hook_require_invitation_for_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_email text;
  canonical_email text;
  pending_invitation_count integer;
begin
  signup_email := event -> 'user' ->> 'email';

  if signup_email is null or btrim(signup_email) = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'An email address is required to create an account.',
        'http_code', 403
      )
    );
  end if;

  canonical_email := lower(btrim(signup_email));

  select count(*)
  into pending_invitation_count
  from public.organisation_invitations invitation
  where invitation.recipient_type = 'email'
    and invitation.canonical_recipient = canonical_email
    and invitation.status = 'pending'
    and invitation.offer_sealed_at is not null
    and invitation.expires_at > statement_timestamp();

  if pending_invitation_count = 0 then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

alter function private.invitation_default_ttl() owner to lean_hub_private_owner;
alter function private.mask_invitation_email(text) owner to lean_hub_private_owner;
alter function private.invitation_scope_label(text, uuid)
  owner to lean_hub_private_owner;
alter function private.preview_organisation_invitation(bytea)
  owner to lean_hub_private_owner;
alter function private.reissue_organisation_invitation(uuid, uuid, bytea, timestamptz)
  owner to lean_hub_private_owner;

revoke all on function public.preview_organisation_invitation(bytea) from public;
revoke all on function public.resolve_organisation_invitation_session(bytea) from public;
revoke all on function public.reissue_organisation_member_invitation(uuid, bytea, timestamptz)
  from public;
revoke all on function public.hook_require_invitation_for_signup(jsonb) from public;

grant execute on function public.preview_organisation_invitation(bytea) to anon, authenticated;
grant execute on function public.resolve_organisation_invitation_session(bytea) to authenticated;
grant execute on function public.reissue_organisation_member_invitation(uuid, bytea, timestamptz)
  to authenticated;

grant execute on function public.hook_require_invitation_for_signup(jsonb)
  to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
