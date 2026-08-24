create or replace function private.membership_has_scoped_permission(
  actor_membership_id uuid,
  target_organisation_id uuid,
  target_permission_key text,
  target_membership_id uuid default null,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join public.access_grants grant_row
        on grant_row.organisation_id = actor_membership.organisation_id
       and grant_row.grantee_membership_id = actor_membership.id
       and grant_row.status = 'active'
       and (
         grant_row.expires_at is null
         or grant_row.expires_at > statement_timestamp()
       )
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
       and role_version.status = 'published'
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
       and role_row.status = 'active'
      join public.role_permissions role_permission
        on role_permission.organisation_id = role_version.organisation_id
       and role_permission.role_version_id = role_version.id
       and role_permission.permission_key = target_permission_key
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = target_organisation_id
        and actor_membership.status = 'active'
        and (
          grant_row.scope_type = 'organisation'
          or (
            grant_row.scope_type = 'self'
            and target_membership_id = actor_membership.id
          )
          or (
            grant_row.scope_type = 'unit_subtree'
            and target_unit_id is not null
            and exists (
              select 1
              from public.organisation_unit_closure closure
              where closure.organisation_id = grant_row.organisation_id
                and closure.ancestor_unit_id = grant_row.scope_unit_id
                and closure.descendant_unit_id = target_unit_id
            )
          )
        )
    ),
    false
  )
$$;

create or replace function private.membership_is_effective_owner(
  target_membership_id uuid,
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.organisation_memberships membership
      join public.organisations organisation
        on organisation.id = membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join public.access_grants grant_row
        on grant_row.organisation_id = membership.organisation_id
       and grant_row.grantee_membership_id = membership.id
       and grant_row.status = 'active'
       and (
         grant_row.expires_at is null
         or grant_row.expires_at > statement_timestamp()
       )
       and grant_row.scope_type = 'organisation'
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
       and role_version.status = 'published'
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
       and role_row.status = 'active'
       and role_row.is_owner_role
      where membership.organisation_id = target_organisation_id
        and membership.id = target_membership_id
        and membership.status = 'active'
    ),
    false
  )
$$;

create or replace function private.current_membership_is_owner(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.membership_is_effective_owner(
    private.current_membership_id(target_organisation_id),
    target_organisation_id
  )
$$;

create or replace function private.provision_organisation(
  owner_user_id uuid,
  organisation_code text,
  organisation_name text,
  organisation_locale text default 'en-GB',
  organisation_time_zone text default 'UTC',
  organisation_reporting_currency text default 'GBP'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_organisation_id uuid;
  owner_membership_id uuid;
  owner_role_id uuid;
  owner_role_version_id uuid;
begin
  if not private.auth_user_exists(owner_user_id) then
    raise exception 'owner Auth user does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from pg_timezone_names zone
    where zone.name = organisation_time_zone
  ) then
    raise exception 'invalid time zone'
      using errcode = '23514';
  end if;

  insert into public.organisations (
    code,
    name,
    locale,
    time_zone,
    reporting_currency,
    status,
    status_reason
  )
  values (
    organisation_code,
    organisation_name,
    organisation_locale,
    organisation_time_zone,
    organisation_reporting_currency,
    'active',
    null
  )
  returning id into new_organisation_id;

  update private.identity_controls
  set status = 'active',
      enrolment_status = 'complete',
      enrolment_completed_at = coalesce(
        enrolment_completed_at,
        statement_timestamp()
      ),
      status_changed_at = statement_timestamp()
  where user_id = owner_user_id
    and status <> 'disabled';

  if not found then
    raise exception 'owner identity is unavailable'
      using errcode = '42501';
  end if;

  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    new_organisation_id,
    owner_user_id,
    'active',
    statement_timestamp()
  )
  returning id into owner_membership_id;

  insert into public.roles (
    organisation_id,
    canonical_name,
    display_name,
    description,
    is_protected,
    is_owner_role
  )
  values (
    new_organisation_id,
    'organisation-owner',
    'Organisation Owner',
    'Protected organisation owner role.',
    true,
    true
  )
  returning id into owner_role_id;

  insert into public.role_versions (
    organisation_id,
    role_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    new_organisation_id,
    owner_role_id,
    1,
    'draft',
    owner_membership_id
  )
  returning id into owner_role_version_id;

  insert into public.role_permissions (
    organisation_id,
    role_version_id,
    permission_key
  )
  select
    new_organisation_id,
    owner_role_version_id,
    permission.permission_key
  from public.permission_definitions permission;

  update public.role_versions
  set status = 'published',
      published_by_membership_id = owner_membership_id,
      published_at = statement_timestamp()
  where id = owner_role_version_id
    and organisation_id = new_organisation_id;

  insert into public.access_grants (
    organisation_id,
    grantee_membership_id,
    role_version_id,
    scope_type,
    grantor_membership_id
  )
  values (
    new_organisation_id,
    owner_membership_id,
    owner_role_version_id,
    'organisation',
    owner_membership_id
  );

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
    new_organisation_id,
    'organisation.provisioned',
    'organisation',
    new_organisation_id,
    'succeeded',
    gen_random_uuid(),
    '{}'::jsonb
  );

  return new_organisation_id;
end;
$$;

