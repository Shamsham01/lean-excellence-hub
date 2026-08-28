begin;

select plan(13);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    '91000000-0000-0000-0000-000000000001',
    'remediation-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'remediation-invitee@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table remediation_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert on remediation_ids to authenticated;

insert into remediation_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    '91000000-0000-0000-0000-000000000001',
    'remediation-org',
    'Remediation Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  );

insert into private.identity_controls (
  user_id,
  status,
  enrolment_status,
  enrolment_completed_at
)
values (
  '91000000-0000-0000-0000-000000000002',
  'active',
  'complete',
  statement_timestamp()
)
on conflict (user_id) do update
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp();

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000001","email":"remediation-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from remediation_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into remediation_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from remediation_ids where key = 'organisation'),
  null,
  'site-1',
  'Remediation Site',
  'site'
);

insert into remediation_ids (key, id)
select 'job_function', public.create_job_function('Team Leader', 'team-leader');

insert into remediation_ids (key, id)
select 'member_role_draft', public.create_role_draft(
  (select id from remediation_ids where key = 'organisation'),
  'organisation-member',
  'Organisation Member',
  'Delegatable member role for remediation invitation tests'
);

select ok(
  public.add_role_permission(
    (select id from remediation_ids where key = 'organisation'),
    (select id from remediation_ids where key = 'member_role_draft'),
    'hierarchy.read'
  ),
  'member role receives hierarchy.read'
);

select ok(
  public.publish_role_version(
    (select id from remediation_ids where key = 'organisation'),
    (select id from remediation_ids where key = 'member_role_draft')
  ),
  'member role publishes'
);

insert into remediation_ids (key, id)
select 'member_role_version', id
from remediation_ids
where key = 'member_role_draft';

select ok(
  (public.get_delegatable_access_offers() -> 'offers') is not null,
  'owner can read delegatable access offers'
);

select ok(
  (
    select count(*) > 0
    from jsonb_array_elements(
      public.get_delegatable_access_offers() -> 'offers'
    ) offer
  ),
  'owner receives at least one delegatable offer'
);

insert into remediation_ids (key, id)
select
  'invitation',
  public.issue_organisation_member_invitation(
    'email',
    'remediation-invitee@example.test',
    decode(repeat('ab', 32), 'hex'),
    statement_timestamp() + interval '7 days',
    (select id from remediation_ids where key = 'member_role_version'),
    'organisation',
    null,
    'Invitee Display',
    (select id from remediation_ids where key = 'job_function'),
    (select id from remediation_ids where key = 'root_unit')
  );

select ok(
  (select id is not null from remediation_ids where key = 'invitation'),
  'owner can issue invitation with provisioning intent'
);

select ok(
  exists (
    select 1
    from public.organisation_invitation_provisioning provisioning
    where provisioning.invitation_id = (
      select id from remediation_ids where key = 'invitation'
    )
  ),
  'invitation provisioning intent is stored'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000002","email":"remediation-invitee@example.test"}',
  true
);

select ok(
  public.accept_organisation_invitation(decode(repeat('ab', 32), 'hex')) is not null,
  'invitee can accept invitation'
);

insert into remediation_ids (key, id)
select 'invitee_membership', membership_table.id
from public.organisation_memberships membership_table
where membership_table.user_id = '91000000-0000-0000-0000-000000000002';

select is(
  (
    select display_name
    from public.organisation_memberships
    where id = (select id from remediation_ids where key = 'invitee_membership')
  ),
  'Invitee Display',
  'accepted invitation applies intended display name'
);

select ok(
  exists (
    select 1
    from public.membership_job_function_assignments assignment_row
    where assignment_row.membership_id = (
      select id from remediation_ids where key = 'invitee_membership'
    )
      and assignment_row.is_primary = true
      and assignment_row.job_function_id = (
        select id from remediation_ids where key = 'job_function'
      )
  ),
  'accepted invitation applies intended primary job function assignment'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"92000000-0000-0000-0000-000000000001","email":"remediation-owner@example.test"}',
  true
);

select ok(
  (
    public.get_membership_administration_profile(
      (select id from remediation_ids where key = 'invitee_membership')
    ) -> 'membership_id'
  ) is not null,
  'administration profile is readable for invitee membership'
);

select ok(
  public.assign_membership_job_function(
    (select membership_table.id
     from public.organisation_memberships membership_table
     where membership_table.organisation_id = (select id from remediation_ids where key = 'organisation')
       and membership_table.user_id = '91000000-0000-0000-0000-000000000001'),
    (select id from remediation_ids where key = 'job_function'),
    true,
    (select id from remediation_ids where key = 'root_unit')
  ) is not null,
  'administrator can assign own primary organisational unit'
);

select ok(
  (
    public.get_current_membership_primary_unit() ->> 'has_primary_unit'
  )::boolean,
  'primary unit probe returns true after assignment'
);

select * from finish();
rollback;
