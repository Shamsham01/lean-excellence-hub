-- SKILLS-SETUP-001
-- Atomic Skills setup drafts (manual, Quick Start, LeanAI), explicit publish,
-- and discard of eligible draft-owned records.
-- This is not an organisation reset and does not publish, assess, or grant access.
-- Do not apply this file to hosted Supabase from the repository workflow.
-- Apply it forward, after 20261027232950, on a disposable database.

alter table public.skills
  drop constraint skills_status_check,
  drop constraint skills_deactivated_check;

alter table public.skills
  add constraint skills_status_check
    check (status in ('draft', 'active', 'deactivated')),
  add constraint skills_deactivated_check
    check (
      (status in ('draft', 'active') and deactivated_at is null)
      or (status = 'deactivated' and deactivated_at is not null)
    );

comment on column public.skills.status is
  'draft: created by an unpublished setup bundle and not operational. active: available for requirements and assessment. deactivated: retired.';

create table public.skill_setup_bundles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  source text not null,
  template_key text,
  template_version text,
  title text not null,
  status text not null default 'draft',
  idempotency_key text not null,
  applicability text not null default 'organisation',
  sample boolean not null default false,
  unresolved jsonb not null default '[]'::jsonb,
  scale_id uuid,
  scale_version_id uuid,
  capability_set_id uuid,
  capability_set_version_id uuid,
  created_by_membership_id uuid not null,
  published_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint skill_setup_bundles_organisation_id_id_key unique (organisation_id, id),
  constraint skill_setup_bundles_idempotency_key unique (organisation_id, idempotency_key),
  constraint skill_setup_bundles_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skill_setup_bundles_scale_fkey
    foreign key (organisation_id, scale_id)
    references public.skill_proficiency_scales(organisation_id, id)
    on delete restrict,
  constraint skill_setup_bundles_scale_version_fkey
    foreign key (organisation_id, scale_version_id)
    references public.skill_proficiency_scale_versions(organisation_id, id)
    on delete restrict,
  constraint skill_setup_bundles_set_fkey
    foreign key (organisation_id, capability_set_id)
    references public.skill_capability_sets(organisation_id, id)
    on delete restrict,
  constraint skill_setup_bundles_set_version_fkey
    foreign key (organisation_id, capability_set_version_id)
    references public.skill_capability_set_versions(organisation_id, id)
    on delete restrict,
  constraint skill_setup_bundles_source_check
    check (source in ('manual', 'quick_start', 'leanai')),
  constraint skill_setup_bundles_status_check
    check (status in ('draft', 'published', 'discarded')),
  constraint skill_setup_bundles_applicability_check
    check (applicability in ('organisation', 'units')),
  constraint skill_setup_bundles_title_check
    check (title = btrim(title) and char_length(title) between 1 and 160),
  constraint skill_setup_bundles_idempotency_check
    check (
      idempotency_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  constraint skill_setup_bundles_template_key_check
    check (
      template_key is null
      or (
        template_key = btrim(template_key)
        and char_length(template_key) between 1 and 80
      )
    ),
  constraint skill_setup_bundles_lifecycle_check
    check (
      (status = 'draft' and published_at is null and discarded_at is null)
      or (status = 'published' and published_at is not null and discarded_at is null)
      or (status = 'discarded' and discarded_at is not null and published_at is null)
    )
);

create table public.skill_setup_bundle_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  bundle_id uuid not null,
  record_kind text not null,
  record_id uuid not null,
  ownership text not null,
  label text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint skill_setup_bundle_items_organisation_id_id_key unique (organisation_id, id),
  constraint skill_setup_bundle_items_bundle_fkey
    foreign key (organisation_id, bundle_id)
    references public.skill_setup_bundles(organisation_id, id)
    on delete restrict,
  constraint skill_setup_bundle_items_identity_key
    unique (bundle_id, record_kind, record_id),
  constraint skill_setup_bundle_items_kind_check
    check (record_kind in ('scale', 'skill', 'capability_set', 'requirement')),
  constraint skill_setup_bundle_items_ownership_check
    check (ownership in ('created', 'reused')),
  constraint skill_setup_bundle_items_label_check
    check (label = btrim(label) and char_length(label) between 1 and 160)
);

create table public.skill_setup_preparations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  source text not null,
  template_key text not null default '',
  state jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint skill_setup_preparations_identity_key
    unique (organisation_id, membership_id, source, template_key),
  constraint skill_setup_preparations_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skill_setup_preparations_source_check
    check (source in ('manual', 'quick_start', 'leanai')),
  constraint skill_setup_preparations_template_key_check
    check (char_length(template_key) <= 80),
  constraint skill_setup_preparations_state_check
    check (
      jsonb_typeof(state) = 'object'
      and octet_length(state::text) <= 100000
    )
);

create index skill_setup_bundles_org_status_idx
  on public.skill_setup_bundles (organisation_id, status, created_at desc);

create index skill_setup_bundle_items_bundle_idx
  on public.skill_setup_bundle_items (organisation_id, bundle_id);

create trigger skill_setup_bundles_prevent_organisation_id_change
before update on public.skill_setup_bundles
for each row execute function private.prevent_organisation_id_change();

create trigger skill_setup_bundle_items_prevent_organisation_id_change
before update on public.skill_setup_bundle_items
for each row execute function private.prevent_organisation_id_change();

