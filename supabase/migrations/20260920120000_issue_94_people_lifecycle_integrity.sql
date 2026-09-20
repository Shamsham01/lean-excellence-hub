-- Issue #94: People lifecycle integrity — export session ack, credential reset,
-- identity profile fields, scope label disambiguation, import archive.

-- ---------------------------------------------------------------------------
-- Schema: workforce import export sessions + archive
-- ---------------------------------------------------------------------------

alter table public.workforce_import_jobs
  drop constraint if exists workforce_import_jobs_export_status_check;

alter table public.workforce_import_jobs
  add column if not exists credential_export_session_id uuid,
  add column if not exists credential_export_session_started_at timestamptz,
  add column if not exists credential_export_session_started_by_membership_id uuid,
  add column if not exists archived_from_recent_at timestamptz;

alter table public.workforce_import_jobs
  add constraint workforce_import_jobs_export_status_check
  check (
    credential_export_status in (
      'none',
      'available',
      'exporting',
      'exported',
      'expired'
    )
  );

alter table public.workforce_provision_intents
  add column if not exists target_membership_id uuid;

alter table public.workforce_provision_intents
  drop constraint if exists workforce_provision_intents_target_membership_fkey;

alter table public.workforce_provision_intents
  add constraint workforce_provision_intents_target_membership_fkey
  foreign key (organisation_id, target_membership_id)
  references public.organisation_memberships(organisation_id, id)
  on delete restrict;

-- ---------------------------------------------------------------------------
-- Helpers: organisation unit path labels
-- ---------------------------------------------------------------------------

