begin;

select plan(15);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '97000000-0000-0000-0000-000000000001',
    'role-picker-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '97000000-0000-0000-0000-000000000002',
    'role-picker-subtree@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '97000000-0000-0000-0000-000000000003',
    'role-picker-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '97000000-0000-0000-0000-000000000004',
    'role-picker-other-org@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table role_picker_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on role_picker_ids to authenticated;

insert into role_picker_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '97000000-0000-0000-0000-000000000001',
    'role-picker-org',
    'Role Picker Org'
  )
);

insert into role_picker_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    '97000000-0000-0000-0000-000000000004',
    'role-picker-other-org',
    'Role Picker Other Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '98000000-0000-0000-0000-000000000001',
    '97000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '98000000-0000-0000-0000-000000000002',
    '97000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '98000000-0000-0000-0000-000000000003',
    '97000000-0000-0000-0000-000000000003',
    statement_timestamp(), statement_timestamp()
  );

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values
  (
    (select id from role_picker_ids where key = 'organisation'),
    '97000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  ),
  (
    (select id from role_picker_ids where key = 'organisation'),
    '97000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '97000000-0000-0000-0000-000000000002',
  '97000000-0000-0000-0000-000000000003'
);

-- Accumulate multiple published owner versions (historical defect pattern).
do $$
declare
  org_id uuid := (select id from role_picker_ids where key = 'organisation');
  owner_role_id uuid;
  owner_membership_id uuid;
  current_version_id uuid;
  current_version_number integer;
  successor_version_id uuid;
  i integer;
begin
  select r.id into owner_role_id
  from public.roles r
  where r.organisation_id = org_id and r.is_owner_role;

  select m.id into owner_membership_id
  from public.organisation_memberships m
  where m.organisation_id = org_id
    and m.user_id = '97000000-0000-0000-0000-000000000001';

  for i in 1..5 loop
    select rv.id, rv.version_number
    into current_version_id, current_version_number
    from public.role_versions rv
    where rv.organisation_id = org_id
      and rv.role_id = owner_role_id
      and rv.status = 'published'
    order by rv.version_number desc
    limit 1;

    insert into public.role_versions (
      organisation_id, role_id, version_number, status, created_by_membership_id
    )
    values (
      org_id, owner_role_id, current_version_number + 1, 'draft', owner_membership_id
    )
    returning id into successor_version_id;

    insert into public.role_permissions (organisation_id, role_version_id, permission_key)
    select org_id, successor_version_id, rp.permission_key
    from public.role_permissions rp
    where rp.organisation_id = org_id
      and rp.role_version_id = current_version_id;

    update public.role_versions
    set status = 'published',
        published_by_membership_id = owner_membership_id,
        published_at = statement_timestamp()
    where id = successor_version_id;
    -- Deliberately leave prior published versions in place (historical defect pattern).
  end loop;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"98000000-0000-0000-0000-000000000001","email":"role-picker-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from role_picker_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into role_picker_ids (key, id)
select 'operator_role_draft', public.create_protected_role_draft(
  (select id from role_picker_ids where key = 'organisation'),
  'role-picker-operator',
  'Role Picker Operator',
  'Delegatable operator role for picker tests'
);

select ok(
  public.add_role_permission(
    (select id from role_picker_ids where key = 'organisation'),
    (select id from role_picker_ids where key = 'operator_role_draft'),
    'actions.read'
  ),
  'operator role receives actions.read'
);

select ok(
  public.publish_role_version(
    (select id from role_picker_ids where key = 'organisation'),
    (select id from role_picker_ids where key = 'operator_role_draft')
  ),
  'operator role publishes'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    where offer ->> 'role_display_name' = 'Organisation Owner'
  ),
  1::bigint,
  'only one Organisation Owner offer is returned despite historical versions'
);

select is(
  (
    select offer ->> 'role_version_id'
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    where offer ->> 'role_display_name' = 'Organisation Owner'
  ),
  (
    select role_version.id::text
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = (
        select id from role_picker_ids where key = 'organisation'
      )
      and role_row.is_owner_role
      and role_version.status = 'published'
    order by role_version.version_number desc
    limit 1
  ),
  'owner offer uses the current published owner role version'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    where offer ->> 'role_display_name' = 'Role Picker Operator'
  ),
  'distinct non-owner roles remain available'
);

insert into role_picker_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from role_picker_ids where key = 'organisation'),
  null,
  'picker-root',
  'Picker Root',
  'site'
);

insert into role_picker_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from role_picker_ids where key = 'organisation'),
  (select id from role_picker_ids where key = 'root_unit'),
  'picker-child',
  'Picker Child',
  'department'
);

insert into role_picker_ids (key, id)
select 'delegate_role_draft', public.create_protected_role_draft(
  (select id from role_picker_ids where key = 'organisation'),
  'role-picker-delegate',
  'Role Picker Delegate',
  'Delegatable protected role for subtree tests'
);

select ok(
  public.add_role_permission(
    (select id from role_picker_ids where key = 'organisation'),
    (select id from role_picker_ids where key = 'delegate_role_draft'),
    'roles.delegate'
  ),
  'delegate role receives roles.delegate'
);

select ok(
  public.publish_role_version(
    (select id from role_picker_ids where key = 'organisation'),
    (select id from role_picker_ids where key = 'delegate_role_draft')
  ),
  'delegate role publishes'
);

insert into role_picker_ids (key, id)
select 'subtree_grant', public.grant_role_version(
  (select id from role_picker_ids where key = 'organisation'),
  (
    select id
    from public.organisation_memberships
    where organisation_id = (select id from role_picker_ids where key = 'organisation')
      and user_id = '97000000-0000-0000-0000-000000000002'
  ),
  (select id from role_picker_ids where key = 'delegate_role_draft'),
  'unit_subtree',
  (select id from role_picker_ids where key = 'child_unit')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"98000000-0000-0000-0000-000000000002","email":"role-picker-subtree@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from role_picker_ids where key = 'organisation')),
  'subtree delegator selects organisation'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    where offer ->> 'role_display_name' = 'Organisation Owner'
  ),
  'unit-scoped delegate cannot offer owner role'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_unit_id' = (
      select id::text from role_picker_ids where key = 'root_unit'
    )
  ),
  'unit-scoped delegate remains restricted to delegated subtree'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"98000000-0000-0000-0000-000000000003","email":"role-picker-member@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from role_picker_ids where key = 'organisation')),
  'member without delegate permission selects organisation'
);

select ok(
  jsonb_array_length(public.get_delegatable_access_offers() -> 'offers') = 0,
  'member without delegation authority receives no offers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"98000000-0000-0000-0000-000000000001","email":"role-picker-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from role_picker_ids where key = 'organisation')),
  'owner re-selects organisation for cross-tenant offer check'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    join public.role_versions role_version
      on role_version.id = (offer ->> 'role_version_id')::uuid
    where role_version.organisation_id = (
      select id from role_picker_ids where key = 'other_organisation'
    )
  ),
  'cross-tenant roles never appear in offers'
);

select * from finish();
rollback;
