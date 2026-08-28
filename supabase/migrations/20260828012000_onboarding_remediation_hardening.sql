-- Onboarding remediation hardening: unit-scoped assignment, atomic provisioning, scoped delegation picker.

create or replace function private.can_manage_job_functions_in_unit(
  target_organisation_id uuid,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'job_functions.manage',
    null,
    null
  )
  or (
    target_unit_id is not null
    and private.has_scoped_permission(
      target_organisation_id,
      'job_functions.manage',
      null,
      target_unit_id
    )
  )
$$;

create or replace function private.assign_membership_job_function(
  target_membership_id uuid,
  target_job_function_id uuid,
  target_primary boolean default false,
  target_organisational_unit_id uuid default null,
  target_valid_from timestamptz default statement_timestamp(),
  target_valid_to timestamptz default null,
  target_assignment_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  membership_row public.organisation_memberships%rowtype;
  job_function_row public.job_functions%rowtype;
  new_assignment_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'job function assignment is not authorised'
      using errcode = '42501';
  end if;

  if target_primary and target_organisational_unit_id is null then
    raise exception 'primary assignment requires an organisational unit'
      using errcode = '22023';
  end if;

  if not private.can_manage_job_functions_in_unit(
    org_id,
    target_organisational_unit_id
  ) then
    raise exception 'job function assignment is not authorised'
      using errcode = '42501';
  end if;

  select membership_registry.*
  into membership_row
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = org_id
    and membership_registry.id = target_membership_id;

  if not found or membership_row.status <> 'active' then
    raise exception 'membership is not active'
      using errcode = '22023';
  end if;

  select job_function_registry.*
  into job_function_row
  from public.job_functions job_function_registry
  where job_function_registry.organisation_id = org_id
    and job_function_registry.id = target_job_function_id
    and job_function_registry.status = 'active';

  if not found then
    raise exception 'job function not found or not active'
      using errcode = 'P0002';
  end if;

  if target_organisational_unit_id is not null then
    if not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = target_organisational_unit_id
        and unit_row.status = 'active'
    ) then
      raise exception 'organisational unit not found or not active'
        using errcode = 'P0002';
    end if;

    if not private.has_scoped_permission(
      org_id,
      'hierarchy.read',
      null,
      target_organisational_unit_id
    ) then
      raise exception 'job function assignment unit is not authorised'
        using errcode = '42501';
    end if;
  end if;

  if target_valid_to is not null and target_valid_to <= target_valid_from then
    raise exception 'assignment valid_to must be after valid_from'
      using errcode = '22023';
  end if;

  insert into public.membership_job_function_assignments (
    organisation_id,
    membership_id,
    job_function_id,
    organisational_unit_id,
    is_primary,
    valid_from,
    valid_to,
    job_function_name_snapshot,
    job_function_code_snapshot,
    assigned_by_membership_id,
    assignment_reason
  )
  values (
    org_id,
    target_membership_id,
    target_job_function_id,
    target_organisational_unit_id,
    target_primary,
    target_valid_from,
    target_valid_to,
    job_function_row.name,
    job_function_row.code,
    actor_membership_id,
    target_assignment_reason
  )
  returning id into new_assignment_id;

  perform private.enqueue_domain_event(
    org_id,
    null,
    'JobFunctionAssigned',
    new_assignment_id::text,
    jsonb_build_object(
      'membership_id', target_membership_id,
      'primary', target_primary,
      'job_function_id', target_job_function_id
    )
  );

  return new_assignment_id;
end;
$$;

