-- RBAC2 foundation: module responsibility catalogue, baseline participation, profile/delegation metadata.

-- ---------------------------------------------------------------------------
-- Schema: identify module responsibility roles
-- ---------------------------------------------------------------------------

alter table public.roles
  add column if not exists module_responsibility_key text;

alter table public.roles
  drop constraint if exists roles_module_responsibility_key_check;

alter table public.roles
  add constraint roles_module_responsibility_key_check
  check (
    module_responsibility_key is null
    or module_responsibility_key in (
      'admin',
      'maturity',
      'five_s',
      'gemba',
      'actions',
      'projects',
      'benefits',
      'problem_solving',
      'suggestions',
      'people',
      'training',
      'skills',
      'recognition'
    )
  );

create unique index if not exists roles_org_module_responsibility_key_idx
  on public.roles (organisation_id, module_responsibility_key)
  where module_responsibility_key is not null
    and status = 'active';

-- ---------------------------------------------------------------------------
-- Baseline participation catalogue (active member implicit permissions)
-- ---------------------------------------------------------------------------

create table if not exists private.baseline_participation_permissions (
  permission_key text primary key,
  scope_mode text not null,
  constraint baseline_participation_permissions_scope_mode_check
    check (scope_mode in ('organisation', 'self'))
);

alter table private.baseline_participation_permissions
  owner to lean_hub_private_owner;

alter table private.baseline_participation_permissions enable row level security;
alter table private.baseline_participation_permissions force row level security;

revoke all on table private.baseline_participation_permissions
  from public, anon, authenticated, service_role;
grant select on table private.baseline_participation_permissions
  to postgres, lean_hub_private_owner;

create policy private_owner_all_baseline_participation_permissions
on private.baseline_participation_permissions
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy postgres_all_baseline_participation_permissions
on private.baseline_participation_permissions
for all
to postgres
using (true)
with check (true);

-- Baseline catalogue: organisation-mode READ visibility and explicit PR1
-- participation writes that are independently authorised by module RPC/RLS.
-- Write/perform/contribute permissions that rely on assignment/participant
-- checks (5S audit perform, Gemba walk perform, problem solving contribute,
-- generic submissions/comments create) are intentionally excluded here.
insert into private.baseline_participation_permissions (permission_key, scope_mode)
values
  ('suggestions.read', 'organisation'),
  ('suggestions.submit', 'organisation'),
  ('actions.read', 'self'),
  ('actions.complete', 'self'),
  ('training.read', 'self'),
  ('skills.read', 'self'),
  ('people.capability.read', 'self'),
  ('maturity.read', 'organisation'),
  ('five_s.read', 'organisation'),
  ('gemba.read', 'organisation'),
  ('problem_solving.view', 'organisation'),
  ('projects.read', 'organisation'),
  ('benefits.read', 'organisation'),
  ('recognition.read', 'organisation'),
  ('templates.read', 'organisation'),
  ('attachments.read', 'organisation'),
  ('comments.read', 'organisation'),
  ('schedules.read', 'organisation')
on conflict (permission_key) do nothing;

-- Organisation-mode baseline authorises active members without evaluating
-- target_unit_id. Unit/site containment for reads is deferred to PR2; write
-- and perform authority must not be granted organisation-wide here.
create or replace function private.membership_has_baseline_participation(
  actor_membership_id uuid,
  target_organisation_id uuid,
  target_permission_key text,
  target_membership_id uuid default null,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_memberships actor_membership
    join public.organisations organisation
      on organisation.id = actor_membership.organisation_id
     and organisation.status = 'active'
    join private.identity_controls identity_control
      on identity_control.user_id = actor_membership.user_id
     and identity_control.status = 'active'
     and identity_control.enrolment_status = 'complete'
    join private.baseline_participation_permissions baseline_permission
      on baseline_permission.permission_key = target_permission_key
    where actor_membership.id = actor_membership_id
      and actor_membership.organisation_id = target_organisation_id
      and actor_membership.status = 'active'
      and (
        (
          baseline_permission.scope_mode = 'organisation'
          and target_membership_id is null
        )
        or (
          baseline_permission.scope_mode = 'self'
          and (
            target_membership_id is null
            or target_membership_id = actor_membership.id
          )
        )
      )
  )
$$;

