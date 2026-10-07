begin;

select plan(49);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.transfer_organisation_ownership(uuid)'::regprocedure,
    'execute'
  ),
  'anonymous callers cannot execute ownership transfer'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.list_organisation_ownership_transfer_targets()'::regprocedure,
    'execute'
  ),
  'anonymous callers cannot list ownership transfer targets'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.get_organisation_ownership()'::regprocedure,
    'execute'
  ),
  'anonymous callers cannot read organisation ownership'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.transfer_organisation_ownership(uuid)'::regprocedure
  ) like '%security invoker%',
  'public transfer wrapper is SECURITY INVOKER'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.transfer_organisation_ownership(uuid)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'transfer serialises with an organisation advisory lock'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'private.transfer_organisation_ownership(uuid)'::regprocedure
  ) like '%for update%',
  'transfer locks memberships and owner grants for update'
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
    '51000000-0000-0000-0000-000000000001',
    'plymouth-ci@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    'group-opex@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '51000000-0000-0000-0000-000000000003',
    'inactive-member@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '51000000-0000-0000-0000-000000000004',
    'pending-member@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '51000000-0000-0000-0000-000000000005',
    'site-manager@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '51000000-0000-0000-0000-000000000006',
    'billing-admin@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '51000000-0000-0000-0000-000000000007',
    'hierarchy-manager@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '51000000-0000-0000-0000-000000000011',
    'org-b-owner@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '51000000-0000-0000-0000-000000000012',
    'org-b-member@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table transfer_ids (
  key text primary key,
  id uuid not null
) on commit drop;
grant all on transfer_ids to authenticated, service_role;

insert into transfer_ids (key, id)
values (
  'organisation_a',
  private.provision_organisation(
    '51000000-0000-0000-0000-000000000001',
    'acme-foods-group',
    'Acme Foods Group'
  )
);

insert into transfer_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    '51000000-0000-0000-0000-000000000011',
    'other-foods-group',
    'Other Foods Group'
  )
);

insert into transfer_ids (key, id)
select 'owner_a_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from transfer_ids where key = 'organisation_a')
  and membership.user_id = '51000000-0000-0000-0000-000000000001';

insert into transfer_ids (key, id)
select 'owner_a_grant', grant_row.id
from public.access_grants grant_row
where grant_row.organisation_id = (select id from transfer_ids where key = 'organisation_a')
  and grant_row.grantee_membership_id = (
    select id from transfer_ids where key = 'owner_a_membership'
  );

insert into transfer_ids (key, id)
select 'owner_b_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from transfer_ids where key = 'organisation_b')
  and membership.user_id = '51000000-0000-0000-0000-000000000011';

insert into transfer_ids (key, id)
select 'owner_role_version_a', role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.organisation_id = role_version.organisation_id
 and role_row.id = role_version.role_id
where role_version.organisation_id = (select id from transfer_ids where key = 'organisation_a')
  and role_row.is_owner_role
  and role_version.status = 'published';

insert into transfer_ids (key, id)
select 'manager_role_version_a', role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.organisation_id = role_version.organisation_id
 and role_row.id = role_version.role_id
where role_version.organisation_id = (select id from transfer_ids where key = 'organisation_a')
  and role_row.canonical_name = 'manager'
  and role_version.status = 'published';

insert into transfer_ids (key, id)
select 'org_admin_role_version_a', role_version.id
from public.role_versions role_version
join public.roles role_row
  on role_row.organisation_id = role_version.organisation_id
 and role_row.id = role_version.role_id
where role_version.organisation_id = (select id from transfer_ids where key = 'organisation_a')
  and role_row.canonical_name = 'organisation-administrator'
  and role_version.status = 'published';

update public.organisation_memberships
set display_name = 'Plymouth CI Manager'
where id = (select id from transfer_ids where key = 'owner_a_membership');

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '51000000-0000-0000-0000-000000000002',
  '51000000-0000-0000-0000-000000000003',
  '51000000-0000-0000-0000-000000000004',
  '51000000-0000-0000-0000-000000000005',
  '51000000-0000-0000-0000-000000000006',
  '51000000-0000-0000-0000-000000000007',
  '51000000-0000-0000-0000-000000000012'
);

