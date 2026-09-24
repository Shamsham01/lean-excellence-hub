begin;

select plan(14);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'sug-evidence-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'sug-evidence-author@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'sug-evidence-peer@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'sug-evidence-outsider@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table sug_evidence_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on sug_evidence_ids to authenticated;

insert into sug_evidence_ids (key, id)
values
  (
    'org_a',
    private.provision_organisation(
      'e1000000-0000-0000-0000-000000000001',
      'sug-evidence-org-a',
      'Suggestion Evidence Org A'
    )
  ),
  (
    'org_b',
    private.provision_organisation(
      'e1000000-0000-0000-0000-000000000004',
      'sug-evidence-org-b',
      'Suggestion Evidence Org B'
    )
  );

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at
)
values
  (
    (select id from sug_evidence_ids where key = 'org_a'),
    'e1000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  ),
  (
    (select id from sug_evidence_ids where key = 'org_a'),
    'e1000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'e1000000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000003'
);

insert into sug_evidence_ids (key, id)
select 'author_membership', id
from public.organisation_memberships
where organisation_id = (select id from sug_evidence_ids where key = 'org_a')
  and user_id = 'e1000000-0000-0000-0000-000000000002';

insert into sug_evidence_ids (key, id)
select 'peer_membership', id
from public.organisation_memberships
where organisation_id = (select id from sug_evidence_ids where key = 'org_a')
  and user_id = 'e1000000-0000-0000-0000-000000000003';

insert into sug_evidence_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from sug_evidence_ids where key = 'org_a')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000002',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'e2000000-0000-0000-0000-000000000003',
    'e1000000-0000-0000-0000-000000000003',
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'e2000000-0000-0000-0000-000000000004',
    'e1000000-0000-0000-0000-000000000004',
    statement_timestamp(),
    statement_timestamp()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"e2000000-0000-0000-0000-000000000001","email":"sug-evidence-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sug_evidence_ids where key = 'org_a')),
  'owner selects organisation A'
);

insert into sug_evidence_ids (key, id)
select 'site', public.create_organisation_unit(
  (select id from sug_evidence_ids where key = 'org_a'),
  null,
  'evidence-site',
  'Evidence Site',
  'site'
);

insert into sug_evidence_ids (key, id)
select 'job_function', public.create_job_function('Operator', 'operator');

select ok(
  public.grant_role_version(
    (select id from sug_evidence_ids where key = 'org_a'),
    (select id from sug_evidence_ids where key = 'author_membership'),
    (select id from sug_evidence_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from sug_evidence_ids where key = 'site')
  ) is not null,
  'author receives team-member role without attachments.upload'
);

select ok(
  public.grant_role_version(
    (select id from sug_evidence_ids where key = 'org_a'),
    (select id from sug_evidence_ids where key = 'peer_membership'),
    (select id from sug_evidence_ids where key = 'team_member_role_version'),
    'unit_subtree',
    (select id from sug_evidence_ids where key = 'site')
  ) is not null,
  'peer receives team-member role'
);

select ok(
  public.assign_membership_job_function(
    (select id from sug_evidence_ids where key = 'author_membership'),
    (select id from sug_evidence_ids where key = 'job_function'),
    true,
    (select id from sug_evidence_ids where key = 'site')
  ) is not null,
  'author primary assignment is set'
);

insert into sug_evidence_ids (key, id)
select 'programme', public.create_suggestion_programme_draft(
  'Everyday ideas',
  'everyday-ideas',
  'Shop-floor ideas'
);

insert into sug_evidence_ids (key, id)
select 'programme_version', version_row.id
from public.suggestion_programme_versions version_row
where version_row.programme_id = (select id from sug_evidence_ids where key = 'programme')
  and version_row.version_number = 1;

select ok(
  public.publish_suggestion_programme_version(
    (select id from sug_evidence_ids where key = 'programme_version')
  ),
  'programme publishes'
);

insert into sug_evidence_ids (key, id)
select 'category', public.create_suggestion_category('Quality', 'quality', null, 1);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"e2000000-0000-0000-0000-000000000002","email":"sug-evidence-author@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sug_evidence_ids where key = 'org_a')),
  'author selects organisation A'
);

insert into sug_evidence_ids (key, id)
select 'suggestion', public.create_suggestion_draft(
  (select id from sug_evidence_ids where key = 'programme_version'),
  (select id from sug_evidence_ids where key = 'category'),
  'Label holders',
  'Labels go missing during changeover',
  'Fit a holder at the station'
);

insert into sug_evidence_ids (key, id)
select 'attachment', upload_row.attachment_id
from public.initiate_attachment_upload(
  (select id from sug_evidence_ids where key = 'suggestion'),
  'floor.jpg',
  'image/jpeg',
  2048
) upload_row;

select ok(
  (select id from sug_evidence_ids where key = 'attachment') is not null,
  'author can initiate evidence upload without attachments.upload'
);

select throws_ok(
  format(
    'select public.initiate_attachment_upload(%L::uuid, %L, %L, %s)',
    (select id from sug_evidence_ids where key = 'suggestion'),
    'payload.exe',
    'application/x-msdownload',
    2048
  ),
  '22023',
  'attachment file type or size is not allowed',
  'backend rejects unsupported evidence types'
);

select throws_ok(
  format(
    'select public.initiate_attachment_upload(%L::uuid, %L, %L, %s)',
    (select id from sug_evidence_ids where key = 'suggestion'),
    'huge.pdf',
    'application/pdf',
    10485761
  ),
  '22023',
  'attachment file type or size is not allowed',
  'backend rejects oversized evidence'
);

select ok(
  public.confirm_attachment_upload((select id from sug_evidence_ids where key = 'attachment')),
  'author can confirm their suggestion evidence'
);

select is(
  (
    select count(*)
    from public.attachments attachment_row
    where attachment_row.id = (select id from sug_evidence_ids where key = 'attachment')
      and attachment_row.lifecycle = 'active'
  ),
  1::bigint,
  'author can read confirmed suggestion evidence without attachments.read'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"e2000000-0000-0000-0000-000000000003","email":"sug-evidence-peer@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sug_evidence_ids where key = 'org_a')),
  'peer selects organisation A'
);

select throws_ok(
  format(
    'select public.initiate_attachment_upload(%L::uuid, %L, %L, %s)',
    (select id from sug_evidence_ids where key = 'suggestion'),
    'peer.jpg',
    'image/jpeg',
    1024
  ),
  '42501',
  'attachment upload is not authorised',
  'non-author submitter cannot attach to another member idea without attachments.upload'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"e2000000-0000-0000-0000-000000000004","email":"sug-evidence-outsider@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from sug_evidence_ids where key = 'org_b')),
  'outsider selects organisation B'
);

select throws_ok(
  format(
    'select public.initiate_attachment_upload(%L::uuid, %L, %L, %s)',
    (select id from sug_evidence_ids where key = 'suggestion'),
    'forged.jpg',
    'image/jpeg',
    1024
  ),
  '42501',
  'attachment upload is not authorised',
  'cross-organisation attachment identifiers are rejected'
);

select is(
  (
    select count(*)
    from public.attachments attachment_row
    where attachment_row.id = (select id from sug_evidence_ids where key = 'attachment')
  ),
  0::bigint,
  'cross-organisation readers cannot see suggestion evidence'
);

select * from finish();
rollback;
