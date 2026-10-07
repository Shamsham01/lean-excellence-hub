-- MULTISITE-EXPAND-01D: secure organisation ownership transfer.
-- Ownership remains an organisation-scoped grant of the published
-- organisation-owner role (roles.is_owner_role). This migration adds a
-- narrow atomic RPC; it does not invent a parallel ownership model.
-- Hosted Supabase applied this migration as ledger version 20261007143820; filename reconciled to preserve source/hosted migration parity.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.published_organisation_owner_role_version_id(
  target_organisation_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select role_version.id
  from public.roles role_row
  join public.role_versions role_version
    on role_version.organisation_id = role_row.organisation_id
   and role_version.role_id = role_row.id
   and role_version.status = 'published'
  where role_row.organisation_id = target_organisation_id
    and role_row.status = 'active'
    and role_row.is_owner_role
  order by role_version.version_number desc, role_version.id desc
  limit 1
$$;

create or replace function private.membership_is_ownership_transfer_eligible(
  target_organisation_id uuid,
  target_membership_id uuid
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
      join private.identity_controls identity_control
        on identity_control.user_id = membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      where membership.organisation_id = target_organisation_id
        and membership.id = target_membership_id
        and membership.status = 'active'
    ),
    false
  )
$$;

create or replace function private.membership_ownership_display_name(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(membership.display_name), ''),
    nullif(btrim(profile_row.display_name), ''),
    'Organisation member'
  )
  from public.organisation_memberships membership
  left join public.profiles profile_row
    on profile_row.user_id = membership.user_id
  where membership.organisation_id = target_organisation_id
    and membership.id = target_membership_id
$$;

create or replace function private.membership_ownership_email(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when auth_user.email is null then null
      when auth_user.email like '%@workforce.invalid' then null
      else auth_user.email
    end,
    contact_row.contact_address
  )
  from public.organisation_memberships membership
  left join auth.users auth_user
    on auth_user.id = membership.user_id
  left join public.membership_notification_contacts contact_row
    on contact_row.organisation_id = membership.organisation_id
   and contact_row.membership_id = membership.id
   and contact_row.channel_type = 'email'
   and contact_row.status = 'active'
  where membership.organisation_id = target_organisation_id
    and membership.id = target_membership_id
$$;

-- ---------------------------------------------------------------------------
-- Current ownership snapshot
-- ---------------------------------------------------------------------------

create or replace function private.get_organisation_ownership()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_organisation_id uuid := private.current_organisation_id();
  actor_membership_id uuid;
  can_view_owners boolean := false;
  can_transfer boolean := false;
  owners jsonb := '[]'::jsonb;
begin
  if actor_organisation_id is null then
    raise exception 'organisation ownership is not authorised'
      using errcode = '42501';
  end if;

  actor_membership_id := private.current_membership_id(actor_organisation_id);
  if actor_membership_id is null then
    raise exception 'organisation ownership is not authorised'
      using errcode = '42501';
  end if;

  can_transfer := private.membership_is_effective_owner(
    actor_membership_id,
    actor_organisation_id
  );
  can_view_owners := private.has_scoped_permission(
    actor_organisation_id,
    'memberships.read',
    null,
    null
  );

  if can_view_owners then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'membership_id', owner_row.membership_id,
          'display_name', owner_row.display_name,
          'email', owner_row.email
        )
        order by owner_row.display_name, owner_row.membership_id
      ),
      '[]'::jsonb
    )
    into owners
    from (
      select
        membership.id as membership_id,
        private.membership_ownership_display_name(
          actor_organisation_id,
          membership.id
        ) as display_name,
        private.membership_ownership_email(
          actor_organisation_id,
          membership.id
        ) as email
      from public.organisation_memberships membership
      where membership.organisation_id = actor_organisation_id
        and private.membership_is_effective_owner(
          membership.id,
          actor_organisation_id
        )
    ) owner_row;
  end if;

  return jsonb_build_object(
    'organisation_id', actor_organisation_id,
    'organisation_name', (
      select organisation.name
      from public.organisations organisation
      where organisation.id = actor_organisation_id
    ),
    'can_transfer', can_transfer,
    'can_view_owners', can_view_owners,
    'owners', owners
  );
