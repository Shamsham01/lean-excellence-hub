-- Unit-scoped attachments.upload grants must work for in-scope assessment targets.

create or replace function private.resolve_attachment_target_unit_id(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select assessment_row.unit_id
  from public.resource_records resource_registry
  join public.maturity_assessments assessment_row
    on assessment_row.organisation_id = resource_registry.organisation_id
   and assessment_row.id = resource_registry.id
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_resource_id
    and resource_registry.resource_type = 'maturity_assessment'
    and resource_registry.retired_at is null
$$;

create or replace function private.can_upload_attachments(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_resource(target_organisation_id, target_resource_id)
    and (
      private.has_scoped_permission(
        target_organisation_id,
        'attachments.upload',
        null,
        null
      )
      or private.has_scoped_permission(
        target_organisation_id,
        'attachments.upload',
        null,
        private.resolve_attachment_target_unit_id(
          target_organisation_id,
          target_resource_id
        )
      )
      or exists (
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
         and role_permission.permission_key = 'attachments.upload'
        where grant_row.organisation_id = target_organisation_id
          and grant_row.grantee_membership_id =
            private.current_membership_id(target_organisation_id)
          and grant_row.status = 'active'
          and (
            grant_row.expires_at is null
            or grant_row.expires_at > statement_timestamp()
          )
          and grant_row.scope_type in ('organisation', 'unit_subtree')
      )
    )
$$;

alter function private.resolve_attachment_target_unit_id(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.can_upload_attachments(uuid, uuid)
  owner to lean_hub_private_owner;

create or replace function private.initiate_attachment_upload(
  target_resource_id uuid,
  target_filename text,
  target_mime_type text,
  target_byte_size bigint
)
returns table (attachment_id uuid, storage_object_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_attachment_id uuid;
  object_path text;
  resource_type text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_upload_attachments(org_id, target_resource_id) then
    raise exception 'attachment upload is not authorised'
      using errcode = '42501';
  end if;

  select resource_registry.resource_type
  into resource_type
  from public.resource_records resource_registry
  where resource_registry.organisation_id = org_id
    and resource_registry.id = target_resource_id;

  new_attachment_id := private.register_resource_record(
    org_id,
    'attachment',
    gen_random_uuid(),
    actor_membership_id
  );

  object_path := org_id::text || '/' || resource_type || '/' ||
    target_resource_id::text || '/' || new_attachment_id::text;

  insert into public.attachments (
    id,
    organisation_id,
    target_resource_id,
    uploaded_by_membership_id,
    filename,
    mime_type,
    byte_size,
    storage_object_path,
    lifecycle,
    scan_state,
    upload_expires_at
  )
  values (
    new_attachment_id,
    org_id,
    target_resource_id,
    actor_membership_id,
    target_filename,
    target_mime_type,
    target_byte_size,
    object_path,
    'pending_upload',
    'not_required',
    statement_timestamp() + interval '1 hour'
  );

  attachment_id := new_attachment_id;
  storage_object_path := object_path;
  return next;
end;
$$;

create or replace function private.confirm_attachment_upload(
  target_attachment_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  target_resource_id uuid;
begin
  select attachment_row.target_resource_id
  into target_resource_id
  from public.attachments attachment_row
  where attachment_row.organisation_id = org_id
    and attachment_row.id = target_attachment_id;

  if org_id is null
    or not private.can_upload_attachments(org_id, target_resource_id)
    or not private.can_access_attachment_target(org_id, target_attachment_id) then
    raise exception 'attachment confirmation is not authorised'
      using errcode = '42501';
  end if;

  update public.attachments attachment_row
  set lifecycle = 'active',
      updated_at = statement_timestamp()
  where attachment_row.organisation_id = org_id
    and attachment_row.id = target_attachment_id
    and attachment_row.lifecycle = 'pending_upload'
    and attachment_row.upload_expires_at > statement_timestamp();

  return found;
end;
$$;
