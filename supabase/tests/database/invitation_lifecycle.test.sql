begin;

select plan(34);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '95000000-0000-0000-0000-000000000001',
    'lifecycle-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    'lifecycle-invitee@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000003',
    'Lifecycle.Invitee@Example.TEST',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000004',
    'lifecycle-wrong@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000005',
    'lifecycle-orgb-invitee@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000006',
    'expired-invitee@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000009',
    'duplicate-invitee@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table lifecycle_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on lifecycle_ids to authenticated, anon;

insert into lifecycle_ids (key, id)
values (
  'organisation_a',
  private.provision_organisation(
    '95000000-0000-0000-0000-000000000001',
    'lifecycle-org-a',
    'Lifecycle Org A'
  )
);

insert into lifecycle_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    '95000000-0000-0000-0000-000000000001',
    'lifecycle-org-b',
    'Lifecycle Org B'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '96000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '95000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '96000000-0000-0000-0000-000000000003',
    '95000000-0000-0000-0000-000000000003',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '96000000-0000-0000-0000-000000000004',
    '95000000-0000-0000-0000-000000000004',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '96000000-0000-0000-0000-000000000005',
    '95000000-0000-0000-0000-000000000005',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '96000000-0000-0000-0000-000000000006',
    '95000000-0000-0000-0000-000000000006',
    statement_timestamp(), statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '95000000-0000-0000-0000-000000000002',
  '95000000-0000-0000-0000-000000000003',
  '95000000-0000-0000-0000-000000000004',
  '95000000-0000-0000-0000-000000000005',
  '95000000-0000-0000-0000-000000000006'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000001","email":"lifecycle-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from lifecycle_ids where key = 'organisation_a')),
  'owner selects organisation A'
);

insert into lifecycle_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from lifecycle_ids where key = 'organisation_a'),
  null,
  'lifecycle-root',
  'Lifecycle Root',
  'site'
);

insert into lifecycle_ids (key, id)
select 'job_function', public.create_job_function('Lifecycle Operator', 'lifecycle-operator');

insert into lifecycle_ids (key, id)
select 'member_role_draft', public.create_role_draft(
  (select id from lifecycle_ids where key = 'organisation_a'),
  'lifecycle-member',
  'Lifecycle Member',
  'Delegatable member role for lifecycle invitation tests'
);

select ok(
  public.add_role_permission(
    (select id from lifecycle_ids where key = 'organisation_a'),
    (select id from lifecycle_ids where key = 'member_role_draft'),
    'hierarchy.read'
  ),
  'lifecycle member role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from lifecycle_ids where key = 'organisation_a'),
    (select id from lifecycle_ids where key = 'member_role_draft')
  ),
  'lifecycle member role publishes'
);

insert into lifecycle_ids (key, id)
select 'member_role_version', id
from lifecycle_ids
where key = 'member_role_draft';

insert into lifecycle_ids (key, id)
select
  'invitation',
  public.issue_organisation_member_invitation(
    'email',
    'lifecycle-invitee@example.test',
    decode(repeat('aa', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from lifecycle_ids where key = 'member_role_version'),
    'organisation',
    null,
    'Lifecycle Invitee',
    (select id from lifecycle_ids where key = 'job_function'),
    (select id from lifecycle_ids where key = 'root_unit')
  );

select is(
  public.preview_organisation_invitation(decode(repeat('aa', 32), 'hex')) ->> 'state',
  'valid',
  'preview returns valid state for pending invitation'
);

select ok(
  (public.preview_organisation_invitation(decode(repeat('aa', 32), 'hex')) ->> 'organisation_name')
    = 'Lifecycle Org A',
  'preview exposes organisation name only for valid token'
);

select is(
  public.preview_organisation_invitation(decode(repeat('ff', 32), 'hex')) ->> 'state',
  'invalid',
  'invalid token reveals no tenant data'
);

select ok(
  public.preview_organisation_invitation(decode(repeat('ff', 32), 'hex')) ? 'organisation_name' = false,
  'invalid token preview omits organisation name'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000002","email":"lifecycle-invitee@example.test"}',
  true
);

select ok(
  public.accept_organisation_invitation(decode(repeat('aa', 32), 'hex')) is not null,
  'valid recipient can accept invitation'
);

select throws_ok(
  $q$ select public.accept_organisation_invitation(decode(repeat('aa', 32), 'hex')) $q$,
  '42501',
  'invitation is unavailable',
  'consumed invitation cannot be accepted twice'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000001","email":"lifecycle-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from lifecycle_ids where key = 'organisation_a')),
  'owner re-selects organisation A before case invitation'
);

