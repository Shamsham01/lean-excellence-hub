begin;

select plan(30);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'planner-rpc-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'planner-rpc-manager@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f2000000-0000-0000-0000-000000000003',
    'planner-rpc-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'f2000000-0000-0000-0000-000000000004',
    'planner-rpc-outsider@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table planner_rpc_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on planner_rpc_ids to authenticated;

insert into planner_rpc_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'f2000000-0000-0000-0000-000000000001',
    'planner-rpc-org',
    'Planner RPC Org'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'f2000000-0000-0000-0000-000000000004',
    'planner-rpc-outsider-org',
    'Planner RPC Outsider Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'f2100000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f2100000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f2100000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'f2100000-0000-0000-0000-000000000004',
    'f2000000-0000-0000-0000-000000000004',
    statement_timestamp(),
    statement_timestamp()
  );

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at, display_name
)
values
  (
    (select id from planner_rpc_ids where key = 'organisation'),
    'f2000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp(),
    'Site Manager'
  ),
  (
    (select id from planner_rpc_ids where key = 'organisation'),
    'f2000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp(),
    'Read-only Member'
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'f2000000-0000-0000-0000-000000000002',
  'f2000000-0000-0000-0000-000000000003'
);

insert into planner_rpc_ids (key, id)
select 'manager_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from planner_rpc_ids where key = 'organisation')
  and membership_row.user_id = 'f2000000-0000-0000-0000-000000000002';

insert into planner_rpc_ids (key, id)
select 'member_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from planner_rpc_ids where key = 'organisation')
  and membership_row.user_id = 'f2000000-0000-0000-0000-000000000003';

insert into planner_rpc_ids (key, id)
select 'manager_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from planner_rpc_ids where key = 'organisation')
  and role_row.canonical_name = 'manager'
  and role_version.status = 'published';

insert into planner_rpc_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from planner_rpc_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"f2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2100000-0000-0000-0000-000000000001","email":"planner-rpc-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from planner_rpc_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into planner_rpc_ids (key, id)
select 'site', public.create_organisation_unit(
  (select id from planner_rpc_ids where key = 'organisation'),
  null,
  'planner-site',
  'Planner Site',
  'site'
);

insert into planner_rpc_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from planner_rpc_ids where key = 'organisation'),
  (select id from planner_rpc_ids where key = 'site'),
  'planner-child',
  'Planner Child',
  'department'
);

select ok(
  public.grant_role_version(
    (select id from planner_rpc_ids where key = 'organisation'),
    (select id from planner_rpc_ids where key = 'manager_membership'),
    (select id from planner_rpc_ids where key = 'manager_role_version'),
    'unit_subtree',
    (select id from planner_rpc_ids where key = 'child_unit')
  ) is not null,
  'owner grants site-scoped manager on child unit'
);

select ok(
  public.grant_role_version(
    (select id from planner_rpc_ids where key = 'organisation'),
    (select id from planner_rpc_ids where key = 'member_membership'),
    (select id from planner_rpc_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from planner_rpc_ids where key = 'child_unit')
  ) is not null,
  'owner grants read-only team member on child unit'
);

insert into planner_rpc_ids (key, id)
select 'action', public.create_action(
  'Planner RPC action',
  null,
  'normal',
  (select id from planner_rpc_ids where key = 'child_unit'),
  null,
  null,
  'planner-rpc-action'
);

insert into planner_rpc_ids (key, id)
select 'other_action', public.create_action(
  'Other action for cover',
  null,
  'normal',
  (select id from planner_rpc_ids where key = 'child_unit'),
  null,
  null,
  'planner-rpc-other-action'
);

insert into planner_rpc_ids (key, id)
select 'label_alpha', public.upsert_action_label(null, 'Alpha', '#112233', 0);

select throws_ok(
  $$select public.upsert_action_label(null, 'alpha', '#445566', 1)$$,
  '23505',
  'label name already exists',
  'duplicate label names are rejected case-insensitively'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f2000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"f2100000-0000-0000-0000-000000000004","email":"planner-rpc-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from planner_rpc_ids where key = 'other_organisation')),
  'outsider selects own org'
);

insert into planner_rpc_ids (key, id)
select 'foreign_label', public.upsert_action_label(null, 'Foreign Org Label', '#ABCDEF', 0);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2100000-0000-0000-0000-000000000001","email":"planner-rpc-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from planner_rpc_ids where key = 'organisation')),
  'owner re-selects organisation'
);

select lives_ok(
  format(
    'select public.set_action_labels(%L::uuid, %L::uuid[])',
    (select id from planner_rpc_ids where key = 'action'),
    array[
      (select id from planner_rpc_ids where key = 'label_alpha'),
      (select id from planner_rpc_ids where key = 'foreign_label'),
      null::uuid
    ]
  ),
  'set_action_labels ignores foreign and null label ids'
);

select is(
  jsonb_array_length(
    public.get_action_detail((select id from planner_rpc_ids where key = 'action')) -> 'labels'
  ),
  1,
  'only in-org labels are assigned'
);

insert into planner_rpc_ids (key, id)
select 'checklist_a', public.add_action_checklist_item(
  (select id from planner_rpc_ids where key = 'action'),
  'First item',
  null
);

insert into planner_rpc_ids (key, id)
select 'checklist_b', public.add_action_checklist_item(
  (select id from planner_rpc_ids where key = 'action'),
  'Second item',
  null
);

