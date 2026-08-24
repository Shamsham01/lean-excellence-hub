begin;

select plan(19);

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
    '50000000-0000-0000-0000-000000000001',
    'hierarchy-owner-a@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'hierarchy-owner-b@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table hierarchy_ids (
  key text primary key,
  id uuid not null
) on commit drop;
grant all on hierarchy_ids to authenticated;

insert into hierarchy_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '50000000-0000-0000-0000-000000000001',
      'hierarchy-a',
      'Hierarchy A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '50000000-0000-0000-0000-000000000002',
      'hierarchy-b',
      'Hierarchy B'
    )
  );

with inserted_unit as (
  insert into public.organisation_units (
    organisation_id,
    code,
    name,
    unit_type
  )
  values (
    (select id from hierarchy_ids where key = 'org_b'),
    'foreign-root',
    'Foreign root',
    'division'
  )
  returning organisation_id, id
),
inserted_closure as (
  insert into public.organisation_unit_closure (
    organisation_id,
    ancestor_unit_id,
    descendant_unit_id,
    depth
  )
  select organisation_id, id, id, 0
  from inserted_unit
)
insert into hierarchy_ids (key, id)
select 'foreign_root', id from inserted_unit;

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"60000000-0000-0000-0000-000000000001","email":"hierarchy-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation(
    (select id from hierarchy_ids where key = 'org_a')
  ),
  'owner selects the hierarchy organisation'
);

insert into hierarchy_ids (key, id)
select
  'root',
  public.create_organisation_unit(
    (select id from hierarchy_ids where key = 'org_a'),
    null,
    'root',
    'Root',
    'division'
  );
select ok(
  (select id is not null from hierarchy_ids where key = 'root'),
  'root unit is created'
);

insert into hierarchy_ids (key, id)
select
  'child',
  public.create_organisation_unit(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'root'),
    'child',
    'Child',
    'department'
  );
select ok(
  (select id is not null from hierarchy_ids where key = 'child'),
  'child unit is created'
);

insert into hierarchy_ids (key, id)
select
  'leaf',
  public.create_organisation_unit(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'child'),
    'leaf',
    'Leaf',
    'team'
  );
select ok(
  (select id is not null from hierarchy_ids where key = 'leaf'),
  'leaf unit is created'
);

insert into hierarchy_ids (key, id)
select
  'other_root',
  public.create_organisation_unit(
    (select id from hierarchy_ids where key = 'org_a'),
    null,
    'other-root',
    'Other root',
    'division'
  );
select ok(
  (select id is not null from hierarchy_ids where key = 'other_root'),
  'second root unit is created'
);

select is(
  (
    select depth
    from public.organisation_unit_closure
    where organisation_id = (select id from hierarchy_ids where key = 'org_a')
      and ancestor_unit_id = (select id from hierarchy_ids where key = 'root')
      and descendant_unit_id = (select id from hierarchy_ids where key = 'leaf')
  ),
  2::smallint,
  'closure records the full ancestor depth'
);

select throws_ok(
  format(
    'select public.move_organisation_unit(%L::uuid, %L::uuid, %L::uuid)',
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'root'),
    (select id from hierarchy_ids where key = 'leaf')
  ),
  '23514',
  null,
  'moving a unit beneath its descendant is rejected'
);

select throws_ok(
  format(
    'select public.create_organisation_unit(%L::uuid, %L::uuid, %L, %L, %L)',
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'foreign_root'),
    'cross-tenant',
    'Cross tenant',
    'team'
  ),
  '23514',
  null,
  'a parent from another tenant is rejected'
);

select throws_ok(
  format(
    'select public.set_organisation_unit_status(%L::uuid, %L::uuid, %L, %L)',
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'root'),
    'retired',
    'Premature retirement'
  ),
  '23514',
  null,
  'a unit with active descendants cannot be retired'
);

select ok(
  public.set_organisation_unit_status(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'leaf'),
    'retired',
    'Bottom-up retirement'
  ),
  'leaf can be retired'
);
select ok(
  public.set_organisation_unit_status(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'child'),
    'retired',
    'Bottom-up retirement'
  ),
  'child can be retired after its leaf'
);
select ok(
  public.set_organisation_unit_status(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'root'),
    'retired',
    'Bottom-up retirement'
  ),
  'root can be retired after descendants'
);

select throws_ok(
  format(
    'select public.set_organisation_unit_status(%L::uuid, %L::uuid, %L, %L)',
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'child'),
    'active',
    'Invalid restore order'
  ),
  '23514',
  null,
  'a child cannot be restored beneath a retired parent'
);

select ok(
  public.set_organisation_unit_status(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'root'),
    'active',
    'Top-down restoration'
  ),
  'root can be restored first'
);
select ok(
  public.set_organisation_unit_status(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'child'),
    'active',
    'Top-down restoration'
  ),
  'child can be restored after its parent'
);
select ok(
  public.set_organisation_unit_status(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'leaf'),
    'active',
    'Top-down restoration'
  ),
  'leaf can be restored last'
);

select ok(
  public.move_organisation_unit(
    (select id from hierarchy_ids where key = 'org_a'),
    (select id from hierarchy_ids where key = 'leaf'),
    (select id from hierarchy_ids where key = 'other_root')
  ),
  'a valid subtree move succeeds'
);

select is(
  (
    select count(*)
    from public.organisation_unit_closure
    where organisation_id = (select id from hierarchy_ids where key = 'org_a')
      and ancestor_unit_id = (select id from hierarchy_ids where key = 'root')
      and descendant_unit_id = (select id from hierarchy_ids where key = 'leaf')
  ),
  0::bigint,
  'a move removes obsolete closure paths'
);

select is(
  (
    select depth
    from public.organisation_unit_closure
    where organisation_id = (select id from hierarchy_ids where key = 'org_a')
      and ancestor_unit_id = (
        select id from hierarchy_ids where key = 'other_root'
      )
      and descendant_unit_id = (select id from hierarchy_ids where key = 'leaf')
  ),
  1::smallint,
  'a move creates the new closure path'
);

select * from finish();
rollback;