-- Forward declarations allow wrappers and exact grants to be declared before
-- the implementation bodies below. Each declaration is replaced in this
-- migration before it can be invoked.
create function private.create_role_draft(
  target_organisation_id uuid,
  role_canonical_name text,
  role_display_name text,
  role_description text default null
)
returns uuid language sql security definer set search_path = ''
as $$ select null::uuid $$;
create function private.add_role_permission(
  target_organisation_id uuid,
  target_role_version_id uuid,
  target_permission_key text
)
returns boolean language sql security definer set search_path = ''
as $$ select false $$;
create function private.publish_role_version(
  target_organisation_id uuid,
  target_role_version_id uuid
)
returns boolean language sql security definer set search_path = ''
as $$ select false $$;
create function private.grant_role_version(
  target_organisation_id uuid,
  target_grantee_membership_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null
)
returns uuid language sql security definer set search_path = ''
as $$ select null::uuid $$;
create function private.create_organisation_unit(
  target_organisation_id uuid,
  target_parent_unit_id uuid,
  unit_code text,
  unit_name text,
  unit_type text
)
returns uuid language sql security definer set search_path = ''
as $$ select null::uuid $$;
create function private.move_organisation_unit(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_parent_unit_id uuid
)
returns boolean language sql security definer set search_path = ''
as $$ select false $$;
create function private.set_organisation_unit_status(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_status text,
  change_reason text
)
returns boolean language sql security definer set search_path = ''
as $$ select false $$;
create function private.issue_organisation_invitation(
  target_organisation_id uuid,
  invitation_recipient_type text,
  invitation_canonical_recipient text,
  invitation_token_digest bytea,
  invitation_expires_at timestamptz,
  offered_role_version_id uuid,
  offered_scope_type text,
  offered_scope_unit_id uuid default null
)
returns uuid language sql security definer set search_path = ''
as $$ select null::uuid $$;
create function private.accept_organisation_invitation(
  invitation_token_digest bytea
)
returns uuid language sql security definer set search_path = ''
as $$ select null::uuid $$;
create function private.set_membership_status(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_status text,
  change_reason text
)
returns boolean language sql security definer set search_path = ''
as $$ select false $$;
create function private.suspend_or_close_organisation(
  target_organisation_id uuid,
  target_status text,
  change_reason text
)
returns boolean language sql security definer set search_path = ''
as $$ select false $$;
create function private.revoke_access_grant(
  target_organisation_id uuid,
  target_grant_id uuid,
  change_reason text
)
returns boolean language sql security definer set search_path = ''
as $$ select false $$;