with inserted as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    display_name,
    status,
    activated_at
  )
  values
    (
      (select id from transfer_ids where key = 'organisation_a'),
      '51000000-0000-0000-0000-000000000002',
      'Group OpEx Director',
      'active',
      statement_timestamp()
    ),
    (
      (select id from transfer_ids where key = 'organisation_a'),
      '51000000-0000-0000-0000-000000000005',
      'Site Manager',
      'active',
      statement_timestamp()
    ),
    (
      (select id from transfer_ids where key = 'organisation_a'),
      '51000000-0000-0000-0000-000000000006',
      'Billing Administrator',
      'active',
      statement_timestamp()
    ),
    (
      (select id from transfer_ids where key = 'organisation_a'),
      '51000000-0000-0000-0000-000000000007',
      'Hierarchy Manager',
      'active',
      statement_timestamp()
    ),
    (
      (select id from transfer_ids where key = 'organisation_b'),
      '51000000-0000-0000-0000-000000000012',
      'Other Organisation Member',
      'active',
      statement_timestamp()
    )
  returning id, user_id
)
insert into transfer_ids (key, id)
select
  case inserted.user_id
    when '51000000-0000-0000-0000-000000000002' then 'director_membership'
    when '51000000-0000-0000-0000-000000000005' then 'site_manager_membership'
    when '51000000-0000-0000-0000-000000000006' then 'billing_membership'
    when '51000000-0000-0000-0000-000000000007' then 'hierarchy_membership'
    else 'org_b_member_membership'
  end,
  inserted.id
from inserted;

with inserted_inactive as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    display_name,
    status,
    inactivated_at,
    status_reason
  )
  values (
    (select id from transfer_ids where key = 'organisation_a'),
    '51000000-0000-0000-0000-000000000003',
    'Inactive Member',
    'inactive',
    statement_timestamp(),
    'Left the organisation'
  )
  returning id
)
insert into transfer_ids (key, id)
select 'inactive_membership', id from inserted_inactive;

with inserted_pending as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    display_name,
    status
  )
  values (
    (select id from transfer_ids where key = 'organisation_a'),
    '51000000-0000-0000-0000-000000000004',
    'Pending Member',
    'pending'
  )
  returning id
)
insert into transfer_ids (key, id)
select 'pending_membership', id from inserted_pending;

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '52000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '52000000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000005',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '52000000-0000-0000-0000-000000000006',
    '51000000-0000-0000-0000-000000000006',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '52000000-0000-0000-0000-000000000007',
    '51000000-0000-0000-0000-000000000007',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '52000000-0000-0000-0000-000000000011',
    '51000000-0000-0000-0000-000000000011',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000001","email":"plymouth-ci@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from transfer_ids where key = 'organisation_a')
  ),
  'current owner selects organisation A'
);

insert into transfer_ids (key, id)
select 'plymouth_site', public.create_organisation_unit(
  (select id from transfer_ids where key = 'organisation_a'),
  null,
  'plymouth',
  'Plymouth Factory',
  'site'
);

select ok(
  public.grant_role_version(
    (select id from transfer_ids where key = 'organisation_a'),
    (select id from transfer_ids where key = 'owner_a_membership'),
    (select id from transfer_ids where key = 'manager_role_version_a'),
    'unit_subtree',
    (select id from transfer_ids where key = 'plymouth_site')
  ) is not null,
  'current owner receives a site-scoped manager grant to retain after transfer'
);

select ok(
  public.grant_role_version(
    (select id from transfer_ids where key = 'organisation_a'),
    (select id from transfer_ids where key = 'site_manager_membership'),
    (select id from transfer_ids where key = 'manager_role_version_a'),
    'unit_subtree',
    (select id from transfer_ids where key = 'plymouth_site')
  ) is not null,
  'site-scoped manager grant is issued'
);

select ok(
  public.grant_role_version(
    (select id from transfer_ids where key = 'organisation_a'),
    (select id from transfer_ids where key = 'hierarchy_membership'),
    (select id from transfer_ids where key = 'org_admin_role_version_a'),
    'organisation',
    null
  ) is not null,
  'hierarchy manager receives organisation-administrator without owner authority'
);

insert into transfer_ids (key, id)
select
  'billing_role_draft',
  public.create_role_draft(
    (select id from transfer_ids where key = 'organisation_a'),
    'billing-administrator',
    'Billing Administrator',
    'Billing-only role for ownership transfer authority tests'
  );

select ok(
  public.add_role_permission(
    (select id from transfer_ids where key = 'organisation_a'),
    (select id from transfer_ids where key = 'billing_role_draft'),
    'billing.manage'
  ),
  'billing-only role receives billing.manage'
);

select ok(
  public.publish_role_version(
    (select id from transfer_ids where key = 'organisation_a'),
    (select id from transfer_ids where key = 'billing_role_draft')
  ),
  'billing-only role publishes'
);

select ok(
  public.grant_role_version(
    (select id from transfer_ids where key = 'organisation_a'),
    (select id from transfer_ids where key = 'billing_membership'),
    (select id from transfer_ids where key = 'billing_role_draft'),
    'organisation',
    null
  ) is not null,
  'billing administrator receives billing.manage without owner authority'
);

