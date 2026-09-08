-- Issue #57 PR2: Site security boundary — multi-site isolation and scoped baseline access.
-- Forward-only. Local/CI only; do not deploy to hosted until rollout gate passes.

-- ---------------------------------------------------------------------------
-- 1. Site resolution primitives
-- ---------------------------------------------------------------------------

create or replace function private.organisation_requires_site_boundary(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_units unit_row
    where unit_row.organisation_id = target_organisation_id
      and unit_row.status = 'active'
      and private.normalise_organisation_unit_semantic_scope(unit_row.unit_type) = 'site'
  )
$$;

-- Invariant: each unit has at most one active site ancestor. Ambiguous or absent
-- ancestry returns NULL (fail closed) when a site boundary is required.
create or replace function private.resolve_site_unit_id(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with site_ancestors as (
    select
      site_unit.id as site_unit_id,
      min(closure.depth) as min_depth
    from public.organisation_unit_closure closure
    join public.organisation_units site_unit
      on site_unit.organisation_id = closure.organisation_id
     and site_unit.id = closure.ancestor_unit_id
     and site_unit.status = 'active'
     and private.normalise_organisation_unit_semantic_scope(site_unit.unit_type) = 'site'
    where closure.organisation_id = target_organisation_id
      and closure.descendant_unit_id = target_unit_id
    group by site_unit.id
  )
  select ranked.site_unit_id
  from (
    select
      site_unit_id,
      min_depth,
      count(*) over () as ancestor_count
    from site_ancestors
  ) ranked
  where ranked.ancestor_count = 1
  order by ranked.min_depth
  limit 1
$$;

create or replace function private.count_site_ancestors(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from (
    select distinct site_unit.id
    from public.organisation_unit_closure closure
    join public.organisation_units site_unit
      on site_unit.organisation_id = closure.organisation_id
     and site_unit.id = closure.ancestor_unit_id
     and site_unit.status = 'active'
     and private.normalise_organisation_unit_semantic_scope(site_unit.unit_type) = 'site'
    where closure.organisation_id = target_organisation_id
      and closure.descendant_unit_id = target_unit_id
  ) site_ancestors
$$;

create or replace function private.finalise_operational_site_snapshot(
  target_organisation_id uuid,
  anchor_unit_id uuid,
  incoming_site_unit_id uuid,
  require_resolved_site boolean,
  is_update boolean,
  prior_anchor_unit_id uuid default null,
  prior_site_unit_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved_site_unit_id uuid;
  prior_resolved_site uuid;
  new_resolved_site uuid;
begin
  if is_update then
    if prior_site_unit_id is not null
      and incoming_site_unit_id is distinct from prior_site_unit_id then
      raise exception 'site ownership is immutable on operational records'
        using errcode = '23514';
    end if;

    if prior_anchor_unit_id is distinct from anchor_unit_id then
      if prior_anchor_unit_id is not null then
        prior_resolved_site := private.resolve_site_unit_id(
          target_organisation_id,
          prior_anchor_unit_id
        );
      end if;

      if anchor_unit_id is not null then
        new_resolved_site := private.resolve_site_unit_id(
          target_organisation_id,
          anchor_unit_id
        );
      end if;

      if prior_resolved_site is distinct from new_resolved_site then
        raise exception 'cross-site operational record move is not permitted'
          using errcode = '23514';
      end if;
    end if;
  end if;

  if anchor_unit_id is not null then
    resolved_site_unit_id := private.resolve_site_unit_id(
      target_organisation_id,
      anchor_unit_id
    );

    if private.organisation_requires_site_boundary(target_organisation_id)
      and require_resolved_site
      and resolved_site_unit_id is null then
      raise exception 'site ownership could not be resolved for operational record'
        using errcode = '23514';
    end if;

    if incoming_site_unit_id is not null
      and resolved_site_unit_id is not null
      and incoming_site_unit_id is distinct from resolved_site_unit_id then
      raise exception 'site snapshot does not match unit anchor'
        using errcode = '23514';
    end if;

    if incoming_site_unit_id is null then
      return resolved_site_unit_id;
    end if;

    return incoming_site_unit_id;
  end if;

  if private.organisation_requires_site_boundary(target_organisation_id)
    and require_resolved_site then
    raise exception 'unit anchor is required when site boundary is active'
      using errcode = '23514';
  end if;

  return incoming_site_unit_id;
end;
$$;

create or replace function private.membership_home_site_unit_id(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.resolve_site_unit_id(
    target_organisation_id,
    private.membership_primary_organisational_unit_id(
      target_organisation_id,
      target_membership_id
    )
  )
$$;

create or replace function private.units_share_site_boundary(
  target_organisation_id uuid,
  left_unit_id uuid,
  right_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.organisation_requires_site_boundary(target_organisation_id)
    or (
      left_unit_id is not null
      and right_unit_id is not null
      and private.resolve_site_unit_id(target_organisation_id, left_unit_id) is not null
      and private.resolve_site_unit_id(target_organisation_id, left_unit_id)
        = private.resolve_site_unit_id(target_organisation_id, right_unit_id)
    )
$$;

create or replace function private.membership_can_access_unit_site(
  target_organisation_id uuid,
  actor_membership_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.organisation_requires_site_boundary(target_organisation_id)
    or (
      target_unit_id is not null
      and private.resolve_site_unit_id(target_organisation_id, target_unit_id) is not null
      and private.resolve_site_unit_id(target_organisation_id, target_unit_id)
        = private.membership_home_site_unit_id(
          target_organisation_id,
          actor_membership_id
        )
    )
$$;

create or replace function private.snapshot_site_unit_id(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.resolve_site_unit_id(target_organisation_id, target_unit_id)
$$;

-- ---------------------------------------------------------------------------
-- 2. Historical site ownership — immutable snapshot on operational root records
-- ---------------------------------------------------------------------------

alter table public.maturity_assessments
  add column if not exists site_unit_id uuid;

alter table public.five_s_audits
  add column if not exists site_unit_id uuid;

alter table public.gemba_walks
  add column if not exists site_unit_id uuid;

alter table public.schedule_definitions
  add column if not exists site_unit_id uuid;

alter table public.schedule_occurrences
  add column if not exists site_unit_id uuid;

alter table public.actions
  add column if not exists site_unit_id uuid;

alter table public.ci_projects
  add column if not exists site_unit_id uuid;

alter table public.improvement_suggestions
  add column if not exists site_unit_id uuid;

alter table public.improvement_benefits
  add column if not exists site_unit_id uuid;

alter table public.problem_solving_cases
  add column if not exists site_unit_id uuid;

alter table public.recognition_awards
  add column if not exists site_unit_id uuid;

alter table public.training_sessions
  add column if not exists site_unit_id uuid;

alter table public.membership_skill_assessments
  add column if not exists site_unit_id uuid;

-- Composite FKs for site_unit_id
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'maturity_assessments',
    'five_s_audits',
    'gemba_walks',
    'schedule_definitions',
    'schedule_occurrences',
    'actions',
    'ci_projects',
    'improvement_suggestions',
    'improvement_benefits',
    'problem_solving_cases',
    'recognition_awards',
    'training_sessions',
    'membership_skill_assessments'
  ]
  loop
    execute format(
      'alter table public.%I
         drop constraint if exists %I_site_unit_fkey',
      table_name,
      table_name
    );
    execute format(
      'alter table public.%I
         add constraint %I_site_unit_fkey
         foreign key (organisation_id, site_unit_id)
         references public.organisation_units (organisation_id, id)
         on delete restrict',
      table_name,
      table_name
    );
  end loop;
end
$$;

create index if not exists maturity_assessments_org_site_idx
  on public.maturity_assessments (organisation_id, site_unit_id);
create index if not exists five_s_audits_org_site_idx
  on public.five_s_audits (organisation_id, site_unit_id);
create index if not exists gemba_walks_org_site_idx
  on public.gemba_walks (organisation_id, site_unit_id);
create index if not exists schedule_definitions_org_site_idx
  on public.schedule_definitions (organisation_id, site_unit_id);
create index if not exists schedule_occurrences_org_site_idx
  on public.schedule_occurrences (organisation_id, site_unit_id);
create index if not exists actions_org_site_idx
  on public.actions (organisation_id, site_unit_id);
create index if not exists ci_projects_org_site_idx
  on public.ci_projects (organisation_id, site_unit_id);
create index if not exists improvement_suggestions_org_site_idx
  on public.improvement_suggestions (organisation_id, site_unit_id);
create index if not exists improvement_benefits_org_site_idx
  on public.improvement_benefits (organisation_id, site_unit_id);
create index if not exists problem_solving_cases_org_site_idx
  on public.problem_solving_cases (organisation_id, site_unit_id);
create index if not exists recognition_awards_org_site_idx
  on public.recognition_awards (organisation_id, site_unit_id);
create index if not exists training_sessions_org_site_idx
  on public.training_sessions (organisation_id, site_unit_id);
create index if not exists membership_skill_assessments_org_site_idx
  on public.membership_skill_assessments (organisation_id, site_unit_id);

create index if not exists organisation_units_org_active_idx
  on public.organisation_units (organisation_id, unit_type)
  where status = 'active';

-- Deterministic backfill from anchored unit columns.
update public.maturity_assessments record_row
set site_unit_id = private.snapshot_site_unit_id(record_row.organisation_id, record_row.unit_id)
where record_row.site_unit_id is null;

update public.five_s_audits record_row
set site_unit_id = private.snapshot_site_unit_id(record_row.organisation_id, record_row.unit_id)
where record_row.site_unit_id is null;

update public.gemba_walks record_row
set site_unit_id = private.snapshot_site_unit_id(record_row.organisation_id, record_row.unit_id)
where record_row.site_unit_id is null;

update public.schedule_definitions record_row
set site_unit_id = private.snapshot_site_unit_id(record_row.organisation_id, record_row.unit_id)
where record_row.site_unit_id is null;

update public.schedule_occurrences record_row
set site_unit_id = private.snapshot_site_unit_id(record_row.organisation_id, record_row.unit_id)
where record_row.site_unit_id is null;

update public.actions record_row
set site_unit_id = private.snapshot_site_unit_id(record_row.organisation_id, record_row.unit_id)
where record_row.site_unit_id is null
  and record_row.unit_id is not null;

update public.ci_projects record_row
set site_unit_id = private.snapshot_site_unit_id(record_row.organisation_id, record_row.unit_id)
where record_row.site_unit_id is null;

update public.improvement_suggestions record_row
set site_unit_id = private.snapshot_site_unit_id(record_row.organisation_id, record_row.origin_unit_id)
where record_row.site_unit_id is null;

update public.improvement_benefits record_row
set site_unit_id = private.snapshot_site_unit_id(
  record_row.organisation_id,
  record_row.organisational_unit_id
)
where record_row.site_unit_id is null;

update public.problem_solving_cases record_row
set site_unit_id = private.snapshot_site_unit_id(
  record_row.organisation_id,
  record_row.organisation_unit_id
)
where record_row.site_unit_id is null;

update public.recognition_awards record_row
set site_unit_id = private.snapshot_site_unit_id(
  record_row.organisation_id,
  record_row.organisational_unit_id
)
where record_row.site_unit_id is null;

update public.training_sessions record_row
set site_unit_id = private.snapshot_site_unit_id(
  record_row.organisation_id,
  record_row.organisational_unit_id
)
where record_row.site_unit_id is null
  and record_row.organisational_unit_id is not null;

update public.membership_skill_assessments record_row
set site_unit_id = private.snapshot_site_unit_id(
  record_row.organisation_id,
  record_row.organisational_unit_id
)
where record_row.site_unit_id is null
  and record_row.organisational_unit_id is not null;

-- Fail migration when site-boundary organisations have unresolved site-owned records.
do $$
declare
  unresolved record;
begin
  for unresolved in
    select *
    from (
      select organisation_id, 'maturity_assessments' as table_name, count(*)::integer as unresolved_count
      from public.maturity_assessments
      where unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'five_s_audits', count(*)::integer
      from public.five_s_audits
      where unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'gemba_walks', count(*)::integer
      from public.gemba_walks
      where unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'schedule_definitions', count(*)::integer
      from public.schedule_definitions
      where unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'schedule_occurrences', count(*)::integer
      from public.schedule_occurrences
      where unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'ci_projects', count(*)::integer
      from public.ci_projects
      where unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'improvement_suggestions', count(*)::integer
      from public.improvement_suggestions
      where origin_unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'improvement_benefits', count(*)::integer
      from public.improvement_benefits
      where organisational_unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'problem_solving_cases', count(*)::integer
      from public.problem_solving_cases
      where organisation_unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'recognition_awards', count(*)::integer
      from public.recognition_awards
      where organisational_unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'training_sessions', count(*)::integer
      from public.training_sessions
      where organisational_unit_id is not null and site_unit_id is null
      group by organisation_id
      union all
      select organisation_id, 'membership_skill_assessments', count(*)::integer
      from public.membership_skill_assessments
      where organisational_unit_id is not null and site_unit_id is null
      group by organisation_id
    ) unresolved_rows
    where private.organisation_requires_site_boundary(unresolved_rows.organisation_id)
      and unresolved_rows.unresolved_count > 0
  loop
    raise exception
      'site backfill unresolved for %.%: % records',
      unresolved.organisation_id,
      unresolved.table_name,
      unresolved.unresolved_count;
  end loop;
end;
$$;

create or replace function private.prevent_site_unit_id_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.site_unit_id is distinct from old.site_unit_id then
    raise exception 'site ownership is immutable on operational records'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.set_operational_record_site_from_unit_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.site_unit_id := private.finalise_operational_site_snapshot(
    new.organisation_id,
    new.unit_id,
    new.site_unit_id,
    new.unit_id is not null,
    tg_op = 'UPDATE',
    case when tg_op = 'UPDATE' then old.unit_id else null end,
    case when tg_op = 'UPDATE' then old.site_unit_id else null end
  );
  return new;
end;
$$;

create or replace function private.set_operational_record_site_from_organisational_unit_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.site_unit_id := private.finalise_operational_site_snapshot(
    new.organisation_id,
    new.organisational_unit_id,
    new.site_unit_id,
    new.organisational_unit_id is not null,
    tg_op = 'UPDATE',
    case when tg_op = 'UPDATE' then old.organisational_unit_id else null end,
    case when tg_op = 'UPDATE' then old.site_unit_id else null end
  );
  return new;
end;
$$;

create or replace function private.set_operational_record_site_from_organisation_unit_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.site_unit_id := private.finalise_operational_site_snapshot(
    new.organisation_id,
    new.organisation_unit_id,
    new.site_unit_id,
    new.organisation_unit_id is not null,
    tg_op = 'UPDATE',
    case when tg_op = 'UPDATE' then old.organisation_unit_id else null end,
    case when tg_op = 'UPDATE' then old.site_unit_id else null end
  );
  return new;
end;
$$;

create or replace function private.set_operational_record_site_from_origin_unit_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.site_unit_id := private.finalise_operational_site_snapshot(
    new.organisation_id,
    new.origin_unit_id,
    new.site_unit_id,
    new.origin_unit_id is not null,
    tg_op = 'UPDATE',
    case when tg_op = 'UPDATE' then old.origin_unit_id else null end,
    case when tg_op = 'UPDATE' then old.site_unit_id else null end
  );
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'maturity_assessments',
    'five_s_audits',
    'gemba_walks',
    'schedule_definitions',
    'schedule_occurrences',
    'actions',
    'ci_projects'
  ]
  loop
    execute format('drop trigger if exists %I_set_site_unit_id on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_site_unit_id
         before insert or update on public.%I
         for each row execute function private.set_operational_record_site_from_unit_id()',
      table_name,
      table_name
    );
    execute format('drop trigger if exists %I_prevent_site_change on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_prevent_site_change
         before update on public.%I
         for each row execute function private.prevent_site_unit_id_change()',
      table_name,
      table_name
    );
  end loop;

  foreach table_name in array array[
    'improvement_benefits',
    'recognition_awards',
    'training_sessions',
    'membership_skill_assessments'
  ]
  loop
    execute format('drop trigger if exists %I_set_site_unit_id on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_site_unit_id
         before insert or update on public.%I
         for each row execute function private.set_operational_record_site_from_organisational_unit_id()',
      table_name,
      table_name
    );
    execute format('drop trigger if exists %I_prevent_site_change on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_prevent_site_change
         before update on public.%I
         for each row execute function private.prevent_site_unit_id_change()',
      table_name,
      table_name
    );
  end loop;

  execute 'drop trigger if exists problem_solving_cases_set_site_unit_id on public.problem_solving_cases';
  execute '
    create trigger problem_solving_cases_set_site_unit_id
      before insert or update on public.problem_solving_cases
      for each row execute function private.set_operational_record_site_from_organisation_unit_id()';
  execute 'drop trigger if exists problem_solving_cases_prevent_site_change on public.problem_solving_cases';
  execute '
    create trigger problem_solving_cases_prevent_site_change
      before update on public.problem_solving_cases
      for each row execute function private.prevent_site_unit_id_change()';

  execute 'drop trigger if exists improvement_suggestions_set_site_unit_id on public.improvement_suggestions';
  execute '
    create trigger improvement_suggestions_set_site_unit_id
      before insert or update on public.improvement_suggestions
      for each row execute function private.set_operational_record_site_from_origin_unit_id()';
  execute 'drop trigger if exists improvement_suggestions_prevent_site_change on public.improvement_suggestions';
  execute '
    create trigger improvement_suggestions_prevent_site_change
      before update on public.improvement_suggestions
      for each row execute function private.prevent_site_unit_id_change()';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Baseline participation — site-scoped organisation mode
-- ---------------------------------------------------------------------------

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
     and baseline_permission.include_in_scoped_permission
    where actor_membership.id = actor_membership_id
      and actor_membership.organisation_id = target_organisation_id
      and actor_membership.status = 'active'
      and (
        (
          baseline_permission.scope_mode = 'organisation'
          and target_membership_id is null
          and (
            not private.organisation_requires_site_boundary(target_organisation_id)
            or (
              target_unit_id is not null
              and private.membership_can_access_unit_site(
                target_organisation_id,
                actor_membership_id,
                target_unit_id
              )
            )
          )
        )
        or (
          baseline_permission.scope_mode = 'self'
          and target_membership_id = actor_membership.id
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Scoped permission — site containment for grants and baseline
-- ---------------------------------------------------------------------------

create or replace function private.has_scoped_permission(
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
      where grant_row.organisation_id = target_organisation_id
        and grant_row.grantee_membership_id =
          private.current_membership_id(target_organisation_id)
        and grant_row.status = 'active'
        and (
          grant_row.expires_at is null
          or grant_row.expires_at > statement_timestamp()
        )
        and (
          grant_row.scope_type = 'organisation'
          or (
            grant_row.scope_type = 'self'
            and target_membership_id is not null
            and target_membership_id =
              private.current_membership_id(target_organisation_id)
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
            and private.units_share_site_boundary(
              grant_row.organisation_id,
              grant_row.scope_unit_id,
              target_unit_id
            )
          )
        )
    ),
    false
  )
  or private.membership_has_baseline_participation(
    private.current_membership_id(target_organisation_id),
    target_organisation_id,
    target_permission_key,
    target_membership_id,
    target_unit_id
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
            and private.units_share_site_boundary(
              grant_row.organisation_id,
              grant_row.scope_unit_id,
              target_unit_id
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

-- ---------------------------------------------------------------------------
-- 5. Cross-site reparent guard (PR3 Organisation Structure V2 handoff)
-- ---------------------------------------------------------------------------

create or replace function private.move_organisation_unit(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_parent_unit_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  subtree_depth integer;
  parent_depth integer;
  current_site_unit_id uuid;
  parent_site_unit_id uuid;
begin
  if target_unit_id = target_parent_unit_id
    or private.current_membership_id(target_organisation_id) is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'hierarchy.manage',
      null,
      target_unit_id
    )
    or (
      target_parent_unit_id is null
      and not private.has_scoped_permission(
        target_organisation_id,
        'hierarchy.manage',
        null,
        null
      )
    )
    or (
      target_parent_unit_id is not null
      and not private.has_scoped_permission(
        target_organisation_id,
        'hierarchy.manage',
        null,
        target_parent_unit_id
      )
    ) then
    raise exception 'unit move is not authorised'
      using errcode = '42501';
  end if;

  if private.organisation_requires_site_boundary(target_organisation_id) then
    current_site_unit_id :=
      private.resolve_site_unit_id(target_organisation_id, target_unit_id);
    parent_site_unit_id := case
      when target_parent_unit_id is null then null
      else private.resolve_site_unit_id(
        target_organisation_id,
        target_parent_unit_id
      )
    end;

    if current_site_unit_id is not null
      and parent_site_unit_id is not null
      and current_site_unit_id is distinct from parent_site_unit_id then
      raise exception 'cross-site unit reparent is not permitted'
        using errcode = '23514';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  perform 1
  from public.organisation_units unit_row
  where unit_row.organisation_id = target_organisation_id
    and unit_row.id = target_unit_id
    and unit_row.status = 'active'
  for update;

  if not found then
    raise exception 'unit is not active in organisation'
      using errcode = '23514';
  end if;

  if target_parent_unit_id is not null then
    perform 1
    from public.organisation_units parent_unit
    where parent_unit.organisation_id = target_organisation_id
      and parent_unit.id = target_parent_unit_id
      and parent_unit.status = 'active'
    for update;

    if not found or exists (
      select 1
      from public.organisation_unit_closure closure
      where closure.organisation_id = target_organisation_id
        and closure.ancestor_unit_id = target_unit_id
        and closure.descendant_unit_id = target_parent_unit_id
    ) then
      raise exception 'new parent is invalid or creates a cycle'
        using errcode = '23514';
    end if;
  end if;

  select coalesce(max(depth), 0)
  into subtree_depth
  from public.organisation_unit_closure
  where organisation_id = target_organisation_id
    and ancestor_unit_id = target_unit_id;

  select coalesce(max(depth), -1)
  into parent_depth
  from public.organisation_unit_closure
  where organisation_id = target_organisation_id
    and descendant_unit_id = target_parent_unit_id;

  if target_parent_unit_id is not null
    and parent_depth + 1 + subtree_depth > 32 then
    raise exception 'unit move exceeds maximum hierarchy depth'
      using errcode = '23514';
  end if;

  if not private.has_scoped_permission(
    target_organisation_id,
    'hierarchy.manage',
    null,
    target_unit_id
  ) then
    raise exception 'unit move authority changed'
      using errcode = '42501';
  end if;

  delete from public.organisation_unit_closure existing_path
  where existing_path.organisation_id = target_organisation_id
    and exists (
      select 1
      from public.organisation_unit_closure subtree
      where subtree.organisation_id = target_organisation_id
        and subtree.ancestor_unit_id = target_unit_id
        and subtree.descendant_unit_id = existing_path.descendant_unit_id
    )
    and not exists (
      select 1
      from public.organisation_unit_closure internal_ancestor
      where internal_ancestor.organisation_id = target_organisation_id
        and internal_ancestor.ancestor_unit_id = target_unit_id
        and internal_ancestor.descendant_unit_id = existing_path.ancestor_unit_id
    );

  if target_parent_unit_id is not null then
    insert into public.organisation_unit_closure (
      organisation_id,
      ancestor_unit_id,
      descendant_unit_id,
      depth
    )
    select
      target_organisation_id,
      parent_path.ancestor_unit_id,
      subtree.descendant_unit_id,
      parent_path.depth + 1 + subtree.depth
    from public.organisation_unit_closure parent_path
    cross join public.organisation_unit_closure subtree
    where parent_path.organisation_id = target_organisation_id
      and parent_path.descendant_unit_id = target_parent_unit_id
      and subtree.organisation_id = target_organisation_id
      and subtree.ancestor_unit_id = target_unit_id;
  end if;

  update public.organisation_units
  set parent_unit_id = target_parent_unit_id,
      version = version + 1
  where organisation_id = target_organisation_id
    and id = target_unit_id;

  perform private.append_security_audit(
    target_organisation_id,
    'hierarchy.unit_moved',
    'unit',
    target_unit_id,
    'succeeded',
    jsonb_build_object('parent_unit_id', target_parent_unit_id)
  );

  return true;
end;
$$;

-- Prevent nested site topology: a site unit cannot be created under an existing site ancestor.
create or replace function private.create_organisation_unit(
  target_organisation_id uuid,
  target_parent_unit_id uuid,
  unit_code text,
  unit_name text,
  unit_type text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_unit_id uuid;
begin
  if private.current_membership_id(target_organisation_id) is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'hierarchy.manage',
      null,
      target_parent_unit_id
    ) then
    raise exception 'unit creation is not authorised'
      using errcode = '42501';
  end if;

  if private.organisation_requires_site_boundary(target_organisation_id)
    and private.normalise_organisation_unit_semantic_scope(unit_type) = 'site'
    and target_parent_unit_id is not null
    and private.resolve_site_unit_id(
      target_organisation_id,
      target_parent_unit_id
    ) is not null then
    raise exception 'nested site units are not permitted'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  if target_parent_unit_id is not null and not exists (
    select 1
    from public.organisation_units parent_unit
    where parent_unit.organisation_id = target_organisation_id
      and parent_unit.id = target_parent_unit_id
      and parent_unit.status = 'active'
    for update
  ) then
    raise exception 'parent unit is not active in organisation'
      using errcode = '23514';
  end if;

  if not private.has_scoped_permission(
    target_organisation_id,
    'hierarchy.manage',
    null,
    target_parent_unit_id
  ) then
    raise exception 'unit creation authority changed'
      using errcode = '42501';
  end if;

  insert into public.organisation_units (
    organisation_id,
    parent_unit_id,
    code,
    name,
    unit_type
  )
  values (
    target_organisation_id,
    target_parent_unit_id,
    unit_code,
    unit_name,
    unit_type
  )
  returning id into new_unit_id;

  insert into public.organisation_unit_closure (
    organisation_id,
    ancestor_unit_id,
    descendant_unit_id,
    depth
  )
  values (
    target_organisation_id,
    new_unit_id,
    new_unit_id,
    0
  );

  if target_parent_unit_id is not null then
    insert into public.organisation_unit_closure (
      organisation_id,
      ancestor_unit_id,
      descendant_unit_id,
      depth
    )
    select
      target_organisation_id,
      ancestor.ancestor_unit_id,
      new_unit_id,
      ancestor.depth + 1
    from public.organisation_unit_closure ancestor
    where ancestor.organisation_id = target_organisation_id
      and ancestor.descendant_unit_id = target_parent_unit_id;
  end if;

  perform private.append_security_audit(
    target_organisation_id,
    'hierarchy.unit_created',
    'unit',
    new_unit_id,
    'succeeded',
    '{}'::jsonb
  );

  return new_unit_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Invitation / provisioning — cross-site placement containment
-- ---------------------------------------------------------------------------

create or replace function private.assert_membership_placement_site_containment(
  target_organisation_id uuid,
  actor_membership_id uuid,
  target_organisational_unit_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.organisation_requires_site_boundary(target_organisation_id) then
    return;
  end if;

  if target_organisational_unit_id is null then
    return;
  end if;

  if not private.membership_can_access_unit_site(
    target_organisation_id,
    actor_membership_id,
    target_organisational_unit_id
  )
  and not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'memberships.manage',
    null,
    null
  )
  and not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'job_functions.manage',
    null,
    target_organisational_unit_id
  ) then
    raise exception 'membership placement is outside authorised site boundary'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.assert_grant_site_containment(
  target_organisation_id uuid,
  actor_membership_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.organisation_requires_site_boundary(target_organisation_id) then
    return;
  end if;

  if target_scope_type <> 'unit_subtree' then
    return;
  end if;

  if target_scope_unit_id is null then
    raise exception 'unit subtree grant requires scope unit'
      using errcode = '22023';
  end if;

  if not private.membership_can_access_unit_site(
    target_organisation_id,
    actor_membership_id,
    target_scope_unit_id
  )
  and not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'roles.delegate',
    null,
    null
  ) then
    raise exception 'grant scope is outside authorised site boundary'
      using errcode = '42501';
  end if;
end;
$$;

-- Ownership
alter function private.organisation_requires_site_boundary(uuid)
  owner to lean_hub_private_owner;
alter function private.resolve_site_unit_id(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.membership_home_site_unit_id(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.units_share_site_boundary(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.membership_can_access_unit_site(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.snapshot_site_unit_id(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.prevent_site_unit_id_change()
  owner to lean_hub_private_owner;
alter function private.set_operational_record_site_from_unit_id()
  owner to lean_hub_private_owner;
alter function private.set_operational_record_site_from_organisational_unit_id()
  owner to lean_hub_private_owner;
alter function private.set_operational_record_site_from_organisation_unit_id()
  owner to lean_hub_private_owner;
alter function private.set_operational_record_site_from_origin_unit_id()
  owner to lean_hub_private_owner;
alter function private.assert_membership_placement_site_containment(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.assert_grant_site_containment(uuid, uuid, text, uuid)
  owner to lean_hub_private_owner;

-- Wire site containment into workforce provisioning delegation.
create or replace function private.assert_workforce_provision_delegation(
  target_organisation_id uuid,
  actor_membership_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  containment_unit_id uuid;
  owner_role boolean;
begin
  containment_unit_id := case
    when target_scope_type = 'unit_subtree' then target_scope_unit_id
    else null
  end;

  if not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'workforce.provision',
    null,
    null
  ) or not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'roles.delegate',
    case when target_scope_type = 'self' then actor_membership_id else null end,
    containment_unit_id
  ) then
    raise exception 'workforce provisioning is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_grant_site_containment(
    target_organisation_id,
    actor_membership_id,
    target_scope_type,
    target_scope_unit_id
  );

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
    or (
      owner_role
      and not exists (
        select 1
        from public.organisation_memberships membership
        join public.access_grants active_grant
          on active_grant.organisation_id = membership.organisation_id
         and active_grant.grantee_membership_id = membership.id
         and active_grant.status = 'active'
        join public.role_versions role_version
          on role_version.organisation_id = active_grant.organisation_id
         and role_version.id = active_grant.role_version_id
        join public.roles role_row
          on role_row.organisation_id = role_version.organisation_id
         and role_row.id = role_version.role_id
        where membership.organisation_id = target_organisation_id
          and membership.id = actor_membership_id
          and membership.status = 'active'
          and role_row.is_owner_role
      )
    ) then
    raise exception 'workforce provisioning role is not delegatable'
      using errcode = '42501';
  end if;

  if not private.role_version_is_delegatable_at_scope(
    target_organisation_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    actor_membership_id
  ) then
    raise exception 'workforce provisioning authority is not contained'
      using errcode = '42501';
  end if;
end;
$$;

-- Site containment for invitation provisioning placement.
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
  actor_membership_id uuid := private.current_membership_id(org_id);
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

    perform private.assert_membership_placement_site_containment(
      org_id,
      actor_membership_id,
      intended_organisational_unit_id
    );

    perform private.assert_grant_site_containment(
      org_id,
      actor_membership_id,
      offered_scope_type,
      offered_scope_unit_id
    );

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

-- Site containment for workforce provision placement.
create or replace function private.preauthorize_workforce_provision(
  target_display_name text,
  target_canonical_alias text,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null,
  target_alias_type text default 'username',
  target_job_title text default null,
  target_notification_email text default null,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_idempotency_key text default null
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
  canonical_alias text := lower(btrim(target_canonical_alias));
  canonical_email text;
  existing_intent_id uuid;
  new_intent_id uuid;
  sealed_login text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'workforce provisioning is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organisations organisation
    where organisation.id = org_id
      and organisation.status = 'active'
  ) then
    raise exception 'organisation is not active'
      using errcode = '42501';
  end if;

  if target_idempotency_key is not null then
    select intent_row.id
    into existing_intent_id
    from public.workforce_provision_intents intent_row
    where intent_row.organisation_id = org_id
      and intent_row.idempotency_key = target_idempotency_key
      and intent_row.status in ('pending', 'auth_created', 'completed')
    limit 1;

    if existing_intent_id is not null then
      return existing_intent_id;
    end if;
  end if;

  perform private.assert_workforce_provision_delegation(
    org_id,
    actor_membership_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id
  );

  if not private.workforce_alias_is_available(org_id, canonical_alias) then
    raise exception 'workforce alias is unavailable'
      using errcode = '23505';
  end if;

  if target_job_function_id is not null then
    if not exists (
      select 1
      from public.job_functions job_function_row
      where job_function_row.organisation_id = org_id
        and job_function_row.id = target_job_function_id
        and job_function_row.status = 'active'
    ) then
      raise exception 'job function is invalid'
        using errcode = '23503';
    end if;

    if target_organisational_unit_id is not null
      and not private.membership_has_scoped_permission(
        actor_membership_id,
        org_id,
        'hierarchy.read',
        null,
        target_organisational_unit_id
      ) then
      raise exception 'organisational unit is not accessible'
        using errcode = '42501';
    end if;

    perform private.assert_membership_placement_site_containment(
      org_id,
      actor_membership_id,
      target_organisational_unit_id
    );

    if not private.membership_has_scoped_permission(
      actor_membership_id,
      org_id,
      'job_functions.manage',
      null,
      coalesce(target_organisational_unit_id, null)
    ) then
      raise exception 'job function assignment is not authorised'
        using errcode = '42501';
    end if;
  elsif target_organisational_unit_id is not null then
    raise exception 'job function is required when assigning a primary unit'
      using errcode = '23514';
  end if;

  canonical_email := case
    when target_notification_email is null then null
    else lower(btrim(target_notification_email))
  end;

  sealed_login := private.generate_workforce_internal_login_identifier();

  insert into public.workforce_provision_intents (
    organisation_id,
    actor_membership_id,
    intent_kind,
    status,
    target_display_name,
    target_canonical_alias,
    target_alias_type,
    target_job_title,
    target_notification_email,
    sealed_internal_login_identifier,
    target_job_function_id,
    target_organisational_unit_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    expires_at,
    idempotency_key
  )
  values (
    org_id,
    actor_membership_id,
    'manual_create',
    'pending',
    btrim(target_display_name),
    canonical_alias,
    target_alias_type,
    case when target_job_title is null then null else btrim(target_job_title) end,
    canonical_email,
    sealed_login,
    target_job_function_id,
    target_organisational_unit_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    statement_timestamp() + interval '15 minutes',
    target_idempotency_key
  )
  returning id into new_intent_id;

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
    org_id,
    'workforce.provision_preauthorized',
    'workforce_provision_intent',
    new_intent_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object(
      'intent_kind', 'manual_create',
      'canonical_alias', canonical_alias
    )
  );

  return new_intent_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Directory enumeration — site-contained hierarchy reads
-- ---------------------------------------------------------------------------

drop policy if exists units_select_scoped on public.organisation_units;
create policy units_select_scoped
on public.organisation_units
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and (
    private.has_scoped_permission(
      organisation_id,
      'hierarchy.read',
      null,
      id
    )
    or (
      private.has_scoped_permission(
        organisation_id,
        'maturity.assess.self',
        private.current_membership_id(organisation_id),
        null
      )
      and (
        not private.organisation_requires_site_boundary(organisation_id)
        or private.membership_can_access_unit_site(
          organisation_id,
          private.current_membership_id(organisation_id),
          id
        )
      )
    )
  )
  and (
    not private.organisation_requires_site_boundary(organisation_id)
    or private.membership_can_access_unit_site(
      organisation_id,
      private.current_membership_id(organisation_id),
      id
    )
    or private.membership_has_scoped_permission(
      private.current_membership_id(organisation_id),
      organisation_id,
      'hierarchy.read',
      null,
      null
    )
    or private.membership_has_scoped_permission(
      private.current_membership_id(organisation_id),
      organisation_id,
      'memberships.manage',
      null,
      null
    )
  )
);

create or replace function private.list_maturity_assessment_scope_entities(
  target_model_version_id uuid,
  target_scope_type text
)
returns table (
  unit_id uuid,
  unit_name text,
  unit_code text,
  unit_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or not private.can_read_maturity_catalog(org_id) then
    raise exception 'maturity scope listing is not authorised'
      using errcode = '42501';
  end if;

  if target_scope_type not in ('site', 'department', 'area') then
    raise exception 'invalid assessment scope type'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.maturity_model_versions model_version
    where model_version.organisation_id = org_id
      and model_version.id = target_model_version_id
      and model_version.status = 'published'
  ) then
    raise exception 'maturity model version is not published'
      using errcode = '55000';
  end if;

  if not private.maturity_model_version_allows_scope(
    org_id,
    target_model_version_id,
    target_scope_type
  ) then
    raise exception 'assessment scope type is not enabled for framework version'
      using errcode = '55000';
  end if;

  return query
  select
    organisation_unit.id,
    organisation_unit.name,
    organisation_unit.code,
    organisation_unit.unit_type
  from public.organisation_units organisation_unit
  where organisation_unit.organisation_id = org_id
    and organisation_unit.status = 'active'
    and private.normalise_organisation_unit_semantic_scope(
      organisation_unit.unit_type
    ) = target_scope_type
    and (
      not private.organisation_requires_site_boundary(org_id)
      or private.membership_can_access_unit_site(
        org_id,
        actor_membership_id,
        organisation_unit.id
      )
      or private.membership_has_scoped_permission(
        actor_membership_id,
        org_id,
        'maturity.models.manage',
        null,
        null
      )
    )
  order by organisation_unit.name;
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
  actor_has_org_delegate boolean := false;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'delegation offers are not authorised'
      using errcode = '42501';
  end if;

  actor_has_org_delegate := private.membership_has_scoped_permission(
    actor_membership_id,
    org_id,
    'roles.delegate',
    null,
    null
  );

  select
    actor_has_org_delegate
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
    ) and actor_has_org_delegate then
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

  perform private.assert_grant_site_containment(
    target_organisation_id,
    actor_membership_id,
    target_scope_type,
    target_scope_unit_id
  );

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

  perform private.assert_membership_placement_site_containment(
    org_id,
    actor_membership_id,
    target_organisational_unit_id
  );

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

alter function private.count_site_ancestors(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.finalise_operational_site_snapshot(uuid, uuid, uuid, boolean, boolean, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.create_organisation_unit(uuid, uuid, text, text, text)
  owner to lean_hub_private_owner;
