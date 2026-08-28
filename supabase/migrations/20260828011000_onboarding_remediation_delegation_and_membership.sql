-- Onboarding remediation: delegation picker, membership administration, invitation provisioning.

create table public.organisation_invitation_provisioning (
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  invitation_id uuid not null,
  intended_display_name text,
  intended_job_function_id uuid,
  intended_organisational_unit_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  constraint organisation_invitation_provisioning_pkey
    primary key (organisation_id, invitation_id),
  constraint organisation_invitation_provisioning_invitation_fkey
    foreign key (organisation_id, invitation_id)
    references public.organisation_invitations(organisation_id, id)
    on delete restrict,
  constraint organisation_invitation_provisioning_job_function_fkey
    foreign key (organisation_id, intended_job_function_id)
    references public.job_functions(organisation_id, id)
    on delete restrict,
  constraint organisation_invitation_provisioning_unit_fkey
    foreign key (organisation_id, intended_organisational_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint organisation_invitation_provisioning_display_name_check
    check (
      intended_display_name is null
      or (
        intended_display_name = btrim(intended_display_name)
        and char_length(intended_display_name) between 1 and 120
      )
    )
);

alter table public.organisation_invitation_provisioning enable row level security;

create policy organisation_invitation_provisioning_select
on public.organisation_invitation_provisioning for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(
    organisation_id,
    'invitations.manage',
    null,
    null
  )
);

create or replace function private.role_version_is_delegatable_at_scope(
  target_organisation_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null,
  actor_membership_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = target_organisation_id
      and role_version.id = target_role_version_id
      and role_version.status = 'published'
      and role_row.status = 'active'
      and (
        not role_row.is_protected
        or private.membership_is_effective_owner(
          coalesce(
            actor_membership_id,
            private.current_membership_id(target_organisation_id)
          ),
          target_organisation_id
        )
      )
  )
  and not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = target_role_version_id
      and not private.membership_has_scoped_permission(
        coalesce(
          actor_membership_id,
          private.current_membership_id(target_organisation_id)
        ),
        target_organisation_id,
        role_permission.permission_key,
        case when target_scope_type = 'self'
          then coalesce(
            actor_membership_id,
            private.current_membership_id(target_organisation_id)
          )
          else null
        end,
        case when target_scope_type = 'unit_subtree'
          then target_scope_unit_id
          else null
        end
      )
  )
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

  if provisioning_row.intended_organisational_unit_id is not null
    and not private.membership_has_scoped_permission(
      inviter_membership_id,
      target_organisation_id,
      'hierarchy.read',
      null,
      provisioning_row.intended_organisational_unit_id
    ) then
    return;
  end if;

  if provisioning_row.intended_display_name is not null then
    update public.organisation_memberships membership_row
    set display_name = provisioning_row.intended_display_name,
        updated_at = statement_timestamp()
    where membership_row.organisation_id = target_organisation_id
      and membership_row.id = target_membership_id;
  end if;

  if provisioning_row.intended_job_function_id is null then
    return;
  end if;

  if not private.membership_has_scoped_permission(
    inviter_membership_id,
    target_organisation_id,
    'job_functions.manage',
    null,
    null
  ) then
    return;
  end if;

  select job_function_registry.*
  into job_function_row
  from public.job_functions job_function_registry
  where job_function_registry.organisation_id = target_organisation_id
    and job_function_registry.id = provisioning_row.intended_job_function_id
    and job_function_registry.status = 'active';

  if not found then
    return;
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

