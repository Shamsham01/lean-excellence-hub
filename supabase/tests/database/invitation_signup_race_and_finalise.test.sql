begin;

select plan(17);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '98000000-0000-0000-0000-000000000011',
  'race-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table race_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on race_ids to authenticated, service_role, anon;

insert into race_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '98000000-0000-0000-0000-000000000011',
    'race-org',
    'Race Test Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '98000000-0000-0000-0000-000000000021',
  '98000000-0000-0000-0000-000000000011',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"98000000-0000-0000-0000-000000000011","role":"authenticated","session_id":"98000000-0000-0000-0000-000000000021","email":"race-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from race_ids where key = 'organisation')),
  'owner switches organisation'
);

insert into race_ids (key, id)
select 'role_draft', public.create_role_draft(
  (select id from race_ids where key = 'organisation'),
  'race-member',
  'Race Member',
  'Race tests'
);

select ok(
  public.add_role_permission(
    (select id from race_ids where key = 'organisation'),
    (select id from race_ids where key = 'role_draft'),
    'hierarchy.read'
  ),
  'member role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from race_ids where key = 'organisation'),
    (select id from race_ids where key = 'role_draft')
  ),
  'publish role'
);

insert into race_ids (key, id)
select 'invitation',
  public.issue_organisation_member_invitation(
    'email',
    'race-invitee@example.test',
    decode(repeat('11', 32), 'hex'),
    statement_timestamp() + interval '7 days',
    (select id from race_ids where key = 'role_draft'),
    'organisation',
    null,
    'Race Invitee',
    null,
    null
  );

insert into race_ids (key, id)
select 'delivery_old',
  public.register_organisation_invitation_delivery(
    (select id from race_ids where key = 'invitation'),
    decode(repeat('aa', 32), 'hex')
  );

set local role postgres;

update private.organisation_invitation_deliveries
set status = 'sent', sent_at = statement_timestamp()
where id = (select id from race_ids where key = 'delivery_old');

set local role authenticated;

select ok(
  public.switch_organisation((select id from race_ids where key = 'organisation')),
  'owner re-selects organisation'
);

insert into race_ids (key, id)
select 'delivery_new',
  public.register_organisation_invitation_delivery(
    (select id from race_ids where key = 'invitation'),
    decode(repeat('bb', 32), 'hex')
  );

set local role postgres;

update private.organisation_invitation_deliveries
set status = 'sent', sent_at = statement_timestamp()
where id = (select id from race_ids where key = 'delivery_new');

select ok(
  not public.validate_organisation_invitation_inbox_proof_staging(
    decode(repeat('11', 32), 'hex'),
    decode(repeat('aa', 32), 'hex')
  ),
  'superseded old proof fails staging after resend'
);

select ok(
  public.validate_organisation_invitation_inbox_proof_staging(
    decode(repeat('11', 32), 'hex'),
    decode(repeat('bb', 32), 'hex')
  ),
  'latest proof passes staging'
);

set local role anon;

insert into race_ids (key, id)
select 'binding',
  public.prepare_organisation_invitation_signup_binding(
    decode(repeat('11', 32), 'hex')
  );

select is(
  public.prepare_organisation_invitation_signup_binding(
    decode(repeat('11', 32), 'hex')
  ),
  (select id from race_ids where key = 'binding'),
  'parallel prepare calls reuse the active signup binding'
);

set local role service_role;

select ok(
  public.assert_invitation_inbox_ready_for_signup(
    (select id from race_ids where key = 'binding'),
    decode(repeat('11', 32), 'hex'),
    decode(repeat('bb', 32), 'hex')
  ),
  'inbox ready before redeem'
);

select ok(
  public.authorize_invitation_identity_signup(
    (select id from race_ids where key = 'binding'),
    'race-invitee@example.test',
    decode(repeat('11', 32), 'hex'),
    decode(repeat('bb', 32), 'hex')
  ),
  'authorize with inbox-ready proof before admin create'
);

set local role postgres;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '98000000-0000-0000-0000-000000000088',
  'race-invitee@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

set local role service_role;

select ok(
  public.finalise_invitation_identity_signup(
    (select id from race_ids where key = 'binding'),
    '98000000-0000-0000-0000-000000000088',
    decode(repeat('11', 32), 'hex'),
    decode(repeat('bb', 32), 'hex')
  ),
  'finalise succeeds before inbox proof redeem'
);

select ok(
  not public.assert_invitation_inbox_verified_for_binding(
    (select id from race_ids where key = 'binding')
  ),
  'inbox not marked verified before redeem'
);

select ok(
  public.redeem_organisation_invitation_inbox_proof(
    decode(repeat('11', 32), 'hex'),
    decode(repeat('bb', 32), 'hex'),
    (select id from race_ids where key = 'binding')
  ),
  'redeem follows successful finalise'
);

select ok(
  not public.finalise_invitation_identity_signup(
    (select id from race_ids where key = 'binding'),
    '98000000-0000-0000-0000-000000000088',
    decode(repeat('11', 32), 'hex'),
    decode(repeat('bb', 32), 'hex')
  ),
  'parallel finalise attempt fails after enrolment completes'
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from race_ids where key = 'organisation')),
  'owner ready to revoke'
);

select ok(
  public.revoke_organisation_invitation(
    (select id from race_ids where key = 'organisation'),
    (select id from race_ids where key = 'invitation'),
    'race test revocation'
  ),
  'revoke invitation during signup window'
);

set local role service_role;

select ok(
  not public.authorize_invitation_identity_signup(
    (select id from race_ids where key = 'binding'),
    'race-invitee@example.test',
    decode(repeat('11', 32), 'hex'),
    decode(repeat('bb', 32), 'hex')
  ),
  'authorize fails after revocation'
);

select ok(
  not public.redeem_organisation_invitation_inbox_proof(
    decode(repeat('11', 32), 'hex'),
    decode(repeat('bb', 32), 'hex'),
    (select id from race_ids where key = 'binding')
  ),
  'redeem fails closed after invitation revoked'
);

select finish();
rollback;
