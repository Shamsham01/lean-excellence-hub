begin;

select plan(32);

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'b1000000-0000-0000-0000-000000000001',
    'self-profile-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'self-profile-suggestions@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'self-profile-other@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'self-profile-outsider@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table self_profile_ids (
  key text primary key,
  id uuid
) on commit drop;

grant select, insert, update on self_profile_ids to authenticated, postgres;

insert into self_profile_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'b1000000-0000-0000-0000-000000000001',
    'self-profile-org',
    'Self Profile Org'
  )
);

insert into self_profile_ids (key, id)
values (
  'other_organisation',
  private.provision_organisation(
    'b1000000-0000-0000-0000-000000000004',
    'self-profile-other-org',
    'Self Profile Other Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', statement_timestamp(), statement_timestamp()),
  ('b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', statement_timestamp(), statement_timestamp()),
  ('b2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', statement_timestamp(), statement_timestamp()),
  ('b2000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', statement_timestamp(), statement_timestamp());

insert into public.organisation_memberships (
  organisation_id, user_id, status, activated_at, display_name
)
values
  (
    (select id from self_profile_ids where key = 'organisation'),
    'b1000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp(),
    'Suggestions Operator'
  ),
  (
    (select id from self_profile_ids where key = 'organisation'),
    'b1000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp(),
    'Other Member'
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'b1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000003'
);

insert into self_profile_ids (key, id)
select 'suggestions_membership', id
from public.organisation_memberships
where organisation_id = (select id from self_profile_ids where key = 'organisation')
  and user_id = 'b1000000-0000-0000-0000-000000000002';

insert into self_profile_ids (key, id)
select 'other_membership', id
from public.organisation_memberships
where organisation_id = (select id from self_profile_ids where key = 'organisation')
  and user_id = 'b1000000-0000-0000-0000-000000000003';

insert into self_profile_ids (key, id)
select 'suggestions_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from self_profile_ids where key = 'organisation')
  and role_row.canonical_name = 'responsibility-suggestions'
  and role_version.status = 'published';

insert into self_profile_ids (key, id)
select 'team_member_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from self_profile_ids where key = 'organisation')
  and role_row.canonical_name = 'team-member'
  and role_version.status = 'published';

insert into self_profile_ids (key, id)
select 'finance_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from self_profile_ids where key = 'organisation')
  and role_row.canonical_name = 'finance-validator'
  and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2000000-0000-0000-0000-000000000001","email":"self-profile-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from self_profile_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into self_profile_ids (key, id)
select 'site_unit', public.create_organisation_unit(
  (select id from self_profile_ids where key = 'organisation'),
  null,
  'north-site',
  'North Site',
  'site'
);

insert into self_profile_ids (key, id)
select 'line_unit', public.create_organisation_unit(
  (select id from self_profile_ids where key = 'organisation'),
  (select id from self_profile_ids where key = 'site_unit'),
  'line-3',
  'Line 3',
  'line'
);

insert into self_profile_ids (key, id)
select 'operator_job_function', public.create_job_function(
  'Production Operator',
  'production-operator'
);

select ok(
  public.assign_membership_job_function(
    (select id from self_profile_ids where key = 'suggestions_membership'),
    (select id from self_profile_ids where key = 'operator_job_function'),
    true,
    (select id from self_profile_ids where key = 'line_unit')
  ) is not null,
  'owner assigns job function and primary work area'
);

insert into self_profile_ids (key, id)
select 'suggestions_grant', public.grant_role_version(
  (select id from self_profile_ids where key = 'organisation'),
  (select id from self_profile_ids where key = 'suggestions_membership'),
  (select id from self_profile_ids where key = 'suggestions_role_version'),
  'unit_subtree',
  (select id from self_profile_ids where key = 'site_unit')
);

insert into self_profile_ids (key, id)
select 'revoked_grant', public.grant_role_version(
  (select id from self_profile_ids where key = 'organisation'),
  (select id from self_profile_ids where key = 'suggestions_membership'),
  (select id from self_profile_ids where key = 'finance_role_version'),
  'organisation',
  null
);

select ok(
  public.revoke_access_grant(
    (select id from self_profile_ids where key = 'organisation'),
    (select id from self_profile_ids where key = 'revoked_grant'),
    'Revoked for self-profile test'
  ),
  'owner revokes one grant'
);

set local role postgres;

insert into self_profile_ids (key, id)
select 'owner_membership', id
from public.organisation_memberships
where organisation_id = (select id from self_profile_ids where key = 'organisation')
  and user_id = 'b1000000-0000-0000-0000-000000000001';

insert into public.access_grants (
  organisation_id,
  grantee_membership_id,
  role_version_id,
  scope_type,
  scope_unit_id,
  grantor_membership_id,
  status,
  granted_at,
  expires_at
)
values (
  (select id from self_profile_ids where key = 'organisation'),
  (select id from self_profile_ids where key = 'suggestions_membership'),
  (select id from self_profile_ids where key = 'team_member_role_version'),
  'unit_subtree',
  (select id from self_profile_ids where key = 'line_unit'),
  (select id from self_profile_ids where key = 'owner_membership'),
  'active',
  statement_timestamp() - interval '2 minutes',
  statement_timestamp() - interval '1 minute'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b2000000-0000-0000-0000-000000000002","email":"self-profile-suggestions@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from self_profile_ids where key = 'organisation')),
  'suggestions member selects organisation'
);

