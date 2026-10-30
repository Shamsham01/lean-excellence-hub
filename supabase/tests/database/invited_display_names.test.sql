begin;

select plan(36);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'invited-name-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'invited-name-new@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'invited-name-existing@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'invited-name-wrong@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c1000000-0000-0000-0000-000000000005',
    'invited-name-binding@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'c1000000-0000-0000-0000-000000000006',
    'invited-name-preserved@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c2000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000003',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c2000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000004',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c2000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000005',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'c2000000-0000-0000-0000-000000000006',
    'c1000000-0000-0000-0000-000000000006',
    statement_timestamp(), statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'c1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-000000000005',
  'c1000000-0000-0000-0000-000000000006'
);

update public.profiles
set display_name = 'Existing Person'
where user_id = 'c1000000-0000-0000-0000-000000000003';

create temporary table name_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on name_ids to authenticated, anon;

insert into name_ids (key, id)
values
  (
    'organisation_a',
    private.provision_organisation(
      'c1000000-0000-0000-0000-000000000001',
      'invited-name-org-a',
      'Invited Name Org A'
    )
  ),
  (
    'organisation_b',
    private.provision_organisation(
      'c1000000-0000-0000-0000-000000000001',
      'invited-name-org-b',
      'Invited Name Org B'
    )
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"invited-name-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from name_ids where key = 'organisation_a')),
  'owner selects organisation A'
);

insert into name_ids (key, id)
select 'role_version_a', public.create_role_draft(
  (select id from name_ids where key = 'organisation_a'),
  'invited-name-member',
  'Invited Name Member',
  'Delegatable role for invited name tests'
);

select ok(
  public.add_role_permission(
    (select id from name_ids where key = 'organisation_a'),
    (select id from name_ids where key = 'role_version_a'),
    'hierarchy.read'
  ),
  'invited name role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from name_ids where key = 'organisation_a'),
    (select id from name_ids where key = 'role_version_a')
  ),
  'invited name role publishes'
);

insert into name_ids (key, id)
select
  'new_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'invited-name-new@example.test',
    decode(repeat('a1', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from name_ids where key = 'role_version_a'),
    'organisation',
    null,
    'Invited Operator'
  );

select is(
  public.preview_organisation_invitation(decode(repeat('a1', 32), 'hex'))
    ->> 'intended_display_name',
  'Invited Operator',
  'valid invitation preview includes the invited name'
);

select ok(
  public.preview_organisation_invitation(decode(repeat('ff', 32), 'hex'))
    ? 'intended_display_name' = false,
  'invalid invitation preview omits the invited name'
);

insert into name_ids (key, id)
select
  'binding_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'invited-name-binding@example.test',
    decode(repeat('a2', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from name_ids where key = 'role_version_a'),
    'organisation',
    null,
    'Binding Intended'
  );

reset role;

insert into name_ids (key, id)
select
  'binding',
  public.prepare_organisation_invitation_signup_binding(decode(repeat('a2', 32), 'hex'));

select lives_ok(
  $q$
    select public.record_invitation_signup_display_name(
      (select id from name_ids where key = 'binding'),
      '  Binding Confirmed  '
    )
  $q$,
  'signup binding stores the invitee confirmed name'
);

select is(
  (
    select confirmed_display_name
    from public.organisation_invitation_signup_bindings
    where id = (select id from name_ids where key = 'binding')
  ),
  'Binding Confirmed',
  'confirmed signup name is trimmed'
);

select throws_ok(
  $q$
    select public.record_invitation_signup_display_name(
      (select id from name_ids where key = 'binding'),
      '   '
    )
  $q$,
  '22023',
  'display name must be between 1 and 120 characters',
  'blank display name is rejected'
);