create trigger skill_setup_preparations_prevent_organisation_id_change
before update on public.skill_setup_preparations
for each row execute function private.prevent_organisation_id_change();

create trigger skill_setup_bundles_touch_updated_at
before update on public.skill_setup_bundles
for each row execute function private.touch_updated_at();

create trigger skill_setup_preparations_touch_updated_at
before update on public.skill_setup_preparations
for each row execute function private.touch_updated_at();

alter table public.skill_setup_bundles enable row level security;
alter table public.skill_setup_bundles force row level security;
alter table public.skill_setup_bundle_items enable row level security;
alter table public.skill_setup_bundle_items force row level security;
alter table public.skill_setup_preparations enable row level security;
alter table public.skill_setup_preparations force row level security;

revoke all on public.skill_setup_bundles from public, anon, authenticated, service_role;
revoke all on public.skill_setup_bundle_items from public, anon, authenticated, service_role;
revoke all on public.skill_setup_preparations from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.skill_setup_bundles to lean_hub_private_owner;
grant select, insert, update, delete on public.skill_setup_bundle_items to lean_hub_private_owner;
grant select, insert, update, delete on public.skill_setup_preparations to lean_hub_private_owner;
grant select on public.skill_setup_bundles to authenticated;
grant select on public.skill_setup_bundle_items to authenticated;
grant select on public.skill_setup_preparations to authenticated;

create policy private_owner_all_skill_setup_bundles
on public.skill_setup_bundles for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_skill_setup_bundle_items
on public.skill_setup_bundle_items for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_skill_setup_preparations
on public.skill_setup_preparations for all to lean_hub_private_owner
using (true) with check (true);

create policy skill_setup_bundles_select
on public.skill_setup_bundles for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_read_skills_catalog(organisation_id)
    or private.can_manage_skills_catalog(organisation_id)
    or private.can_manage_skill_requirements(organisation_id)
  )
);

create policy skill_setup_bundle_items_select
on public.skill_setup_bundle_items for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_read_skills_catalog(organisation_id)
    or private.can_manage_skills_catalog(organisation_id)
    or private.can_manage_skill_requirements(organisation_id)
  )
);

create policy skill_setup_preparations_select
on public.skill_setup_preparations for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and membership_id = private.current_membership_id(organisation_id)
  and (
    private.can_read_skills_catalog(organisation_id)
    or private.can_manage_skills_catalog(organisation_id)
    or private.can_manage_skill_requirements(organisation_id)
  )
);

