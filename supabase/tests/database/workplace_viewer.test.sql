begin;

select plan(40);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'workplace-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'workplace-viewer@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'workplace-other-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table workplace_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on workplace_ids to authenticated, postgres;

insert into workplace_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'e1000000-0000-0000-0000-000000000001',
    'workplace-org',
    'Workplace Org'
  )
);

insert into workplace_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'e1000000-0000-0000-0000-000000000003',
    'workplace-other-org',
    'Workplace Other Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at, display_name
)
values (
  (select id from workplace_ids where key = 'organisation'),
  'e1000000-0000-0000-0000-000000000002',
  'active',
  statement_timestamp(),
  'Workplace Viewer'
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'e1000000-0000-0000-0000-000000000002';

insert into workplace_ids (key, id)
select 'viewer_membership', id
from public.organisation_memberships
where organisation_id = (select id from workplace_ids where key = 'organisation')
  and user_id = 'e1000000-0000-0000-0000-000000000002';

insert into workplace_ids (key, id)
select 'viewer_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from workplace_ids where key = 'organisation')
  and role_row.canonical_name = 'workplace-viewer'
  and role_version.status = 'published';

insert into workplace_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from workplace_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

insert into workplace_ids (key, id)
select 'suggestions_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from workplace_ids where key = 'organisation')
  and role_row.canonical_name = 'responsibility-suggestions'
  and role_version.status = 'published';

select ok(
  not exists (
    select 1
    from public.access_grants grant_row
    where grant_row.role_version_id = (
      select id from workplace_ids where key = 'viewer_role_version'
    )
  ),
  'publishing workplace viewer does not grant it to existing members'
);

select ok(
  (
    select array_agg(permission.permission_key order by permission.permission_key)
    from public.role_permissions permission
    where permission.role_version_id = (
      select id from workplace_ids where key = 'viewer_role_version'
    )
  ) = array['workplace.view']::text[],
  'workplace viewer has only workplace.view'
);

select ok(
  exists (
    select 1
    from public.role_permissions permission
    where permission.role_version_id = (
      select id from workplace_ids where key = 'team_member_role_version'
    )
      and permission.permission_key = 'five_s.audit.perform'
  ),
  'team member is unchanged and is not a read-only role'
);

select ok(
  not exists (
    select 1
    from public.role_permissions permission
    where permission.role_version_id = (
      select id from workplace_ids where key = 'suggestions_role_version'
    )
      and permission.permission_key = 'suggestions.submit'
  ),
  'suggestions responsibility role is not broadened'
);

select ok(
  position(
    'baseline_financial_value' in pg_get_functiondef(
      'private.workplace_module_records(uuid,text,uuid,integer,integer)'::regprocedure
    )
  ) = 0,
  'benefit projection does not read financial values'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2000000-0000-0000-0000-000000000001","email":"workplace-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from workplace_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into workplace_ids (key, id)
select 'site_a', public.create_organisation_unit(
  (select id from workplace_ids where key = 'organisation'),
  null,
  'viewer-site-a',
  'Viewer Site A',
  'site'
);

insert into workplace_ids (key, id)
select 'site_b', public.create_organisation_unit(
  (select id from workplace_ids where key = 'organisation'),
  null,
  'viewer-site-b',
  'Viewer Site B',
  'site'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    where offer ->> 'role_canonical_name' = 'workplace-viewer'
  ),
  'owner can offer workplace viewer without holding that permission'
);

insert into workplace_ids (key, id)
select 'site_a_action', public.create_action(
  'Inspect Site A',
  null,
  'normal',
  (select id from workplace_ids where key = 'site_a')
);

insert into workplace_ids (key, id)
select 'site_b_action', public.create_action(
  'Inspect Site B',
  null,
  'normal',
  (select id from workplace_ids where key = 'site_b')
);

insert into workplace_ids (key, id)
select 'cancelled_action', public.create_action(
  'Cancelled Site A',
  null,
  'normal',
  (select id from workplace_ids where key = 'site_a')
);

set local role postgres;

update public.actions
set status = 'cancelled'
where id = (select id from workplace_ids where key = 'cancelled_action');

set local role authenticated;

insert into workplace_ids (key, id)
select 'oldest_action', public.create_action(
  'Oldest authorised action',
  null,
  'normal',
  (select id from workplace_ids where key = 'site_a'),
  null,
  statement_timestamp() - interval '80 days'
);

do $$
declare
  action_number integer;
begin
  for action_number in 1..50 loop
    perform public.create_action(
      'Paged action ' || action_number::text,
      null,
      'normal',
      (select id from workplace_ids where key = 'site_a'),
      null,
      statement_timestamp() - interval '2 days'
    );
  end loop;
end;
$$;

insert into workplace_ids (key, id)
select 'viewer_grant', public.grant_role_version(
  (select id from workplace_ids where key = 'organisation'),
  (select id from workplace_ids where key = 'viewer_membership'),
  (select id from workplace_ids where key = 'viewer_role_version'),
  'unit_subtree',
  (select id from workplace_ids where key = 'site_a')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"e2000000-0000-0000-0000-000000000002","email":"workplace-viewer@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from workplace_ids where key = 'organisation')),
  'viewer selects organisation'
);

select ok(
  public.get_workplace_feed('actions') -> 'records' @>
    jsonb_build_array(
      jsonb_build_object(
        'id',
        (select id from workplace_ids where key = 'site_a_action')
      )
    ),
  'viewer can see an action in the granted site'
);

select ok(
  not (
    public.get_workplace_feed('actions')::text like
      '%' || (select id from workplace_ids where key = 'site_b_action')::text || '%'
  ),
  'viewer cannot see an action at another site'
);

select ok(
  not (
    public.get_workplace_feed('actions')::text like
      '%' || (select id from workplace_ids where key = 'cancelled_action')::text || '%'
  ),
  'viewer feed omits cancelled actions'
);

select is(
  public.get_workplace_record(
    'actions',
    (select id from workplace_ids where key = 'site_b_action')
  ),
  null,
  'viewer detail does not open another site'
);

select is(
  (select count(*)::int from public.actions),
  0,
  'existing action read remains denied for workplace view'
);

select throws_ok(
  $q$ select public.create_action('Viewer write', null, 'normal', (select id from workplace_ids where key = 'site_a')) $q$,
  '42501',
  'action creation is not authorised',
  'workplace view does not grant action writes'
);

select is(
  (select count(*)::int from public.membership_skill_assessments),
  0,
  'workplace view does not read employee assessments'
);

select throws_ok(
  $q$ select public.get_workplace_feed('not-a-module') $q$,
  '22023',
  'workplace module is not available',
  'unknown workplace module is rejected'
);

select ok(
  (public.get_workplace_feed('actions', 1) ->> 'has_more')::boolean,
  'the first workplace page reports further authorised records'
);

select is(
  jsonb_array_length(public.get_workplace_feed('actions', 1) -> 'records'),
  25,
  'a workplace page returns the page size'
);

select ok(
  not (
    public.get_workplace_feed('actions', 1)::text like
      '%' || (select id from workplace_ids where key = 'oldest_action')::text || '%'
  ),
  'an older authorised action is not dropped by the first page cap'
);

select ok(
  public.get_workplace_feed('actions', 3)::text like
    '%' || (select id from workplace_ids where key = 'oldest_action')::text || '%',
  'a later page lists the older authorised action'
);

select ok(
  not (public.get_workplace_feed('actions', 3) ->> 'has_more')::boolean,
  'the last workplace page reports no further records'
);

select is(
  public.get_workplace_record(
    'actions',
    (select id from workplace_ids where key = 'oldest_action')
  ) ->> 'title',
  'Oldest authorised action',
  'record lookup opens an authorised action outside the first page'
);

select ok(
  not (
    public.get_workplace_feed('actions', 3)::text like
      '%' || (select id from workplace_ids where key = 'site_b_action')::text || '%'
  ),
  'later pages still omit another site'
);

select ok(
  not public.member_has_grant_permission('suggestions.read'),
  'workplace view is not a suggestions.read grant'
);

select ok(
  public.member_has_grant_permission('workplace.view'),
  'workplace view grant is visible to the grant probe'
);

set local role postgres;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'e1000000-0000-0000-0000-000000000004',
  'workplace-mixed@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'e2000000-0000-0000-0000-000000000004',
  'e1000000-0000-0000-0000-000000000004',
  statement_timestamp(),
  statement_timestamp()
);

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at, display_name
)
values (
  (select id from workplace_ids where key = 'organisation'),
  'e1000000-0000-0000-0000-000000000004',
  'active',
  statement_timestamp(),
  'Mixed Site Member'
);

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'e1000000-0000-0000-0000-000000000004';

