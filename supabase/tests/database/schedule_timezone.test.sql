begin;

select plan(6);

select is(
  public.derive_schedule_occurrence_status(
    'open',
    (current_date + 7),
    'UTC',
    statement_timestamp()
  ),
  'scheduled',
  'future local date is scheduled'
);

select is(
  public.derive_schedule_occurrence_status(
    'open',
    current_date,
    'UTC',
    statement_timestamp()
  ),
  'due',
  'today local date is due'
);

select is(
  public.derive_schedule_occurrence_status(
    'completed',
    current_date,
    'UTC'
  ),
  'completed',
  'completed lifecycle maps to completed'
);

select is(
  public.derive_schedule_occurrence_status(
    'open',
    (current_date - 3),
    'UTC',
    statement_timestamp()
  ),
  'missed',
  'past local day is missed'
);

select is(
  timezone('UTC', private.schedule_local_to_timestamptz(
    '2026-03-28'::date,
    '09:00:00'::time,
    false,
    'Europe/London'
  )),
  '2026-03-28 09:00:00'::timestamp,
  'Europe/London winter local time converts to GMT'
);

select is(
  timezone('UTC', private.schedule_local_to_timestamptz(
    '2026-03-30'::date,
    '09:00:00'::time,
    false,
    'Europe/London'
  )),
  '2026-03-30 08:00:00'::timestamp,
  'Europe/London summer local time converts to BST (UTC+1)'
);

select * from finish();
rollback;
