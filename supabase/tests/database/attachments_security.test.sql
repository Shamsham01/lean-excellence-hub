begin;

select plan(8);

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
    '81000000-0000-0000-0000-000000000001',
    'attachment-owner-a@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    'attachment-owner-b@example.test',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    false
  );

create temporary table attachment_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on attachment_ids to authenticated;

insert into attachment_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      '81000000-0000-0000-0000-000000000001',
      'attachment-tenant-a',
      'Attachment Tenant A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      '81000000-0000-0000-0000-000000000002',
      'attachment-tenant-b',
      'Attachment Tenant B'
    )
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '82000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    '82000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"82000000-0000-0000-0000-000000000001","email":"attachment-owner-a@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from attachment_ids where key = 'org_a')),
  'tenant A owner selects organisation'
);

insert into attachment_ids (key, id)
select 'action', public.create_action('Attachment target action');

insert into attachment_ids (key, id)
select 'attachment', upload_row.attachment_id
from public.initiate_attachment_upload(
  (select id from attachment_ids where key = 'action'),
  'evidence.pdf',
  'application/pdf',
  1024
) upload_row;

select is(
  (
    select count(*)
    from public.attachments attachment_row
    where attachment_row.id = (select id from attachment_ids where key = 'attachment')
  ),
  0::bigint,
  'pending uploads are hidden from attachment readers'
);

select ok(
  public.confirm_attachment_upload(
    (select id from attachment_ids where key = 'attachment')
  ),
  'pending uploads can be confirmed'
);

select is(
  (
    select attachment_row.lifecycle
    from public.attachments attachment_row
    where attachment_row.id = (select id from attachment_ids where key = 'attachment')
  ),
  'active',
  'confirmed attachments become active'
);

select is(
  (
    select attachment_row.scan_state
    from public.attachments attachment_row
    where attachment_row.id = (select id from attachment_ids where key = 'attachment')
  ),
  'not_required',
  'attachments default scan_state to not_required'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"82000000-0000-0000-0000-000000000002","email":"attachment-owner-b@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from attachment_ids where key = 'org_b')),
  'tenant B owner selects organisation'
);

select is(
  (
    select count(*)
    from public.attachments attachment_row
    where attachment_row.id = (select id from attachment_ids where key = 'attachment')
  ),
  0::bigint,
  'tenant B cannot read tenant A attachments'
);

reset role;

select ok(
  exists (
    select 1
    from storage.buckets bucket_row
    where bucket_row.id = 'organisation-evidence'
      and bucket_row.public = false
  ),
  'organisation-evidence bucket is private'
);

select * from finish();
rollback;