create or replace function private.accept_organisation_invitation(
  invitation_token_digest bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_session_id uuid := private.current_session_id();
  invitation_row public.organisation_invitations%rowtype;
  resolved_membership_id uuid;
  invitation_grant record;
  containment_membership_id uuid;
  containment_unit_id uuid;
  new_grant_id uuid;
begin
  if actor_user_id is null or actor_session_id is null then
    raise exception 'authenticated live session required'
      using errcode = '42501';
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest
    and invitation.status = 'pending'
    and invitation.offer_sealed_at is not null
  for update;

  if invitation_row.id is null
    or invitation_row.expires_at <= statement_timestamp() then
    raise exception 'invitation is unavailable'
      using errcode = '42501';
  end if;

  if not private.membership_has_scoped_permission(
    invitation_row.inviter_membership_id,
    invitation_row.organisation_id,
    'invitations.manage',
    null,
    null
  ) then
    raise exception 'invitation authority is no longer manageable'
      using errcode = '42501';
  end if;

  if (
    invitation_row.recipient_type = 'email'
    and (
      lower(coalesce(private.auth_jwt() ->> 'email', '')) <>
        invitation_row.canonical_recipient
      or not private.auth_email_is_confirmed(
        actor_user_id,
        invitation_row.canonical_recipient
      )
    )
  ) or (
    invitation_row.recipient_type in ('workforce_id', 'username')
    and not exists (
      select 1
      from private.workforce_aliases workforce_alias
      where workforce_alias.organisation_id = invitation_row.organisation_id
        and workforce_alias.user_id = actor_user_id
        and workforce_alias.alias_type = invitation_row.recipient_type
        and workforce_alias.canonical_alias =
          invitation_row.canonical_recipient
        and workforce_alias.status = 'active'
    )
  ) then
    raise exception 'invitation recipient does not match'
      using errcode = '42501';
  end if;

  select membership.id
  into resolved_membership_id
  from public.organisation_memberships membership
  where membership.organisation_id = invitation_row.organisation_id
    and membership.user_id = actor_user_id
  for update;

  if resolved_membership_id is null then
    insert into public.organisation_memberships (
      organisation_id,
      user_id,
      status,
      activated_at
    )
    values (
      invitation_row.organisation_id,
      actor_user_id,
      'active',
      statement_timestamp()
    )
    returning id into resolved_membership_id;
  else
    update public.organisation_memberships
    set status = 'active',
        activated_at = coalesce(activated_at, statement_timestamp()),
        inactivated_at = null,
        status_reason = null,
        status_changed_at = statement_timestamp()
    where organisation_id = invitation_row.organisation_id
      and id = resolved_membership_id
      and status = 'pending';

    if not exists (
      select 1
      from public.organisation_memberships membership
      where membership.organisation_id = invitation_row.organisation_id
        and membership.id = resolved_membership_id
        and membership.status = 'active'
    ) then
      raise exception 'membership cannot accept invitation'
        using errcode = '42501';
    end if;
  end if;

  for invitation_grant in
    select offered_grant.*, role_row.is_protected as role_is_protected
    from public.organisation_invitation_grants offered_grant
    join public.role_versions role_version
      on role_version.organisation_id = offered_grant.organisation_id
     and role_version.id = offered_grant.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.status = 'active'
    where offered_grant.organisation_id = invitation_row.organisation_id
      and offered_grant.invitation_id = invitation_row.id
  loop
    containment_membership_id := case
      when invitation_grant.scope_type = 'self'
        then resolved_membership_id
      else null
    end;
    containment_unit_id := case
      when invitation_grant.scope_type = 'unit_subtree'
        then invitation_grant.scope_unit_id
      else null
    end;

    if (
      invitation_grant.role_is_protected
      and not private.membership_is_effective_owner(
        invitation_row.inviter_membership_id,
        invitation_row.organisation_id
      )
    ) or not private.membership_has_scoped_permission(
      invitation_row.inviter_membership_id,
      invitation_row.organisation_id,
      'roles.delegate',
      containment_membership_id,
      containment_unit_id
    ) or exists (
      select 1
      from public.role_permissions role_permission
      where role_permission.organisation_id = invitation_row.organisation_id
        and role_permission.role_version_id =
          invitation_grant.role_version_id
        and not private.membership_has_scoped_permission(
          invitation_row.inviter_membership_id,
          invitation_row.organisation_id,
          role_permission.permission_key,
          containment_membership_id,
          containment_unit_id
        )
    ) then
      raise exception 'invitation authority is no longer delegable'
        using errcode = '42501';
    end if;

    insert into public.access_grants (
      organisation_id,
      grantee_membership_id,
      role_version_id,
      scope_type,
      scope_unit_id,
      grantor_membership_id
    )
    values (
      invitation_row.organisation_id,
      resolved_membership_id,
      invitation_grant.role_version_id,
      invitation_grant.scope_type,
      invitation_grant.scope_unit_id,
      invitation_row.inviter_membership_id
    )
    returning id into new_grant_id;
  end loop;

  if new_grant_id is null then
    raise exception 'invitation has no valid authority offer'
      using errcode = '23514';
  end if;

  perform private.apply_invitation_provisioning(
    invitation_row.organisation_id,
    invitation_row.id,
    resolved_membership_id,
    invitation_row.inviter_membership_id
  );

  update public.organisation_invitations
  set status = 'accepted',
      accepted_membership_id = resolved_membership_id,
      accepted_at = statement_timestamp(),
      status_changed_at = statement_timestamp()
  where organisation_id = invitation_row.organisation_id
    and id = invitation_row.id;

  insert into private.session_organisation_contexts (
    session_id,
    user_id,
    organisation_id,
    membership_id
  )
  values (
    actor_session_id,
    actor_user_id,
    invitation_row.organisation_id,
    resolved_membership_id
  )
  on conflict (session_id) do update
    set user_id = excluded.user_id,
        organisation_id = excluded.organisation_id,
        membership_id = excluded.membership_id,
        selected_at = statement_timestamp();

  perform private.append_security_audit(
    invitation_row.organisation_id,
    'invitation.accepted',
    'invitation',
    invitation_row.id,
    'succeeded',
    '{}'::jsonb
  );

  return resolved_membership_id;
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'invitations.manage', null, null)
    or not private.has_scoped_permission(org_id, 'roles.delegate', null, null) then
    raise exception 'delegation offers are not authorised'
      using errcode = '42501';
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
        or private.current_membership_is_owner(org_id)
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
      and not private.can_manage_job_functions(org_id) then
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
  membership_row public.organisation_memberships%rowtype;
  profile_email text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'membership administration profile is not authorised'
      using errcode = '42501';
  end if;

  select membership_registry.*
  into membership_row
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
  where auth_user.id = membership_row.user_id
    and private.has_scoped_permission(org_id, 'memberships.read', null, null);

  return (
    select jsonb_build_object(
      'membership_id', membership_row.id,
      'display_name',
        coalesce(membership_row.display_name, profile_row.display_name),
      'email', profile_email,
      'status', membership_row.status,
      'job_title', membership_row.job_title,
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
          private.can_manage_job_functions(org_id),
        'can_delegate_access',
          private.has_scoped_permission(org_id, 'roles.delegate', null, null),
        'is_self', target_membership_id = actor_membership_id
      )
    )
    from public.organisation_memberships membership_row
    left join public.profiles profile_row
      on profile_row.user_id = membership_row.user_id
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.organisation_id = org_id
     and assignment_row.membership_id = membership_row.id
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
        and grant_row.grantee_membership_id = membership_row.id
        and grant_row.status = 'active'
        and private.has_scoped_permission(org_id, 'roles.read', null, null)
    ) grants_json on true
    where membership_row.organisation_id = org_id
      and membership_row.id = target_membership_id
  );
