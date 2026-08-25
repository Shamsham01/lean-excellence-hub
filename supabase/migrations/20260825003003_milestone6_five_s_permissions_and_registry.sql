insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('five_s.read', 'Read 5S standards and audits within authorised scope.', false),
  ('five_s.standards.manage', 'Create, edit, publish, and archive 5S standards.', false),
  ('five_s.audit.perform', 'Start and complete 5S audits within authorised scope.', false),
  ('five_s.audit.review', 'Review completed 5S audits within authorised scope.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array[
    'five_s.read',
    'five_s.standards.manage',
    'five_s.audit.perform',
    'five_s.audit.review'
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
      'five_s_audit'
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
    'five_s_audit'
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
