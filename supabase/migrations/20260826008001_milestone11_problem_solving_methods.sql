-- Milestone 11: problem solving methods, versions, stages, and built-in provisioning.

create table public.problem_solving_methods (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  name text not null,
  code text not null,
  description text,
  is_builtin boolean not null default false,
  builtin_code text,
  status text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_methods_organisation_id_id_key unique (organisation_id, id),
  constraint problem_solving_methods_org_code_key unique (organisation_id, code),
  constraint problem_solving_methods_org_builtin_code_key unique (organisation_id, builtin_code),
  constraint problem_solving_methods_organisation_fkey
    foreign key (organisation_id)
    references public.organisations(id)
    on delete restrict,
  constraint problem_solving_methods_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_methods_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint problem_solving_methods_code_check
    check (code = btrim(code) and char_length(code) between 1 and 80),
  constraint problem_solving_methods_status_check
    check (status in ('active', 'deactivated')),
  constraint problem_solving_methods_builtin_code_check
    check (
      (is_builtin = false and builtin_code is null)
      or (is_builtin = true and builtin_code is not null
          and builtin_code = btrim(builtin_code)
          and char_length(builtin_code) between 1 and 80)
    )
);

create table public.problem_solving_method_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  method_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_method_versions_organisation_id_id_key unique (organisation_id, id),
  constraint problem_solving_method_versions_method_version_key
    unique (organisation_id, method_id, version_number),
  constraint problem_solving_method_versions_method_fkey
    foreign key (organisation_id, method_id)
    references public.problem_solving_methods(organisation_id, id)
    on delete restrict,
  constraint problem_solving_method_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_method_versions_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_method_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table public.problem_solving_method_stages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  method_version_id uuid not null,
  semantic_stage_key text not null,
  title text not null,
  description text,
  display_order integer not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_method_stages_organisation_id_id_key unique (organisation_id, id),
  constraint problem_solving_method_stages_version_order_key
    unique (organisation_id, method_version_id, display_order),
  constraint problem_solving_method_stages_version_key_key
    unique (organisation_id, method_version_id, semantic_stage_key),
  constraint problem_solving_method_stages_version_fkey
    foreign key (organisation_id, method_version_id)
    references public.problem_solving_method_versions(organisation_id, id)
    on delete restrict,
  constraint problem_solving_method_stages_semantic_stage_key_check
    check (semantic_stage_key = btrim(semantic_stage_key) and char_length(semantic_stage_key) between 1 and 80),
  constraint problem_solving_method_stages_title_check
    check (title = btrim(title) and char_length(title) between 1 and 160),
  constraint problem_solving_method_stages_display_order_check
    check (display_order > 0)
);

-- Triggers
create trigger problem_solving_methods_touch_updated_at
before update on public.problem_solving_methods
for each row execute function private.touch_updated_at();

create trigger problem_solving_methods_prevent_org_change
before update on public.problem_solving_methods
for each row execute function private.prevent_organisation_id_change();

create trigger problem_solving_method_versions_prevent_org_change
before update on public.problem_solving_method_versions
for each row execute function private.prevent_organisation_id_change();

create trigger problem_solving_method_stages_prevent_org_change
before update on public.problem_solving_method_stages
for each row execute function private.prevent_organisation_id_change();

-- Publish immutability: prevent edits to published/archived method versions
create or replace function private.guard_problem_solving_method_version_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('published', 'archived') then
      raise exception 'published or archived method version cannot be deleted'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if old.status = 'archived' then
    raise exception 'archived method version is immutable'
      using errcode = '55000';
  end if;

  if old.status = 'published' and new.status not in ('published', 'archived') then
    raise exception 'published method version can only be archived'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function private.guard_problem_solving_method_stage_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_status text;
begin
  select version_row.status
  into parent_status
  from public.problem_solving_method_versions version_row
  where version_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and version_row.id = coalesce(new.method_version_id, old.method_version_id);

  if parent_status is distinct from 'draft' then
    raise exception 'method stages are immutable unless version is draft'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger problem_solving_method_versions_guard_immutable
before update or delete on public.problem_solving_method_versions
for each row execute function private.guard_problem_solving_method_version_immutable();

