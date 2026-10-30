-- Multi-grant invitations and Suggestions Contributor.
--
-- One invitation can carry several role-and-scope grants. Every grant is
-- validated before any invitation row is written. Reissue and acceptance
-- validate the whole set again and fail closed. Repeating acceptance for the
-- same person returns the existing membership and does not add grants.
--
-- Suggestions Contributor is a new role. The published Suggestions role is
-- left unchanged.

create or replace function private.assert_invitation_grant_delegatable(
  target_organisation_id uuid,
  actor_membership_id uuid,
  offered_role_version_id uuid,
  offered_scope_type text,
  offered_scope_unit_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  containment_membership_id uuid;
  containment_unit_id uuid;
begin
  containment_unit_id := case
    when offered_scope_type = 'unit_subtree' then offered_scope_unit_id
    else null
  end;
  containment_membership_id := case
    when offered_scope_type = 'self' then actor_membership_id
    else null
  end;

  perform private.assert_role_version_grant_scope_allowed(
    target_organisation_id,
    offered_role_version_id,
    offered_scope_type,
    offered_scope_unit_id
  );

  if actor_membership_id is null
    or not exists (
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
          or private.membership_is_effective_owner(
            actor_membership_id,
            target_organisation_id
          )
        )
    )
    or not private.membership_has_scoped_permission(
      actor_membership_id,
      target_organisation_id,
      'roles.delegate',
      containment_membership_id,
      containment_unit_id
    )
    or not private.role_version_is_delegatable_at_scope(
      target_organisation_id,
      offered_role_version_id,
      offered_scope_type,
      offered_scope_unit_id,
      actor_membership_id
    ) then
    raise exception 'invitation authority is no longer delegable'
      using errcode = '42501';
  end if;
end;
$$;


create or replace function public.issue_organisation_member_invitation_grants(
  invitation_recipient_type text,
  invitation_canonical_recipient text,
  invitation_token_digest bytea,
  invitation_expires_at timestamptz,
  offered_grants jsonb,
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
  actor_membership_id uuid := private.current_membership_id(org_id);
  invitation_id uuid;
  grant_element jsonb;
  grant_role_version_id uuid;
  grant_scope_type text;
  grant_scope_unit_id uuid;
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      org_id,
      'invitations.manage',
      null,
      null
    ) then
    raise exception 'invitation issue is not authorised'
      using errcode = '42501';
  end if;

  if jsonb_typeof(offered_grants) is distinct from 'array'
    or jsonb_array_length(offered_grants) < 1
    or jsonb_array_length(offered_grants) > 10 then
    raise exception 'invitation requires between 1 and 10 roles'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(offered_grants) grant_row
    group by
      grant_row ->> 'role_version_id',
      grant_row ->> 'scope_type',
      nullif(grant_row ->> 'scope_unit_id', '')
    having count(*) > 1
  ) then
    raise exception 'invitation contains a duplicate role and scope'
      using errcode = '22023';
  end if;

  for grant_element in
    select value from jsonb_array_elements(offered_grants)
  loop
    if jsonb_typeof(grant_element) is distinct from 'object'
      or grant_element ->> 'role_version_id' is null
      or grant_element ->> 'scope_type' is null then
      raise exception 'invitation grant is incomplete'
        using errcode = '22023';
    end if;

    grant_role_version_id := (grant_element ->> 'role_version_id')::uuid;
    grant_scope_type := grant_element ->> 'scope_type';
    grant_scope_unit_id := nullif(grant_element ->> 'scope_unit_id', '')::uuid;

    perform private.assert_invitation_grant_delegatable(
      org_id,
      actor_membership_id,
      grant_role_version_id,
      grant_scope_type,
      grant_scope_unit_id
    );
  end loop;

  update public.organisation_invitations invitation
  set status = 'expired',
      expired_at = statement_timestamp(),
      status_changed_at = statement_timestamp(),
      status_changed_by_membership_id = actor_membership_id
  where invitation.organisation_id = org_id
    and invitation.recipient_type = invitation_recipient_type
    and invitation.canonical_recipient = invitation_canonical_recipient
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
    org_id,
    invitation_recipient_type,
    invitation_canonical_recipient,
    invitation_token_digest,
    actor_membership_id,
    invitation_expires_at
  )
  returning id into invitation_id;

  for grant_element in
    select value from jsonb_array_elements(offered_grants)
  loop
    insert into public.organisation_invitation_grants (
      organisation_id,
      invitation_id,
      role_version_id,
      scope_type,
      scope_unit_id
    )
    values (
      org_id,
      invitation_id,
      (grant_element ->> 'role_version_id')::uuid,
      grant_element ->> 'scope_type',
      nullif(grant_element ->> 'scope_unit_id', '')::uuid
    );
  end loop;

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

  update public.organisation_invitations
  set offer_sealed_at = statement_timestamp()
  where organisation_id = org_id
    and id = invitation_id;

  perform private.append_security_audit(
    org_id,
    'invitation.issued',
    'invitation',
    invitation_id,
    'succeeded',
    jsonb_build_object(
      'recipient_type', invitation_recipient_type,
      'grant_count', jsonb_array_length(offered_grants)
    )
  );

  return invitation_id;