create or replace function private.membership_has_scoped_permission(
  actor_membership_id uuid,
  target_organisation_id uuid,
  target_permission_key text,
  target_membership_id uuid default null,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join public.access_grants grant_row
        on grant_row.organisation_id = actor_membership.organisation_id
       and grant_row.grantee_membership_id = actor_membership.id
       and grant_row.status = 'active'
       and (
         grant_row.expires_at is null
         or grant_row.expires_at > statement_timestamp()
       )
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
       and role_version.status = 'published'
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
       and role_row.status = 'active'
      join public.role_permissions role_permission
        on role_permission.organisation_id = role_version.organisation_id
       and role_permission.role_version_id = role_version.id
       and role_permission.permission_key = target_permission_key
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = target_organisation_id
        and actor_membership.status = 'active'
        and (
          grant_row.scope_type = 'organisation'
          or (
            grant_row.scope_type = 'self'
            and target_membership_id = actor_membership.id
          )
          or (
            grant_row.scope_type = 'unit_subtree'
            and target_unit_id is not null
            and exists (
              select 1
              from public.organisation_unit_closure closure
              where closure.organisation_id = grant_row.organisation_id
                and closure.ancestor_unit_id = grant_row.scope_unit_id
                and closure.descendant_unit_id = target_unit_id
            )
          )
        )
    ),
    false
  )
  or private.membership_has_baseline_participation(
    actor_membership_id,
    target_organisation_id,
    target_permission_key,
    target_membership_id,
    target_unit_id
  )
$$;

