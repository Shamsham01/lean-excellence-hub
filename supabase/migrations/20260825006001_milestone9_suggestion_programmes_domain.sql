-- Milestone 9: suggestion programmes, categories, template experience type.

alter table public.templates
  drop constraint if exists templates_experience_type_check;

alter table public.templates
  add constraint templates_experience_type_check
  check (
    experience_type in (
      'audit_form',
      'maturity_assessment',
      'five_s_audit',
      'gemba_walk',
      'improvement_suggestion'
    )
  );

create table public.suggestion_programmes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  name text not null,
  code text not null,
  description text,
  status text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint suggestion_programmes_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_programmes_org_code_key unique (organisation_id, code),
  constraint suggestion_programmes_organisation_fkey
    foreign key (organisation_id)
    references public.organisations(id)
    on delete restrict,
  constraint suggestion_programmes_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_programmes_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint suggestion_programmes_code_check
    check (code = btrim(code) and char_length(code) between 1 and 80),
  constraint suggestion_programmes_status_check
    check (status in ('active', 'deactivated'))
);

create table public.suggestion_programme_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  programme_id uuid not null,
  version_number integer not null,
  lifecycle text not null default 'draft',
  submission_guidance text,
  review_target_days integer,
  applicable_unit_id uuid,
  template_version_id uuid,
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint suggestion_programme_versions_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_programme_versions_programme_version_key
    unique (organisation_id, programme_id, version_number),
  constraint suggestion_programme_versions_programme_fkey
    foreign key (organisation_id, programme_id)
    references public.suggestion_programmes(organisation_id, id)
    on delete restrict,
  constraint suggestion_programme_versions_unit_fkey
    foreign key (organisation_id, applicable_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint suggestion_programme_versions_template_version_fkey
    foreign key (organisation_id, template_version_id)
    references public.template_versions(organisation_id, id)
    on delete restrict,
  constraint suggestion_programme_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_programme_versions_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_programme_versions_lifecycle_check
    check (lifecycle in ('draft', 'published', 'archived')),
  constraint suggestion_programme_versions_review_target_days_check
    check (review_target_days is null or review_target_days > 0)
);

create table public.suggestion_categories (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  name text not null,
  code text not null,
  description text,
  status text not null default 'active',
  display_order integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint suggestion_categories_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_categories_org_code_key unique (organisation_id, code),
  constraint suggestion_categories_organisation_fkey
    foreign key (organisation_id)
    references public.organisations(id)
    on delete restrict,
  constraint suggestion_categories_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint suggestion_categories_code_check
    check (code = btrim(code) and char_length(code) between 1 and 80),
  constraint suggestion_categories_status_check
    check (status in ('active', 'deactivated'))
);

create trigger suggestion_programmes_touch_updated_at
before update on public.suggestion_programmes
for each row execute function private.touch_updated_at();

create trigger suggestion_categories_touch_updated_at
before update on public.suggestion_categories
for each row execute function private.touch_updated_at();

create trigger suggestion_programmes_prevent_org_change
before update on public.suggestion_programmes
for each row execute function private.prevent_organisation_id_change();

create trigger suggestion_programme_versions_prevent_org_change
before update on public.suggestion_programme_versions
for each row execute function private.prevent_organisation_id_change();

create trigger suggestion_categories_prevent_org_change
before update on public.suggestion_categories
for each row execute function private.prevent_organisation_id_change();

alter table public.suggestion_programmes enable row level security;
alter table public.suggestion_programmes force row level security;
alter table public.suggestion_programme_versions enable row level security;
alter table public.suggestion_programme_versions force row level security;
alter table public.suggestion_categories enable row level security;
alter table public.suggestion_categories force row level security;

revoke all on public.suggestion_programmes from public, anon, authenticated, service_role;
revoke all on public.suggestion_programme_versions from public, anon, authenticated, service_role;
revoke all on public.suggestion_categories from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.suggestion_programmes to lean_hub_private_owner;
grant select, insert, update, delete on public.suggestion_programme_versions to lean_hub_private_owner;
grant select, insert, update, delete on public.suggestion_categories to lean_hub_private_owner;

create policy private_owner_all_suggestion_programmes
on public.suggestion_programmes for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_suggestion_programme_versions
on public.suggestion_programme_versions for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_suggestion_categories
on public.suggestion_categories for all to lean_hub_private_owner using (true) with check (true);

create or replace function private.can_manage_suggestion_programmes(
  target_organisation_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'suggestions.programmes.manage',
    null,
    null
  )
$$;

