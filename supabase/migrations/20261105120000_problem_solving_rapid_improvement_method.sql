-- Seed Rapid Improvement built-in method (4 steps). Safe to run locally; do not apply to hosted until approved.

alter function private.ensure_builtin_problem_solving_methods(uuid)
  rename to ensure_builtin_problem_solving_methods_core;

create or replace function private.ensure_builtin_rapid_improvement_method(
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

  if exists (
    select 1 from public.problem_solving_methods m
    where m.organisation_id = target_organisation_id
      and m.builtin_code = 'rapid_improvement'
  ) then
    return;
  end if;

  insert into public.problem_solving_methods (
    organisation_id, name, code, description, is_builtin, builtin_code, created_by_membership_id
  )
  values (
    target_organisation_id,
    'Rapid Improvement',
    'rapid-improvement',
    'Lightweight four-step improvement for small, local problems.',
    true,
    'rapid_improvement',
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

  insert into public.problem_solving_method_stages (
    organisation_id, method_version_id, semantic_stage_key, title, description, display_order
  ) values
    (target_organisation_id, version_id, 'DEFINE', 'Problem', 'State the observable problem in one place.', 1),
    (target_organisation_id, version_id, 'ROOT_CAUSE_ANALYSIS', 'Cause (5 Why)', 'Drill to root cause with structured whys.', 2),
    (target_organisation_id, version_id, 'COUNTERMEASURES', 'Fix', 'Define and assign the corrective change.', 3),
    (target_organisation_id, version_id, 'EFFECTIVENESS_CHECK', 'Check', 'Confirm the fix held in operation.', 4);

  update public.problem_solving_method_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = target_organisation_id
    and id = version_id;
end;
$$;

create or replace function private.ensure_builtin_problem_solving_methods(
  target_organisation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.ensure_builtin_problem_solving_methods_core(target_organisation_id);
  perform private.ensure_builtin_rapid_improvement_method(target_organisation_id);
end;
$$;

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

alter function private.ensure_builtin_rapid_improvement_method(uuid)
  owner to lean_hub_private_owner;

alter function private.ensure_builtin_problem_solving_methods(uuid)
  owner to lean_hub_private_owner;
