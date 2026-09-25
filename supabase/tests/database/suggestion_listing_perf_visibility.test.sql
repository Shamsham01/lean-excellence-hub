begin;

select plan(37);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'e4000000-0000-0000-0000-000000000001',
  'list-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'e4000000-0000-0000-0000-000000000002',
  'list-bodmin@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'e4000000-0000-0000-0000-000000000003',
  'list-exeter@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'e4000000-0000-0000-0000-000000000004',
  'list-self@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'e4000000-0000-0000-0000-000000000005',
  'list-other-org@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table list_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on list_ids to authenticated;

insert into list_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'e4000000-0000-0000-0000-000000000001',
    'list-perf-org',
    'List Perf Organisation'
  )
);

insert into list_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'e4000000-0000-0000-0000-000000000005',
    'list-perf-other-org',
    'List Perf Other Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'e4100000-0000-0000-0000-000000000001',
  'e4000000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'e4100000-0000-0000-0000-000000000002',
  'e4000000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
),
(
  'e4100000-0000-0000-0000-000000000003',
  'e4000000-0000-0000-0000-000000000003',
  statement_timestamp(), statement_timestamp()
),
(
  'e4100000-0000-0000-0000-000000000004',
  'e4000000-0000-0000-0000-000000000004',
  statement_timestamp(), statement_timestamp()
),
(
  'e4100000-0000-0000-0000-000000000005',
  'e4000000-0000-0000-0000-000000000005',
  statement_timestamp(), statement_timestamp()
);

insert into list_ids (key, id)
select 'owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from list_ids where key = 'organisation')
  and membership_row.user_id = 'e4000000-0000-0000-0000-000000000001';

insert into list_ids (key, id)
select 'other_owner_membership', membership_row.id
from public.organisation_memberships membership_row
where membership_row.organisation_id = (select id from list_ids where key = 'other_organisation')
  and membership_row.user_id = 'e4000000-0000-0000-0000-000000000005';

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values
    (
      (select id from list_ids where key = 'organisation'),
      'e4000000-0000-0000-0000-000000000002',
      'active',
      statement_timestamp()
    )
  returning id
)
insert into list_ids (key, id)
select 'bodmin_membership', id from inserted_membership;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values
    (
      (select id from list_ids where key = 'organisation'),
      'e4000000-0000-0000-0000-000000000003',
      'active',
      statement_timestamp()
    )
  returning id
)
insert into list_ids (key, id)
select 'exeter_membership', id from inserted_membership;

with inserted_membership as (
  insert into public.organisation_memberships (
    organisation_id, user_id, status, activated_at
  )
  values
    (
      (select id from list_ids where key = 'organisation'),
      'e4000000-0000-0000-0000-000000000004',
      'active',
      statement_timestamp()
    )
  returning id
)
insert into list_ids (key, id)
select 'self_membership', id from inserted_membership;

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'e4000000-0000-0000-0000-000000000002',
  'e4000000-0000-0000-0000-000000000003',
  'e4000000-0000-0000-0000-000000000004'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e4100000-0000-0000-0000-000000000001","email":"list-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from list_ids where key = 'organisation')),
  'owner selects listing organisation'
);

insert into list_ids (key, id)
select 'bodmin_site', public.create_organisation_unit(
  (select id from list_ids where key = 'organisation'),
  null,
  'list-bodmin',
  'Bodmin Site',
  'site'
);

insert into list_ids (key, id)
select 'exeter_site', public.create_organisation_unit(
  (select id from list_ids where key = 'organisation'),
  null,
  'list-exeter',
  'Exeter Site',
  'site'
);

select ok(
  private.organisation_requires_site_boundary(
    (select id from list_ids where key = 'organisation')
  ),
  'two-site organisation requires site boundary'
);

insert into list_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.assign_membership_job_function(
    (select id from list_ids where key = 'owner_membership'),
    (select id from list_ids where key = 'job_function'),
    true,
    (select id from list_ids where key = 'bodmin_site')
  ) is not null,
  'owner primary placement at Bodmin'
);

select ok(
  public.assign_membership_job_function(
    (select id from list_ids where key = 'bodmin_membership'),
    (select id from list_ids where key = 'job_function'),
    true,
    (select id from list_ids where key = 'bodmin_site')
  ) is not null,
  'Bodmin member primary placement'
);

select ok(
  public.assign_membership_job_function(
    (select id from list_ids where key = 'exeter_membership'),
    (select id from list_ids where key = 'job_function'),
    true,
    (select id from list_ids where key = 'exeter_site')
  ) is not null,
  'Exeter member primary placement'
);

select ok(
  public.assign_membership_job_function(
    (select id from list_ids where key = 'self_membership'),
    (select id from list_ids where key = 'job_function'),
    true,
    (select id from list_ids where key = 'bodmin_site')
  ) is not null,
  'self-scoped member primary placement at Bodmin'
);

