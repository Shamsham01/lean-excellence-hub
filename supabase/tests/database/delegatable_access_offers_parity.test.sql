begin;

select plan(41);

-- Reference implementation of the previous nested-loop algorithm. Used only
-- to prove the set-based rewrite returns the same authorised offer set.
create function pg_temp.reference_delegatable_access_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  result jsonb := '[]'::jsonb;
  role_record record;
  scope_record record;
  scope_options jsonb;
  actor_can_delegate boolean := false;
  actor_has_org_delegate boolean := false;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'delegation offers are not authorised'
      using errcode = '42501';
  end if;

  actor_has_org_delegate := private.membership_has_scoped_permission(
    actor_membership_id,
    org_id,
    'roles.delegate',
    null,
    null
  );

  select
    actor_has_org_delegate
    or exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.status = 'active'
        and private.membership_has_scoped_permission(
          actor_membership_id,
          org_id,
          'roles.delegate',
          null,
          unit_row.id
        )
    )
  into actor_can_delegate;

  if not actor_can_delegate then
    return jsonb_build_object('offers', '[]'::jsonb);
  end if;

  for role_record in
    select distinct on (role_row.id)
      role_version.id as role_version_id,
      role_row.id as role_id,
      role_row.display_name as role_display_name,
      role_row.canonical_name as role_canonical_name,
      role_row.module_responsibility_key,
      role_row.is_owner_role,
      private.role_responsibility_kind(
        role_row.canonical_name,
        role_row.module_responsibility_key,
        role_row.is_owner_role
      ) as responsibility_kind
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = org_id
      and role_version.status = 'published'
      and role_row.status = 'active'
      and (
        not role_row.is_owner_role
        or private.membership_is_effective_owner(
          actor_membership_id,
          org_id
        )
      )
    order by
      role_row.id,
      role_version.version_number desc
  loop
    scope_options := '[]'::jsonb;

    if private.role_grant_scope_allowed(
      org_id,
      role_record.role_id,
      'organisation'
    )
    and private.role_version_is_delegatable_at_scope(
      org_id,
      role_record.role_version_id,
      'organisation',
      null,
      actor_membership_id
    ) and actor_has_org_delegate then
      scope_options := scope_options || jsonb_build_array(
        jsonb_build_object(
          'scope_type', 'organisation',
          'scope_unit_id', null,
          'label', 'Entire organisation'
        )
      );
    end if;

    if private.role_grant_scope_allowed(
      org_id,
      role_record.role_id,
      'unit_subtree'
    ) then
      for scope_record in
        select unit_row.id, unit_row.name, unit_row.code
        from public.organisation_units unit_row
        where unit_row.organisation_id = org_id
          and unit_row.status = 'active'
          and private.membership_has_scoped_permission(
            actor_membership_id,
            org_id,
            'roles.delegate',
            null,
            unit_row.id
          )
          and private.role_version_is_delegatable_at_scope(
            org_id,
            role_record.role_version_id,
            'unit_subtree',
            unit_row.id,
            actor_membership_id
          )
        order by private.format_organisation_unit_path_label(unit_row.id)
      loop
        scope_options := scope_options || jsonb_build_array(
          jsonb_build_object(
            'scope_type', 'unit_subtree',
            'scope_unit_id', scope_record.id,
            'label', private.format_delegatable_scope_label(
              org_id,
              scope_record.id,
              scope_record.name
            ),
            'unit_code', scope_record.code,
            'unit_path', private.format_organisation_unit_path_label(scope_record.id)
          )
        );
      end loop;
    end if;

    if jsonb_array_length(scope_options) > 0 then
      result := result || jsonb_build_array(
        jsonb_build_object(
          'role_version_id', role_record.role_version_id,
          'role_display_name', role_record.role_display_name,
          'role_canonical_name', role_record.role_canonical_name,
          'module_responsibility_key', role_record.module_responsibility_key,
          'responsibility_kind', role_record.responsibility_kind,
          'scope_options', scope_options
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'offers',
    coalesce(
      (
        select jsonb_agg(
          offer_row
          order by
            offer_row ->> 'responsibility_kind',
            offer_row ->> 'role_display_name'
        )
        from jsonb_array_elements(result) as offer_row
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function pg_temp.reference_delegatable_access_offers() to authenticated;

select throws_ok(
  $$ select public.get_delegatable_access_offers() $$,
  '42501',
  'delegation offers are not authorised',
  'unauthenticated callers cannot read delegatable offers'
);

set local role anon;

select throws_ok(
  $$ select public.get_delegatable_access_offers() $$,
  '42501',
  null,
  'anonymous callers cannot execute get_delegatable_access_offers'
);

reset role;

insert into auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'offers-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd4000000-0000-0000-0000-000000000002',
    'offers-admin@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd4000000-0000-0000-0000-000000000003',
    'offers-member@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd4000000-0000-0000-0000-000000000004',
    'offers-manager@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd4000000-0000-0000-0000-000000000005',
    'offers-delegate-admin@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd4000000-0000-0000-0000-000000000006',
    'offers-other-owner@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd4000000-0000-0000-0000-000000000007',
    'offers-revoked@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  ),
  (
    'd4000000-0000-0000-0000-000000000008',
    'offers-expired@example.test',
    statement_timestamp(), statement_timestamp(), statement_timestamp(),
    '{"provider":"email","providers":["email"]}', '{}', false, false
  );

create temporary table offer_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update on offer_ids to authenticated;

insert into offer_ids (key, id)
values (
  'organisation',
  private.provision_organisation(
    'd4000000-0000-0000-0000-000000000001',
    'offers-parity-org',
    'Offers Parity Org'
  )
),
(
  'other_organisation',
  private.provision_organisation(
    'd4000000-0000-0000-0000-000000000006',
    'offers-other-org',
    'Offers Other Org'
  )
);

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  (
    'd4100000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd4100000-0000-0000-0000-000000000002',
    'd4000000-0000-0000-0000-000000000002',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd4100000-0000-0000-0000-000000000003',
    'd4000000-0000-0000-0000-000000000003',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd4100000-0000-0000-0000-000000000004',
    'd4000000-0000-0000-0000-000000000004',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd4100000-0000-0000-0000-000000000005',
    'd4000000-0000-0000-0000-000000000005',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd4100000-0000-0000-0000-000000000006',
    'd4000000-0000-0000-0000-000000000006',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd4100000-0000-0000-0000-000000000007',
    'd4000000-0000-0000-0000-000000000007',
    statement_timestamp(), statement_timestamp()
  ),
  (
    'd4100000-0000-0000-0000-000000000008',
    'd4000000-0000-0000-0000-000000000008',
    statement_timestamp(), statement_timestamp()
  );

insert into public.organisation_memberships (
  organisation_id,
  user_id,
  status,
  activated_at
)
values
  (
    (select id from offer_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000002',
    'active',
    statement_timestamp()
  ),
  (
    (select id from offer_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000003',
    'active',
    statement_timestamp()
  ),
  (
    (select id from offer_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000004',
    'active',
    statement_timestamp()
  ),
  (
    (select id from offer_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000005',
    'active',
    statement_timestamp()
  ),
  (
    (select id from offer_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000007',
    'active',
    statement_timestamp()
  ),
  (
    (select id from offer_ids where key = 'organisation'),
    'd4000000-0000-0000-0000-000000000008',
    'active',
    statement_timestamp()
  );

update private.identity_controls
set status = 'active',
    enrolment_status = 'complete',
    enrolment_completed_at = statement_timestamp()
where user_id in (
  'd4000000-0000-0000-0000-000000000002',
  'd4000000-0000-0000-0000-000000000003',
  'd4000000-0000-0000-0000-000000000004',
  'd4000000-0000-0000-0000-000000000005',
  'd4000000-0000-0000-0000-000000000007',
  'd4000000-0000-0000-0000-000000000008'
);

insert into offer_ids (key, id)
select 'admin_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from offer_ids where key = 'organisation')
  and membership.user_id = 'd4000000-0000-0000-0000-000000000002';

insert into offer_ids (key, id)
select 'member_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from offer_ids where key = 'organisation')
  and membership.user_id = 'd4000000-0000-0000-0000-000000000003';

insert into offer_ids (key, id)
select 'manager_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from offer_ids where key = 'organisation')
  and membership.user_id = 'd4000000-0000-0000-0000-000000000004';

insert into offer_ids (key, id)
select 'delegate_admin_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from offer_ids where key = 'organisation')
  and membership.user_id = 'd4000000-0000-0000-0000-000000000005';

insert into offer_ids (key, id)
select 'revoked_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from offer_ids where key = 'organisation')
  and membership.user_id = 'd4000000-0000-0000-0000-000000000007';

insert into offer_ids (key, id)
select 'expired_membership', membership.id
from public.organisation_memberships membership
where membership.organisation_id = (select id from offer_ids where key = 'organisation')
  and membership.user_id = 'd4000000-0000-0000-0000-000000000008';

insert into offer_ids (key, id)
select 'admin_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from offer_ids where key = 'organisation')
  and role_row.canonical_name = 'organisation-administrator'
  and role_version.status = 'published';

insert into offer_ids (key, id)
select 'manager_role_version', role_version.id
from public.role_versions role_version
join public.roles role_row on role_row.id = role_version.role_id
where role_version.organisation_id = (select id from offer_ids where key = 'organisation')
  and role_row.canonical_name = 'manager'
  and role_version.status = 'published';

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"offers-owner@example.test"}',
  true
);
set local role authenticated;

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'owner selects organisation'
);

insert into offer_ids (key, id)
select 'root_unit', public.create_organisation_unit(
  (select id from offer_ids where key = 'organisation'),
  null,
  'offers-root',
  'Offers Root',
  'site'
);

insert into offer_ids (key, id)
select 'child_unit', public.create_organisation_unit(
  (select id from offer_ids where key = 'organisation'),
  (select id from offer_ids where key = 'root_unit'),
  'offers-child',
  'Offers Child',
  'department'
);

insert into offer_ids (key, id)
select 'sibling_unit', public.create_organisation_unit(
  (select id from offer_ids where key = 'organisation'),
  (select id from offer_ids where key = 'root_unit'),
  'offers-sibling',
  'Offers Sibling',
  'department'
);

insert into offer_ids (key, id)
select 'delegate_role', public.create_protected_role_draft(
  (select id from offer_ids where key = 'organisation'),
  'offers-site-delegate',
  'Offers Site Delegate',
  'Unit-scoped delegation role for parity tests'
);

select ok(
  public.add_role_permission(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'delegate_role'),
    'roles.delegate'
  ),
  'site delegate role receives roles.delegate'
);

select ok(
  public.add_role_permission(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'delegate_role'),
    'actions.read'
  ),
  'site delegate role receives actions.read'
);

select ok(
  public.publish_role_version(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'delegate_role')
  ),
  'site delegate role publishes'
);

insert into offer_ids (key, id)
select 'elevated_role', public.create_role_draft(
  (select id from offer_ids where key = 'organisation'),
  'offers-elevated',
  'Offers Elevated',
  'Role with a permission the site delegate does not hold'
);

select ok(
  public.add_role_permission(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'elevated_role'),
    'actions.read'
  ),
  'elevated role receives actions.read'
);

select ok(
  public.add_role_permission(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'elevated_role'),
    'memberships.read'
  ),
  'elevated role receives memberships.read'
);

select ok(
  public.publish_role_version(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'elevated_role')
  ),
  'elevated role publishes'
);

