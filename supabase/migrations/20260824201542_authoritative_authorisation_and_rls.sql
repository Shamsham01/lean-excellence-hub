revoke create on schema public from public, anon, authenticated, service_role;
revoke usage on schema private from service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from service_role;
alter default privileges for role lean_hub_private_owner in schema private
  revoke all on tables from service_role;
alter default privileges for role lean_hub_private_owner in schema private
  revoke execute on functions from service_role;

revoke all on all tables in schema public from service_role;
revoke all on all tables in schema private from service_role;
revoke execute on all functions in schema public from service_role;
revoke execute on all functions in schema private from service_role;

grant usage on schema public to lean_hub_private_owner;
grant usage on schema private to lean_hub_private_owner;
grant select, insert, update, delete on all tables in schema public
  to lean_hub_private_owner;
grant select, insert, update, delete on all tables in schema private
  to lean_hub_private_owner;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'profiles',
    'organisations',
    'organisation_memberships',
    'organisation_units',
    'organisation_unit_closure',
    'permission_definitions',
    'roles',
    'role_versions',
    'role_permissions',
    'organisation_invitations',
    'organisation_invitation_grants',
    'access_grants',
    'security_audit_events'
  ]
  loop
    execute format(
      'create policy private_owner_all on public.%I for all to lean_hub_private_owner using (true) with check (true)',
      relation_name
    );
  end loop;

  foreach relation_name in array array[
    'identity_controls',
    'workforce_accounts',
    'workforce_aliases',
    'session_organisation_contexts',
    'authentication_rate_limits'
  ]
  loop
    execute format(
      'create policy private_owner_all on private.%I for all to lean_hub_private_owner using (true) with check (true)',
      relation_name
    );
  end loop;
end
$$;

create or replace function private.auth_user_exists(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users auth_user where auth_user.id = target_user_id
  )
$$;

create or replace function private.auth_uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid()
$$;

create or replace function private.auth_jwt()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select auth.jwt()
$$;

create or replace function private.auth_session_belongs_to(
  target_session_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions session
    where session.id = target_session_id
      and session.user_id = target_user_id
  )
$$;

create or replace function private.auth_email_is_confirmed(
  target_user_id uuid,
  target_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users auth_user
    where auth_user.id = target_user_id
      and lower(auth_user.email) = lower(target_email)
      and auth_user.email_confirmed_at is not null
  )
$$;

