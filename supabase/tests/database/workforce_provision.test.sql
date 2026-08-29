begin;

select plan(35);

create temporary table workforce_test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on workforce_test_ids to anon, authenticated, service_role;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '11000000-0000-0000-0000-000000000001',
    'workforce-admin@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

insert into workforce_test_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '11000000-0000-0000-0000-000000000001',
      'workforce-org',
      'Workforce Org'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '21000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"21000000-0000-0000-0000-000000000001","email":"workforce-admin@example.test"}',
  true
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from workforce_test_ids where key = 'org_a')),
  'admin can switch into workforce test organisation'
);

select ok(
  public.member_has_permission('workforce.provision'),
  'organisation owner has workforce.provision'
);

insert into workforce_test_ids (key, id)
select
  'intent_a',
  public.preauthorize_workforce_provision(
    'Jane Smith',
    'jsmith',
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from workforce_test_ids where key = 'org_a')
        and role_row.canonical_name = 'organisation-administrator'
        and role_version.status = 'published'
      limit 1
    ),
    'organisation'
  );

select ok(
  (select id from workforce_test_ids where key = 'intent_a') is not null,
  'preauthorize creates a sealed workforce provision intent'
);

select is(
  (
    select count(*)
    from public.organisation_memberships membership
    where membership.organisation_id = (select id from workforce_test_ids where key = 'org_a')
      and membership.display_name = 'Jane Smith'
  ),
  0::bigint,
  'preauthorize does not create a membership'
);

reset role;
set local role postgres;

select isnt_empty(
  $q$
    select sealed_internal_login_identifier
    from public.workforce_provision_intents
    where id = (select id from workforce_test_ids where key = 'intent_a')
  $q$,
  'preauthorize seals an internal workforce auth identifier'
);

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '11000000-0000-0000-0000-000000000002',
    (
      select sealed_internal_login_identifier
      from public.workforce_provision_intents
      where id = (select id from workforce_test_ids where key = 'intent_a')
    ),
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'workforce_provision_intent_id',
      (select id::text from workforce_test_ids where key = 'intent_a')
    ),
    false,
    false
  );

select ok(
  public.record_workforce_auth_created(
    (select id from workforce_test_ids where key = 'intent_a'),
    '11000000-0000-0000-0000-000000000002'
  ),
  'record_workforce_auth_created transitions intent to auth_created'
);

select is(
  (
    select status
    from public.workforce_provision_intents
    where id = (select id from workforce_test_ids where key = 'intent_a')
  ),
  'auth_created',
  'intent status is auth_created after auth user creation'
);

select lives_ok(
  $q$
    select public.finalize_workforce_provision(
      (select id from workforce_test_ids where key = 'intent_a'),
      '11000000-0000-0000-0000-000000000002'
    )
  $q$,
  'finalize completes provisioning after auth_created retry path'
);

select is(
  (
    select status
    from public.workforce_provision_intents
    where id = (select id from workforce_test_ids where key = 'intent_a')
  ),
  'completed',
  'intent status is completed after finalisation'
);

select is(
  public.finalize_workforce_provision(
    (select id from workforce_test_ids where key = 'intent_a'),
    '11000000-0000-0000-0000-000000000002'
  ),
  (
    select created_membership_id
    from public.workforce_provision_intents
    where id = (select id from workforce_test_ids where key = 'intent_a')
  ),
  'finalize is idempotent for completed intents'
);

select is(
  (
    select count(*)
    from public.organisation_memberships membership
    where membership.organisation_id = (select id from workforce_test_ids where key = 'org_a')
      and membership.user_id = '11000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'finalize creates exactly one membership'
);

select is(
  (
    select count(*)
    from private.workforce_aliases workforce_alias
    where workforce_alias.organisation_id = (select id from workforce_test_ids where key = 'org_a')
      and workforce_alias.canonical_alias = 'jsmith'
      and workforce_alias.status = 'active'
  ),
  1::bigint,
  'finalize creates exactly one active workforce alias'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"21000000-0000-0000-0000-000000000001","email":"workforce-admin@example.test"}',
  true
);

insert into workforce_test_ids (key, id)
select
  'intent_b',
  public.preauthorize_workforce_provision(
    'Retry Worker',
    'retry-worker',
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from workforce_test_ids where key = 'org_a')
        and role_row.canonical_name = 'organisation-administrator'
        and role_version.status = 'published'
      limit 1
    ),
    'organisation'
  );

select ok(
  (select id from workforce_test_ids where key = 'intent_b') is not null,
  'second preauthorize succeeds for another user'
);

reset role;
set local role postgres;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '11000000-0000-0000-0000-000000000003',
    (
      select sealed_internal_login_identifier
      from public.workforce_provision_intents
      where id = (select id from workforce_test_ids where key = 'intent_b')
    ),
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'workforce_provision_intent_id',
      (select id::text from workforce_test_ids where key = 'intent_b')
    ),
    false,
    false
  );

