create table private.authentication_rate_limit_locks (
  purpose text not null,
  dimension text not null,
  key_hash bytea not null,
  failure_window_started_at timestamptz not null,
  failure_count integer not null default 0,
  in_flight_count integer not null default 0,
  blocked_until timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (purpose, dimension, key_hash),
  constraint authentication_rate_limit_locks_purpose_check
    check (purpose in ('workforce_login', 'password_recovery', 'invitation')),
  constraint authentication_rate_limit_locks_dimension_check
    check (
      dimension in (
        'ip',
        'organisation_code',
        'alias',
        'account',
        'recipient'
      )
    ),
  constraint authentication_rate_limit_locks_hash_check
    check (octet_length(key_hash) = 32),
  constraint authentication_rate_limit_locks_failure_count_check
    check (failure_count between 0 and 1000000),
  constraint authentication_rate_limit_locks_in_flight_count_check
    check (in_flight_count between 0 and 1000000)
);

create index authentication_rate_limit_locks_blocked_until_idx
  on private.authentication_rate_limit_locks (blocked_until)
  where blocked_until is not null;

create trigger authentication_rate_limit_locks_touch_updated_at
before update on private.authentication_rate_limit_locks
for each row execute function private.touch_updated_at();

alter table private.authentication_rate_limit_locks enable row level security;
alter table private.authentication_rate_limit_locks force row level security;
alter table private.authentication_rate_limit_locks owner to lean_hub_private_owner;

create policy private_owner_all
on private.authentication_rate_limit_locks
for all
to lean_hub_private_owner
using (true)
with check (true);

grant select, insert, update, delete
on private.authentication_rate_limit_locks
to lean_hub_private_owner;
revoke all on private.authentication_rate_limit_locks
from public, anon, authenticated, service_role;

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
  lock_row private.authentication_rate_limit_locks%rowtype;
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

  perform pg_advisory_xact_lock(
    hashtextextended(
      limiter_purpose || ':' || limiter_dimension || ':' ||
        encode(limiter_key_hash, 'hex'),
      0
    )
  );

  window_start := to_timestamp(
    floor(extract(epoch from attempt_time) / window_seconds) * window_seconds
  );

  insert into private.authentication_rate_limit_locks (
    purpose,
    dimension,
    key_hash,
    failure_window_started_at
  )
  values (
    limiter_purpose,
    limiter_dimension,
    limiter_key_hash,
    window_start
  )
  on conflict (purpose, dimension, key_hash) do nothing;

  select limiter_lock.*
  into lock_row
  from private.authentication_rate_limit_locks limiter_lock
  where limiter_lock.purpose = limiter_purpose
    and limiter_lock.dimension = limiter_dimension
    and limiter_lock.key_hash = limiter_key_hash
  for update;

  if lock_row.blocked_until is not null
    and lock_row.blocked_until > attempt_time then
    return false;
  end if;

  if lock_row.failure_window_started_at <> window_start then
    update private.authentication_rate_limit_locks limiter_lock
    set failure_window_started_at = window_start,
        failure_count = 0,
        blocked_until = null
    where limiter_lock.purpose = limiter_purpose
      and limiter_lock.dimension = limiter_dimension
      and limiter_lock.key_hash = limiter_key_hash;
    lock_row.failure_count := 0;
  elsif lock_row.blocked_until is not null then
    update private.authentication_rate_limit_locks limiter_lock
    set blocked_until = null
    where limiter_lock.purpose = limiter_purpose
      and limiter_lock.dimension = limiter_dimension
      and limiter_lock.key_hash = limiter_key_hash;
  end if;

  if lock_row.failure_count >= maximum_attempts
    or lock_row.in_flight_count >= maximum_attempts then
    return false;
  end if;

  update private.authentication_rate_limit_locks limiter_lock
  set in_flight_count = limiter_lock.in_flight_count + 1
  where limiter_lock.purpose = limiter_purpose
    and limiter_lock.dimension = limiter_dimension
    and limiter_lock.key_hash = limiter_key_hash;

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
        last_attempt_at = attempt_time;

  return true;
end;
$$;