insert into lifecycle_ids (key, id)
select
  'case_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'lifecycle.invitee@example.test',
    decode(repeat('bb', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from lifecycle_ids where key = 'member_role_version'),
    'organisation',
    null
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000004","email":"lifecycle-wrong@example.test"}',
  true
);

select throws_ok(
  $q$ select public.accept_organisation_invitation(decode(repeat('bb', 32), 'hex')) $q$,
  '42501',
  'invitation recipient does not match',
  'incorrect email cannot accept invitation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000003","email":"Lifecycle.Invitee@Example.TEST"}',
  true
);

select ok(
  public.accept_organisation_invitation(decode(repeat('bb', 32), 'hex')) is not null,
  'email matching is canonical and case-safe'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000001","email":"lifecycle-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from lifecycle_ids where key = 'organisation_a')),
  'owner re-selects organisation A'
);

insert into lifecycle_ids (key, id)
select
  'expired_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'expired-invitee@example.test',
    decode(repeat('cc', 32), 'hex'),
    statement_timestamp() + interval '1 second',
    (select id from lifecycle_ids where key = 'member_role_version'),
    'organisation',
    null
  );

select pg_sleep(1.1);

select is(
  public.preview_organisation_invitation(decode(repeat('cc', 32), 'hex')) ->> 'state',
  'expired',
  'expired invitation preview is expired'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000006","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000006","email":"expired-invitee@example.test"}',
  true
);

select throws_ok(
  $q$ select public.accept_organisation_invitation(decode(repeat('cc', 32), 'hex')) $q$,
  '42501',
  'invitation is unavailable',
  'expired invitation cannot be accepted'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000001","email":"lifecycle-owner@example.test"}',
  true
);

insert into lifecycle_ids (key, id)
select
  'revoked_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'revoked-invitee@example.test',
    decode(repeat('dd', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from lifecycle_ids where key = 'member_role_version'),
    'organisation',
    null
  );

select ok(
  public.revoke_organisation_invitation(
    (select id from lifecycle_ids where key = 'organisation_a'),
    (select id from lifecycle_ids where key = 'revoked_invitation'),
    'Revoked for lifecycle test'
  ),
  'owner can revoke pending invitation'
);

select is(
  public.preview_organisation_invitation(decode(repeat('dd', 32), 'hex')) ->> 'state',
  'revoked',
  'revoked invitation preview is revoked'
);

insert into lifecycle_ids (key, id)
select
  'reissue_source',
  public.issue_organisation_member_invitation(
    'email',
    'reissue-invitee@example.test',
    decode(repeat('ee', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from lifecycle_ids where key = 'member_role_version'),
    'organisation',
    null,
    'Reissue Display',
    (select id from lifecycle_ids where key = 'job_function'),
    (select id from lifecycle_ids where key = 'root_unit')
  );

insert into lifecycle_ids (key, id)
select
  'reissue_replacement',
  public.reissue_organisation_member_invitation(
    (select id from lifecycle_ids where key = 'reissue_source'),
    decode(repeat('ef', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl()
  );

select is(
  (
    select status
    from public.organisation_invitations
    where id = (select id from lifecycle_ids where key = 'reissue_source')
  ),
  'revoked',
  'reissued invitation invalidates old token'
);

select is(
  public.preview_organisation_invitation(decode(repeat('ee', 32), 'hex')) ->> 'state',
  'revoked',
  'old token fails safely after reissue'
);

select is(
  public.preview_organisation_invitation(decode(repeat('ef', 32), 'hex')) ->> 'state',
  'valid',
  'reissued invitation token is valid'
);

select ok(
  exists (
    select 1
    from public.organisation_invitation_provisioning provisioning
    where provisioning.invitation_id = (
      select id from lifecycle_ids where key = 'reissue_replacement'
    )
      and provisioning.intended_display_name = 'Reissue Display'
      and provisioning.intended_job_function_id = (
        select id from lifecycle_ids where key = 'job_function'
      )
  ),
  'reissued invitation preserves provisioning intent'
);

insert into lifecycle_ids (key, id)
select
  'duplicate_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'duplicate-invitee@example.test',
    decode(repeat('11', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from lifecycle_ids where key = 'member_role_version'),
    'organisation',
    null
  );

select throws_ok(
  $q$
    select public.issue_organisation_member_invitation(
      'email',
      'duplicate-invitee@example.test',
      decode(repeat('33', 32), 'hex'),
      statement_timestamp() + private.invitation_default_ttl(),
      (select id from lifecycle_ids where key = 'member_role_version'),
      'organisation',
      null
    )
  $q$,
  '23505',
  null,
  'duplicate active invitation is rejected'
);

reset role;
set local role postgres;

insert into lifecycle_ids (key, id)
select
  'duplicate_signup_binding',
  public.prepare_organisation_invitation_signup_binding(
    decode(repeat('11', 32), 'hex')
  );

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'id', '95000000-0000-0000-0000-000000000009',
        'email', 'duplicate-invitee@example.test',
        'user_metadata', jsonb_build_object(
          'invitation_signup_binding',
          (select id::text from lifecycle_ids where key = 'duplicate_signup_binding')
        )
      )
    )
  ) = '{}'::jsonb,
  'signup hook allows exact invitation binding for recipient'
);

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'email', 'duplicate-invitee@example.test'
      )
    )
  ) ? 'error',
  'signup hook rejects email-only signup without binding proof'
);

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'id', '95000000-0000-0000-0000-000000000004',
        'email', 'orphan@example.test',
        'user_metadata', jsonb_build_object(
          'invitation_signup_binding',
          (select id::text from lifecycle_ids where key = 'duplicate_signup_binding')
        )
      )
    )
  ) ? 'error',
  'signup hook rejects binding proof for a different recipient email'
);

