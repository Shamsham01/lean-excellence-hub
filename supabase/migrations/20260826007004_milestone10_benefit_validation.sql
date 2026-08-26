-- Milestone 10: benefit validation assignments, validations, and lifecycle operations.

create table public.benefit_validation_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  benefit_id uuid not null,
  validator_membership_id uuid not null,
  validation_role text not null,
  assigned_at timestamptz not null default statement_timestamp(),
  assigned_by_membership_id uuid not null,
  completed_at timestamptz,
  status text not null default 'active',
  constraint benefit_validation_assignments_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_validation_assignments_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_validation_assignments_validator_fkey
    foreign key (organisation_id, validator_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_validation_assignments_assigner_fkey
    foreign key (organisation_id, assigned_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_validation_assignments_role_check
    check (validation_role in ('ci', 'finance')),
  constraint benefit_validation_assignments_status_check
    check (status in ('active', 'completed'))
);

create table public.benefit_validations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  benefit_id uuid not null,
  submission_snapshot_id uuid not null,
  forecast_version_id uuid not null,
  validator_membership_id uuid not null,
  validation_role text not null,
  decision text not null,
  rationale text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint benefit_validations_organisation_id_id_key unique (organisation_id, id),
  constraint benefit_validations_benefit_fkey
    foreign key (organisation_id, benefit_id)
    references public.improvement_benefits(organisation_id, id)
    on delete restrict,
  constraint benefit_validations_submission_snapshot_fkey
    foreign key (organisation_id, submission_snapshot_id)
    references public.benefit_submission_snapshots(organisation_id, id)
    on delete restrict,
  constraint benefit_validations_forecast_version_fkey
    foreign key (organisation_id, forecast_version_id)
    references public.benefit_forecast_versions(organisation_id, id)
    on delete restrict,
  constraint benefit_validations_validator_fkey
    foreign key (organisation_id, validator_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint benefit_validations_role_check
    check (validation_role in ('ci', 'finance')),
  constraint benefit_validations_decision_check
    check (decision in ('approve', 'reject', 'needs_more_information')),
  constraint benefit_validations_rationale_check
    check (rationale = btrim(rationale) and char_length(rationale) between 1 and 4000)
);

create unique index benefit_validation_assignments_active_role_idx
  on public.benefit_validation_assignments (organisation_id, benefit_id, validation_role)
  where status = 'active';

create index benefit_validation_assignments_benefit_idx
  on public.benefit_validation_assignments (organisation_id, benefit_id, status);
create index benefit_validations_benefit_idx
  on public.benefit_validations (organisation_id, benefit_id, created_at);
create index benefit_validations_submission_idx
  on public.benefit_validations (organisation_id, submission_snapshot_id, validation_role, decision);

create trigger benefit_validation_assignments_prevent_org_change
before update on public.benefit_validation_assignments
for each row execute function private.prevent_organisation_id_change();

create trigger benefit_validations_prevent_update
before update on public.benefit_validations
for each row execute function private.prevent_update_or_delete();

create trigger benefit_validations_prevent_delete
before delete on public.benefit_validations
for each row execute function private.prevent_update_or_delete();

alter table public.benefit_validation_assignments enable row level security;
alter table public.benefit_validation_assignments force row level security;
alter table public.benefit_validations enable row level security;
alter table public.benefit_validations force row level security;

revoke all on public.benefit_validation_assignments from public, anon, authenticated, service_role;
revoke all on public.benefit_validations from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.benefit_validation_assignments to lean_hub_private_owner;
grant select, insert, update, delete on public.benefit_validations to lean_hub_private_owner;

create policy private_owner_all_benefit_validation_assignments
on public.benefit_validation_assignments for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_benefit_validations
on public.benefit_validations for all to lean_hub_private_owner
using (true) with check (true);

create or replace function private.guard_benefit_forecast_version_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.lifecycle in ('submitted', 'approved', 'superseded') then
      raise exception 'forecast version cannot be deleted'
        using errcode = '55000';
    end if;

    return old;
  end if;

  if old.lifecycle = 'superseded' then
    raise exception 'superseded forecast version is immutable'
      using errcode = '55000';
  end if;

  if old.lifecycle = 'approved' then
    if new.lifecycle = 'superseded'
      and new.organisation_id = old.organisation_id
      and new.benefit_id = old.benefit_id
      and new.version_number = old.version_number
      and new.realisation_pattern = old.realisation_pattern
      and new.forecast_start_date = old.forecast_start_date
      and new.forecast_end_date = old.forecast_end_date
      and new.forecast_total_amount is not distinct from old.forecast_total_amount
      and new.calculation_basis is not distinct from old.calculation_basis
      and new.assumptions is not distinct from old.assumptions
      and new.target_measure_value is not distinct from old.target_measure_value
      and new.target_measure_unit is not distinct from old.target_measure_unit
      and new.target_date is not distinct from old.target_date
      and new.created_by_membership_id = old.created_by_membership_id
      and new.created_at = old.created_at
      and new.submitted_at is not distinct from old.submitted_at
      and new.approved_at is not distinct from old.approved_at
      and new.approved_by_membership_id is not distinct from old.approved_by_membership_id then
      return new;
    end if;

    raise exception 'approved forecast version is immutable'
      using errcode = '55000';
  end if;

  if old.lifecycle = 'submitted' then
    if new.lifecycle = 'approved'
      and new.organisation_id = old.organisation_id
      and new.benefit_id = old.benefit_id
      and new.version_number = old.version_number
      and new.realisation_pattern = old.realisation_pattern
      and new.forecast_start_date = old.forecast_start_date
      and new.forecast_end_date = old.forecast_end_date
      and new.forecast_total_amount is not distinct from old.forecast_total_amount
      and new.calculation_basis is not distinct from old.calculation_basis
      and new.assumptions is not distinct from old.assumptions
      and new.target_measure_value is not distinct from old.target_measure_value
      and new.target_measure_unit is not distinct from old.target_measure_unit
      and new.target_date is not distinct from old.target_date
      and new.created_by_membership_id = old.created_by_membership_id
      and new.created_at = old.created_at
      and new.submitted_at is not distinct from old.submitted_at
      and new.approved_by_membership_id is not null
      and new.approved_at is not null then
      return new;
    end if;

    if new.lifecycle = 'draft'
      and new.organisation_id = old.organisation_id
      and new.benefit_id = old.benefit_id
      and new.version_number = old.version_number
      and new.realisation_pattern = old.realisation_pattern
      and new.forecast_start_date = old.forecast_start_date
      and new.forecast_end_date = old.forecast_end_date
      and new.forecast_total_amount is not distinct from old.forecast_total_amount
      and new.calculation_basis is not distinct from old.calculation_basis
      and new.assumptions is not distinct from old.assumptions
      and new.target_measure_value is not distinct from old.target_measure_value
      and new.target_measure_unit is not distinct from old.target_measure_unit
      and new.target_date is not distinct from old.target_date
      and new.created_by_membership_id = old.created_by_membership_id
      and new.created_at = old.created_at
      and new.submitted_at is null
      and new.approved_at is null
      and new.approved_by_membership_id is null then
      return new;
    end if;

    raise exception 'submitted forecast version is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function private.is_active_benefit_validator(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_membership_id uuid,
  target_validation_role text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.benefit_validation_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.benefit_id = target_benefit_id
      and assignment_row.validator_membership_id = target_membership_id
      and assignment_row.status = 'active'
      and (
        target_validation_role is null
        or assignment_row.validation_role = target_validation_role
      )
  )
