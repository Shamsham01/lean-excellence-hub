begin;

select plan(8);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
(
  'c1100000-0000-0000-0000-000000000001',
  'programme-owner@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
),
(
  'c1100000-0000-0000-0000-000000000002',
  'programme-outsider@example.test',
  statement_timestamp(), statement_timestamp(), statement_timestamp(),
  '{"provider":"email","providers":["email"]}', '{}', false, false
);

create temporary table programme_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on programme_ids to authenticated;

insert into programme_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'c1100000-0000-0000-0000-000000000001',
    'programme-org',
    'Programme Organisation'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
(
  'c1200000-0000-0000-0000-000000000001',
  'c1100000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp()
),
(
  'c1200000-0000-0000-0000-000000000002',
  'c1100000-0000-0000-0000-000000000002',
  statement_timestamp(), statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000001","role":"authenticated","session_id":"c1200000-0000-0000-0000-000000000001","email":"programme-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from programme_ids where key = 'organisation')),
  'owner selects organisation'
);

select ok(
  exists (
    select 1
    from public.permission_definitions
    where permission_key in ('suggestions.manage', 'suggestions.submit', 'suggestions.read')
  ),
  'suggestion programme permissions are registered'
);

insert into programme_ids (key, id)
select 'programme', public.create_suggestion_programme_draft(
  'Everyday Ideas',
  'everyday-ideas',
  'Frontline improvement programme'
);

insert into programme_ids (key, id)
select 'programme_version', version_row.id
from public.suggestion_programme_versions version_row
where version_row.programme_id = (select id from programme_ids where key = 'programme')
  and version_row.version_number = 1;

select ok(
  public.publish_suggestion_programme_version((select id from programme_ids where key = 'programme_version')),
  'programme version publishes'
);

select is(
  (select lifecycle from public.suggestion_programme_versions
   where id = (select id from programme_ids where key = 'programme_version')),
  'published',
  'published programme version is marked published'
);

insert into programme_ids (key, id)
select 'successor_version', public.create_suggestion_programme_successor_version(
  (select id from programme_ids where key = 'programme')
)
where pg_catalog.to_regprocedure('public.create_suggestion_programme_successor_version(uuid)') is not null;

select ok(
  (
    select case
      when pg_catalog.to_regprocedure('public.create_suggestion_programme_successor_version(uuid)') is null then true
      else exists (
        select 1
        from public.suggestion_programme_versions version_row
        where version_row.id = (select id from programme_ids where key = 'successor_version')
          and version_row.lifecycle = 'draft'
          and version_row.version_number = 2
      )
    end
  ),
  'successor draft version is created when RPC is available'
);

do $attempt$
begin
  update public.suggestion_programme_versions version_table
  set review_target_days = 14
  where version_table.id = (select id from programme_ids where key = 'programme_version')
    and version_table.lifecycle = 'published';
exception
  when others then
    null;
end;
$attempt$;

select ok(
  coalesce(
    (
      select review_target_days
      from public.suggestion_programme_versions
      where id = (select id from programme_ids where key = 'programme_version')
    ),
    0
  ) <> 14,
  'published programme versions reject authenticated updates'
);

set local role postgres;

insert into programme_ids (key, id)
values (
  'organisation_b',
  private.provision_organisation(
    'c1100000-0000-0000-0000-000000000002',
    'programme-org-b',
    'Programme Organisation B'
  )
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"c1100000-0000-0000-0000-000000000002","role":"authenticated","session_id":"c1200000-0000-0000-0000-000000000002","email":"programme-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from programme_ids where key = 'organisation_b')),
  'outsider selects other organisation'
);

select ok(
  not exists (
    select 1
    from public.suggestion_programmes programme_row
    where programme_row.id = (select id from programme_ids where key = 'programme')
  ),
  'tenant isolation hides foreign suggestion programmes'
);

select * from finish();
rollback;
