begin;

select plan(12);

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
    '94000000-0000-0000-0000-000000000001',
    'issue94-owner@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '94000000000000000000000000000001@workforce.invalid',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table issue94_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert on issue94_ids to authenticated, lean_hub_private_owner, service_role;

insert into issue94_ids (key, id)
values (
  'org',
  private.provision_organisation(
    '94000000-0000-0000-0000-000000000001',
    'issue94-org',
    'Issue 94 Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values (
  '94000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  statement_timestamp(),
  statement_timestamp()
);

set local role lean_hub_private_owner;

insert into public.organisation_units (
  organisation_id,
  code,
  name,
  unit_type,
  status
)
values
  (
    (select id from issue94_ids where key = 'org'),
    'exeter',
    'Exeter',
    'site',
    'active'
  ),
  (
    (select id from issue94_ids where key = 'org'),
    'bodmin',
    'Bodmin',
    'site',
    'active'
  );

insert into issue94_ids (key, id)
select 'exeter_site', id
from public.organisation_units
where organisation_id = (select id from issue94_ids where key = 'org')
  and code = 'exeter';

insert into issue94_ids (key, id)
select 'bodmin_site', id
from public.organisation_units
where organisation_id = (select id from issue94_ids where key = 'org')
  and code = 'bodmin';

insert into public.organisation_units (
  organisation_id,
  parent_unit_id,
  code,
  name,
  unit_type,
  status
)
select
  (select id from issue94_ids where key = 'org'),
  (select id from issue94_ids where key = 'exeter_site'),
  'ex-ops',
  'Operations',
  'department',
  'active'
union all
select
  (select id from issue94_ids where key = 'org'),
  (select id from issue94_ids where key = 'bodmin_site'),
  'bo-ops',
  'Operations',
  'department',
  'active';

select isnt(
  private.format_delegatable_scope_label(
    (select id from issue94_ids where key = 'org'),
    (
      select id
      from public.organisation_units
      where organisation_id = (select id from issue94_ids where key = 'org')
        and code = 'ex-ops'
    ),
    'Operations'
  ),
  'Operations subtree',
  'duplicate unit names include site path context'
);

insert into issue94_ids (key, id)
select
  'workforce_membership',
  membership_registry.id
from public.organisation_memberships membership_registry
where membership_registry.organisation_id = (select id from issue94_ids where key = 'org')
  and membership_registry.user_id = '94000000-0000-0000-0000-000000000002';

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  display_name,
  status,
  activated_at
)
select
  (select id from issue94_ids where key = 'org'),
  '94000000-0000-0000-0000-000000000002',
  'Workforce Member',
  'active',
  statement_timestamp()
where not exists (
  select 1
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = (select id from issue94_ids where key = 'org')
    and membership_registry.user_id = '94000000-0000-0000-0000-000000000002'
);

insert into issue94_ids (key, id)
select
  'workforce_membership',
  membership_registry.id
from public.organisation_memberships membership_registry
where membership_registry.organisation_id = (select id from issue94_ids where key = 'org')
  and membership_registry.user_id = '94000000-0000-0000-0000-000000000002'
on conflict (key) do nothing;

select private.provision_workforce_identity(
  (select id from issue94_ids where key = 'org'),
  (select id from issue94_ids where key = 'workforce_membership'),
  '94000000-0000-0000-0000-000000000002',
  '94000000000000000000000000000001@workforce.invalid',
  'username',
  'wf.member'
);

insert into public.membership_notification_contacts (
  organisation_id,
  membership_id,
  channel_type,
  contact_address,
  status,
  source
)
values (
  (select id from issue94_ids where key = 'org'),
  (select id from issue94_ids where key = 'workforce_membership'),
  'email',
  'notify@example.test',
  'active',
  'manual'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"94000000-0000-0000-0000-000000000001","email":"issue94-owner@example.test"}',
  true
);

set local role authenticated;

select ok(
  public.switch_organisation((select id from issue94_ids where key = 'org')),
  'owner can switch into issue 94 organisation'
);

