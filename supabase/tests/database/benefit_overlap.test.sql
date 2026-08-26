begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  'b7000000-0000-0000-0000-000000000001',
  'benefit-overlap-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table overlap_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on overlap_ids to authenticated;

insert into overlap_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b7000000-0000-0000-0000-000000000001',
    'benefit-overlap-org',
    'Benefit Overlap Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  'b7100000-0000-0000-0000-000000000001',
  'b7000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b7000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b7100000-0000-0000-0000-000000000001","email":"benefit-overlap-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from overlap_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into overlap_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from overlap_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into overlap_ids (key, id)
select 'benefit_one', public.create_benefit_draft(
  'Overlap benefit one',
  (select id from overlap_ids where key = 'unit_root'),
  'non_financial',
  'First overlap candidate',
  null,
  'quality',
  null,
  null,
  true
);

insert into overlap_ids (key, id)
select 'benefit_two', public.create_benefit_draft(
  'Overlap benefit two',
  (select id from overlap_ids where key = 'unit_root'),
  'non_financial',
  'Second overlap candidate',
  null,
  'quality',
  null,
  null,
  true
);

reset role;

with inserted_group as (
  insert into public.benefit_overlap_groups (
    organisation_id,
    name,
    reason,
    created_by_membership_id
  )
  values (
    (select id from overlap_ids where key = 'organisation'),
    'Shared savings pool',
    'Overlapping hard savings',
    (
      select membership_row.id
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = (select id from overlap_ids where key = 'organisation')
        and membership_row.user_id = 'b7000000-0000-0000-0000-000000000001'
    )
  )
  returning id
)
insert into overlap_ids (key, id)
select 'overlap_group', id from inserted_group;

select set_config(
  'request.jwt.claims',
  '{"sub":"b7000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b7100000-0000-0000-0000-000000000001","email":"benefit-overlap-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  (select id from overlap_ids where key = 'overlap_group') is not null,
  'overlap group is seeded for allocation tests'
);

select ok(
  public.add_benefit_to_overlap_group(
    (select id from overlap_ids where key = 'overlap_group'),
    (select id from overlap_ids where key = 'benefit_one'),
    60,
    'Primary allocation'
  ) is not null,
  'first benefit allocation is accepted'
);

select ok(
  public.add_benefit_to_overlap_group(
    (select id from overlap_ids where key = 'overlap_group'),
    (select id from overlap_ids where key = 'benefit_two'),
    40,
    'Secondary allocation'
  ) is not null,
  'complementary allocations stay within 100 percent'
);

select throws_ok(
  format(
    'select public.update_benefit_overlap_allocation(%L::uuid, %L::uuid, %s, %L)',
    (select id from overlap_ids where key = 'overlap_group'),
    (select id from overlap_ids where key = 'benefit_two'),
    41,
    'Would exceed 100 percent'
  ),
  'active overlap allocations would exceed 100 percent',
  '23514'
);

insert into overlap_ids (key, id)
select 'benefit_three', public.create_benefit_draft(
  'Overlap benefit three',
  (select id from overlap_ids where key = 'unit_root'),
  'non_financial',
  'Third overlap candidate',
  null,
  'delivery',
  null,
  null,
  true
);

select throws_ok(
  format(
    'select public.add_benefit_to_overlap_group(%L::uuid, %L::uuid, %s, %L)',
    (select id from overlap_ids where key = 'overlap_group'),
    (select id from overlap_ids where key = 'benefit_three'),
    1,
    'No remaining capacity'
  ),
  'active overlap allocations would exceed 100 percent',
  '23514'
);

select ok(
  public.update_benefit_overlap_allocation(
    (select id from overlap_ids where key = 'overlap_group'),
    (select id from overlap_ids where key = 'benefit_one'),
    55,
    'Rebalance allocation'
  ) is not null,
  'allocation update supersedes prior row within limit'
);

reset role;

select is(
  (
    select allocation_percentage
    from public.benefit_overlap_allocation_history allocation_row
    where allocation_row.overlap_group_id = (select id from overlap_ids where key = 'overlap_group')
      and allocation_row.benefit_id = (select id from overlap_ids where key = 'benefit_one')
      and allocation_row.superseded_at is null
  ),
  55::numeric,
  'active allocation reflects latest percentage'
);

select * from finish();
rollback;