end;
$$;

create or replace function public.get_organisation_ownership()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_organisation_ownership()
$$;

-- ---------------------------------------------------------------------------
-- Eligible transfer targets (same organisation, active members only)
-- ---------------------------------------------------------------------------

create or replace function private.list_organisation_ownership_transfer_targets()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_organisation_id uuid := private.current_organisation_id();
  actor_membership_id uuid;
  targets jsonb := '[]'::jsonb;
begin
  if actor_organisation_id is null then
    raise exception 'organisation ownership transfer is not authorised'
      using errcode = '42501';
  end if;

  actor_membership_id := private.current_membership_id(actor_organisation_id);
  if actor_membership_id is null
    or not private.membership_is_effective_owner(
      actor_membership_id,
      actor_organisation_id
    ) then
    raise exception 'organisation ownership transfer is not authorised'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'membership_id', target_row.membership_id,
        'display_name', target_row.display_name,
        'email', target_row.email,
        'is_already_owner', target_row.is_already_owner,
        'grants', target_row.grants
      )
      order by target_row.display_name, target_row.membership_id
    ),
    '[]'::jsonb
  )
  into targets
  from (
    select
      membership.id as membership_id,
      private.membership_ownership_display_name(
        actor_organisation_id,
        membership.id
      ) as display_name,
      private.membership_ownership_email(
        actor_organisation_id,
        membership.id
      ) as email,
      private.membership_is_effective_owner(
        membership.id,
        actor_organisation_id
      ) as is_already_owner,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'role_display_name', role_row.display_name,
              'role_canonical_name', role_row.canonical_name,
              'scope_type', grant_row.scope_type,
              'scope_label',
                case
                  when grant_row.scope_type = 'organisation'
                    then 'Entire organisation'
                  when grant_row.scope_type = 'self'
                    then 'Self'
                  else coalesce(scope_unit.name, 'Specific site')
                end
            )
            order by role_row.display_name, grant_row.scope_type
          )
          from public.access_grants grant_row
          join public.role_versions role_version
            on role_version.organisation_id = grant_row.organisation_id
           and role_version.id = grant_row.role_version_id
           and role_version.status = 'published'
          join public.roles role_row
            on role_row.organisation_id = role_version.organisation_id
           and role_row.id = role_version.role_id
           and role_row.status = 'active'
          left join public.organisation_units scope_unit
            on scope_unit.organisation_id = grant_row.organisation_id
           and scope_unit.id = grant_row.scope_unit_id
          where grant_row.organisation_id = actor_organisation_id
            and grant_row.grantee_membership_id = membership.id
            and grant_row.status = 'active'
            and (
              grant_row.expires_at is null
              or grant_row.expires_at > statement_timestamp()
            )
        ),
        '[]'::jsonb
      ) as grants
    from public.organisation_memberships membership
    where membership.organisation_id = actor_organisation_id
      and membership.id <> actor_membership_id
      and private.membership_is_ownership_transfer_eligible(
        actor_organisation_id,
        membership.id
      )
  ) target_row;

  return jsonb_build_object('targets', targets);
end;
$$;

create or replace function public.list_organisation_ownership_transfer_targets()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_organisation_ownership_transfer_targets()
$$;

-- ---------------------------------------------------------------------------
-- Atomic ownership transfer
-- ---------------------------------------------------------------------------

