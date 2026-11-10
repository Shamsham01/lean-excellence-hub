-- Site-scoped 5S/Gemba configuration visibility, applicability guards, template hardening,
-- and private.add_five_s_question execute privileges.

-- ---------------------------------------------------------------------------
-- Scope helpers (reuse site boundary membership model)
-- ---------------------------------------------------------------------------

create or replace function private.membership_has_org_wide_operational_catalog_scope(
  target_organisation_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_scoped_permission(
      target_organisation_id,
      'memberships.manage',
      null,
      null
    )
    or private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      'hierarchy.read',
      null,
      null
    );
$$;

create or replace function private.membership_can_manage_operational_unit(
  target_organisation_id uuid,
  target_membership_id uuid,
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
    or private.membership_has_org_wide_operational_catalog_scope(
      target_organisation_id,
      target_membership_id
    )
    or private.membership_can_access_unit_site(
      target_organisation_id,
      target_membership_id,
      target_unit_id
    );
$$;

create or replace function private.five_s_standard_visible_to_membership(
  target_organisation_id uuid,
  target_standard_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.membership_has_org_wide_operational_catalog_scope(
      target_organisation_id,
      target_membership_id
    )
    or (
      exists (
        select 1
        from public.five_s_standard_applicable_units applicability_row
        where applicability_row.organisation_id = target_organisation_id
          and applicability_row.standard_id = target_standard_id
      )
      and not exists (
        select 1
        from public.five_s_standard_applicable_units applicability_row
        where applicability_row.organisation_id = target_organisation_id
          and applicability_row.standard_id = target_standard_id
          and not private.membership_can_manage_operational_unit(
            target_organisation_id,
            target_membership_id,
            applicability_row.unit_id
          )
      )
    );
$$;

create or replace function private.gemba_definition_visible_to_membership(
  target_organisation_id uuid,
  target_definition_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.membership_has_org_wide_operational_catalog_scope(
      target_organisation_id,
      target_membership_id
    )
    or (
      exists (
        select 1
        from public.gemba_definition_applicable_units applicability_row
        where applicability_row.organisation_id = target_organisation_id
          and applicability_row.definition_id = target_definition_id
      )
      and not exists (
        select 1
        from public.gemba_definition_applicable_units applicability_row
        where applicability_row.organisation_id = target_organisation_id
          and applicability_row.definition_id = target_definition_id
          and not private.membership_can_manage_operational_unit(
            target_organisation_id,
            target_membership_id,
            applicability_row.unit_id
          )
      )
    );
$$;

create or replace function private.guard_operational_configuration_unit_ids(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_unit_ids uuid[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate_unit_id uuid;
begin
  foreach candidate_unit_id in array coalesce(target_unit_ids, array[]::uuid[])
  loop
    if not private.membership_can_manage_operational_unit(
      target_organisation_id,
      target_membership_id,
      candidate_unit_id
    ) then
      raise exception
        'organisational unit is outside authorised site scope'
        using errcode = '42501';
    end if;
  end loop;
end;
$$;

create or replace function private.assert_five_s_standard_visible_to_actor(
  target_standard_id uuid
)
returns void
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
    or actor_membership_id is null
    or not private.five_s_standard_visible_to_membership(
      org_id,
      target_standard_id,
      actor_membership_id
    ) then
    raise exception '5S standard is outside site scope'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.assert_gemba_definition_visible_to_actor(
  target_definition_id uuid
)
returns void
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
    or actor_membership_id is null
    or not private.gemba_definition_visible_to_membership(
      org_id,
      target_definition_id,
      actor_membership_id
    ) then
    raise exception 'gemba definition is outside site scope'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.five_s_standard_version_visible_to_actor(
  target_standard_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.five_s_standard_visible_to_membership(
    version_row.organisation_id,
    version_row.standard_id,
    private.current_membership_id(version_row.organisation_id)
  )
  from public.five_s_standard_versions version_row
  where version_row.organisation_id = private.current_organisation_id()
    and version_row.id = target_standard_version_id;
$$;

create or replace function private.gemba_definition_version_visible_to_actor(
  target_definition_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.gemba_definition_visible_to_membership(
    version_row.organisation_id,
    version_row.definition_id,
    private.current_membership_id(version_row.organisation_id)
  )
  from public.gemba_definition_versions version_row
  where version_row.organisation_id = private.current_organisation_id()
    and version_row.id = target_definition_version_id;
$$;

alter function private.membership_has_org_wide_operational_catalog_scope(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.membership_can_manage_operational_unit(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.five_s_standard_visible_to_membership(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.gemba_definition_visible_to_membership(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.guard_operational_configuration_unit_ids(uuid, uuid, uuid[])
  owner to lean_hub_private_owner;
alter function private.assert_five_s_standard_visible_to_actor(uuid)
  owner to lean_hub_private_owner;
alter function private.assert_gemba_definition_visible_to_actor(uuid)
  owner to lean_hub_private_owner;
alter function private.five_s_standard_version_visible_to_actor(uuid)
  owner to lean_hub_private_owner;
alter function private.gemba_definition_version_visible_to_actor(uuid)
  owner to lean_hub_private_owner;

-- ---------------------------------------------------------------------------
-- RLS: site-scoped catalog visibility
-- ---------------------------------------------------------------------------

drop policy if exists five_s_standards_select on public.five_s_standards;
create policy five_s_standards_select
on public.five_s_standards for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
  and private.five_s_standard_visible_to_membership(
    organisation_id,
    id,
    private.current_membership_id(organisation_id)
  )
);

drop policy if exists five_s_standard_versions_select on public.five_s_standard_versions;
create policy five_s_standard_versions_select
on public.five_s_standard_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
  and private.five_s_standard_visible_to_membership(
    organisation_id,
    standard_id,
    private.current_membership_id(organisation_id)
  )
);

drop policy if exists five_s_standard_applicable_units_select
  on public.five_s_standard_applicable_units;
create policy five_s_standard_applicable_units_select
on public.five_s_standard_applicable_units for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
  and private.five_s_standard_visible_to_membership(
    organisation_id,
    standard_id,
    private.current_membership_id(organisation_id)
  )
);

drop policy if exists gemba_definitions_select on public.gemba_definitions;
create policy gemba_definitions_select
on public.gemba_definitions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
  and private.gemba_definition_visible_to_membership(
    organisation_id,
    id,
    private.current_membership_id(organisation_id)
  )
);

drop policy if exists gemba_definition_versions_select on public.gemba_definition_versions;
create policy gemba_definition_versions_select
on public.gemba_definition_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
  and private.gemba_definition_visible_to_membership(
    organisation_id,
    definition_id,
    private.current_membership_id(organisation_id)
  )
);

drop policy if exists gemba_definition_applicable_units_select
  on public.gemba_definition_applicable_units;
create policy gemba_definition_applicable_units_select
on public.gemba_definition_applicable_units for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
  and private.gemba_definition_visible_to_membership(
    organisation_id,
    definition_id,
    private.current_membership_id(organisation_id)
  )
);

-- Child template rows inherit version visibility via standard/definition versions.

drop policy if exists five_s_section_weights_select on public.five_s_section_weights;
create policy five_s_section_weights_select
on public.five_s_section_weights for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
  and private.five_s_standard_version_visible_to_actor(standard_version_id)
);

drop policy if exists five_s_question_scoring_select on public.five_s_question_scoring;
create policy five_s_question_scoring_select
on public.five_s_question_scoring for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
  and private.five_s_standard_version_visible_to_actor(standard_version_id)
);

-- ---------------------------------------------------------------------------
-- Applicability mutations: site containment
-- ---------------------------------------------------------------------------

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
  candidate_unit_status text;
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

  perform private.assert_five_s_standard_visible_to_actor(target_standard_id);

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

  perform private.guard_operational_configuration_unit_ids(
    org_id,
    actor_membership_id,
    unique_unit_ids
  );

  foreach candidate_unit_id in array unique_unit_ids
  loop
    select unit_row.status
    into candidate_unit_status
    from public.organisation_units unit_row
    where unit_row.organisation_id = org_id
      and unit_row.id = candidate_unit_id;

    if candidate_unit_status is null then
      raise exception
        '5S standard applicability includes an invalid organisational unit'
        using errcode = '23503';
    end if;

    if candidate_unit_status is distinct from 'active' then
      raise exception
        '5S standard applicability includes an inactive organisational unit'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from public.schedule_definitions schedule_row
    where schedule_row.organisation_id = org_id
      and schedule_row.activity_resource_id = target_standard_id
      and schedule_row.status = 'active'
      and not (schedule_row.unit_id = any (unique_unit_ids))
  ) then
    raise exception
      'Cannot remove 5S applicability from an organisational unit that still has an active schedule. Reassign or deactivate the schedule first.'
      using errcode = '22023';
  end if;

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

create or replace function private.set_gemba_definition_applicable_units(
  target_definition_id uuid,
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
  candidate_unit_status text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(
      org_id,
      'gemba.definitions.manage',
      null,
      null
    ) then
    raise exception 'gemba definition applicability update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_gemba_definition_visible_to_actor(target_definition_id);

  if not exists (
    select 1
    from public.gemba_definitions definition_row
    where definition_row.organisation_id = org_id
      and definition_row.id = target_definition_id
  ) then
    raise exception 'gemba definition was not found'
      using errcode = '23503';
  end if;

  select array_agg(distinct candidate.unit_id)
  into unique_unit_ids
  from unnest(coalesce(target_unit_ids, array[]::uuid[])) as candidate(unit_id)
  where candidate.unit_id is not null;

  if unique_unit_ids is null or cardinality(unique_unit_ids) = 0 then
    raise exception
      'gemba definition requires at least one applicable organisational unit'
      using errcode = '22023';
  end if;

  perform private.guard_operational_configuration_unit_ids(
    org_id,
    actor_membership_id,
    unique_unit_ids
  );

  foreach candidate_unit_id in array unique_unit_ids
  loop
    select unit_row.status
    into candidate_unit_status
    from public.organisation_units unit_row
    where unit_row.organisation_id = org_id
      and unit_row.id = candidate_unit_id;

    if candidate_unit_status is null then
      raise exception
        'gemba definition applicability includes an invalid organisational unit'
        using errcode = '23503';
    end if;

    if candidate_unit_status is distinct from 'active' then
      raise exception
        'gemba definition applicability includes an inactive organisational unit'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from public.schedule_definitions schedule_row
    where schedule_row.organisation_id = org_id
      and schedule_row.activity_resource_id = target_definition_id
      and schedule_row.status = 'active'
      and not (schedule_row.unit_id = any (unique_unit_ids))
  ) then
    raise exception
      'Cannot remove Gemba applicability from an organisational unit that still has an active schedule. Reassign or deactivate the schedule first.'
      using errcode = '22023';
  end if;

  delete from public.gemba_definition_applicable_units applicability_row
  where applicability_row.organisation_id = org_id
    and applicability_row.definition_id = target_definition_id;

  insert into public.gemba_definition_applicable_units (
    organisation_id,
    definition_id,
    unit_id
  )
  select
    org_id,
    target_definition_id,
    candidate.unit_id
  from unnest(unique_unit_ids) as candidate(unit_id);

  perform private.append_business_audit(
    org_id,
    'gemba.definition.applicability_updated',
    target_definition_id,
    'succeeded',
    jsonb_build_object('unit_ids', unique_unit_ids)
  );

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5S template question bypass guard
-- ---------------------------------------------------------------------------

create or replace function private.add_template_question(
  target_template_version_id uuid,
  target_section_id uuid,
  target_question_type text,
  target_prompt text,
  target_position integer,
  target_is_required boolean default true,
  target_allows_not_applicable boolean default false,
  target_help_text text default null,
  target_options jsonb default null
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
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'templates.manage', null, null) then
    raise exception 'template question creation is not authorised'
      using errcode = '42501';
  end if;

  if private.is_maturity_assessment_template_version(target_template_version_id) then
    raise exception 'maturity assessment template questions must use maturity operations'
      using errcode = '42501';
  end if;

  if private.is_five_s_audit_template_version(target_template_version_id) then
    raise exception '5S audit template questions must use five_s operations'
      using errcode = '42501';
  end if;

  return private.add_template_question_internal(
    target_template_version_id,
    target_section_id,
    target_question_type,
    target_prompt,
    target_position,
    target_is_required,
    target_allows_not_applicable,
    target_help_text,
    target_options
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- private.add_five_s_question grants (hosted hygiene)
-- ---------------------------------------------------------------------------

revoke all on function private.add_five_s_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric
) from public, anon;
grant execute on function private.add_five_s_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric
) to authenticated, lean_hub_private_owner, postgres;


-- Authoring RPC site-scope guards

create or replace function private.add_five_s_question(
  target_standard_version_id uuid,
  target_section_id uuid,
  target_question_type text,
  target_prompt text,
  target_position integer,
  target_is_required boolean default true,
  target_allows_not_applicable boolean default false,
  target_help_text text default null,
  target_options jsonb default null,
  target_contributes_to_score boolean default false,
  target_scoring_metadata jsonb default null,
  target_weight numeric default 1
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  template_version_id uuid;
  version_status text;
  new_question_id uuid;
  version_scale jsonb;
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S question creation is not authorised'
      using errcode = '42501';
  end if;

  if not coalesce(private.five_s_standard_version_visible_to_actor(target_standard_version_id), false) then
    raise exception '5S standard is outside site scope'
      using errcode = '42501';
  end if;

  select standard_version.template_version_id, standard_version.status
  into template_version_id, version_status
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
  for update of standard_version;

  if template_version_id is null or version_status <> 'draft' then
    raise exception '5S standard version is not editable'
      using errcode = '55000';
  end if;

  if btrim(coalesce(target_question_type, '')) = ''
    or target_question_type not in ('yes_no', 'score') then
    raise exception '5S question type is not supported'
      using errcode = '22023';
  end if;

  if target_contributes_to_score
    and target_question_type in ('score', 'number', 'percentage') then
    select standard_version.scoring_scale
    into version_scale
    from public.five_s_standard_versions standard_version
    where standard_version.organisation_id = org_id
      and standard_version.id = target_standard_version_id
      and standard_version.status = 'draft';

    if not private.five_s_scoring_scale_is_valid(version_scale) then
      raise exception '5S scored questions require an explicit scoring scale on the draft'
        using errcode = '22023';
    end if;

    if target_scoring_metadata is not null
      and (
        target_scoring_metadata ? 'min'
        or target_scoring_metadata ? 'max'
        or target_scoring_metadata ? 'step'
      )
      and (
        not private.five_s_scoring_scale_is_valid(pg_catalog.jsonb_build_object(
          'min', target_scoring_metadata -> 'min',
          'max', target_scoring_metadata -> 'max',
          'step', target_scoring_metadata -> 'step'
        ))
        or (target_scoring_metadata ->> 'min')::numeric
          is distinct from (version_scale ->> 'min')::numeric
        or (target_scoring_metadata ->> 'max')::numeric
          is distinct from (version_scale ->> 'max')::numeric
        or (target_scoring_metadata ->> 'step')::numeric
          is distinct from (version_scale ->> 'step')::numeric
      ) then
      raise exception 'question scoring scale does not match the standard version scale'
        using errcode = '22023';
    end if;

    if coalesce(target_scoring_metadata ->> 'type', 'direct') is distinct from 'direct' then
      raise exception 'scored numeric questions use the standard scoring scale'
        using errcode = '22023';
    end if;

    target_scoring_metadata := '{"type":"direct"}'::jsonb;
  end if;

  new_question_id := private.add_template_question_internal(
    template_version_id,
    target_section_id,
    target_question_type,
    target_prompt,
    target_position,
    target_is_required,
    target_allows_not_applicable,
    target_help_text,
    target_options
  );

  insert into public.five_s_question_scoring (
    organisation_id,
    standard_version_id,
    question_id,
    contributes_to_score,
    scoring_metadata,
    weight
  )
  values (
    org_id,
    target_standard_version_id,
    new_question_id,
    target_contributes_to_score,
    target_scoring_metadata,
    target_weight
  );

  return new_question_id;
end;
$$;




create or replace function private.remove_five_s_question(
  target_question_id uuid
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
  linked_standard_version_id uuid;
  linked_standard_id uuid;
  linked_template_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S question removal is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.id,
    standard_version.standard_id,
    standard_version.template_version_id
  into linked_standard_version_id, linked_standard_id, linked_template_version_id
  from public.template_questions question_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = question_row.organisation_id
   and standard_version.template_version_id = question_row.template_version_id
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
  for update of question_row, standard_version;

  if linked_standard_version_id is null then
    raise exception '5S question is not removable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.five_s_standard_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = linked_standard_version_id
      and version_row.status = 'draft'
  ) then
    raise exception '5S question is not removable'
      using errcode = '55000';
  end if;

  perform private.assert_five_s_standard_visible_to_actor(linked_standard_id);

  delete from public.five_s_question_scoring scoring_row
  where scoring_row.organisation_id = org_id
    and scoring_row.standard_version_id = linked_standard_version_id
    and scoring_row.question_id = target_question_id;

  delete from public.template_questions question_row
  where question_row.organisation_id = org_id
    and question_row.id = target_question_id
    and question_row.template_version_id = linked_template_version_id;

  perform private.append_business_audit(
    org_id,
    'five_s.question.removed',
    linked_standard_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'standard_version_id', linked_standard_version_id,
      'question_id', target_question_id
    )
  );

  return true;
end;
$$;



create or replace function private.remove_five_s_section(
  target_section_id uuid
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
  linked_standard_version_id uuid;
  linked_standard_id uuid;
  linked_template_version_id uuid;
  orphan_question_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S section removal is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.id,
    standard_version.standard_id,
    standard_version.template_version_id
  into linked_standard_version_id, linked_standard_id, linked_template_version_id
  from public.template_sections section_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = section_row.organisation_id
   and standard_version.template_version_id = section_row.template_version_id
  where section_row.organisation_id = org_id
    and section_row.id = target_section_id
  for update of section_row, standard_version;

  if linked_standard_version_id is null then
    raise exception '5S section is not removable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.five_s_standard_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = linked_standard_version_id
      and version_row.status = 'draft'
  ) then
    raise exception '5S section is not removable'
      using errcode = '55000';
  end if;

  perform private.assert_five_s_standard_visible_to_actor(linked_standard_id);

  for orphan_question_id in
    select question_row.id
    from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.section_id = target_section_id
      and question_row.template_version_id = linked_template_version_id
  loop
    delete from public.five_s_question_scoring scoring_row
    where scoring_row.organisation_id = org_id
      and scoring_row.standard_version_id = linked_standard_version_id
      and scoring_row.question_id = orphan_question_id;

    delete from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.id = orphan_question_id;
  end loop;

  delete from public.five_s_section_weights weight_row
  where weight_row.organisation_id = org_id
    and weight_row.standard_version_id = linked_standard_version_id
    and weight_row.section_id = target_section_id;

  delete from public.template_sections section_row
  where section_row.organisation_id = org_id
    and section_row.id = target_section_id
    and section_row.template_version_id = linked_template_version_id;

  perform private.append_business_audit(
    org_id,
    'five_s.section.removed',
    linked_standard_id,
    'succeeded',
    pg_catalog.jsonb_build_object(
      'standard_version_id', linked_standard_version_id,
      'section_id', target_section_id
    )
  );

  return true;
end;
$$;

-- Discarding a draft deletes the version-owned template snapshot. Refuse when this is the
-- standard's only version (never-published brand-new drafts must be edited or published, not
-- discarded) so the parent standard always retains at least one version row.


