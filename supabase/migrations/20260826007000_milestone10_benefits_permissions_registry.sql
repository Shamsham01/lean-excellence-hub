-- Milestone 10: benefits permissions, registry, document sequence key.

insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('benefits.read', 'Read improvement benefits within authorised scope.', false),
  ('benefits.create', 'Create improvement benefit drafts within authorised scope.', false),
  ('benefits.manage', 'Manage improvement benefits within authorised scope.', false),
  ('benefits.validate.ci', 'Perform CI validation on improvement benefits within authorised scope.', false),
  ('benefits.validate.finance', 'Perform finance validation on financial improvement benefits within authorised scope.', false),
  ('benefits.realisation.record', 'Record benefit realisation entries within authorised scope.', false),
  ('benefits.realisation.validate', 'Validate benefit realisation entries within authorised scope.', false),
  ('benefits.categories.manage', 'Manage benefit categories and reporting settings.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array[
    'benefits.read',
    'benefits.create',
    'benefits.manage',
    'benefits.validate.ci',
    'benefits.validate.finance',
    'benefits.realisation.record',
    'benefits.realisation.validate',
    'benefits.categories.manage'
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
      'skill_assessment',
      'ci_project',
      'ci_project_methodology',
      'improvement_suggestion',
      'recognition_award',
      'improvement_benefit',
      'benefit_realisation_entry'
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
    'skill_assessment',
    'ci_project',
    'ci_project_methodology',
    'improvement_suggestion',
    'recognition_award',
    'improvement_benefit',
    'benefit_realisation_entry'
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

alter function private.register_resource_record(uuid, text, uuid, uuid)
  owner to lean_hub_private_owner;