create or replace function public.create_role_draft(
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
  select private.create_role_draft(
    target_organisation_id,
    role_canonical_name,
    role_display_name,
    role_description
  )
$$;

create or replace function public.add_role_permission(
  target_organisation_id uuid,
  target_role_version_id uuid,
  target_permission_key text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.add_role_permission(
    target_organisation_id,
    target_role_version_id,
    target_permission_key
  )
$$;

create or replace function public.publish_role_version(
  target_organisation_id uuid,
  target_role_version_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.publish_role_version(
    target_organisation_id,
    target_role_version_id
  )
$$;

create or replace function public.grant_role_version(
  target_organisation_id uuid,
  target_grantee_membership_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.grant_role_version(
    target_organisation_id,
    target_grantee_membership_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id
  )
$$;

create or replace function public.create_organisation_unit(
  target_organisation_id uuid,
  target_parent_unit_id uuid,
  unit_code text,
  unit_name text,
  unit_type text
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_organisation_unit(
    target_organisation_id,
    target_parent_unit_id,
    unit_code,
    unit_name,
    unit_type
  )
$$;

create or replace function public.move_organisation_unit(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_parent_unit_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.move_organisation_unit(
    target_organisation_id,
    target_unit_id,
    target_parent_unit_id
  )
$$;

create or replace function public.set_organisation_unit_status(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_status text,
  change_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.set_organisation_unit_status(
    target_organisation_id,
    target_unit_id,
    target_status,
    change_reason
  )
$$;

create or replace function public.issue_organisation_invitation(
  target_organisation_id uuid,
  invitation_recipient_type text,
  invitation_canonical_recipient text,
  invitation_token_digest bytea,
  invitation_expires_at timestamptz,
  offered_role_version_id uuid,
  offered_scope_type text,
  offered_scope_unit_id uuid default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.issue_organisation_invitation(
    target_organisation_id,
    invitation_recipient_type,
    invitation_canonical_recipient,
    invitation_token_digest,
    invitation_expires_at,
    offered_role_version_id,
    offered_scope_type,
    offered_scope_unit_id
  )
$$;

create or replace function public.accept_organisation_invitation(
  invitation_token_digest bytea
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.accept_organisation_invitation(invitation_token_digest)
$$;

create or replace function public.set_membership_status(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_status text,
  change_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.set_membership_status(
    target_organisation_id,
    target_membership_id,
    target_status,
    change_reason
  )
$$;

create or replace function public.suspend_or_close_organisation(
  target_organisation_id uuid,
  target_status text,
  change_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.suspend_or_close_organisation(
    target_organisation_id,
    target_status,
    change_reason
  )
$$;

create or replace function public.revoke_access_grant(
  target_organisation_id uuid,
  target_grant_id uuid,
  change_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.revoke_access_grant(
    target_organisation_id,
    target_grant_id,
    change_reason
  )
$$;

create or replace function public.provision_organisation(
  owner_user_id uuid,
  organisation_code text,
  organisation_name text,
  organisation_locale text default 'en-GB',
  organisation_time_zone text default 'UTC',
  organisation_reporting_currency text default 'GBP'
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.provision_organisation(
    owner_user_id,
    organisation_code,
    organisation_name,
    organisation_locale,
    organisation_time_zone,
    organisation_reporting_currency
  )
$$;

do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'private.membership_has_scoped_permission(uuid,uuid,text,uuid,uuid)'::regprocedure,
    'private.membership_is_effective_owner(uuid,uuid)'::regprocedure,
    'private.current_membership_is_owner(uuid)'::regprocedure,
    'private.provision_organisation(uuid,text,text,text,text,text)'::regprocedure,
    'private.create_role_draft(uuid,text,text,text)'::regprocedure,
    'private.add_role_permission(uuid,uuid,text)'::regprocedure,
    'private.publish_role_version(uuid,uuid)'::regprocedure,
    'private.grant_role_version(uuid,uuid,uuid,text,uuid)'::regprocedure,
    'private.create_organisation_unit(uuid,uuid,text,text,text)'::regprocedure,
    'private.move_organisation_unit(uuid,uuid,uuid)'::regprocedure,
    'private.set_organisation_unit_status(uuid,uuid,text,text)'::regprocedure,
    'private.issue_organisation_invitation(uuid,text,text,bytea,timestamptz,uuid,text,uuid)'::regprocedure,
    'private.accept_organisation_invitation(bytea)'::regprocedure,
    'private.set_membership_status(uuid,uuid,text,text)'::regprocedure,
    'private.suspend_or_close_organisation(uuid,text,text)'::regprocedure,
    'private.revoke_access_grant(uuid,uuid,text)'::regprocedure
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

grant execute on function private.membership_has_scoped_permission(
  uuid,
  uuid,
  text,
  uuid,
  uuid
) to authenticated;
grant execute on function private.current_membership_is_owner(uuid)
  to authenticated;
grant execute on function private.create_role_draft(uuid, text, text, text)
  to authenticated;
grant execute on function private.add_role_permission(uuid, uuid, text)
  to authenticated;
grant execute on function private.publish_role_version(uuid, uuid)
  to authenticated;
grant execute on function private.grant_role_version(uuid, uuid, uuid, text, uuid)
  to authenticated;
grant execute on function private.create_organisation_unit(
  uuid,
  uuid,
  text,
  text,
  text
) to authenticated;
grant execute on function private.move_organisation_unit(uuid, uuid, uuid)
  to authenticated;
grant execute on function private.set_organisation_unit_status(
  uuid,
  uuid,
  text,
  text
) to authenticated;
grant execute on function private.issue_organisation_invitation(
  uuid,
  text,
  text,
  bytea,
  timestamptz,
  uuid,
  text,
  uuid
) to authenticated;
grant execute on function private.accept_organisation_invitation(bytea)
  to authenticated;
grant execute on function private.set_membership_status(uuid, uuid, text, text)
  to authenticated;
grant execute on function private.suspend_or_close_organisation(
  uuid,
  text,
  text
) to authenticated;
grant execute on function private.revoke_access_grant(uuid, uuid, text)
  to authenticated;

grant execute on function public.create_role_draft(uuid, text, text, text)
  to authenticated;
grant execute on function public.add_role_permission(uuid, uuid, text)
  to authenticated;
grant execute on function public.publish_role_version(uuid, uuid)
  to authenticated;
grant execute on function public.grant_role_version(uuid, uuid, uuid, text, uuid)
  to authenticated;
grant execute on function public.create_organisation_unit(
  uuid,
  uuid,
  text,
  text,
  text
) to authenticated;
grant execute on function public.move_organisation_unit(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.set_organisation_unit_status(
  uuid,
  uuid,
  text,
  text
) to authenticated;
grant execute on function public.issue_organisation_invitation(
  uuid,
  text,
  text,
  bytea,
  timestamptz,
  uuid,
  text,
  uuid
) to authenticated;
grant execute on function public.accept_organisation_invitation(bytea)
  to authenticated;
grant execute on function public.set_membership_status(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.suspend_or_close_organisation(
  uuid,
  text,
  text
) to authenticated;
grant execute on function public.revoke_access_grant(uuid, uuid, text)
  to authenticated;

grant usage on schema private to service_role;
grant execute on function private.provision_organisation(
  uuid,
  text,
  text,
  text,
  text,
  text
) to service_role;
grant execute on function public.provision_organisation(
  uuid,
  text,
  text,
  text,
  text,
  text
) to service_role;

create or replace function private.set_membership_status(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_status text,
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
  target_user_id uuid;
  target_is_owner boolean;
begin
  if actor_membership_id is null
    or target_status not in ('active', 'inactive')
    or not private.has_scoped_permission(
      target_organisation_id,
      'memberships.manage',
      null,
      null
    ) then
    raise exception 'membership lifecycle change is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  select membership.user_id
  into target_user_id
  from public.organisation_memberships membership
  where membership.organisation_id = target_organisation_id
    and membership.id = target_membership_id
  for update;

  if target_user_id is null then
    raise exception 'membership does not exist'
      using errcode = '23503';
  end if;

  target_is_owner := private.membership_is_effective_owner(
    target_membership_id,
    target_organisation_id
  );

  if target_status = 'inactive' and target_is_owner and (
    select count(*)
    from public.organisation_memberships owner_membership
    where owner_membership.organisation_id = target_organisation_id
      and private.membership_is_effective_owner(
        owner_membership.id,
        target_organisation_id
      )
  ) <= 1 then
    raise exception 'last active organisation owner cannot be inactivated'
      using errcode = '23514';
  end if;

  perform private.append_security_audit(
    target_organisation_id,
    case when target_status = 'active'
      then 'membership.activated'
      else 'membership.inactivated'
    end,
    'membership',
    target_membership_id,
    'succeeded',
    '{}'::jsonb
  );

  update public.organisation_memberships
  set status = target_status,
      activated_at = case when target_status = 'active'
        then statement_timestamp() else activated_at end,
      inactivated_at = case when target_status = 'inactive'
        then statement_timestamp() else null end,
      status_reason = case when target_status = 'inactive'
        then change_reason else null end,
      status_changed_at = statement_timestamp(),
      status_changed_by_membership_id = actor_membership_id
  where organisation_id = target_organisation_id
    and id = target_membership_id;

  if target_status = 'inactive' then
    delete from private.session_organisation_contexts context
    where context.organisation_id = target_organisation_id
      and context.user_id = target_user_id;
  end if;

  return true;
end;
$$;

create or replace function private.suspend_or_close_organisation(
  target_organisation_id uuid,
  target_status text,
  change_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_status not in ('suspended', 'closed')
    or private.current_membership_id(target_organisation_id) is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'organisation.update',
      null,
      null
    ) then
    raise exception 'organisation lifecycle change is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  perform private.append_security_audit(
    target_organisation_id,
    case when target_status = 'suspended'
      then 'organisation.suspended'
      else 'organisation.closed'
    end,
    'organisation',
    target_organisation_id,
    'succeeded',
    '{}'::jsonb
  );

  update public.organisations
  set status = target_status,
      status_reason = change_reason,
      status_changed_at = statement_timestamp(),
      status_changed_by_user_id = private.auth_uid(),
      version = version + 1
  where id = target_organisation_id
    and status = 'active';

  if not found then
    raise exception 'organisation is not active'
      using errcode = '55000';
  end if;

  delete from private.session_organisation_contexts context
  where context.organisation_id = target_organisation_id;

  return true;
end;
$$;

create or replace function private.revoke_access_grant(
  target_organisation_id uuid,
  target_grant_id uuid,
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
  grant_row public.access_grants%rowtype;
  owner_grant boolean;
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      null,
      null
    ) then
    raise exception 'grant revocation is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  select grant_value.*
  into grant_row
  from public.access_grants grant_value
  where grant_value.organisation_id = target_organisation_id
    and grant_value.id = target_grant_id
    and grant_value.status = 'active'
  for update;

  if grant_row.id is null then
    raise exception 'active grant does not exist'
      using errcode = '23503';
  end if;

  select (
    role_row.is_owner_role
    and role_row.status = 'active'
    and role_version.status = 'published'
    and grant_row.scope_type = 'organisation'
    and (
      grant_row.expires_at is null
      or grant_row.expires_at > statement_timestamp()
    )
    and exists (
      select 1
      from public.organisation_memberships membership
      where membership.organisation_id = grant_row.organisation_id
        and membership.id = grant_row.grantee_membership_id
        and membership.status = 'active'
    )
  )
  into owner_grant
  from public.role_versions role_version
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where role_version.organisation_id = target_organisation_id
    and role_version.id = grant_row.role_version_id;

  if owner_grant and (
    select count(*)
    from public.organisation_memberships membership
    where membership.organisation_id = target_organisation_id
      and private.membership_is_effective_owner(
        membership.id,
        target_organisation_id
      )
  ) <= 1 then
    raise exception 'last active owner grant cannot be revoked'
      using errcode = '23514';
  end if;

  perform private.append_security_audit(
    target_organisation_id,
    'grant.revoked',
    'grant',
    target_grant_id,
    'succeeded',
    '{}'::jsonb
  );

  update public.access_grants
  set status = 'revoked',
      revoked_at = statement_timestamp(),
      revoked_by_membership_id = actor_membership_id,
      revocation_reason = change_reason
  where organisation_id = target_organisation_id
    and id = target_grant_id;

  return true;
end;
$$;

create or replace function private.issue_organisation_invitation(
  target_organisation_id uuid,
  invitation_recipient_type text,
  invitation_canonical_recipient text,
  invitation_token_digest bytea,
  invitation_expires_at timestamptz,
  offered_role_version_id uuid,
  offered_scope_type text,
  offered_scope_unit_id uuid default null
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
  invitation_id uuid;
  containment_membership_id uuid;
  containment_unit_id uuid;
begin
  containment_unit_id := case
    when offered_scope_type = 'unit_subtree' then offered_scope_unit_id
    else null
  end;

  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'invitations.manage',
      null,
      null
    )
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      null,
      containment_unit_id
    ) then
    raise exception 'invitation issue is not authorised'
      using errcode = '42501';
  end if;

  if offered_scope_type = 'self' then
    containment_membership_id := actor_membership_id;
  end if;

  if not exists (
    select 1
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = target_organisation_id
      and role_version.id = offered_role_version_id
      and role_version.status = 'published'
      and role_row.status = 'active'
      and (
        not role_row.is_protected
        or private.current_membership_is_owner(target_organisation_id)
      )
  ) or exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = offered_role_version_id
      and not private.has_scoped_permission(
        target_organisation_id,
        role_permission.permission_key,
        containment_membership_id,
        containment_unit_id
      )
  ) then
    raise exception 'invitation authority is not contained'
      using errcode = '42501';
  end if;

  update public.organisation_invitations invitation
  set status = 'expired',
      expired_at = statement_timestamp(),
      status_changed_at = statement_timestamp(),
      status_changed_by_membership_id = actor_membership_id
  where invitation.organisation_id = target_organisation_id
    and invitation.recipient_type = $2
    and invitation.canonical_recipient = $3
    and invitation.status = 'pending'
    and invitation.expires_at <= statement_timestamp();

  insert into public.organisation_invitations (
    organisation_id,
    recipient_type,
    canonical_recipient,
    token_digest,
    inviter_membership_id,
    expires_at
  )
  values (
    target_organisation_id,
    invitation_recipient_type,
    invitation_canonical_recipient,
    invitation_token_digest,
    actor_membership_id,
    invitation_expires_at
  )
  returning id into invitation_id;

  insert into public.organisation_invitation_grants (
    organisation_id,
    invitation_id,
    role_version_id,
    scope_type,
    scope_unit_id
  )
  values (
    target_organisation_id,
    invitation_id,
    offered_role_version_id,
    offered_scope_type,
    offered_scope_unit_id
  );

  update public.organisation_invitations
  set offer_sealed_at = statement_timestamp()
  where organisation_id = target_organisation_id
    and id = invitation_id;

  perform private.append_security_audit(
    target_organisation_id,
    'invitation.issued',
    'invitation',
    invitation_id,
    'succeeded',
    jsonb_build_object('recipient_type', invitation_recipient_type)
  );

  return invitation_id;
end;
$$;

create or replace function private.accept_organisation_invitation(
  invitation_token_digest bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_session_id uuid := private.current_session_id();
  invitation_row public.organisation_invitations%rowtype;
  resolved_membership_id uuid;
  invitation_grant record;
  containment_membership_id uuid;
  containment_unit_id uuid;
  new_grant_id uuid;
begin
  if actor_user_id is null or actor_session_id is null then
    raise exception 'authenticated live session required'
      using errcode = '42501';
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest
    and invitation.status = 'pending'
    and invitation.offer_sealed_at is not null
  for update;

  if invitation_row.id is null
    or invitation_row.expires_at <= statement_timestamp() then
    raise exception 'invitation is unavailable'
      using errcode = '42501';
  end if;

  if not private.membership_has_scoped_permission(
    invitation_row.inviter_membership_id,
    invitation_row.organisation_id,
    'invitations.manage',
    null,
    null
  ) then
    raise exception 'invitation authority is no longer manageable'
      using errcode = '42501';
  end if;

  if (
    invitation_row.recipient_type = 'email'
    and (
      lower(coalesce(private.auth_jwt() ->> 'email', '')) <>
        invitation_row.canonical_recipient
      or not private.auth_email_is_confirmed(
        actor_user_id,
        invitation_row.canonical_recipient
      )
    )
  ) or (
    invitation_row.recipient_type in ('workforce_id', 'username')
    and not exists (
      select 1
      from private.workforce_aliases workforce_alias
      where workforce_alias.organisation_id = invitation_row.organisation_id
        and workforce_alias.user_id = actor_user_id
        and workforce_alias.alias_type = invitation_row.recipient_type
        and workforce_alias.canonical_alias =
          invitation_row.canonical_recipient
        and workforce_alias.status = 'active'
    )
  ) then
    raise exception 'invitation recipient does not match'
      using errcode = '42501';
  end if;

  select membership.id
  into resolved_membership_id
  from public.organisation_memberships membership
  where membership.organisation_id = invitation_row.organisation_id
    and membership.user_id = actor_user_id
  for update;

  if resolved_membership_id is null then
    insert into public.organisation_memberships (
      organisation_id,
      user_id,
      status,
      activated_at
    )
    values (
      invitation_row.organisation_id,
      actor_user_id,
      'active',
      statement_timestamp()
    )
    returning id into resolved_membership_id;
  else
    update public.organisation_memberships
    set status = 'active',
        activated_at = coalesce(activated_at, statement_timestamp()),
        inactivated_at = null,
        status_reason = null,
        status_changed_at = statement_timestamp()
    where organisation_id = invitation_row.organisation_id
      and id = resolved_membership_id
      and status = 'pending';

    if not exists (
      select 1
      from public.organisation_memberships membership
      where membership.organisation_id = invitation_row.organisation_id
        and membership.id = resolved_membership_id
        and membership.status = 'active'
    ) then
      raise exception 'membership cannot accept invitation'
        using errcode = '42501';
    end if;
  end if;

  for invitation_grant in
    select offered_grant.*, role_row.is_protected as role_is_protected
    from public.organisation_invitation_grants offered_grant
    join public.role_versions role_version
      on role_version.organisation_id = offered_grant.organisation_id
     and role_version.id = offered_grant.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.status = 'active'
    where offered_grant.organisation_id = invitation_row.organisation_id
      and offered_grant.invitation_id = invitation_row.id
  loop
    containment_membership_id := case
      when invitation_grant.scope_type = 'self'
        then resolved_membership_id
      else null
    end;
    containment_unit_id := case
      when invitation_grant.scope_type = 'unit_subtree'
        then invitation_grant.scope_unit_id
      else null
    end;

    if (
      invitation_grant.role_is_protected
      and not private.membership_is_effective_owner(
        invitation_row.inviter_membership_id,
        invitation_row.organisation_id
      )
    ) or not private.membership_has_scoped_permission(
      invitation_row.inviter_membership_id,
      invitation_row.organisation_id,
      'roles.delegate',
      containment_membership_id,
      containment_unit_id
    ) or exists (
      select 1
      from public.role_permissions role_permission
      where role_permission.organisation_id = invitation_row.organisation_id
        and role_permission.role_version_id =
          invitation_grant.role_version_id
        and not private.membership_has_scoped_permission(
          invitation_row.inviter_membership_id,
          invitation_row.organisation_id,
          role_permission.permission_key,
          containment_membership_id,
          containment_unit_id
        )
    ) then
      raise exception 'invitation authority is no longer delegable'
        using errcode = '42501';
    end if;

    insert into public.access_grants (
      organisation_id,
      grantee_membership_id,
      role_version_id,
      scope_type,
      scope_unit_id,
      grantor_membership_id
    )
    values (
      invitation_row.organisation_id,
      resolved_membership_id,
      invitation_grant.role_version_id,
      invitation_grant.scope_type,
      invitation_grant.scope_unit_id,
      invitation_row.inviter_membership_id
    )
    returning id into new_grant_id;
  end loop;

  if new_grant_id is null then
    raise exception 'invitation has no valid authority offer'
      using errcode = '23514';
  end if;

  update public.organisation_invitations
  set status = 'accepted',
      accepted_membership_id = resolved_membership_id,
      accepted_at = statement_timestamp(),
      status_changed_at = statement_timestamp()
  where organisation_id = invitation_row.organisation_id
    and id = invitation_row.id;

  insert into private.session_organisation_contexts (
    session_id,
    user_id,
    organisation_id,
    membership_id
  )
  values (
    actor_session_id,
    actor_user_id,
    invitation_row.organisation_id,
    resolved_membership_id
  )
  on conflict (session_id) do update
    set user_id = excluded.user_id,
        organisation_id = excluded.organisation_id,
        membership_id = excluded.membership_id,
        selected_at = statement_timestamp();

  perform private.append_security_audit(
    invitation_row.organisation_id,
    'invitation.accepted',
    'invitation',
    invitation_row.id,
    'succeeded',
    '{}'::jsonb
  );

  return resolved_membership_id;
end;
$$;

create or replace function private.create_organisation_unit(
  target_organisation_id uuid,
  target_parent_unit_id uuid,
  unit_code text,
  unit_name text,
  unit_type text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_unit_id uuid;
begin
  if private.current_membership_id(target_organisation_id) is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'hierarchy.manage',
      null,
      target_parent_unit_id
    ) then
    raise exception 'unit creation is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  if target_parent_unit_id is not null and not exists (
    select 1
    from public.organisation_units parent_unit
    where parent_unit.organisation_id = target_organisation_id
      and parent_unit.id = target_parent_unit_id
      and parent_unit.status = 'active'
    for update
  ) then
    raise exception 'parent unit is not active in organisation'
      using errcode = '23514';
  end if;

  if not private.has_scoped_permission(
    target_organisation_id,
    'hierarchy.manage',
    null,
    target_parent_unit_id
  ) then
    raise exception 'unit creation authority changed'
      using errcode = '42501';
  end if;

  insert into public.organisation_units (
    organisation_id,
    parent_unit_id,
    code,
    name,
    unit_type
  )
  values (
    target_organisation_id,
    target_parent_unit_id,
    unit_code,
    unit_name,
    unit_type
  )
  returning id into new_unit_id;

  insert into public.organisation_unit_closure (
    organisation_id,
    ancestor_unit_id,
    descendant_unit_id,
    depth
  )
  values (
    target_organisation_id,
    new_unit_id,
    new_unit_id,
    0
  );

  if target_parent_unit_id is not null then
    insert into public.organisation_unit_closure (
      organisation_id,
      ancestor_unit_id,
      descendant_unit_id,
      depth
    )
    select
      target_organisation_id,
      ancestor.ancestor_unit_id,
      new_unit_id,
      ancestor.depth + 1
    from public.organisation_unit_closure ancestor
    where ancestor.organisation_id = target_organisation_id
      and ancestor.descendant_unit_id = target_parent_unit_id;
  end if;

  perform private.append_security_audit(
    target_organisation_id,
    'hierarchy.unit_created',
    'unit',
    new_unit_id,
    'succeeded',
    '{}'::jsonb
  );

  return new_unit_id;
end;
$$;

create or replace function private.move_organisation_unit(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_parent_unit_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  subtree_depth integer;
  parent_depth integer;
begin
  if target_unit_id = target_parent_unit_id
    or private.current_membership_id(target_organisation_id) is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'hierarchy.manage',
      null,
      target_unit_id
    )
    or (
      target_parent_unit_id is null
      and not private.has_scoped_permission(
        target_organisation_id,
        'hierarchy.manage',
        null,
        null
      )
    )
    or (
      target_parent_unit_id is not null
      and not private.has_scoped_permission(
        target_organisation_id,
        'hierarchy.manage',
        null,
        target_parent_unit_id
      )
    ) then
    raise exception 'unit move is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  perform 1
  from public.organisation_units unit_row
  where unit_row.organisation_id = target_organisation_id
    and unit_row.id = target_unit_id
    and unit_row.status = 'active'
  for update;

  if not found then
    raise exception 'unit is not active in organisation'
      using errcode = '23514';
  end if;

  if target_parent_unit_id is not null then
    perform 1
    from public.organisation_units parent_unit
    where parent_unit.organisation_id = target_organisation_id
      and parent_unit.id = target_parent_unit_id
      and parent_unit.status = 'active'
    for update;

    if not found or exists (
      select 1
      from public.organisation_unit_closure closure
      where closure.organisation_id = target_organisation_id
        and closure.ancestor_unit_id = target_unit_id
        and closure.descendant_unit_id = target_parent_unit_id
    ) then
      raise exception 'new parent is invalid or creates a cycle'
        using errcode = '23514';
    end if;
  end if;

  select coalesce(max(depth), 0)
  into subtree_depth
  from public.organisation_unit_closure
  where organisation_id = target_organisation_id
    and ancestor_unit_id = target_unit_id;

  select coalesce(max(depth), -1)
  into parent_depth
  from public.organisation_unit_closure
  where organisation_id = target_organisation_id
    and descendant_unit_id = target_parent_unit_id;

  if target_parent_unit_id is not null
    and parent_depth + 1 + subtree_depth > 32 then
    raise exception 'unit move exceeds maximum hierarchy depth'
      using errcode = '23514';
  end if;

  if not private.has_scoped_permission(
    target_organisation_id,
    'hierarchy.manage',
    null,
    target_unit_id
  ) then
    raise exception 'unit move authority changed'
      using errcode = '42501';
  end if;

  delete from public.organisation_unit_closure existing_path
  where existing_path.organisation_id = target_organisation_id
    and exists (
      select 1
      from public.organisation_unit_closure subtree
      where subtree.organisation_id = target_organisation_id
        and subtree.ancestor_unit_id = target_unit_id
        and subtree.descendant_unit_id = existing_path.descendant_unit_id
    )
    and not exists (
      select 1
      from public.organisation_unit_closure internal_ancestor
      where internal_ancestor.organisation_id = target_organisation_id
        and internal_ancestor.ancestor_unit_id = target_unit_id
        and internal_ancestor.descendant_unit_id = existing_path.ancestor_unit_id
    );

  if target_parent_unit_id is not null then
    insert into public.organisation_unit_closure (
      organisation_id,
      ancestor_unit_id,
      descendant_unit_id,
      depth
    )
    select
      target_organisation_id,
      parent_path.ancestor_unit_id,
      subtree.descendant_unit_id,
      parent_path.depth + 1 + subtree.depth
    from public.organisation_unit_closure parent_path
    cross join public.organisation_unit_closure subtree
    where parent_path.organisation_id = target_organisation_id
      and parent_path.descendant_unit_id = target_parent_unit_id
      and subtree.organisation_id = target_organisation_id
      and subtree.ancestor_unit_id = target_unit_id;
  end if;

  update public.organisation_units
  set parent_unit_id = target_parent_unit_id,
      version = version + 1
  where organisation_id = target_organisation_id
    and id = target_unit_id;

  perform private.append_security_audit(
    target_organisation_id,
    'hierarchy.unit_moved',
    'unit',
    target_unit_id,
    'succeeded',
    jsonb_build_object('parent_unit_id', target_parent_unit_id)
  );

  return true;
end;
$$;

create or replace function private.set_organisation_unit_status(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_status text,
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
    or target_status not in ('active', 'retired')
    or not private.has_scoped_permission(
      target_organisation_id,
      'hierarchy.manage',
      null,
      target_unit_id
    ) then
    raise exception 'unit lifecycle change is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  if target_status = 'retired' and exists (
    select 1
    from public.organisation_unit_closure closure
    join public.organisation_units descendant
      on descendant.organisation_id = closure.organisation_id
     and descendant.id = closure.descendant_unit_id
    where closure.organisation_id = target_organisation_id
      and closure.ancestor_unit_id = target_unit_id
      and closure.depth > 0
      and descendant.status = 'active'
  ) then
    raise exception 'active descendants must be retired first'
      using errcode = '23514';
  end if;

  if target_status = 'active' and exists (
    select 1
    from public.organisation_units unit_row
    join public.organisation_units parent_unit
      on parent_unit.organisation_id = unit_row.organisation_id
     and parent_unit.id = unit_row.parent_unit_id
    where unit_row.organisation_id = target_organisation_id
      and unit_row.id = target_unit_id
      and parent_unit.status <> 'active'
  ) then
    raise exception 'unit cannot be restored beneath a retired parent'
      using errcode = '23514';
  end if;

  update public.organisation_units
  set status = target_status,
      retired_at = case when target_status = 'retired'
        then statement_timestamp() else null end,
      restored_at = case when target_status = 'active'
        then statement_timestamp() else restored_at end,
      status_changed_by_membership_id = actor_membership_id,
      status_reason = case when target_status = 'retired'
        then change_reason else null end,
      version = version + 1
  where organisation_id = target_organisation_id
    and id = target_unit_id;

  if not found then
    raise exception 'unit does not exist'
      using errcode = '23503';
  end if;

  perform private.append_security_audit(
    target_organisation_id,
    case when target_status = 'retired'
      then 'hierarchy.unit_retired'
      else 'hierarchy.unit_restored'
    end,
    'unit',
    target_unit_id,
    'succeeded',
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function private.create_role_draft(
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
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.manage',
      null,
      null
    )
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      null,
      null
    ) then
    raise exception 'role administration is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  if private.current_membership_id(target_organisation_id) is null then
    raise exception 'role administration is no longer authorised'
      using errcode = '42501';
  end if;

  insert into public.roles (
    organisation_id,
    canonical_name,
    display_name,
    description
  )
  values (
    target_organisation_id,
    role_canonical_name,
    role_display_name,
    role_description
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
    'role.draft_created',
    'role_version',
    new_role_version_id,
    'succeeded',
    jsonb_build_object('role_id', new_role_id)
  );

  return new_role_version_id;
end;
$$;

create or replace function private.add_role_permission(
  target_organisation_id uuid,
  target_role_version_id uuid,
  target_permission_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_role_is_protected boolean;
begin
  if private.current_membership_id(target_organisation_id) is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.manage',
      null,
      null
    )
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      null,
      null
    )
    or not private.has_scoped_permission(
      target_organisation_id,
      target_permission_key,
      null,
      null
    ) then
    raise exception 'permission delegation is not contained'
      using errcode = '42501';
  end if;

  select role_row.is_protected
  into target_role_is_protected
  from public.role_versions role_version
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where role_version.organisation_id = target_organisation_id
    and role_version.id = target_role_version_id
    and role_version.status = 'draft'
    and role_row.status = 'active';

  if target_role_is_protected is null then
    raise exception 'role version is not an editable draft'
      using errcode = '55000';
  end if;

  if target_role_is_protected
    and not private.current_membership_is_owner(target_organisation_id) then
    raise exception 'protected role editing requires an owner'
      using errcode = '42501';
  end if;

  insert into public.role_permissions (
    organisation_id,
    role_version_id,
    permission_key
  )
  values (
    target_organisation_id,
    target_role_version_id,
    target_permission_key
  )
  on conflict (
    organisation_id,
    role_version_id,
    permission_key
  ) do nothing;

  return true;
end;
$$;

create or replace function private.publish_role_version(
  target_organisation_id uuid,
  target_role_version_id uuid
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
  target_role_is_protected boolean;
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.manage',
      null,
      null
    )
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      null,
      null
    ) then
    raise exception 'role publication is not authorised'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  select role_row.is_protected
  into target_role_is_protected
  from public.role_versions role_version
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where role_version.organisation_id = target_organisation_id
    and role_version.id = target_role_version_id
    and role_version.status = 'draft'
    and role_row.status = 'active'
  for update of role_version;

  if not found or not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = target_role_version_id
  ) then
    raise exception 'role version is not publishable'
      using errcode = '55000';
  end if;

  if target_role_is_protected
    and not private.current_membership_is_owner(target_organisation_id) then
    raise exception 'protected role publication requires an owner'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.role_permissions role_permission
    join public.permission_definitions permission
      on permission.permission_key = role_permission.permission_key
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = target_role_version_id
      and (
        (permission.is_protected and not target_role_is_protected)
        or not private.has_scoped_permission(
          target_organisation_id,
          role_permission.permission_key,
          null,
          null
        )
      )
  ) then
    raise exception 'role permissions exceed delegable authority'
      using errcode = '42501';
  end if;

  update public.role_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = target_organisation_id
    and id = target_role_version_id;

  perform private.append_security_audit(
    target_organisation_id,
    'role.version_published',
    'role_version',
    target_role_version_id,
    'succeeded',
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function private.grant_role_version(
  target_organisation_id uuid,
  target_grantee_membership_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null
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
  target_anchor_membership_id uuid;
  target_anchor_unit_id uuid;
  new_grant_id uuid;
  protected_role boolean;
begin
  target_anchor_membership_id :=
    case when target_scope_type = 'self'
      then target_grantee_membership_id else null end;
  target_anchor_unit_id :=
    case when target_scope_type = 'unit_subtree'
      then target_scope_unit_id else null end;

  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      target_anchor_membership_id,
      target_anchor_unit_id
    ) then
    raise exception 'role delegation is not authorised'
      using errcode = '42501';
  end if;

  select role_row.is_protected
  into protected_role
  from public.role_versions role_version
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where role_version.organisation_id = target_organisation_id
    and role_version.id = target_role_version_id
    and role_version.status = 'published'
    and role_row.status = 'active';

  if protected_role is null
    or (protected_role and not private.current_membership_is_owner(
      target_organisation_id
    )) then
    raise exception 'role version cannot be delegated'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships membership
    where membership.organisation_id = target_organisation_id
      and membership.id = target_grantee_membership_id
      and membership.status = 'active'
  ) then
    raise exception 'grantee membership is not active'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = target_role_version_id
      and not private.has_scoped_permission(
        target_organisation_id,
        role_permission.permission_key,
        target_anchor_membership_id,
        target_anchor_unit_id
      )
  ) then
    raise exception 'delegated authority exceeds caller authority'
      using errcode = '42501';
  end if;

  update public.access_grants expired_grant
  set status = 'expired'
  where expired_grant.organisation_id = target_organisation_id
    and expired_grant.status = 'active'
    and expired_grant.expires_at <= statement_timestamp();

  insert into public.access_grants (
    organisation_id,
    grantee_membership_id,
    role_version_id,
    scope_type,
    scope_unit_id,
    grantor_membership_id
  )
  values (
    target_organisation_id,
    target_grantee_membership_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    actor_membership_id
  )
  returning id into new_grant_id;

  perform private.append_security_audit(
    target_organisation_id,
    'grant.issued',
    'grant',
    new_grant_id,
    'succeeded',
    '{}'::jsonb
  );

  return new_grant_id;
end;
$$;
