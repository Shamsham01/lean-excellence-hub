-- SUG-UX-002: let authorised suggestion submitters attach evidence to the
-- actual suggestion without org-wide attachments.upload, enforce the existing
-- private-bucket type/size rules in initiate_attachment_upload, and allow
-- people who can already read a suggestion to read its evidence.

create or replace function private.attachment_payload_is_allowed(
  target_filename text,
  target_mime_type text,
  target_byte_size bigint
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    target_filename is not null
    and btrim(target_filename) = target_filename
    and char_length(btrim(target_filename)) between 1 and 255
    and target_byte_size is not null
    and target_byte_size > 0
    and target_byte_size <= 10485760
    and target_mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/plain'
    )
$$;

-- Author evidence-upload matrix (this helper only):
--   draft: author + suggestions.submit on the origin unit
--   submitted / under_review / parked / accepted / implementing /
--   implemented / rejected / withdrawn: authors cannot upload here
-- Reviewer / manager uploads keep the existing attachments.upload path
-- in can_upload_attachments, including after approval or closure.
create or replace function private.can_upload_suggestion_evidence(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.resource_records resource_registry
    join public.improvement_suggestions suggestion_row
      on suggestion_row.organisation_id = resource_registry.organisation_id
     and suggestion_row.id = resource_registry.id
    where resource_registry.organisation_id = target_organisation_id
      and resource_registry.id = target_resource_id
      and resource_registry.resource_type = 'improvement_suggestion'
      and resource_registry.retired_at is null
      and suggestion_row.status = 'draft'
      and suggestion_row.author_membership_id =
        private.current_membership_id(target_organisation_id)
      and private.can_submit_suggestion_to_unit(
        target_organisation_id,
        suggestion_row.origin_unit_id
      )
  )
$$;

create or replace function private.can_read_suggestion_evidence(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.resource_records resource_registry
    where resource_registry.organisation_id = target_organisation_id
      and resource_registry.id = target_resource_id
      and resource_registry.resource_type = 'improvement_suggestion'
      and resource_registry.retired_at is null
      and private.can_read_improvement_suggestion(
        target_organisation_id,
        target_resource_id
      )
  )
$$;

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
  select coalesce(
    (
      select assessment_row.unit_id
      from public.resource_records resource_registry
      join public.maturity_assessments assessment_row
        on assessment_row.organisation_id = resource_registry.organisation_id
       and assessment_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'maturity_assessment'
        and resource_registry.retired_at is null
    ),
    (
      select audit_row.unit_id
      from public.resource_records resource_registry
      join public.five_s_audits audit_row
        on audit_row.organisation_id = resource_registry.organisation_id
       and audit_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'five_s_audit'
        and resource_registry.retired_at is null
    ),
    (
      select walk_row.unit_id
      from public.resource_records resource_registry
      join public.gemba_walks walk_row
        on walk_row.organisation_id = resource_registry.organisation_id
       and walk_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'gemba_walk'
        and resource_registry.retired_at is null
    ),
    (
      select session_row.organisational_unit_id
      from public.resource_records resource_registry
      join public.training_sessions session_row
        on session_row.organisation_id = resource_registry.organisation_id
       and session_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'training_session'
        and resource_registry.retired_at is null
    ),
    (
      select assessment_row.organisational_unit_id
      from public.resource_records resource_registry
      join public.membership_skill_assessments assessment_row
        on assessment_row.organisation_id = resource_registry.organisation_id
       and assessment_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'skill_assessment'
        and resource_registry.retired_at is null
    ),
    (
      select ps_case.organisation_unit_id
      from public.resource_records resource_registry
      join public.problem_solving_cases ps_case
        on ps_case.organisation_id = resource_registry.organisation_id
       and ps_case.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'problem_solving_case'
        and resource_registry.retired_at is null
    ),
    (
      select suggestion_row.origin_unit_id
      from public.resource_records resource_registry
      join public.improvement_suggestions suggestion_row
        on suggestion_row.organisation_id = resource_registry.organisation_id
       and suggestion_row.id = resource_registry.id
      where resource_registry.organisation_id = target_organisation_id
        and resource_registry.id = target_resource_id
        and resource_registry.resource_type = 'improvement_suggestion'
        and resource_registry.retired_at is null
    )
  )
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
      or private.can_upload_suggestion_evidence(
        target_organisation_id,
        target_resource_id
      )
    )
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
  normalised_filename text := btrim(coalesce(target_filename, ''));
  normalised_mime_type text := btrim(coalesce(target_mime_type, ''));
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_upload_attachments(org_id, target_resource_id) then
    raise exception 'attachment upload is not authorised'
      using errcode = '42501';
  end if;

  if not private.attachment_payload_is_allowed(
    normalised_filename,
    normalised_mime_type,
    target_byte_size
  ) then
    raise exception 'attachment file type or size is not allowed'
      using errcode = '22023';
  end if;

  select resource_registry.resource_type
  into resource_type
  from public.resource_records resource_registry
  where resource_registry.organisation_id = org_id
    and resource_registry.id = target_resource_id;

  if resource_type is null then
    raise exception 'attachment upload is not authorised'
      using errcode = '42501';
  end if;

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
    normalised_filename,
    normalised_mime_type,
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

