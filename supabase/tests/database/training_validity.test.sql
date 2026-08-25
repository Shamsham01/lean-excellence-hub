begin;

select plan(5);

select is(
  private.derive_training_validity_days(365, 180),
  365,
  'requirement override wins over course version default'
);

select is(
  private.derive_training_validity_days(null, 180),
  180,
  'course version default applies when no override'
);

select is(
  private.derive_training_validity_days(null, null),
  null,
  'no expiry when neither override nor course default'
);

select is(
  private.derive_training_completion_validity_state(
    'completed',
    statement_timestamp() + interval '10 days'
  ),
  'expiring',
  'derived expiring within window'
);

select is(
  private.derive_training_completion_validity_state(
    'completed',
    statement_timestamp() - interval '1 day'
  ),
  'expired',
  'derived expired does not use persisted lifecycle status'
);

select * from finish();
rollback;