$$;

create or replace function private.can_validate_benefit_ci(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.validate.ci',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.validate.ci',
    null,
    target_unit_id
  )
$$;

create or replace function private.can_validate_benefit_finance(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'benefits.validate.finance',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'benefits.validate.finance',
    null,
    target_unit_id
  )
$$;

create or replace function private.can_read_improvement_benefit(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = target_organisation_id
      and benefit_row.id = target_benefit_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          null,
          benefit_row.organisational_unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'benefits.read',
          benefit_row.owner_membership_id,
          null
        )
        or private.is_active_benefit_validator(
          target_organisation_id,
          target_benefit_id,
          private.current_membership_id(target_organisation_id)
        )
      )
  )
$$;

create or replace function private.build_benefit_source_links_summary(
  target_organisation_id uuid,
  target_benefit_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source_resource_id', link_row.source_resource_id,
        'relationship_role', link_row.relationship_role,
        'resource_type', resource_row.resource_type,
        'context', case resource_row.resource_type
          when 'improvement_suggestion' then (
            select jsonb_build_object(
              'suggestion_number', suggestion_row.suggestion_number,
              'programme_name_snapshot', suggestion_row.programme_name_snapshot,
              'programme_code_snapshot', suggestion_row.programme_code_snapshot,
              'category_name_snapshot', suggestion_row.category_name_snapshot,
              'category_code_snapshot', suggestion_row.category_code_snapshot,
              'origin_unit_name_snapshot', suggestion_row.origin_unit_name_snapshot,
              'origin_unit_code_snapshot', suggestion_row.origin_unit_code_snapshot,
              'target_unit_name_snapshot', suggestion_row.target_unit_name_snapshot,
              'target_unit_code_snapshot', suggestion_row.target_unit_code_snapshot
            )
            from public.improvement_suggestions suggestion_row
            where suggestion_row.organisation_id = target_organisation_id
              and suggestion_row.id = link_row.source_resource_id
          )
          when 'ci_project' then (
            select jsonb_build_object(
              'project_number', project_row.project_number
            )
            from public.ci_projects project_row
            where project_row.organisation_id = target_organisation_id
              and project_row.id = link_row.source_resource_id
          )
          else jsonb_build_object()
        end
      )
      order by
        case link_row.relationship_role when 'primary' then 0 else 1 end,
        link_row.created_at
    ),
    '[]'::jsonb
  )
  from public.benefit_source_links link_row
  join public.resource_records resource_row
    on resource_row.organisation_id = link_row.organisation_id
   and resource_row.id = link_row.source_resource_id
  where link_row.organisation_id = target_organisation_id
    and link_row.benefit_id = target_benefit_id
