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
    private.membership_has_scoped_permission(
      target_membership_id,
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

create or replace function private.membership_has_site_scoped_operational_grant(
  target_organisation_id uuid,
  target_membership_id uuid,
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
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key = target_permission_key
    where grant_row.organisation_id = target_organisation_id
      and grant_row.grantee_membership_id = target_membership_id
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
      and grant_row.scope_type = 'unit_subtree'
  );
$$;

create or replace function private.membership_can_initiate_operational_configuration(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_permission_key text
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
    or private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      target_permission_key,
      null,
      null
    )
    or private.membership_has_site_scoped_operational_grant(
      target_organisation_id,
      target_membership_id,
      target_permission_key
    );
$$;

create or replace function private.membership_can_configure_operational_unit(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_permission_key text,
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
    or private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      target_permission_key,
      null,
      null
    )
    or private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      target_permission_key,
      null,
      target_unit_id
    );
$$;

create or replace function private.membership_can_author_five_s_standard(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_standard_id uuid
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
    or private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      'five_s.standards.manage',
      null,
      null
    )
    or (
      not exists (
        select 1
        from public.five_s_standard_applicable_units applicability_row
        where applicability_row.organisation_id = target_organisation_id
          and applicability_row.standard_id = target_standard_id
      )
      and private.membership_can_initiate_operational_configuration(
        target_organisation_id,
        target_membership_id,
        'five_s.standards.manage'
      )
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
          and not private.membership_can_configure_operational_unit(
            target_organisation_id,
            target_membership_id,
            'five_s.standards.manage',
            applicability_row.unit_id
          )
      )
    );
$$;

create or replace function private.membership_can_author_gemba_definition(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_definition_id uuid
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
    or private.membership_has_scoped_permission(
      target_membership_id,
      target_organisation_id,
      'gemba.definitions.manage',
      null,
      null
    )
    or (
      not exists (
        select 1
        from public.gemba_definition_applicable_units applicability_row
        where applicability_row.organisation_id = target_organisation_id
          and applicability_row.definition_id = target_definition_id
      )
      and private.membership_can_initiate_operational_configuration(
        target_organisation_id,
        target_membership_id,
        'gemba.definitions.manage'
      )
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
          and not private.membership_can_configure_operational_unit(
            target_organisation_id,
            target_membership_id,
            'gemba.definitions.manage',
            applicability_row.unit_id
          )
      )
    );
$$;

