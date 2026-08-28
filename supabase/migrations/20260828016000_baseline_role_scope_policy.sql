-- Authoritative grant-scope policy for roles.
-- Roles with policies restrict which access_grants.scope_type values may be used.
-- Roles without policies retain legacy permissive behaviour for custom/demo roles.

create table public.role_grant_scope_policies (
  organisation_id uuid not null,
  role_id uuid not null,
  scope_type text not null,
  constraint role_grant_scope_policies_organisation_id_role_id_scope_type_key
    primary key (organisation_id, role_id, scope_type),
  constraint role_grant_scope_policies_role_fkey
    foreign key (organisation_id, role_id)
    references public.roles(organisation_id, id)
    on delete cascade,
  constraint role_grant_scope_policies_scope_type_check
    check (scope_type in ('organisation', 'unit_subtree', 'self'))
);

create index role_grant_scope_policies_role_idx
  on public.role_grant_scope_policies (organisation_id, role_id);

alter table public.role_grant_scope_policies enable row level security;
alter table public.role_grant_scope_policies force row level security;

revoke all on public.role_grant_scope_policies from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.role_grant_scope_policies to lean_hub_private_owner;

create policy private_owner_all_role_grant_scope_policies
on public.role_grant_scope_policies
for all
to lean_hub_private_owner
using (true)
with check (true);

create or replace function private.role_grant_scope_allowed(
  target_organisation_id uuid,
  target_role_id uuid,
  target_scope_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1
      from public.role_grant_scope_policies policy_row
      where policy_row.organisation_id = target_organisation_id
        and policy_row.role_id = target_role_id
    ) then true
    else exists (
      select 1
      from public.role_grant_scope_policies policy_row
      where policy_row.organisation_id = target_organisation_id
        and policy_row.role_id = target_role_id
        and policy_row.scope_type = target_scope_type
    )
  end
$$;

