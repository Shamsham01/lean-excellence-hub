-- Extend can_access_resource for M6 resource types.

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
    when 'maturity_model' then
      return private.can_read_maturity_catalog(target_organisation_id);
    when 'maturity_assessment' then
      return private.can_read_maturity_assessment(
        target_organisation_id,
        target_resource_id
      );
    when 'schedule_definition' then
      return private.can_read_schedule_definition(
        target_organisation_id,
        target_resource_id
      );
    when 'five_s_standard' then
      return private.can_read_five_s_catalog(target_organisation_id);
    when 'five_s_audit' then
      return private.can_read_five_s_audit(
        target_organisation_id,
        target_resource_id
      );
    when 'gemba_definition' then
      return private.can_read_gemba_catalog(target_organisation_id);
    when 'gemba_walk' then
      return private.can_read_gemba_walk(
        target_organisation_id,
        target_resource_id
      );
    else
      return false;
  end case;
end;
$$;