select throws_ok(
  $q$
    select public.record_invitation_signup_display_name(
      (select id from name_ids where key = 'binding'),
      repeat('A', 121)
    )
  $q$,
  '22023',
  'display name must be between 1 and 120 characters',
  'overlong display name is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000002","email":"invited-name-new@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $q$
    select public.confirm_invited_display_name(
      decode(repeat('a1', 32), 'hex'),
      'Corrected Operator'
    )
  $q$,
  'matching invitee can correct the invited name'
);

select ok(
  public.accept_organisation_invitation(decode(repeat('a1', 32), 'hex')) is not null,
  'corrected invitation can be accepted'
);

select is(
  (
    select membership.display_name
    from public.organisation_memberships membership
    where membership.user_id = 'c1000000-0000-0000-0000-000000000002'
      and membership.organisation_id = (select id from name_ids where key = 'organisation_a')
  ),
  'Corrected Operator',
  'new membership uses the invitee correction'
);

select is(
  (
    select display_name
    from public.profiles
    where user_id = 'c1000000-0000-0000-0000-000000000002'
  ),
  'Corrected Operator',
  'blank personal profile is initialised from the corrected name'
);

select is(
  public.get_own_membership_profile() ->> 'organisation_display_name',
  'Corrected Operator',
  'own profile reloads the organisation membership name'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000004","email":"invited-name-wrong@example.test"}',
  true
);

select throws_ok(
  $q$
    select public.confirm_invited_display_name(
      decode(repeat('a2', 32), 'hex'),
      'Wrong Person'
    )
  $q$,
  '42501',
  'invitation is unavailable',
  'a different account cannot confirm the invited name'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000005","email":"invited-name-binding@example.test"}',
  true
);

select ok(
  public.accept_organisation_invitation(decode(repeat('a2', 32), 'hex')) is not null,
  'binding invitation can be accepted'
);

select is(
  (
    select membership.display_name
    from public.organisation_memberships membership
    where membership.user_id = 'c1000000-0000-0000-0000-000000000005'
  ),
  'Binding Confirmed',
  'signup confirmation is used when the invitee does not correct it again'
);

select is(
  (
    select display_name
    from public.profiles
    where user_id = 'c1000000-0000-0000-0000-000000000005'
  ),
  'Binding Confirmed',
  'blank personal profile is initialised from the signup confirmation'
);

reset role;

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  display_name,
  status
)
values (
  (select id from name_ids where key = 'organisation_a'),
  'c1000000-0000-0000-0000-000000000006',
  'Already Named',
  'pending'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"invited-name-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from name_ids where key = 'organisation_a')),
  'owner returns to organisation A'
);

insert into name_ids (key, id)
select
  'preserved_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'invited-name-preserved@example.test',
    decode(repeat('a3', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from name_ids where key = 'role_version_a'),
    'organisation',
    null,
    'Replacement Name'
  );

insert into name_ids (key, id)
select
  'existing_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'invited-name-existing@example.test',
    decode(repeat('a4', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from name_ids where key = 'role_version_a'),
    'organisation',
    null,
    'Org A Name'
  );

