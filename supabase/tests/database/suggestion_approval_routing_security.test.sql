begin;

select plan(24);

-- Every private helper introduced in security hardening must not execute as anon/authenticated.

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.membership_suggestion_approval_scope_depth(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute membership_suggestion_approval_scope_depth'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.resolve_suggestion_actionable_approver(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute resolve_suggestion_actionable_approver'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.suggestion_approval_in_app_dedupe_key(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated cannot execute suggestion_approval_in_app_dedupe_key'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.revoke_all_suggestion_approval_in_app_notifications(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute revoke_all_suggestion_approval_in_app_notifications'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.revoke_suggestion_approval_in_app_notifications(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute revoke_suggestion_approval_in_app_notifications'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'private.snapshot_suggestion_approval_routing(uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute snapshot_suggestion_approval_routing'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.is_suggestion_primary_approver(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute is_suggestion_primary_approver'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.actor_has_suggestion_manager_override(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute actor_has_suggestion_manager_override'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.can_delegate_suggestion_approval(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute can_delegate_suggestion_approval'
);

select ok(
  pg_catalog.has_function_privilege(
    'postgres',
    'private.resolve_suggestion_actionable_approver(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'postgres can execute resolve_suggestion_actionable_approver'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.lookup_suggestion_approval_notification_recipients_for_worker(uuid,uuid)',
    'EXECUTE'
  ),
  'service_role retains worker lookup RPC'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.lookup_suggestion_approval_notification_recipients_for_worker(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute worker lookup RPC'
);

-- ---------------------------------------------------------------------------
-- Cross-tenant: worker lookup must not return another organisation's routing
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'f1200000-0000-4000-8000-000000000001',
  'sec-a@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'f1200000-0000-4000-8000-000000000002',
  'sec-b@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table sec_ids (key text primary key, id uuid) on commit drop;
grant select, insert, update on sec_ids to service_role, lean_hub_private_owner, authenticated;

insert into sec_ids (key, id) values (
  'org_a',
  private.provision_organisation('f1200000-0000-4000-8000-000000000001', 'sec-a', 'Sec Org A')
);

insert into sec_ids (key, id) values (
  'org_b',
  private.provision_organisation('f1200000-0000-4000-8000-000000000002', 'sec-b', 'Sec Org B')
);

set local role service_role;

select is(
  (
    select coalesce(array_length(
      public.lookup_suggestion_approval_notification_recipients_for_worker(
        (select id from sec_ids where key = 'org_a'),
        '00000000-0000-4000-8000-000000009999'::uuid
      ),
      1
    ), 0)
  ),
  0::integer,
  'worker lookup returns empty for unknown suggestion'
);

set local role lean_hub_private_owner;

select is(
  private.resolve_suggestion_actionable_approver(
    (select id from sec_ids where key = 'org_a'),
    null,
    null
  ),
  null::uuid,
  'actionable approver resolver returns null when jurisdiction is null'
);

reset role;

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'f1200100-0000-4000-8000-000000000002',
  'f1200000-0000-4000-8000-000000000002',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1200000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1200100-0000-4000-8000-000000000002","email":"sec-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_ids where key = 'org_b')),
  'org B actor selects organisation for submit fixture'
);

insert into sec_ids (key, id)
select 'membership_b', id
from public.organisation_memberships
where organisation_id = (select id from sec_ids where key = 'org_b')
  and user_id = 'f1200000-0000-4000-8000-000000000002';

insert into sec_ids (key, id)
select 'unit_b', public.create_organisation_unit(
  (select id from sec_ids where key = 'org_b'),
  null,
  'sec-b-site',
  'Sec B Site',
  'site'
);

insert into sec_ids (key, id)
select 'job_function_b', public.create_job_function('Operator', 'operator-b');

select ok(
  public.assign_membership_job_function(
    (select id from sec_ids where key = 'membership_b'),
    (select id from sec_ids where key = 'job_function_b'),
    true,
    (select id from sec_ids where key = 'unit_b')
  ) is not null,
  'org B founder primary job assignment'
);

insert into sec_ids (key, id)
select 'programme_b', public.create_suggestion_programme_draft('Ideas', 'ideas');

insert into sec_ids (key, id)
select 'programme_version_b', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from sec_ids where key = 'programme_b')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from sec_ids where key = 'programme_version_b')),
  'org B programme version publishes'
);

