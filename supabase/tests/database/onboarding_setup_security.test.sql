begin;

select plan(9);

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
    '71000000-0000-0000-0000-000000000001',
    'onboarding-owner@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    'onboarding-subtree@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '71000000-0000-0000-0000-000000000003',
    'onboarding-outsider@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table onboarding_ids (
  key text primary key,
  id uuid not null
) on commit drop;
grant all on onboarding_ids to authenticated;

insert into onboarding_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '71000000-0000-0000-0000-000000000001',
      'onboarding-a',
      'Onboarding A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '71000000-0000-0000-0000-000000000003',
      'onboarding-b',
      'Onboarding B'
    )
  );

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values (
  (select id from onboarding_ids where key = 'org_a'),
  '71000000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
);

insert into private.identity_controls (
  user_id,
  status,
  enrolment_status,
  stewardship_kind,
  enrolment_completed_at
)
values (
  '71000000-0000-0000-0000-000000000002',
  'active',
  'complete',
  'platform',
  statement_timestamp()
)
on conflict (user_id) do update
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp();

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"72000000-0000-0000-0000-000000000001","email":"onboarding-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from onboarding_ids where key = 'org_a')),
  'owner selects onboarding organisation'
);

insert into onboarding_ids (key, id)
select
  'root_unit',
  public.create_organisation_unit(
    (select id from onboarding_ids where key = 'org_a'),
    null,
    'root-site',
    'Root Site',
    'site'
  );

insert into onboarding_ids (key, id)
select
  'hierarchy_role_draft',
  public.create_protected_role_draft(
    (select id from onboarding_ids where key = 'org_a'),
    'subtree-hierarchy-manager',
    'Subtree Hierarchy Manager',
    'Subtree hierarchy manager for onboarding security tests'
  );

select ok(
  public.add_role_permission(
    (select id from onboarding_ids where key = 'org_a'),
    (select id from onboarding_ids where key = 'hierarchy_role_draft'),
    'hierarchy.manage'
  ),
  'hierarchy manager role receives hierarchy.manage'
);

select ok(
  public.publish_role_version(
    (select id from onboarding_ids where key = 'org_a'),
    (select id from onboarding_ids where key = 'hierarchy_role_draft')
  ),
  'hierarchy manager role publishes'
);

insert into onboarding_ids (key, id)
select
  'subtree_grant',
  public.grant_role_version(
    (select id from onboarding_ids where key = 'org_a'),
    (
      select id
      from public.organisation_memberships
      where organisation_id = (select id from onboarding_ids where key = 'org_a')
        and user_id = '71000000-0000-0000-0000-000000000002'
    ),
    (select id from onboarding_ids where key = 'hierarchy_role_draft'),
    'unit_subtree',
    (select id from onboarding_ids where key = 'root_unit')
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"72000000-0000-0000-0000-000000000002","email":"onboarding-subtree@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from onboarding_ids where key = 'org_a')),
  'subtree manager selects onboarding organisation'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, null, %L, %L, %L)',
    (select id from onboarding_ids where key = 'org_a'),
    'rogue-root',
    'Rogue Root',
    'site'
  ),
  '42501',
  null,
  'unit_subtree manager cannot create a root unit'
);

select ok(
  public.create_organisation_unit(
    (select id from onboarding_ids where key = 'org_a'),
    (select id from onboarding_ids where key = 'root_unit'),
    'child-dept',
    'Child Department',
    'department'
  ) is not null,
  'unit_subtree manager can create a child in the managed subtree'
);

select throws_ok(
  $$select public.create_job_function('Blocked', 'blocked')$$,
  '42501',
  null,
  'unauthorised job function mutation is denied'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"72000000-0000-0000-0000-000000000003","email":"onboarding-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from onboarding_ids where key = 'org_b')),
  'outsider selects their own organisation'
);

select is(
  (select count(*)::bigint from public.organisations),
  1::bigint,
  'cross-tenant setup visibility is limited to the selected organisation'
);

select * from finish();
rollback;
