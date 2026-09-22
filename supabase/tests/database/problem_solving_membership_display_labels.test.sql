begin;

select plan(12);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'a1700000-0000-0000-0000-000000000001',
  'ps-identity-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1700000-0000-0000-0000-000000000002',
  'ps-identity-facilitator@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'a1700000-0000-0000-0000-000000000003',
  'ps-identity-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table ps_identity_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on ps_identity_ids to authenticated;

insert into ps_identity_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'a1700000-0000-0000-0000-000000000001',
    'ps-identity-org',
    'Problem Solving Identity Organisation'
  )
);

insert into ps_identity_ids (key, id)
select
  'owner_membership',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from ps_identity_ids where key = 'organisation')
  and membership_row.user_id = 'a1700000-0000-0000-0000-000000000001';

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'a1710000-0000-0000-0000-000000000001',
  'a1700000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'a1710000-0000-0000-0000-000000000002',
  'a1700000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'a1710000-0000-0000-0000-000000000003',
  'a1700000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
);

set local role lean_hub_private_owner;

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
select
  (select id from ps_identity_ids where key = 'organisation'),
  'a1700000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp()
where not exists (
  select 1
  from public.organisation_memberships membership_row
  where membership_row.organisation_id = (select id from ps_identity_ids where key = 'organisation')
    and membership_row.user_id = 'a1700000-0000-0000-0000-000000000002'
);

insert into ps_identity_ids (key, id)
select
  'facilitator_membership',
  membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from ps_identity_ids where key = 'organisation')
  and membership_row.user_id = 'a1700000-0000-0000-0000-000000000002';

update public.organisation_memberships
set display_name = null
where id in (
  (select id from ps_identity_ids where key = 'owner_membership'),
  (select id from ps_identity_ids where key = 'facilitator_membership')
);

insert into public.profiles (user_id, display_name)
values
  ('a1700000-0000-0000-0000-000000000001', 'CookieWorks Admin'),
  ('a1700000-0000-0000-0000-000000000002', 'Apex Facilitator')
on conflict (user_id) do update
set display_name = excluded.display_name;

reset role;

select is(
  private.membership_public_display_name(
    (select id from ps_identity_ids where key = 'organisation'),
    (select id from ps_identity_ids where key = 'owner_membership')
  ),
  'CookieWorks Admin',
  'profile display name is used when membership display name is blank'
);

set local role lean_hub_private_owner;

update public.organisation_memberships
set display_name = left((select id from ps_identity_ids where key = 'owner_membership')::text, 8)
where id = (select id from ps_identity_ids where key = 'owner_membership');

reset role;

select is(
  private.membership_public_display_name(
    (select id from ps_identity_ids where key = 'organisation'),
    (select id from ps_identity_ids where key = 'owner_membership')
  ),
  'CookieWorks Admin',
  'opaque membership UUID prefix is rejected and profile name is used'
);

select is(
  private.membership_public_display_name(
    (select id from ps_identity_ids where key = 'organisation'),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  null,
  'unknown membership in the organisation returns null rather than a UUID prefix'
);

insert into ps_identity_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'a1700000-0000-0000-0000-000000000003',
    'ps-identity-org-b',
    'Problem Solving Identity Organisation B'
  )
);

select is(
  private.membership_public_display_name(
    (select id from ps_identity_ids where key = 'organisation_b'),
    (select id from ps_identity_ids where key = 'owner_membership')
  ),
  null,
  'cross-tenant membership lookup stays contained'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.membership_public_display_name(uuid, uuid)',
    'execute'
  ),
  'authenticated cannot execute membership_public_display_name'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'private.membership_public_display_name(uuid, uuid)',
    'execute'
  ),
  'anon cannot execute membership_public_display_name'
);

select ok(
  not pg_catalog.has_function_privilege(
    'service_role',
    'private.membership_public_display_name(uuid, uuid)',
    'execute'
  ),
  'service_role cannot execute membership_public_display_name'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1700000-0000-0000-0000-000000000001","role":"authenticated","session_id":"a1710000-0000-0000-0000-000000000001","email":"ps-identity-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_identity_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into ps_identity_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from ps_identity_ids where key = 'organisation'),
  null,
  'identity-site',
  'Identity Site',
  'site'
);

insert into ps_identity_ids (key, id)
select 'case', public.create_problem_solving_case_draft(
  'Identity label case',
  (select id from ps_identity_ids where key = 'unit_root'),
  'Seal defects after splice'
);

select public.update_problem_solving_case_draft(
  target_case_id := (select id from ps_identity_ids where key = 'case'),
  target_owner_membership_id := (
    select id from ps_identity_ids where key = 'owner_membership'
  ),
  target_facilitator_membership_id := (
    select id from ps_identity_ids where key = 'facilitator_membership'
  )
);

select is(
  public.get_problem_solving_detail(
    (select id from ps_identity_ids where key = 'case')
  ) ->> 'owner_display_name',
  'CookieWorks Admin',
  'authorised detail returns the owner profile display name'
);

select is(
  public.get_problem_solving_detail(
    (select id from ps_identity_ids where key = 'case')
  ) ->> 'facilitator_display_name',
  'Apex Facilitator',
  'authorised detail returns the facilitator profile display name'
);

select ok(
  public.get_problem_solving_detail(
    (select id from ps_identity_ids where key = 'case')
  ) ->> 'owner_display_name'
  !~* '^[0-9a-f]{8}$',
  'detail owner label is not a UUID prefix'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1700000-0000-0000-0000-000000000003","role":"authenticated","session_id":"a1710000-0000-0000-0000-000000000003","email":"ps-identity-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from ps_identity_ids where key = 'organisation_b')),
  'outsider selects other organisation'
);

select throws_ok(
  format(
    'select public.get_problem_solving_detail(%L::uuid)',
    (select id from ps_identity_ids where key = 'case')
  ),
  'problem solving detail is not authorised',
  '42501'
);

select * from finish();
rollback;