create trigger problem_solving_method_stages_guard_immutable
before insert or update or delete on public.problem_solving_method_stages
for each row execute function private.guard_problem_solving_method_stage_immutable();

-- Indexes
create index problem_solving_method_versions_method_idx
  on public.problem_solving_method_versions (organisation_id, method_id, status);
create index problem_solving_method_stages_version_idx
  on public.problem_solving_method_stages (organisation_id, method_version_id, display_order);

-- RLS
alter table public.problem_solving_methods enable row level security;
alter table public.problem_solving_methods force row level security;
alter table public.problem_solving_method_versions enable row level security;
alter table public.problem_solving_method_versions force row level security;
alter table public.problem_solving_method_stages enable row level security;
alter table public.problem_solving_method_stages force row level security;

revoke all on public.problem_solving_methods from public, anon, authenticated, service_role;
revoke all on public.problem_solving_method_versions from public, anon, authenticated, service_role;
revoke all on public.problem_solving_method_stages from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_methods to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_method_versions to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_method_stages to lean_hub_private_owner;

create policy private_owner_all_problem_solving_methods
on public.problem_solving_methods for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_problem_solving_method_versions
on public.problem_solving_method_versions for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_problem_solving_method_stages
on public.problem_solving_method_stages for all to lean_hub_private_owner
using (true) with check (true);

-- Authenticated read policies
create or replace function private.can_read_problem_solving_method_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'problem_solving.view',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'problem_solving.create',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'problem_solving.manage',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'problem_solving.methods.manage',
    null,
    null
  )
$$;

create or replace function private.can_manage_problem_solving_methods(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'problem_solving.methods.manage',
    null,
    null
  )
$$;

create policy problem_solving_methods_select
on public.problem_solving_methods for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_method_catalog(organisation_id)
);

create policy problem_solving_method_versions_select
on public.problem_solving_method_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_method_catalog(organisation_id)
);

create policy problem_solving_method_stages_select
on public.problem_solving_method_stages for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_method_catalog(organisation_id)
);

grant select on public.problem_solving_methods to authenticated;
grant select on public.problem_solving_method_versions to authenticated;
grant select on public.problem_solving_method_stages to authenticated;