select ok(
  public.record_workforce_auth_created(
    (select id from workforce_test_ids where key = 'intent_b'),
    '11000000-0000-0000-0000-000000000003'
  ),
  'retry path records auth creation without duplicate auth identities'
);

select lives_ok(
  $q$
    select public.finalize_workforce_provision(
      (select id from workforce_test_ids where key = 'intent_b'),
      '11000000-0000-0000-0000-000000000003'
    )
  $q$,
  'retry path finalizes after simulated auth-create crash window'
);

select is(
  (
    select count(*)
    from auth.users auth_user
    where auth_user.email = (
      select sealed_internal_login_identifier
      from public.workforce_provision_intents
      where id = (select id from workforce_test_ids where key = 'intent_b')
    )
  ),
  1::bigint,
  'retry path does not create a second auth user for the sealed identifier'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"21000000-0000-0000-0000-000000000001","email":"workforce-admin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from workforce_test_ids where key = 'org_a')),
  'admin re-selects organisation for hook tests'
);

insert into workforce_test_ids (key, id)
select
  'intent_hook',
  public.preauthorize_workforce_provision(
    'Hook Allowed',
    'hook-allowed',
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from workforce_test_ids where key = 'org_a')
        and role_row.canonical_name = 'organisation-administrator'
        and role_version.status = 'published'
      limit 1
    ),
    'organisation'
  );

select ok(
  (select id from workforce_test_ids where key = 'intent_hook') is not null,
  'preauthorize pending intent for hook allow test'
);

reset role;
set local role postgres;

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'email', (
          select sealed_internal_login_identifier
          from public.workforce_provision_intents
          where id = (select id from workforce_test_ids where key = 'intent_hook')
        ),
        'user_metadata', jsonb_build_object(
          'workforce_provision_intent_id',
          (select id::text from workforce_test_ids where key = 'intent_hook')
        )
      )
    )
  ) = '{}'::jsonb,
  'signup hook allows privileged workforce provisioning intent'
);

reset role;
set local role postgres;

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'email', (
          select sealed_internal_login_identifier
          from public.workforce_provision_intents
          where id = (select id from workforce_test_ids where key = 'intent_hook')
        ),
        'user_metadata', jsonb_build_object(
          'workforce_provision_intent_id',
          gen_random_uuid()::text
        )
      )
    )
  ) ? 'error',
  'signup hook rejects spoofed workforce intent identifiers'
);

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'email', 'public-signup@example.test'
      )
    )
  ) ? 'error',
  'signup hook still blocks public signup without invitation binding'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"21000000-0000-0000-0000-000000000001","email":"workforce-admin@example.test"}',
  true
);

select throws_ok(
  $q$
    select public.preauthorize_workforce_provision(
      'Duplicate Alias',
      'jsmith',
      (
        select role_version.id
        from public.role_versions role_version
        join public.roles role_row
          on role_row.organisation_id = role_version.organisation_id
         and role_row.id = role_version.role_id
        where role_version.organisation_id = (select id from workforce_test_ids where key = 'org_a')
          and role_row.canonical_name = 'organisation-administrator'
          and role_version.status = 'published'
        limit 1
      ),
      'organisation'
    )
  $q$,
  '23505',
  null,
  'duplicate workforce alias is rejected at preauthorize'
);

select ok(
  not exists (
    select 1
    from public.security_audit_events audit_event
    where audit_event.organisation_id = (select id from workforce_test_ids where key = 'org_a')
      and audit_event.action = 'workforce.provision_preauthorized'
      and (
        audit_event.metadata ? 'temporary_password'
        or audit_event.metadata ? 'password'
      )
  ),
  'preauthorize audit metadata does not persist temporary credentials'
);

reset role;
set local role postgres;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '11000000-0000-0000-0000-000000000099',
    'workforce-other-org@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

insert into workforce_test_ids (key, id)
values
  (
    'org_b',
    private.provision_organisation(
      '11000000-0000-0000-0000-000000000099',
      'workforce-org-b',
      'Workforce Org B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '21000000-0000-0000-0000-000000000099',
    '11000000-0000-0000-0000-000000000099',
    statement_timestamp(),
    statement_timestamp()
  );

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000099","role":"authenticated","session_id":"21000000-0000-0000-0000-000000000099","email":"workforce-other-org@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from workforce_test_ids where key = 'org_b')),
  'other organisation owner can switch context'
);

insert into workforce_test_ids (key, id)
select
  'intent_other_org',
  public.preauthorize_workforce_provision(
    'Other Org Worker',
    'other-org-worker',
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from workforce_test_ids where key = 'org_b')
        and role_row.canonical_name = 'organisation-administrator'
        and role_version.status = 'published'
      limit 1
    ),
    'organisation'
  );

