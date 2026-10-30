-- Invitation confirmation continuation.
--
-- Signup bindings stay a two-hour proof of an exact invitation. Email
-- confirmation must not accept the invitation, extend a binding, or treat
-- user metadata as authority. Metadata is only a pointer that this migration
-- validates against the binding and invitation rows.

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
    'binding_id', binding_row.id
  );
end;
$$;

create or replace function public.accept_organisation_invitation_signup_binding(
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
  accepted_membership_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authenticated live session required'
      using errcode = '42501';
  end if;

  select lower(btrim(auth_user.email))
  into actor_email
  from auth.users auth_user
  where auth_user.id = actor_user_id;

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or actor_email is null
    or binding_row.canonical_recipient <> actor_email
    or (
      binding_row.auth_user_id is not null
      and binding_row.auth_user_id is distinct from actor_user_id
    ) then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id;

  if invitation_row.status = 'accepted'
    and invitation_row.accepted_membership_id is not null
    and exists (
      select 1
      from public.organisation_memberships membership
      where membership.id = invitation_row.accepted_membership_id
        and membership.organisation_id = invitation_row.organisation_id
        and membership.user_id = actor_user_id
        and membership.status = 'active'
    ) then
    update public.organisation_invitation_signup_bindings binding
    set consumed_at = statement_timestamp()
    where binding.id = target_binding_id
      and binding.consumed_at is null;

    perform private.clear_auth_user_invitation_signup_binding(actor_user_id);
    return invitation_row.accepted_membership_id;
  end if;

  if binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp()
    or invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.offer_sealed_at is null
    or invitation_row.expires_at <= statement_timestamp()
    or invitation_row.canonical_recipient <> actor_email then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  if binding_row.auth_user_id is null then
    update public.organisation_invitation_signup_bindings binding
    set auth_user_id = actor_user_id
    where binding.id = target_binding_id
      and binding.auth_user_id is null;
  end if;

  accepted_membership_id :=
    public.accept_organisation_invitation(invitation_row.token_digest);

  update public.organisation_invitation_signup_bindings binding
  set consumed_at = statement_timestamp()
  where binding.id = target_binding_id;

  perform private.clear_auth_user_invitation_signup_binding(actor_user_id);

  return accepted_membership_id;
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
    expires_at
  )
  values (
    invitation_row.id,
    invitation_row.canonical_recipient,
    actor_user_id,
    least(
      invitation_row.expires_at,
      statement_timestamp() + interval '2 hours'
    )
  )
  returning id into replacement_binding_id;

  return replacement_binding_id;
end;
$$;

create or replace function public.resolve_my_invitation_continuation()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_email text;
  pointer_text text;
  pointer_id uuid;
  pointer_binding public.organisation_invitation_signup_bindings%rowtype;
  chosen_invitation public.organisation_invitations%rowtype;
  active_binding_id uuid;
  rebind_binding_id uuid;
  candidate_count integer;
begin
  if actor_user_id is null then
    return jsonb_build_object('outcome', 'none');
  end if;

  select lower(btrim(auth_user.email)),
         auth_user.raw_user_meta_data ->> 'invitation_signup_binding'
  into actor_email, pointer_text
  from auth.users auth_user
  where auth_user.id = actor_user_id
    and auth_user.email_confirmed_at is not null;

  if actor_email is null or actor_email = '' then
    return jsonb_build_object('outcome', 'none');
  end if;

  if pointer_text ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    pointer_id := pointer_text::uuid;

    select *
    into pointer_binding
    from public.organisation_invitation_signup_bindings binding
    where binding.id = pointer_id
      and binding.canonical_recipient = actor_email
      and (
        binding.auth_user_id is null
        or binding.auth_user_id = actor_user_id
      );

    if pointer_binding.id is not null then
      select *
      into chosen_invitation
      from public.organisation_invitations invitation
      where invitation.id = pointer_binding.invitation_id
        and invitation.canonical_recipient = actor_email;
    end if;
  end if;

  if chosen_invitation.id is not null then
    if chosen_invitation.status = 'revoked' then
      return jsonb_build_object(
        'outcome', 'unavailable',
        'detail', 'invitation_revoked'
      );
    end if;

    if chosen_invitation.status = 'expired'
      or chosen_invitation.expires_at <= statement_timestamp() then
      return jsonb_build_object(
        'outcome', 'unavailable',
        'detail', 'invitation_expired'
      );
    end if;

    if chosen_invitation.status <> 'pending'
      or chosen_invitation.offer_sealed_at is null then
      return jsonb_build_object('outcome', 'none');
    end if;
  else
    select count(distinct invitation.id)
    into candidate_count
    from public.organisation_invitation_signup_bindings binding
    join public.organisation_invitations invitation
      on invitation.id = binding.invitation_id
    where binding.canonical_recipient = actor_email
      and binding.consumed_at is null
      and (
        binding.auth_user_id is null
        or binding.auth_user_id = actor_user_id
      )
      and invitation.canonical_recipient = actor_email
      and invitation.status = 'pending'
      and invitation.offer_sealed_at is not null
      and invitation.expires_at > statement_timestamp();

    if candidate_count is distinct from 1 then
      return jsonb_build_object('outcome', 'none');
    end if;

    select invitation.*
    into chosen_invitation
    from public.organisation_invitations invitation
    where invitation.canonical_recipient = actor_email
      and invitation.status = 'pending'
      and invitation.offer_sealed_at is not null
      and invitation.expires_at > statement_timestamp()
      and exists (
        select 1
        from public.organisation_invitation_signup_bindings binding
        where binding.invitation_id = invitation.id
          and binding.canonical_recipient = actor_email
          and binding.consumed_at is null
          and (
            binding.auth_user_id is null
            or binding.auth_user_id = actor_user_id
          )
      )
    limit 1;
  end if;

  if chosen_invitation.id is null then
    return jsonb_build_object('outcome', 'none');
  end if;

  select binding.id
  into active_binding_id
  from public.organisation_invitation_signup_bindings binding
  where binding.invitation_id = chosen_invitation.id
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

  if active_binding_id is not null then
    return jsonb_build_object(
      'outcome', 'continue',
      'binding_id', active_binding_id,
      'detail', 'ready'
    );
  end if;

  select binding.id
  into rebind_binding_id
  from public.organisation_invitation_signup_bindings binding
  where binding.invitation_id = chosen_invitation.id
    and binding.canonical_recipient = actor_email
    and binding.consumed_at is null
    and (
      binding.auth_user_id is null
      or binding.auth_user_id = actor_user_id
    )
  order by binding.created_at desc
  limit 1;

  if rebind_binding_id is not null then
    return jsonb_build_object(
      'outcome', 'rebind',
      'binding_id', rebind_binding_id,
      'detail', 'binding_expired'
    );
  end if;

  return jsonb_build_object('outcome', 'none');
end;
$$;

revoke all on function public.resolve_organisation_invitation_signup_binding(uuid)
  from public, anon, authenticated;
revoke all on function public.accept_organisation_invitation_signup_binding(uuid)
  from public, anon, authenticated;
revoke all on function public.replace_expired_invitation_signup_binding(uuid)
  from public, anon, authenticated;
revoke all on function public.resolve_my_invitation_continuation()
  from public, anon, authenticated;

grant execute on function public.resolve_organisation_invitation_signup_binding(uuid)
  to authenticated;
grant execute on function public.accept_organisation_invitation_signup_binding(uuid)
  to authenticated;
grant execute on function public.replace_expired_invitation_signup_binding(uuid)
  to authenticated;
grant execute on function public.resolve_my_invitation_continuation()
  to authenticated;
