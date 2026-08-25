-- Storage upload RLS must validate pending attachments without exposing them to readers.

create or replace function private.storage_path_allows_evidence_upload(
  target_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attachments attachment_row
    join public.organisation_memberships membership_row
      on membership_row.organisation_id = attachment_row.organisation_id
     and membership_row.id = attachment_row.uploaded_by_membership_id
     and membership_row.user_id = private.auth_uid()
     and membership_row.status = 'active'
    where attachment_row.storage_object_path = target_storage_path
      and attachment_row.lifecycle = 'pending_upload'
  )
$$;

alter function private.storage_path_allows_evidence_upload(text)
  owner to postgres;

grant select on public.attachments to lean_hub_private_owner;
grant select on public.organisation_memberships to lean_hub_private_owner;

drop policy if exists organisation_evidence_insert on storage.objects;

create policy organisation_evidence_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organisation-evidence'
  and private.storage_path_allows_evidence_upload(name)
);
