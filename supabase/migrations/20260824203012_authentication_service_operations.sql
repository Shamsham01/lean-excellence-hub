create or replace function private.consume_authentication_rate_limit(
  limiter_purpose text,
  limiter_dimension text,
  limiter_key_hash bytea,
  maximum_attempts integer,
  window_seconds integer,
  block_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  attempt_time timestamptz := statement_timestamp();
  window_start timestamptz;
  limiter_row private.authentication_rate_limits%rowtype;
begin
  if limiter_purpose not in (
    'workforce_login',
    'password_recovery',
    'invitation'
  )
    or limiter_dimension not in (
      'ip',
      'organisation_code',
      'alias',
      'account',
      'recipient'
    )
    or octet_length(limiter_key_hash) <> 32
    or maximum_attempts not between 1 and 1000
    or window_seconds not between 10 and 86400
    or block_seconds not between 10 and 86400 then
    raise exception 'invalid authentication rate-limit parameters'
      using errcode = '22023';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from attempt_time) / window_seconds) * window_seconds
  );

  insert into private.authentication_rate_limits (
    purpose,
    dimension,
    key_hash,
    window_started_at,
    window_ends_at,
    attempt_count,
    last_attempt_at
  )
  values (
    limiter_purpose,
    limiter_dimension,
    limiter_key_hash,
    window_start,
    window_start + make_interval(secs => window_seconds),
    1,
    attempt_time
  )
  on conflict (purpose, dimension, key_hash, window_started_at)
  do update
    set attempt_count =
          private.authentication_rate_limits.attempt_count + 1,
        last_attempt_at = attempt_time,
        blocked_until = case
          when private.authentication_rate_limits.attempt_count + 1 >
            maximum_attempts
            then case
              when private.authentication_rate_limits.blocked_until >
                attempt_time
                then private.authentication_rate_limits.blocked_until
              else attempt_time + make_interval(secs => block_seconds)
            end
          else private.authentication_rate_limits.blocked_until
        end
  returning * into limiter_row;

  return limiter_row.attempt_count <= maximum_attempts
    and (
      limiter_row.blocked_until is null
      or limiter_row.blocked_until <= attempt_time
    );
end;
$$;