create or replace function private.skills_setup_authorised(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_skills_catalog(target_organisation_id)
    and private.can_manage_skill_requirements(target_organisation_id)
$$;

create or replace function private.skills_setup_uuid(
  candidate text,
  required boolean
)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
#variable_conflict use_variable
declare
  cleaned text := nullif(btrim(candidate), '');
begin
  if cleaned is null then
    if required then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
    return null;
  end if;

  if cleaned !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  return cleaned::uuid;
end;
$$;

create or replace function private.skills_setup_skill_retain_reason(
  target_organisation_id uuid,
  target_skill_id uuid,
  target_capability_set_version_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.membership_skill_assessments assessment_row
    where assessment_row.organisation_id = target_organisation_id
      and assessment_row.skill_id = target_skill_id
  ) then
    return 'assessment history';
  end if;

  if exists (
    select 1
    from public.training_course_skill_links link_row
    where link_row.organisation_id = target_organisation_id
      and link_row.skill_id = target_skill_id
  ) then
    return 'training link';
  end if;

  if exists (
    select 1
    from public.capability_action_context action_row
    where action_row.organisation_id = target_organisation_id
      and action_row.skill_id = target_skill_id
  ) then
    return 'action reference';
  end if;

  if exists (
    select 1
    from public.skill_requirements requirement_row
    where requirement_row.organisation_id = target_organisation_id
      and requirement_row.skill_id = target_skill_id
      and requirement_row.capability_set_version_id
        is distinct from target_capability_set_version_id
  ) then
    return 'another capability standard';
  end if;

  return null;
end;
$$;

create or replace function private.create_skill_setup_draft(
  target_idempotency_key text,
  target_definition jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  definition jsonb;
  source_text text;
  template_key text;
  template_version text;
  title_text text;
  applicability_text text;
  resolution_text text;
  sample_flag boolean;
  scale_json jsonb;
  skills_json jsonb;
  standard_json jsonb;
  requirements_json jsonb;
  unresolved_json jsonb;
  scale_name text;
  scale_description text;
  levels_json jsonb;
  level_item jsonb;
  level_label text;
  level_guidance text;
  level_order integer;
  level_signature text := '';
  seen_labels text[] := '{}';
  seen_orders integer[] := '{}';
  existing_bundle_id uuid;
  existing_scale_id uuid;
  existing_version_id uuid;
  incompatible_scale boolean := false;
  scale_id uuid;
  scale_version_id uuid;
  scale_ownership text;
  skill_item jsonb;
  skill_name text;
  skill_code text;
  skill_category text;
  skill_description text;
  skill_evidence text;
  seen_codes text[] := '{}';
  staged_skills jsonb := '[]'::jsonb;
  skill_id uuid;
  skill_ownership text;
  standard_name text;
  standard_code text;
  standard_description text;
  code_suffix integer := 0;
  set_id uuid;
  set_version_id uuid;
  requirement_item jsonb;
  requirement_code text;
  requirement_skill_id uuid;
  requirement_job_function_id uuid;
  requirement_unit_id uuid;
  requirement_level_label text;
  requirement_level_id uuid;
  requirement_evidence text;
  requirement_notes text;
  requirement_id uuid;
  bundle_id uuid;
  level_map jsonb;
  staged_requirements jsonb := '[]'::jsonb;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  if target_idempotency_key is null
    or target_idempotency_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  if target_definition is null
    or pg_catalog.jsonb_typeof(target_definition) is distinct from 'object'
    or octet_length(target_definition::text) > 200000 then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(org_id::text || ':skill-setup:' || target_idempotency_key, 0)
  );

  select bundle_row.id
  into existing_bundle_id
  from public.skill_setup_bundles bundle_row
  where bundle_row.organisation_id = org_id
    and bundle_row.idempotency_key = target_idempotency_key;

  if existing_bundle_id is not null then
    return existing_bundle_id;
  end if;

  definition := private.module_setup_require_object(target_definition, 'definition');
  source_text := private.module_setup_require_text(
    definition -> 'source', 'source', 1, 20, true
  );
  if source_text not in ('manual', 'quick_start', 'leanai') then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  template_key := private.module_setup_require_text(
    definition -> 'template_key', 'template key', 1, 80, false
  );
  template_version := private.module_setup_require_text(
    definition -> 'template_version', 'template version', 1, 40, false
  );
  title_text := private.module_setup_require_text(
    definition -> 'title', 'title', 1, 160, true
  );
  applicability_text := coalesce(
    private.module_setup_require_text(
      definition -> 'applicability', 'applicability', 1, 20, false
    ),
    'organisation'
  );
  if applicability_text not in ('organisation', 'units') then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  resolution_text := coalesce(
    private.module_setup_require_text(
      definition -> 'scale_resolution', 'scale resolution', 1, 32, false
    ),
    'create'
  );
  if resolution_text not in ('create', 'reuse', 'create_alongside') then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  sample_flag := source_text = 'quick_start'
    or coalesce((definition ->> 'sample')::boolean, false);

  scale_json := private.module_setup_require_object(definition -> 'scale', 'scale');
  skills_json := private.module_setup_require_array(
    definition -> 'skills', 'skills', 1, 24
  );
  standard_json := private.module_setup_require_object(
    definition -> 'standard', 'standard'
  );
  requirements_json := private.module_setup_require_array(
    coalesce(definition -> 'requirements', '[]'::jsonb),
    'requirements',
    0,
    80
  );
  unresolved_json := coalesce(definition -> 'unresolved_roles', '[]'::jsonb);
  if pg_catalog.jsonb_typeof(unresolved_json) is distinct from 'array'
    or jsonb_array_length(unresolved_json) > 40 then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  scale_name := private.module_setup_require_text(
    scale_json -> 'name', 'scale name', 1, 160, true
  );
  scale_description := private.module_setup_require_text(
    scale_json -> 'description', 'scale description', 1, 2000, false
  );
  levels_json := private.module_setup_require_array(
    scale_json -> 'levels', 'levels', 2, 8
  );

  for level_item in
    select value from jsonb_array_elements(levels_json)
  loop
    perform private.module_setup_require_object(level_item, 'level');
    level_label := private.module_setup_require_text(
      level_item -> 'label', 'level label', 1, 120, true
    );
    level_guidance := private.module_setup_require_text(
      level_item -> 'guidance', 'level guidance', 1, 2000, false
    );
    if coalesce(level_item ->> 'order', '') !~ '^[0-9]{1,3}$' then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
    level_order := (level_item ->> 'order')::integer;
    if level_order < 0 or level_order > 999
      or lower(level_label) = any (seen_labels)
      or level_order = any (seen_orders) then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
    seen_labels := array_append(seen_labels, lower(level_label));
    seen_orders := array_append(seen_orders, level_order);
    level_signature := level_signature || lower(level_label) || '|';
  end loop;

  select scale_row.id, version_row.id
  into existing_scale_id, existing_version_id
  from public.skill_proficiency_scales scale_row
  join public.skill_proficiency_scale_versions version_row
    on version_row.organisation_id = scale_row.organisation_id
    and version_row.scale_id = scale_row.id
    and version_row.status = 'published'
  where scale_row.organisation_id = org_id
    and scale_row.status = 'active'
    and lower(scale_row.name) = lower(scale_name)
    and (
      select coalesce(string_agg(lower(level_row.label), '|' order by level_row.order_value), '') || '|'
      from public.skill_proficiency_levels level_row
      where level_row.organisation_id = org_id
        and level_row.scale_version_id = version_row.id
    ) = level_signature
  order by version_row.published_at desc nulls last
  limit 1;

  if existing_scale_id is null and exists (
    select 1
    from public.skill_proficiency_scales scale_row
    where scale_row.organisation_id = org_id
      and scale_row.status = 'active'
      and lower(scale_row.name) = lower(scale_name)
  ) then
    incompatible_scale := true;
  end if;

  if existing_scale_id is not null then
    scale_id := existing_scale_id;
    scale_version_id := existing_version_id;
    scale_ownership := 'reused';
  elsif resolution_text = 'reuse' then
    raise exception 'compatible proficiency scale was not found'
      using errcode = '22023';
  elsif incompatible_scale and resolution_text is distinct from 'create_alongside' then
    raise exception 'existing proficiency scale differs'
      using errcode = '22023';
  else
    if incompatible_scale then
      scale_name := left(scale_name, 145) || ' (setup draft)';
    end if;
    if sample_flag and scale_description is not null
      and scale_description not like 'Sample.%' then
      scale_description := left('Sample. ' || scale_description, 2000);
    end if;

    insert into public.skill_proficiency_scales (
      organisation_id, name, description, created_by_membership_id
    )
    values (org_id, scale_name, scale_description, actor_membership_id)
    returning id into scale_id;

    insert into public.skill_proficiency_scale_versions (
      organisation_id, scale_id, version_number, status, created_by_membership_id
    )
    values (org_id, scale_id, 1, 'draft', actor_membership_id)
    returning id into scale_version_id;

    for level_item in
      select value from jsonb_array_elements(levels_json)
    loop
      insert into public.skill_proficiency_levels (
        organisation_id,
        scale_version_id,
        order_value,
        label,
        guidance
      )
      values (
        org_id,
        scale_version_id,
        (level_item ->> 'order')::integer,
        private.module_setup_require_text(level_item -> 'label', 'level label', 1, 120, true),
        private.module_setup_require_text(level_item -> 'guidance', 'level guidance', 1, 2000, false)
      );
    end loop;
    scale_ownership := 'created';
  end if;

  for skill_item in
    select value from jsonb_array_elements(skills_json)
  loop
    perform private.module_setup_require_object(skill_item, 'skill');
    skill_name := private.module_setup_require_text(
      skill_item -> 'name', 'skill name', 1, 160, true
    );
    skill_code := lower(private.module_setup_require_text(
      skill_item -> 'code', 'skill code', 1, 80, true
    ));
    if skill_code !~ '^[a-z0-9][a-z0-9._-]{0,79}$'
      or skill_code = any (seen_codes) then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
    seen_codes := array_append(seen_codes, skill_code);
    skill_category := private.module_setup_require_text(
      skill_item -> 'category', 'skill category', 1, 120, false
    );
    skill_description := private.module_setup_require_text(
      skill_item -> 'description', 'skill description', 1, 2000, false
    );
    skill_evidence := private.module_setup_require_text(
      skill_item -> 'evidence_expectations', 'evidence expectations', 1, 2000, false
    );

    select skill_row.id
    into skill_id
    from public.skills skill_row
    where skill_row.organisation_id = org_id
      and skill_row.status in ('draft', 'active')
      and (
        skill_row.code = skill_code
        or lower(skill_row.name) = lower(skill_name)
      )
    order by case when skill_row.code = skill_code then 0 else 1 end
    limit 1;

    if skill_id is not null then
      skill_ownership := 'reused';
    else
      if sample_flag then
        if skill_description is null or skill_description not like 'Sample.%' then
          skill_description := left(
            'Sample. ' || coalesce(skill_description, 'Review this skill before publishing.'),
            2000
          );
        end if;
      end if;
      skill_id := private.register_resource_record(
        org_id, 'skill', gen_random_uuid(), actor_membership_id
      );
      insert into public.skills (
        id,
        organisation_id,
        name,
        code,
        category,
        description,
        evidence_expectations,
        status,
        created_by_membership_id
      )
      values (
        skill_id,
        org_id,
        skill_name,
        skill_code,
        skill_category,
        skill_description,
        skill_evidence,
        'draft',
        actor_membership_id
      );
      skill_ownership := 'created';
    end if;

    staged_skills := staged_skills || jsonb_build_object(
      'id', skill_id,
      'code', skill_code,
      'name', skill_name,
      'ownership', skill_ownership
    );
  end loop;

  standard_name := private.module_setup_require_text(
    standard_json -> 'name', 'standard name', 1, 160, true
  );
  standard_code := lower(private.module_setup_require_text(
    standard_json -> 'code', 'standard code', 1, 80, true
  ));
  standard_description := private.module_setup_require_text(
    standard_json -> 'description', 'standard description', 1, 2000, false
  );
  if standard_code !~ '^[a-z0-9][a-z0-9._-]{0,79}$' then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;
  if sample_flag and (
    standard_description is null or standard_description not like 'Sample.%'
  ) then
    standard_description := left(
      'Sample. ' || coalesce(standard_description, 'Review before publishing.'),
      2000
    );
  end if;

  while exists (
    select 1
    from public.skill_capability_sets set_row
    where set_row.organisation_id = org_id
      and set_row.code = standard_code
  ) loop
    code_suffix := code_suffix + 1;
    standard_code := left(
      regexp_replace(standard_code, '-[0-9]+$', ''),
      70
    ) || '-' || code_suffix::text;
    if code_suffix > 20 then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;
  end loop;

  insert into public.skill_capability_sets (
    organisation_id, name, code, description, created_by_membership_id
  )
  values (
    org_id, standard_name, standard_code, standard_description, actor_membership_id
  )
  returning id into set_id;

  insert into public.skill_capability_set_versions (
    organisation_id, capability_set_id, version_number, status, created_by_membership_id
  )
  values (org_id, set_id, 1, 'draft', actor_membership_id)
  returning id into set_version_id;

  select coalesce(jsonb_object_agg(lower(level_row.label), level_row.id), '{}'::jsonb)
  into level_map
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = org_id
    and level_row.scale_version_id = scale_version_id;

  for requirement_item in
    select value from jsonb_array_elements(requirements_json)
  loop
    perform private.module_setup_require_object(requirement_item, 'requirement');
    requirement_code := lower(private.module_setup_require_text(
      requirement_item -> 'skill_code', 'requirement skill', 1, 80, true
    ));
    select (staged.item ->> 'id')::uuid
    into requirement_skill_id
    from jsonb_array_elements(staged_skills) staged(item)
    where staged.item ->> 'code' = requirement_code
    limit 1;
    if requirement_skill_id is null then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;

    requirement_job_function_id := private.skills_setup_uuid(
      requirement_item ->> 'job_function_id', true
    );
    if not exists (
      select 1
      from public.job_functions job_function_row
      where job_function_row.organisation_id = org_id
        and job_function_row.id = requirement_job_function_id
        and job_function_row.status = 'active'
    ) then
      raise exception 'job function is not in this organisation'
        using errcode = '22023';
    end if;

    requirement_unit_id := private.skills_setup_uuid(
      requirement_item ->> 'organisational_unit_id', false
    );
    if applicability_text = 'organisation' then
      requirement_unit_id := null;
    end if;
    if requirement_unit_id is not null and not exists (
      select 1
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.id = requirement_unit_id
        and unit_row.status = 'active'
    ) then
      raise exception 'organisational unit is not in this organisation'
        using errcode = '22023';
    end if;

    requirement_level_label := lower(private.module_setup_require_text(
      requirement_item -> 'level_label', 'requirement level', 1, 120, true
    ));
    requirement_level_id := (level_map ->> requirement_level_label)::uuid;
    if requirement_level_id is null then
      raise exception 'module setup definition is invalid'
        using errcode = '22023';
    end if;

    requirement_evidence := private.module_setup_require_text(
      requirement_item -> 'evidence_requirement', 'evidence requirement', 1, 2000, false
    );
    requirement_notes := private.module_setup_require_text(
      requirement_item -> 'notes', 'requirement notes', 1, 2000, false
    );
    if sample_flag and (
      requirement_notes is null or requirement_notes not like 'Sample.%'
    ) then
      requirement_notes := left(
        'Sample. ' || coalesce(requirement_notes, 'Review this requirement before publishing.'),
        2000
      );
    end if;

    insert into public.skill_requirements (
      organisation_id,
      capability_set_version_id,
      skill_id,
      job_function_id,
      organisational_unit_id,
      proficiency_scale_version_id,
      target_proficiency_level_id,
      mandatory,
      evidence_requirement,
      notes
    )
    values (
      org_id,
      set_version_id,
      requirement_skill_id,
      requirement_job_function_id,
      requirement_unit_id,
      scale_version_id,
      requirement_level_id,
      coalesce((requirement_item ->> 'mandatory')::boolean, true),
      requirement_evidence,
      requirement_notes
    )
    returning id into requirement_id;

    staged_requirements := staged_requirements || jsonb_build_object(
      'id', requirement_id,
      'label', left(requirement_code, 160)
    );
  end loop;

  insert into public.skill_setup_bundles (
    organisation_id,
    source,
    template_key,
    template_version,
    title,
    status,
    idempotency_key,
    applicability,
    sample,
    unresolved,
    scale_id,
    scale_version_id,
    capability_set_id,
    capability_set_version_id,
    created_by_membership_id
  )
  values (
    org_id,
    source_text,
    template_key,
    template_version,
    title_text,
    'draft',
    target_idempotency_key,
    applicability_text,
    sample_flag,
    unresolved_json,
    scale_id,
    scale_version_id,
    set_id,
    set_version_id,
    actor_membership_id
  )
  returning id into bundle_id;

  insert into public.skill_setup_bundle_items (
    organisation_id, bundle_id, record_kind, record_id, ownership, label
  )
  select
    org_id,
    bundle_id,
    'requirement',
    (staged.item ->> 'id')::uuid,
    'created',
    staged.item ->> 'label'
  from jsonb_array_elements(staged_requirements) staged(item);

  insert into public.skill_setup_bundle_items (
    organisation_id, bundle_id, record_kind, record_id, ownership, label
  )
  values
    (org_id, bundle_id, 'scale', scale_id, scale_ownership, left(scale_name, 160)),
    (org_id, bundle_id, 'capability_set', set_id, 'created', left(standard_name, 160));

  insert into public.skill_setup_bundle_items (
    organisation_id, bundle_id, record_kind, record_id, ownership, label
  )
  select
    org_id,
    bundle_id,
    'skill',
    (staged.item ->> 'id')::uuid,
    staged.item ->> 'ownership',
    left(staged.item ->> 'name', 160)
  from jsonb_array_elements(staged_skills) staged(item);

  return bundle_id;
end;
$$;

create or replace function private.publish_skill_setup_bundle(
  target_bundle_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  bundle_row public.skill_setup_bundles%rowtype;
  scale_status text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  select bundle.*
  into bundle_row
  from public.skill_setup_bundles bundle
  where bundle.organisation_id = org_id
    and bundle.id = target_bundle_id
  for update;

  if not found then
    raise exception 'skill setup bundle was not found'
      using errcode = 'P0002';
  end if;

  if bundle_row.status = 'published' then
    return true;
  end if;

  if bundle_row.status = 'discarded' then
    raise exception 'discarded setup bundles cannot be published'
      using errcode = '22023';
  end if;

  update public.skills skill_row
  set status = 'active', updated_at = statement_timestamp()
  where skill_row.organisation_id = org_id
    and skill_row.status = 'draft'
    and skill_row.id in (
      select item_row.record_id
      from public.skill_setup_bundle_items item_row
      where item_row.organisation_id = org_id
        and item_row.bundle_id = bundle_row.id
        and item_row.record_kind = 'skill'
        and item_row.ownership = 'created'
    );

  select version_row.status
  into scale_status
  from public.skill_proficiency_scale_versions version_row
  where version_row.organisation_id = org_id
    and version_row.id = bundle_row.scale_version_id;

  if scale_status = 'draft' then
    perform private.publish_skill_proficiency_scale_version(bundle_row.scale_version_id);
  end if;

  perform private.publish_skill_capability_set_version(
    bundle_row.capability_set_version_id
  );

  update public.skill_setup_bundles bundle
  set status = 'published', published_at = statement_timestamp()
  where bundle.organisation_id = org_id
    and bundle.id = bundle_row.id;

  return true;
end;
$$;

create or replace function private.preview_skill_setup_bundle_discard(
  target_bundle_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  bundle_row public.skill_setup_bundles%rowtype;
  item_row public.skill_setup_bundle_items%rowtype;
  removed jsonb := '[]'::jsonb;
  retained jsonb := '[]'::jsonb;
  reason text;
  skill_status text;
  version_status text;
begin
  if org_id is null or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  select bundle.*
  into bundle_row
  from public.skill_setup_bundles bundle
  where bundle.organisation_id = org_id
    and bundle.id = target_bundle_id;

  if not found then
    raise exception 'skill setup bundle was not found'
      using errcode = 'P0002';
  end if;

  if bundle_row.status <> 'draft' then
    return jsonb_build_object(
      'bundle_id', bundle_row.id,
      'status', bundle_row.status,
      'removed', '[]'::jsonb,
      'retained', jsonb_build_array(
        jsonb_build_object(
          'kind', 'bundle',
          'id', bundle_row.id,
          'label', bundle_row.title,
          'reason', case
            when bundle_row.status = 'published' then 'published configuration is kept'
            else 'already discarded'
          end
        )
      )
    );
  end if;

  for item_row in
    select item.*
    from public.skill_setup_bundle_items item
    where item.organisation_id = org_id
      and item.bundle_id = bundle_row.id
    order by item.record_kind, item.label
  loop
    reason := null;
    if item_row.ownership = 'reused' then
      reason := 'reused record';
    elsif item_row.record_kind = 'skill' then
      select skill_row.status
      into skill_status
      from public.skills skill_row
      where skill_row.organisation_id = org_id
        and skill_row.id = item_row.record_id;
      if skill_status is distinct from 'draft' then
        reason := 'already active';
      else
        reason := private.skills_setup_skill_retain_reason(
          org_id, item_row.record_id, bundle_row.capability_set_version_id
        );
      end if;
    elsif item_row.record_kind = 'scale' then
      select version_row.status
      into version_status
      from public.skill_proficiency_scale_versions version_row
      where version_row.organisation_id = org_id
        and version_row.id = bundle_row.scale_version_id;
      if version_status is distinct from 'draft' then
        reason := 'published or archived scale';
      elsif exists (
        select 1
        from public.membership_skill_assessments assessment_row
        where assessment_row.organisation_id = org_id
          and assessment_row.proficiency_scale_version_id = bundle_row.scale_version_id
      ) or exists (
        select 1
        from public.skill_requirements requirement_row
        where requirement_row.organisation_id = org_id
          and requirement_row.proficiency_scale_version_id = bundle_row.scale_version_id
          and requirement_row.capability_set_version_id
            is distinct from bundle_row.capability_set_version_id
      ) then
        reason := 'assessment or requirement history';
      end if;
    elsif item_row.record_kind = 'capability_set' then
      select version_row.status
      into version_status
      from public.skill_capability_set_versions version_row
      where version_row.organisation_id = org_id
        and version_row.id = bundle_row.capability_set_version_id;
      if version_status is distinct from 'draft' then
        reason := 'published capability standard';
      end if;
    end if;

    if reason is null and item_row.record_kind = 'requirement' then
      removed := removed || jsonb_build_array(
        jsonb_build_object(
          'kind', item_row.record_kind,
          'id', item_row.record_id,
          'label', item_row.label
        )
      );
    elsif reason is null then
      removed := removed || jsonb_build_array(
        jsonb_build_object(
          'kind', item_row.record_kind,
          'id', item_row.record_id,
          'label', item_row.label
        )
      );
    else
      retained := retained || jsonb_build_array(
        jsonb_build_object(
          'kind', item_row.record_kind,
          'id', item_row.record_id,
          'label', item_row.label,
          'reason', reason
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'bundle_id', bundle_row.id,
    'status', bundle_row.status,
    'removed', removed,
    'retained', retained
  );
end;
$$;

create or replace function private.discard_skill_setup_bundle(
  target_bundle_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  bundle_row public.skill_setup_bundles%rowtype;
  preview jsonb;
  removed_item jsonb;
  skill_id uuid;
begin
  if org_id is null or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  select bundle.*
  into bundle_row
  from public.skill_setup_bundles bundle
  where bundle.organisation_id = org_id
    and bundle.id = target_bundle_id
  for update;

  if not found then
    raise exception 'skill setup bundle was not found'
      using errcode = 'P0002';
  end if;

  if bundle_row.status = 'published' then
    raise exception 'published setup bundles are kept'
      using errcode = '22023';
  end if;

  if bundle_row.status = 'discarded' then
    return private.preview_skill_setup_bundle_discard(target_bundle_id);
  end if;

  preview := private.preview_skill_setup_bundle_discard(target_bundle_id);

  delete from public.skill_requirements requirement_row
  where requirement_row.organisation_id = org_id
    and requirement_row.capability_set_version_id = bundle_row.capability_set_version_id
    and requirement_row.id in (
      select item_row.record_id
      from public.skill_setup_bundle_items item_row
      where item_row.organisation_id = org_id
        and item_row.bundle_id = bundle_row.id
        and item_row.record_kind = 'requirement'
        and item_row.ownership = 'created'
    );

  for removed_item in
    select value
    from jsonb_array_elements(coalesce(preview -> 'removed', '[]'::jsonb))
  loop
    if removed_item ->> 'kind' <> 'skill' then
      continue;
    end if;
    skill_id := (removed_item ->> 'id')::uuid;
    if private.skills_setup_skill_retain_reason(
      org_id, skill_id, bundle_row.capability_set_version_id
    ) is not null then
      continue;
    end if;
    delete from public.skills skill_row
    where skill_row.organisation_id = org_id
      and skill_row.id = skill_id
      and skill_row.status = 'draft';
    update public.resource_records resource_row
    set retired_at = statement_timestamp()
    where resource_row.organisation_id = org_id
      and resource_row.id = skill_id
      and resource_row.retired_at is null
      and not exists (
        select 1
        from public.skills still_there
        where still_there.organisation_id = org_id
          and still_there.id = skill_id
      );
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(preview -> 'removed', '[]'::jsonb)) removed(item)
    where removed.item ->> 'kind' = 'scale'
  ) and not exists (
    select 1
    from public.skill_requirements requirement_row
    where requirement_row.organisation_id = org_id
      and requirement_row.proficiency_scale_version_id = bundle_row.scale_version_id
  ) and not exists (
    select 1
    from public.membership_skill_assessments assessment_row
    where assessment_row.organisation_id = org_id
      and assessment_row.proficiency_scale_version_id = bundle_row.scale_version_id
  ) then
    update public.skill_setup_bundles bundle
    set scale_id = null, scale_version_id = null
    where bundle.organisation_id = org_id
      and bundle.id = bundle_row.id;
    delete from public.skill_proficiency_levels level_row
    where level_row.organisation_id = org_id
      and level_row.scale_version_id = bundle_row.scale_version_id;
    delete from public.skill_proficiency_scale_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = bundle_row.scale_version_id
      and version_row.status = 'draft';
    delete from public.skill_proficiency_scales scale_row
    where scale_row.organisation_id = org_id
      and scale_row.id = bundle_row.scale_id
      and not exists (
        select 1
        from public.skill_proficiency_scale_versions version_row
        where version_row.organisation_id = org_id
          and version_row.scale_id = scale_row.id
      );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(preview -> 'removed', '[]'::jsonb)) removed(item)
    where removed.item ->> 'kind' = 'capability_set'
  ) then
    update public.skill_setup_bundles bundle
    set capability_set_id = null, capability_set_version_id = null
    where bundle.organisation_id = org_id
      and bundle.id = bundle_row.id
      and exists (
        select 1
        from public.skill_capability_set_versions version_row
        where version_row.organisation_id = org_id
          and version_row.id = bundle_row.capability_set_version_id
          and version_row.status = 'draft'
      );
    delete from public.skill_capability_set_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = bundle_row.capability_set_version_id
      and version_row.status = 'draft'
      and not exists (
        select 1
        from public.skill_requirements requirement_row
        where requirement_row.organisation_id = org_id
          and requirement_row.capability_set_version_id = version_row.id
      );
    delete from public.skill_capability_sets set_row
    where set_row.organisation_id = org_id
      and set_row.id = bundle_row.capability_set_id
      and not exists (
        select 1
        from public.skill_capability_set_versions version_row
        where version_row.organisation_id = org_id
          and version_row.capability_set_id = set_row.id
      );
  end if;

  update public.skill_setup_bundles bundle
  set status = 'discarded', discarded_at = statement_timestamp()
  where bundle.organisation_id = org_id
    and bundle.id = bundle_row.id;

  return preview || jsonb_build_object('status', 'discarded');
end;
$$;

create or replace function private.save_skill_setup_preparation(
  target_source text,
  target_template_key text,
  target_state jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  preparation_id uuid;
  template_key text := coalesce(target_template_key, '');
begin
  if org_id is null
    or actor_membership_id is null
    or not private.skills_setup_authorised(org_id) then
    raise exception 'skill setup draft is not authorised'
      using errcode = '42501';
  end if;

  if target_source not in ('manual', 'quick_start', 'leanai')
    or char_length(template_key) > 80
    or target_state is null
    or pg_catalog.jsonb_typeof(target_state) is distinct from 'object'
    or octet_length(target_state::text) > 100000 then
    raise exception 'module setup definition is invalid'
      using errcode = '22023';
  end if;

  insert into public.skill_setup_preparations (
    organisation_id, membership_id, source, template_key, state
  )
  values (org_id, actor_membership_id, target_source, template_key, target_state)
  on conflict on constraint skill_setup_preparations_identity_key
  do update set state = excluded.state, updated_at = statement_timestamp()
  returning id into preparation_id;

  return preparation_id;
end;
$$;

create or replace function private.reject_draft_skill_assessment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.skills skill_row
    where skill_row.organisation_id = new.organisation_id
      and skill_row.id = new.skill_id
      and skill_row.status = 'draft'
  ) then
    raise exception 'draft skills cannot be assessed'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger membership_skill_assessments_reject_draft_skill
before insert on public.membership_skill_assessments
for each row execute function private.reject_draft_skill_assessment();

create or replace function public.create_skill_setup_draft(
  target_idempotency_key text,
  target_definition jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_skill_setup_draft(target_idempotency_key, target_definition)
$$;

create or replace function public.publish_skill_setup_bundle(
  target_bundle_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.publish_skill_setup_bundle(target_bundle_id)
$$;

create or replace function public.preview_skill_setup_bundle_discard(
  target_bundle_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.preview_skill_setup_bundle_discard(target_bundle_id)
$$;

create or replace function public.discard_skill_setup_bundle(
  target_bundle_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.discard_skill_setup_bundle(target_bundle_id)
$$;

create or replace function public.save_skill_setup_preparation(
  target_source text,
  target_template_key text,
  target_state jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.save_skill_setup_preparation(
    target_source, target_template_key, target_state
  )
$$;

comment on function public.discard_skill_setup_bundle(uuid) is
  'Removes eligible records owned by one unpublished Skills setup bundle. Not an organisation reset.';

alter function private.skills_setup_authorised(uuid) owner to lean_hub_private_owner;
alter function private.skills_setup_uuid(text, boolean) owner to lean_hub_private_owner;
alter function private.skills_setup_skill_retain_reason(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.create_skill_setup_draft(text, jsonb) owner to lean_hub_private_owner;
alter function private.publish_skill_setup_bundle(uuid) owner to lean_hub_private_owner;
alter function private.preview_skill_setup_bundle_discard(uuid) owner to lean_hub_private_owner;
alter function private.discard_skill_setup_bundle(uuid) owner to lean_hub_private_owner;
alter function private.save_skill_setup_preparation(text, text, jsonb) owner to lean_hub_private_owner;
alter function private.reject_draft_skill_assessment() owner to lean_hub_private_owner;

revoke all on function private.skills_setup_authorised(uuid) from public, anon;
revoke all on function private.skills_setup_uuid(text, boolean) from public, anon;
revoke all on function private.skills_setup_skill_retain_reason(uuid, uuid, uuid) from public, anon;
revoke all on function private.create_skill_setup_draft(text, jsonb) from public, anon;
revoke all on function private.publish_skill_setup_bundle(uuid) from public, anon;
revoke all on function private.preview_skill_setup_bundle_discard(uuid) from public, anon;
revoke all on function private.discard_skill_setup_bundle(uuid) from public, anon;
revoke all on function private.save_skill_setup_preparation(text, text, jsonb) from public, anon;
revoke all on function private.reject_draft_skill_assessment() from public, anon;
revoke all on function public.create_skill_setup_draft(text, jsonb) from public, anon;
revoke all on function public.publish_skill_setup_bundle(uuid) from public, anon;
revoke all on function public.preview_skill_setup_bundle_discard(uuid) from public, anon;
revoke all on function public.discard_skill_setup_bundle(uuid) from public, anon;
revoke all on function public.save_skill_setup_preparation(text, text, jsonb) from public, anon;

grant execute on function private.skills_setup_authorised(uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.skills_setup_uuid(text, boolean) to authenticated, lean_hub_private_owner;
grant execute on function private.skills_setup_skill_retain_reason(uuid, uuid, uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.create_skill_setup_draft(text, jsonb) to authenticated, lean_hub_private_owner;
grant execute on function private.publish_skill_setup_bundle(uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.preview_skill_setup_bundle_discard(uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.discard_skill_setup_bundle(uuid) to authenticated, lean_hub_private_owner;
grant execute on function private.save_skill_setup_preparation(text, text, jsonb) to authenticated, lean_hub_private_owner;
grant execute on function public.create_skill_setup_draft(text, jsonb) to authenticated;
grant execute on function public.publish_skill_setup_bundle(uuid) to authenticated;
grant execute on function public.preview_skill_setup_bundle_discard(uuid) to authenticated;
grant execute on function public.discard_skill_setup_bundle(uuid) to authenticated;
grant execute on function public.save_skill_setup_preparation(text, text, jsonb) to authenticated;