end;
$$;

CREATE OR REPLACE FUNCTION private.accept_organisation_invitation(invitation_token_digest bytea)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_user_id uuid := private.auth_uid();
  actor_session_id uuid := private.current_session_id();
  invitation_row public.organisation_invitations%rowtype;
  resolved_membership_id uuid;
  invitation_grant record;
  containment_membership_id uuid;
  containment_unit_id uuid;
  new_grant_id uuid;
  expected_grant_count integer := 0;
  inserted_grant_count integer := 0;
begin
  if actor_user_id is null or actor_session_id is null then
    raise exception 'authenticated live session required'
      using errcode = '42501';
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest
  for update;

  if invitation_row.id is null then
    raise exception 'invitation is unavailable'
      using errcode = '42501';
  end if;

  if invitation_row.status = 'accepted'
    and invitation_row.accepted_membership_id is not null
    and exists (
      select 1
      from public.organisation_memberships membership
      where membership.id = invitation_row.accepted_membership_id
        and membership.organisation_id = invitation_row.organisation_id
        and membership.user_id = actor_user_id
        and membership.status = 'active'
    ) then
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
      invitation_row.accepted_membership_id
    )
    on conflict (session_id) do update
      set user_id = excluded.user_id,
          organisation_id = excluded.organisation_id,
          membership_id = excluded.membership_id,
          selected_at = statement_timestamp();

    return invitation_row.accepted_membership_id;
  end if;

  if invitation_row.status <> 'pending'
    or invitation_row.offer_sealed_at is null
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
    select
      offered_grant.role_version_id,
      offered_grant.scope_type,
      offered_grant.scope_unit_id,
      role_version.status as role_version_status,
      role_row.status as role_status,
      coalesce(role_row.is_owner_role, false) as role_is_owner_role
    from public.organisation_invitation_grants offered_grant
    left join public.role_versions role_version
      on role_version.organisation_id = offered_grant.organisation_id
     and role_version.id = offered_grant.role_version_id
    left join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where offered_grant.organisation_id = invitation_row.organisation_id
      and offered_grant.invitation_id = invitation_row.id
  loop
    if invitation_grant.role_version_status is distinct from 'published'
      or invitation_grant.role_status is distinct from 'active' then
      raise exception 'invitation authority is no longer delegable'
        using errcode = '42501';
    end if;
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

    if not private.role_version_grant_scope_allowed(
      invitation_row.organisation_id,
      invitation_grant.role_version_id,
      invitation_grant.scope_type
    ) then
      raise exception 'invitation authority is no longer delegable'
        using errcode = '42501';
    end if;

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
    ) or not private.role_version_is_delegatable_at_scope(
      invitation_row.organisation_id,
      invitation_grant.role_version_id,
      invitation_grant.scope_type,
      invitation_grant.scope_unit_id,
      invitation_row.inviter_membership_id
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

    inserted_grant_count := inserted_grant_count + 1;
  end loop;

  select count(*)
  into expected_grant_count
  from public.organisation_invitation_grants offered_grant
  where offered_grant.organisation_id = invitation_row.organisation_id
    and offered_grant.invitation_id = invitation_row.id;

  if expected_grant_count = 0
    or inserted_grant_count <> expected_grant_count then
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
$function$;


CREATE OR REPLACE FUNCTION private.reissue_organisation_invitation(target_organisation_id uuid, target_invitation_id uuid, replacement_token_digest bytea, replacement_expires_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_membership_id uuid :=
    private.current_membership_id(target_organisation_id);
  source_invitation public.organisation_invitations%rowtype;
  source_grant public.organisation_invitation_grants%rowtype;
  source_provisioning public.organisation_invitation_provisioning%rowtype;
  replacement_invitation_id uuid;
begin
  if actor_membership_id is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'invitations.manage',
      null,
      null
    ) then
    raise exception 'invitation reissue is not authorised'
      using errcode = '42501';
  end if;

  select *
  into source_invitation
  from public.organisation_invitations invitation
  where invitation.organisation_id = target_organisation_id
    and invitation.id = target_invitation_id
  for update;

  if source_invitation.id is null then
    raise exception 'invitation not found'
      using errcode = 'P0002';
  end if;

  if source_invitation.status <> 'pending' then
    raise exception 'invitation cannot be reissued'
      using errcode = '42501';
  end if;

  for source_grant in
    select offered_grant.*
    from public.organisation_invitation_grants offered_grant
    where offered_grant.organisation_id = target_organisation_id
      and offered_grant.invitation_id = target_invitation_id
  loop
    perform private.assert_invitation_grant_delegatable(
      target_organisation_id,
      actor_membership_id,
      source_grant.role_version_id,
      source_grant.scope_type,
      source_grant.scope_unit_id
    );
  end loop;

  if not exists (
    select 1
    from public.organisation_invitation_grants offered_grant
    where offered_grant.organisation_id = target_organisation_id
      and offered_grant.invitation_id = target_invitation_id
  ) then
    raise exception 'invitation has no valid authority offer'
      using errcode = '23514';
  end if;

  perform private.invalidate_organisation_invitation_signup_bindings(
    source_invitation.id,
    'Invitation reissued'
  );

  update public.organisation_invitations invitation
  set status = 'revoked',
      revoked_at = statement_timestamp(),
      status_changed_at = statement_timestamp(),
      status_changed_by_membership_id = actor_membership_id,
      status_reason = 'Reissued by administrator'
  where invitation.organisation_id = target_organisation_id
    and invitation.id = target_invitation_id;

  insert into public.organisation_invitations (
    organisation_id,
    recipient_type,
    canonical_recipient,
    token_digest,
    inviter_membership_id,
    expires_at
  )
  values (
    source_invitation.organisation_id,
    source_invitation.recipient_type,
    source_invitation.canonical_recipient,
    replacement_token_digest,
    actor_membership_id,
    replacement_expires_at
  )
  returning id into replacement_invitation_id;

  for source_grant in
    select offered_grant.*
    from public.organisation_invitation_grants offered_grant
    where offered_grant.organisation_id = target_organisation_id
      and offered_grant.invitation_id = target_invitation_id
  loop
    insert into public.organisation_invitation_grants (
      organisation_id,
      invitation_id,
      role_version_id,
      scope_type,
      scope_unit_id
    )
    values (
      source_grant.organisation_id,
      replacement_invitation_id,
      source_grant.role_version_id,
      source_grant.scope_type,
      source_grant.scope_unit_id
    );
  end loop;

  select provisioning.*
  into source_provisioning
  from public.organisation_invitation_provisioning provisioning
  where provisioning.organisation_id = target_organisation_id
    and provisioning.invitation_id = target_invitation_id;

  if source_provisioning.invitation_id is not null then
    insert into public.organisation_invitation_provisioning (
      organisation_id,
      invitation_id,
      intended_display_name,
      intended_job_function_id,
      intended_organisational_unit_id
    )
    values (
      source_provisioning.organisation_id,
      replacement_invitation_id,
      source_provisioning.intended_display_name,
      source_provisioning.intended_job_function_id,
      source_provisioning.intended_organisational_unit_id
    );
  end if;

  update public.organisation_invitations invitation
  set offer_sealed_at = statement_timestamp()
  where invitation.organisation_id = target_organisation_id
    and invitation.id = replacement_invitation_id;

  perform private.append_security_audit(
    target_organisation_id,
    'invitation.reissued',
    'invitation',
    replacement_invitation_id,
    'succeeded',
    jsonb_build_object('replaced_invitation_id', target_invitation_id)
  );

  return replacement_invitation_id;
end;
$function$;


CREATE OR REPLACE FUNCTION private.preview_organisation_invitation(invitation_token_digest bytea)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  invitation_row public.organisation_invitations%rowtype;
  organisation_name text;
  grant_row record;
  role_display_name text;
  scope_label text;
  invited_name text;
  invitation_grants jsonb;
begin
  if invitation_token_digest is null
    or octet_length(invitation_token_digest) <> 32 then
    return jsonb_build_object('state', 'invalid');
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.token_digest = invitation_token_digest;

  if invitation_row.id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select organisation.name
  into organisation_name
  from public.organisations organisation
  where organisation.id = invitation_row.organisation_id;

  if invitation_row.status = 'revoked' then
    return jsonb_build_object('state', 'revoked');
  end if;

  if invitation_row.status = 'accepted' then
    return jsonb_build_object(
      'state', 'accepted',
      'organisation_name', organisation_name
    );
  end if;

  if invitation_row.status = 'expired'
    or (
      invitation_row.status = 'pending'
      and invitation_row.expires_at <= statement_timestamp()
    ) then
    return jsonb_build_object('state', 'expired');
  end if;

  if invitation_row.status <> 'pending'
    or invitation_row.offer_sealed_at is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select
    role_row.display_name,
    private.invitation_scope_label(
      offered_grant.scope_type,
      offered_grant.scope_unit_id
    )
  into role_display_name, scope_label
  from public.organisation_invitation_grants offered_grant
  join public.role_versions role_version
    on role_version.organisation_id = offered_grant.organisation_id
   and role_version.id = offered_grant.role_version_id
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where offered_grant.organisation_id = invitation_row.organisation_id
    and offered_grant.invitation_id = invitation_row.id
  order by offered_grant.created_at
  limit 1;

  select provisioning.intended_display_name
  into invited_name
  from public.organisation_invitation_provisioning provisioning
  where provisioning.organisation_id = invitation_row.organisation_id
    and provisioning.invitation_id = invitation_row.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role_display_name', role_row.display_name,
        'scope_label', private.invitation_scope_label(
          offered_grant.scope_type,
          offered_grant.scope_unit_id
        )
      )
      order by offered_grant.created_at
    ),
    '[]'::jsonb
  )
  into invitation_grants
  from public.organisation_invitation_grants offered_grant
  join public.role_versions role_version
    on role_version.organisation_id = offered_grant.organisation_id
   and role_version.id = offered_grant.role_version_id
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
   and role_row.id = role_version.role_id
  where offered_grant.organisation_id = invitation_row.organisation_id
    and offered_grant.invitation_id = invitation_row.id;

  return jsonb_build_object(
    'state', 'valid',
    'organisation_name', organisation_name,
    'recipient_email', invitation_row.canonical_recipient,
    'recipient_email_masked',
      private.mask_invitation_email(invitation_row.canonical_recipient),
    'role_display_name', coalesce(role_display_name, 'Application access'),
    'scope_label', coalesce(scope_label, 'Scoped access'),
    'intended_display_name', invited_name,
    'grants', invitation_grants,
    'expires_at', invitation_row.expires_at
  );