select ok(
  public.hook_require_invitation_for_signup(
    jsonb_build_object(
      'user', jsonb_build_object(
        'email', 'orphan@example.test'
      )
    )
  ) ? 'error',
  'signup hook rejects email without pending invitation'
);

select ok(
  (
    public.resolve_organisation_invitation_signup_binding(
      (select id from lifecycle_ids where key = 'duplicate_signup_binding')
    ) ->> 'state'
  ) = 'invalid',
  'unauthenticated binding resolution stays invalid'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000009","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000009","email":"duplicate-invitee@example.test"}',
  true
);

select ok(
  (
    public.resolve_organisation_invitation_signup_binding(
      (select id from lifecycle_ids where key = 'duplicate_signup_binding')
    ) ->> 'session_state'
  ) = 'ready_to_accept',
  'authenticated recipient resolves signup binding to ready_to_accept'
);

reset role;
set local role postgres;
select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000001","email":"lifecycle-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from lifecycle_ids where key = 'organisation_b')),
  'owner selects organisation B'
);

insert into lifecycle_ids (key, id)
select 'org_b_role_draft', public.create_role_draft(
  (select id from lifecycle_ids where key = 'organisation_b'),
  'lifecycle-orgb-member',
  'Lifecycle Org B Member',
  'Delegatable member role for organisation B lifecycle tests'
);

select ok(
  public.add_role_permission(
    (select id from lifecycle_ids where key = 'organisation_b'),
    (select id from lifecycle_ids where key = 'org_b_role_draft'),
    'hierarchy.read'
  ),
  'organisation B member role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from lifecycle_ids where key = 'organisation_b'),
    (select id from lifecycle_ids where key = 'org_b_role_draft')
  ),
  'organisation B member role publishes'
);

insert into lifecycle_ids (key, id)
select 'org_b_role_version', id
from lifecycle_ids
where key = 'org_b_role_draft';

insert into lifecycle_ids (key, id)
select
  'org_b_invitation',
  public.issue_organisation_member_invitation(
    'email',
    'lifecycle-orgb-invitee@example.test',
    decode(repeat('22', 32), 'hex'),
    statement_timestamp() + private.invitation_default_ttl(),
    (select id from lifecycle_ids where key = 'org_b_role_version'),
    'organisation',
    null
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000005","email":"lifecycle-orgb-invitee@example.test"}',
  true
);

select ok(
  public.accept_organisation_invitation(decode(repeat('22', 32), 'hex')) is not null,
  'existing user can accept invitation to another organisation'
);

select ok(
  exists (
    select 1
    from public.organisation_memberships membership
    where membership.user_id = '95000000-0000-0000-0000-000000000005'
      and membership.organisation_id = (select id from lifecycle_ids where key = 'organisation_b')
      and membership.status = 'active'
  ),
  'cross-organisation membership is created without duplicating identity'
);

reset role;
set local role anon;

select is(
  public.preview_organisation_invitation(decode(repeat('ef', 32), 'hex')) ->> 'state',
  'valid',
  'unauthenticated preview reveals permitted metadata'
);

select * from finish();
rollback;
