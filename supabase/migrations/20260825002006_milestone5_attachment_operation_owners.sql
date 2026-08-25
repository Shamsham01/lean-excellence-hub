-- Security-definer attachment operations must run as postgres to bypass reader RLS.

alter function private.initiate_attachment_upload(uuid, text, text, bigint)
  owner to postgres;
alter function private.confirm_attachment_upload(uuid)
  owner to postgres;
alter function private.can_upload_attachments(uuid, uuid)
  owner to postgres;
alter function private.resolve_attachment_target_unit_id(uuid, uuid)
  owner to postgres;
alter function private.link_maturity_evidence(uuid, uuid, uuid, uuid)
  owner to postgres;
