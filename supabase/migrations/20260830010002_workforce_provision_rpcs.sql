-- M1 workforce provisioning operations, signup-hook integration, and service finalisation.

alter table public.security_audit_events
  drop constraint if exists security_audit_events_target_type_check;

alter table public.security_audit_events
  add constraint security_audit_events_target_type_check
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
      'workforce_provision_intent',
      'authentication'
    )
  );

create or replace function private.generate_workforce_internal_login_identifier()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select lower(encode(extensions.gen_random_bytes(16), 'hex')) || '@workforce.invalid'
$$;

grant usage on schema extensions to lean_hub_private_owner;

create or replace function private.workforce_alias_is_available(
  p_organisation_id uuid,
  p_canonical_alias text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from private.workforce_aliases workforce_alias
    where workforce_alias.organisation_id = p_organisation_id
      and workforce_alias.canonical_alias = p_canonical_alias
      and workforce_alias.status = 'active'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.workforce_provision_intents intent_row
    where intent_row.organisation_id = p_organisation_id
      and intent_row.target_canonical_alias = p_canonical_alias
      and intent_row.status in ('pending', 'auth_created')
      and intent_row.expires_at > statement_timestamp()
  ) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function private.assert_workforce_provision_delegation(
  target_organisation_id uuid,
  actor_membership_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  containment_unit_id uuid;
  owner_role boolean;
begin
  containment_unit_id := case
    when target_scope_type = 'unit_subtree' then target_scope_unit_id
    else null
  end;

  if not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'workforce.provision',
    null,
    null
  ) or not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'roles.delegate',
    case when target_scope_type = 'self' then actor_membership_id else null end,
    containment_unit_id
  ) then
    raise exception 'workforce provisioning is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_role_version_grant_scope_allowed(
    target_organisation_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id
  );

  select role_row.is_owner_role
  into owner_role
  from public.role_versions role_version
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where role_version.organisation_id = target_organisation_id
    and role_version.id = target_role_version_id
    and role_version.status = 'published'
    and role_row.status = 'active';

  if owner_role is null
    or (
      owner_role
      and not exists (
        select 1
        from public.organisation_memberships membership
        join public.access_grants active_grant
          on active_grant.organisation_id = membership.organisation_id
         and active_grant.grantee_membership_id = membership.id
         and active_grant.status = 'active'
        join public.role_versions role_version
          on role_version.organisation_id = active_grant.organisation_id
         and role_version.id = active_grant.role_version_id
        join public.roles role_row
          on role_row.organisation_id = role_version.organisation_id
         and role_row.id = role_version.role_id
        where membership.organisation_id = target_organisation_id
          and membership.id = actor_membership_id
          and membership.status = 'active'
          and role_row.is_owner_role
      )
    ) then
    raise exception 'workforce provisioning role is not delegatable'
      using errcode = '42501';
  end if;

  if not private.role_version_is_delegatable_at_scope(
    target_organisation_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    actor_membership_id
  ) then
    raise exception 'workforce provisioning authority is not contained'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.preauthorize_workforce_provision(
  target_display_name text,
  target_canonical_alias text,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null,
  target_alias_type text default 'username',
  target_job_title text default null,
  target_notification_email text default null,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_idempotency_key text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  canonical_alias text := lower(btrim(target_canonical_alias));
  canonical_email text;
  existing_intent_id uuid;
  new_intent_id uuid;
  sealed_login text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'workforce provisioning is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisations organisation
    where organisation.id = org_id
      and organisation.status = 'active'
  ) then
    raise exception 'organisation is not active'
      using errcode = '42501';
  end if;

  if target_idempotency_key is not null then
    select intent_row.id
    into existing_intent_id
    from public.workforce_provision_intents intent_row
    where intent_row.organisation_id = org_id
      and intent_row.idempotency_key = target_idempotency_key
      and intent_row.status in ('pending', 'auth_created', 'completed')
    limit 1;

    if existing_intent_id is not null then
      return existing_intent_id;
    end if;
  end if;

  perform private.assert_workforce_provision_delegation(
    org_id,
    actor_membership_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id
  );

  if not private.workforce_alias_is_available(org_id, canonical_alias) then
    raise exception 'workforce alias is unavailable'
      using errcode = '23505';
  end if;

  if target_job_function_id is not null then
    if not exists (
      select 1
      from public.job_functions job_function_row
      where job_function_row.organisation_id = org_id
        and job_function_row.id = target_job_function_id
        and job_function_row.status = 'active'
    ) then
      raise exception 'job function is invalid'
        using errcode = '23503';
    end if;

    if target_organisational_unit_id is not null
      and not private.membership_has_scoped_permission(
        actor_membership_id,
        org_id,
        'hierarchy.read',
        null,
        target_organisational_unit_id
      ) then
      raise exception 'organisational unit is not accessible'
        using errcode = '42501';
    end if;

    if not private.membership_has_scoped_permission(
      actor_membership_id,
      org_id,
      'job_functions.manage',
      null,
      coalesce(target_organisational_unit_id, null)
    ) then
      raise exception 'job function assignment is not authorised'
        using errcode = '42501';
    end if;
  elsif target_organisational_unit_id is not null then
    raise exception 'job function is required when assigning a primary unit'
      using errcode = '23514';
  end if;

  canonical_email := case
    when target_notification_email is null then null
    else lower(btrim(target_notification_email))
  end;

  sealed_login := private.generate_workforce_internal_login_identifier();

  insert into public.workforce_provision_intents (
    organisation_id,
    actor_membership_id,
    intent_kind,
    status,
    target_display_name,
    target_canonical_alias,
    target_alias_type,
    target_job_title,
    target_notification_email,
    sealed_internal_login_identifier,
    target_job_function_id,
    target_organisational_unit_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    expires_at,
    idempotency_key
  )
  values (
    org_id,
    actor_membership_id,
    'manual_create',
    'pending',
    btrim(target_display_name),
    canonical_alias,
    target_alias_type,
    case when target_job_title is null then null else btrim(target_job_title) end,
    canonical_email,
    sealed_login,
    target_job_function_id,
    target_organisational_unit_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    statement_timestamp() + interval '15 minutes',
    target_idempotency_key
  )
  returning id into new_intent_id;

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
    org_id,
    'workforce.provision_preauthorized',
    'workforce_provision_intent',
    new_intent_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'intent_kind', 'manual_create',
      'canonical_alias', canonical_alias
    )
  );

  return new_intent_id;