select ok(
  public.grant_role_version(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'admin_membership'),
    (select id from offer_ids where key = 'admin_role_version'),
    'organisation',
    null
  ) is not null,
  'owner grants organisation administrator'
);

select ok(
  public.grant_role_version(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'manager_membership'),
    (select id from offer_ids where key = 'delegate_role'),
    'unit_subtree',
    (select id from offer_ids where key = 'child_unit')
  ) is not null,
  'owner grants site-scoped manager delegate role'
);

select ok(
  public.grant_role_version(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'delegate_admin_membership'),
    (select id from offer_ids where key = 'delegate_role'),
    'unit_subtree',
    (select id from offer_ids where key = 'root_unit')
  ) is not null,
  'owner grants delegated administrator at site root'
);

insert into offer_ids (key, id)
select 'revoked_grant', public.grant_role_version(
  (select id from offer_ids where key = 'organisation'),
  (select id from offer_ids where key = 'revoked_membership'),
  (select id from offer_ids where key = 'delegate_role'),
  'unit_subtree',
  (select id from offer_ids where key = 'child_unit')
);

insert into offer_ids (key, id)
select 'expired_grant', public.grant_role_version(
  (select id from offer_ids where key = 'organisation'),
  (select id from offer_ids where key = 'expired_membership'),
  (select id from offer_ids where key = 'delegate_role'),
  'unit_subtree',
  (select id from offer_ids where key = 'child_unit')
);

