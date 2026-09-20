-- CookieWorks DMAIC methodology seed for charter readiness (PROJ-VAL-001).
-- Idempotent, scoped to organisation code cookieworks-manufacturing only.

create or replace function private.ensure_cookieworks_dmaic_methodology(
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
  target_methodology_id uuid;
  target_version_id uuid;
  phase_count integer;
  methodology_name constant text := 'CookieWorks DMAIC Methodology';
  methodology_code constant text := 'cookieworks-dmaic';
begin
  select membership_row.id
  into actor_membership_id
  from public.organisation_memberships membership_row
  join public.access_grants grant_row
    on grant_row.organisation_id = membership_row.organisation_id
    and grant_row.grantee_membership_id = membership_row.id
    and grant_row.status = 'active'
  join public.role_versions role_version
    on role_version.organisation_id = grant_row.organisation_id
    and role_version.id = grant_row.role_version_id
    and role_version.status = 'published'
  join public.roles role_row
    on role_row.organisation_id = role_version.organisation_id
    and role_row.id = role_version.role_id
    and role_row.is_owner_role = true
  where membership_row.organisation_id = target_organisation_id
    and membership_row.status = 'active'
  order by membership_row.created_at
  limit 1;

  if actor_membership_id is null then
    select membership_row.id
    into actor_membership_id
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = target_organisation_id
      and membership_row.status = 'active'
    order by membership_row.created_at
    limit 1;
  end if;

  if actor_membership_id is null then
    return;
  end if;

  select methodology_row.id
  into target_methodology_id
  from public.ci_project_methodologies methodology_row
  where methodology_row.organisation_id = target_organisation_id
    and (
      methodology_row.code = methodology_code
      or methodology_row.name = methodology_name
    )
  order by case when methodology_row.code = methodology_code then 0 else 1 end
  limit 1;

  if target_methodology_id is not null then
    if exists (
      select 1
      from public.ci_project_methodology_versions version_row
      where version_row.organisation_id = target_organisation_id
        and version_row.methodology_id = target_methodology_id
        and version_row.status = 'published'
    ) then
      return;
    end if;

    select version_row.id
    into target_version_id
    from public.ci_project_methodology_versions version_row
    where version_row.organisation_id = target_organisation_id
      and version_row.methodology_id = target_methodology_id
      and version_row.status = 'draft'
    order by version_row.version_number desc
    limit 1;

    if target_version_id is null then
      insert into public.ci_project_methodology_versions (
        organisation_id,
        methodology_id,
        version_number,
        status,
        created_by_membership_id
      )
      select
        target_organisation_id,
        target_methodology_id,
        coalesce(max(version_row.version_number), 0) + 1,
        'draft',
        actor_membership_id
      from public.ci_project_methodology_versions version_row
      where version_row.organisation_id = target_organisation_id
        and version_row.methodology_id = target_methodology_id
      returning id into target_version_id;
    end if;
  else
    target_methodology_id := private.register_resource_record(
      target_organisation_id,
      'ci_project_methodology',
      gen_random_uuid(),
      actor_membership_id
    );

    insert into public.ci_project_methodologies (
      organisation_id,
      id,
      name,
      code,
      description,
      created_by_membership_id
    )
    values (
      target_organisation_id,
      target_methodology_id,
      methodology_name,
      methodology_code,
      'Standard DMAIC improvement methodology for CookieWorks CI projects.',
      actor_membership_id
    );

    insert into public.ci_project_methodology_versions (
      organisation_id,
      methodology_id,
      version_number,
      status,
      created_by_membership_id
    )
    values (
      target_organisation_id,
      target_methodology_id,
      1,
      'draft',
      actor_membership_id
    )
    returning id into target_version_id;
  end if;

  select count(*)
  into phase_count
  from public.ci_project_methodology_phases phase_row
  where phase_row.organisation_id = target_organisation_id
    and phase_row.methodology_version_id = target_version_id;

  if phase_count = 0 then
    insert into public.ci_project_methodology_phases (
      organisation_id,
      methodology_version_id,
      phase_key,
      title,
      description,
      display_order
    )
    values
      (
        target_organisation_id,
        target_version_id,
        'define',
        'Define',
        'Define the problem, scope, and project charter.',
        1
      ),
      (
        target_organisation_id,
        target_version_id,
        'measure',
        'Measure',
        'Establish baseline performance and data collection.',
        2
      ),
      (
        target_organisation_id,
        target_version_id,
        'analyze',
        'Analyze',
        'Identify root causes and validate with data.',
        3
      ),
      (
        target_organisation_id,
        target_version_id,
        'improve',
        'Improve',
        'Implement and verify countermeasures.',
        4
      ),
      (
        target_organisation_id,
        target_version_id,
        'control',
        'Control',
        'Standardise gains and sustain results.',
        5
      );
  end if;

  update public.ci_project_methodology_versions prior_version
  set status = 'archived',
      archived_at = statement_timestamp()
  where prior_version.organisation_id = target_organisation_id
    and prior_version.methodology_id = target_methodology_id
    and prior_version.status = 'published'
    and prior_version.id <> target_version_id;

  update public.ci_project_methodology_versions version_row
  set status = 'published',
      published_at = statement_timestamp(),
      published_by_membership_id = actor_membership_id
  where version_row.organisation_id = target_organisation_id
    and version_row.id = target_version_id
    and version_row.status = 'draft';
end;
$$;

create or replace function private.seed_cookieworks_dmaic_methodology_if_present()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cookieworks_org_id uuid;
begin
  select organisation_row.id
  into cookieworks_org_id
  from public.organisations organisation_row
  where organisation_row.code = 'cookieworks-manufacturing';

  if cookieworks_org_id is null then
    return;
  end if;

  perform private.ensure_cookieworks_dmaic_methodology(cookieworks_org_id);
end;
$$;

do $$
begin
  perform private.seed_cookieworks_dmaic_methodology_if_present();
end;
$$;

alter function private.ensure_cookieworks_dmaic_methodology(uuid)
  owner to lean_hub_private_owner;
alter function private.seed_cookieworks_dmaic_methodology_if_present()
  owner to lean_hub_private_owner;

revoke all on function private.ensure_cookieworks_dmaic_methodology(uuid) from public;
revoke all on function private.seed_cookieworks_dmaic_methodology_if_present() from public;
grant execute on function private.ensure_cookieworks_dmaic_methodology(uuid)
  to lean_hub_private_owner;
grant execute on function private.seed_cookieworks_dmaic_methodology_if_present()
  to lean_hub_private_owner;