create or replace function private.auth_revoke_user_sessions(
  target_user_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed_sessions integer;
begin
  delete from auth.sessions session
  where session.user_id = target_user_id;

  get diagnostics removed_sessions = row_count;
  return removed_sessions;
end;
$$;

alter function private.auth_user_exists(uuid) owner to postgres;
alter function private.auth_uid() owner to postgres;
alter function private.auth_jwt() owner to postgres;
alter function private.auth_session_belongs_to(uuid, uuid) owner to postgres;
alter function private.auth_email_is_confirmed(uuid, text) owner to postgres;
alter function private.auth_revoke_user_sessions(uuid) owner to postgres;
revoke all on function private.auth_user_exists(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.auth_uid()
  from public, anon, authenticated, service_role;
revoke all on function private.auth_jwt()
  from public, anon, authenticated, service_role;
revoke all on function private.auth_session_belongs_to(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.auth_email_is_confirmed(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.auth_revoke_user_sessions(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.auth_user_exists(uuid)
  to lean_hub_private_owner;
grant execute on function private.auth_uid()
  to lean_hub_private_owner;
grant execute on function private.auth_jwt()
  to lean_hub_private_owner;
grant execute on function private.auth_session_belongs_to(uuid, uuid)
  to lean_hub_private_owner;
grant execute on function private.auth_email_is_confirmed(uuid, text)
  to lean_hub_private_owner;
grant execute on function private.auth_revoke_user_sessions(uuid)
  to lean_hub_private_owner;

create or replace function private.assert_session_context_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.auth_session_belongs_to(new.session_id, new.user_id) then
    raise exception 'session does not belong to user'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.current_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.auth_uid();
  candidate_session_id uuid;
begin
  if current_user_id is null then
    return null;
  end if;

  candidate_session_id :=
    private.safe_uuid(private.auth_jwt() ->> 'session_id');

  if candidate_session_id is null then
    return null;
  end if;

  if not private.auth_session_belongs_to(
    candidate_session_id,
    current_user_id
  ) then
    return null;
  end if;

  return candidate_session_id;
end;
$$;

create or replace function private.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select context.organisation_id
  from private.session_organisation_contexts context
  where context.session_id = private.current_session_id()
    and context.user_id = private.auth_uid()
$$;

create or replace function private.current_identity_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from private.identity_controls identity_control
      where private.current_session_id() is not null
        and identity_control.user_id = private.auth_uid()
        and identity_control.status = 'active'
        and identity_control.enrolment_status = 'complete'
    ),
    false
  )
$$;

create or replace function private.current_membership_id(target_organisation_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.id
  from private.session_organisation_contexts context
  join public.organisation_memberships membership
    on membership.organisation_id = context.organisation_id
   and membership.id = context.membership_id
   and membership.user_id = context.user_id
  join public.organisations organisation
    on organisation.id = membership.organisation_id
  join private.identity_controls identity_control
    on identity_control.user_id = membership.user_id
  where context.session_id = private.current_session_id()
    and context.user_id = private.auth_uid()
    and context.organisation_id = target_organisation_id
    and membership.status = 'active'
    and organisation.status = 'active'
    and identity_control.status = 'active'
    and identity_control.enrolment_status = 'complete'
$$;

create or replace function private.has_scoped_permission(
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
      from public.access_grants grant_row
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
      where grant_row.organisation_id = target_organisation_id
        and grant_row.grantee_membership_id =
          private.current_membership_id(target_organisation_id)
        and grant_row.status = 'active'
        and (
          grant_row.expires_at is null
          or grant_row.expires_at > statement_timestamp()
        )
        and (
          grant_row.scope_type = 'organisation'
          or (
            grant_row.scope_type = 'self'
            and target_membership_id is not null
            and target_membership_id =
              private.current_membership_id(target_organisation_id)
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

create or replace function private.request_correlation_id()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_headers jsonb;
  candidate uuid;
begin
  begin
    request_headers :=
      coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception
    when others then
      request_headers := '{}'::jsonb;
  end;

  candidate := private.safe_uuid(request_headers ->> 'x-request-id');
  return coalesce(candidate, gen_random_uuid());
end;
$$;

create or replace function private.append_security_audit(
  event_organisation_id uuid,
  event_action text,
  event_target_type text,
  event_target_id uuid,
  event_outcome text,
  event_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  actor_membership uuid;
begin
  if event_organisation_id is not null then
    actor_membership :=
      private.current_membership_id(event_organisation_id);
  end if;

  insert into public.security_audit_events (
    organisation_id,
    actor_user_id,
    actor_membership_id,
    actor_session_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    event_organisation_id,
    private.auth_uid(),
    actor_membership,
    private.current_session_id(),
    event_action,
    event_target_type,
    event_target_id,
    event_outcome,
    private.request_correlation_id(),
    coalesce(event_metadata, '{}'::jsonb)
  )
  returning id into event_id;

  return event_id;
end;
$$;

create or replace function private.list_my_eligible_organisations()
returns table (
  organisation_id uuid,
  membership_id uuid,
  organisation_code text,
  organisation_name text,
  selected boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    organisation.id,
    membership.id,
    organisation.code,
    organisation.name,
    context.organisation_id is not null
  from public.organisation_memberships membership
  join public.organisations organisation
    on organisation.id = membership.organisation_id
  join private.identity_controls identity_control
    on identity_control.user_id = membership.user_id
  left join private.session_organisation_contexts context
    on context.session_id = private.current_session_id()
   and context.user_id = membership.user_id
   and context.organisation_id = membership.organisation_id
   and context.membership_id = membership.id
  where private.current_session_id() is not null
    and membership.user_id = private.auth_uid()
    and membership.status = 'active'
    and organisation.status = 'active'
    and identity_control.status = 'active'
    and identity_control.enrolment_status = 'complete'
  order by organisation.name, organisation.id
$$;

create or replace function private.switch_organisation(
  target_organisation_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_session_id uuid := private.current_session_id();
  target_membership_id uuid;
begin
  if actor_user_id is null or actor_session_id is null then
    return false;
  end if;

  select membership.id
  into target_membership_id
  from public.organisation_memberships membership
  join public.organisations organisation
    on organisation.id = membership.organisation_id
  join private.identity_controls identity_control
    on identity_control.user_id = membership.user_id
  where membership.organisation_id = target_organisation_id
    and membership.user_id = actor_user_id
    and membership.status = 'active'
    and organisation.status = 'active'
    and identity_control.status = 'active'
    and identity_control.enrolment_status = 'complete'
  for update of membership;

  if target_membership_id is null then
    return false;
  end if;

  insert into private.session_organisation_contexts (
    session_id,
    user_id,
    organisation_id,
    membership_id
  )
  values (
    actor_session_id,
    actor_user_id,
    target_organisation_id,
    target_membership_id
  )
  on conflict (session_id) do update
    set user_id = excluded.user_id,
        organisation_id = excluded.organisation_id,
        membership_id = excluded.membership_id,
        selected_at = statement_timestamp();

  perform private.append_security_audit(
    target_organisation_id,
    'session.organisation_switched',
    'session',
    actor_session_id,
    'succeeded',
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function public.list_my_eligible_organisations()
returns table (
  organisation_id uuid,
  membership_id uuid,
  organisation_code text,
  organisation_name text,
  selected boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.list_my_eligible_organisations()
$$;

create or replace function public.switch_organisation(
  target_organisation_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.switch_organisation(target_organisation_id)
$$;

do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'private.current_session_id()'::regprocedure,
    'private.current_organisation_id()'::regprocedure,
      'private.current_identity_is_active()'::regprocedure,
    'private.current_membership_id(uuid)'::regprocedure,
    'private.has_scoped_permission(uuid,text,uuid,uuid)'::regprocedure,
    'private.request_correlation_id()'::regprocedure,
    'private.append_security_audit(uuid,text,text,uuid,text,jsonb)'::regprocedure,
    'private.list_my_eligible_organisations()'::regprocedure,
    'private.switch_organisation(uuid)'::regprocedure
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

grant usage on schema private to authenticated;
grant execute on function private.current_session_id() to authenticated;
grant execute on function private.current_organisation_id() to authenticated;
grant execute on function private.current_identity_is_active() to authenticated;
grant execute on function private.current_membership_id(uuid) to authenticated;
grant execute on function private.has_scoped_permission(uuid, text, uuid, uuid)
  to authenticated;
grant execute on function private.list_my_eligible_organisations()
  to authenticated;
grant execute on function private.switch_organisation(uuid) to authenticated;
grant execute on function public.list_my_eligible_organisations()
  to authenticated;
grant execute on function public.switch_organisation(uuid) to authenticated;

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.current_identity_is_active())
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.current_identity_is_active())
)
with check (
  user_id = (select auth.uid())
  and (select private.current_identity_is_active())
);

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create policy organisations_select_current
on public.organisations
for select
to authenticated
using (
  id = (select private.current_organisation_id())
  and private.current_membership_id(id) is not null
);
grant select on public.organisations to authenticated;

create policy memberships_select_current
on public.organisation_memberships
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and (
    id = private.current_membership_id(organisation_id)
    or private.has_scoped_permission(
      organisation_id,
      'memberships.read',
      id,
      null
    )
  )
);
grant select on public.organisation_memberships to authenticated;

create policy units_select_scoped
on public.organisation_units
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.has_scoped_permission(
    organisation_id,
    'hierarchy.read',
    null,
    id
  )
);
grant select on public.organisation_units to authenticated;

create policy closure_select_scoped
on public.organisation_unit_closure
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.has_scoped_permission(
    organisation_id,
    'hierarchy.read',
    null,
    ancestor_unit_id
  )
  and private.has_scoped_permission(
    organisation_id,
    'hierarchy.read',
    null,
    descendant_unit_id
  )
);
grant select on public.organisation_unit_closure to authenticated;

create policy permission_definitions_select_authenticated
on public.permission_definitions
for select
to authenticated
using ((select private.current_identity_is_active()));
grant select on public.permission_definitions to authenticated;

create policy roles_select_scoped
on public.roles
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.has_scoped_permission(
    organisation_id,
    'roles.read',
    null,
    null
  )
);
grant select on public.roles to authenticated;

create policy role_versions_select_scoped
on public.role_versions
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.has_scoped_permission(
    organisation_id,
    'roles.read',
    null,
    null
  )
);
grant select on public.role_versions to authenticated;

create policy role_permissions_select_scoped
on public.role_permissions
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.has_scoped_permission(
    organisation_id,
    'roles.read',
    null,
    null
  )
);
grant select on public.role_permissions to authenticated;

create policy grants_select_scoped
on public.access_grants
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and (
    grantee_membership_id = private.current_membership_id(organisation_id)
    or private.has_scoped_permission(
      organisation_id,
      'roles.read',
      null,
      null
    )
  )
);
grant select on public.access_grants to authenticated;

create policy invitations_select_scoped
on public.organisation_invitations
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.has_scoped_permission(
    organisation_id,
    'invitations.manage',
    null,
    null
  )
);
grant select (
  id,
  organisation_id,
  recipient_type,
  canonical_recipient,
  inviter_membership_id,
  status,
  expires_at,
  offer_sealed_at,
  accepted_membership_id,
  accepted_at,
  revoked_at,
  expired_at,
  status_changed_at,
  status_changed_by_membership_id,
  status_reason,
  created_at
) on public.organisation_invitations to authenticated;

create policy invitation_grants_select_scoped
on public.organisation_invitation_grants
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.has_scoped_permission(
    organisation_id,
    'invitations.manage',
    null,
    null
  )
);
grant select on public.organisation_invitation_grants to authenticated;

create policy security_audit_select_scoped
on public.security_audit_events
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.has_scoped_permission(
    organisation_id,
    'security_audit.read',
    null,
    null
  )
);
grant select on public.security_audit_events to authenticated;