select is(
  public.get_delegatable_access_offers(),
  pg_temp.reference_delegatable_access_offers(),
  'organisation owner offer payload matches the reference algorithm'
);

select ok(
  (
    select count(*) > 0
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_type' = 'organisation'
  ),
  'organisation owner can offer organisation scope'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000002","email":"offers-admin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'organisation administrator selects organisation'
);

select is(
  public.get_delegatable_access_offers(),
  pg_temp.reference_delegatable_access_offers(),
  'organisation administrator offer payload matches the reference algorithm'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000003","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000003","email":"offers-member@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'restricted member selects organisation'
);

select is(
  public.get_delegatable_access_offers(),
  pg_temp.reference_delegatable_access_offers(),
  'restricted member offer payload matches the reference algorithm'
);

select is(
  jsonb_array_length(public.get_delegatable_access_offers() -> 'offers'),
  0,
  'restricted member receives empty offers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000004","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000004","email":"offers-manager@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'site-scoped manager selects organisation'
);

select is(
  public.get_delegatable_access_offers(),
  pg_temp.reference_delegatable_access_offers(),
  'site-scoped manager offer payload matches the reference algorithm'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_type' = 'organisation'
  ),
  'site-scoped manager cannot offer organisation scope'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_unit_id' = (
      select id::text from offer_ids where key = 'sibling_unit'
    )
  ),
  'site-scoped manager cannot offer sibling subtree'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    where offer ->> 'role_canonical_name' = 'offers-elevated'
  ),
  'site-scoped manager cannot offer a version-bound role with extra permissions'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000005","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000005","email":"offers-delegate-admin@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'delegated administrator selects organisation'
);

