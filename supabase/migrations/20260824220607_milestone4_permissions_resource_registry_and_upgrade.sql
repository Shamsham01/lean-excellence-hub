-- Milestone 4 permission keys
insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('actions.read', 'Read actions within authorised scope.', false),
  ('actions.create', 'Create actions.', false),
  ('actions.update', 'Update actions within authorised scope.', false),
  ('actions.assign', 'Assign action members.', false),
  ('actions.complete', 'Complete actions within authorised scope.', false),
  ('actions.verify', 'Verify completed actions.', false),
  ('templates.read', 'Read templates and published versions.', false),
  ('templates.manage', 'Create, edit, publish, and archive templates.', false),
  ('submissions.read', 'Read template submissions within authorised scope.', false),
  ('submissions.create', 'Create and edit draft template submissions.', false),
  ('attachments.read', 'Read attachments on authorised target resources.', false),
  ('attachments.upload', 'Upload attachments to authorised target resources.', false),
  ('attachments.archive', 'Archive attachments on authorised target resources.', false),
  ('comments.read', 'Read comments on authorised target resources.', false),
  ('comments.create', 'Create comments on authorised target resources.', false),
  ('comments.edit', 'Edit own comments on authorised target resources.', false)
on conflict (permission_key) do nothing;

create table public.resource_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  resource_type text not null,
  created_by_membership_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz,
  constraint resource_records_organisation_id_id_key unique (organisation_id, id),
  constraint resource_records_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint resource_records_type_check
    check (
      resource_type in (
        'action',
        'template',
        'template_submission',
        'attachment',
        'comment'
      )
    )
);

create index resource_records_org_type_idx
  on public.resource_records (organisation_id, resource_type);

create trigger resource_records_prevent_org_change
before update on public.resource_records
for each row execute function private.prevent_organisation_id_change();

alter table public.resource_records enable row level security;
alter table public.resource_records force row level security;

revoke all on public.resource_records from public, anon, authenticated, service_role;
grant select, insert, update on public.resource_records to lean_hub_private_owner;

create policy private_owner_all_resource_records
on public.resource_records
for all
to lean_hub_private_owner
using (true)
with check (true);