create or replace function private.format_organisation_unit_path_label(
  target_unit_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with recursive ancestors as (
    select
      unit_row.id,
      unit_row.name,
      unit_row.parent_unit_id,
      1 as depth
    from public.organisation_units unit_row
    where unit_row.id = target_unit_id

    union all

    select
      parent_unit.id,
      parent_unit.name,
      parent_unit.parent_unit_id,
      ancestors.depth + 1
    from ancestors
    join public.organisation_units parent_unit
      on parent_unit.id = ancestors.parent_unit_id
  )
  select coalesce(
    string_agg(ancestors.name, ' › ' order by ancestors.depth desc),
    'Scoped access'
  )
  from ancestors;
$$;

create or replace function private.format_delegatable_scope_label(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_unit_name text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  duplicate_count integer;
begin
  select count(*)
  into duplicate_count
  from public.organisation_units unit_row
  where unit_row.organisation_id = target_organisation_id
    and unit_row.status = 'active'
    and unit_row.name = target_unit_name;

  if duplicate_count > 1 then
    return private.format_organisation_unit_path_label(target_unit_id) || ' subtree';
  end if;

  return target_unit_name || ' subtree';
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
  unit_row record;
begin
  if target_scope_type = 'organisation' then
    return 'Entire organisation';
  end if;

  if target_scope_type = 'self' then
    return 'Personal access';
  end if;

  if target_scope_type = 'unit_subtree' and target_scope_unit_id is not null then
    select
      unit_registry.id,
      unit_registry.name,
      unit_registry.organisation_id
    into unit_row
    from public.organisation_units unit_registry
    where unit_registry.id = target_scope_unit_id;

    if unit_row.id is null then
      return 'Scoped access';
    end if;

    return private.format_delegatable_scope_label(
      unit_row.organisation_id,
      unit_row.id,
      unit_row.name
    );
  end if;

  return 'Scoped access';
end;
$$;

-- ---------------------------------------------------------------------------
-- Workforce import credential export session + acknowledgement
-- ---------------------------------------------------------------------------

create or replace function private.expire_stale_workforce_import_export_sessions(
  target_import_job_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.workforce_import_jobs import_job
  set credential_export_status = case
        when import_job.credential_export_status = 'exporting'
          and import_job.credential_export_session_started_at is not null
          and import_job.credential_export_session_started_at
            <= statement_timestamp() - interval '15 minutes'
          then 'available'
        when import_job.credential_export_status = 'available'
          and import_job.credential_expires_at is not null
          and import_job.credential_expires_at <= statement_timestamp()
          then 'expired'
        else import_job.credential_export_status
      end,
      credential_export_session_id = case
        when import_job.credential_export_status = 'exporting'
          and import_job.credential_export_session_started_at is not null
          and import_job.credential_export_session_started_at
            <= statement_timestamp() - interval '15 minutes'
          then null
        else import_job.credential_export_session_id
      end,
      credential_export_session_started_at = case
        when import_job.credential_export_status = 'exporting'
          and import_job.credential_export_session_started_at is not null
          and import_job.credential_export_session_started_at
            <= statement_timestamp() - interval '15 minutes'
          then null
        else import_job.credential_export_session_started_at
      end,
      credential_export_session_started_by_membership_id = case
        when import_job.credential_export_status = 'exporting'
          and import_job.credential_export_session_started_at is not null
          and import_job.credential_export_session_started_at
            <= statement_timestamp() - interval '15 minutes'
          then null
        else import_job.credential_export_session_started_by_membership_id
      end,
      updated_at = statement_timestamp()
  where import_job.id = target_import_job_id;

  delete from public.workforce_import_row_credentials credential_row
  where credential_row.import_job_id = target_import_job_id
    and exists (
      select 1
      from public.workforce_import_jobs import_job
      where import_job.id = target_import_job_id
        and import_job.credential_export_status = 'expired'
    );
end;
$$;

create or replace function public.begin_workforce_import_credential_export(
  target_import_job_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
  session_id uuid := gen_random_uuid();
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);
  perform private.expire_stale_workforce_import_export_sessions(target_import_job_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.credential_export_status not in ('available', 'exporting') then
    raise exception 'credential export is not available'
      using errcode = '55000';
  end if;

  if job_row.credential_expires_at is not null
    and job_row.credential_expires_at <= statement_timestamp() then
    update public.workforce_import_jobs
    set credential_export_status = 'expired',
        updated_at = statement_timestamp()
    where id = target_import_job_id;

    delete from public.workforce_import_row_credentials credential_row
    where credential_row.import_job_id = target_import_job_id;

    raise exception 'credential export has expired'
      using errcode = '55000';
  end if;

  if job_row.credential_export_status = 'exporting'
    and job_row.credential_export_session_id is not null
    and job_row.credential_export_session_started_at
      > statement_timestamp() - interval '15 minutes' then
    return jsonb_build_object(
      'session_id', job_row.credential_export_session_id,
      'expires_at', job_row.credential_export_session_started_at + interval '15 minutes',
      'resumed', true
    );
  end if;

  update public.workforce_import_jobs
  set credential_export_status = 'exporting',
      credential_export_session_id = session_id,
      credential_export_session_started_at = statement_timestamp(),
      credential_export_session_started_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where id = target_import_job_id;

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
    'workforce.import_credentials_export_started',
    'workforce_import_job',
    target_import_job_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('session_id', session_id)
  );

  return jsonb_build_object(
    'session_id', session_id,
    'expires_at', statement_timestamp() + interval '15 minutes',
    'resumed', false
  );
end;
$$;

drop function if exists public.get_workforce_import_credential_export_rows(uuid);

create or replace function public.get_workforce_import_credential_export_rows(
  target_import_job_id uuid,
  target_export_session_id uuid default null
)
returns table (
  import_row_id uuid,
  row_number integer,
  first_name text,
  last_name text,
  username text,
  job_title text,
  primary_unit_path text,
  credential_ciphertext bytea,
  credential_nonce bytea
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  job_row public.workforce_import_jobs%rowtype;
begin
  select import_job.*
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  org_id := job_row.organisation_id;

  perform private.expire_stale_workforce_import_export_sessions(target_import_job_id);

  select import_job.*
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id;

  if job_row.credential_export_status <> 'exporting'
    or job_row.credential_export_session_id is distinct from target_export_session_id then
    raise exception 'credential export session is not active'
      using errcode = '55000';
  end if;

  if job_row.credential_expires_at is not null
    and job_row.credential_expires_at <= statement_timestamp() then
    raise exception 'credential export has expired'
      using errcode = '55000';
  end if;

  return query
  select
    import_row.id,
    import_row.row_number,
    import_row.input_payload ->> 'first_name',
    import_row.input_payload ->> 'last_name',
    import_row.resolved_payload ->> 'username',
    import_row.resolved_payload ->> 'job_title',
    import_row.resolved_payload ->> 'primary_unit_path',
    credential_row.credential_ciphertext,
    credential_row.credential_nonce
  from public.workforce_import_rows import_row
  join public.workforce_import_row_credentials credential_row
    on credential_row.import_row_id = import_row.id
  where import_row.import_job_id = target_import_job_id
    and import_row.organisation_id = org_id
    and import_row.status = 'completed'
  order by import_row.row_number;
end;
$$;

create or replace function public.ack_workforce_import_credentials_exported(
  target_import_job_id uuid,
  target_export_session_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);
  perform private.expire_stale_workforce_import_export_sessions(target_import_job_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.credential_export_status = 'exported'
    and job_row.credential_export_session_id is null then
    return;
  end if;

  if job_row.credential_export_status <> 'exporting'
    or job_row.credential_export_session_id is distinct from target_export_session_id then
    raise exception 'credential export session is not active'
      using errcode = '55000';
  end if;

  delete from public.workforce_import_row_credentials credential_row
  where credential_row.import_job_id = target_import_job_id;

  update public.workforce_import_jobs
  set credential_export_status = 'exported',
      credential_export_session_id = null,
      credential_export_session_started_at = null,
      credential_export_session_started_by_membership_id = null,
      updated_at = statement_timestamp()
  where id = target_import_job_id;

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
    'workforce.import_credentials_exported',
    'workforce_import_job',
    target_import_job_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'row_count', job_row.provisioned_rows,
      'session_id', target_export_session_id
    )
  );
end;
$$;

create or replace function public.mark_workforce_import_credentials_exported(
  target_import_job_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  job_row public.workforce_import_jobs%rowtype;
begin
  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id;

  if job_row.credential_export_session_id is null then
    raise exception 'credential export acknowledgement requires an active session'
      using errcode = '55000';
  end if;

  perform public.ack_workforce_import_credentials_exported(
    target_import_job_id,
    job_row.credential_export_session_id
  );
end;
$$;

create or replace function public.archive_workforce_import_job(
  target_import_job_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  update public.workforce_import_jobs import_job
  set archived_from_recent_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
    and import_job.archived_from_recent_at is null;

  if not found then
    return false;
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
    org_id,
    'workforce.import_archived_from_recent',
    'workforce_import_job',
    target_import_job_id,
    'succeeded',
    gen_random_uuid(),
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function public.get_workforce_import_job_progress(
  target_import_job_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
  remaining_count integer;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);
  perform private.expire_stale_workforce_import_export_sessions(target_import_job_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  select count(*)
  into remaining_count
  from public.workforce_import_rows import_row
  where import_row.import_job_id = target_import_job_id
    and import_row.status in ('valid', 'warning', 'provisioning', 'failed');

  return jsonb_build_object(
    'status', job_row.status,
    'total_rows', job_row.total_rows,
    'valid_rows', job_row.valid_rows,
    'error_rows', job_row.error_rows,
    'warning_rows', job_row.warning_rows,
    'provisioned_rows', job_row.provisioned_rows,
    'failed_rows', job_row.failed_rows,
    'remediation_rows', job_row.remediation_rows,
    'remaining_rows', remaining_count,
    'credential_export_status', job_row.credential_export_status,
    'credential_expires_at', job_row.credential_expires_at,
    'credential_export_session_id', job_row.credential_export_session_id,
    'credential_export_session_started_at', job_row.credential_export_session_started_at,
    'completed_at', job_row.completed_at,
    'archived_from_recent_at', job_row.archived_from_recent_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Workforce credential reset
-- ---------------------------------------------------------------------------

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

  if intent_row.intent_kind = 'credential_reset'
    and intent_row.target_membership_id is not null then
    if exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = intent_row.organisation_id
        and membership_row.id = intent_row.target_membership_id
        and membership_row.user_id = found_user_id
        and membership_row.status = 'active'
    ) then
      return found_user_id;
    end if;

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

create or replace function private.assert_workforce_credential_reset_authorised(
  target_organisation_id uuid,
  actor_membership_id uuid,
  target_membership_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'workforce.credentials.reset',
    null,
    null
  ) then
    raise exception 'workforce credential reset is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = target_organisation_id
      and membership_row.id = target_membership_id
      and membership_row.status = 'active'
  ) then
    raise exception 'membership is not active'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from private.workforce_aliases workforce_alias
    where workforce_alias.organisation_id = target_organisation_id
      and workforce_alias.membership_id = target_membership_id
      and workforce_alias.alias_type = 'username'
      and workforce_alias.status = 'active'
  ) then
    raise exception 'workforce username is not available for reset'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.preauthorize_workforce_credential_reset(
  target_membership_id uuid
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
  membership_row public.organisation_memberships%rowtype;
  alias_row private.workforce_aliases%rowtype;
  auth_email text;
  grant_row record;
  new_intent_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'workforce credential reset is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_workforce_credential_reset_authorised(
    org_id,
    actor_membership_id,
    target_membership_id
  );

  select membership_registry.*
  into membership_row
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = org_id
    and membership_registry.id = target_membership_id;

  select workforce_alias.*
  into alias_row
  from private.workforce_aliases workforce_alias
  where workforce_alias.organisation_id = org_id
    and workforce_alias.membership_id = target_membership_id
    and workforce_alias.alias_type = 'username'
    and workforce_alias.status = 'active';

  select auth_user.email
  into auth_email
  from auth.users auth_user
  where auth_user.id = membership_row.user_id;

  if auth_email is null then
    raise exception 'workforce auth identity is unavailable'
      using errcode = '55000';
  end if;

  select
    grant_row.role_version_id,
    grant_row.scope_type,
    grant_row.scope_unit_id
  into grant_row
  from public.access_grants grant_row
  where grant_row.organisation_id = org_id
    and grant_row.grantee_membership_id = target_membership_id
    and grant_row.status = 'active'
  order by grant_row.created_at
  limit 1;

  if grant_row.role_version_id is null then
    raise exception 'workforce membership has no active access grant'
      using errcode = '55000';
  end if;

  insert into public.workforce_provision_intents (
    organisation_id,
    actor_membership_id,
    intent_kind,
    status,
    target_display_name,
    target_canonical_alias,
    target_alias_type,
    target_membership_id,
    sealed_internal_login_identifier,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    expires_at
  )
  values (
    org_id,
    actor_membership_id,
    'credential_reset',
    'pending',
    coalesce(membership_row.display_name, alias_row.canonical_alias),
    alias_row.canonical_alias,
    'username',
    target_membership_id,
    lower(auth_email),
    grant_row.role_version_id,
    grant_row.scope_type,
    grant_row.scope_unit_id,
    statement_timestamp() + interval '15 minutes'
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
    'workforce.credentials_reset_preauthorized',
    'workforce_provision_intent',
    new_intent_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'membership_id', target_membership_id,
      'canonical_alias', alias_row.canonical_alias
    )
  );

  return new_intent_id;
end;
$$;

create or replace function private.finalize_workforce_credential_reset(
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

  if intent_row.intent_kind <> 'credential_reset' then
    raise exception 'workforce provision intent is not a credential reset'
      using errcode = '55000';
  end if;

  if intent_row.status = 'completed' then
    return intent_row.target_membership_id;
  end if;

  if intent_row.status <> 'auth_created'
    or intent_row.created_auth_user_id is distinct from target_auth_user_id then
    raise exception 'workforce credential reset is not ready to finalise'
      using errcode = '55000';
  end if;

  if intent_row.expires_at <= statement_timestamp() then
    raise exception 'workforce credential reset has expired'
      using errcode = '55000';
  end if;

  update public.workforce_provision_intents
  set status = 'completed',
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
    'workforce.credentials_reset_completed',
    'workforce_provision_intent',
    intent_row.id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'membership_id', intent_row.target_membership_id,
      'canonical_alias', intent_row.target_canonical_alias
    )
  );

  return intent_row.target_membership_id;
end;
$$;

create or replace function public.finalize_workforce_credential_reset(
  target_intent_id uuid,
  target_auth_user_id uuid
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.finalize_workforce_credential_reset(
    target_intent_id,
    target_auth_user_id
  )
$$;

drop function if exists public.get_workforce_provision_intent_for_worker(uuid, uuid);
drop function if exists private.get_workforce_provision_intent_for_worker(uuid, uuid);

create or replace function private.get_workforce_provision_intent_for_worker(
  target_intent_id uuid,
  expected_caller_user_id uuid
)
returns table (
  intent_id uuid,
  organisation_id uuid,
  organisation_code text,
  intent_kind text,
  status text,
  target_canonical_alias text,
  target_display_name text,
  target_membership_id uuid,
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
    intent_row.intent_kind,
    intent_row.status,
    intent_row.target_canonical_alias,
    intent_row.target_display_name,
    intent_row.target_membership_id,
    intent_row.sealed_internal_login_identifier,
    intent_row.created_auth_user_id
  from public.organisations organisation
  where organisation.id = intent_row.organisation_id;
end;
$$;

create or replace function public.get_workforce_provision_intent_for_worker(
  target_intent_id uuid,
  expected_caller_user_id uuid
)
returns table (
  intent_id uuid,
  organisation_id uuid,
  organisation_code text,
  intent_kind text,
  status text,
  target_canonical_alias text,
  target_display_name text,
  target_membership_id uuid,
  sealed_internal_login_identifier text,
  created_auth_user_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from private.get_workforce_provision_intent_for_worker(
    target_intent_id,
    expected_caller_user_id
  )
$$;

-- ---------------------------------------------------------------------------
-- Membership administration profile identity fields
-- ---------------------------------------------------------------------------

create or replace function public.get_membership_administration_profile(
  target_membership_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  resolved_membership public.organisation_memberships%rowtype;
  profile_auth_email text;
  profile_username text;
  profile_notification_email text;
  can_read_admin_identity boolean := false;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'membership administration profile is not authorised'
      using errcode = '42501';
  end if;

  select membership_registry.*
  into resolved_membership
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = org_id
    and membership_registry.id = target_membership_id;

  if not found then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'memberships.read', null, null)
    or (
      target_membership_id = actor_membership_id
      and private.can_read_membership_capability_profile(org_id, target_membership_id)
    )
  ) then
    raise exception 'membership administration profile is not authorised'
      using errcode = '42501';
  end if;

  can_read_admin_identity := private.has_scoped_permission(
    org_id,
    'memberships.read',
    null,
    null
  );

  if can_read_admin_identity then
    select auth_user.email
    into profile_auth_email
    from auth.users auth_user
    where auth_user.id = resolved_membership.user_id;

    select workforce_alias.canonical_alias
    into profile_username
    from private.workforce_aliases workforce_alias
    where workforce_alias.organisation_id = org_id
      and workforce_alias.membership_id = target_membership_id
      and workforce_alias.alias_type = 'username'
      and workforce_alias.status = 'active';

    select contact_row.contact_address
    into profile_notification_email
    from public.membership_notification_contacts contact_row
    where contact_row.organisation_id = org_id
      and contact_row.membership_id = target_membership_id
      and contact_row.channel_type = 'email'
      and contact_row.status = 'active';
  elsif target_membership_id = actor_membership_id then
    select contact_row.contact_address
    into profile_notification_email
    from public.membership_notification_contacts contact_row
    where contact_row.organisation_id = org_id
      and contact_row.membership_id = target_membership_id
      and contact_row.channel_type = 'email'
      and contact_row.status = 'active';
  end if;

  return (
    select jsonb_build_object(
      'membership_id', membership_registry.id,
      'display_name',
        coalesce(membership_registry.display_name, profile_row.display_name),
      'email',
        case
          when profile_username is not null then null
          else profile_auth_email
        end,
      'username', profile_username,
      'notification_email', profile_notification_email,
      'auth_login_email',
        case
          when profile_username is not null
            and profile_auth_email like '%@workforce.invalid'
            then profile_auth_email
          else null
        end,
      'is_workforce_account', profile_username is not null,
      'status', membership_registry.status,
      'status_reason', membership_registry.status_reason,
      'job_title', membership_registry.job_title,
      'primary_organisational_unit',
        case
          when assignment_row.organisational_unit_id is null then null
          else jsonb_build_object(
            'id', unit_row.id,
            'name', unit_row.name,
            'code', unit_row.code
          )
        end,
      'job_function',
        case
          when assignment_row.job_function_id is null then null
          else jsonb_build_object(
            'id', assignment_row.job_function_id,
            'name', assignment_row.job_function_name_snapshot,
            'code', assignment_row.job_function_code_snapshot
          )
        end,
      'access_grants', coalesce(grants_json.grants, '[]'::jsonb),
      'permissions', jsonb_build_object(
        'can_manage_membership',
          private.has_scoped_permission(org_id, 'memberships.manage', null, null),
        'can_manage_job_functions',
          private.can_manage_job_functions(org_id)
          or exists (
            select 1
            from public.organisation_units scoped_unit
            where scoped_unit.organisation_id = org_id
              and scoped_unit.status = 'active'
              and private.has_scoped_permission(
                org_id,
                'job_functions.manage',
                null,
                scoped_unit.id
              )
          ),
        'can_delegate_access',
          private.has_scoped_permission(org_id, 'roles.delegate', null, null)
          or exists (
            select 1
            from public.organisation_units scoped_unit
            where scoped_unit.organisation_id = org_id
              and scoped_unit.status = 'active'
              and private.has_scoped_permission(
                org_id,
                'roles.delegate',
                null,
                scoped_unit.id
              )
          ),
        'can_reset_credentials',
          private.has_scoped_permission(
            org_id,
            'workforce.credentials.reset',
            null,
            null
          ),
        'is_self', target_membership_id = actor_membership_id
      )
    )
    from public.organisation_memberships membership_registry
    left join public.profiles profile_row
      on profile_row.user_id = membership_registry.user_id
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.organisation_id = org_id
     and assignment_row.membership_id = membership_registry.id
     and assignment_row.is_primary = true
     and assignment_row.valid_from <= statement_timestamp()
     and (
       assignment_row.valid_to is null
       or assignment_row.valid_to > statement_timestamp()
     )
    left join public.organisation_units unit_row
      on unit_row.organisation_id = org_id
     and unit_row.id = assignment_row.organisational_unit_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'grant_id', grant_row.id,
          'role_display_name', role_row.display_name,
          'role_canonical_name', role_row.canonical_name,
          'module_responsibility_key', role_row.module_responsibility_key,
          'responsibility_kind', private.role_responsibility_kind(
            role_row.canonical_name,
            role_row.module_responsibility_key,
            role_row.is_owner_role
          ),
          'scope_type', grant_row.scope_type,
          'scope_unit_name', scope_unit.name,
          'scope_unit_path',
            case
              when grant_row.scope_unit_id is null then null
              else private.format_organisation_unit_path_label(grant_row.scope_unit_id)
            end,
          'status', grant_row.status
        )
        order by
          case private.role_responsibility_kind(
            role_row.canonical_name,
            role_row.module_responsibility_key,
            role_row.is_owner_role
          )
            when 'module' then 1
            when 'admin' then 2
            when 'legacy' then 3
            when 'custom' then 4
            else 5
          end,
          role_row.display_name
      ) as grants
      from public.access_grants grant_row
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      left join public.organisation_units scope_unit
        on scope_unit.organisation_id = grant_row.organisation_id
       and scope_unit.id = grant_row.scope_unit_id
      where grant_row.organisation_id = org_id
        and grant_row.grantee_membership_id = membership_registry.id
        and grant_row.status = 'active'
        and (
          private.has_scoped_permission(org_id, 'roles.read', null, null)
          or (
            target_membership_id = actor_membership_id
            and grant_row.grantee_membership_id = actor_membership_id
          )
        )
    ) grants_json on true
    where membership_registry.organisation_id = org_id
      and membership_registry.id = target_membership_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Delegatable access offers with site/path disambiguation
-- ---------------------------------------------------------------------------

create or replace function public.get_delegatable_access_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  result jsonb := '[]'::jsonb;
  role_record record;
  scope_record record;
  scope_options jsonb;
  actor_can_delegate boolean := false;
  actor_has_org_delegate boolean := false;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'delegation offers are not authorised'
      using errcode = '42501';
  end if;

  actor_has_org_delegate := private.membership_has_scoped_permission(
    actor_membership_id,
    org_id,
    'roles.delegate',
    null,
    null
  );

  select
    actor_has_org_delegate
    or exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.status = 'active'
        and private.membership_has_scoped_permission(
          actor_membership_id,
          org_id,
          'roles.delegate',
          null,
          unit_row.id
        )
    )
  into actor_can_delegate;

  if not actor_can_delegate then
    return jsonb_build_object('offers', '[]'::jsonb);
  end if;

  for role_record in
    select distinct on (role_row.id)
      role_version.id as role_version_id,
      role_row.id as role_id,
      role_row.display_name as role_display_name,
      role_row.canonical_name as role_canonical_name,
      role_row.module_responsibility_key,
      role_row.is_owner_role,
      private.role_responsibility_kind(
        role_row.canonical_name,
        role_row.module_responsibility_key,
        role_row.is_owner_role
      ) as responsibility_kind
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = org_id
      and role_version.status = 'published'
      and role_row.status = 'active'
      and (
        not role_row.is_owner_role
        or private.membership_is_effective_owner(
          actor_membership_id,
          org_id
        )
      )
    order by
      role_row.id,
      role_version.version_number desc
  loop
    scope_options := '[]'::jsonb;

    if private.role_grant_scope_allowed(
      org_id,
      role_record.role_id,
      'organisation'
    )
    and private.role_version_is_delegatable_at_scope(
      org_id,
      role_record.role_version_id,
      'organisation',
      null,
      actor_membership_id
    ) and actor_has_org_delegate then
      scope_options := scope_options || jsonb_build_array(
        jsonb_build_object(
          'scope_type', 'organisation',
          'scope_unit_id', null,
          'label', 'Entire organisation'
        )
      );
    end if;

    if private.role_grant_scope_allowed(
      org_id,
      role_record.role_id,
      'unit_subtree'
    ) then
      for scope_record in
        select unit_row.id, unit_row.name, unit_row.code
        from public.organisation_units unit_row
        where unit_row.organisation_id = org_id
          and unit_row.status = 'active'
          and private.membership_has_scoped_permission(
            actor_membership_id,
            org_id,
            'roles.delegate',
            null,
            unit_row.id
          )
          and private.role_version_is_delegatable_at_scope(
            org_id,
            role_record.role_version_id,
            'unit_subtree',
            unit_row.id,
            actor_membership_id
          )
        order by private.format_organisation_unit_path_label(unit_row.id)
      loop
        scope_options := scope_options || jsonb_build_array(
          jsonb_build_object(
            'scope_type', 'unit_subtree',
            'scope_unit_id', scope_record.id,
            'label', private.format_delegatable_scope_label(
              org_id,
              scope_record.id,
              scope_record.name
            ),
            'unit_code', scope_record.code,
            'unit_path', private.format_organisation_unit_path_label(scope_record.id)
          )
        );
      end loop;
    end if;

    if jsonb_array_length(scope_options) > 0 then
      result := result || jsonb_build_array(
        jsonb_build_object(
          'role_version_id', role_record.role_version_id,
          'role_display_name', role_record.role_display_name,
          'role_canonical_name', role_record.role_canonical_name,
          'module_responsibility_key', role_record.module_responsibility_key,
          'responsibility_kind', role_record.responsibility_kind,
          'scope_options', scope_options
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'offers',
    coalesce(
      (
        select jsonb_agg(offer_row order by offer_row ->> 'responsibility_kind', offer_row ->> 'role_display_name')
        from jsonb_array_elements(result) as offer_row
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- People directory: optional inactive visibility for administrators
-- ---------------------------------------------------------------------------

create or replace function public.get_people_directory(
  target_search text default null,
  target_page integer default 1,
  target_page_size integer default 25,
  target_include_inactive boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  offset_value integer;
  can_include_inactive boolean := false;
begin
  if org_id is null
    or not private.can_read_people_directory(org_id) then
    raise exception 'people directory is not authorised'
      using errcode = '42501';
  end if;

  can_include_inactive := target_include_inactive
    and private.has_scoped_permission(org_id, 'memberships.manage', null, null);

  offset_value := greatest(target_page - 1, 0) * target_page_size;

  return jsonb_build_object(
    'people',
      coalesce(
        (
          select jsonb_agg(directory_row.row_data)
          from (
            select jsonb_build_object(
              'membership_id', membership_row.id,
              'display_name',
                coalesce(membership_row.display_name, profile_row.display_name),
              'job_title', membership_row.job_title,
              'job_function_name', assignment_row.job_function_name_snapshot,
              'job_function_code', assignment_row.job_function_code_snapshot,
              'status', membership_row.status
            ) as row_data
            from public.organisation_memberships membership_row
            left join public.profiles profile_row
              on profile_row.user_id = membership_row.user_id
            left join public.membership_job_function_assignments assignment_row
              on assignment_row.organisation_id = org_id
             and assignment_row.membership_id = membership_row.id
             and assignment_row.is_primary = true
             and assignment_row.valid_from <= statement_timestamp()
             and (
               assignment_row.valid_to is null
               or assignment_row.valid_to > statement_timestamp()
             )
            where membership_row.organisation_id = org_id
              and (
                membership_row.status = 'active'
                or can_include_inactive
              )
              and private.can_read_membership_capability_profile(
                org_id,
                membership_row.id
              )
              and (
                target_search is null
                or coalesce(membership_row.display_name, profile_row.display_name, '')
                  ilike '%' || btrim(target_search) || '%'
              )
            order by
              case when membership_row.status = 'active' then 0 else 1 end,
              coalesce(membership_row.display_name, profile_row.display_name)
            limit target_page_size offset offset_value
          ) directory_row
        ),
        '[]'::jsonb
      ),
    'page', target_page,
    'page_size', target_page_size,
    'include_inactive', can_include_inactive
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.begin_workforce_import_credential_export(uuid) to authenticated;
grant execute on function public.ack_workforce_import_credentials_exported(uuid, uuid) to authenticated;
grant execute on function public.archive_workforce_import_job(uuid) to authenticated;
grant execute on function public.preauthorize_workforce_credential_reset(uuid) to authenticated;
grant execute on function public.finalize_workforce_credential_reset(uuid, uuid)
  to lean_hub_private_owner, service_role;

revoke all on function public.begin_workforce_import_credential_export(uuid) from public, anon;
revoke all on function public.ack_workforce_import_credentials_exported(uuid, uuid) from public, anon;
revoke all on function public.archive_workforce_import_job(uuid) from public, anon;
revoke all on function public.preauthorize_workforce_credential_reset(uuid) from public, anon;
revoke all on function public.finalize_workforce_credential_reset(uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.get_workforce_import_credential_export_rows(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_workforce_import_credential_export_rows(uuid, uuid)
  to lean_hub_private_owner, service_role;

alter function private.format_organisation_unit_path_label(uuid) owner to lean_hub_private_owner;
alter function private.format_delegatable_scope_label(uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.expire_stale_workforce_import_export_sessions(uuid) owner to lean_hub_private_owner;
alter function private.assert_workforce_credential_reset_authorised(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.finalize_workforce_credential_reset(uuid, uuid) owner to lean_hub_private_owner;

revoke all on function private.format_organisation_unit_path_label(uuid) from public, anon, authenticated, service_role;
revoke all on function private.format_delegatable_scope_label(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.expire_stale_workforce_import_export_sessions(uuid) from public, anon, authenticated, service_role;
revoke all on function private.assert_workforce_credential_reset_authorised(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.finalize_workforce_credential_reset(uuid, uuid) from public, anon, authenticated, service_role;
