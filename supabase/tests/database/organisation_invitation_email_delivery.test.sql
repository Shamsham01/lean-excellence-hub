begin;

select plan(20);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '97000000-0000-0000-0000-000000000011',
  'delivery-security-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table delivery_security_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on delivery_security_ids to authenticated, service_role, anon;

insert into delivery_security_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '97000000-0000-0000-0000-000000000011',
    'delivery-security-org',
    'Delivery Security Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '97000000-0000-0000-0000-000000000021',
  '97000000-0000-0000-0000-000000000011',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000011","role":"authenticated","session_id":"97000000-0000-0000-0000-000000000021","email":"delivery-security-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from delivery_security_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into delivery_security_ids (key, id)
select 'member_role_draft', public.create_role_draft(
  (select id from delivery_security_ids where key = 'organisation'),
  'delivery-member',
  'Delivery Member',
  'Delegatable member for delivery security tests'
);

select ok(
  public.add_role_permission(
    (select id from delivery_security_ids where key = 'organisation'),
    (select id from delivery_security_ids where key = 'member_role_draft'),
    'hierarchy.read'
  ),
  'member role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from delivery_security_ids where key = 'organisation'),
    (select id from delivery_security_ids where key = 'member_role_draft')
  ),
  'member role publishes'
);

insert into delivery_security_ids (key, id)
select
  'invitation',
  public.issue_organisation_member_invitation(
    'email',
    'delivery-invitee@example.test',
    decode(repeat('aa', 32), 'hex'),
    statement_timestamp() + interval '7 days',
    (select id from delivery_security_ids where key = 'member_role_draft'),
    'organisation',
    null,
    'Delivery Invitee',
    null,
    null
  );

set local role anon;

select throws_ok(
  $$
    select public.register_organisation_invitation_delivery(
      (select id from delivery_security_ids where key = 'invitation'),
      decode(repeat('bb', 32), 'hex')
    )
  $$,
  '42501',
  null,
  'anon cannot register delivery'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000011","role":"authenticated","session_id":"97000000-0000-0000-0000-000000000021","email":"delivery-security-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from delivery_security_ids where key = 'organisation')),
  'owner re-selects organisation'
);

insert into delivery_security_ids (key, id)
select 'delivery',
  public.register_organisation_invitation_delivery(
    (select id from delivery_security_ids where key = 'invitation'),
    decode(repeat('cc', 32), 'hex')
  );

set local role postgres;

update private.organisation_invitation_deliveries
set status = 'sent',
    sent_at = statement_timestamp()
where id = (select id from delivery_security_ids where key = 'delivery');

select ok(
  not public.attest_organisation_invitation_inbox(
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('cc', 32), 'hex')
  ),
  'attest always rejects'
);

select ok(
  public.validate_organisation_invitation_inbox_proof_staging(
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('cc', 32), 'hex')
  ),
  'staging validation accepts sent proof'
);

select ok(
  not public.validate_organisation_invitation_inbox_proof_staging(
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('dd', 32), 'hex')
  ),
  'staging rejects wrong proof digest'
);

set local role authenticated;

select throws_ok(
  $$
    select public.redeem_organisation_invitation_inbox_proof(
      decode(repeat('aa', 32), 'hex'),
      decode(repeat('cc', 32), 'hex'),
      gen_random_uuid()
    )
  $$,
  '42501',
  null,
  'authenticated cannot redeem inbox proof'
);

set local role anon;

select isnt_empty(
  $$
    select public.prepare_organisation_invitation_signup_binding(
      decode(repeat('aa', 32), 'hex')
    )
  $$,
  'prepare signup binding'
);

insert into delivery_security_ids (key, id)
select 'binding',
  public.prepare_organisation_invitation_signup_binding(
    decode(repeat('aa', 32), 'hex')
  );

set local role service_role;

select ok(
  public.authorize_invitation_identity_signup(
    (select id from delivery_security_ids where key = 'binding'),
    'delivery-invitee@example.test',
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('cc', 32), 'hex')
  ),
  'authorize requires inbox-ready digests before redeem'
);

select ok(
  not public.authorize_invitation_identity_signup(
    (select id from delivery_security_ids where key = 'binding'),
    'delivery-invitee@example.test',
    null,
    null
  ),
  'authorize rejects null digests'
);

select ok(
  public.redeem_organisation_invitation_inbox_proof(
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('cc', 32), 'hex'),
    (select id from delivery_security_ids where key = 'binding')
  ),
  'service redeem consumes proof for binding'
);

select ok(
  public.assert_invitation_inbox_verified_for_binding(
    (select id from delivery_security_ids where key = 'binding')
  ),
  'assert requires binding-scoped redeem'
);

select ok(
  not public.redeem_organisation_invitation_inbox_proof(
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('cc', 32), 'hex'),
    gen_random_uuid()
  ),
  'proof replay denied'
);

select ok(
  not public.authorize_invitation_identity_signup(
    (select id from delivery_security_ids where key = 'binding'),
    'delivery-invitee@example.test',
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('cc', 32), 'hex')
  ),
  'authorize rejects inbox-ready path after proof redeemed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000011","role":"authenticated","session_id":"97000000-0000-0000-0000-000000000021","email":"delivery-security-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from delivery_security_ids where key = 'organisation')),
  'owner re-selects organisation'
);

select lives_ok(
  $$
    select public.register_organisation_invitation_delivery(
      (select id from delivery_security_ids where key = 'invitation'),
      decode(repeat('ee', 32), 'hex')
    )
  $$,
  'resend registers another delivery row'
);

set local role postgres;

select ok(
  (
    select count(distinct delivery.delivery_key) = 2
    from private.organisation_invitation_deliveries delivery
    where delivery.invitation_id = (select id from delivery_security_ids where key = 'invitation')
  ),
  'delivery keys stay unique per send'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.begin_organisation_invitation_delivery_send(uuid)',
    'execute'
  ),
  'authenticated cannot begin delivery send'
);

select finish();
rollback;