create policy suggestion_programmes_select
on public.suggestion_programmes for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_manage_suggestion_programmes(organisation_id)
    or private.has_scoped_permission(organisation_id, 'suggestions.read', null, null)
    or private.has_scoped_permission(organisation_id, 'suggestions.submit', null, null)
  )
);

create policy suggestion_programme_versions_select
on public.suggestion_programme_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_manage_suggestion_programmes(organisation_id)
    or private.has_scoped_permission(organisation_id, 'suggestions.read', null, null)
    or private.has_scoped_permission(organisation_id, 'suggestions.submit', null, null)
  )
);

grant select on public.suggestion_programmes to authenticated;
grant select, update on public.suggestion_programme_versions to authenticated;
grant select on public.suggestion_categories to authenticated;

create policy suggestion_programme_versions_update
on public.suggestion_programme_versions for update to authenticated
using (
  organisation_id = private.current_organisation_id()
  and lifecycle = 'draft'
  and private.can_manage_suggestion_programmes(organisation_id)
)
with check (
  organisation_id = private.current_organisation_id()
  and lifecycle = 'draft'
  and private.can_manage_suggestion_programmes(organisation_id)
);

create policy suggestion_categories_select
on public.suggestion_categories for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    private.can_manage_suggestion_programmes(organisation_id)
    or private.has_scoped_permission(organisation_id, 'suggestions.read', null, null)
    or private.has_scoped_permission(organisation_id, 'suggestions.submit', null, null)
  )
);

create or replace function private.create_suggestion_programme_draft(
  target_name text, target_code text, target_description text default null
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_programme_id uuid;
begin
  if org_id is null or actor_membership_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'programme creation is not authorised' using errcode = '42501';
  end if;
  insert into public.suggestion_programmes (organisation_id, name, code, description, created_by_membership_id)
  values (org_id, btrim(target_name), btrim(target_code), target_description, actor_membership_id)
  returning id into new_programme_id;
  insert into public.suggestion_programme_versions (organisation_id, programme_id, version_number, lifecycle, created_by_membership_id)
  values (org_id, new_programme_id, 1, 'draft', actor_membership_id);
  return new_programme_id;
end; $$;

create or replace function private.publish_suggestion_programme_version(target_programme_version_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  version_row public.suggestion_programme_versions%rowtype;
begin
  if org_id is null or actor_membership_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'programme publish is not authorised' using errcode = '42501';
  end if;
  select version_table.* into version_row from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id and version_table.id = target_programme_version_id for update;
  if not found or version_row.lifecycle <> 'draft' then raise exception 'programme version is not publishable' using errcode = '55000'; end if;
  update public.suggestion_programme_versions prior_version set lifecycle = 'archived', archived_at = statement_timestamp()
  where prior_version.organisation_id = org_id and prior_version.programme_id = version_row.programme_id and prior_version.lifecycle = 'published';
  update public.suggestion_programme_versions version_table set lifecycle = 'published', published_at = statement_timestamp(), published_by_membership_id = actor_membership_id
  where version_table.organisation_id = org_id and version_table.id = target_programme_version_id;
  return true;
end; $$;

create or replace function private.create_suggestion_category(
  target_name text, target_code text, target_description text default null, target_display_order integer default 0
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare org_id uuid := private.current_organisation_id(); new_category_id uuid;
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then raise exception 'category creation is not authorised' using errcode = '42501'; end if;
  insert into public.suggestion_categories (organisation_id, name, code, description, display_order)
  values (org_id, btrim(target_name), btrim(target_code), target_description, target_display_order) returning id into new_category_id;
  return new_category_id;
end; $$;

create or replace function public.create_suggestion_programme_draft(target_name text, target_code text, target_description text default null)
returns uuid language sql volatile security definer set search_path = ''
as $$ select private.create_suggestion_programme_draft(target_name, target_code, target_description) $$;
create or replace function public.publish_suggestion_programme_version(target_programme_version_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.publish_suggestion_programme_version(target_programme_version_id) $$;
create or replace function public.create_suggestion_category(target_name text, target_code text, target_description text default null, target_display_order integer default 0)
returns uuid language sql volatile security definer set search_path = ''
as $$ select private.create_suggestion_category(target_name, target_code, target_description, target_display_order) $$;
grant execute on function public.create_suggestion_programme_draft(text, text, text) to authenticated;
grant execute on function public.publish_suggestion_programme_version(uuid) to authenticated;
grant execute on function public.create_suggestion_category(text, text, text, integer) to authenticated;
alter function private.create_suggestion_programme_draft(text, text, text) owner to lean_hub_private_owner;
alter function private.publish_suggestion_programme_version(uuid) owner to lean_hub_private_owner;
alter function private.create_suggestion_category(text, text, text, integer) owner to lean_hub_private_owner;
