-- Provision a default application-role catalogue for every organisation.
-- Idempotent: respects existing roles matched by canonical_name.

create or replace function private.provision_baseline_application_role(
  target_organisation_id uuid,
  actor_membership_id uuid,
  role_canonical_name text,
  role_display_name text,
  role_description text,
  role_is_protected boolean,
  permission_keys text[]
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
          array[
            -- Organisation and people administration (protected)
            'organisation.update',
            'memberships.read',
            'memberships.manage',
            'invitations.manage',
            'hierarchy.read',
            'hierarchy.manage',
            'roles.read',
            'roles.delegate',
            -- Job functions for people setup
            'job_functions.read',
            'job_functions.manage',
            -- Lean platform configuration
            'templates.read',
            'templates.manage',
            'schedules.read',
            'schedules.manage',
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
            'ai.manage_settings'
          ]::text[]
        ),
        (
          'manager',
          'Manager',
          'Manage operational improvement activity within a delegated organisational unit subtree.',
          false,
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
      role_definition.permission_keys
    );
  end loop;
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

-- Backfill baseline roles for existing organisations without touching grants.
do $$
declare
  organisation_row record;
  owner_membership_id uuid;
begin
  for organisation_row in
    select organisation.id as organisation_id
    from public.organisations organisation
    where organisation.status in ('active', 'provisioning', 'suspended')
  loop
    select membership.id
    into owner_membership_id
    from public.organisation_memberships membership
    join public.access_grants grant_row
      on grant_row.organisation_id = membership.organisation_id
     and grant_row.grantee_membership_id = membership.id
     and grant_row.status = 'active'
     and (
       grant_row.expires_at is null
       or grant_row.expires_at > statement_timestamp()
     )
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
    where membership.organisation_id = organisation_row.organisation_id
      and membership.status = 'active'
    order by membership.created_at
    limit 1;

    if owner_membership_id is null then
      select membership.id
      into owner_membership_id
      from public.organisation_memberships membership
      where membership.organisation_id = organisation_row.organisation_id
        and membership.status = 'active'
      order by membership.created_at
      limit 1;
    end if;

    if owner_membership_id is not null then
      perform private.ensure_organisation_baseline_application_roles(
        organisation_row.organisation_id,
        owner_membership_id
      );
    end if;
  end loop;
end;
$$;

alter function private.provision_baseline_application_role(
  uuid, uuid, text, text, text, boolean, text[]
) owner to lean_hub_private_owner;
alter function private.ensure_organisation_baseline_application_roles(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.provision_organisation(uuid, text, text, text, text, text)
  owner to lean_hub_private_owner;
