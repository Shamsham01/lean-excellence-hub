begin;

select plan(9);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '95000000-0000-0000-0000-000000000001',
    'picker-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    'picker-subtree@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '95000000-0000-0000-0000-000000000003',
    'picker-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table picker_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on picker_ids to authenticated;

insert into picker_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '95000000-0000-0000-0000-000000000001',
    'picker-org',
    'Picker Org'
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
  );

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values
  (
    (select id from picker_ids where key = 'organisation'),
    '95000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  ),
  (
    (select id from picker_ids where key = 'organisation'),
    '95000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  '95000000-0000-0000-0000-000000000002',
  '95000000-0000-0000-0000-000000000003'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000001","email":"picker-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from picker_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into picker_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from picker_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into picker_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from picker_ids where key = 'organisation'),
  (select id from picker_ids where key = 'root_unit'),
  'packing',
  'Packing',
  'department'
);

insert into picker_ids (key, id)
select 'sibling_unit', public.create_organisation_unit(
  (select id from picker_ids where key = 'organisation'),
  (select id from picker_ids where key = 'root_unit'),
  'production',
  'Production',
  'department'
);

insert into picker_ids (key, id)
select 'delegate_role_draft', public.create_role_draft(
  (select id from picker_ids where key = 'organisation'),
  'picker-delegate',
  'Picker Delegate',
  'Delegatable role for picker tests'
);

select ok(
  public.add_role_permission(
    (select id from picker_ids where key = 'organisation'),
    (select id from picker_ids where key = 'delegate_role_draft'),
    'roles.delegate'
  ),
  'delegate role receives roles.delegate'
);

select ok(
  public.publish_role_version(
    (select id from picker_ids where key = 'organisation'),
    (select id from picker_ids where key = 'delegate_role_draft')
  ),
  'delegate role publishes'
);

select ok(
  (
    select count(*) > 0
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_type' = 'organisation'
  ),
  'organisation-wide delegator receives organisation scope offers'
);

insert into picker_ids (key, id)
select 'subtree_grant', public.grant_role_version(
  (select id from picker_ids where key = 'organisation'),
  (
    select id
    from public.organisation_memberships
    where organisation_id = (select id from picker_ids where key = 'organisation')
      and user_id = '95000000-0000-0000-0000-000000000002'
  ),
  (select id from picker_ids where key = 'delegate_role_draft'),
  'unit_subtree',
  (select id from picker_ids where key = 'child_unit')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000002","email":"picker-subtree@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from picker_ids where key = 'organisation')),
  'subtree delegator selects organisation'
);

select ok(
  (
    select count(*) > 0
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_unit_id' = (
      select id::text from picker_ids where key = 'child_unit'
    )
  ),
  'unit-subtree delegator receives offers for delegated unit'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_unit_id' = (
      select id::text from picker_ids where key = 'sibling_unit'
    )
  ),
  'unit-subtree delegator cannot see sibling subtree offers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"96000000-0000-0000-0000-000000000003","email":"picker-member@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from picker_ids where key = 'organisation')),
  'member without delegate permission selects organisation'
);

select is(
  public.get_delegatable_access_offers() -> 'offers',
  '[]'::jsonb,
  'member without delegatable scope receives empty offers'
);

select * from finish();
rollback;