select is(
  public.get_own_membership_profile() -> 'job_function' ->> 'name',
  'Production Operator',
  'self profile returns the assigned job function'
);

select is(
  public.get_own_membership_profile() -> 'primary_organisational_unit' ->> 'name',
  'Line 3',
  'self profile returns the primary work area'
);

select is(
  jsonb_array_length(public.get_own_membership_profile() -> 'access_grants'),
  1,
  'expired and revoked grants are excluded from effective access'
);

select is(
  public.get_own_membership_profile() -> 'access_grants' -> 0 ->> 'role_display_name',
  'Suggestions',
  'effective grant keeps the suggestions role label'
);

select is(
  public.get_own_membership_profile() -> 'access_grants' -> 0 ->> 'scope_type',
  'unit_subtree',
  'effective grant keeps its own scope type'
);

select is(
  public.get_own_membership_profile() -> 'access_grants' -> 0 ->> 'scope_unit_name',
  'North Site',
  'effective grant keeps its scope unit'
);

select ok(
  not (public.get_own_membership_profile() ? 'email')
  and not (public.get_own_membership_profile() ? 'status_reason')
  and not (public.get_own_membership_profile() ? 'username'),
  'self profile excludes administration identity fields'
);

select is(
  public.get_membership_capability_profile_header(
    (select id from self_profile_ids where key = 'suggestions_membership')
  ) ->> 'job_function_name',
  'Production Operator',
  'self capability header does not require people.capability.read'
);

select ok(
  jsonb_typeof(
    public.get_membership_training_profile(
      (select id from self_profile_ids where key = 'suggestions_membership')
    ) -> 'requirements'
  ) = 'array'
  and jsonb_array_length(
    public.get_membership_training_profile(
      (select id from self_profile_ids where key = 'suggestions_membership')
    ) -> 'requirements'
  ) = 0,
  'missing training data is an empty list'
);

select ok(
  jsonb_typeof(
    public.get_membership_skills_profile(
      (select id from self_profile_ids where key = 'suggestions_membership')
    ) -> 'assessments'
  ) = 'array'
  and jsonb_array_length(
    public.get_membership_skills_profile(
      (select id from self_profile_ids where key = 'suggestions_membership')
    ) -> 'assessments'
  ) = 0,
  'missing skills data is an empty list'
);

-- An empty catalogue never calls derive_skill_gap. Exercise real published
-- requirements and an authoritative assessment before checking self access.
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"b2000000-0000-0000-0000-000000000001","email":"self-profile-owner@example.test"}',
  true
);

insert into self_profile_ids (key, id)
select 'skill', public.create_skill('Safe Operation', 'safe-operation');

insert into self_profile_ids (key, id)
select 'scale', public.create_skill_proficiency_scale_draft('Operator Scale');

insert into self_profile_ids (key, id)
select 'scale_version', id from public.skill_proficiency_scale_versions
where scale_id = (select id from self_profile_ids where key = 'scale')
  and version_number = 1;

insert into self_profile_ids (key, id)
select 'level_1', public.add_skill_proficiency_level(
  (select id from self_profile_ids where key = 'scale_version'), 1, 'Learning'
);
insert into self_profile_ids (key, id)
select 'level_2', public.add_skill_proficiency_level(
  (select id from self_profile_ids where key = 'scale_version'), 2, 'Independent'
);
select public.publish_skill_proficiency_scale_version(
  (select id from self_profile_ids where key = 'scale_version')
);

insert into self_profile_ids (key, id)
select 'capability_set', public.create_skill_capability_set_draft('Operator Skills', 'operator-skills');
insert into self_profile_ids (key, id)
select 'capability_version', id from public.skill_capability_set_versions
where capability_set_id = (select id from self_profile_ids where key = 'capability_set')
  and version_number = 1;
select public.add_skill_requirement(
  (select id from self_profile_ids where key = 'capability_version'),
  (select id from self_profile_ids where key = 'skill'),
  (select id from self_profile_ids where key = 'operator_job_function'),
  (select id from self_profile_ids where key = 'scale_version'),
  (select id from self_profile_ids where key = 'level_2')
);
select public.publish_skill_capability_set_version(
  (select id from self_profile_ids where key = 'capability_version')
);
select public.record_skill_validation(
  (select id from self_profile_ids where key = 'suggestions_membership'),
  (select id from self_profile_ids where key = 'skill'),
  (select id from self_profile_ids where key = 'scale_version'),
  (select id from self_profile_ids where key = 'level_1'),
  statement_timestamp(), null, 'manager_assessment', null,
  'Manager-only assessment note'
);
insert into self_profile_ids (key, id)
select 'draft_set', public.create_skill_capability_set_draft('Draft Skills', 'draft-skills');
insert into self_profile_ids (key, id)
select 'draft_version', id from public.skill_capability_set_versions
where capability_set_id = (select id from self_profile_ids where key = 'draft_set')
  and version_number = 1;

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b2000000-0000-0000-0000-000000000002","email":"self-profile-suggestions@example.test"}',
  true
);