reset role;
set local role postgres;

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'email', (
          select sealed_internal_login_identifier
          from public.workforce_provision_intents
          where id = (select id from workforce_test_ids where key = 'intent_other_org')
        ),
        'user_metadata', jsonb_build_object(
          'workforce_provision_intent_id',
          (select id::text from workforce_test_ids where key = 'intent_a')
        )
      )
    )
  ) ? 'error',
  'signup hook blocks repurposing a sealed identifier with another organisation intent'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"21000000-0000-0000-0000-000000000001","email":"workforce-admin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from workforce_test_ids where key = 'org_a')),
  'admin re-selects organisation before auth lookup tests'
);

insert into workforce_test_ids (key, id)
select
  'intent_find',
  public.preauthorize_workforce_provision(
    'Findable Worker',
    'findable-worker-test01',
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from workforce_test_ids where key = 'org_a')
        and role_row.canonical_name = 'organisation-administrator'
        and role_version.status = 'published'
      limit 1
    ),
    'organisation'
  );

reset role;
set local role postgres;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '11000000-0000-0000-0000-000000000004',
    (
      select sealed_internal_login_identifier
      from public.workforce_provision_intents
      where id = (select id from workforce_test_ids where key = 'intent_find')
    ),
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'workforce_provision_intent_id',
      (select id::text from workforce_test_ids where key = 'intent_find')
    ),
    false,
    false
  );

select is(
  public.find_workforce_auth_user_for_intent(
    (select id from workforce_test_ids where key = 'intent_find')
  ),
  '11000000-0000-0000-0000-000000000004'::uuid,
  'service lookup finds orphaned auth user for pending intent without listUsers'
);

update auth.users
set raw_user_meta_data = jsonb_build_object(
  'workforce_provision_intent_id',
  (select id::text from workforce_test_ids where key = 'intent_a')
)
where id = '11000000-0000-0000-0000-000000000004';

select is(
  public.find_workforce_auth_user_for_intent(
    (select id from workforce_test_ids where key = 'intent_find')
  ),
  null,
  'service lookup rejects mismatched workforce_provision_intent_id metadata'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"21000000-0000-0000-0000-000000000001","email":"workforce-admin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from workforce_test_ids where key = 'org_a')),
  'admin re-selects organisation before transient finalisation tests'
);

insert into workforce_test_ids (key, id)
select
  'intent_transient',
  public.preauthorize_workforce_provision(
    'Transient Finalise',
    'transient-finalise-test01',
    (
      select role_version.id
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = (select id from workforce_test_ids where key = 'org_a')
        and role_row.canonical_name = 'organisation-administrator'
        and role_version.status = 'published'
      limit 1
    ),
    'organisation'
  );

reset role;
set local role postgres;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '11000000-0000-0000-0000-000000000005',
    (
      select sealed_internal_login_identifier
      from public.workforce_provision_intents
      where id = (select id from workforce_test_ids where key = 'intent_transient')
    ),
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'workforce_provision_intent_id',
      (select id::text from workforce_test_ids where key = 'intent_transient')
    ),
    false,
    false
  );

select ok(
  public.record_workforce_auth_created(
    (select id from workforce_test_ids where key = 'intent_transient'),
    '11000000-0000-0000-0000-000000000005'
  ),
  'transient finalisation test records auth_created state'
);

select throws_ok(
  $q$
    select public.finalize_workforce_provision(
      (select id from workforce_test_ids where key = 'intent_transient'),
      '11000000-0000-0000-0000-000000000099'
    )
  $q$,
  '55000',
  null,
  'failed finalisation leaves auth_created intent retryable'
);

select is(
  (
    select status
    from public.workforce_provision_intents
    where id = (select id from workforce_test_ids where key = 'intent_transient')
  ),
  'auth_created',
  'auth_created intent survives transient finalisation failure'
);

select ok(
  not public.fail_workforce_provision(
    (select id from workforce_test_ids where key = 'intent_transient'),
    'transient finalisation failed'
  ),
  'fail_workforce_provision does not mutate auth_created intents'
);

select lives_ok(
  $q$
    select public.finalize_workforce_provision(
      (select id from workforce_test_ids where key = 'intent_transient'),
      '11000000-0000-0000-0000-000000000005'
    )
  $q$,
  'auth_created retry finalises after transient failure'
);

select is(
  (
    select count(*)
    from public.organisation_memberships membership
    where membership.organisation_id = (select id from workforce_test_ids where key = 'org_a')
      and membership.user_id = '11000000-0000-0000-0000-000000000005'
  ),
  1::bigint,
  'transient finalisation retry creates exactly one membership'
);

select * from finish();
rollback;
