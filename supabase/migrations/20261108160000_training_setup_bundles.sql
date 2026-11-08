-- TRAINING-SETUP-001
-- Atomic Training setup drafts (manual, Quick Start, LeanAI), publish, and discard.
-- Do not apply from CI. Apply forward after prior training migrations on a disposable database.

create table public.training_setup_bundles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  source text not null,
  template_key text,
  template_version text,
  title text not null,
  status text not null default 'draft',
  idempotency_key text not null,
  sample boolean not null default false,
  unresolved jsonb not null default '[]'::jsonb,
  request_definition jsonb not null,
  curriculum_id uuid,
  curriculum_version_id uuid,
  created_by_membership_id uuid not null,
  published_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint training_setup_bundles_organisation_id_id_key unique (organisation_id, id),
  constraint training_setup_bundles_idempotency_key unique (organisation_id, idempotency_key),
  constraint training_setup_bundles_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_setup_bundles_curriculum_fkey
    foreign key (organisation_id, curriculum_id)
    references public.training_curricula(organisation_id, id)
    on delete restrict,
  constraint training_setup_bundles_curriculum_version_fkey
    foreign key (organisation_id, curriculum_version_id)
    references public.training_curriculum_versions(organisation_id, id)
    on delete restrict,
  constraint training_setup_bundles_source_check
    check (source in ('manual', 'quick_start', 'leanai')),
  constraint training_setup_bundles_status_check
    check (status in ('draft', 'published', 'discarded')),
  constraint training_setup_bundles_title_check
    check (title = btrim(title) and char_length(title) between 1 and 160),
  constraint training_setup_bundles_idempotency_check
    check (
      idempotency_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  constraint training_setup_bundles_lifecycle_check
    check (
      (status = 'draft' and published_at is null and discarded_at is null)
      or (status = 'published' and published_at is not null and discarded_at is null)
      or (status = 'discarded' and discarded_at is not null and published_at is null)
    )
);

create table public.training_setup_bundle_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  bundle_id uuid not null,
  record_kind text not null,
  record_id uuid not null,
  ownership text not null,
  label text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint training_setup_bundle_items_organisation_id_id_key unique (organisation_id, id),
  constraint training_setup_bundle_items_bundle_fkey
    foreign key (organisation_id, bundle_id)
    references public.training_setup_bundles(organisation_id, id)
    on delete restrict,
  constraint training_setup_bundle_items_identity_key
    unique (bundle_id, record_kind, record_id),
  constraint training_setup_bundle_items_kind_check
    check (record_kind in ('course', 'curriculum', 'requirement', 'course_version')),
  constraint training_setup_bundle_items_ownership_check
    check (ownership in ('created', 'reused')),
  constraint training_setup_bundle_items_label_check
    check (label = btrim(label) and char_length(label) between 1 and 160)
);

create table public.training_setup_preparations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  source text not null,
  template_key text not null default '',
  state jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint training_setup_preparations_identity_key
    unique (organisation_id, membership_id, source, template_key),
  constraint training_setup_preparations_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_setup_preparations_source_check
    check (source in ('manual', 'quick_start', 'leanai')),
  constraint training_setup_preparations_state_check
    check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 100000)
);

create index training_setup_bundles_org_status_idx
  on public.training_setup_bundles (organisation_id, status, created_at desc);
create index training_setup_bundle_items_bundle_idx
  on public.training_setup_bundle_items (organisation_id, bundle_id);

create trigger training_setup_bundles_prevent_organisation_id_change
before update on public.training_setup_bundles
for each row execute function private.prevent_organisation_id_change();
create trigger training_setup_bundle_items_prevent_organisation_id_change
before update on public.training_setup_bundle_items
for each row execute function private.prevent_organisation_id_change();
create trigger training_setup_preparations_prevent_organisation_id_change
before update on public.training_setup_preparations
for each row execute function private.prevent_organisation_id_change();
create trigger training_setup_bundles_touch_updated_at
before update on public.training_setup_bundles
for each row execute function private.touch_updated_at();
create trigger training_setup_preparations_touch_updated_at
before update on public.training_setup_preparations
for each row execute function private.touch_updated_at();