insert into list_ids (key, id)
select 'programme', public.create_suggestion_programme_draft(
  'Listing Ideas', 'listing-ideas', 'listing programme'
);

insert into list_ids (key, id)
select 'programme_version', programme_version.id
from public.suggestion_programme_versions programme_version
where programme_version.programme_id = (select id from list_ids where key = 'programme')
  and programme_version.version_number = 1;

select ok(
  public.publish_suggestion_programme_version(
    (select id from list_ids where key = 'programme_version')
  ),
  'programme version publishes'
);

insert into list_ids (key, id)
select 'category', public.create_suggestion_category('Safety', 'safety');

insert into list_ids (key, id)
select 'site_read_role', public.create_role_draft(
  (select id from list_ids where key = 'organisation'),
  'list-site-reader',
  'List Site Reader',
  'Site-scoped suggestion read and submit'
);

select ok(
  public.add_role_permission(
    (select id from list_ids where key = 'organisation'),
    (select id from list_ids where key = 'site_read_role'),
    'suggestions.read'
  ),
  'site reader role receives suggestions.read'
);

select ok(
  public.add_role_permission(
    (select id from list_ids where key = 'organisation'),
    (select id from list_ids where key = 'site_read_role'),
    'suggestions.submit'
  ),
  'site reader role receives suggestions.submit'
);

select ok(
  public.publish_role_version(
    (select id from list_ids where key = 'organisation'),
    (select id from list_ids where key = 'site_read_role')
  ),
  'site reader role publishes'
);

insert into list_ids (key, id)
select 'self_role', public.create_role_draft(
  (select id from list_ids where key = 'organisation'),
  'list-self-reader',
  'List Self Reader',
  'Self-scoped suggestion read and submit'
);

select ok(
  public.add_role_permission(
    (select id from list_ids where key = 'organisation'),
    (select id from list_ids where key = 'self_role'),
    'suggestions.read'
  ),
  'self role receives suggestions.read'
);

select ok(
  public.add_role_permission(
    (select id from list_ids where key = 'organisation'),
    (select id from list_ids where key = 'self_role'),
    'suggestions.submit'
  ),
  'self role receives suggestions.submit'
);

select ok(
  public.publish_role_version(
    (select id from list_ids where key = 'organisation'),
    (select id from list_ids where key = 'self_role')
  ),
  'self role publishes'
);

insert into list_ids (key, id)
select 'bodmin_grant', public.grant_role_version(
  (select id from list_ids where key = 'organisation'),
  (select id from list_ids where key = 'bodmin_membership'),
  (select id from list_ids where key = 'site_read_role'),
  'unit_subtree',
  (select id from list_ids where key = 'bodmin_site')
);

insert into list_ids (key, id)
select 'exeter_grant', public.grant_role_version(
  (select id from list_ids where key = 'organisation'),
  (select id from list_ids where key = 'exeter_membership'),
  (select id from list_ids where key = 'site_read_role'),
  'unit_subtree',
  (select id from list_ids where key = 'exeter_site')
);

insert into list_ids (key, id)
select 'self_grant', public.grant_role_version(
  (select id from list_ids where key = 'organisation'),
  (select id from list_ids where key = 'self_membership'),
  (select id from list_ids where key = 'self_role'),
  'self',
  null
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"e4100000-0000-0000-0000-000000000002","email":"list-bodmin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from list_ids where key = 'organisation')),
  'Bodmin member selects organisation'
);

insert into list_ids (key, id)
select 'bodmin_suggestion', public.create_suggestion_draft(
  (select id from list_ids where key = 'programme_version'),
  (select id from list_ids where key = 'category'),
  'Bodmin listing idea',
  'Problem at Bodmin',
  'Idea at Bodmin',
  'Benefit at Bodmin'
);

select ok(
  public.submit_suggestion((select id from list_ids where key = 'bodmin_suggestion')),
  'Bodmin suggestion submits'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e4000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"e4100000-0000-0000-0000-000000000003","email":"list-exeter@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from list_ids where key = 'organisation')),
  'Exeter member selects organisation'
);

insert into list_ids (key, id)
select 'exeter_suggestion', public.create_suggestion_draft(
  (select id from list_ids where key = 'programme_version'),
  (select id from list_ids where key = 'category'),
  'Exeter listing idea',
  'Problem at Exeter',
  'Idea at Exeter',
  'Benefit at Exeter'
);

select ok(
  public.submit_suggestion((select id from list_ids where key = 'exeter_suggestion')),
  'Exeter suggestion submits'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e4000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"e4100000-0000-0000-0000-000000000004","email":"list-self@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from list_ids where key = 'organisation')),
  'self-scoped member selects organisation'
);

insert into list_ids (key, id)
select 'self_suggestion', public.create_suggestion_draft(
  (select id from list_ids where key = 'programme_version'),
  (select id from list_ids where key = 'category'),
  'Self listing idea',
  'Problem from self author',
  'Idea from self author',
  'Benefit from self author'
);

