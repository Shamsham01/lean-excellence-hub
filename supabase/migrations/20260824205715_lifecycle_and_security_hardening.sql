create or replace function private.create_protected_role_draft(
  target_organisation_id uuid,
  role_canonical_name text,
  role_display_name text,
  role_description text default null
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
  new_role_id uuid;
  new_role_version_id uuid;
begin
  if actor_membership_id is null
    or not private.current_membership_is_owner(target_organisation_id)
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.manage',
      null,
      null
    ) then
    raise exception 'protected role creation requires an owner'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  insert into public.roles (
    organisation_id,
    canonical_name,
    display_name,
    description,
    is_protected
  )
  values (
    target_organisation_id,
    role_canonical_name,
    role_display_name,
    role_description,
    true
  )
  returning id into new_role_id;

  insert into public.role_versions (
    organisation_id,
    role_id,
    version_number,
    created_by_membership_id
  )
  values (
    target_organisation_id,
    new_role_id,
    1,
    actor_membership_id
  )
  returning id into new_role_version_id;

  perform private.append_security_audit(
    target_organisation_id,
    'role.protected_draft_created',
    'role_version',
    new_role_version_id,
    'succeeded',
    '{}'::jsonb
  );

  return new_role_version_id;
end;
$$;

create or replace function private.revoke_organisation_invitation(
  target_organisation_id uuid,
  target_invitation_id uuid,
  change_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_membership_id uuid :=
    private.current_membership_id(target_organisation_id);
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'invitations.manage',
      null,
      null
    )
    or change_reason is null
    or change_reason <> btrim(change_reason)
    or char_length(change_reason) not between 1 and 1000 then
    raise exception 'invitation revocation is not authorised'
      using errcode = '42501';
  end if;

  update public.organisation_invitations invitation
  set status = case
        when invitation.expires_at <= statement_timestamp()
          then 'expired'
        else 'revoked'
      end,
      expired_at = case
        when invitation.expires_at <= statement_timestamp()
          then statement_timestamp()
        else null
      end,
      revoked_at = case
        when invitation.expires_at > statement_timestamp()
          then statement_timestamp()
        else null
      end,
      status_changed_at = statement_timestamp(),
      status_changed_by_membership_id = actor_membership_id,
      status_reason = case
        when invitation.expires_at > statement_timestamp()
          then change_reason
        else null
      end
  where invitation.organisation_id = target_organisation_id
    and invitation.id = target_invitation_id
    and invitation.status = 'pending';

  if not found then
    raise exception 'pending invitation does not exist'
      using errcode = '23503';
  end if;

  perform private.append_security_audit(
    target_organisation_id,
    'invitation.revoked',
    'invitation',
    target_invitation_id,
    'succeeded',
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function private.expire_organisation_security_state(
  target_organisation_id uuid
)
returns table (
  expired_invitations integer,
  expired_grants integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_membership_id uuid :=
    private.current_membership_id(target_organisation_id);
begin
  if actor_membership_id is null
    or not (
      private.has_scoped_permission(
        target_organisation_id,
        'invitations.manage',
        null,
        null
      )
      and private.has_scoped_permission(
        target_organisation_id,
        'roles.manage',
        null,
        null
      )
    ) then
    raise exception 'security-state expiration is not authorised'
      using errcode = '42501';
  end if;

  update public.organisation_invitations invitation
  set status = 'expired',
      expired_at = statement_timestamp(),
      status_changed_at = statement_timestamp(),
      status_changed_by_membership_id = actor_membership_id
  where invitation.organisation_id = target_organisation_id
    and invitation.status = 'pending'
    and invitation.expires_at <= statement_timestamp();
  get diagnostics expired_invitations = row_count;

  update public.access_grants grant_row
  set status = 'expired'
  where grant_row.organisation_id = target_organisation_id
    and grant_row.status = 'active'
    and grant_row.expires_at <= statement_timestamp();
  get diagnostics expired_grants = row_count;

  return next;
end;
$$;

create or replace function private.restore_organisation(
  target_organisation_id uuid,
  change_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if change_reason is null
    or change_reason <> btrim(change_reason)
    or char_length(change_reason) not between 1 and 1000 then
    raise exception 'a bounded restoration reason is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  update public.organisations
  set status = 'active',
      status_reason = null,
      status_changed_at = statement_timestamp(),
      status_changed_by_user_id = null,
      version = version + 1
  where id = target_organisation_id
    and status = 'suspended';

  if not found then
    raise exception 'only a suspended organisation may be restored'
      using errcode = '55000';
  end if;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    target_organisation_id,
    'organisation.restored',
    'organisation',
    target_organisation_id,
    'succeeded',
    gen_random_uuid(),
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function private.record_authentication_security_event(
  event_action text,
  event_outcome text,
  event_organisation_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  if event_action not in (
    'authentication.email_password',
    'authentication.password_changed',
    'authentication.password_recovery_requested',
    'authentication.workforce'
  )
    or event_outcome not in ('succeeded', 'denied', 'failed')
    or (
      event_organisation_id is not null
      and not exists (
        select 1
        from public.organisations organisation
        where organisation.id = event_organisation_id
      )
    ) then
    raise exception 'invalid authentication security event'
      using errcode = '22023';
  end if;

  insert into public.security_audit_events (
    organisation_id,
    action,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    event_organisation_id,
    event_action,
    event_outcome,
    gen_random_uuid(),
    '{}'::jsonb
  )
  returning id into event_id;

  return event_id;
end;
$$;

create or replace function public.revoke_organisation_invitation(
  target_organisation_id uuid,
  target_invitation_id uuid,
  change_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.revoke_organisation_invitation(
    target_organisation_id,
    target_invitation_id,
    change_reason
  )
$$;

create or replace function public.create_protected_role_draft(
  target_organisation_id uuid,
  role_canonical_name text,
  role_display_name text,
  role_description text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_protected_role_draft(
    target_organisation_id,
    role_canonical_name,
    role_display_name,
    role_description
  )
$$;

create or replace function public.expire_organisation_security_state(
  target_organisation_id uuid
)
returns table (
  expired_invitations integer,
  expired_grants integer
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.expire_organisation_security_state(target_organisation_id)
$$;

create or replace function public.restore_organisation(
  target_organisation_id uuid,
  change_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.restore_organisation(
    target_organisation_id,
    change_reason
  )
$$;

create or replace function public.record_authentication_security_event(
  event_action text,
  event_outcome text,
  event_organisation_id uuid default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_authentication_security_event(
    event_action,
    event_outcome,
    event_organisation_id
  )
$$;

do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'private.create_protected_role_draft(uuid,text,text,text)'::regprocedure,
    'private.revoke_organisation_invitation(uuid,uuid,text)'::regprocedure,
    'private.expire_organisation_security_state(uuid)'::regprocedure,
    'private.restore_organisation(uuid,text)'::regprocedure,
    'private.record_authentication_security_event(text,text,uuid)'::regprocedure
  ]
  loop
    execute format('alter function %s owner to lean_hub_private_owner', function_signature);
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      function_signature
    );
  end loop;
end
$$;

grant execute on function private.revoke_organisation_invitation(
  uuid,
  uuid,
  text
) to authenticated;
grant execute on function private.create_protected_role_draft(
  uuid,
  text,
  text,
  text
) to authenticated;
grant execute on function private.expire_organisation_security_state(uuid)
  to authenticated;
grant execute on function public.revoke_organisation_invitation(
  uuid,
  uuid,
  text
) to authenticated;
grant execute on function public.create_protected_role_draft(
  uuid,
  text,
  text,
  text
) to authenticated;
grant execute on function public.expire_organisation_security_state(uuid)
  to authenticated;

grant usage on schema private to service_role;
grant execute on function private.restore_organisation(uuid, text)
  to service_role;
grant execute on function private.record_authentication_security_event(
  text,
  text,
  uuid
) to service_role;
grant execute on function public.restore_organisation(uuid, text)
  to service_role;
grant execute on function public.record_authentication_security_event(
  text,
  text,
  uuid
) to service_role;