insert into workplace_ids (key, id)
select 'mixed_membership', id
from public.organisation_memberships
where organisation_id = (select id from workplace_ids where key = 'organisation')
  and user_id = 'e1000000-0000-0000-0000-000000000004';

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2000000-0000-0000-0000-000000000001","email":"workplace-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from workplace_ids where key = 'organisation')),
  'owner returns to create mixed-site access'
);

insert into workplace_ids (key, id)
select 'site_b_child', public.create_organisation_unit(
  (select id from workplace_ids where key = 'organisation'),
  (select id from workplace_ids where key = 'site_b'),
  'viewer-site-b-area',
  'Viewer Site B Area',
  'area'
);

insert into workplace_ids (key, id)
select 'site_c', public.create_organisation_unit(
  (select id from workplace_ids where key = 'organisation'),
  null,
  'viewer-site-c',
  'Viewer Site C',
  'site'
);

insert into workplace_ids (key, id)
select 'site_b_child_action', public.create_action(
  'Inspect Site B child',
  null,
  'normal',
  (select id from workplace_ids where key = 'site_b_child')
);

insert into workplace_ids (key, id)
select 'site_c_action', public.create_action(
  'Inspect Site C',
  null,
  'normal',
  (select id from workplace_ids where key = 'site_c')
);