end;
$function$;


CREATE OR REPLACE FUNCTION private.membership_can_read_improvement_suggestion(target_organisation_id uuid, target_suggestion_id uuid, target_membership_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = target_suggestion_id
      and (
        private.membership_has_scoped_permission(
          target_membership_id,
          target_organisation_id,
          'suggestions.read',
          null,
          null
        )
        or private.membership_has_scoped_permission(
          target_membership_id,
          target_organisation_id,
          'suggestions.read',
          null,
          suggestion_row.origin_unit_id
        )
        or private.membership_has_scoped_permission(
          target_membership_id,
          target_organisation_id,
          'suggestions.read',
          null,
          suggestion_row.review_jurisdiction_unit_id
        )
        or (
          private.membership_has_scoped_permission(
            target_membership_id,
            target_organisation_id,
            'suggestions.read',
            suggestion_row.author_membership_id,
            null
          )
          and (
            suggestion_row.author_membership_id = target_membership_id
            or private.is_active_suggestion_contributor(
              target_organisation_id,
              target_suggestion_id,
              target_membership_id
            )
            or private.is_active_suggestion_reviewer(
              target_organisation_id,
              target_suggestion_id,
              target_membership_id
            )
          )
        )
        or (
          private.is_active_suggestion_reviewer(
            target_organisation_id,
            target_suggestion_id,
            target_membership_id
          )
          and private.membership_can_review_suggestion_jurisdiction(
            target_organisation_id,
            target_membership_id,
            suggestion_row.review_jurisdiction_unit_id
          )
        )
        or (
          suggestion_row.author_membership_id = target_membership_id
          and (
            private.membership_has_scoped_permission(
              target_membership_id,
              target_organisation_id,
              'suggestions.submit',
              null,
              null
            )
            or private.membership_has_scoped_permission(
              target_membership_id,
              target_organisation_id,
              'suggestions.submit',
              null,
              suggestion_row.origin_unit_id
            )
          )
        )
      )
  )
