-- Align storage upload policies with scoped attachment upload authorisation.

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

drop policy if exists organisation_evidence_insert on storage.objects;

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
      and private.can_upload_attachments(
        attachment_row.organisation_id,
        attachment_row.target_resource_id
      )
  )
);
