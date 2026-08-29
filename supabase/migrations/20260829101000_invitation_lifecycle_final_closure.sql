-- Invitation lifecycle final closure: exact-invitation signup bindings and cleanup.

create table public.organisation_invitation_signup_bindings (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null
    references public.organisation_invitations(id) on delete cascade,
  canonical_recipient text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default statement_timestamp(),
  constraint organisation_invitation_signup_bindings_recipient_check
    check (
      canonical_recipient = lower(canonical_recipient)
      and canonical_recipient = btrim(canonical_recipient)
    ),
  constraint organisation_invitation_signup_bindings_expiry_check
    check (expires_at > created_at),
  constraint organisation_invitation_signup_bindings_lifecycle_check
    check (
      consumed_at is null
      or consumed_at >= created_at
    )
);

create unique index organisation_invitation_signup_bindings_active_invitation_key
  on public.organisation_invitation_signup_bindings (invitation_id)
  where consumed_at is null and invalidated_at is null;

create index organisation_invitation_signup_bindings_auth_user_id_idx
  on public.organisation_invitation_signup_bindings (auth_user_id)
  where consumed_at is null and invalidated_at is null;

alter table public.organisation_invitation_signup_bindings enable row level security;

create policy private_owner_all_organisation_invitation_signup_bindings
on public.organisation_invitation_signup_bindings
for all
to lean_hub_private_owner
using (true)
with check (true);

revoke all on public.organisation_invitation_signup_bindings from public;
grant select, insert, update on public.organisation_invitation_signup_bindings
  to lean_hub_private_owner;

create or replace function private.invalidate_organisation_invitation_signup_bindings(
  target_invitation_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.organisation_invitation_signup_bindings binding
  set invalidated_at = statement_timestamp(),
      invalidation_reason = target_reason
  where binding.invitation_id = target_invitation_id
    and binding.consumed_at is null
    and binding.invalidated_at is null;
end;
$$;

create or replace function private.clear_auth_user_invitation_signup_binding(
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null then
    return;
  end if;

  update auth.users auth_user
  set raw_user_meta_data =
    coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
    - 'invitation_signup_binding'
      - 'invitation_continue'
  where auth_user.id = target_user_id;
end;
$$;

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

create or replace function public.hook_require_invitation_for_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_email text;
  canonical_email text;
  binding_id_text text;
  binding_id uuid;
  binding_row public.organisation_invitation_signup_bindings%rowtype;
  invitation_row public.organisation_invitations%rowtype;
begin
  signup_email := event -> 'user' ->> 'email';
  binding_id_text := event -> 'user' -> 'user_metadata' ->> 'invitation_signup_binding';

  if signup_email is null or btrim(signup_email) = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'An email address is required to create an account.',
        'http_code', 403
      )
    );
  end if;

  if binding_id_text is null
    or binding_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

  binding_id := binding_id_text::uuid;
  canonical_email := lower(btrim(signup_email));

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = binding_id
  for update;

  if binding_row.id is null
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp()
    or binding_row.canonical_recipient <> canonical_email then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id;

  if invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.offer_sealed_at is null
    or invitation_row.expires_at <= statement_timestamp()
    or invitation_row.canonical_recipient <> canonical_email then
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
  binding_row public.organisation_invitation_signup_bindings%rowtype;
  invitation_row public.organisation_invitations%rowtype;
  preview jsonb;
  actor_email text;
  membership_status text;
begin
  if actor_user_id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  actor_email := lower(coalesce(private.auth_jwt() ->> 'email', ''));

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id;

  if binding_row.id is null
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp()
    or binding_row.canonical_recipient <> actor_email then
    return jsonb_build_object('state', 'invalid');
  end if;

  if binding_row.auth_user_id is not null
    and binding_row.auth_user_id is distinct from actor_user_id then
    return jsonb_build_object('state', 'invalid');
  end if;

  if binding_row.auth_user_id is null then
    update public.organisation_invitation_signup_bindings binding
    set auth_user_id = actor_user_id
    where binding.id = target_binding_id
      and binding.auth_user_id is null;
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id;

  preview := private.preview_organisation_invitation(invitation_row.token_digest);

  if preview ->> 'state' <> 'valid' then
    return preview;
  end if;

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

  actor_email := lower(coalesce(private.auth_jwt() ->> 'email', ''));

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp()
    or binding_row.canonical_recipient <> actor_email then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  if binding_row.auth_user_id is not null
    and binding_row.auth_user_id is distinct from actor_user_id then
    raise exception 'invitation signup binding is unavailable'
      using errcode = '42501';
  end if;

  if binding_row.auth_user_id is null then
    update public.organisation_invitation_signup_bindings binding
    set auth_user_id = actor_user_id
    where binding.id = target_binding_id
      and binding.auth_user_id is null;
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id;

  accepted_membership_id :=
    public.accept_organisation_invitation(invitation_row.token_digest);

  update public.organisation_invitation_signup_bindings binding
  set consumed_at = statement_timestamp()
  where binding.id = target_binding_id;

  perform private.clear_auth_user_invitation_signup_binding(actor_user_id);

  return accepted_membership_id;
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

  perform private.invalidate_organisation_invitation_signup_bindings(
    source_invitation.id,
    'Invitation reissued'
  );

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

create or replace function private.organisation_invitation_signup_binding_invalidation_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('revoked', 'expired', 'accepted')
    and old.status = 'pending' then
    perform private.invalidate_organisation_invitation_signup_bindings(
      new.id,
      case new.status
        when 'revoked' then coalesce(new.status_reason, 'Invitation revoked')
        when 'expired' then 'Invitation expired'
        else 'Invitation accepted'
      end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists organisation_invitation_signup_binding_invalidation_trigger
  on public.organisation_invitations;

create trigger organisation_invitation_signup_binding_invalidation_trigger
after update of status on public.organisation_invitations
for each row
execute function private.organisation_invitation_signup_binding_invalidation_trigger();

alter function private.invalidate_organisation_invitation_signup_bindings(uuid, text)
  owner to lean_hub_private_owner;
alter function private.clear_auth_user_invitation_signup_binding(uuid)
  owner to postgres;
alter function private.organisation_invitation_signup_binding_invalidation_trigger()
  owner to lean_hub_private_owner;
alter function private.reissue_organisation_invitation(uuid, uuid, bytea, timestamptz)
  owner to lean_hub_private_owner;

revoke all on function public.prepare_organisation_invitation_signup_binding(bytea)
  from public;
revoke all on function public.resolve_organisation_invitation_signup_binding(uuid)
  from public;
revoke all on function public.accept_organisation_invitation_signup_binding(uuid)
  from public;
revoke all on function public.hook_require_invitation_for_signup(jsonb) from public;

grant execute on function public.prepare_organisation_invitation_signup_binding(bytea)
  to anon, authenticated;
grant execute on function public.resolve_organisation_invitation_signup_binding(uuid)
  to authenticated;
grant execute on function public.accept_organisation_invitation_signup_binding(uuid)
  to authenticated;
grant execute on function public.hook_require_invitation_for_signup(jsonb)
  to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