insert into issue94_ids (key, id)
select
  'import_job',
  public.create_workforce_import_job('issue94.csv');

set local role lean_hub_private_owner;

update public.workforce_import_jobs
set status = 'completed',
    provisioned_rows = 1,
    credential_export_status = 'available',
    credential_expires_at = statement_timestamp() + interval '1 day',
    completed_at = statement_timestamp()
where id = (select id from issue94_ids where key = 'import_job');

insert into public.workforce_import_rows (
  import_job_id,
  organisation_id,
  row_number,
  input_payload,
  resolved_payload,
  status
)
values (
  (select id from issue94_ids where key = 'import_job'),
  (select id from issue94_ids where key = 'org'),
  1,
  jsonb_build_object('first_name', 'Work', 'last_name', 'Force'),
  jsonb_build_object('username', 'wf.member'),
  'completed'
);

insert into issue94_ids (key, id)
select
  'import_row',
  import_row.id
from public.workforce_import_rows import_row
where import_row.import_job_id = (select id from issue94_ids where key = 'import_job')
limit 1;

select public.store_workforce_import_row_credential(
  (select id from issue94_ids where key = 'import_row'),
  decode('001122', 'hex'),
  decode('aabbccddeeff001122334455', 'hex'),
  statement_timestamp() + interval '1 day'
);

set local role authenticated;

select is(
  public.get_membership_administration_profile(
    (select id from issue94_ids where key = 'workforce_membership')
  ) ->> 'username',
  'wf.member',
  'administration profile exposes workforce username'
);

select is(
  public.get_membership_administration_profile(
    (select id from issue94_ids where key = 'workforce_membership')
  ) ->> 'notification_email',
  'notify@example.test',
  'administration profile exposes notification email'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      coalesce(
        public.get_people_directory(null, 1, 50, false) -> 'people',
        '[]'::jsonb
      )
    ) directory_person
    where directory_person ->> 'membership_id' = (
      select id::text from issue94_ids where key = 'workforce_membership'
    )
      and directory_person ->> 'display_name' = 'Workforce Member'
  ),
  'org owner people directory lists workforce member by display_name'
);

create temporary table issue94_export_session (
  session_id uuid not null
) on commit drop;

insert into issue94_export_session (session_id)
select (
  public.begin_workforce_import_credential_export(
    (select id from issue94_ids where key = 'import_job')
  ) ->> 'session_id'
)::uuid;

select ok(
  (select session_id is not null from issue94_export_session),
  'begin export creates resumable session'
);

select is(
  public.get_workforce_import_job_progress(
    (select id from issue94_ids where key = 'import_job')
  ) ->> 'credential_export_status',
  'exporting',
  'export session stays active before acknowledgement'
);

select lives_ok(
  $$
    select public.assert_workforce_import_credential_export_access(
      (select id from issue94_ids where key = 'import_job'),
      (select session_id from issue94_export_session)
    );
  $$,
  'authorized importer can assert active export session access'
);

select lives_ok(
  $$
    select public.ack_workforce_import_credentials_exported(
      (select id from issue94_ids where key = 'import_job'),
      (select session_id from issue94_export_session)
    );
  $$,
  'acknowledgement finalises export after client receipt'
);

select is(
  public.get_workforce_import_job_progress(
    (select id from issue94_ids where key = 'import_job')
  ) ->> 'credential_export_status',
  'exported',
  'acknowledgement clears export session state'
);

select ok(
  public.archive_workforce_import_job(
    (select id from issue94_ids where key = 'import_job')
  ),
  'import job can be archived from recent list'
);

select throws_ok(
  $$
    select public.set_membership_status(
      (select id from issue94_ids where key = 'org'),
      (
        select membership_registry.id
        from public.organisation_memberships membership_registry
        where membership_registry.organisation_id = (select id from issue94_ids where key = 'org')
          and membership_registry.user_id = '94000000-0000-0000-0000-000000000001'
      ),
      'inactive',
      'Attempted deactivation'
    );
  $$,
  '23514',
  'last active organisation owner cannot be inactivated'
);

select * from finish();

rollback;
