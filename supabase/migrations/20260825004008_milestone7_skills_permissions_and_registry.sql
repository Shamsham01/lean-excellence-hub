insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('skills.read', 'Read skills catalogue, requirements, and assessments within authorised scope.', false),
  ('skills.catalog.manage', 'Create, edit, and manage skills and proficiency scales.', false),
  ('skills.requirements.manage', 'Manage skill capability requirements.', false),
  ('skills.assess', 'Record and validate skill assessments within authorised scope.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array[
    'skills.read',
    'skills.catalog.manage',
    'skills.requirements.manage',
    'skills.assess'
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
      'maturity_assessment',
      'schedule_definition',
      'five_s_standard',
      'five_s_audit',
      'gemba_definition',
      'gemba_walk',
      'training_course',
      'training_session',
      'training_completion',
      'skill',
      'skill_assessment'
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
    'maturity_assessment',
    'schedule_definition',
    'five_s_standard',
    'five_s_audit',
    'gemba_definition',
    'gemba_walk',
    'training_course',
    'training_session',
    'training_completion',
    'skill',
    'skill_assessment'
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