alter table public.training_setup_bundles enable row level security;
alter table public.training_setup_bundles force row level security;
alter table public.training_setup_bundle_items enable row level security;
alter table public.training_setup_bundle_items force row level security;
alter table public.training_setup_preparations enable row level security;
alter table public.training_setup_preparations force row level security;

revoke all on public.training_setup_bundles from public, anon, authenticated, service_role;
revoke all on public.training_setup_bundle_items from public, anon, authenticated, service_role;
revoke all on public.training_setup_preparations from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.training_setup_bundles to lean_hub_private_owner;
grant select, insert, update, delete on public.training_setup_bundle_items to lean_hub_private_owner;
grant select, insert, update, delete on public.training_setup_preparations to lean_hub_private_owner;
grant select on public.training_setup_bundles to authenticated;
grant select on public.training_setup_bundle_items to authenticated;
grant select on public.training_setup_preparations to authenticated;

create policy private_owner_all_training_setup_bundles
on public.training_setup_bundles for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_training_setup_bundle_items
on public.training_setup_bundle_items for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_training_setup_preparations
on public.training_setup_preparations for all to lean_hub_private_owner using (true) with check (true);

create policy training_setup_bundles_select on public.training_setup_bundles for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_read_training_catalog(organisation_id)
    or private.can_manage_training_catalog(organisation_id)
    or private.can_manage_training_curriculum(organisation_id)
  )
);
create policy training_setup_bundle_items_select on public.training_setup_bundle_items for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_read_training_catalog(organisation_id)
    or private.can_manage_training_catalog(organisation_id)
    or private.can_manage_training_curriculum(organisation_id)
  )
);
create policy training_setup_preparations_select on public.training_setup_preparations for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and membership_id = private.current_membership_id(organisation_id)
  and (
    private.can_read_training_catalog(organisation_id)
    or private.can_manage_training_catalog(organisation_id)
    or private.can_manage_training_curriculum(organisation_id)
  )
);

