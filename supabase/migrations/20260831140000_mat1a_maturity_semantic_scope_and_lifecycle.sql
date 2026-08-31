-- MAT1a: semantic assessment scope, framework lifecycle hardening, assessor notes.

create table public.maturity_model_version_assessment_scopes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  model_version_id uuid not null,
  scope_type text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_model_version_assessment_scopes_org_id_key
    unique (organisation_id, id),
  constraint maturity_model_version_assessment_scopes_version_scope_key
    unique (organisation_id, model_version_id, scope_type),
  constraint maturity_model_version_assessment_scopes_version_fkey
    foreign key (organisation_id, model_version_id)
    references public.maturity_model_versions(organisation_id, id)
    on delete restrict,
  constraint maturity_model_version_assessment_scopes_scope_type_check
    check (scope_type in ('site', 'organisation', 'department', 'area'))
);

create index maturity_model_version_assessment_scopes_version_idx
  on public.maturity_model_version_assessment_scopes (organisation_id, model_version_id);

alter table public.maturity_assessments
  add column assessment_scope_type text;

alter table public.maturity_assessments
  add constraint maturity_assessments_scope_type_check
    check (
      assessment_scope_type is null
      or assessment_scope_type in ('site', 'organisation', 'department', 'area')
    );

create table public.maturity_assessment_criterion_notes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assessment_id uuid not null,
  criterion_id uuid not null,
  comment_text text not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint maturity_assessment_criterion_notes_org_id_key
    unique (organisation_id, id),
  constraint maturity_assessment_criterion_notes_assessment_criterion_key
    unique (organisation_id, assessment_id, criterion_id),
  constraint maturity_assessment_criterion_notes_assessment_fkey
    foreign key (organisation_id, assessment_id)
    references public.maturity_assessments(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_criterion_notes_criterion_fkey
    foreign key (organisation_id, criterion_id)
    references public.maturity_criteria(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_criterion_notes_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_criterion_notes_comment_check
    check (
      comment_text = btrim(comment_text)
      and char_length(comment_text) between 1 and 8000
    )
);

create index maturity_assessment_criterion_notes_assessment_idx
  on public.maturity_assessment_criterion_notes (organisation_id, assessment_id);

create trigger maturity_assessment_criterion_notes_touch_updated_at
before update on public.maturity_assessment_criterion_notes
for each row execute function private.touch_updated_at();

create trigger maturity_assessment_criterion_notes_guard_immutable
before update or delete on public.maturity_assessment_criterion_notes
for each row execute function private.guard_maturity_assessment_context_immutable();

create or replace function private.normalise_organisation_unit_semantic_scope(
  target_unit_type text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(target_unit_type))
    when 'site' then 'site'
    when 'plant' then 'site'
    when 'facility' then 'site'
    when 'factory' then 'site'
    when 'location' then 'site'
    when 'organisation' then 'organisation'
    when 'organization' then 'organisation'
    when 'org' then 'organisation'
    when 'company' then 'organisation'
    when 'enterprise' then 'organisation'
    when 'group' then 'organisation'
    when 'department' then 'department'
    when 'dept' then 'department'
    when 'division' then 'department'
    when 'area' then 'area'
    when 'zone' then 'area'
    when 'section' then 'area'
    when 'cell' then 'area'
    else null
  end
$$;

-- Backfill default site scope for existing framework versions.
insert into public.maturity_model_version_assessment_scopes (
  organisation_id,
  model_version_id,
  scope_type
)
select
  model_version.organisation_id,
  model_version.id,
  'site'
from public.maturity_model_versions model_version
on conflict (organisation_id, model_version_id, scope_type) do nothing;

-- Backfill assessment scope type from unit semantics where possible.
update public.maturity_assessments assessment_row
set assessment_scope_type = private.normalise_organisation_unit_semantic_scope(
  organisation_unit.unit_type
)
from public.organisation_units organisation_unit
where organisation_unit.organisation_id = assessment_row.organisation_id
  and organisation_unit.id = assessment_row.unit_id
  and assessment_row.assessment_scope_type is null;

update public.maturity_assessments
set assessment_scope_type = 'site'
where assessment_scope_type is null;

alter table public.maturity_assessments
  alter column assessment_scope_type set not null;

create or replace function private.organisation_unit_matches_semantic_scope(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_scope_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_units organisation_unit
    where organisation_unit.organisation_id = target_organisation_id
      and organisation_unit.id = target_unit_id
      and organisation_unit.status = 'active'
      and private.normalise_organisation_unit_semantic_scope(
        organisation_unit.unit_type
      ) = target_scope_type
  )
$$;

create or replace function private.maturity_model_version_allows_scope(
  target_organisation_id uuid,
  target_model_version_id uuid,
  target_scope_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.maturity_model_version_assessment_scopes scope_row
    where scope_row.organisation_id = target_organisation_id
      and scope_row.model_version_id = target_model_version_id
      and scope_row.scope_type = target_scope_type
  )
$$;

create or replace function private.set_maturity_model_version_assessment_scopes(
  target_model_version_id uuid,
  target_scope_types text[]
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
  scope_type text;
  normalised_scopes text[] := '{}'::text[];
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity scope configuration is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.maturity_model_versions model_version
    where model_version.organisation_id = org_id
      and model_version.id = target_model_version_id
      and model_version.status = 'draft'
  ) then
    raise exception 'maturity model version is not editable'
      using errcode = '55000';
  end if;

  if coalesce(array_length(target_scope_types, 1), 0) = 0 then
    raise exception 'at least one assessment scope type is required'
      using errcode = '22023';
  end if;

  foreach scope_type in array target_scope_types
  loop
    if scope_type not in ('site', 'organisation', 'department', 'area') then
      raise exception 'invalid assessment scope type'
        using errcode = '22023';
    end if;
    if not scope_type = any(normalised_scopes) then
      normalised_scopes := array_append(normalised_scopes, scope_type);
    end if;
  end loop;

  delete from public.maturity_model_version_assessment_scopes scope_row
  where scope_row.organisation_id = org_id
    and scope_row.model_version_id = target_model_version_id;

  foreach scope_type in array normalised_scopes
  loop
    insert into public.maturity_model_version_assessment_scopes (
      organisation_id,
      model_version_id,
      scope_type
    )
    values (org_id, target_model_version_id, scope_type);
  end loop;

  perform private.append_business_audit(
    org_id,
    'maturity.model.scopes_updated',
    (
      select model_id
      from public.maturity_model_versions
      where organisation_id = org_id
        and id = target_model_version_id
    ),
    'succeeded',
    jsonb_build_object(
      'model_version_id', target_model_version_id,
      'scope_types', to_jsonb(normalised_scopes)
    )
  );

  return true;
end;
$$;

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
begin
  if org_id is null
    or not private.can_read_maturity_catalog(org_id) then
    raise exception 'maturity scope listing is not authorised'
      using errcode = '42501';
  end if;

  if target_scope_type not in ('site', 'organisation', 'department', 'area') then
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
  order by organisation_unit.name;
end;
$$;

create or replace function private.deactivate_maturity_model_version(
  target_model_version_id uuid
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
  target_model_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model deactivation is not authorised'
      using errcode = '42501';
  end if;

  update public.maturity_model_versions model_version
  set status = 'archived',
      archived_at = statement_timestamp()
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'published'
  returning model_version.model_id into target_model_id;

  if target_model_id is null then
    raise exception 'maturity model version is not deactivatable'
      using errcode = '55000';
  end if;

  perform private.append_business_audit(
    org_id,
    'maturity.model.deactivated',
    target_model_id,
    'succeeded',
    jsonb_build_object('model_version_id', target_model_version_id)
  );

  return true;
end;
$$;

create or replace function private.delete_maturity_model_draft_version(
  target_model_version_id uuid
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
  target_model_id uuid;
  target_template_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity draft deletion is not authorised'
      using errcode = '42501';
  end if;

  select
    model_version.model_id,
    model_version.template_version_id
  into target_model_id, target_template_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'draft'
  for update;

  if target_model_id is null then
    raise exception 'maturity draft version was not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.maturity_assessments assessment_row
    where assessment_row.organisation_id = org_id
      and assessment_row.model_version_id = target_model_version_id
  ) then
    raise exception 'draft version is referenced by assessments and cannot be deleted'
      using errcode = '55000';
  end if;

  delete from public.maturity_model_version_assessment_scopes scope_row
  where scope_row.organisation_id = org_id
    and scope_row.model_version_id = target_model_version_id;

  delete from public.maturity_criterion_questions question_link
  where question_link.organisation_id = org_id
    and question_link.criterion_id in (
      select criterion_row.id
      from public.maturity_criteria criterion_row
      join public.maturity_pillars pillar_row
        on pillar_row.organisation_id = criterion_row.organisation_id
       and pillar_row.id = criterion_row.pillar_id
      where pillar_row.organisation_id = org_id
        and pillar_row.model_version_id = target_model_version_id
    );

  delete from public.maturity_criteria criterion_row
  where criterion_row.organisation_id = org_id
    and criterion_row.pillar_id in (
      select pillar_row.id
      from public.maturity_pillars pillar_row
      where pillar_row.organisation_id = org_id
        and pillar_row.model_version_id = target_model_version_id
    );

  delete from public.maturity_pillars pillar_row
  where pillar_row.organisation_id = org_id
    and pillar_row.model_version_id = target_model_version_id;

  delete from public.maturity_levels level_row
  where level_row.organisation_id = org_id
    and level_row.model_version_id = target_model_version_id;

  delete from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id;

  delete from public.template_questions question_row
  where question_row.organisation_id = org_id
    and question_row.template_version_id = target_template_version_id;

  delete from public.template_sections section_row
  where section_row.organisation_id = org_id
    and section_row.template_version_id = target_template_version_id;

  delete from public.template_versions template_version
  where template_version.organisation_id = org_id
    and template_version.id = target_template_version_id;

  perform private.append_business_audit(
    org_id,
    'maturity.model.draft_deleted',
    target_model_id,
    'succeeded',
    jsonb_build_object('model_version_id', target_model_version_id)
  );

  return true;
end;
$$;

create or replace function private.upsert_maturity_assessment_criterion_note(
  target_assessment_id uuid,
  target_criterion_id uuid,
  target_comment_text text
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
  note_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_maturity_assessment(org_id, target_assessment_id) then
    raise exception 'maturity assessment note upsert is not authorised'
      using errcode = '42501';
  end if;

  if btrim(coalesce(target_comment_text, '')) = '' then
    raise exception 'assessor comment cannot be empty'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.maturity_assessments assessment_row
    join public.maturity_model_versions model_version
      on model_version.organisation_id = assessment_row.organisation_id
     and model_version.id = assessment_row.model_version_id
    join public.maturity_criteria criterion_row
      on criterion_row.organisation_id = assessment_row.organisation_id
     and criterion_row.id = target_criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
     and pillar_row.model_version_id = model_version.id
    where assessment_row.organisation_id = org_id
      and assessment_row.id = target_assessment_id
  ) then
    raise exception 'criterion does not belong to assessment framework version'
      using errcode = '23503';
  end if;

  insert into public.maturity_assessment_criterion_notes (
    organisation_id,
    assessment_id,
    criterion_id,
    comment_text,
    created_by_membership_id
  )
  values (
    org_id,
    target_assessment_id,
    target_criterion_id,
    btrim(target_comment_text),
    actor_membership_id
  )
  on conflict (organisation_id, assessment_id, criterion_id)
  do update
  set comment_text = excluded.comment_text,
      updated_at = statement_timestamp()
  returning id into note_id;

  return note_id;
end;
$$;

create or replace function private.create_maturity_model_draft(
  target_display_name text,
  target_description text default null
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
  new_model_id uuid;
  new_template_id uuid;
  new_template_version_id uuid;
  new_model_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model creation is not authorised'
      using errcode = '42501';
  end if;

  new_model_id := private.register_resource_record(
    org_id,
    'maturity_model',
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
    id,
    organisation_id,
    experience_type,
    display_name,
    description,
    created_by_membership_id
  )
  values (
    new_template_id,
    org_id,
    'maturity_assessment',
    target_display_name,
    target_description,
    actor_membership_id
  );

  insert into public.maturity_models (
    id,
    organisation_id,
    template_id,
    display_name,
    description,
    created_by_membership_id
  )
  values (
    new_model_id,
    org_id,
    new_template_id,
    target_display_name,
    target_description,
    actor_membership_id
  );

  insert into public.template_versions (
    organisation_id,
    template_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    new_template_id,
    1,
    'draft',
    actor_membership_id
  )
  returning id into new_template_version_id;

  insert into public.maturity_model_versions (
    organisation_id,
    model_id,
    template_version_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    new_model_id,
    new_template_version_id,
    1,
    'draft',
    actor_membership_id
  )
  returning id into new_model_version_id;

  insert into public.maturity_model_version_assessment_scopes (
    organisation_id,
    model_version_id,
    scope_type
  )
  values (org_id, new_model_version_id, 'site');

  perform private.append_business_audit(
    org_id,
    'maturity.model.created',
    new_model_id,
    'succeeded',
    jsonb_build_object('template_id', new_template_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    new_model_id,
    'MaturityModelCreated',
    new_model_id::text,
    jsonb_build_object('model_id', new_model_id)
  );

  return new_model_id;
end;
$$;

create or replace function private.publish_maturity_model_version(
  target_model_version_id uuid
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
  target_model_id uuid;
  template_version_id uuid;
  scored_link record;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model publication is not authorised'
      using errcode = '42501';
  end if;

  select model_version.model_id, model_version.template_version_id
  into target_model_id, template_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'draft'
  for update;

  if not found then
    raise exception 'maturity model version is not publishable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_levels level_row
    where level_row.organisation_id = org_id
      and level_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one level'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_pillars pillar_row
    where pillar_row.organisation_id = org_id
      and pillar_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one pillar'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.maturity_model_version_assessment_scopes scope_row
    where scope_row.organisation_id = org_id
      and scope_row.model_version_id = target_model_version_id
  ) then
    raise exception 'maturity model version requires at least one assessment scope'
      using errcode = '55000';
  end if;

  for scored_link in
    select
      question_link.scoring_metadata,
      question_row.question_type
    from public.maturity_criterion_questions question_link
    join public.maturity_criteria criterion_row
      on criterion_row.organisation_id = question_link.organisation_id
     and criterion_row.id = question_link.criterion_id
    join public.maturity_pillars pillar_row
      on pillar_row.organisation_id = criterion_row.organisation_id
     and pillar_row.id = criterion_row.pillar_id
     and pillar_row.model_version_id = target_model_version_id
    join public.template_questions question_row
      on question_row.organisation_id = question_link.organisation_id
     and question_row.id = question_link.question_id
    where question_link.organisation_id = org_id
      and question_link.contributes_to_score = true
  loop
    if not private.validate_scored_question_metadata(
      scored_link.question_type,
      scored_link.scoring_metadata
    ) then
      raise exception 'scored question has invalid scoring metadata'
        using errcode = '55000';
    end if;
  end loop;

  update public.maturity_model_versions prior_version
  set status = 'archived',
      archived_at = statement_timestamp()
  where prior_version.organisation_id = org_id
    and prior_version.model_id = target_model_id
    and prior_version.status = 'published'
    and prior_version.id <> target_model_version_id;

  update public.maturity_model_versions
  set status = 'published',
      published_by_membership_id = actor_membership_id,
      published_at = statement_timestamp()
  where organisation_id = org_id
    and id = target_model_version_id;

  perform private.publish_template_version_internal(
    template_version_id,
    org_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.model.published',
    target_model_id,
    'succeeded',
    jsonb_build_object('model_version_id', target_model_version_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_model_id,
    'MaturityModelPublished',
    target_model_version_id::text,
    jsonb_build_object('model_version_id', target_model_version_id)
  );

  return true;
end;
$$;

create or replace function private.start_maturity_assessment(
  target_model_version_id uuid,
  target_unit_id uuid,
  target_assessment_type text,
  target_assessment_scope_type text,
  target_lead_assessor_membership_id uuid default null
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
  permission_key text;
  template_version_id uuid;
  new_assessment_id uuid;
  new_submission_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'maturity assessment start is not authorised'
      using errcode = '42501';
  end if;

  if target_assessment_type not in ('self', 'formal') then
    raise exception 'invalid assessment type'
      using errcode = '22023';
  end if;

  if target_assessment_scope_type not in ('site', 'organisation', 'department', 'area') then
    raise exception 'invalid assessment scope type'
      using errcode = '22023';
  end if;

  permission_key := case target_assessment_type
    when 'self' then 'maturity.assess.self'
    else 'maturity.assess.formal'
  end;

  if not private.has_scoped_permission(org_id, permission_key, null, target_unit_id)
    and not private.has_scoped_permission(org_id, permission_key, actor_membership_id, null) then
    raise exception 'maturity assessment start is not authorised'
      using errcode = '42501';
  end if;

  select model_version.template_version_id
  into template_version_id
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.id = target_model_version_id
    and model_version.status = 'published';

  if template_version_id is null then
    raise exception 'maturity model version is not published'
      using errcode = '55000';
  end if;

  if not private.maturity_model_version_allows_scope(
    org_id,
    target_model_version_id,
    target_assessment_scope_type
  ) then
    raise exception 'assessment scope type is not enabled for framework version'
      using errcode = '55000';
  end if;

  if not private.organisation_unit_matches_semantic_scope(
    org_id,
    target_unit_id,
    target_assessment_scope_type
  ) then
    raise exception 'selected unit does not match requested assessment scope type'
      using errcode = '55000';
  end if;

  new_assessment_id := private.register_resource_record(
    org_id,
    'maturity_assessment',
    gen_random_uuid(),
    actor_membership_id
  );

  new_submission_id := private.register_resource_record(
    org_id,
    'template_submission',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.template_submissions (
    id,
    organisation_id,
    template_version_id,
    created_by_membership_id
  )
  values (
    new_submission_id,
    org_id,
    template_version_id,
    actor_membership_id
  );

  insert into public.maturity_assessments (
    id,
    organisation_id,
    assessment_type,
    status,
    unit_id,
    model_version_id,
    submission_id,
    assessment_scope_type,
    lead_assessor_membership_id,
    created_by_membership_id,
    started_at
  )
  values (
    new_assessment_id,
    org_id,
    target_assessment_type,
    'in_progress',
    target_unit_id,
    target_model_version_id,
    new_submission_id,
    target_assessment_scope_type,
    target_lead_assessor_membership_id,
    actor_membership_id,
    statement_timestamp()
  );

  perform private.append_maturity_assessment_transition(
    org_id,
    new_assessment_id,
    'draft',
    'in_progress',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'maturity.assessment.started',
    new_assessment_id,
    'succeeded',
    jsonb_build_object(
      'assessment_type', target_assessment_type,
      'assessment_scope_type', target_assessment_scope_type
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    new_assessment_id,
    'AssessmentStarted',
    new_assessment_id::text,
    jsonb_build_object('assessment_id', new_assessment_id)
  );

  return new_assessment_id;
end;
$$;

-- Successor clone must copy assessment scopes.
create or replace function private.create_maturity_model_successor_version(
  target_model_id uuid
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
  new_model_version_id uuid;
  level_row record;
  pillar_row record;
  criterion_row record;
  question_link record;
  scope_row record;
  pillar_map jsonb := '{}'::jsonb;
  criterion_map jsonb := '{}'::jsonb;
  new_pillar_id uuid;
  new_criterion_id uuid;
  new_section_id uuid;
  new_question_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'maturity.models.manage', null, null) then
    raise exception 'maturity model successor creation is not authorised'
      using errcode = '42501';
  end if;

  select maturity_model.template_id
  into template_id
  from public.maturity_models maturity_model
  where maturity_model.organisation_id = org_id
    and maturity_model.id = target_model_id;

  if template_id is null then
    raise exception 'maturity model was not found'
      using errcode = '23503';
  end if;

  select model_version.id, model_version.version_number
  into source_version_id, source_version_number
  from public.maturity_model_versions model_version
  where model_version.organisation_id = org_id
    and model_version.model_id = target_model_id
    and model_version.status = 'published'
  order by model_version.version_number desc
  limit 1;

  if source_version_id is null then
    raise exception 'maturity model has no published version'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.maturity_model_versions model_version
    where model_version.organisation_id = org_id
      and model_version.model_id = target_model_id
      and model_version.status = 'draft'
  ) then
    raise exception 'maturity model already has a draft version'
      using errcode = '55000';
  end if;

  new_template_version_id := private.clone_published_template_version(template_id);

  insert into public.maturity_model_versions (
    organisation_id,
    model_id,
    template_version_id,
    version_number,
    status,
    weighting_enabled,
    created_by_membership_id
  )
  select
    org_id,
    target_model_id,
    new_template_version_id,
    source_version_number + 1,
    'draft',
    source_version.weighting_enabled,
    actor_membership_id
  from public.maturity_model_versions source_version
  where source_version.organisation_id = org_id
    and source_version.id = source_version_id
  returning id into new_model_version_id;

  for scope_row in
    select scope_item.scope_type
    from public.maturity_model_version_assessment_scopes scope_item
    where scope_item.organisation_id = org_id
      and scope_item.model_version_id = source_version_id
  loop
    insert into public.maturity_model_version_assessment_scopes (
      organisation_id,
      model_version_id,
      scope_type
    )
    values (org_id, new_model_version_id, scope_row.scope_type);
  end loop;

  for level_row in
    select level_item.*
    from public.maturity_levels level_item
    where level_item.organisation_id = org_id
      and level_item.model_version_id = source_version_id
    order by level_item.level_number
  loop
    insert into public.maturity_levels (
      organisation_id,
      model_version_id,
      level_number,
      name,
      description,
      color_token,
      guidance
    )
    values (
      org_id,
      new_model_version_id,
      level_row.level_number,
      level_row.name,
      level_row.description,
      level_row.color_token,
      level_row.guidance
    );
  end loop;

  for pillar_row in
    select pillar_item.*
    from public.maturity_pillars pillar_item
    where pillar_item.organisation_id = org_id
      and pillar_item.model_version_id = source_version_id
    order by pillar_item.position
  loop
    select section_item.id
    into new_section_id
    from public.template_sections section_item
    where section_item.organisation_id = org_id
      and section_item.template_version_id = new_template_version_id
      and section_item.position = pillar_row.position;

    insert into public.maturity_pillars (
      organisation_id,
      model_version_id,
      section_id,
      position,
      name,
      description,
      weight,
      guidance
    )
    values (
      org_id,
      new_model_version_id,
      new_section_id,
      pillar_row.position,
      pillar_row.name,
      pillar_row.description,
      pillar_row.weight,
      pillar_row.guidance
    )
    returning id into new_pillar_id;

    pillar_map := pillar_map || jsonb_build_object(pillar_row.id::text, new_pillar_id);
  end loop;

  for criterion_row in
    select criterion_item.*
    from public.maturity_criteria criterion_item
    join public.maturity_pillars pillar_item
      on pillar_item.organisation_id = criterion_item.organisation_id
     and pillar_item.id = criterion_item.pillar_id
    where criterion_item.organisation_id = org_id
      and pillar_item.model_version_id = source_version_id
    order by pillar_item.position, criterion_item.position
  loop
    insert into public.maturity_criteria (
      organisation_id,
      pillar_id,
      position,
      name,
      description,
      expected_evidence,
      guidance,
      weight
    )
    values (
      org_id,
      (pillar_map ->> criterion_row.pillar_id::text)::uuid,
      criterion_row.position,
      criterion_row.name,
      criterion_row.description,
      criterion_row.expected_evidence,
      criterion_row.guidance,
      criterion_row.weight
    )
    returning id into new_criterion_id;

    criterion_map := criterion_map || jsonb_build_object(
      criterion_row.id::text,
      new_criterion_id
    );
  end loop;

  for question_link in
    select
      link_item.*,
      question_item.position as question_position,
      section_item.position as section_position
    from public.maturity_criterion_questions link_item
    join public.template_questions question_item
      on question_item.organisation_id = link_item.organisation_id
     and question_item.id = link_item.question_id
    join public.template_sections section_item
      on section_item.organisation_id = question_item.organisation_id
     and section_item.id = question_item.section_id
    join public.maturity_criteria criterion_item
      on criterion_item.organisation_id = link_item.organisation_id
     and criterion_item.id = link_item.criterion_id
    join public.maturity_pillars pillar_item
      on pillar_item.organisation_id = criterion_item.organisation_id
     and pillar_item.id = criterion_item.pillar_id
     and pillar_item.model_version_id = source_version_id
    where link_item.organisation_id = org_id
  loop
    select question_item.id
    into new_question_id
    from public.template_questions question_item
    join public.template_sections section_item
      on section_item.organisation_id = question_item.organisation_id
     and section_item.id = question_item.section_id
    where question_item.organisation_id = org_id
      and question_item.template_version_id = new_template_version_id
      and section_item.position = question_link.section_position
      and question_item.position = question_link.question_position;

    insert into public.maturity_criterion_questions (
      organisation_id,
      criterion_id,
      question_id,
      contributes_to_score,
      scoring_metadata
    )
    values (
      org_id,
      (criterion_map ->> question_link.criterion_id::text)::uuid,
      new_question_id,
      question_link.contributes_to_score,
      question_link.scoring_metadata
    );
  end loop;

  perform private.append_business_audit(
    org_id,
    'maturity.model.successor_created',
    target_model_id,
    'succeeded',
    jsonb_build_object(
      'source_model_version_id', source_version_id,
      'new_model_version_id', new_model_version_id
    )
  );

  return new_model_version_id;
end;
$$;

-- RLS for new tables.
alter table public.maturity_model_version_assessment_scopes enable row level security;
alter table public.maturity_model_version_assessment_scopes force row level security;
alter table public.maturity_assessment_criterion_notes enable row level security;
alter table public.maturity_assessment_criterion_notes force row level security;

revoke all on public.maturity_model_version_assessment_scopes
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.maturity_model_version_assessment_scopes
  to lean_hub_private_owner;
create policy private_owner_all_maturity_model_version_assessment_scopes
on public.maturity_model_version_assessment_scopes for all to lean_hub_private_owner
using (true) with check (true);

revoke all on public.maturity_assessment_criterion_notes
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.maturity_assessment_criterion_notes
  to lean_hub_private_owner;
create policy private_owner_all_maturity_assessment_criterion_notes
on public.maturity_assessment_criterion_notes for all to lean_hub_private_owner
using (true) with check (true);

create policy maturity_model_version_assessment_scopes_select
on public.maturity_model_version_assessment_scopes for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_catalog(organisation_id)
);

create policy maturity_assessment_criterion_notes_select
on public.maturity_assessment_criterion_notes for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, assessment_id)
);

grant select on public.maturity_model_version_assessment_scopes to authenticated;
grant select on public.maturity_assessment_criterion_notes to authenticated;

-- Public wrappers.
create or replace function public.set_maturity_model_version_assessment_scopes(
  target_model_version_id uuid,
  target_scope_types text[]
)
returns boolean
language sql volatile security invoker set search_path = ''
as $$
  select private.set_maturity_model_version_assessment_scopes(
    target_model_version_id,
    target_scope_types
  )
$$;

create or replace function public.list_maturity_assessment_scope_entities(
  target_model_version_id uuid,
  target_scope_type text
)
returns table (
  unit_id uuid,
  unit_name text,
  unit_code text,
  unit_type text
)
language sql stable security invoker set search_path = ''
as $$
  select *
  from private.list_maturity_assessment_scope_entities(
    target_model_version_id,
    target_scope_type
  )
$$;

create or replace function public.deactivate_maturity_model_version(
  target_model_version_id uuid
)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.deactivate_maturity_model_version(target_model_version_id) $$;

create or replace function public.delete_maturity_model_draft_version(
  target_model_version_id uuid
)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.delete_maturity_model_draft_version(target_model_version_id) $$;

create or replace function public.upsert_maturity_assessment_criterion_note(
  target_assessment_id uuid,
  target_criterion_id uuid,
  target_comment_text text
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.upsert_maturity_assessment_criterion_note(
    target_assessment_id,
    target_criterion_id,
    target_comment_text
  )
$$;

create or replace function public.start_maturity_assessment(
  target_model_version_id uuid,
  target_unit_id uuid,
  target_assessment_type text,
  target_assessment_scope_type text,
  target_lead_assessor_membership_id uuid default null
)
returns uuid
language sql volatile security invoker set search_path = ''
as $$
  select private.start_maturity_assessment(
    target_model_version_id,
    target_unit_id,
    target_assessment_type,
    target_assessment_scope_type,
    target_lead_assessor_membership_id
  )
$$;

grant execute on function public.set_maturity_model_version_assessment_scopes(uuid, text[]) to authenticated;
grant execute on function public.list_maturity_assessment_scope_entities(uuid, text) to authenticated;
grant execute on function public.deactivate_maturity_model_version(uuid) to authenticated;
grant execute on function public.delete_maturity_model_draft_version(uuid) to authenticated;
grant execute on function public.upsert_maturity_assessment_criterion_note(uuid, uuid, text) to authenticated;

revoke all on function public.set_maturity_model_version_assessment_scopes(uuid, text[]) from public, anon;
revoke all on function public.list_maturity_assessment_scope_entities(uuid, text) from public, anon;
revoke all on function public.deactivate_maturity_model_version(uuid) from public, anon;
revoke all on function public.delete_maturity_model_draft_version(uuid) from public, anon;
revoke all on function public.upsert_maturity_assessment_criterion_note(uuid, uuid, text) from public, anon;

alter function private.normalise_organisation_unit_semantic_scope(text)
  owner to lean_hub_private_owner;
alter function private.organisation_unit_matches_semantic_scope(uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.maturity_model_version_allows_scope(uuid, uuid, text)
  owner to lean_hub_private_owner;
alter function private.set_maturity_model_version_assessment_scopes(uuid, text[])
  owner to lean_hub_private_owner;
alter function private.list_maturity_assessment_scope_entities(uuid, text)
  owner to lean_hub_private_owner;
alter function private.deactivate_maturity_model_version(uuid)
  owner to lean_hub_private_owner;
alter function private.delete_maturity_model_draft_version(uuid)
  owner to lean_hub_private_owner;
alter function private.upsert_maturity_assessment_criterion_note(uuid, uuid, text)
  owner to lean_hub_private_owner;