drop policy if exists attachments_select_active on public.attachments;

create policy attachments_select_active
on public.attachments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and lifecycle = 'active'
  and private.can_access_attachment_target(organisation_id, id)
  and (
    private.has_scoped_permission(
      organisation_id,
      'attachments.read',
      null,
      null
    )
    or private.can_read_suggestion_evidence(
      organisation_id,
      target_resource_id
    )
  )
);

drop policy if exists organisation_evidence_read on storage.objects;

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
      and private.can_access_attachment_target(
        attachment_row.organisation_id,
        attachment_row.id
      )
      and (
        private.has_scoped_permission(
          attachment_row.organisation_id,
          'attachments.read',
          null,
          null
        )
        or private.can_read_suggestion_evidence(
          attachment_row.organisation_id,
          attachment_row.target_resource_id
        )
      )
  )
);

alter function private.attachment_payload_is_allowed(text, text, bigint)
  owner to postgres;
alter function private.can_upload_suggestion_evidence(uuid, uuid)
  owner to postgres;
alter function private.can_read_suggestion_evidence(uuid, uuid)
  owner to postgres;
alter function private.resolve_attachment_target_unit_id(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.can_upload_attachments(uuid, uuid)
  owner to postgres;
alter function private.initiate_attachment_upload(uuid, text, text, bigint)
  owner to postgres;

revoke all on function private.attachment_payload_is_allowed(text, text, bigint)
  from public, anon;
revoke all on function private.can_upload_suggestion_evidence(uuid, uuid)
  from public, anon;
revoke all on function private.can_read_suggestion_evidence(uuid, uuid)
  from public, anon;

grant execute on function private.attachment_payload_is_allowed(text, text, bigint)
  to authenticated;
grant execute on function private.can_upload_suggestion_evidence(uuid, uuid)
  to authenticated;
grant execute on function private.can_read_suggestion_evidence(uuid, uuid)
  to authenticated;

-- Pre-submit recovery only: archive the author's own draft evidence.
-- Does not accept a storage path and does not delete storage objects.
create or replace function private.withdraw_suggestion_evidence(
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
  actor_membership_id uuid := private.current_membership_id(org_id);
  attachment_row public.attachments%rowtype;
  resource_type text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion evidence withdraw is not authorised'
      using errcode = '42501';
  end if;

  select attachment_table.*
  into attachment_row
  from public.attachments attachment_table
  where attachment_table.organisation_id = org_id
    and attachment_table.id = target_attachment_id
  for update;

  if not found then
    raise exception 'suggestion evidence withdraw is not authorised'
      using errcode = '42501';
  end if;

  select resource_registry.resource_type
  into resource_type
  from public.resource_records resource_registry
  where resource_registry.organisation_id = org_id
    and resource_registry.id = attachment_row.target_resource_id
    and resource_registry.retired_at is null;

  if resource_type is distinct from 'improvement_suggestion' then
    raise exception 'suggestion evidence withdraw is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_upload_suggestion_evidence(
    org_id,
    attachment_row.target_resource_id
  ) then
    raise exception 'suggestion evidence withdraw is not authorised'
      using errcode = '42501';
  end if;

  if attachment_row.lifecycle not in ('pending_upload', 'active') then
    raise exception 'suggestion evidence cannot be withdrawn'
      using errcode = '55000';
  end if;

  update public.attachments attachment_table
  set lifecycle = 'archived',
      updated_at = statement_timestamp()
  where attachment_table.organisation_id = org_id
    and attachment_table.id = target_attachment_id
    and attachment_table.lifecycle in ('pending_upload', 'active');

  return found;
end;
$$;

create or replace function public.withdraw_suggestion_evidence(
  target_attachment_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.withdraw_suggestion_evidence(target_attachment_id)
$$;

alter function private.withdraw_suggestion_evidence(uuid) owner to postgres;
alter function public.withdraw_suggestion_evidence(uuid) owner to postgres;

revoke all on function private.withdraw_suggestion_evidence(uuid)
  from public, anon;
revoke all on function public.withdraw_suggestion_evidence(uuid)
  from public, anon;

grant execute on function private.withdraw_suggestion_evidence(uuid)
  to authenticated;
grant execute on function public.withdraw_suggestion_evidence(uuid)
  to authenticated;