create or replace function public.member_has_permission(
  target_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.status = 'active'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key = target_permission_key
    where grant_row.organisation_id = private.current_organisation_id()
      and grant_row.grantee_membership_id =
        private.current_membership_id(grant_row.organisation_id)
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
  )
  or (
    private.current_organisation_id() is not null
    and private.current_membership_id(private.current_organisation_id()) is not null
    and private.membership_has_baseline_participation(
      private.current_membership_id(private.current_organisation_id()),
      private.current_organisation_id(),
      target_permission_key,
      null,
      null
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- Module responsibility catalogue provisioning
-- ---------------------------------------------------------------------------

create or replace function private.provision_module_responsibility_role(
  target_organisation_id uuid,
  actor_membership_id uuid,
  responsibility_key text,
  role_display_name text,
  role_description text,
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
  role_canonical_name text := 'responsibility-' || responsibility_key;
  existing_role_id uuid;
  new_role_version_id uuid;
begin
  new_role_version_id := private.provision_baseline_application_role(
    target_organisation_id,
    actor_membership_id,
    role_canonical_name,
    role_display_name,
    role_description,
    true,
    permission_keys,
    allowed_scope_types
  );

  select role_row.id
  into existing_role_id
  from public.roles role_row
  where role_row.organisation_id = target_organisation_id
    and role_row.canonical_name = role_canonical_name
    and role_row.status = 'active';

  if existing_role_id is not null then
    update public.roles role_row
    set module_responsibility_key = responsibility_key
    where role_row.organisation_id = target_organisation_id
      and role_row.id = existing_role_id
      and role_row.module_responsibility_key is distinct from responsibility_key;
  end if;

  return new_role_version_id;
end;
$$;

create or replace function private.ensure_organisation_module_responsibility_roles(
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
  module_scope_types text[] := array['organisation', 'unit_subtree']::text[];
begin
  update public.roles role_row
  set module_responsibility_key = 'admin'
  where role_row.organisation_id = target_organisation_id
    and role_row.canonical_name = 'organisation-administrator'
    and role_row.status = 'active'
    and role_row.module_responsibility_key is distinct from 'admin';

  for role_definition in
    select *
    from (
      values
        (
          'maturity'::text,
          'Maturity'::text,
          'Configure and administer maturity assessments within assigned scope.'::text,
          array[
            'maturity.read',
            'maturity.models.manage',
            'maturity.assess.formal',
            'maturity.review',
            'schedules.read',
            'schedules.manage',
            'schedules.complete'
          ]::text[]
        ),
        (
          'five_s',
          '5S',
          'Administer 5S standards, audits, and audit review within assigned scope.',
          array[
            'five_s.read',
            'five_s.standards.manage',
            'five_s.audit.review',
            'schedules.read',
            'schedules.manage'
          ]::text[]
        ),
        (
          'gemba',
          'Gemba',
          'Administer Gemba definitions, walks, and walk review within assigned scope.',
          array[
            'gemba.read',
            'gemba.definitions.manage',
            'gemba.walk.review',
            'schedules.read',
            'schedules.manage'
          ]::text[]
        ),
        (
          'actions',
          'Actions',
          'Create, assign, and manage actions within assigned scope.',
          array[
            'actions.read',
            'actions.create',
            'actions.update',
            'actions.assign',
            'actions.complete'
          ]::text[]
        ),
        (
          'projects',
          'Projects',
          'Manage CI projects within assigned scope.',
          array[
            'projects.read',
            'projects.manage'
          ]::text[]
        ),
        (
          'benefits',
          'Benefits',
          'Manage improvement benefits and validation within assigned scope.',
          array[
            'benefits.read',
            'benefits.create',
            'benefits.manage',
            'benefits.categories.manage',
            'benefits.validate.ci',
            'benefits.realisation.record'
          ]::text[]
        ),
        (
          'problem_solving',
          'Problem Solving',
          'Manage problem-solving methods and cases within assigned scope.',
          array[
            'problem_solving.view',
            'problem_solving.create',
            'problem_solving.manage',
            'problem_solving.methods.manage',
            'problem_solving.facilitate'
          ]::text[]
        ),
        (
          'suggestions',
          'Suggestions',
          'Review and administer improvement suggestions within assigned scope.',
          array[
            'suggestions.read',
            'suggestions.review',
            'suggestions.manage',
            'suggestions.programmes.manage'
          ]::text[]
        ),
        (
          'people',
          'People',
          'Administer people capability and job functions within assigned scope.',
          array[
            'people.capability.read',
            'memberships.read',
            'job_functions.read',
            'job_functions.manage',
            'hierarchy.read'
          ]::text[]
        ),
        (
          'training',
          'Training',
          'Administer training catalogue, sessions, and completions within assigned scope.',
          array[
            'training.read',
            'training.catalog.manage',
            'training.curriculum.manage',
            'training.sessions.manage',
            'training.completions.manage'
          ]::text[]
        ),
        (
          'skills',
          'Skills',
          'Administer skills catalogue, requirements, and assessments within assigned scope.',
          array[
            'skills.read',
            'skills.catalog.manage',
            'skills.requirements.manage',
            'skills.assess'
          ]::text[]
        ),
        (
          'recognition',
          'Recognition',
          'Award and administer recognition within assigned scope.',
          array[
            'recognition.read',
            'recognition.award',
            'recognition.manage'
          ]::text[]
        )
    ) as module_roles (
      responsibility_key,
      display_name,
      description,
      permission_keys
    )
  loop
    perform private.provision_module_responsibility_role(
      target_organisation_id,
      actor_membership_id,
      role_definition.responsibility_key,
      role_definition.display_name,
      role_definition.description,
      role_definition.permission_keys,
      module_scope_types
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

  perform private.ensure_organisation_module_responsibility_roles(
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

-- Backfill module responsibility catalogue for existing organisations.
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
      perform private.ensure_organisation_module_responsibility_roles(
        organisation_row.organisation_id,
        owner_membership_id
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delegation picker + membership profile metadata for Access & Responsibilities UX
-- ---------------------------------------------------------------------------

create or replace function private.role_responsibility_kind(
  target_canonical_name text,
  target_module_responsibility_key text,
  target_is_owner_role boolean
)
returns text
language sql
immutable
as $$
  select case
    when target_is_owner_role then 'owner'
    when target_module_responsibility_key is not null then 'module'
    when target_canonical_name = 'organisation-administrator' then 'admin'
    when target_canonical_name in ('manager', 'team-member', 'finance-validator') then 'legacy'
    else 'custom'
  end
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
            'label', scope_record.name || ' subtree',
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
        select jsonb_agg(offer_row order by offer_row ->> 'responsibility_kind', offer_row ->> 'role_display_name')
        from jsonb_array_elements(result) as offer_row
      ),
      '[]'::jsonb
    )
  );
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
          'role_canonical_name', role_row.canonical_name,
          'module_responsibility_key', role_row.module_responsibility_key,
          'responsibility_kind', private.role_responsibility_kind(
            role_row.canonical_name,
            role_row.module_responsibility_key,
            role_row.is_owner_role
          ),
          'scope_type', grant_row.scope_type,
          'scope_unit_name', scope_unit.name,
          'status', grant_row.status
        )
        order by
          case private.role_responsibility_kind(
            role_row.canonical_name,
            role_row.module_responsibility_key,
            role_row.is_owner_role
          )
            when 'module' then 1
            when 'admin' then 2
            when 'legacy' then 3
            when 'custom' then 4
            else 5
          end,
          role_row.display_name
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
        and (
          private.has_scoped_permission(org_id, 'roles.read', null, null)
          or (
            target_membership_id = actor_membership_id
            and grant_row.grantee_membership_id = actor_membership_id
          )
        )
    ) grants_json on true
    where membership_registry.organisation_id = org_id
      and membership_registry.id = target_membership_id
  );
end;
$$;

alter function private.membership_has_baseline_participation(uuid, uuid, text, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.provision_module_responsibility_role(
  uuid, uuid, text, text, text, text[], text[]
) owner to lean_hub_private_owner;
alter function private.ensure_organisation_module_responsibility_roles(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.role_responsibility_kind(text, text, boolean)
  owner to lean_hub_private_owner;
alter function private.provision_organisation(uuid, text, text, text, text, text)
  owner to lean_hub_private_owner;