create or replace function private.authentication_rate_limit_allows(
  limiter_purpose text,
  limiter_dimension text,
  limiter_key_hash bytea,
  maximum_attempts integer,
  window_seconds integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when limiter_purpose not in (
      'workforce_login',
      'password_recovery',
      'invitation'
    )
      or limiter_dimension not in (
        'ip',
        'organisation_code',
        'alias',
        'account',
        'recipient'
      )
      or octet_length(limiter_key_hash) <> 32
      or maximum_attempts not between 1 and 1000
      or window_seconds not between 10 and 86400
      then false
    else not exists (
      select 1
      from private.authentication_rate_limits limiter
      where limiter.purpose = limiter_purpose
        and limiter.dimension = limiter_dimension
        and limiter.key_hash = limiter_key_hash
        and limiter.window_started_at = to_timestamp(
          floor(extract(epoch from statement_timestamp()) / window_seconds)
            * window_seconds
        )
        and (
          limiter.attempt_count >= maximum_attempts
          or limiter.blocked_until > statement_timestamp()
        )
    )
  end
$$;

create or replace function private.release_authentication_rate_limit(
  limiter_purpose text,
  limiter_dimension text,
  limiter_key_hash bytea,
  maximum_attempts integer,
  window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  attempt_time timestamptz := statement_timestamp();
  affected_rows integer;
begin
  if maximum_attempts not between 1 and 1000
    or window_seconds not between 10 and 86400 then
    return false;
  end if;

  update private.authentication_rate_limits limiter
  set attempt_count = greatest(limiter.attempt_count - 1, 0),
      blocked_until = case
        when greatest(limiter.attempt_count - 1, 0) <= maximum_attempts
          then null
        else limiter.blocked_until
      end
  where limiter.purpose = limiter_purpose
    and limiter.dimension = limiter_dimension
    and limiter.key_hash = limiter_key_hash
    and limiter.window_started_at = to_timestamp(
      floor(extract(epoch from attempt_time) / window_seconds) * window_seconds
    )
    and limiter.attempt_count > 0;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create or replace function private.resolve_workforce_login(
  organisation_code text,
  workforce_alias text
)
returns table (
  organisation_id uuid,
  membership_id uuid,
  user_id uuid,
  workforce_account_id uuid,
  internal_login_identifier text,
  password_change_required boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    organisation.id,
    membership.id,
    membership.user_id,
    workforce_account.id,
    workforce_account.internal_login_identifier,
    identity_control.enrolment_status = 'password_change_required'
  from public.organisations organisation
  join public.organisation_memberships membership
    on membership.organisation_id = organisation.id
   and membership.status = 'active'
  join private.workforce_aliases alias
    on alias.organisation_id = membership.organisation_id
   and alias.membership_id = membership.id
   and alias.user_id = membership.user_id
   and alias.status = 'active'
  join private.workforce_accounts workforce_account
    on workforce_account.id = alias.workforce_account_id
   and workforce_account.user_id = membership.user_id
   and workforce_account.status = 'active'
  join private.identity_controls identity_control
    on identity_control.user_id = membership.user_id
   and identity_control.status = 'active'
   and identity_control.enrolment_status in (
     'password_change_required',
     'complete'
   )
  where organisation.code = organisation_code
    and organisation.status = 'active'
    and alias.canonical_alias = workforce_alias
  limit 1
$$;

create or replace function private.provision_workforce_identity(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_user_id uuid,
  target_internal_login_identifier text,
  target_alias_type text,
  target_canonical_alias text
)
returns table (
  workforce_account_id uuid,
  internal_login_identifier text,
  reused_existing_account boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account_id uuid;
  account_identifier text;
  account_reused boolean := false;
  membership_count integer;
begin
  if not exists (
    select 1
    from public.organisation_memberships membership
    where membership.organisation_id = target_organisation_id
      and membership.id = target_membership_id
      and membership.user_id = target_user_id
      and membership.status in ('pending', 'active')
  ) then
    raise exception 'membership and global Auth user do not match'
      using errcode = '23514';
  end if;

  select account.id, account.internal_login_identifier
  into account_id, account_identifier
  from private.workforce_accounts account
  where account.user_id = target_user_id
  for update;

  if account_id is null then
    if target_internal_login_identifier is null then
      raise exception 'a new workforce account requires an internal identifier'
        using errcode = '23502';
    end if;

    insert into private.workforce_accounts (
      user_id,
      internal_login_identifier,
      status
    )
    values (
      target_user_id,
      target_internal_login_identifier,
      'active'
    )
    returning id, private.workforce_accounts.internal_login_identifier
      into account_id, account_identifier;
  else
    account_reused := true;
    if target_internal_login_identifier is not null
      and target_internal_login_identifier <> account_identifier then
      raise exception 'existing global workforce account must be reused'
        using errcode = '23514';
    end if;
  end if;

  insert into private.workforce_aliases (
    organisation_id,
    membership_id,
    user_id,
    workforce_account_id,
    alias_type,
    canonical_alias,
    status
  )
  values (
    target_organisation_id,
    target_membership_id,
    target_user_id,
    account_id,
    target_alias_type,
    target_canonical_alias,
    'active'
  );

  select count(distinct membership.organisation_id)
  into membership_count
  from public.organisation_memberships membership
  where membership.user_id = target_user_id
    and membership.status in ('pending', 'active');

  update private.identity_controls
  set status = 'active',
      enrolment_status = case
        when account_reused then enrolment_status
        else 'password_change_required'
      end,
      enrolment_completed_at = case
        when account_reused then enrolment_completed_at
        else null
      end,
      stewardship_kind = case when membership_count = 1
        then 'organisation' else 'platform' end,
      stewardship_organisation_id = case when membership_count = 1
        then target_organisation_id else null end,
      status_changed_at = statement_timestamp()
  where user_id = target_user_id
    and status <> 'disabled';

  if not found then
    raise exception 'identity cannot be provisioned'
      using errcode = '42501';
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
    'workforce.identity_provisioned',
    'workforce_account',
    account_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('reused_existing_account', account_reused)
  );

  return query select account_id, account_identifier, account_reused;
end;
$$;

create or replace function private.finalise_identity_enrolment(
  target_user_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  finalised boolean;
begin
  if not private.auth_user_exists(target_user_id) then
    return false;
  end if;

  update private.identity_controls
  set status = 'active',
      enrolment_status = 'complete',
      enrolment_completed_at = coalesce(
        enrolment_completed_at,
        statement_timestamp()
      ),
      last_password_change_at = statement_timestamp(),
      last_security_event_at = statement_timestamp(),
      status_changed_at = statement_timestamp()
  where user_id = target_user_id
    and status in ('provisioning', 'active')
    and enrolment_status in (
      'pending',
      'password_change_required',
      'complete'
    );

  finalised := found;
  if not finalised then
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
  select distinct
    membership.organisation_id,
    'authentication.password_changed',
    'identity',
    target_user_id,
    'succeeded',
    gen_random_uuid(),
    '{}'::jsonb
  from public.organisation_memberships membership
  where membership.user_id = target_user_id;

  if not found then
    insert into public.security_audit_events (
      action,
      target_type,
      target_id,
      outcome,
      request_correlation_id,
      metadata
    )
    values (
      'authentication.password_changed',
      'identity',
      target_user_id,
      'succeeded',
      gen_random_uuid(),
      '{}'::jsonb
    );
  end if;

  return true;
end;
$$;

create or replace function private.disable_workforce_identity(
  target_user_id uuid,
  change_reason text
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_account_id uuid;
  removed_sessions integer;
begin
  if change_reason is null
    or change_reason <> btrim(change_reason)
    or char_length(change_reason) not between 1 and 1000 then
    raise exception 'a bounded disablement reason is required'
      using errcode = '22023';
  end if;

  select account.id
  into target_account_id
  from private.workforce_accounts account
  where account.user_id = target_user_id
    and account.status = 'active'
  for update;

  if target_account_id is null then
    raise exception 'active workforce account does not exist'
      using errcode = '23503';
  end if;

  update private.workforce_accounts
  set status = 'disabled',
      status_changed_at = statement_timestamp(),
      status_reason = change_reason
  where id = target_account_id;

  update private.identity_controls
  set status = 'disabled',
      status_changed_at = statement_timestamp(),
      status_reason = change_reason,
      last_security_event_at = statement_timestamp()
  where user_id = target_user_id;

  removed_sessions := private.auth_revoke_user_sessions(target_user_id);

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  select distinct
    membership.organisation_id,
    'workforce.identity_disabled',
    'workforce_account',
    target_account_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('revoked_session_count', removed_sessions)
  from public.organisation_memberships membership
  where membership.user_id = target_user_id;

  return removed_sessions;
end;
$$;

create or replace function private.revoke_identity_sessions(
  target_user_id uuid,
  change_reason text
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
  if change_reason is null
    or change_reason <> btrim(change_reason)
    or char_length(change_reason) not between 1 and 1000 then
    raise exception 'a bounded session-revocation reason is required'
      using errcode = '22023';
  end if;

  removed_sessions := private.auth_revoke_user_sessions(target_user_id);

  update private.identity_controls
  set last_security_event_at = statement_timestamp()
  where user_id = target_user_id;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  select distinct
    membership.organisation_id,
    'session.user_sessions_revoked',
    'identity',
    target_user_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('revoked_session_count', removed_sessions)
  from public.organisation_memberships membership
  where membership.user_id = target_user_id;

  return removed_sessions;
end;
$$;

create or replace function private.current_identity_state()
returns table (
  identity_status text,
  enrolment_status text,
  password_change_required boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    identity_control.status,
    identity_control.enrolment_status,
    identity_control.enrolment_status = 'password_change_required'
  from private.identity_controls identity_control
  where private.current_session_id() is not null
    and identity_control.user_id = private.auth_uid()
$$;

create or replace function private.current_workforce_login_identifier()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select workforce_account.internal_login_identifier
  from private.workforce_accounts workforce_account
  where private.current_session_id() is not null
    and workforce_account.user_id = private.auth_uid()
    and workforce_account.status = 'active'
$$;

create or replace function public.consume_authentication_rate_limit(
  limiter_purpose text,
  limiter_dimension text,
  limiter_key_hash bytea,
  maximum_attempts integer,
  window_seconds integer,
  block_seconds integer
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.consume_authentication_rate_limit(
    limiter_purpose,
    limiter_dimension,
    limiter_key_hash,
    maximum_attempts,
    window_seconds,
    block_seconds
  )
$$;

create or replace function public.authentication_rate_limit_allows(
  limiter_purpose text,
  limiter_dimension text,
  limiter_key_hash bytea,
  maximum_attempts integer,
  window_seconds integer
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.authentication_rate_limit_allows(
    limiter_purpose,
    limiter_dimension,
    limiter_key_hash,
    maximum_attempts,
    window_seconds
  )
$$;

create or replace function public.release_authentication_rate_limit(
  limiter_purpose text,
  limiter_dimension text,
  limiter_key_hash bytea,
  maximum_attempts integer,
  window_seconds integer
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.release_authentication_rate_limit(
    limiter_purpose,
    limiter_dimension,
    limiter_key_hash,
    maximum_attempts,
    window_seconds
  )
$$;

create or replace function public.resolve_workforce_login(
  organisation_code text,
  workforce_alias text
)
returns table (
  organisation_id uuid,
  membership_id uuid,
  user_id uuid,
  workforce_account_id uuid,
  internal_login_identifier text,
  password_change_required boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.resolve_workforce_login(organisation_code, workforce_alias)
$$;

create or replace function public.provision_workforce_identity(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_user_id uuid,
  target_internal_login_identifier text,
  target_alias_type text,
  target_canonical_alias text
)
returns table (
  workforce_account_id uuid,
  internal_login_identifier text,
  reused_existing_account boolean
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.provision_workforce_identity(
    target_organisation_id,
    target_membership_id,
    target_user_id,
    target_internal_login_identifier,
    target_alias_type,
    target_canonical_alias
  )
$$;

create or replace function public.finalise_identity_enrolment(
  target_user_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.finalise_identity_enrolment(target_user_id)
$$;

create or replace function public.disable_workforce_identity(
  target_user_id uuid,
  change_reason text
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.disable_workforce_identity(target_user_id, change_reason)
$$;

create or replace function public.revoke_identity_sessions(
  target_user_id uuid,
  change_reason text
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.revoke_identity_sessions(target_user_id, change_reason)
$$;

create or replace function public.current_identity_state()
returns table (
  identity_status text,
  enrolment_status text,
  password_change_required boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.current_identity_state()
$$;

create or replace function public.current_workforce_login_identifier()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_workforce_login_identifier()
$$;

do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'private.consume_authentication_rate_limit(text,text,bytea,integer,integer,integer)'::regprocedure,
    'private.authentication_rate_limit_allows(text,text,bytea,integer,integer)'::regprocedure,
    'private.release_authentication_rate_limit(text,text,bytea,integer,integer)'::regprocedure,
    'private.resolve_workforce_login(text,text)'::regprocedure,
    'private.provision_workforce_identity(uuid,uuid,uuid,text,text,text)'::regprocedure,
    'private.finalise_identity_enrolment(uuid)'::regprocedure,
    'private.disable_workforce_identity(uuid,text)'::regprocedure,
    'private.revoke_identity_sessions(uuid,text)'::regprocedure,
    'private.current_identity_state()'::regprocedure,
    'private.current_workforce_login_identifier()'::regprocedure
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

grant usage on schema private to service_role;
grant execute on function private.consume_authentication_rate_limit(
  text,
  text,
  bytea,
  integer,
  integer,
  integer
) to service_role;
grant execute on function private.authentication_rate_limit_allows(
  text,
  text,
  bytea,
  integer,
  integer
) to service_role;
grant execute on function private.release_authentication_rate_limit(
  text,
  text,
  bytea,
  integer,
  integer
) to service_role;
grant execute on function private.resolve_workforce_login(text, text)
  to service_role;
grant execute on function private.provision_workforce_identity(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;
grant execute on function private.finalise_identity_enrolment(uuid)
  to service_role;
grant execute on function private.disable_workforce_identity(uuid, text)
  to service_role;
grant execute on function private.revoke_identity_sessions(uuid, text)
  to service_role;

grant execute on function public.consume_authentication_rate_limit(
  text,
  text,
  bytea,
  integer,
  integer,
  integer
) to service_role;
grant execute on function public.authentication_rate_limit_allows(
  text,
  text,
  bytea,
  integer,
  integer
) to service_role;
grant execute on function public.release_authentication_rate_limit(
  text,
  text,
  bytea,
  integer,
  integer
) to service_role;
grant execute on function public.resolve_workforce_login(text, text)
  to service_role;
grant execute on function public.provision_workforce_identity(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;
grant execute on function public.finalise_identity_enrolment(uuid)
  to service_role;
grant execute on function public.disable_workforce_identity(uuid, text)
  to service_role;
grant execute on function public.revoke_identity_sessions(uuid, text)
  to service_role;

grant execute on function private.current_identity_state()
  to authenticated;
grant execute on function private.current_workforce_login_identifier()
  to authenticated;
grant execute on function public.current_identity_state()
  to authenticated;
grant execute on function public.current_workforce_login_identifier()
  to authenticated;