end;
$$;

create or replace function private.validate_workforce_provision_intent_for_hook(
  target_intent_id uuid,
  target_signup_email text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  intent_row public.workforce_provision_intents%rowtype;
begin
  select *
  into intent_row
  from public.workforce_provision_intents intent
  where intent.id = target_intent_id;

  if intent_row.id is null then
    return false;
  end if;

  if intent_row.status not in ('pending', 'auth_created') then
    return false;
  end if;

  if intent_row.expires_at <= statement_timestamp() then
    return false;
  end if;

  if lower(btrim(target_signup_email)) <> intent_row.sealed_internal_login_identifier then
    return false;
  end if;

  if not exists (
    select 1
    from public.organisations organisation
    where organisation.id = intent_row.organisation_id
      and organisation.status = 'active'
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.organisation_memberships actor_membership
    where actor_membership.organisation_id = intent_row.organisation_id
      and actor_membership.id = intent_row.actor_membership_id
      and actor_membership.status = 'active'
  ) then
    return false;
  end if;

  return private.membership_has_scoped_permission(
    intent_row.actor_membership_id,
    intent_row.organisation_id,
    'workforce.provision',
    null,
    null
  );
end;
$$;

create or replace function private.record_workforce_auth_created(
  target_intent_id uuid,
  target_auth_user_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  intent_row public.workforce_provision_intents%rowtype;
  auth_email text;
begin
  select *
  into intent_row
  from public.workforce_provision_intents intent
  where intent.id = target_intent_id
  for update;

  if intent_row.id is null then
    raise exception 'workforce provision intent does not exist'
      using errcode = 'P0002';
  end if;

  if intent_row.status = 'completed' then
    return intent_row.created_auth_user_id = target_auth_user_id;
  end if;

  if intent_row.status = 'auth_created' then
    return intent_row.created_auth_user_id = target_auth_user_id;
  end if;

  if intent_row.status <> 'pending' then
    raise exception 'workforce provision intent is not actionable'
      using errcode = '55000';
  end if;

  if intent_row.expires_at <= statement_timestamp() then
    update public.workforce_provision_intents
    set status = 'expired',
        updated_at = statement_timestamp()
    where id = intent_row.id;
    raise exception 'workforce provision intent has expired'
      using errcode = '55000';
  end if;

  select lower(auth_user.email)
  into auth_email
  from auth.users auth_user
  where auth_user.id = target_auth_user_id;

  if auth_email is null
    or auth_email <> intent_row.sealed_internal_login_identifier then
    raise exception 'auth user does not match sealed workforce identifier'
      using errcode = '23514';
  end if;

  update public.workforce_provision_intents
  set status = 'auth_created',
      created_auth_user_id = target_auth_user_id,
      updated_at = statement_timestamp()
  where id = intent_row.id;

  return true;
end;
$$;

create or replace function private.finalize_workforce_provision(
  target_intent_id uuid,
  target_auth_user_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  intent_row public.workforce_provision_intents%rowtype;
  new_membership_id uuid;
  job_function_row public.job_functions%rowtype;
  new_grant_id uuid;
  containment_unit_id uuid;
begin
  select *
  into intent_row
  from public.workforce_provision_intents intent
  where intent.id = target_intent_id
  for update;

  if intent_row.id is null then
    raise exception 'workforce provision intent does not exist'
      using errcode = 'P0002';
  end if;

  if intent_row.status = 'completed' then
    return intent_row.created_membership_id;
  end if;

  if intent_row.status <> 'auth_created'
    or intent_row.created_auth_user_id is distinct from target_auth_user_id then
    raise exception 'workforce provision intent is not ready to finalise'
      using errcode = '55000';
  end if;

  if intent_row.expires_at <= statement_timestamp() then
    raise exception 'workforce provision intent has expired'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.organisations organisation
    where organisation.id = intent_row.organisation_id
      and organisation.status = 'active'
  ) then
    raise exception 'organisation is not active'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships actor_membership
    where actor_membership.organisation_id = intent_row.organisation_id
      and actor_membership.id = intent_row.actor_membership_id
      and actor_membership.status = 'active'
  ) then
    raise exception 'provisioning actor is no longer active'
      using errcode = '42501';
  end if;

  perform private.assert_workforce_provision_delegation(
    intent_row.organisation_id,
    intent_row.actor_membership_id,
    intent_row.target_role_version_id,
    intent_row.target_scope_type,
    intent_row.target_scope_unit_id
  );

  if exists (
    select 1
    from private.workforce_aliases workforce_alias
    where workforce_alias.organisation_id = intent_row.organisation_id
      and workforce_alias.canonical_alias = intent_row.target_canonical_alias
      and workforce_alias.status = 'active'
  ) then
    raise exception 'workforce alias is no longer available'
      using errcode = '23505';
  end if;

  select membership_registry.id
  into new_membership_id
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = intent_row.organisation_id
    and membership_registry.user_id = target_auth_user_id
  for update;

  if new_membership_id is null then
    insert into public.organisation_memberships (
      organisation_id,
      user_id,
      display_name,
      job_title,
      status,
      activated_at
    )
    values (
      intent_row.organisation_id,
      target_auth_user_id,
      intent_row.target_display_name,
      intent_row.target_job_title,
      'active',
      statement_timestamp()
    )
    returning id into new_membership_id;
  else
    update public.organisation_memberships membership_registry
    set display_name = coalesce(intent_row.target_display_name, membership_registry.display_name),
        job_title = coalesce(intent_row.target_job_title, membership_registry.job_title),
        status = 'active',
        activated_at = coalesce(membership_registry.activated_at, statement_timestamp()),
        inactivated_at = null,
        status_reason = null,
        updated_at = statement_timestamp()
    where membership_registry.id = new_membership_id;
  end if;

  perform private.provision_workforce_identity(
    intent_row.organisation_id,
    new_membership_id,
    target_auth_user_id,
    intent_row.sealed_internal_login_identifier,
    intent_row.target_alias_type,
    intent_row.target_canonical_alias
  );

  if intent_row.target_job_function_id is not null then
    select job_function_registry.*
    into job_function_row
    from public.job_functions job_function_registry
    where job_function_registry.organisation_id = intent_row.organisation_id
      and job_function_registry.id = intent_row.target_job_function_id
      and job_function_registry.status = 'active';

    if not found then
      raise exception 'job function is no longer active'
        using errcode = '23503';
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
      intent_row.organisation_id,
      new_membership_id,
      intent_row.target_job_function_id,
      intent_row.target_organisational_unit_id,
      true,
      statement_timestamp(),
      job_function_row.name,
      job_function_row.code,
      intent_row.actor_membership_id,
      'Applied from workforce provisioning'
    );
  end if;

  containment_unit_id := case
    when intent_row.target_scope_type = 'unit_subtree'
      then intent_row.target_scope_unit_id
    else null
  end;

  insert into public.access_grants (
    organisation_id,
    grantee_membership_id,
    role_version_id,
    scope_type,
    scope_unit_id,
    grantor_membership_id
  )
  values (
    intent_row.organisation_id,
    new_membership_id,
    intent_row.target_role_version_id,
    intent_row.target_scope_type,
    intent_row.target_scope_unit_id,
    intent_row.actor_membership_id
  )
  returning id into new_grant_id;

  perform private.append_security_audit(
    intent_row.organisation_id,
    'grant.issued',
    'grant',
    new_grant_id,
    'succeeded',
    jsonb_build_object('source', 'workforce_provision')
  );

  if intent_row.target_notification_email is not null then
    insert into public.membership_notification_contacts (
      organisation_id,
      membership_id,
      channel_type,
      contact_address,
      status,
      source
    )
    values (
      intent_row.organisation_id,
      new_membership_id,
      'email',
      intent_row.target_notification_email,
      'active',
      'manual'
    )
    on conflict (organisation_id, membership_id, channel_type)
    do update
    set contact_address = excluded.contact_address,
        status = 'active',
        source = excluded.source,
        updated_at = statement_timestamp();
  end if;

  update public.workforce_provision_intents
  set status = 'completed',
      created_membership_id = new_membership_id,
      consumed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = intent_row.id;

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
    intent_row.organisation_id,
    'workforce.provision_completed',
    'workforce_provision_intent',
    intent_row.id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'membership_id', new_membership_id,
      'canonical_alias', intent_row.target_canonical_alias
    )
  );

  return new_membership_id;
