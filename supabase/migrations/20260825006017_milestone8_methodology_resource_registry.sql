-- Register CI project methodologies in the resource registry so lifecycle audit events succeed.

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
      'recognition_award'
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
    'recognition_award'
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

create or replace function private.create_ci_project_methodology_draft(
  target_name text,
  target_code text,
  target_description text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_methodology_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_ci_project_methodologies(org_id) then
    raise exception 'methodology creation is not authorised'
      using errcode = '42501';
  end if;

  new_methodology_id := private.register_resource_record(
    org_id,
    'ci_project_methodology',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.ci_project_methodologies (
    organisation_id,
    id,
    name,
    code,
    description,
    created_by_membership_id
  )
  values (
    org_id,
    new_methodology_id,
    btrim(target_name),
    btrim(target_code),
    target_description,
    actor_membership_id
  );

  insert into public.ci_project_methodology_versions (
    organisation_id,
    methodology_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    new_methodology_id,
    1,
    'draft',
    actor_membership_id
  );

  return new_methodology_id;
end;
$$;

insert into public.resource_records (
  id,
  organisation_id,
  resource_type,
  created_by_membership_id
)
select
  methodology_row.id,
  methodology_row.organisation_id,
  'ci_project_methodology',
  methodology_row.created_by_membership_id
from public.ci_project_methodologies methodology_row
where not exists (
  select 1
  from public.resource_records resource_row
  where resource_row.organisation_id = methodology_row.organisation_id
    and resource_row.id = methodology_row.id
);

alter function private.register_resource_record(uuid, text, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.create_ci_project_methodology_draft(text, text, text)
  owner to lean_hub_private_owner;
