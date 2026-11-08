-- Training setup bundle RPCs (manual path smoke)

begin;
select plan(7);

select has_function(
  'public',
  'create_training_setup_draft',
  array['text', 'jsonb'],
  'create_training_setup_draft exists'
);
select has_function(
  'public',
  'publish_training_setup_bundle',
  array['uuid'],
  'publish_training_setup_bundle exists'
);
select has_function(
  'public',
  'discard_training_setup_bundle',
  array['uuid'],
  'discard_training_setup_bundle exists'
);
select has_function(
  'public',
  'save_training_setup_preparation',
  array['text', 'text', 'jsonb'],
  'save_training_setup_preparation exists'
);

select ok(
  to_regclass('public.training_setup_bundles') is not null,
  'training_setup_bundles exists'
);
select ok(
  to_regclass('public.training_setup_bundle_items') is not null,
  'training_setup_bundle_items exists'
);
select ok(
  to_regclass('public.training_setup_preparations') is not null,
  'training_setup_preparations exists'
);

select * from finish();
rollback;
