-- Invited display names.
--
-- organisation_memberships.display_name is the name used inside one
-- organisation. profiles.display_name is the person's global name.
-- An invitation stores the administrator's intended membership name.
-- The invitee can confirm or correct that name before acceptance.
-- Acceptance fills a blank membership name and a blank personal profile.
-- An existing personal name and an existing organisation name stay as they are.

alter table public.organisation_invitation_provisioning
  add column invitee_confirmed_display_name text;

alter table public.organisation_invitation_provisioning
  add constraint organisation_invitation_provisioning_confirmed_name_check
  check (
    invitee_confirmed_display_name is null
    or (
      invitee_confirmed_display_name = btrim(invitee_confirmed_display_name)
      and char_length(invitee_confirmed_display_name) between 1 and 120
    )
  );

alter table public.organisation_invitation_signup_bindings
  add column confirmed_display_name text;

alter table public.organisation_invitation_signup_bindings
  add constraint organisation_invitation_signup_bindings_confirmed_name_check
  check (
    confirmed_display_name is null
    or (
      confirmed_display_name = btrim(confirmed_display_name)
      and char_length(confirmed_display_name) between 1 and 120
    )
  );

create or replace function private.normalise_person_display_name(
  raw_display_name text
)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  normalised text := btrim(raw_display_name);
begin
  if normalised is null or char_length(normalised) not between 1 and 120 then
    raise exception 'display name must be between 1 and 120 characters'
      using errcode = '22023';
  end if;

  return normalised;
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
  invited_name text;
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

  select provisioning.intended_display_name
  into invited_name
  from public.organisation_invitation_provisioning provisioning
  where provisioning.organisation_id = invitation_row.organisation_id
    and provisioning.invitation_id = invitation_row.id;

  return jsonb_build_object(
    'state', 'valid',
    'organisation_name', organisation_name,
    'recipient_email', invitation_row.canonical_recipient,
    'recipient_email_masked',
      private.mask_invitation_email(invitation_row.canonical_recipient),
    'role_display_name', coalesce(role_display_name, 'Application access'),
    'scope_label', coalesce(scope_label, 'Scoped access'),
    'intended_display_name', invited_name,
    'expires_at', invitation_row.expires_at
  );
end;
$$;

