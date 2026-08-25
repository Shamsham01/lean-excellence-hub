alter table public.permission_definitions
  drop constraint permission_definitions_key_check;

alter table public.permission_definitions
  add constraint permission_definitions_key_check
  check (
    permission_key = lower(permission_key)
    and permission_key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_][a-z0-9_]*)+$'
  );

insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('maturity.read', 'Read maturity models and assessments within authorised scope.', false),
  ('maturity.models.manage', 'Create, edit, publish, and archive maturity models.', false),
  ('maturity.assess.self', 'Start and complete self-assessments within authorised scope.', false),
  ('maturity.assess.formal', 'Start and submit formal assessments within authorised scope.', false),
  ('maturity.review', 'Begin assessor review on submitted formal assessments.', false),
  ('maturity.approve', 'Approve formal assessments after review.', false),
  ('maturity.results.publish', 'Publish official maturity assessment results.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array[
    'maturity.read',
    'maturity.models.manage',
    'maturity.assess.self',
    'maturity.assess.formal',
    'maturity.review',
    'maturity.approve',
    'maturity.results.publish'
  ]::text[]
);

alter table public.resource_records
  drop constraint resource_records_type_check;

alter table public.resource_records
  add constraint resource_records_type_check
  check (
    resource_type in (
      'action',
      'template',
      'template_submission',
      'attachment',
      'comment',
      'maturity_model',
      'maturity_assessment'
    )
  );

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
    'comment',
    'maturity_model',
    'maturity_assessment'
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

create or replace function private.can_read_maturity_assessment(
  target_organisation_id uuid,
  target_assessment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
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
    when 'maturity_model' then
      return private.has_scoped_permission(
        target_organisation_id,
        'maturity.read',
        null,
        null
      );
    when 'maturity_assessment' then
      return private.can_read_maturity_assessment(
        target_organisation_id,
        target_resource_id
      );
    else
      return false;
  end case;
end;
$$;

alter function private.can_read_maturity_assessment(uuid, uuid)
  owner to lean_hub_private_owner;
