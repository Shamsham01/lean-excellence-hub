-- 5S standard applicability: exact organisational units a standard may be
-- executed or scheduled against. Standard-level mapping so successor versions
-- inherit automatically. Empty mapping is fail-closed (not "all units").
-- No hosted data backfill is performed here.

create table public.five_s_standard_applicable_units (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  standard_id uuid not null,
  unit_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_standard_applicable_units_organisation_id_id_key
    unique (organisation_id, id),
  constraint five_s_standard_applicable_units_standard_unit_key
    unique (organisation_id, standard_id, unit_id),
  constraint five_s_standard_applicable_units_standard_fkey
    foreign key (organisation_id, standard_id)
    references public.five_s_standards(organisation_id, id)
    on delete restrict,
  constraint five_s_standard_applicable_units_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict
);

create index five_s_standard_applicable_units_standard_idx
  on public.five_s_standard_applicable_units (organisation_id, standard_id);

create index five_s_standard_applicable_units_unit_idx
  on public.five_s_standard_applicable_units (organisation_id, unit_id);

create trigger five_s_standard_applicable_units_prevent_org_change
before update on public.five_s_standard_applicable_units
for each row execute function private.prevent_organisation_id_change();

alter table public.five_s_standard_applicable_units enable row level security;
alter table public.five_s_standard_applicable_units force row level security;

revoke all on public.five_s_standard_applicable_units
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.five_s_standard_applicable_units
  to lean_hub_private_owner;

create policy private_owner_all_five_s_standard_applicable_units
on public.five_s_standard_applicable_units for all to lean_hub_private_owner
using (true) with check (true);

create policy five_s_standard_applicable_units_select
on public.five_s_standard_applicable_units for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

grant select on public.five_s_standard_applicable_units to authenticated;

create or replace function private.five_s_standard_applies_to_unit(
  target_organisation_id uuid,
  target_standard_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.five_s_standard_applicable_units applicability_row
    where applicability_row.organisation_id = target_organisation_id
      and applicability_row.standard_id = target_standard_id
      and applicability_row.unit_id = target_unit_id
  )
$$;

create or replace function private.assert_activity_unit_is_applicable(
  target_organisation_id uuid,
  target_activity_resource_id uuid,
  target_unit_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_type text;
begin
  resource_type := private.schedule_activity_resource_type(
    target_organisation_id,
    target_activity_resource_id
  );

  if resource_type is distinct from 'five_s_standard' then
    return;
  end if;

  if not private.five_s_standard_applies_to_unit(
    target_organisation_id,
    target_activity_resource_id,
    target_unit_id
  ) then
    raise exception
      '5S standard is not applicable to the selected organisational unit'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.guard_schedule_activity_unit_applicability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_activity_unit_is_applicable(
    new.organisation_id,
    new.activity_resource_id,
    new.unit_id
  );
  return new;
end;
$$;

create trigger schedule_definitions_guard_activity_applicability
before insert or update of activity_resource_id, unit_id
on public.schedule_definitions
for each row execute function private.guard_schedule_activity_unit_applicability();

create or replace function private.set_five_s_standard_applicable_units(
  target_standard_id uuid,
  target_unit_ids uuid[]
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
  unique_unit_ids uuid[];
  candidate_unit_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(
      org_id,
      'five_s.standards.manage',
      null,
      null
    ) then
    raise exception '5S standard applicability update is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.five_s_standards standard_row
    where standard_row.organisation_id = org_id
      and standard_row.id = target_standard_id
  ) then
    raise exception '5S standard was not found'
      using errcode = '23503';
  end if;

  select array_agg(distinct candidate.unit_id)
  into unique_unit_ids
  from unnest(coalesce(target_unit_ids, array[]::uuid[])) as candidate(unit_id)
  where candidate.unit_id is not null;

  if unique_unit_ids is null or cardinality(unique_unit_ids) = 0 then
    raise exception
      '5S standard requires at least one applicable organisational unit'
      using errcode = '22023';
  end if;

  foreach candidate_unit_id in array unique_unit_ids
  loop
    if not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = candidate_unit_id
    ) then
      raise exception
        '5S standard applicability includes an invalid organisational unit'
        using errcode = '23503';
    end if;
  end loop;

  delete from public.five_s_standard_applicable_units applicability_row
  where applicability_row.organisation_id = org_id
    and applicability_row.standard_id = target_standard_id;

  insert into public.five_s_standard_applicable_units (
    organisation_id,
    standard_id,
    unit_id
  )
  select
    org_id,
    target_standard_id,
    candidate.unit_id
  from unnest(unique_unit_ids) as candidate(unit_id);

  perform private.append_business_audit(
    org_id,
    'five_s.standard.applicability_updated',
    target_standard_id,
    'succeeded',
    jsonb_build_object('unit_ids', unique_unit_ids)
  );

  return true;
