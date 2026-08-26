begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b8000000-0000-0000-0000-000000000001',
  'benefit-queries-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b8000000-0000-0000-0000-000000000002',
  'benefit-queries-scoped@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table query_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on query_ids to authenticated;

insert into query_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b8000000-0000-0000-0000-000000000001',
    'benefit-queries-org',
    'Benefit Queries Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'b8100000-0000-0000-0000-000000000001',
  'b8000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'b8100000-0000-0000-0000-000000000002',
  'b8000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b8100000-0000-0000-0000-000000000001","email":"benefit-queries-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from query_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into query_ids (key, id)
select 'unit_a', public.create_organisation_unit(
  (select id from query_ids where key = 'organisation'),
  null,
  'unit-a',
  'Unit A',
  'site'
);

insert into query_ids (key, id)
select 'unit_b', public.create_organisation_unit(
  (select id from query_ids where key = 'organisation'),
  null,
  'unit-b',
  'Unit B',
  'site'
);

insert into query_ids (key, id)
select 'benefit_a', public.create_benefit_draft(
  'Scoped unit benefit',
  (select id from query_ids where key = 'unit_a'),
  'non_financial',
  'Visible within unit A scope',
  null,
  'quality',
  null,
  null,
  true
);

insert into query_ids (key, id)
select 'benefit_b', public.create_benefit_draft(
  'Out of scope benefit',
  (select id from query_ids where key = 'unit_b'),
  'non_financial',
  'Outside unit A scope',
  null,
  'delivery',
  null,
  null,
  true
);

reset role;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    (select id from query_ids where key = 'organisation'),
    'b8000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into query_ids (key, id)
select 'scoped_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'b8000000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b8100000-0000-0000-0000-000000000001","email":"benefit-queries-owner@example.test"}',
  true
);
set local role authenticated;

insert into query_ids (key, id)
select 'reader_role_version', public.create_role_draft(
  (select id from query_ids where key = 'organisation'),
  'benefit-unit-reader',
  'Benefit Unit Reader',
  'Read benefits within assigned unit subtree'
);

select ok(
  public.add_role_permission(
    (select id from query_ids where key = 'organisation'),
    (select id from query_ids where key = 'reader_role_version'),
    'benefits.read'
  ),
  'scoped reader role receives benefits.read'
);

select ok(
  public.publish_role_version(
    (select id from query_ids where key = 'organisation'),
    (select id from query_ids where key = 'reader_role_version')
  ),
  'scoped reader role publishes'
);

insert into query_ids (key, id)
select 'scoped_grant', public.grant_role_version(
  (select id from query_ids where key = 'organisation'),
  (select id from query_ids where key = 'scoped_membership'),
  (select id from query_ids where key = 'reader_role_version'),
  'unit_subtree',
  (select id from query_ids where key = 'unit_a')
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b8000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b8100000-0000-0000-0000-000000000002","email":"benefit-queries-scoped@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from query_ids where key = 'organisation')),
  'scoped reader selects organisation'
);

select ok(
  public.get_benefit_detail((select id from query_ids where key = 'benefit_a')) ->> 'title'
    = 'Scoped unit benefit',
  'scoped reader can access in-scope benefit detail'
);

select throws_ok(
  format(
    'select public.get_benefit_detail(%L::uuid)',
    (select id from query_ids where key = 'benefit_b')
  ),
  'benefit detail is not authorised',
  '42501'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      (public.get_benefits_list(null, null, null, null, null, null, null, null, 1, 50) -> 'items')
    ) item
    where item ->> 'id' = (select id::text from query_ids where key = 'benefit_b')
  ),
  'benefits list does not leak out-of-scope benefit'
);

select ok(
  (
    select (public.get_benefits_overview() -> 'status_pipeline' ->> 'draft')::integer
  ) = 1,
  'benefits overview counts only in-scope benefits'
);

select * from finish();
rollback;