insert into workplace_ids (key, id)
select 'site_editor_role', public.create_role_draft(
  (select id from workplace_ids where key = 'organisation'),
  'site-a-action-editor',
  'Site A Action Editor',
  'Read and create actions'
);

select ok(
  public.add_role_permission(
    (select id from workplace_ids where key = 'organisation'),
    (select id from workplace_ids where key = 'site_editor_role'),
    'actions.read'
  ),
  'mixed role receives actions.read'
);

select ok(
  public.add_role_permission(
    (select id from workplace_ids where key = 'organisation'),
    (select id from workplace_ids where key = 'site_editor_role'),
    'actions.create'
  ),
  'mixed role receives actions.create'
);

select ok(
  public.publish_role_version(
    (select id from workplace_ids where key = 'organisation'),
    (select id from workplace_ids where key = 'site_editor_role')
  ),
  'mixed role publishes'
);

select public.grant_role_version(
  (select id from workplace_ids where key = 'organisation'),
  (select id from workplace_ids where key = 'mixed_membership'),
  (select id from workplace_ids where key = 'site_editor_role'),
  'unit_subtree',
  (select id from workplace_ids where key = 'site_a')
);

select public.grant_role_version(
  (select id from workplace_ids where key = 'organisation'),
  (select id from workplace_ids where key = 'mixed_membership'),
  (select id from workplace_ids where key = 'viewer_role_version'),
  'unit_subtree',
  (select id from workplace_ids where key = 'site_b')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"e2000000-0000-0000-0000-000000000004","email":"workplace-mixed@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from workplace_ids where key = 'organisation')),
  'mixed member selects organisation'
);

select ok(
  public.has_scoped_permission(
    (select id from workplace_ids where key = 'organisation'),
    'actions.create',
    null,
    (select id from workplace_ids where key = 'site_a')
  ),
  'site A keeps action creation'
);

select ok(
  not public.has_scoped_permission(
    (select id from workplace_ids where key = 'organisation'),
    'actions.create',
    null,
    (select id from workplace_ids where key = 'site_b')
  ),
  'site B viewing does not add action creation'
);

select ok(
  not public.has_scoped_permission(
    (select id from workplace_ids where key = 'organisation'),
    'actions.read',
    null,
    (select id from workplace_ids where key = 'site_c')
  ),
  'a sibling site is outside both grants'
);

select ok(
  public.get_workplace_feed('actions')::text like
    '%' || (select id from workplace_ids where key = 'site_b_child_action')::text || '%',
  'viewing a site includes its descendant records'
);

select ok(
  not (
    public.get_workplace_feed('actions')::text like
      '%' || (select id from workplace_ids where key = 'site_c_action')::text || '%'
  ),
  'viewing one site does not list a sibling site'
);

select ok(
  not (
    public.get_workplace_feed('actions')::text like
      '%' || (select id from workplace_ids where key = 'site_a_action')::text || '%'
  ),
  'the read-only feed does not absorb the other site write scope'
);

select is(
  public.get_workplace_record(
    'actions',
    (select id from workplace_ids where key = 'site_c_action')
  ),
  null,
  'direct lookup refuses a sibling-site record'
);

select is(
  public.get_workplace_record(
    'actions',
    (select id from workplace_ids where key = 'site_b_child_action')
  ) ->> 'title',
  'Inspect Site B child',
  'direct lookup opens a descendant in the viewed site'
);

select throws_ok(
  $q$ select public.create_action('Mixed write', null, 'normal', (select id from workplace_ids where key = 'site_b')) $q$,
  '42501',
  'action creation is not authorised',
  'viewing site B does not allow creating an action there'
);

select ok(
  public.create_action(
    'Mixed site A write',
    null,
    'normal',
    (select id from workplace_ids where key = 'site_a')
  ) is not null,
  'site A action creation remains available'
);

select * from finish();
rollback;