insert into sec_ids (key, id)
select 'category_b', public.create_suggestion_category('Safety', 'safety');

insert into sec_ids (key, id)
select 'suggestion_b', public.create_suggestion_draft(
  (select id from sec_ids where key = 'programme_version_b'),
  (select id from sec_ids where key = 'category_b'),
  'Org B only suggestion',
  'p',
  'i',
  'b'
);

select ok(
  public.submit_suggestion((select id from sec_ids where key = 'suggestion_b')),
  'org B suggestion submits for cross-tenant lookup'
);

reset role;
set local role service_role;

select is(
  (
    select coalesce(array_length(
      public.lookup_suggestion_approval_notification_recipients_for_worker(
        (select id from sec_ids where key = 'org_a'),
        (select id from sec_ids where key = 'suggestion_b')
      ),
      1
    ), 0)
  ),
  0::integer,
  'worker lookup with wrong organisation id does not leak org B recipient'
);

set local role lean_hub_private_owner;

select isnt_empty(
  $$
    select 1
    from public.suggestion_approval_routing routing_row
    where routing_row.organisation_id = (select id from sec_ids where key = 'org_b')
      and routing_row.suggestion_id = (select id from sec_ids where key = 'suggestion_b')
  $$,
  'org B routing snapshot exists after submit'
);

insert into sec_ids (key, id)
select
  'worker_recipient_expected',
  (
    select case
      when routing_row.email_recipient_membership_id is null then '00000000-0000-4000-8000-000000000000'::uuid
      else '00000000-0000-4000-8000-000000000001'::uuid
    end
    from public.suggestion_approval_routing routing_row
    where routing_row.organisation_id = (select id from sec_ids where key = 'org_b')
      and routing_row.suggestion_id = (select id from sec_ids where key = 'suggestion_b')
  );

set local role service_role;

select is(
  (
    select coalesce(array_length(
      public.lookup_suggestion_approval_notification_recipients_for_worker(
        (select id from sec_ids where key = 'org_b'),
        (select id from sec_ids where key = 'suggestion_b')
      ),
      1
    ), 0)
  ),
  (
    select case
      when worker_recipient_expected.id = '00000000-0000-4000-8000-000000000001'::uuid then 1
      else 0
    end
    from sec_ids worker_recipient_expected
    where worker_recipient_expected.key = 'worker_recipient_expected'
  ),
  'worker lookup reflects snapshotted email recipient for correct org'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1200000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f1200100-0000-4000-8000-000000000002","email":"sec-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sec_ids where key = 'org_b')),
  'org B actor for private helper denial'
);

select throws_ok(
  format(
    'select private.snapshot_suggestion_approval_routing(%L::uuid, %L::uuid, %L, %L)',
    (select id from sec_ids where key = 'org_a'),
    (select id from sec_ids where key = 'suggestion_b'),
    null,
    null
  ),
  'permission denied for function snapshot_suggestion_approval_routing',
  'authenticated cannot invoke snapshot helper even with cross-org ids'
);

select throws_ok(
  format(
    'select private.revoke_all_suggestion_approval_in_app_notifications(%L::uuid, %L::uuid, %L::uuid)',
    (select id from sec_ids where key = 'org_b'),
    (select id from sec_ids where key = 'suggestion_b'),
    (select id from public.organisation_memberships where organisation_id = (select id from sec_ids where key = 'org_b') limit 1)
  ),
  'permission denied for function revoke_all_suggestion_approval_in_app_notifications',
  'authenticated cannot revoke notifications via private helper'
);

select * from finish();
rollback;