select is(
  (
    select (public.get_organisation_ownership() ->> 'can_transfer')::boolean
  ),
  true,
  'current organisation owner may initiate transfer'
);

select ok(
  public.list_organisation_ownership_transfer_targets() -> 'targets'
    @> jsonb_build_array(
      jsonb_build_object(
        'membership_id',
        (select id from transfer_ids where key = 'director_membership')
      )
    ),
  'eligible target list includes the active same-organisation director'
);

select ok(
  not (
    public.list_organisation_ownership_transfer_targets() -> 'targets'
      @> jsonb_build_array(
        jsonb_build_object(
          'membership_id',
          (select id from transfer_ids where key = 'owner_a_membership')
        )
      )
  ),
  'eligible target list excludes the current owner'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.list_organisation_ownership_transfer_targets() -> 'targets'
    ) target_row
    where target_row ->> 'membership_id' in (
      (select id::text from transfer_ids where key = 'inactive_membership'),
      (select id::text from transfer_ids where key = 'pending_membership'),
      (select id::text from transfer_ids where key = 'org_b_member_membership'),
      (select id::text from transfer_ids where key = 'owner_b_membership')
    )
  ),
  'eligible target list excludes inactive, pending, and other-organisation members'
);

select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'owner_a_membership')
  ),
  '23514',
  'organisation ownership cannot be transferred to the current owner',
  'transferring to self is rejected'
);

select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'inactive_membership')
  ),
  '23514',
  'ownership transfer target is not eligible',
  'inactive target is rejected'
);

select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'pending_membership')
  ),
  '23514',
  'ownership transfer target is not eligible',
  'pending target is rejected'
);

select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'org_b_member_membership')
  ),
  '23514',
  'ownership transfer target is not eligible',
  'target in another organisation is rejected'
);

reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'director_membership')
  ),
  '42501',
  'organisation ownership transfer is not authorised',
  'unauthenticated callers cannot transfer ownership'
);

reset role;
set local role anon;
select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'director_membership')
  ),
  '42501',
  null,
  'anonymous role cannot execute ownership transfer'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000005","email":"site-manager@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from transfer_ids where key = 'organisation_a')
  ),
  'site-scoped manager selects organisation A'
);
select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'director_membership')
  ),
  '42501',
  'organisation ownership transfer is not authorised',
  'site-scoped actor cannot transfer organisation ownership'
);
select throws_ok(
  'select public.list_organisation_ownership_transfer_targets()',
  '42501',
  'organisation ownership transfer is not authorised',
  'site-scoped actor cannot list transfer targets'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000006","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000006","email":"billing-admin@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from transfer_ids where key = 'organisation_a')
  ),
  'billing administrator selects organisation A'
);
select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'director_membership')
  ),
  '42501',
  'organisation ownership transfer is not authorised',
  'billing administrator without owner authority cannot transfer ownership'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000007","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000007","email":"hierarchy-manager@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from transfer_ids where key = 'organisation_a')
  ),
  'hierarchy manager selects organisation A'
);
select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'director_membership')
  ),
  '42501',
  'organisation ownership transfer is not authorised',
  'hierarchy manager without owner authority cannot transfer ownership'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000011","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000011","email":"org-b-owner@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from transfer_ids where key = 'organisation_b')
  ),
  'organisation B owner selects organisation B'
);
select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'director_membership')
  ),
  '23514',
  'ownership transfer target is not eligible',
  'organisation B owner cannot transfer ownership onto organisation A'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.list_organisation_ownership_transfer_targets() -> 'targets'
    ) target_row
    where target_row ->> 'membership_id' in (
      (select id::text from transfer_ids where key = 'director_membership'),
      (select id::text from transfer_ids where key = 'owner_a_membership')
    )
  ),
  'organisation B target list does not leak organisation A memberships'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000001","email":"plymouth-ci@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from transfer_ids where key = 'organisation_a')
  ),
  'current owner reselects organisation A before transfer'
);

select ok(
  (public.transfer_organisation_ownership(
    (select id from transfer_ids where key = 'director_membership')
  ) ->> 'transferred')::boolean,
  'owner A can transfer to an active member of the same organisation'
);

reset role;

select is(
  (
    select count(*)
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where grant_row.organisation_id = (select id from transfer_ids where key = 'organisation_a')
      and grant_row.grantee_membership_id = (
        select id from transfer_ids where key = 'director_membership'
      )
      and grant_row.status = 'active'
      and grant_row.scope_type = 'organisation'
      and role_row.is_owner_role
  ),
  1::bigint,
  'target receives exactly one organisation-owner grant'
);