create or replace function private.discard_five_s_standard_draft(
  target_standard_version_id uuid
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
  linked_standard_id uuid;
  linked_template_version_id uuid;
  version_count integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'five_s.standards.manage', null, null) then
    raise exception '5S draft discard is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.standard_id,
    standard_version.template_version_id
  into linked_standard_id, linked_template_version_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
    and standard_version.status = 'draft'
  for update;

  if linked_standard_id is null then
    raise exception '5S draft version was not found'
      using errcode = 'P0002';
  end if;

  perform private.assert_five_s_standard_visible_to_actor(linked_standard_id);

  select count(*)
  into version_count
  from public.five_s_standard_versions version_row
  where version_row.organisation_id = org_id
    and version_row.standard_id = linked_standard_id;

  if version_count <= 1 then
    raise exception '5S standard requires at least one version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.five_s_audits audit_row
    where audit_row.organisation_id = org_id
      and audit_row.standard_version_id = target_standard_version_id
  ) then
    raise exception 'draft version is referenced by audits and cannot be discarded'
      using errcode = '55000';
  end if;

  delete from public.five_s_question_scoring scoring_row
  where scoring_row.organisation_id = org_id
    and scoring_row.standard_version_id = target_standard_version_id;

  delete from public.five_s_section_weights weight_row
  where weight_row.organisation_id = org_id
    and weight_row.standard_version_id = target_standard_version_id;

  delete from public.template_questions question_row
  where question_row.organisation_id = org_id
    and question_row.template_version_id = linked_template_version_id;

  delete from public.template_sections section_row
  where section_row.organisation_id = org_id
    and section_row.template_version_id = linked_template_version_id;

  delete from public.five_s_standard_versions version_row
  where version_row.organisation_id = org_id
    and version_row.id = target_standard_version_id;

  delete from public.template_versions template_version_row
  where template_version_row.organisation_id = org_id
    and template_version_row.id = linked_template_version_id;

  perform private.append_business_audit(
    org_id,
    'five_s.standard.draft_discarded',
    linked_standard_id,
    'succeeded',
    pg_catalog.jsonb_build_object('standard_version_id', target_standard_version_id)
  );

  return true;
end;
$$;

