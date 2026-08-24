create policy organisation_evidence_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organisation-evidence'
  and exists (
    select 1
    from public.attachments attachment_row
    where attachment_row.storage_object_path = name
      and attachment_row.lifecycle = 'pending_upload'
      and attachment_row.organisation_id = private.current_organisation_id()
      and private.has_scoped_permission(
        attachment_row.organisation_id,
        'attachments.upload',
        null,
        null
      )
      and private.can_access_attachment_target(
        attachment_row.organisation_id,
        attachment_row.id
      )
  )
);

create policy organisation_evidence_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organisation-evidence'
  and exists (
    select 1
    from public.attachments attachment_row
    where attachment_row.storage_object_path = name
      and attachment_row.lifecycle = 'active'
      and attachment_row.organisation_id = private.current_organisation_id()
      and private.has_scoped_permission(
        attachment_row.organisation_id,
        'attachments.read',
        null,
        null
      )
      and private.can_access_attachment_target(
        attachment_row.organisation_id,
        attachment_row.id
      )
  )
);

create policy organisation_evidence_delete_pending
on storage.objects
for delete
to service_role
using (
  bucket_id = 'organisation-evidence'
  and exists (
    select 1
    from public.attachments attachment_row
    where attachment_row.storage_object_path = name
      and attachment_row.lifecycle in ('pending_upload', 'failed')
  )
);