$function$;



create or replace function private.ensure_organisation_baseline_application_roles(
  target_organisation_id uuid,
  actor_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.ensure_organisation_baseline_application_roles$m1(
    target_organisation_id,
    actor_membership_id
  );

  perform private.ensure_baseline_role_permissions(
    target_organisation_id,
    'organisation-administrator',
    array[
      'workforce.provision',
      'workforce.credentials.reset',
      'workforce.import'
    ]::text[]
  );

  perform private.provision_baseline_application_role(
    target_organisation_id,
    actor_membership_id,
    'suggestions-contributor',
    'Suggestions Contributor',
    'Submit improvement suggestions within the granted scope. This role does not review or manage the suggestions portfolio.',
    true,
    array['suggestions.submit']::text[],
    array['organisation', 'unit_subtree']::text[]
  );
end;
$$;

do $$
declare
  organisation_row record;
  actor_membership_id uuid;
begin
  for organisation_row in
    select organisation.id
    from public.organisations organisation
  loop
    select membership.id
    into actor_membership_id
    from public.organisation_memberships membership
    join public.access_grants grant_row
      on grant_row.organisation_id = membership.organisation_id
     and grant_row.grantee_membership_id = membership.id
     and grant_row.status = 'active'
     and grant_row.scope_type = 'organisation'
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.is_owner_role
     and role_row.status = 'active'
    where membership.organisation_id = organisation_row.id
      and membership.status = 'active'
    order by membership.created_at
    limit 1;

    if actor_membership_id is not null then
      perform private.provision_baseline_application_role(
        organisation_row.id,
        actor_membership_id,
        'suggestions-contributor',
        'Suggestions Contributor',
        'Submit improvement suggestions within the granted scope. This role does not review or manage the suggestions portfolio.',
        true,
        array['suggestions.submit']::text[],
        array['organisation', 'unit_subtree']::text[]
      );
    end if;
  end loop;
end;
$$;

alter function private.assert_invitation_grant_delegatable(uuid, uuid, uuid, text, uuid)
  owner to lean_hub_private_owner;
alter function private.accept_organisation_invitation(bytea)
  owner to lean_hub_private_owner;
alter function private.reissue_organisation_invitation(uuid, uuid, bytea, timestamptz)
  owner to lean_hub_private_owner;
alter function private.preview_organisation_invitation(bytea)
  owner to lean_hub_private_owner;
alter function private.membership_can_read_improvement_suggestion(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.ensure_organisation_baseline_application_roles(uuid, uuid)
  owner to lean_hub_private_owner;
alter function public.issue_organisation_member_invitation_grants(
  text, text, bytea, timestamptz, jsonb, text, uuid, uuid
) owner to postgres;

revoke all on function private.assert_invitation_grant_delegatable(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.issue_organisation_member_invitation_grants(
  text, text, bytea, timestamptz, jsonb, text, uuid, uuid
) from public, anon;

grant execute on function public.issue_organisation_member_invitation_grants(
  text, text, bytea, timestamptz, jsonb, text, uuid, uuid
) to authenticated;