create or replace function private.apply_invitation_provisioning(
  target_organisation_id uuid,
  target_invitation_id uuid,
  target_membership_id uuid,
  inviter_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  provisioning_row public.organisation_invitation_provisioning%rowtype;
  job_function_row public.job_functions%rowtype;
begin
  select provisioning.*
  into provisioning_row
  from public.organisation_invitation_provisioning provisioning
  where provisioning.organisation_id = target_organisation_id
    and provisioning.invitation_id = target_invitation_id;

  if not found then
    return;
  end if;

  if provisioning_row.intended_display_name is not null then
    if not private.membership_has_scoped_permission(
      inviter_membership_id,
      target_organisation_id,
      'memberships.manage',
      null,
      null
    ) then
      raise exception 'invitation provisioning is not authorised'
        using errcode = '42501';
    end if;

    update public.organisation_memberships membership_row
    set display_name = provisioning_row.intended_display_name,
        updated_at = statement_timestamp()
    where membership_row.organisation_id = target_organisation_id
      and membership_row.id = target_membership_id;
  end if;

  if provisioning_row.intended_job_function_id is null then
    return;
  end if;

  if provisioning_row.intended_organisational_unit_id is null then
    raise exception 'invitation provisioning is incomplete'
      using errcode = '22023';
  end if;

  if not (
    private.membership_has_scoped_permission(
      inviter_membership_id,
      target_organisation_id,
      'job_functions.manage',
      null,
      null
    )
    or private.membership_has_scoped_permission(
      inviter_membership_id,
      target_organisation_id,
      'job_functions.manage',
      null,
      provisioning_row.intended_organisational_unit_id
    )
  ) then
    raise exception 'invitation provisioning is not authorised'
      using errcode = '42501';
  end if;

  if not private.membership_has_scoped_permission(
    inviter_membership_id,
    target_organisation_id,
    'hierarchy.read',
    null,
    provisioning_row.intended_organisational_unit_id
  ) then
    raise exception 'invitation provisioning is not authorised'
      using errcode = '42501';
  end if;

  select job_function_registry.*
  into job_function_row
  from public.job_functions job_function_registry
  where job_function_registry.organisation_id = target_organisation_id
    and job_function_registry.id = provisioning_row.intended_job_function_id
    and job_function_registry.status = 'active';

  if not found then
    raise exception 'job function not found or not active'
      using errcode = 'P0002';
  end if;

  insert into public.membership_job_function_assignments (
    organisation_id,
    membership_id,
    job_function_id,
    organisational_unit_id,
    is_primary,
    valid_from,
    job_function_name_snapshot,
    job_function_code_snapshot,
    assigned_by_membership_id,
    assignment_reason
  )
  values (
    target_organisation_id,
    target_membership_id,
    provisioning_row.intended_job_function_id,
    provisioning_row.intended_organisational_unit_id,
    true,
    statement_timestamp(),
    job_function_row.name,
    job_function_row.code,
    inviter_membership_id,
    'Applied from invitation provisioning'
  );
end;
$$;

create or replace function public.get_delegatable_access_offers()
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
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'delegation offers are not authorised'
      using errcode = '42501';
  end if;

  select
    private.membership_has_scoped_permission(
      actor_membership_id,
      org_id,
      'roles.delegate',
      null,
      null
    )
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
    select
      role_version.id as role_version_id,
      role_row.display_name as role_display_name,
      role_row.canonical_name as role_canonical_name,
      role_row.is_protected
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = org_id
      and role_version.status = 'published'
      and role_row.status = 'active'
      and (
        not role_row.is_protected
        or private.membership_is_effective_owner(
          actor_membership_id,
          org_id
        )
      )
    order by role_row.display_name
  loop
    scope_options := '[]'::jsonb;

    if private.role_version_is_delegatable_at_scope(
      org_id,
      role_record.role_version_id,
      'organisation',
      null,
      actor_membership_id
    ) and private.membership_has_scoped_permission(
      actor_membership_id,
      org_id,
      'roles.delegate',
      null,
      null
    ) then
      scope_options := scope_options || jsonb_build_array(
        jsonb_build_object(
          'scope_type', 'organisation',
          'scope_unit_id', null,
          'label', 'Entire organisation'
        )
      );
    end if;

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
      order by unit_row.name
    loop
      scope_options := scope_options || jsonb_build_array(
        jsonb_build_object(
          'scope_type', 'unit_subtree',
          'scope_unit_id', scope_record.id,
          'label', scope_record.name,
          'unit_code', scope_record.code
        )
      );
    end loop;

    if jsonb_array_length(scope_options) > 0 then
      result := result || jsonb_build_array(
        jsonb_build_object(
          'role_version_id', role_record.role_version_id,
          'role_display_name', role_record.role_display_name,
          'role_canonical_name', role_record.role_canonical_name,
          'scope_options', scope_options
        )
      );
    end if;
  end loop;

  return jsonb_build_object('offers', result);
end;
$$;

alter function private.can_manage_job_functions_in_unit(uuid, uuid)
  owner to lean_hub_private_owner;

create or replace function public.issue_organisation_member_invitation(
  invitation_recipient_type text,
  invitation_canonical_recipient text,
  invitation_token_digest bytea,
  invitation_expires_at timestamptz,
  offered_role_version_id uuid,
  offered_scope_type text,
  offered_scope_unit_id uuid default null,
  intended_display_name text default null,
  intended_job_function_id uuid default null,
  intended_organisational_unit_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  invitation_id uuid;
begin
  invitation_id := private.issue_organisation_invitation(
    org_id,
    invitation_recipient_type,
    invitation_canonical_recipient,
    invitation_token_digest,
    invitation_expires_at,
    offered_role_version_id,
    offered_scope_type,
    offered_scope_unit_id
  );

  if intended_display_name is not null
    or intended_job_function_id is not null
    or intended_organisational_unit_id is not null then
    if intended_job_function_id is not null
      and not private.can_manage_job_functions_in_unit(
        org_id,
        intended_organisational_unit_id
      ) then
      raise exception 'invitation provisioning is not authorised'
        using errcode = '42501';
    end if;

    if intended_organisational_unit_id is not null
      and not private.has_scoped_permission(
        org_id,
        'hierarchy.read',
        null,
        intended_organisational_unit_id
      ) then
      raise exception 'invitation provisioning is not authorised'
        using errcode = '42501';
    end if;

    insert into public.organisation_invitation_provisioning (
      organisation_id,
      invitation_id,
      intended_display_name,
      intended_job_function_id,
      intended_organisational_unit_id
    )
    values (
      org_id,
      invitation_id,
      intended_display_name,
      intended_job_function_id,
      intended_organisational_unit_id
    );
  end if;

  return invitation_id;
end;
$$;

create or replace function public.get_membership_administration_profile(
  target_membership_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  resolved_membership public.organisation_memberships%rowtype;
  profile_email text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'membership administration profile is not authorised'
      using errcode = '42501';
  end if;

  select membership_registry.*
  into resolved_membership
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = org_id
    and membership_registry.id = target_membership_id;

  if not found then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'memberships.read', null, null)
    or (
      target_membership_id = actor_membership_id
      and private.can_read_membership_capability_profile(org_id, target_membership_id)
    )
  ) then
    raise exception 'membership administration profile is not authorised'
      using errcode = '42501';
  end if;

  select auth_user.email
  into profile_email
  from auth.users auth_user
  where auth_user.id = resolved_membership.user_id
    and private.has_scoped_permission(org_id, 'memberships.read', null, null);

  return (
    select jsonb_build_object(
      'membership_id', membership_registry.id,
      'display_name',
        coalesce(membership_registry.display_name, profile_row.display_name),
      'email', profile_email,
      'status', membership_registry.status,
      'job_title', membership_registry.job_title,
      'primary_organisational_unit',
        case
          when assignment_row.organisational_unit_id is null then null
          else jsonb_build_object(
            'id', unit_row.id,
            'name', unit_row.name,
            'code', unit_row.code
          )
        end,
      'job_function',
        case
          when assignment_row.job_function_id is null then null
          else jsonb_build_object(
            'id', assignment_row.job_function_id,
            'name', assignment_row.job_function_name_snapshot,
            'code', assignment_row.job_function_code_snapshot
          )
        end,
      'access_grants', coalesce(grants_json.grants, '[]'::jsonb),
      'permissions', jsonb_build_object(
        'can_manage_membership',
          private.has_scoped_permission(org_id, 'memberships.manage', null, null),
        'can_manage_job_functions',
          private.can_manage_job_functions(org_id)
          or exists (
            select 1
            from public.organisation_units scoped_unit
            where scoped_unit.organisation_id = org_id
              and scoped_unit.status = 'active'
              and private.has_scoped_permission(
                org_id,
                'job_functions.manage',
                null,
                scoped_unit.id
              )
          ),
        'can_delegate_access',
          private.has_scoped_permission(org_id, 'roles.delegate', null, null)
          or exists (
            select 1
            from public.organisation_units scoped_unit
            where scoped_unit.organisation_id = org_id
              and scoped_unit.status = 'active'
              and private.has_scoped_permission(
                org_id,
                'roles.delegate',
                null,
                scoped_unit.id
              )
          ),
        'is_self', target_membership_id = actor_membership_id
      )
    )
    from public.organisation_memberships membership_registry
    left join public.profiles profile_row
      on profile_row.user_id = membership_registry.user_id
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.organisation_id = org_id
     and assignment_row.membership_id = membership_registry.id
     and assignment_row.is_primary = true
     and assignment_row.valid_from <= statement_timestamp()
     and (
       assignment_row.valid_to is null
       or assignment_row.valid_to > statement_timestamp()
     )
    left join public.organisation_units unit_row
      on unit_row.organisation_id = org_id
     and unit_row.id = assignment_row.organisational_unit_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'grant_id', grant_row.id,
          'role_display_name', role_row.display_name,
          'scope_type', grant_row.scope_type,
          'scope_unit_name', scope_unit.name,
          'status', grant_row.status
        )
        order by role_row.display_name
      ) as grants
      from public.access_grants grant_row
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      left join public.organisation_units scope_unit
        on scope_unit.organisation_id = grant_row.organisation_id
       and scope_unit.id = grant_row.scope_unit_id
      where grant_row.organisation_id = org_id
        and grant_row.grantee_membership_id = membership_registry.id
        and grant_row.status = 'active'
        and private.has_scoped_permission(org_id, 'roles.read', null, null)
    ) grants_json on true
    where membership_registry.organisation_id = org_id
      and membership_registry.id = target_membership_id
  );
end;
$$;

revoke all on public.organisation_invitation_provisioning
  from public, anon, authenticated, service_role;

grant select, insert, update, delete
  on public.organisation_invitation_provisioning
  to lean_hub_private_owner;

create policy private_owner_all_organisation_invitation_provisioning
on public.organisation_invitation_provisioning
for all
to lean_hub_private_owner
using (true)
with check (true);

grant select on public.organisation_invitation_provisioning to authenticated;

drop policy if exists organisation_invitation_provisioning_select
  on public.organisation_invitation_provisioning;

create policy organisation_invitation_provisioning_select
on public.organisation_invitation_provisioning
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(
    organisation_id,
    'invitations.manage',
    null,
    null
  )
);
