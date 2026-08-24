begin;

select plan(13);

set local role service_role;

select ok(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'alias',
    decode(repeat('a1', 32), 'hex'),
    1,
    300,
    900
  ),
  'an alias can reserve its first authentication attempt'
);

select ok(
  public.record_authentication_rate_limit_failure(
    'workforce_login',
    'alias',
    decode(repeat('a1', 32), 'hex'),
    1,
    300,
    900
  ),
  'a failed reserved attempt is recorded atomically'
);

reset role;

select cmp_ok(
  (
    select blocked_until
    from private.authentication_rate_limit_locks
    where purpose = 'workforce_login'
      and dimension = 'alias'
      and key_hash = decode(repeat('a1', 32), 'hex')
  ),
  '>',
  statement_timestamp(),
  'the failure creates persistent blocked-until state'
);

update private.authentication_rate_limit_locks
set failure_window_started_at = failure_window_started_at - interval '5 minutes'
where purpose = 'workforce_login'
  and dimension = 'alias'
  and key_hash = decode(repeat('a1', 32), 'hex');

update private.authentication_rate_limits
set window_started_at = window_started_at - interval '5 minutes',
    window_ends_at = window_ends_at - interval '5 minutes'
where purpose = 'workforce_login'
  and dimension = 'alias'
  and key_hash = decode(repeat('a1', 32), 'hex');

set local role service_role;

select is(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'alias',
    decode(repeat('a1', 32), 'hex'),
    1,
    300,
    900
  ),
  false,
  'an active lock survives counting-bucket rollover'
);

select ok(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'alias',
    decode(repeat('a2', 32), 'hex'),
    1,
    300,
    900
  ),
  'another alias in the same organisation remains available'
);

select ok(
  public.release_authentication_rate_limit(
    'workforce_login',
    'alias',
    decode(repeat('a2', 32), 'hex'),
    1,
    300
  ),
  'the unrelated alias reservation can be released'
);

select ok(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'ip',
    decode(repeat('b1', 32), 'hex'),
    1,
    300,
    900
  ),
  'one source can reserve its first authentication attempt'
);

select ok(
  public.record_authentication_rate_limit_failure(
    'workforce_login',
    'ip',
    decode(repeat('b1', 32), 'hex'),
    1,
    300,
    900
  ),
  'the abusive source failure is recorded'
);

select is(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'ip',
    decode(repeat('b1', 32), 'hex'),
    1,
    300,
    900
  ),
  false,
  'the abusive source is blocked'
);

select ok(
  public.consume_authentication_rate_limit(
    'workforce_login',
    'ip',
    decode(repeat('b2', 32), 'hex'),
    1,
    300,
    900
  ),
  'a different source remains available'
);

select ok(
  public.release_authentication_rate_limit(
    'workforce_login',
    'ip',
    decode(repeat('b2', 32), 'hex'),
    1,
    300
  ),
  'the unrelated source reservation can be released'
);

reset role;

select is(
  (
    select count(*)
    from private.authentication_rate_limit_locks
    where purpose = 'workforce_login'
      and dimension = 'organisation_code'
  ),
  0::bigint,
  'organisation codes are not a hard lockout boundary'
);

select is(
  (
    select count(*)
    from private.authentication_rate_limits
    where purpose = 'workforce_login'
      and dimension = 'alias'
      and key_hash = decode(repeat('a1', 32), 'hex')
      and window_started_at > statement_timestamp() - interval '5 minutes'
  ),
  0::bigint,
  'a blocked rollover attempt does not create a new counting bucket'
);

reset role;

select * from finish();
rollback;