-- IDEMPOTENT: ensure built-in problem solving methods for an organisation.
create or replace function private.ensure_builtin_problem_solving_methods(
  target_organisation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_membership_id uuid;
  method_id uuid;
  version_id uuid;
begin
  select membership_row.id
  into actor_membership_id
  from public.organisation_memberships membership_row
  join public.access_grants grant_row
    on grant_row.organisation_id = membership_row.organisation_id
    and grant_row.grantee_membership_id = membership_row.id
    and grant_row.status = 'active'
  join public.role_versions rv
    on rv.organisation_id = grant_row.organisation_id
    and rv.id = grant_row.role_version_id
    and rv.status = 'published'
  join public.roles role_row
    on role_row.organisation_id = rv.organisation_id
    and role_row.id = rv.role_id
    and role_row.is_owner_role = true
  where membership_row.organisation_id = target_organisation_id
    and membership_row.status = 'active'
  limit 1;

  if actor_membership_id is null then
    return;
  end if;

  -- Built-in 1: A3 / 8-Step Structured Problem Solving
  if not exists (
    select 1 from public.problem_solving_methods m
    where m.organisation_id = target_organisation_id
      and m.builtin_code = 'a3_structured'
  ) then
    insert into public.problem_solving_methods (
      organisation_id, name, code, description, is_builtin, builtin_code, created_by_membership_id
    )
    values (
      target_organisation_id,
      'A3 / 8-Step Structured Problem Solving',
      'a3-structured',
      'Structured 8-step problem solving aligned with the A3 thinking methodology.',
      true,
      'a3_structured',
      actor_membership_id
    )
    returning id into method_id;

    insert into public.problem_solving_method_versions (
      organisation_id, method_id, version_number, status,
      created_by_membership_id
    )
    values (
      target_organisation_id, method_id, 1, 'draft',
      actor_membership_id
    )
    returning id into version_id;

    insert into public.problem_solving_method_stages (organisation_id, method_version_id, semantic_stage_key, title, description, display_order) values
      (target_organisation_id, version_id, 'DEFINE', 'Define the Problem', 'Clearly articulate the problem, its impact, and scope.', 1),
      (target_organisation_id, version_id, 'CURRENT_CONDITION', 'Current Condition', 'Document the current state with facts, data, and observations.', 2),
      (target_organisation_id, version_id, 'TARGET_CONDITION', 'Target Condition', 'Define the desired future state and measurable targets.', 3),
      (target_organisation_id, version_id, 'ROOT_CAUSE_ANALYSIS', 'Root Cause Analysis', 'Identify and verify the root cause(s) of the problem.', 4),
      (target_organisation_id, version_id, 'COUNTERMEASURES', 'Countermeasures', 'Develop and plan countermeasures to address root causes.', 5),
      (target_organisation_id, version_id, 'IMPLEMENTATION', 'Implementation', 'Execute countermeasures and track progress.', 6),
      (target_organisation_id, version_id, 'EFFECTIVENESS_CHECK', 'Effectiveness Check', 'Verify countermeasures achieved the target condition.', 7),
      (target_organisation_id, version_id, 'SUSTAINMENT', 'Sustainment & Standards', 'Standardise successful countermeasures and share learnings.', 8);

    update public.problem_solving_method_versions
    set status = 'published',
        published_by_membership_id = actor_membership_id,
        published_at = statement_timestamp()
    where organisation_id = target_organisation_id
      and id = version_id;
  end if;

  -- Built-in 2: Rapid Root Cause Analysis
  if not exists (
    select 1 from public.problem_solving_methods m
    where m.organisation_id = target_organisation_id
      and m.builtin_code = 'rapid_rca'
  ) then
    insert into public.problem_solving_methods (
      organisation_id, name, code, description, is_builtin, builtin_code, created_by_membership_id
    )
    values (
      target_organisation_id,
      'Rapid Root Cause Analysis',
      'rapid-rca',
      'Streamlined root cause analysis for moderate-complexity problems.',
      true,
      'rapid_rca',
      actor_membership_id
    )
    returning id into method_id;

    insert into public.problem_solving_method_versions (
      organisation_id, method_id, version_number, status,
      created_by_membership_id
    )
    values (
      target_organisation_id, method_id, 1, 'draft',
      actor_membership_id
    )
    returning id into version_id;

    insert into public.problem_solving_method_stages (organisation_id, method_version_id, semantic_stage_key, title, description, display_order) values
      (target_organisation_id, version_id, 'DEFINE', 'Define the Problem', 'State the problem clearly with measurable gap.', 1),
      (target_organisation_id, version_id, 'CURRENT_CONDITION', 'Gather Facts', 'Collect observations and data about the current state.', 2),
      (target_organisation_id, version_id, 'ROOT_CAUSE_ANALYSIS', 'Root Cause Analysis', 'Determine the root cause using structured techniques.', 3),
      (target_organisation_id, version_id, 'COUNTERMEASURES', 'Countermeasures', 'Define and implement corrective actions.', 4),
      (target_organisation_id, version_id, 'EFFECTIVENESS_CHECK', 'Verify & Close', 'Confirm resolution and close the case.', 5);

    update public.problem_solving_method_versions
    set status = 'published',
        published_by_membership_id = actor_membership_id,
        published_at = statement_timestamp()
    where organisation_id = target_organisation_id
      and id = version_id;
  end if;

  -- Built-in 3: 5 Why Analysis
  if not exists (
    select 1 from public.problem_solving_methods m
    where m.organisation_id = target_organisation_id
      and m.builtin_code = 'five_why'
  ) then
    insert into public.problem_solving_methods (
      organisation_id, name, code, description, is_builtin, builtin_code, created_by_membership_id
    )
    values (
      target_organisation_id,
      '5 Why Analysis',
      'five-why',
      'Iterative questioning technique to drill down to the root cause.',
      true,
      'five_why',
      actor_membership_id
    )
    returning id into method_id;

    insert into public.problem_solving_method_versions (
      organisation_id, method_id, version_number, status,
      created_by_membership_id
    )
    values (
      target_organisation_id, method_id, 1, 'draft',
      actor_membership_id
    )
    returning id into version_id;

    insert into public.problem_solving_method_stages (organisation_id, method_version_id, semantic_stage_key, title, description, display_order) values
      (target_organisation_id, version_id, 'DEFINE', 'Define the Problem', 'State the observable problem or symptom.', 1),
      (target_organisation_id, version_id, 'ROOT_CAUSE_ANALYSIS', 'Ask Why (Iterative)', 'Repeatedly ask why until the root cause is identified.', 2),
      (target_organisation_id, version_id, 'COUNTERMEASURES', 'Countermeasure', 'Define corrective action addressing the root cause.', 3),
      (target_organisation_id, version_id, 'EFFECTIVENESS_CHECK', 'Verify', 'Confirm the countermeasure resolved the problem.', 4);

    update public.problem_solving_method_versions
    set status = 'published',
        published_by_membership_id = actor_membership_id,
        published_at = statement_timestamp()
    where organisation_id = target_organisation_id
      and id = version_id;
  end if;
end;
$$;

-- Public wrapper: ensure methods provisioned for current organisation.
create or replace function public.ensure_problem_solving_methods_provisioned()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null then
    raise exception 'organisation context is required'
      using errcode = '42501';
  end if;

  perform private.ensure_builtin_problem_solving_methods(org_id);
  return true;
end;
$$;

-- Replace provision_organisation to call ensure_builtin_problem_solving_methods.
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

-- Publish method version RPC (for future customization).
create or replace function private.publish_problem_solving_method_version(
  target_method_version_id uuid
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
  version_row public.problem_solving_method_versions%rowtype;
  stage_count integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_methods(org_id) then
    raise exception 'method publish is not authorised'
      using errcode = '42501';
  end if;

  select version_table.*
  into version_row
  from public.problem_solving_method_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_method_version_id
  for update;

  if not found or version_row.status <> 'draft' then
    raise exception 'method version is not publishable'
      using errcode = '55000';
  end if;

  select count(*)
  into stage_count
  from public.problem_solving_method_stages stage_table
  where stage_table.organisation_id = org_id
    and stage_table.method_version_id = target_method_version_id;

  if stage_count = 0 then
    raise exception 'method version requires at least one stage'
      using errcode = '22023';
  end if;

  update public.problem_solving_method_versions prior_version
  set status = 'archived',
      archived_at = statement_timestamp()
  where prior_version.organisation_id = org_id
    and prior_version.method_id = version_row.method_id
    and prior_version.status = 'published';

  update public.problem_solving_method_versions version_table
  set status = 'published',
      published_at = statement_timestamp(),
      published_by_membership_id = actor_membership_id
  where version_table.organisation_id = org_id
    and version_table.id = target_method_version_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving_method.published',
    version_row.method_id,
    'succeeded',
    jsonb_build_object('method_version_id', target_method_version_id)
  );

  return true;
end;
$$;

-- Public wrappers
create or replace function public.publish_problem_solving_method_version(target_method_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.publish_problem_solving_method_version(target_method_version_id) $$;

grant execute on function public.ensure_problem_solving_methods_provisioned() to authenticated;
grant execute on function public.publish_problem_solving_method_version(uuid) to authenticated;

revoke all on function public.ensure_problem_solving_methods_provisioned() from public, anon;
revoke all on function public.publish_problem_solving_method_version(uuid) from public, anon;

-- Ownership
alter function private.can_read_problem_solving_method_catalog(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_problem_solving_methods(uuid) owner to lean_hub_private_owner;
alter function private.ensure_builtin_problem_solving_methods(uuid) owner to lean_hub_private_owner;
alter function private.guard_problem_solving_method_version_immutable() owner to lean_hub_private_owner;
alter function private.guard_problem_solving_method_stage_immutable() owner to lean_hub_private_owner;
alter function private.publish_problem_solving_method_version(uuid) owner to lean_hub_private_owner;
alter function private.provision_organisation(uuid, text, text, text, text, text) owner to lean_hub_private_owner;