create or replace function private.register_resource_record(
  target_organisation_id uuid,
  target_resource_type text,
  target_resource_id uuid default gen_random_uuid(),
  target_created_by_membership_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_resource_type not in (
    'action',
    'template',
    'template_submission',
    'attachment',
    'comment'
  ) then
    raise exception 'invalid resource type'
      using errcode = '22023';
  end if;

  insert into public.resource_records (
    id,
    organisation_id,
    resource_type,
    created_by_membership_id
  )
  values (
    target_resource_id,
    target_organisation_id,
    target_resource_type,
    target_created_by_membership_id
  );

  return target_resource_id;
end;
$$;

create or replace function private.can_access_resource(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_row public.resource_records%rowtype;
begin
  select resource_registry.*
  into resource_row
  from public.resource_records resource_registry
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_resource_id
    and resource_registry.retired_at is null;

  if not found then
    return false;
  end if;

  case resource_row.resource_type
    when 'action' then
      return private.can_read_action(target_organisation_id, target_resource_id);
    when 'template' then
      return private.has_scoped_permission(
        target_organisation_id,
        'templates.read',
        null,
        null
      );
    when 'template_submission' then
      return private.can_read_template_submission(
        target_organisation_id,
        target_resource_id
      );
    when 'attachment' then
      return private.can_access_attachment_target(
        target_organisation_id,
        target_resource_id
      );
    when 'comment' then
      return private.can_access_comment_target(
        target_organisation_id,
        target_resource_id
      );
    else
      return false;
  end case;
end;
$$;

create or replace function private.can_read_action(
  target_organisation_id uuid,
  target_action_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
$$;

create or replace function private.can_read_template_submission(
  target_organisation_id uuid,
  target_submission_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
$$;

create or replace function private.can_access_attachment_target(
  target_organisation_id uuid,
  target_attachment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
$$;

create or replace function private.can_access_comment_target(
  target_organisation_id uuid,
  target_comment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
$$;

create or replace function private.can_reference_source_resource(
  target_organisation_id uuid,
  target_source_resource_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_row public.resource_records%rowtype;
begin
  select resource_registry.*
  into resource_row
  from public.resource_records resource_registry
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_source_resource_id
    and resource_registry.retired_at is null;

  if not found then
    return false;
  end if;

  return private.can_access_resource(target_organisation_id, target_source_resource_id);
end;
$$;

create or replace function private.system_upgrade_owner_role_permissions(
  new_permission_keys text[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_row record;
  active_grant_row record;
  owner_role_id uuid;
  current_published_version_id uuid;
  current_version_number integer;
  successor_version_id uuid;
  owner_membership_id uuid;
  missing_key text;
begin
  for org_row in
    select organisation.id as organisation_id
    from public.organisations organisation
    where organisation.status in ('active', 'provisioning', 'suspended')
  loop
    select role_row.id
    into owner_role_id
    from public.roles role_row
    where role_row.organisation_id = org_row.organisation_id
      and role_row.is_owner_role
      and role_row.status = 'active'
    limit 1;

    if owner_role_id is null then
      continue;
    end if;

    select role_version.id, role_version.version_number
    into current_published_version_id, current_version_number
    from public.role_versions role_version
    where role_version.organisation_id = org_row.organisation_id
      and role_version.role_id = owner_role_id
      and role_version.status = 'published'
    order by role_version.version_number desc
    limit 1;

    if current_published_version_id is null then
      continue;
    end if;

    if not exists (
      select 1
      from unnest(new_permission_keys) as missing_permission(permission_key)
      where not exists (
        select 1
        from public.role_permissions role_permission
        where role_permission.organisation_id = org_row.organisation_id
          and role_permission.role_version_id = current_published_version_id
          and role_permission.permission_key = missing_permission.permission_key
      )
    ) then
      continue;
    end if;

    select membership.id
    into owner_membership_id
    from public.organisation_memberships membership
    join public.access_grants active_owner_grant
      on active_owner_grant.organisation_id = membership.organisation_id
     and active_owner_grant.grantee_membership_id = membership.id
     and active_owner_grant.role_version_id = current_published_version_id
     and active_owner_grant.status = 'active'
    where membership.organisation_id = org_row.organisation_id
      and membership.status = 'active'
    limit 1;

    if owner_membership_id is null then
      select membership.id
      into owner_membership_id
      from public.organisation_memberships membership
      where membership.organisation_id = org_row.organisation_id
        and membership.status = 'active'
      order by membership.created_at
      limit 1;
    end if;

    if owner_membership_id is null then
      continue;
    end if;

    insert into public.role_versions (
      organisation_id,
      role_id,
      version_number,
      status,
      created_by_membership_id
    )
    values (
      org_row.organisation_id,
      owner_role_id,
      current_version_number + 1,
      'draft',
      owner_membership_id
    )
    returning id into successor_version_id;

    insert into public.role_permissions (
      organisation_id,
      role_version_id,
      permission_key
    )
    select
      org_row.organisation_id,
      successor_version_id,
      role_permission.permission_key
    from public.role_permissions role_permission
    where role_permission.organisation_id = org_row.organisation_id
      and role_permission.role_version_id = current_published_version_id;

    foreach missing_key in array new_permission_keys
    loop
      insert into public.role_permissions (
        organisation_id,
        role_version_id,
        permission_key
      )
      select
        org_row.organisation_id,
        successor_version_id,
        missing_key
      where not exists (
        select 1
        from public.role_permissions existing_permission
        where existing_permission.organisation_id = org_row.organisation_id
          and existing_permission.role_version_id = successor_version_id
          and existing_permission.permission_key = missing_key
      );
    end loop;

    update public.role_versions
    set status = 'published',
        published_by_membership_id = owner_membership_id,
        published_at = statement_timestamp()
    where organisation_id = org_row.organisation_id
      and id = successor_version_id;

    for active_grant_row in
      select active_grant.*
      from public.access_grants active_grant
      where active_grant.organisation_id = org_row.organisation_id
        and active_grant.role_version_id = current_published_version_id
        and active_grant.status = 'active'
    loop
      update public.access_grants bound_grant
      set status = 'revoked',
          revoked_at = statement_timestamp(),
          revoked_by_membership_id = owner_membership_id,
          revocation_reason = 'owner role permission upgrade'
      where bound_grant.organisation_id = org_row.organisation_id
        and bound_grant.id = active_grant_row.id;

      insert into public.access_grants (
        organisation_id,
        grantee_membership_id,
        role_version_id,
        scope_type,
        scope_unit_id,
        grantor_membership_id
      )
      values (
        active_grant_row.organisation_id,
        active_grant_row.grantee_membership_id,
        successor_version_id,
        active_grant_row.scope_type,
        active_grant_row.scope_unit_id,
        owner_membership_id
      );
    end loop;
  end loop;
end;
$$;

select private.system_upgrade_owner_role_permissions(
  array[
    'actions.read',
    'actions.create',
    'actions.update',
    'actions.assign',
    'actions.complete',
    'actions.verify',
    'templates.read',
    'templates.manage',
    'submissions.read',
    'submissions.create',
    'attachments.read',
    'attachments.upload',
    'attachments.archive',
    'comments.read',
    'comments.create',
    'comments.edit'
  ]::text[]
);

alter function private.register_resource_record(uuid, text, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.can_access_resource(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.can_reference_source_resource(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.system_upgrade_owner_role_permissions(text[])
  owner to lean_hub_private_owner;

revoke all on function private.register_resource_record(uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.register_resource_record(uuid, text, uuid, uuid)
  to service_role;

revoke all on function private.system_upgrade_owner_role_permissions(text[])
  from public, anon, authenticated, service_role;