select is(
  jsonb_array_length(public.get_membership_skills_profile(
    (select id from self_profile_ids where key = 'suggestions_membership')
  ) -> 'gaps'),
  1,
  'self skills profile works with a populated catalogue'
);
select is(
  public.get_membership_skills_profile(
    (select id from self_profile_ids where key = 'suggestions_membership')
  ) -> 'gaps' -> 0 -> 'gap' ->> 'status',
  'below_requirement',
  'self gap uses the published requirement and authoritative assessment'
);
select is(
  (public.derive_skill_gap(
    (select id from self_profile_ids where key = 'suggestions_membership'),
    (select id from self_profile_ids where key = 'skill')
  ) ->> 'gap')::integer,
  1,
  'self gap calculation returns the actual proficiency difference'
);
select is(
  jsonb_array_length(public.get_membership_skills_profile(
    (select id from self_profile_ids where key = 'suggestions_membership')
  ) -> 'assessments'),
  1,
  'self profile includes employee-visible assessment fields'
);
select ok(
  position('Manager-only assessment note' in public.get_membership_skills_profile(
    (select id from self_profile_ids where key = 'suggestions_membership')
  )::text) = 0,
  'self profile excludes confidential assessment notes'
);
select throws_ok(
  format('select public.get_membership_skills_profile(%L::uuid)',
    (select id from self_profile_ids where key = 'other_membership')),
  '42501', 'membership skills profile is not authorised',
  'populated skills do not permit another member profile'
);
select throws_ok(
  format('select public.derive_skill_gap(%L::uuid, %L::uuid, %L::uuid)',
    (select id from self_profile_ids where key = 'suggestions_membership'),
    (select id from self_profile_ids where key = 'skill'),
    (select id from self_profile_ids where key = 'draft_version')),
  '42501', 'skill gap derivation is not authorised',
  'self-only access cannot select draft capability requirements'
);

select ok(
  not public.member_has_permission('memberships.read')
  and not public.member_has_permission('roles.read')
  and not private.has_scoped_permission(
    (select id from self_profile_ids where key = 'organisation'),
    'people.capability.read',
    null,
    null
  ),
  'self profile access does not grant directory or administration permissions'
);

select throws_ok(
  format(
    'select public.get_people_directory(null, 1, 25, false)'
  ),
  '42501',
  'people directory is not authorised',
  'suggestions-only member cannot open the people directory'
);

select throws_ok(
  format(
    'select public.get_membership_administration_profile(%L::uuid)',
    (select id from self_profile_ids where key = 'suggestions_membership')
  ),
  '42501',
  'membership administration profile is not authorised',
  'self profile access does not open the administration profile'
);

select throws_ok(
  format(
    'select public.get_membership_capability_profile_header(%L::uuid)',
    (select id from self_profile_ids where key = 'other_membership')
  ),
  '42501',
  'membership capability profile header is not authorised',
  'self profile access does not open another member'
);

select throws_ok(
  format(
    'select public.get_membership_training_profile(%L::uuid)',
    (select id from self_profile_ids where key = 'other_membership')
  ),
  '42501',
  'membership training profile is not authorised',
  'training profile of another member stays denied'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"b2000000-0000-0000-0000-000000000004","email":"self-profile-outsider@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from self_profile_ids where key = 'other_organisation')),
  'outsider selects another organisation'
);

select throws_ok(
  format(
    'select public.get_membership_capability_profile_header(%L::uuid)',
    (select id from self_profile_ids where key = 'suggestions_membership')
  ),
  '42501',
  'membership capability profile header is not authorised',
  'cross-organisation capability profile access is denied'
);

select throws_ok(
  format('select public.derive_skill_gap(%L::uuid, %L::uuid)',
    (select id from self_profile_ids where key = 'suggestions_membership'),
    (select id from self_profile_ids where key = 'skill')),
  '42501', 'skill gap derivation is not authorised',
  'self gap access does not cross organisation boundaries'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"b2000000-0000-0000-0000-000000000002","email":"self-profile-suggestions@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from self_profile_ids where key = 'organisation')),
  'suggestions member returns to the organisation'
);

set local role postgres;

update public.organisation_memberships
set status = 'inactive',
    inactivated_at = statement_timestamp()
where id = (select id from self_profile_ids where key = 'suggestions_membership');

set local role authenticated;

select throws_ok(
  'select public.get_own_membership_profile()',
  '42501',
  'own membership profile is not authorised',
  'inactive membership cannot read the self profile'
);

select throws_ok(
  format(
    'select public.get_membership_skills_profile(%L::uuid)',
    (select id from self_profile_ids where key = 'suggestions_membership')
  ),
  '42501',
  'membership skills profile is not authorised',
  'inactive membership cannot read a skills profile'
);

select * from finish();
rollback;
