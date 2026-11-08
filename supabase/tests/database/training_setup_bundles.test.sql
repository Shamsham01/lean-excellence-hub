begin;

select plan(30);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_training_setup_draft(text, jsonb)',
    'execute'
  ),
  'anon cannot execute create_training_setup_draft'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.publish_training_setup_bundle(uuid)',
    'execute'
  ),
  'anon cannot execute publish_training_setup_bundle'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.discard_training_setup_bundle(uuid)',
    'execute'
  ),
  'anon cannot execute discard_training_setup_bundle'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.preview_training_setup_bundle_discard(uuid)',
    'execute'
  ),
  'anon cannot execute preview_training_setup_bundle_discard'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_training_setup_preparation(text, text, jsonb)',
    'execute'
  ),
  'anon cannot execute save_training_setup_preparation'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.create_training_setup_draft(text, jsonb)',
    'execute'
  ),
  'service_role cannot execute create_training_setup_draft'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.publish_training_setup_bundle(uuid)',
    'execute'
  ),
  'service_role cannot execute publish_training_setup_bundle'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.discard_training_setup_bundle(uuid)',
    'execute'
  ),
  'service_role cannot execute discard_training_setup_bundle'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.preview_training_setup_bundle_discard(uuid)',
    'execute'
  ),
  'service_role cannot execute preview_training_setup_bundle_discard'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.save_training_setup_preparation(text, text, jsonb)',
    'execute'
  ),
  'service_role cannot execute save_training_setup_preparation'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.create_training_setup_draft(text, jsonb)',
    'execute'
  ),
  'authenticated cannot execute private.create_training_setup_draft'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.publish_training_setup_bundle(uuid)',
    'execute'
  ),
  'authenticated cannot execute private.publish_training_setup_bundle'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.discard_training_setup_bundle(uuid)',
    'execute'
  ),
  'authenticated cannot execute private.discard_training_setup_bundle'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.preview_training_setup_bundle_discard(uuid)',
    'execute'
  ),
  'authenticated cannot execute private.preview_training_setup_bundle_discard'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.save_training_setup_preparation(text, text, jsonb)',
    'execute'
  ),
  'authenticated cannot execute private.save_training_setup_preparation'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.training_setup_authorised(uuid)',
    'execute'
  ),
  'authenticated cannot execute private.training_setup_authorised'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.training_setup_bundles'::regclass
  ),
  'training_setup_bundles enforces row level security'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.training_setup_bundle_items'::regclass
  ),
  'training_setup_bundle_items enforces row level security'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.training_setup_preparations'::regclass
  ),
  'training_setup_preparations enforces row level security'
);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'c7260000-0000-0000-0000-000000000001',
  'training-setup-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c7260000-0000-0000-0000-000000000002',
  'training-setup-reader@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c7260000-0000-0000-0000-000000000003',
  'training-setup-other@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'c7261000-0000-0000-0000-000000000001',
  'c7260000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'c7261000-0000-0000-0000-000000000002',
  'c7260000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'c7261000-0000-0000-0000-000000000003',
  'c7260000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

create temporary table training_setup_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on training_setup_ids to authenticated;

create function pg_temp.training_setup_definition()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'source', 'manual',
    'title', 'Manual training capability',
    'courses', jsonb_build_array(
      jsonb_build_object(
        'name', 'Lean basic',
        'code', 'lean-basic',
        'category', 'Process',
        'description', 'A starter course.'
      )
    )
  )
$$;

grant execute on function pg_temp.training_setup_definition() to authenticated;

insert into training_setup_ids (key, id)
values
(
  'organisation',
  private.provision_organisation(
    'c7260000-0000-0000-0000-000000000001',
    'training-setup-a',
    'Training Setup A'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'c7260000-0000-0000-0000-000000000003',
    'training-setup-b',
    'Training Setup B'
  )
);

reset role;

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at
)
values (
  (select id from training_setup_ids where key = 'organisation'),
  'c7260000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'c7260000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"c7260000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c7261000-0000-0000-0000-000000000002","email":"training-setup-reader@example.test"}',
  true
);
set local role authenticated;

select public.switch_organisation((select id from training_setup_ids where key = 'organisation'));

select throws_ok(
  $$select public.create_training_setup_draft(
    'c7262000-0000-0000-0000-000000000099',
    pg_temp.training_setup_definition()
  )$$,
  '42501',
  'training setup draft is not authorised',
  'a member without catalogue and curriculum manage cannot create a draft'
);

select throws_ok(
  $$select public.publish_training_setup_bundle('c7262000-0000-0000-0000-000000000088')$$,
  '42501',
  'training setup draft is not authorised',
  'a member without catalogue and curriculum manage cannot publish'
);

select throws_ok(
  $$select public.discard_training_setup_bundle('c7262000-0000-0000-0000-000000000087')$$,
  '42501',
  'training setup draft is not authorised',
  'a member without catalogue and curriculum manage cannot discard'
);

select throws_ok(
  $$select public.save_training_setup_preparation(
    'manual',
  '',
    '{"step":"courses"}'::jsonb
  )$$,
  '42501',
  'training setup draft is not authorised',
  'a member without catalogue and curriculum manage cannot save preparation state'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c7260000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c7261000-0000-0000-0000-000000000001","email":"training-setup-owner@example.test"}',
  true
);
set local role authenticated;

select public.switch_organisation((select id from training_setup_ids where key = 'organisation'));

insert into training_setup_ids (key, id)
select 'bundle', public.create_training_setup_draft(
  'c7262000-0000-0000-0000-000000000001',
  pg_temp.training_setup_definition()
);

select lives_ok(
  $$select public.save_training_setup_preparation(
    'manual',
    '',
    '{"step":"courses"}'::jsonb
  )$$,
  'authorised owner can save setup preparation state'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c7260000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c7261000-0000-0000-0000-000000000003","email":"training-setup-other@example.test"}',
  true
);
set local role authenticated;

select public.switch_organisation((select id from training_setup_ids where key = 'other_organisation'));

select throws_ok(
  $$select public.publish_training_setup_bundle(
    (select id from training_setup_ids where key = 'bundle')
  )$$,
  'P0002',
  'training setup bundle was not found',
  'another organisation cannot publish this bundle'
);

select throws_ok(
  $$select public.discard_training_setup_bundle(
    (select id from training_setup_ids where key = 'bundle')
  )$$,
  'P0002',
  'training setup bundle was not found',
  'another organisation cannot discard this bundle'
);

select throws_ok(
  $$select public.preview_training_setup_bundle_discard(
    (select id from training_setup_ids where key = 'bundle')
  )$$,
  'P0002',
  'training setup bundle was not found',
  'another organisation cannot preview discard for this bundle'
);

select is(
  (select count(*) from public.training_setup_bundles),
  0::bigint,
  'setup bundles are hidden across organisations'
);

select is(
  (select count(*) from public.training_setup_bundle_items),
  0::bigint,
  'setup bundle items are hidden across organisations'
);

select is(
  (select count(*) from public.training_setup_preparations),
  0::bigint,
  'setup preparations are hidden across organisations'
);

select * from finish();

rollback;