select is(
  public.get_delegatable_access_offers(),
  pg_temp.reference_delegatable_access_offers(),
  'delegated administrator offer payload matches the reference algorithm'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_unit_id' = (
      select id::text from offer_ids where key = 'sibling_unit'
    )
  ),
  'delegated administrator can offer units under the delegated site'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000006","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000006","email":"offers-other-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'other_organisation')),
  'other-organisation owner selects their organisation'
);

select is(
  public.get_delegatable_access_offers(),
  pg_temp.reference_delegatable_access_offers(),
  'cross-organisation owner offer payload matches the reference algorithm'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    join public.role_versions role_version
      on role_version.id = (offer ->> 'role_version_id')::uuid
    where role_version.organisation_id = (
      select id from offer_ids where key = 'organisation'
    )
  ),
  'cross-organisation owner never receives the other organisation''s roles'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000007","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000007","email":"offers-revoked@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'revoked-grant member selects organisation before revocation'
);

select ok(
  jsonb_array_length(public.get_delegatable_access_offers() -> 'offers') > 0,
  'member with an active delegate grant receives offers before revocation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"offers-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'owner re-selects organisation to revoke the test grant'
);

select ok(
  public.revoke_access_grant(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'revoked_grant'),
    'parity test revocation'
  ),
  'owner revokes the delegate grant'
);

select ok(
  public.set_organisation_unit_status(
    (select id from offer_ids where key = 'organisation'),
    (select id from offer_ids where key = 'sibling_unit'),
    'retired',
    'parity test retirement'
  ),
  'owner retires the sibling unit'
);

reset role;

update public.access_grants
set status = 'expired'
where id = (select id from offer_ids where key = 'expired_grant');

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000007","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000007","email":"offers-revoked@example.test"}',
  true
);
set local role authenticated;

select is(
  jsonb_array_length(public.get_delegatable_access_offers() -> 'offers'),
  0,
  'revoked delegate grant yields empty offers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000008","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000008","email":"offers-expired@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'expired-grant member selects organisation'
);

select is(
  jsonb_array_length(public.get_delegatable_access_offers() -> 'offers'),
  0,
  'expired delegate grant yields empty offers'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"d4100000-0000-0000-0000-000000000001","email":"offers-owner@example.test"}',
  true
);

select ok(
  public.switch_organisation((select id from offer_ids where key = 'organisation')),
  'owner re-selects organisation after retirement'
);

select is(
  public.get_delegatable_access_offers(),
  pg_temp.reference_delegatable_access_offers(),
  'retired units remain excluded after rewrite'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.get_delegatable_access_offers() -> 'offers') offer
    cross join lateral jsonb_array_elements(offer -> 'scope_options') scope_option
    where scope_option ->> 'scope_unit_id' = (
      select id::text from offer_ids where key = 'sibling_unit'
    )
  ),
  'retired sibling unit is not offered'
);

select * from finish();
rollback;
