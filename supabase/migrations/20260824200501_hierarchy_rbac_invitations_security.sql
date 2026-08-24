create table public.organisation_units (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  parent_unit_id uuid,
  code text not null,
  name text not null,
  unit_type text not null,
  status text not null default 'active',
  version integer not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz,
  restored_at timestamptz,
  status_changed_by_membership_id uuid,
  status_reason text,
  constraint organisation_units_organisation_id_id_key
    unique (organisation_id, id),
  constraint organisation_units_organisation_id_code_key
    unique (organisation_id, code),
  constraint organisation_units_parent_fkey
    foreign key (organisation_id, parent_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint organisation_units_status_actor_fkey
    foreign key (organisation_id, status_changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint organisation_units_code_check
    check (
      code = lower(code)
      and code ~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    ),
  constraint organisation_units_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint organisation_units_type_check
    check (unit_type = btrim(unit_type) and char_length(unit_type) between 1 and 80),
  constraint organisation_units_status_check
    check (status in ('active', 'retired')),
  constraint organisation_units_version_check check (version > 0),
  constraint organisation_units_not_own_parent_check
    check (parent_unit_id is null or parent_unit_id <> id),
  constraint organisation_units_lifecycle_check
    check (
      (status = 'active' and retired_at is null)
      or (
        status = 'retired'
        and retired_at is not null
        and status_reason = btrim(status_reason)
        and char_length(status_reason) between 1 and 1000
      )
    )
);

create table public.organisation_unit_closure (
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  ancestor_unit_id uuid not null,
  descendant_unit_id uuid not null,
  depth smallint not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (organisation_id, ancestor_unit_id, descendant_unit_id),
  constraint organisation_unit_closure_ancestor_fkey
    foreign key (organisation_id, ancestor_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint organisation_unit_closure_descendant_fkey
    foreign key (organisation_id, descendant_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint organisation_unit_closure_depth_check
    check (depth between 0 and 32),
  constraint organisation_unit_closure_shape_check
    check (
      (depth = 0 and ancestor_unit_id = descendant_unit_id)
      or (depth > 0 and ancestor_unit_id <> descendant_unit_id)
    )
);

create table public.permission_definitions (
  permission_key text primary key,
  description text not null,
  is_protected boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  constraint permission_definitions_key_check
    check (
      permission_key = lower(permission_key)
      and permission_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'
    ),
  constraint permission_definitions_description_check
    check (description = btrim(description) and char_length(description) between 1 and 240)
);

insert into public.permission_definitions (
  permission_key,
  description,
  is_protected
)
values
  ('organisation.update', 'Update organisation settings and lifecycle.', true),
  ('memberships.read', 'Read organisation memberships.', false),
  ('memberships.manage', 'Manage organisation membership lifecycle.', true),
  ('invitations.manage', 'Issue and revoke organisation invitations.', true),
  ('hierarchy.read', 'Read organisation units and hierarchy.', false),
  ('hierarchy.manage', 'Create, move, retire, and restore organisation units.', true),
  ('roles.read', 'Read roles, role versions, permissions, and grants.', false),
  ('roles.manage', 'Create and publish organisation role versions.', true),
  ('roles.delegate', 'Delegate contained role versions and scopes.', true),
  ('security_audit.read', 'Read the organisation security ledger.', true);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  canonical_name text not null,
  display_name text not null,
  description text,
  status text not null default 'active',
  is_protected boolean not null default false,
  is_owner_role boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  status_changed_by_membership_id uuid,
  status_reason text,
  constraint roles_organisation_id_id_key unique (organisation_id, id),
  constraint roles_organisation_id_canonical_name_key
    unique (organisation_id, canonical_name),
  constraint roles_status_actor_fkey
    foreign key (organisation_id, status_changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint roles_canonical_name_check
    check (
      canonical_name = lower(canonical_name)
      and canonical_name ~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    ),
  constraint roles_display_name_check
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 120),
  constraint roles_description_check
    check (description is null or char_length(description) <= 1000),
  constraint roles_status_check check (status in ('active', 'archived')),
  constraint roles_owner_protection_check
    check (not is_owner_role or is_protected),
  constraint roles_lifecycle_check
    check (
      (status = 'active' and archived_at is null)
      or (
        status = 'archived'
        and archived_at is not null
        and status_reason = btrim(status_reason)
        and char_length(status_reason) between 1 and 1000
      )
    )
);

create table public.role_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  role_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  created_by_membership_id uuid not null,
  published_by_membership_id uuid,
  retired_by_membership_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  published_at timestamptz,
  retired_at timestamptz,
  constraint role_versions_organisation_id_id_key unique (organisation_id, id),
  constraint role_versions_role_version_key
    unique (organisation_id, role_id, version_number),
  constraint role_versions_role_fkey
    foreign key (organisation_id, role_id)
    references public.roles(organisation_id, id)
    on delete restrict,
  constraint role_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint role_versions_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint role_versions_retirer_fkey
    foreign key (organisation_id, retired_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint role_versions_number_check check (version_number > 0),
  constraint role_versions_status_check
    check (status in ('draft', 'published', 'retired')),
  constraint role_versions_lifecycle_check
    check (
      (
        status = 'draft'
        and published_at is null
        and published_by_membership_id is null
        and retired_at is null
        and retired_by_membership_id is null
      )
      or (
        status = 'published'
        and published_at is not null
        and published_by_membership_id is not null
        and retired_at is null
        and retired_by_membership_id is null
      )
      or (
        status = 'retired'
        and published_at is not null
        and published_by_membership_id is not null
        and retired_at is not null
        and retired_by_membership_id is not null
      )
    )
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  role_version_id uuid not null,
  permission_key text not null
    references public.permission_definitions(permission_key) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint role_permissions_organisation_id_id_key unique (organisation_id, id),
  constraint role_permissions_role_version_permission_key
    unique (organisation_id, role_version_id, permission_key),
  constraint role_permissions_role_version_fkey
    foreign key (organisation_id, role_version_id)
    references public.role_versions(organisation_id, id)
    on delete restrict
);

create table public.organisation_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  recipient_type text not null,
  canonical_recipient text not null,
  token_digest bytea not null unique,
  inviter_membership_id uuid not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  offer_sealed_at timestamptz,
  accepted_membership_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expired_at timestamptz,
  status_changed_at timestamptz not null default statement_timestamp(),
  status_changed_by_membership_id uuid,
  status_reason text,
  created_at timestamptz not null default statement_timestamp(),
  constraint organisation_invitations_organisation_id_id_key
    unique (organisation_id, id),
  constraint organisation_invitations_inviter_fkey
    foreign key (organisation_id, inviter_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint organisation_invitations_accepted_membership_fkey
    foreign key (organisation_id, accepted_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint organisation_invitations_status_actor_fkey
    foreign key (organisation_id, status_changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint organisation_invitations_recipient_type_check
    check (recipient_type in ('email', 'workforce_id', 'username')),
  constraint organisation_invitations_recipient_check
    check (
      canonical_recipient = lower(canonical_recipient)
      and canonical_recipient = btrim(canonical_recipient)
      and char_length(canonical_recipient) between 3 and 320
      and canonical_recipient !~ '[[:space:][:cntrl:]]'
      and (
        recipient_type = 'email'
        or canonical_recipient ~ '^[a-z0-9][a-z0-9._-]{0,127}$'
      )
    ),
  constraint organisation_invitations_token_digest_check
    check (octet_length(token_digest) = 32),
  constraint organisation_invitations_expiry_check
    check (expires_at > created_at),
  constraint organisation_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint organisation_invitations_lifecycle_check
    check (
      (
        status = 'pending'
        and accepted_membership_id is null
        and accepted_at is null
        and revoked_at is null
        and expired_at is null
      )
      or (
        status = 'accepted'
        and accepted_membership_id is not null
        and accepted_at is not null
        and revoked_at is null
        and expired_at is null
      )
      or (
        status = 'revoked'
        and accepted_membership_id is null
        and accepted_at is null
        and revoked_at is not null
        and expired_at is null
        and status_reason = btrim(status_reason)
        and char_length(status_reason) between 1 and 1000
      )
      or (
        status = 'expired'
        and accepted_membership_id is null
        and accepted_at is null
        and revoked_at is null
        and expired_at is not null
      )
    )
);

create table public.organisation_invitation_grants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  invitation_id uuid not null,
  role_version_id uuid not null,
  scope_type text not null,
  scope_unit_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  constraint organisation_invitation_grants_organisation_id_id_key
    unique (organisation_id, id),
  constraint organisation_invitation_grants_invitation_fkey
    foreign key (organisation_id, invitation_id)
    references public.organisation_invitations(organisation_id, id)
    on delete restrict,
  constraint organisation_invitation_grants_role_version_fkey
    foreign key (organisation_id, role_version_id)
    references public.role_versions(organisation_id, id)
    on delete restrict,
  constraint organisation_invitation_grants_scope_unit_fkey
    foreign key (organisation_id, scope_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint organisation_invitation_grants_scope_type_check
    check (scope_type in ('self', 'unit_subtree', 'organisation')),
  constraint organisation_invitation_grants_scope_shape_check
    check (
      (scope_type = 'unit_subtree' and scope_unit_id is not null)
      or (scope_type in ('self', 'organisation') and scope_unit_id is null)
    )
);

create unique index organisation_invitation_grants_identity_key
  on public.organisation_invitation_grants (
    organisation_id,
    invitation_id,
    role_version_id,
    scope_type,
    scope_unit_id
  ) nulls not distinct;

create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  grantee_membership_id uuid not null,
  role_version_id uuid not null,
  scope_type text not null,
  scope_unit_id uuid,
  grantor_membership_id uuid not null,
  status text not null default 'active',
  granted_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_membership_id uuid,
  revocation_reason text,
  constraint access_grants_organisation_id_id_key unique (organisation_id, id),
  constraint access_grants_grantee_fkey
    foreign key (organisation_id, grantee_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint access_grants_role_version_fkey
    foreign key (organisation_id, role_version_id)
    references public.role_versions(organisation_id, id)
    on delete restrict,
  constraint access_grants_scope_unit_fkey
    foreign key (organisation_id, scope_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint access_grants_grantor_fkey
    foreign key (organisation_id, grantor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint access_grants_revoker_fkey
    foreign key (organisation_id, revoked_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint access_grants_scope_type_check
    check (scope_type in ('self', 'unit_subtree', 'organisation')),
  constraint access_grants_scope_shape_check
    check (
      (scope_type = 'unit_subtree' and scope_unit_id is not null)
      or (scope_type in ('self', 'organisation') and scope_unit_id is null)
    ),
  constraint access_grants_expiry_check
    check (expires_at is null or expires_at > granted_at),
  constraint access_grants_status_check
    check (status in ('active', 'revoked', 'expired')),
  constraint access_grants_lifecycle_check
    check (
      (
        status in ('active', 'expired')
        and revoked_at is null
        and revoked_by_membership_id is null
        and revocation_reason is null
      )
      or (
        status = 'revoked'
        and revoked_at is not null
        and revoked_by_membership_id is not null
        and revocation_reason = btrim(revocation_reason)
        and char_length(revocation_reason) between 1 and 1000
      )
    )
);

create unique index access_grants_active_identity_key
  on public.access_grants (
    organisation_id,
    grantee_membership_id,
    role_version_id,
    scope_type,
    scope_unit_id
  ) nulls not distinct
  where status = 'active';

create table private.session_organisation_contexts (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null,
  membership_id uuid not null,
  selected_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint session_organisation_contexts_membership_fkey
    foreign key (organisation_id, membership_id, user_id)
    references public.organisation_memberships(organisation_id, id, user_id)
    on delete restrict
);

create table public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_membership_id uuid,
  actor_session_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  outcome text not null,
  request_correlation_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint security_audit_events_organisation_id_id_key
    unique (organisation_id, id),
  constraint security_audit_events_actor_membership_fkey
    foreign key (organisation_id, actor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint security_audit_events_action_check
    check (
      action = lower(action)
      and action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    ),
  constraint security_audit_events_target_type_check
    check (
      target_type is null
      or target_type in (
        'identity',
        'organisation',
        'membership',
        'invitation',
        'unit',
        'role',
        'role_version',
        'grant',
        'session',
        'workforce_account',
        'workforce_alias',
        'authentication'
      )
    ),
  constraint security_audit_events_target_shape_check
    check (
      (target_type is null and target_id is null)
      or (target_type is not null and target_id is not null)
    ),
  constraint security_audit_events_outcome_check
    check (outcome in ('succeeded', 'denied', 'failed')),
  constraint security_audit_events_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 8192
    ),
  constraint security_audit_events_actor_tenant_check
    check (actor_membership_id is null or organisation_id is not null)
);

create table private.authentication_rate_limits (
  id uuid primary key default gen_random_uuid(),
  purpose text not null,
  dimension text not null,
  key_hash bytea not null,
  window_started_at timestamptz not null,
  window_ends_at timestamptz not null,
  attempt_count integer not null default 0,
  blocked_until timestamptz,
  last_attempt_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint authentication_rate_limits_window_key
    unique (purpose, dimension, key_hash, window_started_at),
  constraint authentication_rate_limits_purpose_check
    check (purpose in ('workforce_login', 'password_recovery', 'invitation')),
  constraint authentication_rate_limits_dimension_check
    check (dimension in ('ip', 'organisation_code', 'alias', 'account', 'recipient')),
  constraint authentication_rate_limits_hash_check
    check (octet_length(key_hash) = 32),
  constraint authentication_rate_limits_window_check
    check (
      window_ends_at > window_started_at
      and window_ends_at <= window_started_at + interval '24 hours'
    ),
  constraint authentication_rate_limits_count_check
    check (attempt_count between 0 and 1000000)
);

create index organisation_units_parent_status_idx
  on public.organisation_units (organisation_id, parent_unit_id, status, id);
create index organisation_units_status_idx
  on public.organisation_units (organisation_id, status, id);
create index organisation_unit_closure_descendant_idx
  on public.organisation_unit_closure (
    organisation_id,
    descendant_unit_id,
    depth,
    ancestor_unit_id
  );
create index roles_status_name_idx
  on public.roles (organisation_id, status, canonical_name);
create index role_versions_role_status_idx
  on public.role_versions (
    organisation_id,
    role_id,
    status,
    version_number desc
  );
create index role_permissions_permission_idx
  on public.role_permissions (organisation_id, permission_key, role_version_id);
create index organisation_invitations_status_expiry_idx
  on public.organisation_invitations (organisation_id, status, expires_at);
create index organisation_invitations_inviter_idx
  on public.organisation_invitations (
    organisation_id,
    inviter_membership_id,
    created_at desc
  );
create unique index organisation_invitations_pending_recipient_key
  on public.organisation_invitations (
    organisation_id,
    recipient_type,
    canonical_recipient
  )
  where status = 'pending';
create index organisation_invitation_grants_role_idx
  on public.organisation_invitation_grants (
    organisation_id,
    role_version_id,
    invitation_id
  );
create index access_grants_grantee_status_idx
  on public.access_grants (
    organisation_id,
    grantee_membership_id,
    status,
    expires_at
  );
create index access_grants_role_status_idx
  on public.access_grants (organisation_id, role_version_id, status);
create index access_grants_scope_status_idx
  on public.access_grants (
    organisation_id,
    scope_type,
    scope_unit_id,
    status
  );
create index session_organisation_contexts_user_org_idx
  on private.session_organisation_contexts (user_id, organisation_id, session_id);
create index session_organisation_contexts_membership_idx
  on private.session_organisation_contexts (organisation_id, membership_id);
create index security_audit_events_org_time_idx
  on public.security_audit_events (organisation_id, occurred_at desc);
create index security_audit_events_org_action_time_idx
  on public.security_audit_events (organisation_id, action, occurred_at desc);
create index security_audit_events_actor_time_idx
  on public.security_audit_events (actor_user_id, occurred_at desc);
create index security_audit_events_correlation_idx
  on public.security_audit_events (request_correlation_id);
create index authentication_rate_limits_lookup_idx
  on private.authentication_rate_limits (
    purpose,
    dimension,
    key_hash,
    window_ends_at
  );
create index authentication_rate_limits_cleanup_idx
  on private.authentication_rate_limits (window_ends_at);

create or replace function private.guard_role_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'published role versions are immutable'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if new.organisation_id <> old.organisation_id
    or new.role_id <> old.role_id
    or new.version_number <> old.version_number
    or new.created_by_membership_id <> old.created_by_membership_id
    or new.created_at <> old.created_at then
    raise exception 'role version identity is immutable'
      using errcode = '55000';
  end if;

  if old.status = 'draft' and new.status in ('draft', 'published') then
    return new;
  end if;

  if old.status = 'published' and new.status = 'retired' then
    if new.published_at is distinct from old.published_at
      or new.published_by_membership_id is distinct from old.published_by_membership_id then
      raise exception 'published role version evidence is immutable'
        using errcode = '55000';
    end if;
    return new;
  end if;

  raise exception 'invalid role version transition'
    using errcode = '55000';
end;
$$;

create or replace function private.guard_role_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status text;
  target_organisation_id uuid;
  target_role_is_protected boolean;
  target_permission_is_protected boolean;
begin
  select rv.status, rv.organisation_id, role_row.is_protected
  into target_status, target_organisation_id, target_role_is_protected
  from public.role_versions rv
  join public.roles role_row
    on role_row.organisation_id = rv.organisation_id
   and role_row.id = rv.role_id
  where rv.id = coalesce(new.role_version_id, old.role_version_id);

  if target_status is distinct from 'draft'
    or target_organisation_id is distinct from coalesce(new.organisation_id, old.organisation_id) then
    raise exception 'permissions may change only on a draft role version'
      using errcode = '55000';
  end if;

  if tg_op <> 'DELETE' then
    select permission.is_protected
    into target_permission_is_protected
    from public.permission_definitions permission
    where permission.permission_key = new.permission_key;

    if coalesce(target_permission_is_protected, false)
      and not target_role_is_protected then
      raise exception 'protected permissions require a protected role'
        using errcode = '42501';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.guard_invitation_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sealed_at timestamptz;
begin
  select invitation.offer_sealed_at
  into sealed_at
  from public.organisation_invitations invitation
  where invitation.id = coalesce(new.invitation_id, old.invitation_id)
    and invitation.organisation_id =
      coalesce(new.organisation_id, old.organisation_id);

  if sealed_at is not null then
    raise exception 'sealed invitation authority is immutable'
      using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.guard_invitation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organisation_id is distinct from old.organisation_id
    or new.id is distinct from old.id
    or new.recipient_type is distinct from old.recipient_type
    or new.canonical_recipient is distinct from old.canonical_recipient
    or new.token_digest is distinct from old.token_digest
    or new.inviter_membership_id is distinct from old.inviter_membership_id
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at then
    raise exception 'invitation identity and offer are immutable'
      using errcode = '55000';
  end if;

  if old.offer_sealed_at is not null
    and new.offer_sealed_at is distinct from old.offer_sealed_at then
    raise exception 'sealed invitation cannot be changed or unsealed'
      using errcode = '55000';
  end if;

  if old.offer_sealed_at is null
    and new.offer_sealed_at is not null
    and new.status <> 'pending' then
    raise exception 'only a pending invitation may be sealed'
      using errcode = '55000';
  end if;

  if old.status <> 'pending' then
    raise exception 'invitation terminal states are immutable'
      using errcode = '55000';
  end if;

  if new.status not in ('pending', 'accepted', 'revoked', 'expired') then
    raise exception 'invalid invitation transition'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function private.guard_access_grant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organisation_id is distinct from old.organisation_id
    or new.id is distinct from old.id
    or new.grantee_membership_id is distinct from old.grantee_membership_id
    or new.role_version_id is distinct from old.role_version_id
    or new.scope_type is distinct from old.scope_type
    or new.scope_unit_id is distinct from old.scope_unit_id
    or new.grantor_membership_id is distinct from old.grantor_membership_id
    or new.granted_at is distinct from old.granted_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'grant authority binding is immutable'
      using errcode = '55000';
  end if;

  if old.status <> 'active' then
    raise exception 'terminal grants cannot be changed or reactivated'
      using errcode = '55000';
  end if;

  if new.status not in ('active', 'revoked', 'expired') then
    raise exception 'invalid grant transition'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function private.assert_invitation_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid := coalesce(new.id, old.id);
  invitation_organisation_id uuid := coalesce(new.organisation_id, old.organisation_id);
begin
  if exists (
    select 1
    from public.organisation_invitations invitation
    where invitation.id = invitation_id
      and invitation.organisation_id = invitation_organisation_id
      and invitation.status = 'pending'
      and (
        invitation.offer_sealed_at is null
        or not exists (
          select 1
          from public.organisation_invitation_grants invitation_grant
          where invitation_grant.organisation_id = invitation.organisation_id
            and invitation_grant.invitation_id = invitation.id
        )
      )
  ) then
    raise exception 'pending invitation must have a sealed authority offer'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create or replace function private.assert_session_context_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from auth.sessions session
    where session.id = new.session_id
      and session.user_id = new.user_id
  ) then
    raise exception 'session does not belong to user'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter function private.guard_role_version() owner to lean_hub_private_owner;
alter function private.guard_role_permission() owner to lean_hub_private_owner;
alter function private.guard_invitation_grant() owner to lean_hub_private_owner;
alter function private.guard_invitation() owner to lean_hub_private_owner;
alter function private.guard_access_grant() owner to lean_hub_private_owner;
alter function private.assert_invitation_complete() owner to lean_hub_private_owner;
alter function private.assert_session_context_user() owner to lean_hub_private_owner;

grant select on public.role_versions to lean_hub_private_owner;
grant select on public.organisation_invitations to lean_hub_private_owner;
grant select on public.organisation_invitation_grants to lean_hub_private_owner;

create trigger role_versions_guard
before update or delete on public.role_versions
for each row execute function private.guard_role_version();
create trigger role_versions_immutable_tenant
before update on public.role_versions
for each row execute function private.prevent_organisation_id_change();

create trigger role_permissions_guard
before insert or update or delete on public.role_permissions
for each row execute function private.guard_role_permission();
create trigger role_permissions_immutable_tenant
before update on public.role_permissions
for each row execute function private.prevent_organisation_id_change();

create trigger organisation_invitations_guard
before update on public.organisation_invitations
for each row execute function private.guard_invitation();
create trigger organisation_invitations_immutable_tenant
before update on public.organisation_invitations
for each row execute function private.prevent_organisation_id_change();
create constraint trigger organisation_invitations_complete
after insert or update on public.organisation_invitations
deferrable initially deferred
for each row execute function private.assert_invitation_complete();

create trigger organisation_invitation_grants_guard
before insert or update or delete on public.organisation_invitation_grants
for each row execute function private.guard_invitation_grant();
create trigger organisation_invitation_grants_immutable_tenant
before update on public.organisation_invitation_grants
for each row execute function private.prevent_organisation_id_change();

create trigger organisation_units_touch_updated_at
before update on public.organisation_units
for each row execute function private.touch_updated_at();
create trigger organisation_units_immutable_tenant
before update on public.organisation_units
for each row execute function private.prevent_organisation_id_change();
create trigger roles_touch_updated_at
before update on public.roles
for each row execute function private.touch_updated_at();
create trigger roles_immutable_tenant
before update on public.roles
for each row execute function private.prevent_organisation_id_change();
create trigger access_grants_immutable_tenant
before update on public.access_grants
for each row execute function private.guard_access_grant();
create trigger security_audit_events_append_only
before update or delete on public.security_audit_events
for each row execute function private.prevent_update_or_delete();
create trigger authentication_rate_limits_touch_updated_at
before update on private.authentication_rate_limits
for each row execute function private.touch_updated_at();
create trigger session_organisation_contexts_touch_updated_at
before update on private.session_organisation_contexts
for each row execute function private.touch_updated_at();
create trigger session_organisation_contexts_validate_user
before insert or update on private.session_organisation_contexts
for each row execute function private.assert_session_context_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
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
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'revoke all on public.%I from public, anon, authenticated',
      table_name
    );
  end loop;
end
$$;

alter table private.session_organisation_contexts enable row level security;
alter table private.session_organisation_contexts force row level security;
alter table private.authentication_rate_limits enable row level security;
alter table private.authentication_rate_limits force row level security;
alter table private.session_organisation_contexts owner to lean_hub_private_owner;
alter table private.authentication_rate_limits owner to lean_hub_private_owner;
revoke all on private.session_organisation_contexts from public, anon, authenticated;
revoke all on private.authentication_rate_limits from public, anon, authenticated;

revoke all on function private.guard_role_version() from public, anon, authenticated;
revoke all on function private.guard_role_permission() from public, anon, authenticated;
revoke all on function private.guard_invitation_grant() from public, anon, authenticated;
revoke all on function private.guard_invitation() from public, anon, authenticated;
revoke all on function private.guard_access_grant() from public, anon, authenticated;
revoke all on function private.assert_invitation_complete() from public, anon, authenticated;
revoke all on function private.assert_session_context_user() from public, anon, authenticated;