create or replace function private.transfer_organisation_ownership(
  target_membership_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_organisation_id uuid := private.current_organisation_id();
  source_membership_id uuid;
  owner_role_version_id uuid;
  target_owner_grant_id uuid;
  source_owner_grant_ids uuid[] := '{}'::uuid[];
  source_grant_id uuid;
  remaining_owners integer;
begin
  if actor_organisation_id is null then
    raise exception 'organisation ownership transfer is not authorised'
      using errcode = '42501';
  end if;

  source_membership_id := private.current_membership_id(actor_organisation_id);
  if source_membership_id is null then
    raise exception 'organisation ownership transfer is not authorised'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_organisation_id::text, 0)
  );

  perform 1
  from public.organisations organisation
  where organisation.id = actor_organisation_id
    and organisation.status = 'active'
  for update;

  if not found then
    raise exception 'organisation ownership transfer is not authorised'
      using errcode = '42501';
  end if;

  if not private.membership_is_effective_owner(
    source_membership_id,
    actor_organisation_id
  ) then
    raise exception 'organisation ownership transfer is not authorised'
      using errcode = '42501';
  end if;

  if target_membership_id is null
    or target_membership_id = source_membership_id then
    raise exception 'organisation ownership cannot be transferred to the current owner'
      using errcode = '23514';
  end if;

  perform membership.id
  from public.organisation_memberships membership
  where membership.organisation_id = actor_organisation_id
    and membership.id in (source_membership_id, target_membership_id)
  order by membership.id
  for update;

  if not private.membership_is_ownership_transfer_eligible(
    actor_organisation_id,
    target_membership_id
  ) then
    raise exception 'ownership transfer target is not eligible'
      using errcode = '23514';
  end if;

  perform 1
  from public.access_grants grant_row
  join public.role_versions role_version
    on role_version.organisation_id = grant_row.organisation_id
   and role_version.id = grant_row.role_version_id
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where grant_row.organisation_id = actor_organisation_id
    and grant_row.status = 'active'
    and grant_row.scope_type = 'organisation'
    and (
      grant_row.expires_at is null
      or grant_row.expires_at > statement_timestamp()
    )
    and role_version.status = 'published'
    and role_row.status = 'active'
    and role_row.is_owner_role
    and grant_row.grantee_membership_id in (
      source_membership_id,
      target_membership_id
    )
  order by grant_row.id
  for update of grant_row;

  if not private.membership_is_effective_owner(
    source_membership_id,
    actor_organisation_id
  ) then
    raise exception 'organisation ownership transfer is not authorised'
      using errcode = '42501';
  end if;

  owner_role_version_id := private.published_organisation_owner_role_version_id(
    actor_organisation_id
  );
  if owner_role_version_id is null then
    raise exception 'organisation owner role version is not published'
      using errcode = '55000';
  end if;

  select grant_row.id
  into target_owner_grant_id
  from public.access_grants grant_row
  join public.role_versions role_version
    on role_version.organisation_id = grant_row.organisation_id
   and role_version.id = grant_row.role_version_id
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where grant_row.organisation_id = actor_organisation_id
    and grant_row.grantee_membership_id = target_membership_id
    and grant_row.status = 'active'
    and grant_row.scope_type = 'organisation'
    and (
      grant_row.expires_at is null
      or grant_row.expires_at > statement_timestamp()
    )
    and role_version.status = 'published'
    and role_row.status = 'active'
    and role_row.is_owner_role
  order by grant_row.granted_at desc, grant_row.id desc
  limit 1;

  if target_owner_grant_id is null then
    target_owner_grant_id := private.grant_role_version(
      actor_organisation_id,
      target_membership_id,
      owner_role_version_id,
      'organisation',
      null
    );
  end if;

  select coalesce(array_agg(grant_row.id order by grant_row.id), '{}'::uuid[])
  into source_owner_grant_ids
  from public.access_grants grant_row
  join public.role_versions role_version
    on role_version.organisation_id = grant_row.organisation_id
   and role_version.id = grant_row.role_version_id
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where grant_row.organisation_id = actor_organisation_id
    and grant_row.grantee_membership_id = source_membership_id
    and grant_row.status = 'active'
    and grant_row.scope_type = 'organisation'
    and (
      grant_row.expires_at is null
      or grant_row.expires_at > statement_timestamp()
    )
    and role_version.status = 'published'
    and role_row.status = 'active'
    and role_row.is_owner_role;

  if coalesce(array_length(source_owner_grant_ids, 1), 0) = 0 then
    raise exception 'organisation ownership transfer is not authorised'
      using errcode = '42501';
  end if;

  foreach source_grant_id in array source_owner_grant_ids
  loop
    perform private.revoke_access_grant(
      actor_organisation_id,
      source_grant_id,
      'Organisation ownership transferred'
    );
  end loop;

  select count(*)::integer
  into remaining_owners
  from public.organisation_memberships membership
  where membership.organisation_id = actor_organisation_id
    and private.membership_is_effective_owner(
      membership.id,
      actor_organisation_id
    );

  if remaining_owners < 1
    or not private.membership_is_effective_owner(
      target_membership_id,
      actor_organisation_id
    ) then
    raise exception 'organisation would have no owner'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where grant_row.organisation_id = actor_organisation_id
      and grant_row.grantee_membership_id = source_membership_id
      and grant_row.status = 'active'
      and grant_row.scope_type = 'organisation'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
      and role_version.status = 'published'
      and role_row.status = 'active'
      and role_row.is_owner_role
  ) then
    raise exception 'organisation ownership transfer failed'
      using errcode = '23514';
  end if;

  perform private.append_security_audit(
    actor_organisation_id,
    'organisation.ownership_transferred',
    'organisation',
    actor_organisation_id,
    'succeeded',
    jsonb_build_object(
      'source_membership_id', source_membership_id,
      'target_membership_id', target_membership_id,
      'source_owner_grant_ids', to_jsonb(source_owner_grant_ids),
      'target_owner_grant_id', target_owner_grant_id
    )
  );

  return jsonb_build_object(
    'organisation_id', actor_organisation_id,
    'source_membership_id', source_membership_id,
    'target_membership_id', target_membership_id,
    'source_owner_grant_ids', to_jsonb(source_owner_grant_ids),
    'target_owner_grant_id', target_owner_grant_id,
    'transferred', true
  );
