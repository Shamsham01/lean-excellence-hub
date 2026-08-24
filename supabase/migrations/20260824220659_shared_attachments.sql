create table public.attachments (
  id uuid primary key,
  organisation_id uuid not null,
  target_resource_id uuid not null,
  uploaded_by_membership_id uuid not null,
  filename text not null,
  mime_type text not null,
  byte_size bigint,
  storage_object_path text not null,
  lifecycle text not null default 'pending_upload',
  scan_state text not null default 'not_required',
  upload_expires_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint attachments_organisation_id_id_key unique (organisation_id, id),
  constraint attachments_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint attachments_target_resource_fkey
    foreign key (organisation_id, target_resource_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint attachments_uploader_fkey
    foreign key (organisation_id, uploaded_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint attachments_filename_check
    check (filename = btrim(filename) and char_length(filename) between 1 and 255),
  constraint attachments_mime_type_check
    check (mime_type = btrim(mime_type) and char_length(mime_type) between 1 and 120),
  constraint attachments_lifecycle_check
    check (lifecycle in ('pending_upload', 'active', 'failed', 'archived')),
  constraint attachments_scan_state_check
    check (scan_state in ('not_required', 'pending_scan', 'accepted', 'rejected'))
);

create index attachments_target_idx
  on public.attachments (organisation_id, target_resource_id);

create trigger attachments_touch_updated_at
before update on public.attachments
for each row execute function private.touch_updated_at();

create trigger attachments_prevent_org_change
before update on public.attachments
for each row execute function private.prevent_organisation_id_change();

alter table public.attachments enable row level security;
alter table public.attachments force row level security;

create or replace function private.can_access_attachment_target(
  target_organisation_id uuid,
  target_attachment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_resource uuid;
begin
  select attachment_row.target_resource_id
  into target_resource
  from public.attachments attachment_row
  where attachment_row.organisation_id = target_organisation_id
    and attachment_row.id = target_attachment_id;

  if not found then
    return false;
  end if;

  return private.can_access_resource(target_organisation_id, target_resource);
end;
$$;

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
    or not private.has_scoped_permission(org_id, 'attachments.upload', null, null)
    or not private.can_access_resource(org_id, target_resource_id) then
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
begin
  if org_id is null
    or not private.has_scoped_permission(org_id, 'attachments.upload', null, null)
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

create or replace function private.expire_pending_attachment_uploads()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.attachments attachment_row
  set lifecycle = 'failed',
      updated_at = statement_timestamp()
  where attachment_row.lifecycle = 'pending_upload'
    and attachment_row.upload_expires_at <= statement_timestamp();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.initiate_attachment_upload(
  target_resource_id uuid,
  target_filename text,
  target_mime_type text,
  target_byte_size bigint
)
returns table (attachment_id uuid, storage_object_path text)
language sql volatile security invoker set search_path = ''
as $$
  select *
  from private.initiate_attachment_upload(
    target_resource_id,
    target_filename,
    target_mime_type,
    target_byte_size
  )
$$;

create or replace function public.confirm_attachment_upload(target_attachment_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.confirm_attachment_upload(target_attachment_id) $$;

create policy attachments_select_active
on public.attachments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and lifecycle = 'active'
  and private.has_scoped_permission(organisation_id, 'attachments.read', null, null)
  and private.can_access_attachment_target(organisation_id, id)
);

grant execute on function public.initiate_attachment_upload(uuid, text, text, bigint)
  to authenticated;
grant execute on function public.confirm_attachment_upload(uuid) to authenticated;
grant execute on function private.expire_pending_attachment_uploads() to service_role;

grant select on public.attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organisation-evidence',
  'organisation-evidence',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do nothing;