end;
$$;

create or replace function public.update_organisation_membership_display_name(
  target_membership_id uuid,
  target_display_name text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  trimmed_name text := btrim(target_display_name);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'memberships.manage', null, null) then
    raise exception 'membership update is not authorised'
      using errcode = '42501';
  end if;

  if char_length(trimmed_name) < 1 or char_length(trimmed_name) > 120 then
    raise exception 'display name is invalid'
      using errcode = '22023';
  end if;

  update public.organisation_memberships membership_row
  set display_name = trimmed_name,
      updated_at = statement_timestamp()
  where membership_row.organisation_id = org_id
    and membership_row.id = target_membership_id
    and membership_row.status = 'active';

  if not found then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function public.get_current_membership_primary_unit()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  membership_id uuid := private.current_membership_id(org_id);
  unit_id uuid;
begin
  if org_id is null or membership_id is null then
    return null;
  end if;

  unit_id := private.membership_primary_organisational_unit_id(
    org_id,
    membership_id
  );

  if unit_id is null then
    return jsonb_build_object('has_primary_unit', false);
  end if;

  return (
    select jsonb_build_object(
      'has_primary_unit', true,
      'unit_id', unit_row.id,
      'unit_name', unit_row.name,
      'unit_code', unit_row.code
    )
    from public.organisation_units unit_row
    where unit_row.organisation_id = org_id
      and unit_row.id = unit_id
  );
end;
$$;

grant execute on function public.get_delegatable_access_offers() to authenticated;
grant execute on function public.issue_organisation_member_invitation(
  text, text, bytea, timestamptz, uuid, text, uuid, text, uuid, uuid
) to authenticated;
grant execute on function public.get_membership_administration_profile(uuid) to authenticated;
grant execute on function public.update_organisation_membership_display_name(uuid, text) to authenticated;
grant execute on function public.get_current_membership_primary_unit() to authenticated;

revoke all on function public.get_delegatable_access_offers() from public, anon;
revoke all on function public.issue_organisation_member_invitation(
  text, text, bytea, timestamptz, uuid, text, uuid, text, uuid, uuid
) from public, anon;
revoke all on function public.get_membership_administration_profile(uuid) from public, anon;
revoke all on function public.update_organisation_membership_display_name(uuid, text) from public, anon;
revoke all on function public.get_current_membership_primary_unit() from public, anon;

alter function private.role_version_is_delegatable_at_scope(
  uuid, uuid, text, uuid, uuid
) owner to lean_hub_private_owner;
alter function private.apply_invitation_provisioning(uuid, uuid, uuid, uuid)
  owner to lean_hub_private_owner;
