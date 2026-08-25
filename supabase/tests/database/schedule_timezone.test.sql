begin;

select plan(4);

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

select * from finish();
rollback;
