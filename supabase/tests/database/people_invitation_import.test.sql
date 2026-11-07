begin;

select plan(11);

create temporary table people_inv_import_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on people_inv_import_ids to anon, authenticated, service_role, lean_hub_private_owner;

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
    '14000000-0000-0000-0000-000000000001',
    'colleague-import-owner@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '14000000-0000-0000-0000-000000000002',
    'colleague-import-outsider@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

insert into people_inv_import_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '14000000-0000-0000-0000-000000000001',
      'colleague-import-a',
      'Colleague Import A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '14000000-0000-0000-0000-000000000001',
      'colleague-import-b',
      'Colleague Import B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '24000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '24000000-0000-0000-0000-000000000002',
    '14000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"24000000-0000-0000-0000-000000000001","email":"colleague-import-owner@example.test"}',
  true
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from people_inv_import_ids where key = 'org_a')),
  'owner can switch into organisation A'
);

select ok(
  public.member_has_permission('invitations.manage'),
  'owner has invitations.manage'
);

select ok(
  public.member_has_permission('roles.delegate'),
  'owner has roles.delegate'
);

insert into people_inv_import_ids (key, id)
select
  'job_a',
  public.create_people_invitation_import_job('people.csv', 'fingerprint-a');

select ok(
  (select id is not null from people_inv_import_ids where key = 'job_a'),
  'owner can create people invitation import job'
);

select public.submit_people_invitation_import_rows(
  (select id from people_inv_import_ids where key = 'job_a'),
  jsonb_build_array(
    jsonb_build_object(
      'record_type', 'person',
      'display_name', 'Taylor Import',
      'email', 'taylor.import@example.test',
      'department', 'Operator',
      'site', 'Production',
      'role', 'Team Member',
      'access_scope_site', 'Production'
    )
  )
);

select lives_ok(
  format(
    'select public.validate_people_invitation_import_job(%L::uuid)',
    (select id from people_inv_import_ids where key = 'job_a')
  ),
  'validation runs for organisation A job'
);

select is(
  (
    select count(*)
    from public.people_invitation_import_jobs job_row
    where job_row.organisation_id = (select id from people_inv_import_ids where key = 'org_a')
  ),
  1::bigint,
  'organisation A has exactly one import job visible through RLS-backed select'
);

set local role lean_hub_private_owner;

insert into public.organisation_memberships (organisation_id, user_id, status, activated_at)
values
  (
    (select id from people_inv_import_ids where key = 'org_b'),
    '14000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  );

set local role lean_hub_private_owner;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = '14000000-0000-0000-0000-000000000002';

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"14000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"24000000-0000-0000-0000-000000000002","email":"colleague-import-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from people_inv_import_ids where key = 'org_b')),
  'outsider switches to organisation B'
);

select throws_ok(
  format(
    'select public.create_people_invitation_import_job(%L, %L)',
    'intrusion.csv',
    'fingerprint-b'
  ),
  '42501',
  'people invitation import is not authorised',
  'outsider without invitation permissions cannot create import job'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"24000000-0000-0000-0000-000000000001","email":"colleague-import-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from people_inv_import_ids where key = 'org_a')),
  'owner returns to organisation A'
);

select is(
  (
    select count(*)
    from public.people_invitation_import_jobs job_row
    where job_row.id = (select id from people_inv_import_ids where key = 'job_a')
  ),
  1::bigint,
  'owner still reads organisation A import job'
);

select is(
  (
    select count(*)
    from public.people_invitation_import_jobs job_row
    where job_row.organisation_id = (select id from people_inv_import_ids where key = 'org_b')
  ),
  0::bigint,
  'organisation A actor cannot read organisation B import jobs'
);

select * from finish();
rollback;
