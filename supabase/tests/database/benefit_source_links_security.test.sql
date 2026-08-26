begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'b4000000-0000-0000-0000-000000000001',
  'benefit-source-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'b4000000-0000-0000-0000-000000000002',
  'benefit-source-reader@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table source_link_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on source_link_ids to authenticated;

insert into source_link_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b4000000-0000-0000-0000-000000000001',
    'benefit-source-org',
    'Benefit Source Link Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'b4100000-0000-0000-0000-000000000001',
  'b4000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'b4100000-0000-0000-0000-000000000002',
  'b4000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000001","email":"benefit-source-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from source_link_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into source_link_ids (key, id)
select 'unit_root', public.create_organisation_unit(
  (select id from source_link_ids where key = 'organisation'),
  null,
  'root-site',
  'Root Site',
  'site'
);

insert into source_link_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from source_link_ids where key = 'organisation')
  and membership_row.user_id = 'b4000000-0000-0000-0000-000000000001';

insert into source_link_ids (key, id)
select 'project', public.create_improvement_project(
  'Source project for benefit',
  (select id from source_link_ids where key = 'unit_root'),
  'Changeovers exceed target',
  'Reduce average changeover time',
  'Lower downtime'
);

insert into source_link_ids (key, id)
select 'benefit', public.create_benefit_from_ci_project(
  (select id from source_link_ids where key = 'project'),
  'financial',
  'Benefit from linked project',
  'Derived from CI project context',
  'hard_saving',
  null,
  null,
  null,
  null
);

select ok(
  exists (
    select 1
    from public.benefit_source_links link_row
    where link_row.benefit_id = (select id from source_link_ids where key = 'benefit')
      and link_row.source_resource_id = (select id from source_link_ids where key = 'project')
      and link_row.relationship_role = 'primary'
  ),
  'benefit links primary CI project source'
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
    (select id from source_link_ids where key = 'organisation'),
    'b4000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  )
  returning id
)
insert into source_link_ids (key, id)
select 'reader_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id = 'b4000000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000001","email":"benefit-source-owner@example.test"}',
  true
);
set local role authenticated;

insert into source_link_ids (key, id)
select 'reader_role_version', public.create_role_draft(
  (select id from source_link_ids where key = 'organisation'),
  'benefit-reader-only',
  'Benefit Reader Only',
  'Read benefits without project access'
);

select ok(
  public.add_role_permission(
    (select id from source_link_ids where key = 'organisation'),
    (select id from source_link_ids where key = 'reader_role_version'),
    'benefits.read'
  ),
  'reader role receives benefits.read'
);

select ok(
  public.publish_role_version(
    (select id from source_link_ids where key = 'organisation'),
    (select id from source_link_ids where key = 'reader_role_version')
  ),
  'reader role publishes'
);

insert into source_link_ids (key, id)
select 'reader_grant', public.grant_role_version(
  (select id from source_link_ids where key = 'organisation'),
  (select id from source_link_ids where key = 'reader_membership'),
  (select id from source_link_ids where key = 'reader_role_version'),
  'organisation',
  null
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b4100000-0000-0000-0000-000000000002","email":"benefit-source-reader@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from source_link_ids where key = 'organisation')),
  'reader selects organisation'
);

select ok(
  public.get_benefit_detail((select id from source_link_ids where key = 'benefit')) is not null,
  'benefits.read grants benefit detail access'
);

select throws_ok(
  format(
    'select public.get_ci_project_detail(%L::uuid)',
    (select id from source_link_ids where key = 'project')
  ),
  'project detail is not authorised',
  '42501'
);

select ok(
  not exists (
    select 1
    from public.ci_projects project_row
    where project_row.id = (select id from source_link_ids where key = 'project')
  ),
  'benefit source link does not grant direct project read'
);

select * from finish();
rollback;