select lives_ok(
  format(
    'select public.set_action_checklist_item_done(%L::uuid, true)',
    (select id from planner_rpc_ids where key = 'checklist_a')
  ),
  'owner toggles checklist item done'
);

select lives_ok(
  format(
    'select public.move_action_checklist_item(%L::uuid, 1)',
    (select id from planner_rpc_ids where key = 'checklist_a')
  ),
  'owner reorders checklist item'
);

select lives_ok(
  format(
    'select public.delete_action_checklist_item(%L::uuid)',
    (select id from planner_rpc_ids where key = 'checklist_b')
  ),
  'owner deletes checklist item'
);

insert into planner_rpc_ids (key, id)
select 'cover_attachment', upload_row.attachment_id
from public.initiate_attachment_upload(
  (select id from planner_rpc_ids where key = 'action'),
  'cover.png',
  'image/png',
  2048
) upload_row;

select ok(
  public.confirm_attachment_upload((select id from planner_rpc_ids where key = 'cover_attachment')),
  'cover attachment confirmed'
);

select lives_ok(
  format(
    'select public.set_action_card_cover_attachment(%L::uuid, %L::uuid)',
    (select id from planner_rpc_ids where key = 'action'),
    (select id from planner_rpc_ids where key = 'cover_attachment')
  ),
  'owner sets valid card cover'
);

insert into planner_rpc_ids (key, id)
select 'foreign_cover_attachment', upload_row.attachment_id
from public.initiate_attachment_upload(
  (select id from planner_rpc_ids where key = 'other_action'),
  'other.png',
  'image/png',
  1024
) upload_row;

select ok(
  public.confirm_attachment_upload((select id from planner_rpc_ids where key = 'foreign_cover_attachment')),
  'other action attachment confirmed'
);

select throws_ok(
  format(
    'select public.set_action_card_cover_attachment(%L::uuid, %L::uuid)',
    (select id from planner_rpc_ids where key = 'action'),
    (select id from planner_rpc_ids where key = 'foreign_cover_attachment')
  ),
  '23514',
  'card cover attachment must belong to this action',
  'cover rejects attachment from another action'
);

select ok(
  (public.get_action_detail((select id from planner_rpc_ids where key = 'action'))
    -> 'card_cover_attachment' ->> 'id')
    = (select id::text from planner_rpc_ids where key = 'cover_attachment'),
  'get_action_detail returns validated cover'
);

select ok(
  jsonb_array_length(
    public.get_action_detail((select id from planner_rpc_ids where key = 'action')) -> 'labels'
  ) = 1,
  'get_action_detail includes labels'
);

select ok(
  public.get_action_detail((select id from planner_rpc_ids where key = 'action')) ? 'checklist_items',
  'get_action_detail includes checklist_items'
);

select ok(
  public.get_action_detail((select id from planner_rpc_ids where key = 'action')) ? 'comment_count',
  'get_action_detail includes comment_count'
);

reset role;

delete from public.attachments
where id = (select id from planner_rpc_ids where key = 'cover_attachment');

select set_config(
  'request.jwt.claims',
  '{"sub":"f2000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f2100000-0000-0000-0000-000000000001","email":"planner-rpc-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from planner_rpc_ids where key = 'organisation')),
  'owner selects org after cover delete'
);

select is(
  (
    select action_row.card_cover_attachment_id
    from public.actions action_row
    where action_row.id = (select id from planner_rpc_ids where key = 'action')
  ),
  null::uuid,
  'deleting cover attachment nulls card_cover_attachment_id'
);

select ok(
  (public.get_action_detail((select id from planner_rpc_ids where key = 'action'))
    -> 'card_cover_attachment' ->> 'id') is null,
  'get_action_detail has no cover after attachment delete'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f2000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f2100000-0000-0000-0000-000000000002","email":"planner-rpc-manager@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from planner_rpc_ids where key = 'organisation')),
  'site manager selects organisation'
);

select lives_ok(
  $$select public.list_action_labels()$$,
  'site-scoped manager can list labels'
);

select lives_ok(
  $$select public.upsert_action_label(null, 'Manager Created', '#00AA88', 2)$$,
  'site-scoped manager can create a label with unit-scoped actions.update'
);

select throws_ok(
  format(
    'select public.upsert_action_label(%L::uuid, %L, %L, 0)',
    (select id from planner_rpc_ids where key = 'label_alpha'),
    'Renamed Alpha',
    '#999999'
  ),
  '42501',
  null,
  'site-scoped manager cannot rename org catalogue labels'
);

select lives_ok(
  format(
    'select public.set_action_labels(%L::uuid, %L::uuid[])',
    (select id from planner_rpc_ids where key = 'action'),
    array[(select id from planner_rpc_ids where key = 'label_alpha')]
  ),
  'site-scoped manager can assign labels on in-scope action'
);

select lives_ok(
  format(
    'select public.add_action_checklist_item(%L::uuid, %L, null)',
    (select id from planner_rpc_ids where key = 'action'),
    'Manager checklist item'
  ),
  'site-scoped manager can edit checklist on in-scope action'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"f2000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"f2100000-0000-0000-0000-000000000003","email":"planner-rpc-member@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from planner_rpc_ids where key = 'organisation')),
  'read-only member selects organisation'
);

select throws_ok(
  format(
    'select public.add_action_checklist_item(%L::uuid, %L, null)',
    (select id from planner_rpc_ids where key = 'action'),
    'Denied item'
  ),
  '42501',
  null,
  'read-only member cannot add checklist items'
);

select finish();

rollback;