insert into name_ids (key, id)
select
  'reissue_source',
  public.issue_organisation_member_invitation(
    'email',
    'invited-name-new@example.test',
    decode(repeat('a5', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from name_ids where key = 'role_version_a'),
    'organisation',
    null,
    'Reissue Name'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000002","email":"invited-name-new@example.test"}',
  true
);

select lives_ok(
  $q$
    select public.confirm_invited_display_name(
      decode(repeat('a5', 32), 'hex'),
      'Do Not Copy'
    )
  $q$,
  'invitee can confirm a name on the invitation that will be reissued'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"invited-name-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from name_ids where key = 'organisation_a')),
  'owner selects organisation A before reissue'
);

insert into name_ids (key, id)
select
  'reissue_replacement',
  public.reissue_organisation_member_invitation(
    (select id from name_ids where key = 'reissue_source'),
    decode(repeat('a6', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl()
  );

select is(
  (
    select provisioning.intended_display_name
    from public.organisation_invitation_provisioning provisioning
    where provisioning.invitation_id = (select id from name_ids where key = 'reissue_replacement')
  ),
  'Reissue Name',
  'reissue keeps the invited membership name'
);

select is(
  (
    select provisioning.invitee_confirmed_display_name
    from public.organisation_invitation_provisioning provisioning
    where provisioning.invitation_id = (select id from name_ids where key = 'reissue_replacement')
  ),
  null,
  'reissue does not copy the previous invitee confirmation'
);

select is(
  public.preview_organisation_invitation(decode(repeat('a6', 32), 'hex'))
    ->> 'intended_display_name',
  'Reissue Name',
  'reissued invitation preview still shows the invited name'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000006","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000006","email":"invited-name-preserved@example.test"}',
  true
);

select ok(
  public.accept_organisation_invitation(decode(repeat('a3', 32), 'hex')) is not null,
  'pending membership can accept an invitation'
);

select is(
  (
    select display_name
    from public.organisation_memberships
    where user_id = 'c1000000-0000-0000-0000-000000000006'
  ),
  'Already Named',
  'an existing organisation membership name is preserved'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000003","email":"invited-name-existing@example.test"}',
  true
);

select ok(
  public.accept_organisation_invitation(decode(repeat('a4', 32), 'hex')) is not null,
  'existing account can accept the first organisation invitation'
);

select is(
  (
    select display_name
    from public.profiles
    where user_id = 'c1000000-0000-0000-0000-000000000003'
  ),
  'Existing Person',
  'an existing personal profile name is preserved'
);

select is(
  (
    select display_name
    from public.organisation_memberships
    where user_id = 'c1000000-0000-0000-0000-000000000003'
      and organisation_id = (select id from name_ids where key = 'organisation_a')
  ),
  'Org A Name',
  'first organisation receives its own membership name'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000001","email":"invited-name-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from name_ids where key = 'organisation_b')),
  'owner selects organisation B'
);

insert into name_ids (key, id)
select 'role_version_b', public.create_role_draft(
  (select id from name_ids where key = 'organisation_b'),
  'invited-name-member-b',
  'Invited Name Member B',
  'Delegatable role for the second organisation'
);

select ok(
  public.add_role_permission(
    (select id from name_ids where key = 'organisation_b'),
    (select id from name_ids where key = 'role_version_b'),
    'hierarchy.read'
  ),
  'second organisation role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from name_ids where key = 'organisation_b'),
    (select id from name_ids where key = 'role_version_b')
  ),
  'second organisation role publishes'
);

insert into name_ids (key, id)
select
  'org_b_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'invited-name-existing@example.test',
    decode(repeat('a7', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from name_ids where key = 'role_version_b'),
    'organisation',
    null,
    'Org B Name'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"c2000000-0000-0000-0000-000000000003","email":"invited-name-existing@example.test"}',
  true
);

select ok(
  public.accept_organisation_invitation(decode(repeat('a7', 32), 'hex')) is not null,
  'existing account can join a second organisation'
);

select is(
  (
    select display_name
    from public.organisation_memberships
    where user_id = 'c1000000-0000-0000-0000-000000000003'
      and organisation_id = (select id from name_ids where key = 'organisation_b')
  ),
  'Org B Name',
  'second organisation keeps its own membership name'
);

reset role;

select is(
  (
    select display_name
    from public.organisation_memberships
    where user_id = 'c1000000-0000-0000-0000-000000000003'
      and organisation_id = (select id from name_ids where key = 'organisation_a')
  ),
  'Org A Name',
  'joining another organisation leaves the first membership name in place'
);

select is(
  (
    select display_name
    from public.profiles
    where user_id = 'c1000000-0000-0000-0000-000000000003'
  ),
  'Existing Person',
  'joining another organisation leaves the personal profile name in place'
);

select * from finish();
rollback;
