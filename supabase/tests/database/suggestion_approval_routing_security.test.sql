begin;

select plan(49);

-- ---------------------------------------------------------------------------
-- Complete private helper inventory: no PUBLIC/anon/authenticated/service_role
-- ---------------------------------------------------------------------------

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
    'private.membership_can_act_on_suggestion_approval_jurisdiction(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute membership_can_act_on_suggestion_approval_jurisdiction'
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
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.submit_suggestion(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.submit_suggestion'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.claim_suggestion_for_review(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.claim_suggestion_for_review'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.delegate_suggestion_approval(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.delegate_suggestion_approval'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.assign_suggestion_reviewer(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute private.assign_suggestion_reviewer'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.end_active_suggestion_review_assignment(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute end_active_suggestion_review_assignment'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.insert_suggestion_review_assignment(uuid,uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute insert_suggestion_review_assignment'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.suggestion_has_active_reviewer(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute suggestion_has_active_reviewer'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.is_active_suggestion_reviewer(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute is_active_suggestion_reviewer'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.assert_eligible_suggestion_reviewer_membership(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute assert_eligible_suggestion_reviewer_membership'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.membership_can_review_suggestion_jurisdiction(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute membership_can_review_suggestion_jurisdiction'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.can_claim_suggestion_for_review(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute can_claim_suggestion_for_review'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.can_assign_suggestion_reviewer(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute can_assign_suggestion_reviewer'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.can_act_as_active_suggestion_reviewer(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute can_act_as_active_suggestion_reviewer'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.append_suggestion_status_history(uuid,uuid,text,text,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute append_suggestion_status_history'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.can_view_suggestion_reviewer_metadata(uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute can_view_suggestion_reviewer_metadata'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.can_review_suggestion(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute can_review_suggestion (transitive reviewer oracle)'
);

select ok(
  pg_catalog.has_function_privilege(
    'postgres',
    'private.end_active_suggestion_review_assignment(uuid,uuid)',
    'EXECUTE'
  ),
  'postgres can execute end_active_suggestion_review_assignment'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.delegate_suggestion_approval(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated can execute public delegate wrapper'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.submit_suggestion(uuid)',
    'EXECUTE'
  ),
  'authenticated can execute public submit wrapper'
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
-- Cross-tenant arbitrary-org helpers denied to authenticated
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

select throws_ok(
  format(
    'select private.end_active_suggestion_review_assignment(%L::uuid, %L::uuid)',
    (select id from sec_ids where key = 'org_a'),
    (select id from sec_ids where key = 'suggestion_b')
  ),
  'permission denied for function end_active_suggestion_review_assignment',
  'authenticated cannot end assignment cross-org'
);

select throws_ok(
  format(
    'select private.insert_suggestion_review_assignment(%L::uuid, %L::uuid, %L::uuid, %L::uuid, %L)',
    (select id from sec_ids where key = 'org_a'),
    (select id from sec_ids where key = 'suggestion_b'),
    (select id from sec_ids where key = 'membership_b'),
    (select id from sec_ids where key = 'membership_b'),
    'delegated'
  ),
  'permission denied for function insert_suggestion_review_assignment',
  'authenticated cannot insert assignment cross-org'
);

select throws_ok(
  format(
    'select private.suggestion_has_active_reviewer(%L::uuid, %L::uuid)',
    (select id from sec_ids where key = 'org_a'),
    (select id from sec_ids where key = 'suggestion_b')
  ),
  'permission denied for function suggestion_has_active_reviewer',
  'authenticated cannot probe active reviewer cross-org'
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

select isnt_empty(
  $$
    select 1
    from public.suggestion_approval_routing routing_row
    where routing_row.organisation_id = (select id from sec_ids where key = 'org_b')
      and routing_row.suggestion_id = (select id from sec_ids where key = 'suggestion_b')
  $$,
  'org B routing snapshot exists after submit'
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

select throws_ok(
  format(
    'select private.delegate_suggestion_approval(%L::uuid, %L::uuid, %L)',
    (select id from sec_ids where key = 'suggestion_b'),
    (select id from sec_ids where key = 'membership_b'),
    'direct private call'
  ),
  'permission denied for function delegate_suggestion_approval',
  'authenticated cannot call private delegate with arbitrary suggestion id'
);

select throws_ok(
  format(
    'select private.append_suggestion_status_history(%L::uuid, %L::uuid, %L, %L, %L::uuid, %L)',
    (select id from sec_ids where key = 'org_a'),
    (select id from sec_ids where key = 'suggestion_b'),
    'submitted',
    'under_review',
    (select id from sec_ids where key = 'membership_b'),
    'cross-tenant history probe'
  ),
  'permission denied for function append_suggestion_status_history',
  'authenticated cannot append status history cross-org'
);

select throws_ok(
  format(
    'select private.can_view_suggestion_reviewer_metadata(%L::uuid, %L::uuid, %L::uuid, %L::uuid)',
    (select id from sec_ids where key = 'org_a'),
    (select id from sec_ids where key = 'suggestion_b'),
    (select id from sec_ids where key = 'unit_b'),
    (select id from sec_ids where key = 'membership_b')
  ),
  'permission denied for function can_view_suggestion_reviewer_metadata',
  'authenticated cannot probe reviewer metadata cross-org'
);

select * from finish();
rollback;
