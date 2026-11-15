-- KAIZEN: guard problem-solving case link/unlink when the current work_item project is frozen.

create or replace function private.link_problem_solving_case_to_ci_project(
  target_case_id uuid,
  target_project_id uuid
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
  case_status text;
  current_work_item_project_id uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  select case_row.status
  into case_status
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_status not in ('draft', 'active') then
    raise exception
      'This case is closed or cancelled and cannot accept project links.'
      using errcode = '55000';
  end if;

  if not (
    private.can_manage_problem_solving_case(org_id, target_case_id)
    or private.can_contribute_problem_solving_case(org_id, target_case_id)
  ) then
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  select link_row.project_id
  into current_work_item_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  limit 1;

  if current_work_item_project_id is not null
    and current_work_item_project_id <> target_project_id then
    if not private.can_read_ci_project(org_id, current_work_item_project_id) then
      raise exception 'problem solving project link is not authorised'
        using errcode = '42501';
    end if;

    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      current_work_item_project_id
    );
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  delete from public.ci_project_source_links old_link
  where old_link.organisation_id = org_id
    and old_link.source_resource_id = target_case_id
    and old_link.link_kind = 'work_item';

  insert into public.ci_project_source_links (
    organisation_id,
    project_id,
    source_resource_id,
    created_by_membership_id,
    link_kind
  )
  values (
    org_id,
    target_project_id,
    target_case_id,
    actor_membership_id,
    'work_item'
  );

  return true;
end;
$$;

create or replace function private.unlink_problem_solving_case_from_ci_project(
  target_case_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  case_status text;
  linked_project_id uuid;
begin
  if org_id is null then
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  select case_row.status
  into case_status
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_status not in ('draft', 'active') then
    raise exception
      'This case is closed or cancelled and cannot change project links.'
      using errcode = '55000';
  end if;

  if not (
    private.can_manage_problem_solving_case(org_id, target_case_id)
    or private.can_contribute_problem_solving_case(org_id, target_case_id)
  ) then
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  select link_row.project_id
  into linked_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  limit 1;

  if linked_project_id is null then
    return true;
  end if;

  if not private.can_read_ci_project(org_id, linked_project_id) then
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_work_item_link_mutable(
    org_id,
    linked_project_id
  );

  delete from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item';

  return true;
end;
$$;