end;
$$;

create or replace function public.transfer_organisation_ownership(
  target_membership_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.transfer_organisation_ownership(target_membership_id)
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function private.published_organisation_owner_role_version_id(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.membership_is_ownership_transfer_eligible(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.membership_ownership_display_name(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.membership_ownership_email(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.get_organisation_ownership()
  from public, anon, authenticated, service_role;
revoke all on function public.get_organisation_ownership()
  from public, anon, authenticated, service_role;
revoke all on function private.list_organisation_ownership_transfer_targets()
  from public, anon, authenticated, service_role;
revoke all on function public.list_organisation_ownership_transfer_targets()
  from public, anon, authenticated, service_role;
revoke all on function private.transfer_organisation_ownership(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.transfer_organisation_ownership(uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.get_organisation_ownership()
  to authenticated;
grant execute on function public.get_organisation_ownership()
  to authenticated;
grant execute on function private.list_organisation_ownership_transfer_targets()
  to authenticated;
grant execute on function public.list_organisation_ownership_transfer_targets()
  to authenticated;
grant execute on function private.transfer_organisation_ownership(uuid)
  to authenticated;
grant execute on function public.transfer_organisation_ownership(uuid)
  to authenticated;

comment on function public.transfer_organisation_ownership(uuid) is
  'Atomically transfer organisation-owner authority to an existing active member of the same organisation. Authority is current_membership_is_owner only.';

comment on function public.list_organisation_ownership_transfer_targets() is
  'List active same-organisation members eligible to receive organisation ownership. Owner-only; never returns other tenants.';

comment on function public.get_organisation_ownership() is
  'Return current organisation-owner memberships when memberships.read allows, and whether the caller may transfer ownership.';