create or replace function private.training_setup_authorised(target_organisation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_training_catalog(target_organisation_id)
    and private.can_manage_training_curriculum(target_organisation_id)
$$;

create or replace function private.create_training_setup_draft(
  target_idempotency_key text,
  target_definition jsonb
)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  definition jsonb;
  source_text text;
  title_text text;
  sample_flag boolean;
  courses_json jsonb;
  curriculum_json jsonb;
  unresolved_json jsonb;
  course_item jsonb;
  course_name text;
  course_code text;
  course_id uuid;
  course_version_id uuid;
  seen_codes text[] := '{}';
  bundle_id uuid;
  new_curriculum_id uuid;
  new_curriculum_version_id uuid;
  curriculum_name text;
  curriculum_code text;
  requirement_item jsonb;
  requirement_id uuid;
  requirement_course_code text;
  requirement_course_id uuid;
  requirement_job_function_id uuid;
  existing_bundle_id uuid;
  existing_bundle_status text;
  existing_request_definition jsonb;
begin
  if org_id is null or actor_membership_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  if target_idempotency_key is null or target_idempotency_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'module setup definition is invalid' using errcode = '22023';
  end if;
  if target_definition is null or jsonb_typeof(target_definition) is distinct from 'object'
    or octet_length(target_definition::text) > 200000 then
    raise exception 'module setup definition is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':training-setup:' || target_idempotency_key, 0));

  select bundle_row.id, bundle_row.status, bundle_row.request_definition
  into existing_bundle_id, existing_bundle_status, existing_request_definition
  from public.training_setup_bundles bundle_row
  where bundle_row.organisation_id = org_id and bundle_row.idempotency_key = target_idempotency_key;

  if existing_bundle_id is not null then
    if existing_bundle_status = 'draft' and existing_request_definition = target_definition then
      return existing_bundle_id;
    end if;
    if existing_bundle_status = 'draft' then
      raise exception 'training setup creation key does not match this content' using errcode = '22023';
    end if;
    raise exception 'training setup creation key is already finished' using errcode = '22023';
  end if;

  definition := private.module_setup_require_object(target_definition, 'definition');
  source_text := private.module_setup_require_text(definition -> 'source', 'source', 1, 20, true);
  if source_text not in ('manual', 'quick_start', 'leanai') then
    raise exception 'module setup definition is invalid' using errcode = '22023';
  end if;
  title_text := private.module_setup_require_text(definition -> 'title', 'title', 1, 160, true);
  sample_flag := source_text = 'quick_start' or coalesce((definition ->> 'sample')::boolean, false);
  courses_json := private.module_setup_require_array(definition -> 'courses', 'courses', 1, 24);
  curriculum_json := definition -> 'curriculum';
  unresolved_json := coalesce(definition -> 'unresolved_roles', '[]'::jsonb);

  insert into public.training_setup_bundles (
    organisation_id, source, template_key, template_version, title, status,
    idempotency_key, sample, unresolved, request_definition, created_by_membership_id
  ) values (
    org_id,
    source_text,
    private.module_setup_require_text(definition -> 'template_key', 'template key', 1, 80, false),
    private.module_setup_require_text(definition -> 'template_version', 'template version', 1, 40, false),
    title_text,
    'draft',
    target_idempotency_key,
    sample_flag,
    unresolved_json,
    target_definition,
    actor_membership_id
  ) returning id into bundle_id;

  for course_item in select value from jsonb_array_elements(courses_json) loop
    perform private.module_setup_require_object(course_item, 'course');
    course_name := private.module_setup_require_text(course_item -> 'name', 'course name', 1, 160, true);
    course_code := lower(private.module_setup_require_text(course_item -> 'code', 'course code', 1, 80, true));
    if course_code = any(seen_codes) then
      raise exception 'module setup definition is invalid' using errcode = '22023';
    end if;
    seen_codes := array_append(seen_codes, course_code);

    course_id := private.register_resource_record(org_id, 'training_course', gen_random_uuid(), actor_membership_id);
    insert into public.training_courses (
      id, organisation_id, name, code, category, description, created_by_membership_id
    ) values (
      course_id, org_id, course_name, course_code,
      private.module_setup_require_text(course_item -> 'category', 'category', 1, 120, false),
      private.module_setup_require_text(course_item -> 'description', 'description', 1, 2000, false),
      actor_membership_id
    );
    insert into public.training_course_versions (
      organisation_id, course_id, version_number, status,
      duration_minutes, learning_objectives, delivery_method, created_by_membership_id
    ) values (
      org_id, course_id, 1, 'draft',
      (course_item ->> 'duration_minutes')::integer,
      private.module_setup_require_text(course_item -> 'learning_objectives', 'objectives', 1, 4000, false),
      private.module_setup_require_text(course_item -> 'delivery_method', 'delivery', 1, 40, false),
      actor_membership_id
    ) returning id into course_version_id;

    insert into public.training_setup_bundle_items (
      organisation_id, bundle_id, record_kind, record_id, ownership, label
    ) values
      (org_id, bundle_id, 'course', course_id, 'created', left(course_name, 160)),
      (org_id, bundle_id, 'course_version', course_version_id, 'created', left(course_name, 160));
  end loop;

  if curriculum_json is not null and jsonb_typeof(curriculum_json) = 'object' then
    curriculum_name := private.module_setup_require_text(curriculum_json -> 'name', 'curriculum name', 1, 160, true);
    curriculum_code := lower(private.module_setup_require_text(curriculum_json -> 'code', 'curriculum code', 1, 80, true));
    insert into public.training_curricula (
      organisation_id, name, code, description, created_by_membership_id
    ) values (
      org_id, curriculum_name, curriculum_code,
      private.module_setup_require_text(curriculum_json -> 'description', 'description', 1, 2000, false),
      actor_membership_id
    ) returning id into new_curriculum_id;

    insert into public.training_curriculum_versions (
      organisation_id, curriculum_id, version_number, status, created_by_membership_id
    ) values (org_id, new_curriculum_id, 1, 'draft', actor_membership_id)
    returning id into new_curriculum_version_id;

    update public.training_setup_bundles bundle_row
    set
      curriculum_id = new_curriculum_id,
      curriculum_version_id = new_curriculum_version_id
    where bundle_row.organisation_id = org_id and bundle_row.id = bundle_id;

    insert into public.training_setup_bundle_items (
      organisation_id, bundle_id, record_kind, record_id, ownership, label
    ) values (org_id, bundle_id, 'curriculum', new_curriculum_id, 'created', left(curriculum_name, 160));

    for requirement_item in
      select value from jsonb_array_elements(coalesce(curriculum_json -> 'requirements', '[]'::jsonb))
    loop
      requirement_course_code := lower(private.module_setup_require_text(requirement_item -> 'course_code', 'course code', 1, 80, true));
      select course_row.id into requirement_course_id
      from public.training_courses course_row
      join public.training_setup_bundle_items item_row
        on item_row.organisation_id = org_id and item_row.bundle_id = bundle_id
        and item_row.record_kind = 'course' and item_row.record_id = course_row.id
      where course_row.organisation_id = org_id and course_row.code = requirement_course_code;
      if requirement_course_id is null then
        raise exception 'module setup definition is invalid' using errcode = '22023';
      end if;
      requirement_job_function_id := (requirement_item ->> 'job_function_id')::uuid;
      requirement_id := private.add_training_requirement(
        new_curriculum_version_id,
        requirement_course_id,
        requirement_job_function_id,
        (requirement_item ->> 'organisational_unit_id')::uuid,
        false,
        coalesce((requirement_item ->> 'mandatory')::boolean, true),
        null,
        null,
        null,
        private.module_setup_require_text(requirement_item -> 'notes', 'notes', 1, 2000, false)
      );
      insert into public.training_setup_bundle_items (
        organisation_id, bundle_id, record_kind, record_id, ownership, label
      ) values (org_id, bundle_id, 'requirement', requirement_id, 'created', left(requirement_course_code, 160));
    end loop;
  end if;

  return bundle_id;
end;
$$;

create or replace function private.publish_training_setup_bundle(target_bundle_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  org_id uuid := private.current_organisation_id();
  bundle_row public.training_setup_bundles%rowtype;
  version_id uuid;
begin
  if org_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  select bundle.* into bundle_row from public.training_setup_bundles bundle
  where bundle.organisation_id = org_id and bundle.id = target_bundle_id for update;
  if not found then
    raise exception 'training setup bundle was not found' using errcode = 'P0002';
  end if;
  if bundle_row.status = 'published' then return true; end if;
  if bundle_row.status = 'discarded' then
    raise exception 'discarded setup bundles cannot be published' using errcode = '22023';
  end if;

  for version_id in
    select item_row.record_id
    from public.training_setup_bundle_items item_row
    where item_row.organisation_id = org_id and item_row.bundle_id = bundle_row.id
      and item_row.record_kind = 'course_version'
  loop
    perform private.publish_training_course_version(version_id);
  end loop;

  if bundle_row.curriculum_version_id is not null then
    perform private.publish_training_curriculum_version(bundle_row.curriculum_version_id);
  end if;

  update public.training_setup_bundles
  set status = 'published', published_at = statement_timestamp()
  where organisation_id = org_id and id = bundle_row.id;
  return true;
end;
$$;

create or replace function private.discard_training_setup_bundle(target_bundle_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  org_id uuid := private.current_organisation_id();
  bundle_row public.training_setup_bundles%rowtype;
  item_row public.training_setup_bundle_items%rowtype;
  removed jsonb := '[]'::jsonb;
begin
  if org_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  select bundle.* into bundle_row from public.training_setup_bundles bundle
  where bundle.organisation_id = org_id and bundle.id = target_bundle_id for update;
  if not found then
    raise exception 'training setup bundle was not found' using errcode = 'P0002';
  end if;
  if bundle_row.status = 'published' then
    raise exception 'published setup bundles are kept' using errcode = '22023';
  end if;

  delete from public.training_requirements requirement_row
  where requirement_row.organisation_id = org_id
    and requirement_row.id in (
      select item_row.record_id from public.training_setup_bundle_items item_row
      where item_row.organisation_id = org_id and item_row.bundle_id = bundle_row.id
        and item_row.record_kind = 'requirement' and item_row.ownership = 'created'
    );

  for item_row in
    select item.* from public.training_setup_bundle_items item
    where item.organisation_id = org_id and item.bundle_id = bundle_row.id
      and item.record_kind in ('course', 'course_version', 'curriculum')
  loop
    removed := removed || jsonb_build_array(jsonb_build_object('kind', item_row.record_kind, 'id', item_row.record_id, 'label', item_row.label));
  end loop;

  update public.training_setup_bundles
  set status = 'discarded', discarded_at = statement_timestamp()
  where organisation_id = org_id and id = bundle_row.id;

  return jsonb_build_object('bundle_id', bundle_row.id, 'status', 'discarded', 'removed', removed, 'retained', '[]'::jsonb);
end;
$$;

create or replace function private.preview_training_setup_bundle_discard(target_bundle_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  org_id uuid := private.current_organisation_id();
  bundle_row public.training_setup_bundles%rowtype;
begin
  if org_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  select bundle.* into bundle_row from public.training_setup_bundles bundle
  where bundle.organisation_id = org_id and bundle.id = target_bundle_id;
  if not found then
    raise exception 'training setup bundle was not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('bundle_id', bundle_row.id, 'status', bundle_row.status, 'removed', '[]'::jsonb, 'retained', '[]'::jsonb);
end;
$$;

create or replace function private.save_training_setup_preparation(
  target_source text,
  target_template_key text,
  target_state jsonb
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  preparation_id uuid;
  template_key text := coalesce(target_template_key, '');
begin
  if org_id is null or actor_membership_id is null or not private.training_setup_authorised(org_id) then
    raise exception 'training setup draft is not authorised' using errcode = '42501';
  end if;
  if target_source not in ('manual', 'quick_start', 'leanai') or char_length(template_key) > 80
    or target_state is null or jsonb_typeof(target_state) is distinct from 'object'
    or octet_length(target_state::text) > 100000 then
    raise exception 'module setup definition is invalid' using errcode = '22023';
  end if;
  insert into public.training_setup_preparations (organisation_id, membership_id, source, template_key, state)
  values (org_id, actor_membership_id, target_source, template_key, target_state)
  on conflict on constraint training_setup_preparations_identity_key
  do update set state = excluded.state, updated_at = statement_timestamp()
  returning id into preparation_id;
  return preparation_id;
end;
$$;

create or replace function public.create_training_setup_draft(target_idempotency_key text, target_definition jsonb)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.create_training_setup_draft(target_idempotency_key, target_definition)
$$;
create or replace function public.publish_training_setup_bundle(target_bundle_id uuid)
returns boolean language sql volatile security invoker set search_path = '' as $$
  select private.publish_training_setup_bundle(target_bundle_id)
$$;
create or replace function public.discard_training_setup_bundle(target_bundle_id uuid)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select private.discard_training_setup_bundle(target_bundle_id)
$$;
create or replace function public.preview_training_setup_bundle_discard(target_bundle_id uuid)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select private.preview_training_setup_bundle_discard(target_bundle_id)
$$;
create or replace function public.save_training_setup_preparation(
  target_source text, target_template_key text, target_state jsonb
)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.save_training_setup_preparation(target_source, target_template_key, target_state)
$$;

alter function private.training_setup_authorised(uuid) owner to lean_hub_private_owner;
alter function private.create_training_setup_draft(text, jsonb) owner to lean_hub_private_owner;
alter function private.publish_training_setup_bundle(uuid) owner to lean_hub_private_owner;
alter function private.discard_training_setup_bundle(uuid) owner to lean_hub_private_owner;
alter function private.preview_training_setup_bundle_discard(uuid) owner to lean_hub_private_owner;
alter function private.save_training_setup_preparation(text, text, jsonb) owner to lean_hub_private_owner;

grant execute on function public.create_training_setup_draft(text, jsonb) to authenticated;
grant execute on function public.publish_training_setup_bundle(uuid) to authenticated;
grant execute on function public.discard_training_setup_bundle(uuid) to authenticated;
grant execute on function public.preview_training_setup_bundle_discard(uuid) to authenticated;
grant execute on function public.save_training_setup_preparation(text, text, jsonb) to authenticated;

revoke all on function public.create_training_setup_draft(text, jsonb) from public, anon;
revoke all on function public.publish_training_setup_bundle(uuid) from public, anon;
revoke all on function public.discard_training_setup_bundle(uuid) from public, anon;
revoke all on function public.preview_training_setup_bundle_discard(uuid) from public, anon;
revoke all on function public.save_training_setup_preparation(text, text, jsonb) from public, anon;