select ok(
  public.submit_suggestion((select id from list_ids where key = 'self_suggestion')),
  'self-authored suggestion submits'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e4000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"e4100000-0000-0000-0000-000000000005","email":"list-other-org@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from list_ids where key = 'other_organisation')),
  'other-org owner selects empty organisation'
);

select is(
  (public.get_suggestion_portfolio(
    null, null, null, null, null, 'newest', 1, 25, 'all'
  ) ->> 'total_count')::integer,
  0,
  'empty organisation portfolio total_count is 0'
);

select is(
  jsonb_array_length(
    public.get_suggestion_portfolio(
      null, null, null, null, null, 'newest', 1, 25, 'all'
    ) -> 'items'
  ),
  0,
  'empty organisation portfolio items are empty'
);

select is(
  (public.get_suggestions_overview() ->> 'submitted_this_month')::integer,
  0,
  'empty organisation overview submitted_this_month is 0'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' in (
      (select id::text from list_ids where key = 'bodmin_suggestion'),
      (select id::text from list_ids where key = 'exeter_suggestion'),
      (select id::text from list_ids where key = 'self_suggestion')
    )
  ),
  'other-org owner cannot see listing organisation suggestions'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e4100000-0000-0000-0000-000000000001","email":"list-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from list_ids where key = 'organisation')),
  'owner re-selects listing organisation'
);

select is(
  (
    select array_agg(item_row ->> 'id' order by item_row ->> 'id')
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
  ),
  (
    select array_agg(suggestion_row.id::text order by suggestion_row.id::text)
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = (select id from list_ids where key = 'organisation')
      and private.can_read_improvement_suggestion(
        suggestion_row.organisation_id,
        suggestion_row.id
      )
  ),
  'authenticated owner portfolio ids match can_read oracle'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from list_ids where key = 'bodmin_suggestion')
  )
  and exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from list_ids where key = 'exeter_suggestion')
  ),
  'authenticated owner sees both site suggestions'
);

select is(
  (public.get_suggestions_overview() ->> 'submitted_this_month')::integer,
  (public.get_suggestion_portfolio(
    null, null, null, null, null, 'newest', 1, 25, 'all'
  ) ->> 'total_count')::integer,
  'unfiltered overview submitted_this_month matches unfiltered portfolio total'
);

select isnt(
  (public.get_suggestion_portfolio(
    'Bodmin listing idea', null, null, null, null, 'newest', 1, 25, 'all'
  ) ->> 'total_count')::integer,
  (public.get_suggestion_portfolio(
    null, null, null, null, null, 'newest', 1, 25, 'all'
  ) ->> 'total_count')::integer,
  'filtered portfolio total_count stays distinct from unfiltered total'
);

select is(
  (public.get_suggestion_portfolio(
    null, null, null, null, null, 'newest', 99, 25, 'all'
  ) ->> 'page')::integer,
  1,
  'out-of-range page clamps to the last available page'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"e4100000-0000-0000-0000-000000000002","email":"list-bodmin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from list_ids where key = 'organisation')),
  'Bodmin restricted member re-selects organisation'
);

select is(
  (
    select array_agg(item_row ->> 'id' order by item_row ->> 'id')
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
  ),
  (
    select array_agg(suggestion_row.id::text order by suggestion_row.id::text)
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = (select id from list_ids where key = 'organisation')
      and private.can_read_improvement_suggestion(
        suggestion_row.organisation_id,
        suggestion_row.id
      )
  ),
  'restricted Bodmin member portfolio ids match can_read oracle'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from list_ids where key = 'bodmin_suggestion')
  )
  and not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from list_ids where key = 'exeter_suggestion')
  ),
  'restricted Bodmin member cannot see Exeter-site suggestion'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e4000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"e4100000-0000-0000-0000-000000000004","email":"list-self@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from list_ids where key = 'organisation')),
  'self-scoped member re-selects organisation'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from list_ids where key = 'self_suggestion')
  )
  and not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from list_ids where key = 'bodmin_suggestion')
  )
  and not exists (
    select 1
    from jsonb_array_elements(
      public.get_suggestion_portfolio(
        null, null, null, null, null, 'newest', 1, 25, 'all'
      ) -> 'items'
    ) item_row
    where item_row ->> 'id' = (select id::text from list_ids where key = 'exeter_suggestion')
  ),
  'self-scoped member sees only own authored suggestion'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.get_suggestions_overview() $$,
  '42501',
  null,
  'anonymous callers cannot execute get_suggestions_overview'
);

select throws_ok(
  $$ select public.get_suggestion_portfolio(
    null, null, null, null, null, 'newest', 1, 25, 'all'
  ) $$,
  '42501',
  null,
  'anonymous callers cannot execute get_suggestion_portfolio'
);

select * from finish();
rollback;
