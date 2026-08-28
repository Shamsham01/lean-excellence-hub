-- Allow unit-scoped delegates to offer protected non-owner roles they can contain.
-- Owner roles remain owner-gated; other protected roles (e.g. delegate managers)
-- follow permission containment only.

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
        not role_row.is_owner_role
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
      role_row.is_owner_role
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

create or replace function private.issue_organisation_invitation(
  target_organisation_id uuid,
  invitation_recipient_type text,
  invitation_canonical_recipient text,
  invitation_token_digest bytea,
  invitation_expires_at timestamptz,
  offered_role_version_id uuid,
  offered_scope_type text,
  offered_scope_unit_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_membership_id uuid :=
    private.current_membership_id(target_organisation_id);
  invitation_id uuid;
  containment_membership_id uuid;
  containment_unit_id uuid;
begin
  containment_unit_id := case
    when offered_scope_type = 'unit_subtree' then offered_scope_unit_id
    else null
  end;

  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'invitations.manage',
      null,
      null
    )
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      null,
      containment_unit_id
    ) then
    raise exception 'invitation issue is not authorised'
      using errcode = '42501';
  end if;

  if offered_scope_type = 'self' then
    containment_membership_id := actor_membership_id;
  end if;

  if not exists (
    select 1
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = target_organisation_id
      and role_version.id = offered_role_version_id
      and role_version.status = 'published'
      and role_row.status = 'active'
      and (
        not role_row.is_owner_role
        or private.current_membership_is_owner(target_organisation_id)
      )
  ) or exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = offered_role_version_id
      and not private.has_scoped_permission(
        target_organisation_id,
        role_permission.permission_key,
        containment_membership_id,
        containment_unit_id
      )
  ) then
    raise exception 'invitation authority is not contained'
      using errcode = '42501';
  end if;

  update public.organisation_invitations invitation
  set status = 'expired',
      expired_at = statement_timestamp(),
      status_changed_at = statement_timestamp(),
      status_changed_by_membership_id = actor_membership_id
  where invitation.organisation_id = target_organisation_id
    and invitation.recipient_type = $2
    and invitation.canonical_recipient = $3
    and invitation.status = 'pending'
    and invitation.expires_at <= statement_timestamp();

  insert into public.organisation_invitations (
    organisation_id,
    recipient_type,
    canonical_recipient,
    token_digest,
    inviter_membership_id,
    expires_at
  )
  values (
    target_organisation_id,
    invitation_recipient_type,
    invitation_canonical_recipient,
    invitation_token_digest,
    actor_membership_id,
    invitation_expires_at
  )
  returning id into invitation_id;

  insert into public.organisation_invitation_grants (
    organisation_id,
    invitation_id,
    role_version_id,
    scope_type,
    scope_unit_id
  )
  values (
    target_organisation_id,
    invitation_id,
    offered_role_version_id,
    offered_scope_type,
    offered_scope_unit_id
  );

  update public.organisation_invitations
  set offer_sealed_at = statement_timestamp()
  where organisation_id = target_organisation_id
    and id = invitation_id;

  perform private.append_security_audit(
    target_organisation_id,
    'invitation.issued',
    'invitation',
    invitation_id,
    'succeeded',
    jsonb_build_object('recipient_type', invitation_recipient_type)
  );

  return invitation_id;
end;
$$;

create or replace function private.grant_role_version(
  target_organisation_id uuid,
  target_grantee_membership_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_membership_id uuid :=
    private.current_membership_id(target_organisation_id);
  target_anchor_membership_id uuid;
  target_anchor_unit_id uuid;
  new_grant_id uuid;
  owner_role boolean;
begin
  target_anchor_membership_id :=
    case when target_scope_type = 'self'
      then target_grantee_membership_id else null end;
  target_anchor_unit_id :=
    case when target_scope_type = 'unit_subtree'
      then target_scope_unit_id else null end;

  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'roles.delegate',
      target_anchor_membership_id,
      target_anchor_unit_id
    ) then
    raise exception 'role delegation is not authorised'
      using errcode = '42501';
  end if;

  select role_row.is_owner_role
  into owner_role
  from public.role_versions role_version
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where role_version.organisation_id = target_organisation_id
    and role_version.id = target_role_version_id
    and role_version.status = 'published'
    and role_row.status = 'active';

  if owner_role is null
    or (owner_role and not private.current_membership_is_owner(
      target_organisation_id
    )) then
    raise exception 'role version cannot be delegated'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships membership
    where membership.organisation_id = target_organisation_id
      and membership.id = target_grantee_membership_id
      and membership.status = 'active'
  ) then
    raise exception 'grantee membership is not active'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = target_role_version_id
      and not private.has_scoped_permission(
        target_organisation_id,
        role_permission.permission_key,
        target_anchor_membership_id,
        target_anchor_unit_id
      )
  ) then
    raise exception 'delegated authority exceeds caller authority'
      using errcode = '42501';
  end if;

  update public.access_grants expired_grant
  set status = 'expired'
  where expired_grant.organisation_id = target_organisation_id
    and expired_grant.status = 'active'
    and expired_grant.expires_at <= statement_timestamp();

  insert into public.access_grants (
    organisation_id,
    grantee_membership_id,
    role_version_id,
    scope_type,
    scope_unit_id,
    grantor_membership_id
  )
  values (
    target_organisation_id,
    target_grantee_membership_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    actor_membership_id
  )
  returning id into new_grant_id;

  perform private.append_security_audit(
    target_organisation_id,
    'grant.issued',
    'grant',
    new_grant_id,
    'succeeded',
    '{}'::jsonb
  );

  return new_grant_id;
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
    select offered_grant.*, role_row.is_owner_role as role_is_owner_role
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
      invitation_grant.role_is_owner_role
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

alter function private.role_version_is_delegatable_at_scope(
  uuid, uuid, text, uuid, uuid
) owner to lean_hub_private_owner;