create or replace function private.guard_operational_configuration_unit_ids(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_permission_key text,
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
    if not private.membership_can_configure_operational_unit(
      target_organisation_id,
      target_membership_id,
      target_permission_key,
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
    or not private.membership_can_author_five_s_standard(
      org_id,
      actor_membership_id,
      target_standard_id
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
    or not private.membership_can_author_gemba_definition(
      org_id,
      actor_membership_id,
      target_definition_id
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
  select exists (
    select 1
    from public.five_s_standard_versions version_row
    where version_row.organisation_id = private.current_organisation_id()
      and version_row.id = target_standard_version_id
      and private.membership_can_author_five_s_standard(
        version_row.organisation_id,
        private.current_membership_id(version_row.organisation_id),
        version_row.standard_id
      )
  );
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
  select exists (
    select 1
    from public.gemba_definition_versions version_row
    where version_row.organisation_id = private.current_organisation_id()
      and version_row.id = target_definition_version_id
      and private.membership_can_author_gemba_definition(
        version_row.organisation_id,
        private.current_membership_id(version_row.organisation_id),
        version_row.definition_id
      )
  );
$$;

alter function private.membership_has_org_wide_operational_catalog_scope(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.membership_has_site_scoped_operational_grant(uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.membership_can_initiate_operational_configuration(uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.membership_can_configure_operational_unit(uuid, uuid, text, uuid)
  owner to lean_hub_private_owner;
alter function private.membership_can_author_five_s_standard(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.membership_can_author_gemba_definition(uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.guard_operational_configuration_unit_ids(uuid, uuid, text, uuid[])
  owner to lean_hub_private_owner;
alter function private.assert_five_s_standard_visible_to_actor(uuid)
  owner to lean_hub_private_owner;
alter function private.assert_gemba_definition_visible_to_actor(uuid)
  owner to lean_hub_private_owner;
alter function private.five_s_standard_version_visible_to_actor(uuid)
  owner to lean_hub_private_owner;
alter function private.gemba_definition_version_visible_to_actor(uuid)
  owner to lean_hub_private_owner;

revoke all on function private.membership_has_org_wide_operational_catalog_scope(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.membership_has_site_scoped_operational_grant(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.membership_can_initiate_operational_configuration(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.membership_can_configure_operational_unit(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function private.membership_can_author_five_s_standard(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.membership_can_author_gemba_definition(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.guard_operational_configuration_unit_ids(uuid, uuid, text, uuid[])
  from public, anon, authenticated;
revoke all on function private.assert_five_s_standard_visible_to_actor(uuid)
  from public, anon, authenticated;
revoke all on function private.assert_gemba_definition_visible_to_actor(uuid)
  from public, anon, authenticated;
revoke all on function private.five_s_standard_version_visible_to_actor(uuid)
  from public, anon, authenticated;
revoke all on function private.gemba_definition_version_visible_to_actor(uuid)
  from public, anon, authenticated;

grant execute on function private.membership_has_org_wide_operational_catalog_scope(uuid, uuid)
  to lean_hub_private_owner, postgres;
grant execute on function private.membership_has_site_scoped_operational_grant(uuid, uuid, text)
  to lean_hub_private_owner, postgres;
grant execute on function private.membership_can_initiate_operational_configuration(uuid, uuid, text)
  to lean_hub_private_owner, postgres;
grant execute on function private.membership_can_configure_operational_unit(uuid, uuid, text, uuid)
  to lean_hub_private_owner, postgres;
grant execute on function private.membership_can_author_five_s_standard(uuid, uuid, uuid)
  to lean_hub_private_owner, postgres;
grant execute on function private.membership_can_author_gemba_definition(uuid, uuid, uuid)
  to lean_hub_private_owner, postgres;
grant execute on function private.guard_operational_configuration_unit_ids(uuid, uuid, text, uuid[])
  to lean_hub_private_owner, postgres;
grant execute on function private.assert_five_s_standard_visible_to_actor(uuid)
  to lean_hub_private_owner, postgres;
grant execute on function private.assert_gemba_definition_visible_to_actor(uuid)
  to lean_hub_private_owner, postgres;
grant execute on function private.five_s_standard_version_visible_to_actor(uuid)
  to lean_hub_private_owner, postgres;
grant execute on function private.gemba_definition_version_visible_to_actor(uuid)
  to lean_hub_private_owner, postgres;

create or replace function public.member_can_author_five_s_standard(
  target_standard_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.membership_can_author_five_s_standard(
    private.current_organisation_id(),
    private.current_membership_id(private.current_organisation_id()),
    target_standard_id
  );
$$;

create or replace function public.member_can_author_gemba_definition(
  target_definition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.membership_can_author_gemba_definition(
    private.current_organisation_id(),
    private.current_membership_id(private.current_organisation_id()),
    target_definition_id
  );
$$;

revoke all on function public.member_can_author_five_s_standard(uuid)
  from public, anon;
grant execute on function public.member_can_author_five_s_standard(uuid)
  to authenticated, lean_hub_private_owner, postgres;

revoke all on function public.member_can_author_gemba_definition(uuid)
  from public, anon;
grant execute on function public.member_can_author_gemba_definition(uuid)
  to authenticated, lean_hub_private_owner, postgres;

-- ---------------------------------------------------------------------------
-- RLS: execution catalog read (authoring scope enforced in RPCs only)
-- ---------------------------------------------------------------------------

drop policy if exists five_s_standards_select on public.five_s_standards;
create policy five_s_standards_select
on public.five_s_standards for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

drop policy if exists five_s_standard_versions_select on public.five_s_standard_versions;
create policy five_s_standard_versions_select
on public.five_s_standard_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

drop policy if exists five_s_standard_applicable_units_select
  on public.five_s_standard_applicable_units;
create policy five_s_standard_applicable_units_select
on public.five_s_standard_applicable_units for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

drop policy if exists gemba_definitions_select on public.gemba_definitions;
create policy gemba_definitions_select
on public.gemba_definitions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
);

drop policy if exists gemba_definition_versions_select on public.gemba_definition_versions;
create policy gemba_definition_versions_select
on public.gemba_definition_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
);

drop policy if exists gemba_definition_applicable_units_select
  on public.gemba_definition_applicable_units;
create policy gemba_definition_applicable_units_select
on public.gemba_definition_applicable_units for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_gemba_catalog(organisation_id)
);

drop policy if exists five_s_section_weights_select on public.five_s_section_weights;
create policy five_s_section_weights_select
on public.five_s_section_weights for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
);

drop policy if exists five_s_question_scoring_select on public.five_s_question_scoring;
create policy five_s_question_scoring_select
on public.five_s_question_scoring for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_five_s_catalog(organisation_id)
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
    or not private.membership_can_initiate_operational_configuration(
      org_id,
      actor_membership_id,
      'five_s.standards.manage'
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
    'five_s.standards.manage',
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
    or not private.membership_can_initiate_operational_configuration(
      org_id,
      actor_membership_id,
      'gemba.definitions.manage'
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
    'gemba.definitions.manage',
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
    or not private.membership_can_initiate_operational_configuration(
      org_id,
      private.current_membership_id(org_id),
      'five_s.standards.manage'
    ) then
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
    or not private.membership_can_initiate_operational_configuration(
      org_id,
      actor_membership_id,
      'five_s.standards.manage'
    ) then
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
    or not private.membership_can_initiate_operational_configuration(
      org_id,
      actor_membership_id,
      'five_s.standards.manage'
    ) then
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
    or not private.membership_can_initiate_operational_configuration(
      org_id,
      actor_membership_id,
      'five_s.standards.manage'
    ) then
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

-- ---------------------------------------------------------------------------
-- Authoring RPC site-scope guards (remaining operations)
-- ---------------------------------------------------------------------------

create or replace function private.create_five_s_standard_draft(
  target_display_name text,
  target_description text default null,
  target_threshold_percent numeric default 90,
  target_unit_ids uuid[] default null
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
  new_standard_id uuid;
  new_template_id uuid;
  new_template_version_id uuid;
  new_standard_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'five_s.standards.manage') then
    raise exception '5S standard creation is not authorised'
      using errcode = '42501';
  end if;

  new_standard_id := private.register_resource_record(
    org_id,
    'five_s_standard',
    gen_random_uuid(),
    actor_membership_id
  );

  new_template_id := private.register_resource_record(
    org_id,
    'template',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.templates (
    id, organisation_id, experience_type, display_name, description, created_by_membership_id
  )
  values (
    new_template_id, org_id, 'five_s_audit', target_display_name, target_description, actor_membership_id
  );

  insert into public.five_s_standards (
    id, organisation_id, template_id, display_name, description, created_by_membership_id
  )
  values (
    new_standard_id, org_id, new_template_id, target_display_name, target_description, actor_membership_id
  );

  insert into public.template_versions (
    organisation_id, template_id, version_number, status, created_by_membership_id
  )
  values (org_id, new_template_id, 1, 'draft', actor_membership_id)
  returning id into new_template_version_id;

  insert into public.five_s_standard_versions (
    organisation_id, standard_id, template_version_id, version_number, status,
    target_threshold_percent, created_by_membership_id
  )
  values (
    org_id, new_standard_id, new_template_version_id, 1, 'draft',
    target_threshold_percent, actor_membership_id
  )
  returning id into new_standard_version_id;

  if target_unit_ids is not null then
    perform private.set_five_s_standard_applicable_units(
      new_standard_id,
      target_unit_ids
    );
  end if;

  perform private.append_business_audit(
    org_id, 'five_s.standard.created', new_standard_id, 'succeeded',
    jsonb_build_object('template_id', new_template_id)
  );

  return new_standard_id;
end;
$$;

create or replace function private.add_five_s_section(
  target_standard_version_id uuid,
  target_title text,
  target_position integer
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
  template_version_id uuid;
  version_status text;
  new_section_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'five_s.standards.manage') then
    raise exception '5S section creation is not authorised'
      using errcode = '42501';
  end if;

  select standard_version.template_version_id, standard_version.status
  into template_version_id, version_status
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
  for update of standard_version;

  perform private.assert_five_s_standard_visible_to_actor((
    select standard_version.standard_id
    from public.five_s_standard_versions standard_version
    where standard_version.organisation_id = org_id
      and standard_version.id = target_standard_version_id
  ));

  if template_version_id is null or version_status <> 'draft' then
    raise exception '5S standard version is not editable'
      using errcode = '55000';
  end if;

  new_section_id := private.add_template_section_internal(
    template_version_id,
    target_title,
    target_position
  );

  insert into public.five_s_section_weights (
    organisation_id, standard_version_id, section_id, weight
  )
  values (org_id, target_standard_version_id, new_section_id, 1)
  on conflict (organisation_id, standard_version_id, section_id) do nothing;

  return new_section_id;
end;
$$;

create or replace function private.set_five_s_standard_scoring_scale(
  target_standard_version_id uuid,
  target_min numeric,
  target_max numeric,
  target_step numeric
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
  requested_scale jsonb;
begin
  if org_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'five_s.standards.manage') then
    raise exception '5S scoring scale update is not authorised'
      using errcode = '42501';
  end if;

  requested_scale := pg_catalog.jsonb_build_object(
    'min', target_min,
    'max', target_max,
    'step', target_step
  );

  if not private.five_s_scoring_scale_is_valid(requested_scale) then
    raise exception '5S scoring scale is not valid'
      using errcode = '22023';
  end if;

  select version_row.standard_id
  into linked_standard_id
  from public.five_s_standard_versions version_row
  where version_row.organisation_id = org_id
    and version_row.id = target_standard_version_id
    and version_row.status = 'draft';

  if linked_standard_id is null then
    raise exception '5S scoring scale can only be set on a draft version'
      using errcode = '55000';
  end if;

  perform private.assert_five_s_standard_visible_to_actor(linked_standard_id);

  update public.five_s_standard_versions version_row
  set scoring_scale = requested_scale
  where version_row.organisation_id = org_id
    and version_row.id = target_standard_version_id
    and version_row.status = 'draft';

  if not found then
    raise exception '5S scoring scale can only be set on a draft version'
      using errcode = '55000';
  end if;

  return true;
end;
$$;

create or replace function private.publish_five_s_standard_version(
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
  linked_template_version_id uuid;
  standard_id uuid;
  version_scale jsonb;
  scored_link record;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'five_s.standards.manage') then
    raise exception '5S standard publication is not authorised'
      using errcode = '42501';
  end if;

  select
    standard_version.template_version_id,
    standard_version.standard_id,
    standard_version.scoring_scale
  into linked_template_version_id, standard_id, version_scale
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.id = target_standard_version_id
    and standard_version.status = 'draft'
  for update;

  if not found or standard_id is null then
    raise exception '5S standard version is not publishable'
      using errcode = '55000';
  end if;

  perform private.assert_five_s_standard_visible_to_actor(standard_id);

  if not exists (
    select 1
    from public.template_questions question_row
    where question_row.organisation_id = org_id
      and question_row.template_version_id = linked_template_version_id
      and btrim(question_row.prompt) <> ''
  ) then
    raise exception '5S standard version requires at least one question'
      using errcode = '55000';
  end if;

  for scored_link in
    select
      question_scoring.scoring_metadata,
      question_row.question_type
    from public.five_s_question_scoring question_scoring
    join public.template_questions question_row
      on question_row.organisation_id = question_scoring.organisation_id
     and question_row.id = question_scoring.question_id
    where question_scoring.organisation_id = org_id
      and question_scoring.standard_version_id = target_standard_version_id
      and question_scoring.contributes_to_score = true
  loop
    if not private.validate_scored_question_metadata(
      scored_link.question_type,
      scored_link.scoring_metadata
    ) then
      raise exception 'scored question has invalid scoring metadata'
        using errcode = '55000';
    end if;
  end loop;

  if exists (
    select 1
    from public.five_s_question_scoring question_scoring
    join public.template_questions question_row
      on question_row.organisation_id = question_scoring.organisation_id
     and question_row.id = question_scoring.question_id
    where question_scoring.organisation_id = org_id
      and question_scoring.standard_version_id = target_standard_version_id
      and question_scoring.contributes_to_score = true
      and question_row.question_type in ('score', 'number', 'percentage')
  ) and not private.five_s_scoring_scale_is_valid(version_scale) then
    raise exception '5S standard with scored questions requires an explicit scoring scale'
      using errcode = '22023';
  end if;

  if not private.five_s_standard_has_active_applicable_unit(org_id, standard_id) then
    raise exception
      '5S standard requires at least one applicable organisational unit'
      using errcode = '55000';
  end if;

  update public.five_s_standard_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_standard_version_id;

  perform private.publish_template_version_internal(
    linked_template_version_id,
    org_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id, 'five_s.standard.published', standard_id, 'succeeded',
    jsonb_build_object('standard_version_id', target_standard_version_id)
  );

  return true;
end;
$$;

create or replace function private.create_five_s_standard_successor_version(
  target_standard_id uuid
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
  template_id uuid;
  source_version_id uuid;
  source_version_number integer;
  source_template_version_id uuid;
  new_template_version_id uuid;
  new_standard_version_id uuid;
  weight_row record;
  scoring_row record;
  new_section_id uuid;
  new_question_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'five_s.standards.manage') then
    raise exception '5S standard successor creation is not authorised'
      using errcode = '42501';
  end if;

  select standard_item.template_id
  into template_id
  from public.five_s_standards standard_item
  where standard_item.organisation_id = org_id
    and standard_item.id = target_standard_id;

  perform private.assert_five_s_standard_visible_to_actor(target_standard_id);

  if template_id is null then
    raise exception '5S standard was not found'
      using errcode = '23503';
  end if;

  select version_item.id, version_item.version_number, version_item.template_version_id
  into source_version_id, source_version_number, source_template_version_id
  from public.five_s_standard_versions version_item
  where version_item.organisation_id = org_id
    and version_item.standard_id = target_standard_id
    and version_item.status = 'published'
  order by version_item.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception '5S standard has no published version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.five_s_standard_versions version_item
    where version_item.organisation_id = org_id
      and version_item.standard_id = target_standard_id
      and version_item.status = 'draft'
  ) then
    raise exception '5S standard already has a draft version'
      using errcode = '55000';
  end if;

  new_template_version_id := private.clone_published_template_version(template_id);

  insert into public.five_s_standard_versions (
    organisation_id,
    standard_id,
    template_version_id,
    version_number,
    status,
    target_threshold_percent,
    weighting_enabled,
    result_status_mappings,
    scoring_scale,
    created_by_membership_id
  )
  select
    org_id,
    target_standard_id,
    new_template_version_id,
    source_version_number + 1,
    'draft',
    source_version.target_threshold_percent,
    source_version.weighting_enabled,
    source_version.result_status_mappings,
    source_version.scoring_scale,
    actor_membership_id
  from public.five_s_standard_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_standard_version_id;

  for weight_row in
    select weight_item.section_id, weight_item.weight, section_item.position
    from public.five_s_section_weights weight_item
    join public.template_sections section_item
      on section_item.organisation_id = weight_item.organisation_id
     and section_item.id = weight_item.section_id
    where weight_item.organisation_id = org_id
      and weight_item.standard_version_id = source_version_id
  loop
    select section_item.id
    into new_section_id
    from public.template_sections section_item
    where section_item.organisation_id = org_id
      and section_item.template_version_id = new_template_version_id
      and section_item.position = weight_row.position;

    insert into public.five_s_section_weights (
      organisation_id, standard_version_id, section_id, weight
    )
    values (org_id, new_standard_version_id, new_section_id, weight_row.weight);
  end loop;

  for scoring_row in
    select
      scoring_item.contributes_to_score,
      scoring_item.scoring_metadata,
      scoring_item.weight,
      section_item.position as section_position,
      question_item.position as question_position
    from public.five_s_question_scoring scoring_item
    join public.template_questions question_item
      on question_item.organisation_id = scoring_item.organisation_id
     and question_item.id = scoring_item.question_id
    join public.template_sections section_item
      on section_item.organisation_id = question_item.organisation_id
     and section_item.id = question_item.section_id
    where scoring_item.organisation_id = org_id
      and scoring_item.standard_version_id = source_version_id
  loop
    select question_item.id
    into new_question_id
    from public.template_questions question_item
    join public.template_sections section_item
      on section_item.organisation_id = question_item.organisation_id
     and section_item.id = question_item.section_id
    where question_item.organisation_id = org_id
      and question_item.template_version_id = new_template_version_id
      and section_item.position = scoring_row.section_position
      and question_item.position = scoring_row.question_position;

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
      new_standard_version_id,
      new_question_id,
      scoring_row.contributes_to_score,
      scoring_row.scoring_metadata,
      scoring_row.weight
    );
  end loop;

  perform private.append_business_audit(
    org_id,
    'five_s.standard.successor_created',
    target_standard_id,
    'succeeded',
    jsonb_build_object(
      'standard_id', target_standard_id,
      'standard_version_id', new_standard_version_id
    )
  );

  return new_standard_version_id;
end;
$$;

create or replace function private.set_five_s_section_weight(
  target_standard_version_id uuid,
  target_section_id uuid,
  target_weight numeric
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
begin
  if org_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'five_s.standards.manage') then
    raise exception '5S section weight update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_five_s_standard_visible_to_actor((
    select version_row.standard_id
    from public.five_s_standard_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = target_standard_version_id
  ));

  update public.five_s_section_weights weight_row
  set weight = target_weight
  where weight_row.organisation_id = org_id
    and weight_row.standard_version_id = target_standard_version_id
    and weight_row.section_id = target_section_id;

  if not found then
    raise exception '5S section weight was not found'
      using errcode = '23503';
  end if;

  return true;
end;
$$;

create or replace function private.create_five_s_standard_draft_from_definition(
  target_declared_template_key text,
  target_definition jsonb,
  target_unit_ids uuid[]
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
  definition jsonb;
  declared_key text;
  definition_key text;
  display_name text;
  display_description text;
  threshold_text text;
  threshold_percent numeric;
  categories_json jsonb;
  questions_json jsonb;
  category_item jsonb;
  question_item jsonb;
  category_name text;
  question_prompt text;
  question_type text;
  help_text text;
  contributes boolean;
  scoring_metadata jsonb;
  category_count integer := 0;
  question_count integer := 0;
  questions_in_category integer;
  new_standard_id uuid;
  new_version_id uuid;
  new_section_id uuid;
  category_position integer;
  question_position integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'five_s.standards.manage') then
    raise exception '5S standard creation is not authorised'
      using errcode = '42501';
  end if;

  declared_key := btrim(coalesce(target_declared_template_key, ''));
  if declared_key = ''
    or char_length(declared_key) > 80
    or declared_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'declared template key is invalid'
      using errcode = '22023';
  end if;

  if target_definition is null
    or pg_catalog.jsonb_typeof(target_definition) is distinct from 'object' then
    raise exception '5S standard definition is required'
      using errcode = '22023';
  end if;

  definition := target_definition;
  definition_key := private.module_setup_require_text(definition -> 'key', 'key', 1, 80, true);
  if definition_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or definition_key is distinct from declared_key then
    raise exception 'declared template key does not match the definition'
      using errcode = '22023';
  end if;

  display_name := private.module_setup_require_text(definition -> 'name', 'name', 1, 160, true);
  display_description := private.module_setup_require_text(
    definition -> 'description',
    'description',
    1,
    600,
    true
  );

  threshold_text := definition ->> 'thresholdPercent';
  if threshold_text is null
    or threshold_text !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then
    raise exception '5S standard threshold must be a number from 0 to 100'
      using errcode = '22023';
  end if;
  threshold_percent := threshold_text::numeric;
  if threshold_percent < 0 or threshold_percent > 100 then
    raise exception '5S standard threshold must be a number from 0 to 100'
      using errcode = '22023';
  end if;

  if target_unit_ids is null or cardinality(target_unit_ids) < 1 then
    raise exception '5S standard requires at least one applicable organisational unit'
      using errcode = '22023';
  end if;
  if cardinality(target_unit_ids) > 50 then
    raise exception '5S standard applicability is too large'
      using errcode = '22023';
  end if;

  categories_json := private.module_setup_require_array(
    definition -> 'categories',
    'categories',
    1,
    8
  );

  if (
    select count(*)
    from (
      select lower(btrim(category_row.value ->> 'name')) as normalised_name
      from jsonb_array_elements(categories_json) as category_row(value)
    ) named_categories
  ) <> (
    select count(distinct named_categories.normalised_name)
    from (
      select lower(btrim(category_row.value ->> 'name')) as normalised_name
      from jsonb_array_elements(categories_json) as category_row(value)
    ) named_categories
  ) then
    raise exception '5S standard definition has duplicate category names'
      using errcode = '22023';
  end if;

  question_count := 0;
  for category_item in
    select value
    from jsonb_array_elements(categories_json)
  loop
    perform private.module_setup_require_object(category_item, 'category');
    perform private.module_setup_require_text(category_item -> 'name', 'category name', 1, 160, true);
    questions_json := private.module_setup_require_array(
      category_item -> 'questions',
      'questions',
      1,
      6
    );
    questions_in_category := 0;
    for question_item in
      select value
      from jsonb_array_elements(questions_json)
    loop
      perform private.module_setup_require_object(question_item, 'question');
      perform private.module_setup_require_text(question_item -> 'prompt', 'question prompt', 1, 500, true);
      question_type := private.module_setup_require_text(
        question_item -> 'questionType',
        'question type',
        1,
        32,
        true
      );
      if question_type not in ('yes_no', 'score', 'short_text', 'long_text') then
        raise exception '5S standard definition has an unsupported question type'
          using errcode = '22023';
      end if;
      perform private.module_setup_require_text(
        question_item -> 'helpText',
        'question guidance',
        1,
        400,
        false
      );
      questions_in_category := questions_in_category + 1;
    end loop;
    question_count := question_count + questions_in_category;
  end loop;

  if question_count > 30 then
    raise exception '5S standard definition has too many questions'
      using errcode = '22023';
  end if;

  new_standard_id := private.create_five_s_standard_draft(
    display_name,
    display_description,
    threshold_percent,
    target_unit_ids
  );

  select standard_version.id
  into new_version_id
  from public.five_s_standard_versions standard_version
  where standard_version.organisation_id = org_id
    and standard_version.standard_id = new_standard_id
    and standard_version.status = 'draft';

  if new_version_id is null then
    raise exception '5S standard draft could not be prepared'
      using errcode = '55000';
  end if;

  category_position := 0;
  for category_item in
    select value
    from jsonb_array_elements(categories_json)
  loop
    category_position := category_position + 1;
    category_name := private.module_setup_require_text(
      category_item -> 'name',
      'category name',
      1,
      160,
      true
    );
    new_section_id := private.add_five_s_section(
      new_version_id,
      category_name,
      category_position
    );
    category_count := category_count + 1;
    question_position := 0;
    for question_item in
      select value
      from jsonb_array_elements(category_item -> 'questions')
    loop
      question_position := question_position + 1;
      question_prompt := private.module_setup_require_text(
        question_item -> 'prompt',
        'question prompt',
        1,
        500,
        true
      );
      question_type := private.module_setup_require_text(
        question_item -> 'questionType',
        'question type',
        1,
        32,
        true
      );
      help_text := private.module_setup_require_text(
        question_item -> 'helpText',
        'question guidance',
        1,
        400,
        false
      );
      if question_type = 'yes_no' then
        contributes := true;
        scoring_metadata := jsonb_build_object(
          'type', 'yes_no',
          'yes_value', 100,
          'no_value', 0
        );
      elsif question_type = 'score' then
        contributes := true;
        scoring_metadata := jsonb_build_object('type', 'direct');
      else
        contributes := false;
        scoring_metadata := null;
      end if;

      perform private.add_five_s_question(
        new_version_id,
        new_section_id,
        question_type,
        question_prompt,
        question_position,
        true,
        false,
        help_text,
        null,
        contributes,
        scoring_metadata,
        1
      );
    end loop;
  end loop;

  perform private.append_business_audit(
    org_id,
    'five_s.standard.draft_created_from_definition',
    new_standard_id,
    'succeeded',
    jsonb_build_object(
      'declared_template_key', declared_key,
      'standard_version_id', new_version_id,
      'status', 'draft',
      'category_count', category_count,
      'question_count', question_count
    )
  );

  return new_standard_id;
end;
$$;

create or replace function private.create_gemba_definition_draft_from_definition(
  target_declared_template_key text,
  target_definition jsonb,
  target_unit_ids uuid[]
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
  definition jsonb;
  declared_key text;
  definition_key text;
  display_name text;
  display_description text;
  duration_text text;
  expected_duration integer;
  sections_json jsonb;
  prompts_json jsonb;
  section_item jsonb;
  prompt_item jsonb;
  section_name text;
  prompt_text text;
  help_text text;
  section_count integer := 0;
  prompt_count integer := 0;
  prompts_in_section integer;
  new_definition_id uuid;
  new_version_id uuid;
  new_section_id uuid;
  section_position integer;
  prompt_position integer;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'gemba.definitions.manage') then
    raise exception 'gemba definition creation is not authorised'
      using errcode = '42501';
  end if;

  declared_key := btrim(coalesce(target_declared_template_key, ''));
  if declared_key = ''
    or char_length(declared_key) > 80
    or declared_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'declared template key is invalid'
      using errcode = '22023';
  end if;

  if target_definition is null
    or pg_catalog.jsonb_typeof(target_definition) is distinct from 'object' then
    raise exception 'gemba definition is required'
      using errcode = '22023';
  end if;

  definition := target_definition;
  definition_key := private.module_setup_require_text(definition -> 'key', 'key', 1, 80, true);
  if definition_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or definition_key is distinct from declared_key then
    raise exception 'declared template key does not match the definition'
      using errcode = '22023';
  end if;

  display_name := private.module_setup_require_text(definition -> 'name', 'name', 1, 160, true);
  display_description := private.module_setup_require_text(
    definition -> 'description',
    'description',
    1,
    600,
    true
  );

  if definition ? 'expectedDurationMinutes'
    and definition -> 'expectedDurationMinutes' is distinct from 'null'::jsonb then
    duration_text := definition ->> 'expectedDurationMinutes';
    if duration_text is null or duration_text !~ '^[0-9]{1,3}$' then
      raise exception 'gemba definition duration is invalid'
        using errcode = '22023';
    end if;
    expected_duration := duration_text::integer;
    if expected_duration < 10 or expected_duration > 240 then
      raise exception 'gemba definition duration is invalid'
        using errcode = '22023';
    end if;
  else
    expected_duration := null;
  end if;

  if target_unit_ids is null or cardinality(target_unit_ids) < 1 then
    raise exception 'gemba definition requires at least one applicable organisational unit'
      using errcode = '22023';
  end if;
  if cardinality(target_unit_ids) > 50 then
    raise exception 'gemba definition applicability is too large'
      using errcode = '22023';
  end if;

  sections_json := private.module_setup_require_array(
    definition -> 'sections',
    'sections',
    1,
    8
  );

  if (
    select count(*)
    from (
      select lower(btrim(section_row.value ->> 'name')) as normalised_name
      from jsonb_array_elements(sections_json) as section_row(value)
    ) named_sections
  ) <> (
    select count(distinct named_sections.normalised_name)
    from (
      select lower(btrim(section_row.value ->> 'name')) as normalised_name
      from jsonb_array_elements(sections_json) as section_row(value)
    ) named_sections
  ) then
    raise exception 'gemba definition has duplicate section names'
      using errcode = '22023';
  end if;

  prompt_count := 0;
  for section_item in
    select value
    from jsonb_array_elements(sections_json)
  loop
    perform private.module_setup_require_object(section_item, 'section');
    perform private.module_setup_require_text(section_item -> 'name', 'section name', 1, 160, true);
    prompts_json := private.module_setup_require_array(
      section_item -> 'prompts',
      'prompts',
      1,
      5
    );
    prompts_in_section := 0;
    for prompt_item in
      select value
      from jsonb_array_elements(prompts_json)
    loop
      perform private.module_setup_require_object(prompt_item, 'prompt');
      perform private.module_setup_require_text(prompt_item -> 'prompt', 'prompt', 1, 500, true);
      perform private.module_setup_require_text(
        prompt_item -> 'helpText',
        'prompt guidance',
        1,
        400,
        false
      );
      prompts_in_section := prompts_in_section + 1;
    end loop;
    prompt_count := prompt_count + prompts_in_section;
  end loop;

  if prompt_count > 24 then
    raise exception 'gemba definition has too many prompts'
      using errcode = '22023';
  end if;

  new_definition_id := private.create_gemba_definition_draft(
    display_name,
    display_description,
    expected_duration,
    target_unit_ids
  );

  select definition_version.id
  into new_version_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.definition_id = new_definition_id
    and definition_version.status = 'draft';

  if new_version_id is null then
    raise exception 'gemba definition draft could not be prepared'
      using errcode = '55000';
  end if;

  section_position := 0;
  for section_item in
    select value
    from jsonb_array_elements(sections_json)
  loop
    section_position := section_position + 1;
    section_name := private.module_setup_require_text(
      section_item -> 'name',
      'section name',
      1,
      160,
      true
    );
    new_section_id := private.add_gemba_section(
      new_version_id,
      section_name,
      section_position
    );
    section_count := section_count + 1;
    prompt_position := 0;
    for prompt_item in
      select value
      from jsonb_array_elements(section_item -> 'prompts')
    loop
      prompt_position := prompt_position + 1;
      prompt_text := private.module_setup_require_text(
        prompt_item -> 'prompt',
        'prompt',
        1,
        500,
        true
      );
      help_text := private.module_setup_require_text(
        prompt_item -> 'helpText',
        'prompt guidance',
        1,
        400,
        false
      );
      perform private.add_gemba_question(
        new_version_id,
        new_section_id,
        'short_text',
        prompt_text,
        prompt_position,
        true,
        false,
        help_text,
        null
      );
    end loop;
  end loop;

  perform private.append_business_audit(
    org_id,
    'gemba.definition.draft_created_from_definition',
    new_definition_id,
    'succeeded',
    jsonb_build_object(
      'declared_template_key', declared_key,
      'definition_version_id', new_version_id,
      'status', 'draft',
      'section_count', section_count,
      'prompt_count', prompt_count
    )
  );

  return new_definition_id;
end;
$$;

create or replace function private.create_gemba_definition_draft(
  target_display_name text,
  target_description text default null,
  target_expected_duration_minutes integer default null
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
  new_definition_id uuid;
  new_template_id uuid;
  new_template_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'gemba.definitions.manage') then
    raise exception 'gemba definition creation is not authorised'
      using errcode = '42501';
  end if;

  new_definition_id := private.register_resource_record(
    org_id, 'gemba_definition', gen_random_uuid(), actor_membership_id
  );

  new_template_id := private.register_resource_record(
    org_id, 'template', gen_random_uuid(), actor_membership_id
  );

  insert into public.templates (
    id, organisation_id, experience_type, display_name, description, created_by_membership_id
  )
  values (
    new_template_id, org_id, 'gemba_walk', target_display_name, target_description, actor_membership_id
  );

  insert into public.gemba_definitions (
    id, organisation_id, template_id, display_name, description, created_by_membership_id
  )
  values (
    new_definition_id, org_id, new_template_id, target_display_name, target_description, actor_membership_id
  );

  insert into public.template_versions (
    organisation_id, template_id, version_number, status, created_by_membership_id
  )
  values (org_id, new_template_id, 1, 'draft', actor_membership_id)
  returning id into new_template_version_id;

  insert into public.gemba_definition_versions (
    organisation_id, definition_id, template_version_id, version_number, status,
    expected_duration_minutes, created_by_membership_id
  )
  values (
    org_id, new_definition_id, new_template_version_id, 1, 'draft',
    target_expected_duration_minutes, actor_membership_id
  );

  return new_definition_id;
end;
$$;

create or replace function private.add_gemba_section(
  target_definition_version_id uuid,
  target_title text,
  target_position integer
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
  template_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'gemba.definitions.manage') then
    raise exception 'gemba section creation is not authorised'
      using errcode = '42501';
  end if;

  select definition_version.template_version_id
  into template_version_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.id = target_definition_version_id
    and definition_version.status = 'draft';

  perform private.assert_gemba_definition_visible_to_actor((
    select definition_version.definition_id
    from public.gemba_definition_versions definition_version
    where definition_version.organisation_id = org_id
      and definition_version.id = target_definition_version_id
  ));

  if template_version_id is null then
    raise exception 'gemba definition version is not editable'
      using errcode = '55000';
  end if;

  return private.add_template_section_internal(
    template_version_id,
    target_title,
    target_position
  );
end;
$$;

create or replace function private.add_gemba_question(
  target_definition_version_id uuid,
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
  template_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'gemba.definitions.manage') then
    raise exception 'gemba question creation is not authorised'
      using errcode = '42501';
  end if;

  select definition_version.template_version_id
  into template_version_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.id = target_definition_version_id
    and definition_version.status = 'draft';

  perform private.assert_gemba_definition_visible_to_actor((
    select definition_version.definition_id
    from public.gemba_definition_versions definition_version
    where definition_version.organisation_id = org_id
      and definition_version.id = target_definition_version_id
  ));

  if template_version_id is null then
    raise exception 'gemba definition version is not editable'
      using errcode = '55000';
  end if;

  return private.add_template_question_internal(
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
end;
$$;

create or replace function private.publish_gemba_definition_version(
  target_definition_version_id uuid
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
  template_version_id uuid;
  definition_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'gemba.definitions.manage') then
    raise exception 'gemba definition publication is not authorised'
      using errcode = '42501';
  end if;

  select
    definition_version.template_version_id,
    definition_version.definition_id
  into template_version_id, definition_id
  from public.gemba_definition_versions definition_version
  where definition_version.organisation_id = org_id
    and definition_version.id = target_definition_version_id
    and definition_version.status = 'draft'
  for update;

  if not found or definition_id is null then
    raise exception 'gemba definition version is not publishable'
      using errcode = '55000';
  end if;

  perform private.assert_gemba_definition_visible_to_actor(definition_id);

  update public.gemba_definition_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_definition_version_id;

  perform private.publish_template_version_internal(
    template_version_id,
    org_id,
    actor_membership_id
  );

  return true;
end;
$$;

create or replace function private.create_gemba_definition_successor_version(
  target_definition_id uuid
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
  template_id uuid;
  source_version_id uuid;
  source_version_number integer;
  new_template_version_id uuid;
  new_definition_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.membership_can_initiate_operational_configuration(org_id, actor_membership_id, 'gemba.definitions.manage') then
    raise exception 'gemba definition successor creation is not authorised'
      using errcode = '42501';
  end if;

  select definition_item.template_id
  into template_id
  from public.gemba_definitions definition_item
  where definition_item.organisation_id = org_id
    and definition_item.id = target_definition_id;

  perform private.assert_gemba_definition_visible_to_actor(target_definition_id);

  if template_id is null then
    raise exception 'gemba definition was not found'
      using errcode = '23503';
  end if;

  select version_item.id, version_item.version_number
  into source_version_id, source_version_number
  from public.gemba_definition_versions version_item
  where version_item.organisation_id = org_id
    and version_item.definition_id = target_definition_id
    and version_item.status = 'published'
  order by version_item.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception 'gemba definition has no published version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.gemba_definition_versions version_item
    where version_item.organisation_id = org_id
      and version_item.definition_id = target_definition_id
      and version_item.status = 'draft'
  ) then
    raise exception 'gemba definition already has a draft version'
      using errcode = '55000';
  end if;

  new_template_version_id := private.clone_published_template_version(template_id);

  insert into public.gemba_definition_versions (
    organisation_id,
    definition_id,
    template_version_id,
    version_number,
    status,
    expected_duration_minutes,
    created_by_membership_id
  )
  select
    org_id,
    target_definition_id,
    new_template_version_id,
    source_version_number + 1,
    'draft',
    source_version.expected_duration_minutes,
    actor_membership_id
  from public.gemba_definition_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_definition_version_id;

  perform private.append_business_audit(
    org_id,
    'gemba.definition.successor_created',
    target_definition_id,
    'succeeded',
    jsonb_build_object(
      'definition_id', target_definition_id,
      'definition_version_id', new_definition_version_id
    )
  );

  return new_definition_version_id;
end;
$$;