end;
$$;

create or replace function private.find_workforce_auth_user_for_intent(
  target_intent_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  intent_row public.workforce_provision_intents%rowtype;
  found_user_id uuid;
  metadata_intent_id text;
begin
  select *
  into intent_row
  from public.workforce_provision_intents intent
  where intent.id = target_intent_id;

  if intent_row.id is null then
    return null;
  end if;

  select auth_user.id
  into found_user_id
  from auth.users auth_user
  where lower(auth_user.email) = intent_row.sealed_internal_login_identifier
  limit 1;

  if found_user_id is null then
    return null;
  end if;

  metadata_intent_id := (
    select auth_user.raw_user_meta_data ->> 'workforce_provision_intent_id'
    from auth.users auth_user
    where auth_user.id = found_user_id
  );

  if metadata_intent_id is not null
    and metadata_intent_id <> target_intent_id::text then
    return null;
  end if;

  if intent_row.created_auth_user_id is not null
    and intent_row.created_auth_user_id <> found_user_id then
    return null;
  end if;

  return found_user_id;
end;
$$;

create or replace function private.fail_workforce_provision(
  target_intent_id uuid,
  target_failure_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  intent_row public.workforce_provision_intents%rowtype;
begin
  if target_failure_reason is null
    or target_failure_reason <> btrim(target_failure_reason)
    or char_length(target_failure_reason) not between 1 and 1000 then
    raise exception 'a bounded failure reason is required'
      using errcode = '22023';
  end if;

  select *
  into intent_row
  from public.workforce_provision_intents intent
  where intent.id = target_intent_id
  for update;

  if intent_row.id is null then
    return false;
  end if;

  if intent_row.status = 'completed' then
    return false;
  end if;

  if intent_row.created_auth_user_id is not null
    or intent_row.status = 'auth_created' then
    return false;
  end if;

  update public.workforce_provision_intents
  set status = 'failed',
      failure_reason = target_failure_reason,
      updated_at = statement_timestamp()
  where id = intent_row.id;

  return true;
end;
$$;

create or replace function private.mark_workforce_provision_needs_remediation(
  target_intent_id uuid,
  target_failure_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  intent_row public.workforce_provision_intents%rowtype;
begin
  if target_failure_reason is null
    or target_failure_reason <> btrim(target_failure_reason)
    or char_length(target_failure_reason) not between 1 and 1000 then
    raise exception 'a bounded failure reason is required'
      using errcode = '22023';
  end if;

  select *
  into intent_row
  from public.workforce_provision_intents intent
  where intent.id = target_intent_id
  for update;

  if intent_row.id is null
    or intent_row.status = 'completed' then
    return false;
  end if;

  update public.workforce_provision_intents
  set status = 'needs_platform_remediation',
      failure_reason = target_failure_reason,
      updated_at = statement_timestamp()
  where id = intent_row.id;

  return true;
end;
$$;

create or replace function private.get_workforce_provision_intent_for_worker(
  target_intent_id uuid,
  expected_caller_user_id uuid
)
returns table (
  intent_id uuid,
  organisation_id uuid,
  organisation_code text,
  status text,
  target_canonical_alias text,
  target_display_name text,
  sealed_internal_login_identifier text,
  created_auth_user_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  intent_row public.workforce_provision_intents%rowtype;
begin
  select intent.*
  into intent_row
  from public.workforce_provision_intents intent
  join public.organisation_memberships actor_membership
    on actor_membership.organisation_id = intent.organisation_id
   and actor_membership.id = intent.actor_membership_id
  where intent.id = target_intent_id
    and actor_membership.user_id = expected_caller_user_id
    and intent.status in ('pending', 'auth_created', 'completed')
    and intent.expires_at > statement_timestamp();

  if intent_row.id is null then
  return;
  end if;

  return query
  select
    intent_row.id,
    intent_row.organisation_id,
    organisation.code,
    intent_row.status,
    intent_row.target_canonical_alias,
    intent_row.target_display_name,
    intent_row.sealed_internal_login_identifier,
    intent_row.created_auth_user_id
  from public.organisations organisation
  where organisation.id = intent_row.organisation_id;
end;
$$;

create or replace function public.preauthorize_workforce_provision(
  target_display_name text,
  target_canonical_alias text,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null,
  target_alias_type text default 'username',
  target_job_title text default null,
  target_notification_email text default null,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_idempotency_key text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.preauthorize_workforce_provision(
    target_display_name,
    target_canonical_alias,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    target_alias_type,
    target_job_title,
    target_notification_email,
    target_job_function_id,
    target_organisational_unit_id,
    target_idempotency_key
  )
$$;

create or replace function public.record_workforce_auth_created(
  target_intent_id uuid,
  target_auth_user_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_workforce_auth_created(target_intent_id, target_auth_user_id)
$$;

create or replace function public.finalize_workforce_provision(
  target_intent_id uuid,
  target_auth_user_id uuid
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.finalize_workforce_provision(target_intent_id, target_auth_user_id)
$$;

create or replace function public.fail_workforce_provision(
  target_intent_id uuid,
  target_failure_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.fail_workforce_provision(target_intent_id, target_failure_reason)
$$;

create or replace function public.find_workforce_auth_user_for_intent(
  target_intent_id uuid
)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select private.find_workforce_auth_user_for_intent(target_intent_id)
$$;

create or replace function public.mark_workforce_provision_needs_remediation(
  target_intent_id uuid,
  target_failure_reason text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.mark_workforce_provision_needs_remediation(
    target_intent_id,
    target_failure_reason
  )
$$;

create or replace function public.get_workforce_provision_intent_for_worker(
  target_intent_id uuid,
  expected_caller_user_id uuid
)
returns table (
  intent_id uuid,
  organisation_id uuid,
  organisation_code text,
  status text,
  target_canonical_alias text,
  target_display_name text,
  sealed_internal_login_identifier text,
  created_auth_user_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_workforce_provision_intent_for_worker(
    target_intent_id,
    expected_caller_user_id
  )
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
  workforce_intent_id_text text;
  workforce_intent_id uuid;
begin
  signup_email := event -> 'user' ->> 'email';
  workforce_intent_id_text :=
    event -> 'user' -> 'user_metadata' ->> 'workforce_provision_intent_id';

  if workforce_intent_id_text is not null
    and workforce_intent_id_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and signup_email is not null
    and btrim(signup_email) <> '' then
    workforce_intent_id := workforce_intent_id_text::uuid;

    if private.validate_workforce_provision_intent_for_hook(
      workforce_intent_id,
      signup_email
    ) then
      return '{}'::jsonb;
    end if;

    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

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

grant execute on function public.preauthorize_workforce_provision(
  text, text, uuid, text, uuid, text, text, text, uuid, uuid, text
) to authenticated;

revoke all on function public.preauthorize_workforce_provision(
  text, text, uuid, text, uuid, text, text, text, uuid, uuid, text
) from public, anon;

grant execute on function public.record_workforce_auth_created(uuid, uuid)
  to service_role;
grant execute on function public.finalize_workforce_provision(uuid, uuid)
  to service_role;
grant execute on function public.fail_workforce_provision(uuid, text)
  to service_role;
grant execute on function public.find_workforce_auth_user_for_intent(uuid)
  to service_role;
grant execute on function public.mark_workforce_provision_needs_remediation(uuid, text)
  to service_role;
grant execute on function public.get_workforce_provision_intent_for_worker(uuid, uuid)
  to service_role;

revoke all on function public.record_workforce_auth_created(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_workforce_provision(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.fail_workforce_provision(uuid, text)
  from public, anon, authenticated;
revoke all on function public.find_workforce_auth_user_for_intent(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_workforce_provision_needs_remediation(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_workforce_provision_intent_for_worker(uuid, uuid)
  from public, anon, authenticated;

alter function private.generate_workforce_internal_login_identifier() owner to lean_hub_private_owner;
alter function private.workforce_alias_is_available(uuid, text) owner to lean_hub_private_owner;
alter function private.assert_workforce_provision_delegation(uuid, uuid, uuid, text, uuid) owner to lean_hub_private_owner;
alter function private.preauthorize_workforce_provision(
  text, text, uuid, text, uuid, text, text, text, uuid, uuid, text
) owner to lean_hub_private_owner;
alter function private.validate_workforce_provision_intent_for_hook(uuid, text) owner to lean_hub_private_owner;
alter function private.record_workforce_auth_created(uuid, uuid) owner to postgres;
alter function private.finalize_workforce_provision(uuid, uuid) owner to lean_hub_private_owner;
alter function private.fail_workforce_provision(uuid, text) owner to lean_hub_private_owner;
alter function private.find_workforce_auth_user_for_intent(uuid) owner to postgres;
alter function private.mark_workforce_provision_needs_remediation(uuid, text) owner to lean_hub_private_owner;
alter function private.get_workforce_provision_intent_for_worker(uuid, uuid) owner to lean_hub_private_owner;