end;
$$;

create or replace function public.set_five_s_standard_applicable_units(
  target_standard_id uuid,
  target_unit_ids uuid[]
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_five_s_standard_applicable_units(
    target_standard_id,
    target_unit_ids
  )
$$;

create or replace function private.start_five_s_audit(
  target_standard_id uuid,
  target_unit_id uuid,
  target_schedule_occurrence_id uuid default null
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
  standard_version_id uuid;
  template_version_id uuid;
  new_audit_id uuid;
  new_submission_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception '5S audit start is not authorised'
      using errcode = '42501';
  end if;

  if not private.has_scoped_permission(org_id, 'five_s.audit.perform', null, target_unit_id)
    and not private.has_scoped_permission(org_id, 'five_s.audit.perform', actor_membership_id, null) then
    raise exception '5S audit start is not authorised'
      using errcode = '42501';
  end if;

  select standard_version.id, standard_version.template_version_id
  into standard_version_id, template_version_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.standard_id = target_standard_id
    and standard_version.status = 'published'
  order by standard_version.version_number desc
  limit 1;

  if standard_version_id is null then
    raise exception '5S standard has no published version'
      using errcode = '55000';
  end if;

  if not private.five_s_standard_applies_to_unit(
    org_id,
    target_standard_id,
    target_unit_id
  ) then
    raise exception
      '5S standard is not applicable to the selected organisational unit'
      using errcode = '22023';
  end if;

  if target_schedule_occurrence_id is not null then
    if not exists (
      select 1
      from public.schedule_occurrences occurrence_row
      join public.schedule_definitions schedule_row
        on schedule_row.organisation_id = occurrence_row.organisation_id
       and schedule_row.id = occurrence_row.schedule_definition_id
      where occurrence_row.organisation_id = org_id
        and occurrence_row.id = target_schedule_occurrence_id
        and occurrence_row.lifecycle_status = 'open'
        and schedule_row.activity_resource_id = target_standard_id
        and private.five_s_standard_applies_to_unit(
          org_id,
          target_standard_id,
          occurrence_row.unit_id
        )
    ) then
      raise exception 'schedule occurrence is not valid for this 5S standard'
        using errcode = '55000';
    end if;
  end if;

  new_audit_id := private.register_resource_record(
    org_id, 'five_s_audit', gen_random_uuid(), actor_membership_id
  );

  new_submission_id := private.register_resource_record(
    org_id, 'template_submission', gen_random_uuid(), actor_membership_id
  );

  insert into public.template_submissions (
    id, organisation_id, template_version_id, created_by_membership_id
  )
  values (new_submission_id, org_id, template_version_id, actor_membership_id);

  insert into public.five_s_audits (
    id, organisation_id, standard_version_id, unit_id, submission_id,
    schedule_occurrence_id, auditor_membership_id, status, started_at, created_by_membership_id
  )
  values (
    new_audit_id, org_id, standard_version_id, target_unit_id, new_submission_id,
    target_schedule_occurrence_id, actor_membership_id, 'in_progress', statement_timestamp(), actor_membership_id
  );

  perform private.append_business_audit(
    org_id, 'five_s.audit.started', new_audit_id, 'succeeded', jsonb_build_object('standard_id', target_standard_id)
  );

  perform private.enqueue_domain_event(
    org_id, new_audit_id, 'FiveSAuditStarted', new_audit_id::text,
    jsonb_build_object('audit_id', new_audit_id)
  );

  return new_audit_id;
end;
$$;

grant execute on function public.set_five_s_standard_applicable_units(uuid, uuid[])
  to authenticated;

alter function private.five_s_standard_applies_to_unit(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.assert_activity_unit_is_applicable(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.guard_schedule_activity_unit_applicability()
  owner to lean_hub_private_owner;
alter function private.set_five_s_standard_applicable_units(uuid, uuid[])
  owner to lean_hub_private_owner;

revoke all on function public.set_five_s_standard_applicable_units(uuid, uuid[])
  from public, anon;
