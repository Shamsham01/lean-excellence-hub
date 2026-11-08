-- Training setup bundle RPCs (manual path smoke)

begin;
select plan(6);

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

select tables_are(
  'public',
  array[
    'training_setup_bundles',
    'training_setup_bundle_items',
    'training_setup_preparations'
  ],
  'training setup tables exist'
);

select * from finish();
rollback;