$$;

create or replace function private.assert_benefit_source_ready_for_submit(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_is_standalone_initiative boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  primary_link_count integer;
  total_link_count integer;
begin
  select
    count(*) filter (where link_row.relationship_role = 'primary'),
    count(*)
  into primary_link_count, total_link_count
  from public.benefit_source_links link_row
  where link_row.organisation_id = target_organisation_id
    and link_row.benefit_id = target_benefit_id;

  if target_is_standalone_initiative then
    if total_link_count > 0 then
      raise exception 'standalone benefits cannot have source links'
        using errcode = '22023';
    end if;

    return;
  end if;

  if primary_link_count <> 1 then
    raise exception 'benefit requires exactly one primary source before submission'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_benefit_baseline_ready_for_submit(
  benefit_row public.improvement_benefits
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if benefit_row.benefit_class = 'financial' then
    if benefit_row.baseline_financial_value is null
      and (
        benefit_row.baseline_description is null
        or btrim(benefit_row.baseline_description) = ''
      ) then
      raise exception 'financial benefit requires baseline financial value or description'
        using errcode = '22023';
    end if;
  else
    if benefit_row.baseline_measure_value is null
      and (
        benefit_row.baseline_description is null
        or btrim(benefit_row.baseline_description) = ''
      ) then
      raise exception 'non-financial benefit requires baseline measure value or description'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

create or replace function private.assert_benefit_validator_membership_active(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  membership_status text;
begin
  select membership_row.status
  into membership_status
  from public.organisation_memberships membership_row
  where membership_row.organisation_id = target_organisation_id
    and membership_row.id = target_membership_id;

  if membership_status is distinct from 'active' then
    raise exception 'inactive membership cannot be assigned as validator'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_benefit_financial_separation_of_duties(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_ci_validator_membership_id uuid,
  target_finance_validator_membership_id uuid,
  target_created_by_membership_id uuid
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if target_ci_validator_membership_id = target_finance_validator_membership_id then
    raise exception 'CI and finance validators must be different memberships'
      using errcode = '22023';
  end if;

  if target_finance_validator_membership_id = target_created_by_membership_id then
    raise exception 'finance validator cannot be the benefit creator'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.benefit_validation_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.benefit_id = target_benefit_id
      and assignment_row.status = 'active'
      and assignment_row.validation_role = 'ci'
      and assignment_row.validator_membership_id = target_finance_validator_membership_id
  ) or exists (
    select 1
    from public.benefit_validation_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.benefit_id = target_benefit_id
      and assignment_row.status = 'active'
      and assignment_row.validation_role = 'finance'
      and assignment_row.validator_membership_id = target_ci_validator_membership_id
  ) then
    raise exception 'one membership cannot satisfy both CI and finance validation roles'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.benefit_required_validation_roles(
  target_benefit_class text
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when target_benefit_class = 'financial' then array['ci', 'finance']::text[]
    else array['ci']::text[]
  end
$$;

create or replace function private.benefit_submission_has_required_approvals(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_submission_snapshot_id uuid,
  target_benefit_class text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with required_roles as (
    select unnest(private.benefit_required_validation_roles(target_benefit_class)) as validation_role
  ),
  approved_roles as (
    select distinct validation_row.validation_role
    from public.benefit_validations validation_row
    where validation_row.organisation_id = target_organisation_id
      and validation_row.benefit_id = target_benefit_id
      and validation_row.submission_snapshot_id = target_submission_snapshot_id
      and validation_row.decision = 'approve'
  )
  select not exists (
    select 1
    from required_roles required_row
    left join approved_roles approved_row
      on approved_row.validation_role = required_row.validation_role
    where approved_row.validation_role is null
  )
$$;

create or replace function private.assert_benefit_validation_separation_of_duties(
  benefit_row public.improvement_benefits,
  target_submission_snapshot_id uuid,
  target_validation_role text,
  target_decision text,
  actor_membership_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if benefit_row.benefit_class <> 'financial' then
    if target_validation_role <> 'ci' then
      raise exception 'non-financial benefits require CI validation only'
        using errcode = '22023';
    end if;

    return;
  end if;

  if target_validation_role = 'finance'
    and actor_membership_id = benefit_row.created_by_membership_id then
    raise exception 'finance validator cannot be the benefit creator'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.benefit_validations validation_row
    where validation_row.organisation_id = benefit_row.organisation_id
      and validation_row.submission_snapshot_id = target_submission_snapshot_id
      and validation_row.validator_membership_id = actor_membership_id
      and validation_row.validation_role <> target_validation_role
  ) then
    raise exception 'one membership cannot satisfy both CI and finance validation roles'
      using errcode = '22023';
  end if;

  if target_decision = 'approve' then
    if target_validation_role = 'finance'
      and exists (
        select 1
        from public.benefit_validations validation_row
        where validation_row.organisation_id = benefit_row.organisation_id
          and validation_row.submission_snapshot_id = target_submission_snapshot_id
          and validation_row.validation_role = 'ci'
          and validation_row.decision = 'approve'
          and validation_row.validator_membership_id = actor_membership_id
      ) then
      raise exception 'CI and finance approvals must be performed by different memberships'
        using errcode = '22023';
    end if;

    if target_validation_role = 'ci'
      and exists (
        select 1
        from public.benefit_validations validation_row
        where validation_row.organisation_id = benefit_row.organisation_id
          and validation_row.submission_snapshot_id = target_submission_snapshot_id
          and validation_row.validation_role = 'finance'
          and validation_row.decision = 'approve'
          and validation_row.validator_membership_id = actor_membership_id
      ) then
      raise exception 'CI and finance approvals must be performed by different memberships'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

create or replace function private.create_benefit_validation_assignments(
  target_organisation_id uuid,
  target_benefit_id uuid,
  target_ci_validator_membership_id uuid,
  target_finance_validator_membership_id uuid,
  target_actor_membership_id uuid,
  target_benefit_class text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.assert_benefit_validator_membership_active(
    target_organisation_id,
    target_ci_validator_membership_id
  );

  if not private.can_validate_benefit_ci(
    target_organisation_id,
  (
    select benefit_row.organisational_unit_id
    from public.improvement_benefits benefit_row
    where benefit_row.organisation_id = target_organisation_id
      and benefit_row.id = target_benefit_id
  )) then
    raise exception 'CI validator lacks validation permission for benefit unit'
      using errcode = '42501';
  end if;

  insert into public.benefit_validation_assignments (
    organisation_id,
    benefit_id,
    validator_membership_id,
    validation_role,
    assigned_by_membership_id
  )
  values (
    target_organisation_id,
    target_benefit_id,
    target_ci_validator_membership_id,
    'ci',
    target_actor_membership_id
  );

  if target_benefit_class = 'financial' then
    if target_finance_validator_membership_id is null then
      raise exception 'financial benefit requires a finance validator'
        using errcode = '22023';
    end if;

    perform private.assert_benefit_validator_membership_active(
      target_organisation_id,
      target_finance_validator_membership_id
    );

    if not private.can_validate_benefit_finance(
      target_organisation_id,
    (
      select benefit_row.organisational_unit_id
      from public.improvement_benefits benefit_row
      where benefit_row.organisation_id = target_organisation_id
        and benefit_row.id = target_benefit_id
    )) then
      raise exception 'finance validator lacks validation permission for benefit unit'
        using errcode = '42501';
    end if;

    insert into public.benefit_validation_assignments (
      organisation_id,
      benefit_id,
      validator_membership_id,
      validation_role,
      assigned_by_membership_id
    )
    values (
      target_organisation_id,
      target_benefit_id,
      target_finance_validator_membership_id,
      'finance',
      target_actor_membership_id
    );
  elsif target_finance_validator_membership_id is not null then
    raise exception 'non-financial benefits do not require finance validation'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.submit_benefit(
  target_benefit_id uuid,
  target_ci_validator_membership_id uuid,
  target_finance_validator_membership_id uuid default null
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
  benefit_row public.improvement_benefits%rowtype;
  forecast_row public.benefit_forecast_versions%rowtype;
  category_row public.benefit_categories%rowtype;
  unit_row public.organisation_units%rowtype;
  owner_display_name text;
  allocated_benefit_number text;
  new_submission_snapshot_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit submit is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'draft' then
    raise exception 'benefit is not submittable'
      using errcode = '55000';
  end if;

  if benefit_row.owner_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit submit is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_benefit_source_ready_for_submit(
    org_id,
    target_benefit_id,
    benefit_row.is_standalone_initiative
  );
  perform private.assert_benefit_baseline_ready_for_submit(benefit_row);

  if benefit_row.current_forecast_version_id is null then
    raise exception 'benefit requires a submitted forecast before submission'
      using errcode = '22023';
  end if;

  select version_table.*
  into forecast_row
  from public.benefit_forecast_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = benefit_row.current_forecast_version_id
  for update;

  if not found or forecast_row.lifecycle <> 'submitted' then
    raise exception 'benefit forecast must be submitted before benefit submission'
      using errcode = '22023';
  end if;

  perform private.assert_benefit_forecast_period_integrity(
    forecast_row.id,
    org_id
  );

  if benefit_row.benefit_class = 'financial' then
    perform private.assert_benefit_financial_separation_of_duties(
      org_id,
      target_benefit_id,
      target_ci_validator_membership_id,
      target_finance_validator_membership_id,
      benefit_row.created_by_membership_id
    );
  elsif target_finance_validator_membership_id is not null then
    raise exception 'non-financial benefits do not require finance validation'
      using errcode = '22023';
  end if;

  if benefit_row.benefit_number is null then
    allocated_benefit_number := private.allocate_organisation_document_number(
      org_id,
      'improvement_benefit',
      'BEN'
    );
  else
    allocated_benefit_number := benefit_row.benefit_number;
  end if;

  if benefit_row.category_id is not null then
    select category_table.*
    into category_row
    from public.benefit_categories category_table
    where category_table.organisation_id = org_id
      and category_table.id = benefit_row.category_id;
  end if;

  select unit_table.*
  into unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = benefit_row.organisational_unit_id;

  select coalesce(membership_row.display_name, profile_row.display_name)
  into owner_display_name
  from public.organisation_memberships membership_row
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where membership_row.organisation_id = org_id
    and membership_row.id = benefit_row.owner_membership_id;

  insert into public.benefit_submission_snapshots (
    organisation_id,
    benefit_id,
    benefit_number,
    title,
    description,
    benefit_class,
    financial_type,
    non_financial_type,
    category_id,
    category_name_snapshot,
    category_code_snapshot,
    organisational_unit_id,
    unit_name_snapshot,
    unit_code_snapshot,
    owner_membership_id,
    owner_display_name_snapshot,
    baseline_description,
    baseline_period_start,
    baseline_period_end,
    baseline_measure_value,
    baseline_measure_unit,
    baseline_financial_value,
    source_links_summary,
    forecast_version_id,
    forecast_total_amount,
    target_measure_value,
    target_measure_unit,
    target_date,
    reporting_currency_snapshot,
    planned_realisation_start,
    planned_realisation_end,
    is_standalone_initiative,
    submitted_by_membership_id
  )
  values (
    org_id,
    target_benefit_id,
    allocated_benefit_number,
    benefit_row.title,
    benefit_row.description,
    benefit_row.benefit_class,
    benefit_row.financial_type,
    benefit_row.non_financial_type,
    benefit_row.category_id,
    category_row.name,
    category_row.code,
    benefit_row.organisational_unit_id,
    unit_row.name,
    unit_row.code,
    benefit_row.owner_membership_id,
    owner_display_name,
    benefit_row.baseline_description,
    benefit_row.baseline_period_start,
    benefit_row.baseline_period_end,
    benefit_row.baseline_measure_value,
    benefit_row.baseline_measure_unit,
    benefit_row.baseline_financial_value,
    private.build_benefit_source_links_summary(org_id, target_benefit_id),
    forecast_row.id,
    forecast_row.forecast_total_amount,
    forecast_row.target_measure_value,
    forecast_row.target_measure_unit,
    forecast_row.target_date,
    benefit_row.reporting_currency_snapshot,
    benefit_row.planned_realisation_start,
    benefit_row.planned_realisation_end,
    benefit_row.is_standalone_initiative,
    actor_membership_id
  )
  returning id into new_submission_snapshot_id;

  perform private.create_benefit_validation_assignments(
    org_id,
    target_benefit_id,
    target_ci_validator_membership_id,
    target_finance_validator_membership_id,
    actor_membership_id,
    benefit_row.benefit_class
  );

  update public.improvement_benefits benefit_table
  set status = 'submitted',
      benefit_number = allocated_benefit_number,
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    'draft',
    'submitted',
    actor_membership_id,
    'submitted'
  );

  perform private.append_business_audit(
    org_id,
    'benefit.submitted',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'submission_snapshot_id', new_submission_snapshot_id,
      'forecast_version_id', forecast_row.id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitSubmitted',
    new_submission_snapshot_id::text,
    jsonb_build_object(
      'benefit_id', target_benefit_id,
      'submission_snapshot_id', new_submission_snapshot_id
    )
  );

  return new_submission_snapshot_id;
end;
$$;

create or replace function private.return_benefit_to_draft(
  target_benefit_id uuid,
  target_reason text default null
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
  benefit_row public.improvement_benefits%rowtype;
  forecast_version_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit return to draft is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'submitted' then
    raise exception 'benefit cannot be returned to draft'
      using errcode = '55000';
  end if;

  if benefit_row.owner_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit return to draft is not authorised'
      using errcode = '42501';
  end if;

  update public.benefit_validation_assignments assignment_table
  set status = 'completed',
      completed_at = statement_timestamp()
  where assignment_table.organisation_id = org_id
    and assignment_table.benefit_id = target_benefit_id
    and assignment_table.status = 'active';

  forecast_version_id := benefit_row.current_forecast_version_id;

  if forecast_version_id is not null then
    update public.benefit_forecast_versions version_table
    set lifecycle = 'draft',
        submitted_at = null
    where version_table.organisation_id = org_id
      and version_table.id = forecast_version_id
      and version_table.lifecycle = 'submitted';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'draft',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    'submitted',
    'draft',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'benefit.returned_to_draft',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitReturnedToDraft',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

create or replace function private.record_benefit_validation(
  target_benefit_id uuid,
  target_validation_role text,
  target_decision text,
  target_rationale text
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
  benefit_row public.improvement_benefits%rowtype;
  assignment_row public.benefit_validation_assignments%rowtype;
  submission_snapshot_id uuid;
  forecast_version_id uuid;
  new_validation_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit validation is not authorised'
      using errcode = '42501';
  end if;

  if target_validation_role not in ('ci', 'finance') then
    raise exception 'invalid validation role'
      using errcode = '22023';
  end if;

  if target_decision not in ('approve', 'reject', 'needs_more_information') then
    raise exception 'invalid validation decision'
      using errcode = '22023';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'submitted' then
    raise exception 'benefit is not awaiting validation'
      using errcode = '55000';
  end if;

  select assignment_table.*
  into assignment_row
  from public.benefit_validation_assignments assignment_table
  where assignment_table.organisation_id = org_id
    and assignment_table.benefit_id = target_benefit_id
    and assignment_table.validator_membership_id = actor_membership_id
    and assignment_table.validation_role = target_validation_role
    and assignment_table.status = 'active';

  if not found then
    raise exception 'active validation assignment was not found'
      using errcode = '42501';
  end if;

  if target_validation_role = 'ci' then
    if not private.can_validate_benefit_ci(org_id, benefit_row.organisational_unit_id) then
      raise exception 'CI validation is not authorised'
        using errcode = '42501';
    end if;
  elsif not private.can_validate_benefit_finance(org_id, benefit_row.organisational_unit_id) then
    raise exception 'finance validation is not authorised'
      using errcode = '42501';
  end if;

  select snapshot_table.id, snapshot_table.forecast_version_id
  into submission_snapshot_id, forecast_version_id
  from public.benefit_submission_snapshots snapshot_table
  where snapshot_table.organisation_id = org_id
    and snapshot_table.benefit_id = target_benefit_id
  order by snapshot_table.submitted_at desc, snapshot_table.id desc
  limit 1;

  if submission_snapshot_id is null then
    raise exception 'benefit submission snapshot was not found'
      using errcode = 'P0002';
  end if;

  perform private.assert_benefit_validation_separation_of_duties(
    benefit_row,
    submission_snapshot_id,
    target_validation_role,
    target_decision,
    actor_membership_id
  );

  insert into public.benefit_validations (
    organisation_id,
    benefit_id,
    submission_snapshot_id,
    forecast_version_id,
    validator_membership_id,
    validation_role,
    decision,
    rationale
  )
  values (
    org_id,
    target_benefit_id,
    submission_snapshot_id,
    forecast_version_id,
    actor_membership_id,
    target_validation_role,
    target_decision,
    btrim(target_rationale)
  )
  returning id into new_validation_id;

  if target_decision = 'needs_more_information' then
  -- Keep submitted; keep active validator assignment.
    null;
  elsif target_decision = 'reject' then
    update public.benefit_validation_assignments assignment_table
    set status = 'completed',
        completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.benefit_id = target_benefit_id
      and assignment_table.status = 'active';

    update public.improvement_benefits benefit_table
    set status = 'rejected',
        updated_at = statement_timestamp()
    where benefit_table.organisation_id = org_id
      and benefit_table.id = target_benefit_id;

    perform private.append_benefit_status_history(
      org_id,
      target_benefit_id,
      'submitted',
      'rejected',
      actor_membership_id,
      target_rationale
    );
  elsif target_decision = 'approve' then
    update public.benefit_validation_assignments assignment_table
    set status = 'completed',
        completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.benefit_id = target_benefit_id
      and assignment_table.validator_membership_id = actor_membership_id
      and assignment_table.validation_role = target_validation_role
      and assignment_table.status = 'active';

    if private.benefit_submission_has_required_approvals(
      org_id,
      target_benefit_id,
      submission_snapshot_id,
      benefit_row.benefit_class
    ) then
      perform private.approve_benefit_forecast(
        forecast_version_id,
        actor_membership_id
      );

      update public.improvement_benefits benefit_table
      set status = 'approved',
          updated_at = statement_timestamp()
      where benefit_table.organisation_id = org_id
        and benefit_table.id = target_benefit_id;

      perform private.append_benefit_status_history(
        org_id,
        target_benefit_id,
        'submitted',
        'approved',
        actor_membership_id,
        target_rationale
      );
    end if;
  end if;

  perform private.append_business_audit(
    org_id,
    'benefit.validation_recorded',
    target_benefit_id,
    'succeeded',
    jsonb_build_object(
      'decision', target_decision,
      'validation_role', target_validation_role,
      'validation_id', new_validation_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    case
      when target_decision = 'approve'
        and private.benefit_submission_has_required_approvals(
          org_id,
          target_benefit_id,
          submission_snapshot_id,
          benefit_row.benefit_class
        ) then 'BenefitApproved'
      when target_decision = 'reject' then 'BenefitRejected'
      else 'BenefitValidationRecorded'
    end,
    new_validation_id::text,
    jsonb_build_object(
      'decision', target_decision,
      'validation_role', target_validation_role
    )
  );

  return new_validation_id;
end;
$$;

create or replace function private.start_benefit_realisation(
  target_benefit_id uuid
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
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation start is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'approved' then
    raise exception 'benefit cannot start realisation'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit realisation start is not authorised'
      using errcode = '42501';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'realising',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    'approved',
    'realising',
    actor_membership_id,
    null
  );

  perform private.append_business_audit(
    org_id,
    'benefit.realisation_started',
    target_benefit_id,
    'succeeded',
    '{}'::jsonb
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitRealisationStarted',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

create or replace function private.mark_benefit_realised(
  target_benefit_id uuid,
  target_reason text default null
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
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit realisation completion is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status <> 'realising' then
    raise exception 'benefit cannot be marked realised'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit realisation completion is not authorised'
      using errcode = '42501';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'realised',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    'realising',
    'realised',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'benefit.realised',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitRealised',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

create or replace function private.withdraw_benefit(
  target_benefit_id uuid,
  target_reason text default null
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
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit withdraw is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found or benefit_row.status not in ('draft', 'submitted') then
    raise exception 'benefit cannot be withdrawn'
      using errcode = '55000';
  end if;

  if benefit_row.owner_membership_id <> actor_membership_id
    and not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit withdraw is not authorised'
      using errcode = '42501';
  end if;

  if benefit_row.status = 'submitted' then
    update public.benefit_validation_assignments assignment_table
    set status = 'completed',
        completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.benefit_id = target_benefit_id
      and assignment_table.status = 'active';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'withdrawn',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    benefit_row.status,
    'withdrawn',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'benefit.withdrawn',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitWithdrawn',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

create or replace function private.cancel_benefit(
  target_benefit_id uuid,
  target_reason text default null
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
  benefit_row public.improvement_benefits%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'benefit cancellation is not authorised'
      using errcode = '42501';
  end if;

  select benefit_table.*
  into benefit_row
  from public.improvement_benefits benefit_table
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id
  for update;

  if not found then
    raise exception 'benefit was not found'
      using errcode = 'P0002';
  end if;

  if benefit_row.status in ('realised', 'withdrawn', 'cancelled') then
    raise exception 'benefit is not cancellable'
      using errcode = '55000';
  end if;

  if not private.can_manage_benefit_in_unit(org_id, benefit_row.organisational_unit_id) then
    raise exception 'benefit cancellation is not authorised'
      using errcode = '42501';
  end if;

  if benefit_row.status = 'submitted' then
    update public.benefit_validation_assignments assignment_table
    set status = 'completed',
        completed_at = statement_timestamp()
    where assignment_table.organisation_id = org_id
      and assignment_table.benefit_id = target_benefit_id
      and assignment_table.status = 'active';
  end if;

  update public.improvement_benefits benefit_table
  set status = 'cancelled',
      updated_at = statement_timestamp()
  where benefit_table.organisation_id = org_id
    and benefit_table.id = target_benefit_id;

  perform private.append_benefit_status_history(
    org_id,
    target_benefit_id,
    benefit_row.status,
    'cancelled',
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    'benefit.cancelled',
    target_benefit_id,
    'succeeded',
    jsonb_build_object('reason', target_reason)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_benefit_id,
    'BenefitCancelled',
    target_benefit_id::text,
    jsonb_build_object('benefit_id', target_benefit_id)
  );

  return true;
end;
$$;

grant select on public.benefit_validation_assignments to authenticated;
grant select on public.benefit_validations to authenticated;

create policy benefit_validation_assignments_select
on public.benefit_validation_assignments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, benefit_id)
);

create policy benefit_validations_select
on public.benefit_validations for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_benefit(organisation_id, benefit_id)
);

create or replace function public.submit_benefit(
  target_benefit_id uuid,
  target_ci_validator_membership_id uuid,
  target_finance_validator_membership_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.submit_benefit(
  target_benefit_id,
  target_ci_validator_membership_id,
  target_finance_validator_membership_id
) $$;

create or replace function public.return_benefit_to_draft(
  target_benefit_id uuid,
  target_reason text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.return_benefit_to_draft(target_benefit_id, target_reason) $$;

create or replace function public.record_benefit_validation(
  target_benefit_id uuid,
  target_validation_role text,
  target_decision text,
  target_rationale text
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.record_benefit_validation(
  target_benefit_id,
  target_validation_role,
  target_decision,
  target_rationale
) $$;

create or replace function public.start_benefit_realisation(target_benefit_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.start_benefit_realisation(target_benefit_id) $$;

create or replace function public.mark_benefit_realised(
  target_benefit_id uuid,
  target_reason text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.mark_benefit_realised(target_benefit_id, target_reason) $$;

create or replace function public.withdraw_benefit(
  target_benefit_id uuid,
  target_reason text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.withdraw_benefit(target_benefit_id, target_reason) $$;

create or replace function public.cancel_benefit(
  target_benefit_id uuid,
  target_reason text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.cancel_benefit(target_benefit_id, target_reason) $$;

grant execute on function public.submit_benefit(uuid, uuid, uuid) to authenticated;
grant execute on function public.return_benefit_to_draft(uuid, text) to authenticated;
grant execute on function public.record_benefit_validation(uuid, text, text, text) to authenticated;
grant execute on function public.start_benefit_realisation(uuid) to authenticated;
grant execute on function public.mark_benefit_realised(uuid, text) to authenticated;
grant execute on function public.withdraw_benefit(uuid, text) to authenticated;
grant execute on function public.cancel_benefit(uuid, text) to authenticated;

revoke all on function public.submit_benefit(uuid, uuid, uuid) from public, anon;
revoke all on function public.return_benefit_to_draft(uuid, text) from public, anon;
revoke all on function public.record_benefit_validation(uuid, text, text, text) from public, anon;
revoke all on function public.start_benefit_realisation(uuid) from public, anon;
revoke all on function public.mark_benefit_realised(uuid, text) from public, anon;
revoke all on function public.withdraw_benefit(uuid, text) from public, anon;
revoke all on function public.cancel_benefit(uuid, text) from public, anon;

alter function private.guard_benefit_forecast_version_immutable() owner to lean_hub_private_owner;
alter function private.is_active_benefit_validator(uuid, uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.can_validate_benefit_ci(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_validate_benefit_finance(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_improvement_benefit(uuid, uuid) owner to lean_hub_private_owner;
alter function private.build_benefit_source_links_summary(uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_benefit_source_ready_for_submit(uuid, uuid, boolean) owner to lean_hub_private_owner;
alter function private.assert_benefit_baseline_ready_for_submit(public.improvement_benefits) owner to lean_hub_private_owner;
alter function private.assert_benefit_validator_membership_active(uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_benefit_financial_separation_of_duties(uuid, uuid, uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.benefit_required_validation_roles(text) owner to lean_hub_private_owner;
alter function private.benefit_submission_has_required_approvals(uuid, uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.assert_benefit_validation_separation_of_duties(public.improvement_benefits, uuid, text, text, uuid) owner to lean_hub_private_owner;
alter function private.create_benefit_validation_assignments(uuid, uuid, uuid, uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.submit_benefit(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.return_benefit_to_draft(uuid, text) owner to lean_hub_private_owner;
alter function private.record_benefit_validation(uuid, text, text, text) owner to lean_hub_private_owner;
alter function private.start_benefit_realisation(uuid) owner to lean_hub_private_owner;
alter function private.mark_benefit_realised(uuid, text) owner to lean_hub_private_owner;
alter function private.withdraw_benefit(uuid, text) owner to lean_hub_private_owner;
alter function private.cancel_benefit(uuid, text) owner to lean_hub_private_owner;