create or replace function private.role_version_grant_scope_allowed(
  target_organisation_id uuid,
  target_role_version_id uuid,
  target_scope_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.role_grant_scope_allowed(
    target_organisation_id,
    (
      select role_version.role_id
      from public.role_versions role_version
      where role_version.organisation_id = target_organisation_id
        and role_version.id = target_role_version_id
    ),
    target_scope_type
  )
$$;

create or replace function private.assert_role_version_grant_scope_allowed(
  target_organisation_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_scope_type = 'unit_subtree' and target_scope_unit_id is null then
    raise exception 'unit subtree grants require a scope unit'
      using errcode = '23514';
  end if;

  if target_scope_type in ('organisation', 'self')
    and target_scope_unit_id is not null then
    raise exception 'organisation and self grants cannot specify a scope unit'
      using errcode = '23514';
  end if;

  if not private.role_version_grant_scope_allowed(
    target_organisation_id,
    target_role_version_id,
    target_scope_type
  ) then
    raise exception 'role scope is not permitted for this role'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.ensure_role_grant_scope_policies(
  target_organisation_id uuid,
  target_role_id uuid,
  allowed_scope_types text[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  allowed_scope_type text;
begin
  foreach allowed_scope_type in array allowed_scope_types
  loop
    insert into public.role_grant_scope_policies (
      organisation_id,
      role_id,
      scope_type
    )
    values (
      target_organisation_id,
      target_role_id,
      allowed_scope_type
    )
    on conflict (organisation_id, role_id, scope_type) do nothing;
  end loop;
end;
$$;

create or replace function private.ensure_baseline_role_grant_scope_policies(
  target_organisation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  role_row record;
begin
  for role_row in
    select role_table.id, role_table.canonical_name
    from public.roles role_table
    where role_table.organisation_id = target_organisation_id
      and role_table.status = 'active'
      and role_table.canonical_name in (
        'organisation-owner',
        'organisation-administrator',
        'manager',
        'team-member',
        'finance-validator'
      )
  loop
    perform private.ensure_role_grant_scope_policies(
      target_organisation_id,
      role_row.id,
      case role_row.canonical_name
        when 'organisation-owner' then array['organisation']::text[]
        when 'organisation-administrator' then array['organisation']::text[]
        when 'manager' then array['unit_subtree']::text[]
        when 'team-member' then array['unit_subtree']::text[]
        when 'finance-validator' then array['organisation']::text[]
      end
    );
  end loop;
end;
$$;

create or replace function private.provision_baseline_application_role(
  target_organisation_id uuid,
  actor_membership_id uuid,
  role_canonical_name text,
  role_display_name text,
  role_description text,
  role_is_protected boolean,
  permission_keys text[],
  allowed_scope_types text[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing_role_id uuid;
  new_role_id uuid;
  new_role_version_id uuid;
  target_permission_key text;
begin
  if actor_membership_id is null then
    raise exception 'baseline role provisioning requires an actor membership'
      using errcode = '23514';
  end if;

  select role_row.id
  into existing_role_id
  from public.roles role_row
  where role_row.organisation_id = target_organisation_id
    and role_row.canonical_name = role_canonical_name
    and role_row.status = 'active';

  if existing_role_id is not null then
    perform private.ensure_role_grant_scope_policies(
      target_organisation_id,
      existing_role_id,
      allowed_scope_types
    );
    return null;
  end if;

  insert into public.roles (
    organisation_id,
    canonical_name,
    display_name,
    description,
    is_protected,
    is_owner_role
  )
  values (
    target_organisation_id,
    role_canonical_name,
    role_display_name,
    role_description,
    role_is_protected,
    false
  )
  returning id into new_role_id;

  insert into public.role_versions (
    organisation_id,
    role_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    target_organisation_id,
    new_role_id,
    1,
    'draft',
    actor_membership_id
  )
  returning id into new_role_version_id;

  foreach target_permission_key in array permission_keys
  loop
    if not exists (
      select 1
      from public.permission_definitions permission
      where permission.permission_key = target_permission_key
    ) then
      raise exception 'unknown permission key: %', target_permission_key
        using errcode = '23514';
    end if;

    insert into public.role_permissions (
      organisation_id,
      role_version_id,
      permission_key
    )
    values (
      target_organisation_id,
      new_role_version_id,
      target_permission_key
    );
  end loop;

  update public.role_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = target_organisation_id
    and id = new_role_version_id;

  perform private.ensure_role_grant_scope_policies(
    target_organisation_id,
    new_role_id,
    allowed_scope_types
  );

  return new_role_version_id;
end;
$$;

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
declare
  role_definition record;
begin
  for role_definition in
    select *
    from (
      values
        (
          'organisation-administrator'::text,
          'Organisation Administrator'::text,
          'Administer organisation configuration, people, invitations, and Lean platform settings without owner authority.'::text,
          true,
          array['organisation']::text[],
          array[
            'organisation.update',
            'memberships.read',
            'memberships.manage',
            'invitations.manage',
            'hierarchy.read',
            'hierarchy.manage',
            'roles.read',
            'roles.delegate',
            'job_functions.read',
            'job_functions.manage',
            'templates.read',
            'templates.manage',
            'schedules.read',
            'schedules.manage',
            'schedules.complete',
            'maturity.read',
            'maturity.models.manage',
            'five_s.read',
            'five_s.standards.manage',
            'gemba.read',
            'gemba.definitions.manage',
            'training.read',
            'training.catalog.manage',
            'training.curriculum.manage',
            'training.sessions.manage',
            'training.completions.manage',
            'skills.read',
            'skills.catalog.manage',
            'skills.requirements.manage',
            'people.capability.read',
            'suggestions.read',
            'suggestions.manage',
            'suggestions.programmes.manage',
            'projects.read',
            'projects.manage',
            'benefits.read',
            'benefits.categories.manage',
            'benefits.manage',
            'problem_solving.view',
            'problem_solving.manage',
            'problem_solving.methods.manage',
            'recognition.read',
            'recognition.manage',
            'ai.manage_settings',
            'actions.read',
            'actions.create',
            'actions.update',
            'actions.assign',
            'actions.complete',
            'submissions.read',
            'submissions.create',
            'attachments.read',
            'attachments.upload',
            'comments.read',
            'comments.create',
            'maturity.assess.formal',
            'maturity.assess.self',
            'maturity.review',
            'five_s.audit.perform',
            'five_s.audit.review',
            'gemba.walk.perform',
            'gemba.walk.review',
            'skills.assess',
            'suggestions.review',
            'suggestions.submit',
            'recognition.award',
            'benefits.create',
            'benefits.validate.ci',
            'benefits.realisation.record',
            'problem_solving.create',
            'problem_solving.contribute',
            'problem_solving.facilitate',
            'ai.use',
            'ai.view_history'
          ]::text[]
        ),
        (
          'manager',
          'Manager',
          'Manage operational improvement activity within a delegated organisational unit subtree.',
          false,
          array['unit_subtree']::text[],
          array[
            'hierarchy.read',
            'memberships.read',
            'actions.read',
            'actions.create',
            'actions.update',
            'actions.assign',
            'actions.complete',
            'templates.read',
            'submissions.read',
            'submissions.create',
            'attachments.read',
            'attachments.upload',
            'comments.read',
            'comments.create',
            'maturity.read',
            'maturity.assess.formal',
            'maturity.review',
            'five_s.read',
            'five_s.audit.perform',
            'five_s.audit.review',
            'gemba.read',
            'gemba.walk.perform',
            'gemba.walk.review',
            'schedules.read',
            'schedules.manage',
            'schedules.complete',
            'job_functions.read',
            'training.read',
            'training.completions.manage',
            'skills.read',
            'skills.assess',
            'people.capability.read',
            'suggestions.read',
            'suggestions.review',
            'recognition.read',
            'recognition.award',
            'projects.read',
            'projects.manage',
            'benefits.read',
            'benefits.create',
            'benefits.manage',
            'benefits.validate.ci',
            'benefits.realisation.record',
            'problem_solving.view',
            'problem_solving.create',
            'problem_solving.contribute',
            'problem_solving.manage',
            'problem_solving.facilitate',
            'ai.use',
            'ai.view_history'
          ]::text[]
        ),
        (
          'team-member',
          'Team Member',
          'Participate in improvement activity, assigned work, and capability visibility without administrative authority.',
          false,
          array['unit_subtree']::text[],
          array[
            'actions.read',
            'templates.read',
            'submissions.create',
            'attachments.read',
            'comments.read',
            'comments.create',
            'maturity.read',
            'maturity.assess.self',
            'five_s.read',
            'five_s.audit.perform',
            'gemba.read',
            'gemba.walk.perform',
            'schedules.read',
            'people.capability.read',
            'training.read',
            'skills.read',
            'suggestions.read',
            'suggestions.submit',
            'recognition.read',
            'problem_solving.view',
            'problem_solving.contribute'
          ]::text[]
        ),
        (
          'finance-validator',
          'Finance Validator',
          'Read improvement benefits and perform finance validation with least privilege.',
          false,
          array['organisation']::text[],
          array[
            'hierarchy.read',
            'memberships.read',
            'benefits.read',
            'benefits.validate.finance',
            'benefits.realisation.validate'
          ]::text[]
        )
    ) as baseline_roles (
      canonical_name,
      display_name,
      description,
      is_protected,
      allowed_scope_types,
      permission_keys
    )
  loop
    perform private.provision_baseline_application_role(
      target_organisation_id,
      actor_membership_id,
      role_definition.canonical_name,
      role_definition.display_name,
      role_definition.description,
      role_definition.is_protected,
      role_definition.permission_keys,
      role_definition.allowed_scope_types
    );
  end loop;

  perform private.ensure_baseline_role_grant_scope_policies(target_organisation_id);
end;
$$;

create or replace function private.provision_organisation(
  owner_user_id uuid,
  organisation_code text,
  organisation_name text,
  organisation_locale text default 'en-GB',
  organisation_time_zone text default 'UTC',
  organisation_reporting_currency text default 'GBP'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_organisation_id uuid;
  owner_membership_id uuid;
  owner_role_id uuid;
  owner_role_version_id uuid;
begin
  if not private.auth_user_exists(owner_user_id) then
    raise exception 'owner Auth user does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from pg_timezone_names zone
    where zone.name = organisation_time_zone
  ) then
    raise exception 'invalid time zone'
      using errcode = '23514';
  end if;

  insert into public.organisations (
    code,
    name,
    locale,
    time_zone,
    reporting_currency,
    status,
    status_reason
  )
  values (
    organisation_code,
    organisation_name,
    organisation_locale,
    organisation_time_zone,
    organisation_reporting_currency,
    'active',
    null
  )
  returning id into new_organisation_id;

  update private.identity_controls
  set status = 'active',
      enrolment_status = 'complete',
      enrolment_completed_at = coalesce(
        enrolment_completed_at,
        statement_timestamp()
      ),
      status_changed_at = statement_timestamp()
  where user_id = owner_user_id
    and status <> 'disabled';

  if not found then
    raise exception 'owner identity is unavailable'
      using errcode = '42501';
  end if;

  insert into public.organisation_memberships (
    organisation_id,
    user_id,
    status,
    activated_at
  )
  values (
    new_organisation_id,
    owner_user_id,
    'active',
    statement_timestamp()
  )
  returning id into owner_membership_id;

  insert into public.roles (
    organisation_id,
    canonical_name,
    display_name,
    description,
    is_protected,
    is_owner_role
  )
  values (
    new_organisation_id,
    'organisation-owner',
    'Organisation Owner',
    'Protected organisation owner role.',
    true,
    true
  )
  returning id into owner_role_id;

  insert into public.role_versions (
    organisation_id,
    role_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    new_organisation_id,
    owner_role_id,
    1,
    'draft',
    owner_membership_id
  )
  returning id into owner_role_version_id;

  insert into public.role_permissions (
    organisation_id,
    role_version_id,
    permission_key
  )
  select
    new_organisation_id,
    owner_role_version_id,
    permission.permission_key
  from public.permission_definitions permission;

  update public.role_versions
  set status = 'published',
      published_by_membership_id = owner_membership_id,
      published_at = statement_timestamp()
  where id = owner_role_version_id
    and organisation_id = new_organisation_id;

  perform private.ensure_role_grant_scope_policies(
    new_organisation_id,
    owner_role_id,
    array['organisation']::text[]
  );

  insert into public.access_grants (
    organisation_id,
    grantee_membership_id,
    role_version_id,
    scope_type,
    grantor_membership_id
  )
  values (
    new_organisation_id,
    owner_membership_id,
    owner_role_version_id,
    'organisation',
    owner_membership_id
  );

  perform private.ensure_organisation_baseline_application_roles(
    new_organisation_id,
    owner_membership_id
  );

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    new_organisation_id,
    'organisation.provisioned',
    'organisation',
    new_organisation_id,
    'succeeded',
    gen_random_uuid(),
    '{}'::jsonb
  );

  perform private.ensure_builtin_problem_solving_methods(new_organisation_id);

  return new_organisation_id;
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
    select distinct on (role_row.id)
      role_version.id as role_version_id,
      role_row.id as role_id,
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
    order by role_row.id, role_version.version_number desc
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
    end if;

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

  perform private.assert_role_version_grant_scope_allowed(
    target_organisation_id,
    offered_role_version_id,
    offered_scope_type,
    offered_scope_unit_id
  );

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
  ) or not private.role_version_is_delegatable_at_scope(
    target_organisation_id,
    offered_role_version_id,
    offered_scope_type,
    offered_scope_unit_id,
    actor_membership_id
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

  perform private.assert_role_version_grant_scope_allowed(
    target_organisation_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id
  );

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

  if not private.role_version_is_delegatable_at_scope(
    target_organisation_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    actor_membership_id
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

-- Backfill scope policies for existing organisations.
do $$
declare
  organisation_row record;
begin
  for organisation_row in
    select organisation.id as organisation_id
    from public.organisations organisation
    where organisation.status in ('active', 'provisioning', 'suspended')
  loop
    perform private.ensure_baseline_role_grant_scope_policies(
      organisation_row.organisation_id
    );
  end loop;
end;
$$;

alter function private.role_grant_scope_allowed(uuid, uuid, text)
  owner to lean_hub_private_owner;
grant execute on function private.role_grant_scope_allowed(uuid, uuid, text) to authenticated;
alter function private.role_version_grant_scope_allowed(uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.assert_role_version_grant_scope_allowed(uuid, uuid, text, uuid)
  owner to lean_hub_private_owner;
alter function private.ensure_role_grant_scope_policies(uuid, uuid, text[])
  owner to lean_hub_private_owner;
alter function private.ensure_baseline_role_grant_scope_policies(uuid)
  owner to lean_hub_private_owner;
alter function private.provision_baseline_application_role(
  uuid, uuid, text, text, text, boolean, text[], text[]
) owner to lean_hub_private_owner;
alter function private.ensure_organisation_baseline_application_roles(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.provision_organisation(uuid, text, text, text, text, text)
  owner to lean_hub_private_owner;
alter function private.issue_organisation_invitation(
  uuid, text, text, bytea, timestamptz, uuid, text, uuid
) owner to lean_hub_private_owner;
alter function private.grant_role_version(uuid, uuid, uuid, text, uuid)
  owner to lean_hub_private_owner;
alter function private.accept_organisation_invitation(bytea)
  owner to lean_hub_private_owner;