create or replace function private.record_authentication_rate_limit_failure(
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
  updated_failure_count integer;
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
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      limiter_purpose || ':' || limiter_dimension || ':' ||
        encode(limiter_key_hash, 'hex'),
      0
    )
  );

  window_start := to_timestamp(
    floor(extract(epoch from attempt_time) / window_seconds) * window_seconds
  );

  update private.authentication_rate_limit_locks limiter_lock
  set failure_window_started_at = window_start,
      failure_count = case
        when limiter_lock.failure_window_started_at = window_start
          then limiter_lock.failure_count + 1
        else 1
      end,
      in_flight_count = greatest(limiter_lock.in_flight_count - 1, 0),
      blocked_until = case
        when (
          case
            when limiter_lock.failure_window_started_at = window_start
              then limiter_lock.failure_count + 1
            else 1
          end
        ) >= maximum_attempts
          then greatest(
            coalesce(limiter_lock.blocked_until, '-infinity'::timestamptz),
            attempt_time + make_interval(secs => block_seconds)
          )
        else case
          when limiter_lock.blocked_until > attempt_time
            then limiter_lock.blocked_until
          else null
        end
      end
  where limiter_lock.purpose = limiter_purpose
    and limiter_lock.dimension = limiter_dimension
    and limiter_lock.key_hash = limiter_key_hash
  returning failure_count into updated_failure_count;

  return updated_failure_count is not null;
end;
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
  affected_rows integer;
begin
  if maximum_attempts not between 1 and 1000
    or window_seconds not between 10 and 86400 then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      limiter_purpose || ':' || limiter_dimension || ':' ||
        encode(limiter_key_hash, 'hex'),
      0
    )
  );

  update private.authentication_rate_limit_locks limiter_lock
  set in_flight_count = greatest(limiter_lock.in_flight_count - 1, 0)
  where limiter_lock.purpose = limiter_purpose
    and limiter_lock.dimension = limiter_dimension
    and limiter_lock.key_hash = limiter_key_hash
    and limiter_lock.in_flight_count > 0;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
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
  select not exists (
    select 1
    from private.authentication_rate_limit_locks limiter_lock
    where limiter_lock.purpose = limiter_purpose
      and limiter_lock.dimension = limiter_dimension
      and limiter_lock.key_hash = limiter_key_hash
      and (
        limiter_lock.blocked_until > statement_timestamp()
        or (
          limiter_lock.failure_window_started_at = to_timestamp(
            floor(
              extract(epoch from statement_timestamp()) / window_seconds
            ) * window_seconds
          )
          and (
            limiter_lock.failure_count >= maximum_attempts
            or limiter_lock.in_flight_count >= maximum_attempts
          )
        )
      )
  )
$$;

create or replace function public.record_authentication_rate_limit_failure(
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
  select private.record_authentication_rate_limit_failure(
    limiter_purpose,
    limiter_dimension,
    limiter_key_hash,
    maximum_attempts,
    window_seconds,
    block_seconds
  )
$$;

alter function private.consume_authentication_rate_limit(
  text,
  text,
  bytea,
  integer,
  integer,
  integer
) owner to lean_hub_private_owner;
alter function private.record_authentication_rate_limit_failure(
  text,
  text,
  bytea,
  integer,
  integer,
  integer
) owner to lean_hub_private_owner;
alter function private.release_authentication_rate_limit(
  text,
  text,
  bytea,
  integer,
  integer
) owner to lean_hub_private_owner;
alter function private.authentication_rate_limit_allows(
  text,
  text,
  bytea,
  integer,
  integer
) owner to lean_hub_private_owner;

revoke all on function private.record_authentication_rate_limit_failure(
  text,
  text,
  bytea,
  integer,
  integer,
  integer
) from public, anon, authenticated, service_role;
grant execute on function private.record_authentication_rate_limit_failure(
  text,
  text,
  bytea,
  integer,
  integer,
  integer
) to service_role;
grant execute on function public.record_authentication_rate_limit_failure(
  text,
  text,
  bytea,
  integer,
  integer,
  integer
) to service_role;
revoke all on function public.record_authentication_rate_limit_failure(
  text,
  text,
  bytea,
  integer,
  integer,
  integer
) from public, anon, authenticated;