select is(
  (
    select count(*)
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where grant_row.organisation_id = (select id from transfer_ids where key = 'organisation_a')
      and grant_row.grantee_membership_id = (
        select id from transfer_ids where key = 'owner_a_membership'
      )
      and grant_row.status = 'active'
      and grant_row.scope_type = 'organisation'
      and role_row.is_owner_role
  ),
  0::bigint,
  'source loses the organisation-owner grant'
);

select is(
  (
    select status
    from public.organisation_memberships
    where id = (select id from transfer_ids where key = 'owner_a_membership')
  ),
  'active',
  'source membership remains active'
);

select is(
  (
    select count(*)
    from public.access_grants grant_row
    where grant_row.organisation_id = (select id from transfer_ids where key = 'organisation_a')
      and grant_row.grantee_membership_id = (
        select id from transfer_ids where key = 'owner_a_membership'
      )
      and grant_row.status = 'active'
      and grant_row.scope_type = 'unit_subtree'
      and grant_row.scope_unit_id = (
        select id from transfer_ids where key = 'plymouth_site'
      )
  ),
  1::bigint,
  'source retains unrelated site-scoped grants'
);

select ok(
  (
    select count(*) >= 1
    from public.organisation_memberships membership
    where membership.organisation_id = (select id from transfer_ids where key = 'organisation_a')
      and private.membership_is_effective_owner(
        membership.id,
        (select id from transfer_ids where key = 'organisation_a')
      )
  ),
  'organisation remains with at least one owner'
);

select ok(
  exists (
    select 1
    from public.security_audit_events audit_row
    where audit_row.organisation_id = (select id from transfer_ids where key = 'organisation_a')
      and audit_row.action = 'organisation.ownership_transferred'
      and audit_row.outcome = 'succeeded'
      and audit_row.metadata ->> 'source_membership_id' = (
        select id::text from transfer_ids where key = 'owner_a_membership'
      )
      and audit_row.metadata ->> 'target_membership_id' = (
        select id::text from transfer_ids where key = 'director_membership'
      )
      and audit_row.metadata ? 'source_owner_grant_ids'
      and not (audit_row.metadata::text ilike '%password%')
      and not (audit_row.metadata::text ilike '%token%')
  ),
  'successful transfer appends organisation.ownership_transferred without secrets'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000001","email":"plymouth-ci@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from transfer_ids where key = 'organisation_a')
  ),
  'former owner can still select the organisation as a member'
);
select throws_ok(
  format(
    'select public.transfer_organisation_ownership(%L::uuid)',
    (select id from transfer_ids where key = 'hierarchy_membership')
  ),
  '42501',
  'organisation ownership transfer is not authorised',
  'stale former owner cannot transfer ownership again'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"52000000-0000-0000-0000-000000000002","email":"group-opex@example.test"}',
  true
);
set local role authenticated;
select ok(
  public.switch_organisation(
    (select id from transfer_ids where key = 'organisation_a')
  ),
  'new owner selects organisation A'
);

select ok(
  public.grant_role_version(
    (select id from transfer_ids where key = 'organisation_a'),
    (select id from transfer_ids where key = 'hierarchy_membership'),
    (select id from transfer_ids where key = 'owner_role_version_a'),
    'organisation',
    null
  ) is not null,
  'new owner can grant organisation-owner to an existing member'
);

select ok(
  (public.transfer_organisation_ownership(
    (select id from transfer_ids where key = 'hierarchy_membership')
  ) ->> 'transferred')::boolean,
  'transfer to a member who is already an owner still revokes the source grant'
);

reset role;

select is(
  (
    select count(*)
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where grant_row.organisation_id = (select id from transfer_ids where key = 'organisation_a')
      and grant_row.grantee_membership_id = (
        select id from transfer_ids where key = 'hierarchy_membership'
      )
      and grant_row.status = 'active'
      and grant_row.scope_type = 'organisation'
      and role_row.is_owner_role
  ),
  1::bigint,
  'already-owner target does not receive a duplicate owner grant'
);

select is(
  (
    select count(*)
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where grant_row.organisation_id = (select id from transfer_ids where key = 'organisation_a')
      and grant_row.grantee_membership_id = (
        select id from transfer_ids where key = 'director_membership'
      )
      and grant_row.status = 'active'
      and grant_row.scope_type = 'organisation'
      and role_row.is_owner_role
  ),
  0::bigint,
  'source owner grant is removed when the target was already an owner'
);

select is(
  (
    select count(*)
    from public.organisation_memberships membership
    where membership.organisation_id = (select id from transfer_ids where key = 'organisation_a')
      and private.membership_is_effective_owner(
        membership.id,
        (select id from transfer_ids where key = 'organisation_a')
      )
  ),
  1::bigint,
  'exactly one effective owner remains after transferring to an existing owner'
);

select finish();

rollback;