create or replace function private.apply_invitation_provisioning(
  target_organisation_id uuid,
  target_invitation_id uuid,
  target_membership_id uuid,
  inviter_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  provisioning_row public.organisation_invitation_provisioning%rowtype;
  job_function_row public.job_functions%rowtype;
  chosen_name text;
  membership_user_id uuid;
begin
  select provisioning.*
  into provisioning_row
  from public.organisation_invitation_provisioning provisioning
  where provisioning.organisation_id = target_organisation_id
    and provisioning.invitation_id = target_invitation_id;

  chosen_name := nullif(btrim(provisioning_row.invitee_confirmed_display_name), '');

  if chosen_name is null then
    select nullif(btrim(binding.confirmed_display_name), '')
    into chosen_name
    from public.organisation_invitation_signup_bindings binding
    join public.organisation_invitations invitation
      on invitation.id = binding.invitation_id
     and invitation.organisation_id = target_organisation_id
    where binding.invitation_id = target_invitation_id
      and binding.canonical_recipient = invitation.canonical_recipient
      and binding.consumed_at is null
      and binding.invalidated_at is null
    order by binding.created_at desc
    limit 1;
  end if;

  if chosen_name is null then
    chosen_name := nullif(btrim(provisioning_row.intended_display_name), '');
  end if;

  if chosen_name is not null then
    if not private.membership_has_scoped_permission(
      inviter_membership_id,
      target_organisation_id,
      'memberships.manage',
      null,
      null
    ) then
      raise exception 'invitation provisioning is not authorised'
        using errcode = '42501';
    end if;

    update public.organisation_memberships membership_row
    set display_name = chosen_name,
        updated_at = statement_timestamp()
    where membership_row.organisation_id = target_organisation_id
      and membership_row.id = target_membership_id
      and (
        membership_row.display_name is null
        or btrim(membership_row.display_name) = ''
      );

    select membership_row.user_id
    into membership_user_id
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = target_organisation_id
      and membership_row.id = target_membership_id;

    update public.profiles profile_row
    set display_name = chosen_name,
        updated_at = statement_timestamp()
    where profile_row.user_id = membership_user_id
      and (
        profile_row.display_name is null
        or btrim(profile_row.display_name) = ''
      );
  end if;

  if provisioning_row.invitation_id is null
    or provisioning_row.intended_job_function_id is null then
    return;
  end if;

  if provisioning_row.intended_organisational_unit_id is null then
    raise exception 'invitation provisioning is incomplete'
      using errcode = '22023';
  end if;

  if not (
    private.membership_has_scoped_permission(
      inviter_membership_id,
      target_organisation_id,
      'job_functions.manage',
      null,
      null
    )
    or private.membership_has_scoped_permission(
      inviter_membership_id,
      target_organisation_id,
      'job_functions.manage',
      null,
      provisioning_row.intended_organisational_unit_id
    )
  ) then
    raise exception 'invitation provisioning is not authorised'
      using errcode = '42501';
  end if;

  if not private.membership_has_scoped_permission(
    inviter_membership_id,
    target_organisation_id,
    'hierarchy.read',
    null,
    provisioning_row.intended_organisational_unit_id
  ) then
    raise exception 'invitation provisioning is not authorised'
      using errcode = '42501';
  end if;

  select job_function_registry.*
  into job_function_row
  from public.job_functions job_function_registry
  where job_function_registry.organisation_id = target_organisation_id
    and job_function_registry.id = provisioning_row.intended_job_function_id
    and job_function_registry.status = 'active';

  if not found then
    raise exception 'job function not found or not active'
      using errcode = 'P0002';
  end if;

  insert into public.membership_job_function_assignments (
    organisation_id,
    membership_id,
    job_function_id,
    organisational_unit_id,
    is_primary,
    valid_from,
    job_function_name_snapshot,
    job_function_code_snapshot,
    assigned_by_membership_id,
    assignment_reason
  )
  values (
    target_organisation_id,
    target_membership_id,
    provisioning_row.intended_job_function_id,
    provisioning_row.intended_organisational_unit_id,
    true,
    statement_timestamp(),
    job_function_row.name,
    job_function_row.code,
    inviter_membership_id,
    'Applied from invitation provisioning'
  );
end;
$$;

create or replace function public.record_invitation_signup_display_name(
  target_binding_id uuid,
  target_display_name text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalised_name text;
  binding_row public.organisation_invitation_signup_bindings%rowtype;
begin
  normalised_name := private.normalise_person_display_name(target_display_name);

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp() then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  update public.organisation_invitation_signup_bindings binding
  set confirmed_display_name = normalised_name
  where binding.id = target_binding_id;
end;
$$;

create or replace function public.confirm_invited_display_name(
  invitation_token_digest bytea,
  target_display_name text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_email text := lower(coalesce(private.auth_jwt() ->> 'email', ''));
  invitation_row public.organisation_invitations%rowtype;
  normalised_name text;
begin
  if actor_user_id is null or actor_email = '' then
    raise exception 'authenticated live session required'
      using errcode = '42501';
  end if;

  normalised_name := private.normalise_person_display_name(target_display_name);

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest
    and invitation.status = 'pending'
    and invitation.offer_sealed_at is not null
  for update;

  if invitation_row.id is null
    or invitation_row.expires_at <= statement_timestamp()
    or invitation_row.canonical_recipient <> actor_email
    or not private.auth_email_is_confirmed(
      actor_user_id,
      invitation_row.canonical_recipient
    ) then
    raise exception 'invitation is unavailable'
      using errcode = '42501';
  end if;

  insert into public.organisation_invitation_provisioning (
    organisation_id,
    invitation_id,
    invitee_confirmed_display_name
  )
  values (
    invitation_row.organisation_id,
    invitation_row.id,
    normalised_name
  )
  on conflict (organisation_id, invitation_id) do update
    set invitee_confirmed_display_name = excluded.invitee_confirmed_display_name;
end;
$$;

create or replace function public.confirm_invitation_binding_display_name(
  target_binding_id uuid,
  target_display_name text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_email text := lower(coalesce(private.auth_jwt() ->> 'email', ''));
  binding_row public.organisation_invitation_signup_bindings%rowtype;
  invitation_row public.organisation_invitations%rowtype;
  normalised_name text;
begin
  if actor_user_id is null or actor_email = '' then
    raise exception 'authenticated live session required'
      using errcode = '42501';
  end if;

  normalised_name := private.normalise_person_display_name(target_display_name);

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or binding_row.canonical_recipient <> actor_email
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp()
    or (
      binding_row.auth_user_id is not null
      and binding_row.auth_user_id is distinct from actor_user_id
    )
    or not private.auth_email_is_confirmed(actor_user_id, actor_email) then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id
    and invitation.status = 'pending'
    and invitation.offer_sealed_at is not null
  for update;

  if invitation_row.id is null
    or invitation_row.expires_at <= statement_timestamp()
    or invitation_row.canonical_recipient <> actor_email then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  update public.organisation_invitation_signup_bindings binding
  set confirmed_display_name = normalised_name
  where binding.id = target_binding_id;

  insert into public.organisation_invitation_provisioning (
    organisation_id,
    invitation_id,
    invitee_confirmed_display_name
  )
  values (
    invitation_row.organisation_id,
    invitation_row.id,
    normalised_name
  )
  on conflict (organisation_id, invitation_id) do update
    set invitee_confirmed_display_name = excluded.invitee_confirmed_display_name;
end;
$$;

create or replace function public.replace_expired_invitation_signup_binding(
  target_binding_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_email text;
  binding_row public.organisation_invitation_signup_bindings%rowtype;
  invitation_row public.organisation_invitations%rowtype;
  active_binding_id uuid;
  replacement_binding_id uuid;
  previous_expires_at timestamptz;
begin
  if actor_user_id is null then
    raise exception 'authenticated live session required'
      using errcode = '42501';
  end if;

  select lower(btrim(auth_user.email))
  into actor_email
  from auth.users auth_user
  where auth_user.id = actor_user_id
    and auth_user.email_confirmed_at is not null;

  if actor_email is null or actor_email = '' then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or binding_row.canonical_recipient <> actor_email
    or binding_row.consumed_at is not null
    or (
      binding_row.auth_user_id is not null
      and binding_row.auth_user_id is distinct from actor_user_id
    ) then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  previous_expires_at := binding_row.expires_at;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id
  for update;

  if invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.offer_sealed_at is null
    or invitation_row.expires_at <= statement_timestamp()
    or invitation_row.canonical_recipient <> actor_email then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  select binding.id
  into active_binding_id
  from public.organisation_invitation_signup_bindings binding
  where binding.invitation_id = invitation_row.id
    and binding.canonical_recipient = actor_email
    and binding.consumed_at is null
    and binding.invalidated_at is null
    and binding.expires_at > statement_timestamp()
    and (
      binding.auth_user_id is null
      or binding.auth_user_id = actor_user_id
    )
  order by binding.created_at desc
  limit 1;

  if active_binding_id is not null
    and active_binding_id is distinct from target_binding_id then
    return active_binding_id;
  end if;

  if binding_row.invalidated_at is null
    and binding_row.expires_at > statement_timestamp() then
    raise exception 'signup binding is still active'
      using errcode = '42501';
  end if;

  if binding_row.invalidated_at is null then
    update public.organisation_invitation_signup_bindings binding
    set invalidated_at = statement_timestamp(),
        invalidation_reason = 'Signup binding expired'
    where binding.id = target_binding_id
      and binding.invalidated_at is null
      and binding.expires_at = previous_expires_at;
  end if;

  insert into public.organisation_invitation_signup_bindings (
    invitation_id,
    canonical_recipient,
    auth_user_id,
    expires_at,
    confirmed_display_name
  )
  values (
    invitation_row.id,
    invitation_row.canonical_recipient,
    actor_user_id,
    least(
      invitation_row.expires_at,
      statement_timestamp() + interval '2 hours'
    ),
    binding_row.confirmed_display_name
  )
  returning id into replacement_binding_id;

  return replacement_binding_id;
end;
$$;

create or replace function public.resolve_organisation_invitation_signup_binding(
  target_binding_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_email text;
  binding_row public.organisation_invitation_signup_bindings%rowtype;
  invitation_row public.organisation_invitations%rowtype;
  preview jsonb;
  membership_status text;
  active_binding_id uuid;
begin
  if actor_user_id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select lower(btrim(auth_user.email))
  into actor_email
  from auth.users auth_user
  where auth_user.id = actor_user_id;

  if actor_email is null or actor_email = '' then
    return jsonb_build_object('state', 'invalid');
  end if;

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id;

  if binding_row.id is null
    or binding_row.canonical_recipient <> actor_email
    or (
      binding_row.auth_user_id is not null
      and binding_row.auth_user_id is distinct from actor_user_id
    ) then
    return jsonb_build_object('state', 'invalid');
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id;

  if invitation_row.id is null
    or invitation_row.canonical_recipient <> actor_email then
    return jsonb_build_object('state', 'invalid');
  end if;

  preview := private.preview_organisation_invitation(invitation_row.token_digest);

  if preview ->> 'state' <> 'valid' then
    return preview;
  end if;

  if binding_row.consumed_at is not null then
    return preview || jsonb_build_object('state', 'accepted');
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

  if binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp() then
    select binding.id
    into active_binding_id
    from public.organisation_invitation_signup_bindings binding
    where binding.invitation_id = invitation_row.id
      and binding.canonical_recipient = actor_email
      and binding.consumed_at is null
      and binding.invalidated_at is null
      and binding.expires_at > statement_timestamp()
      and (
        binding.auth_user_id is null
        or binding.auth_user_id = actor_user_id
      )
    order by binding.created_at desc
    limit 1;

    if active_binding_id is not null
      and active_binding_id is distinct from binding_row.id then
      return jsonb_build_object(
        'state', 'valid',
        'session_state', 'redirect_binding',
        'binding_id', active_binding_id
      );
    end if;

    return preview || jsonb_build_object(
      'state', 'binding_expired',
      'session_state', 'binding_expired'
    );
  end if;

  if binding_row.auth_user_id is null then
    update public.organisation_invitation_signup_bindings binding
    set auth_user_id = actor_user_id
    where binding.id = target_binding_id
      and binding.auth_user_id is null;
  end if;

  return preview || jsonb_build_object(
    'session_state', 'ready_to_accept',
    'binding_id', binding_row.id,
    'confirmed_display_name', binding_row.confirmed_display_name
  );
end;
$$;

alter function private.normalise_person_display_name(text)
  owner to lean_hub_private_owner;
alter function private.preview_organisation_invitation(bytea)
  owner to lean_hub_private_owner;
alter function private.apply_invitation_provisioning(uuid, uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function public.record_invitation_signup_display_name(uuid, text)
  owner to postgres;
alter function public.confirm_invited_display_name(bytea, text)
  owner to postgres;
alter function public.confirm_invitation_binding_display_name(uuid, text)
  owner to postgres;
alter function public.replace_expired_invitation_signup_binding(uuid)
  owner to postgres;
alter function public.resolve_organisation_invitation_signup_binding(uuid)
  owner to postgres;

revoke all on function private.normalise_person_display_name(text)
  from public, anon, authenticated;
revoke all on function public.record_invitation_signup_display_name(uuid, text)
  from public, anon, authenticated;
revoke all on function public.confirm_invited_display_name(bytea, text)
  from public, anon, authenticated;
revoke all on function public.confirm_invitation_binding_display_name(uuid, text)
  from public, anon, authenticated;
revoke all on function public.replace_expired_invitation_signup_binding(uuid)
  from public, anon, authenticated;
revoke all on function public.resolve_organisation_invitation_signup_binding(uuid)
  from public, anon, authenticated;

grant execute on function public.record_invitation_signup_display_name(uuid, text)
  to service_role;
grant execute on function public.confirm_invited_display_name(bytea, text)
  to authenticated;
grant execute on function public.confirm_invitation_binding_display_name(uuid, text)
  to authenticated;
grant execute on function public.replace_expired_invitation_signup_binding(uuid)
  to authenticated;
grant execute on function public.resolve_organisation_invitation_signup_binding(uuid)
  to authenticated;
