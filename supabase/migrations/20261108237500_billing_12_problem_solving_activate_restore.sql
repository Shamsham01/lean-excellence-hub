-- BILLING-12: Restore pinned-draft activation semantics dropped in BILLING-06.

create or replace function private.activate_problem_solving_case(
  target_case_id uuid,
  target_method_id uuid
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
  case_row public.problem_solving_cases%rowtype;
  pinned_version_row public.problem_solving_method_versions%rowtype;
  resolved_method_version_id uuid;
  first_stage_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case activation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'draft' then
    raise exception 'case activation requires a draft case'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'case activation is not authorised'
      using errcode = '42501';
  end if;

  if case_row.method_version_id is not null then
    select version_row.*
    into pinned_version_row
    from public.problem_solving_method_versions version_row
    where version_row.organisation_id = org_id
      and version_row.id = case_row.method_version_id;

    if not found then
      raise exception 'pinned method version not found'
        using errcode = 'P0002';
    end if;

    if pinned_version_row.method_id <> target_method_id then
      raise exception 'activation method does not match pinned method version'
        using errcode = '22023';
    end if;

    if pinned_version_row.status = 'draft' then
      raise exception 'pinned method version is not published'
        using errcode = '55000';
    end if;

    resolved_method_version_id := pinned_version_row.id;
  else
    select mv.id
    into resolved_method_version_id
    from public.problem_solving_method_versions mv
    where mv.organisation_id = org_id
      and mv.method_id = target_method_id
      and mv.status = 'published'
    order by mv.version_number desc
    limit 1;

    if resolved_method_version_id is null then
      raise exception 'no published method version found'
        using errcode = 'P0002';
    end if;
  end if;

  select stage.id
  into first_stage_id
  from public.problem_solving_method_stages stage
  where stage.organisation_id = org_id
    and stage.method_version_id = resolved_method_version_id
  order by stage.display_order asc
  limit 1;

  if first_stage_id is null then
    raise exception 'method version has no stages'
      using errcode = 'P0002';
  end if;

  update public.problem_solving_cases ps_case
  set method_version_id = resolved_method_version_id,
      current_method_stage_id = first_stage_id,
      status = 'active',
      activated_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_status_history (
    organisation_id,
    case_id,
    from_status,
    to_status,
    changed_by_membership_id,
    rationale
  )
  values (
    org_id,
    target_case_id,
    'draft',
    'active',
    actor_membership_id,
    'method activated'
  );

  insert into public.problem_solving_stage_history (
    organisation_id,
    case_id,
    from_stage_id,
    to_stage_id,
    changed_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    null,
    first_stage_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.case_activated',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'method_version_id', resolved_method_version_id,
      'first_stage_id', first_stage_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCaseActivated',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'method_version_id', resolved_method_version_id,
      'first_stage_id', first_stage_id
    )
  );

  return true;
end;
$$;
