begin;

select plan(4);

select has_function(
  'public',
  'register_organisation_invitation_delivery',
  array['uuid', 'bytea'],
  'register_organisation_invitation_delivery exists'
);

select has_function(
  'public',
  'attest_organisation_invitation_inbox',
  array['bytea', 'bytea'],
  'attest_organisation_invitation_inbox exists'
);

select ok(
  to_regclass('private.organisation_invitation_deliveries') is not null,
  'organisation_invitation_deliveries table exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'organisation_invitations_cancel_deliveries'
  ),
  'cancel deliveries trigger exists'
);

select finish();
rollback;
