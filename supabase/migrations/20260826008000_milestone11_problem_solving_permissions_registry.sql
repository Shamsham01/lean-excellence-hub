-- Milestone 11: problem solving permissions, resource registry extension.

insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('problem_solving.view', 'View problem solving cases within authorised scope.', false),
  ('problem_solving.create', 'Create problem solving case drafts within authorised scope.', false),
  ('problem_solving.contribute', 'Contribute to problem solving cases within authorised scope.', false),
  ('problem_solving.manage', 'Manage problem solving cases within authorised scope.', false),
  ('problem_solving.facilitate', 'Facilitate problem solving cases within authorised scope.', false),
  ('problem_solving.verify_cause', 'Verify root cause findings within authorised scope.', false),
  ('problem_solving.close', 'Close problem solving cases within authorised scope.', false),
  ('problem_solving.methods.manage', 'Manage problem solving methods and method versions.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array[
    'problem_solving.view',
    'problem_solving.create',
    'problem_solving.contribute',
    'problem_solving.manage',
    'problem_solving.facilitate',
    'problem_solving.verify_cause',
    'problem_solving.close',
    'problem_solving.methods.manage'
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
      'benefit_realisation_entry',
      'problem_solving_case'
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
    'benefit_realisation_entry',
    'problem_solving_case'
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

-- Stub can_access_resource case for problem_solving_case (completed in 08011).
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
    when 'training_course' then
      return private.can_read_training_catalog(target_organisation_id);
    when 'training_session' then
      return private.can_read_training_session(
        target_organisation_id,
        target_resource_id
      );
    when 'training_completion' then
      return private.can_read_training_completion(
        target_organisation_id,
        target_resource_id
      );
    when 'skill' then
      return private.can_read_skills_catalog(target_organisation_id);
    when 'skill_assessment' then
      return private.can_read_skill_assessment(
        target_organisation_id,
        target_resource_id
      );
    when 'ci_project' then
      return private.can_read_ci_project(
        target_organisation_id,
        target_resource_id
      );
    when 'improvement_suggestion' then
      return private.can_read_improvement_suggestion(
        target_organisation_id,
        target_resource_id
      );
    when 'recognition_award' then
      return private.can_read_recognition_award(
        target_organisation_id,
        target_resource_id
      );
    when 'improvement_benefit' then
      return private.can_read_improvement_benefit(
        target_organisation_id,
        target_resource_id
      );
    when 'benefit_realisation_entry' then
      return private.can_read_benefit_realisation_entry(
        target_organisation_id,
        target_resource_id
      );
    when 'problem_solving_case' then
      -- Stub: full implementation in 08011 migration.
      return private.has_scoped_permission(
        target_organisation_id,
        'problem_solving.view',
        null,
        null
      );
    else
      return false;
  end case;
end;
$$;

alter function private.can_access_resource(uuid, uuid) owner to lean_hub_private_owner;
