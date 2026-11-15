-- SENTINEL follow-up: existence oracle ordering, namespaced planner idempotency, and project assert hardening.

-- ── Idempotency helpers ─────────────────────────────────────────────────────

create or replace function private.namespaced_planner_action_idempotency_key(
  target_namespace text,
  target_membership_id uuid,
  target_client_key text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select target_namespace
    || ':'
    || target_membership_id::text
    || ':'
    || btrim(target_client_key);
$$;

create or replace function private.assert_gemba_planner_action_idempotency_replay(
  target_organisation_id uuid,
  target_actor_membership_id uuid,
  target_action_id uuid,
  target_walk_id uuid,
  target_section_id uuid,
  target_question_id uuid,
  target_observation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  action_row public.actions%rowtype;
  context_row public.gemba_action_context%rowtype;
begin
  select action_item.*
  into action_row
  from public.actions action_item
  where action_item.organisation_id = target_organisation_id
    and action_item.id = target_action_id;

  if not found then
    raise exception 'gemba action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;

  if action_row.created_by_membership_id is distinct from target_actor_membership_id
    or action_row.source_resource_id is distinct from target_walk_id then
    raise exception 'gemba action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;

  select context_item.*
  into context_row
  from public.gemba_action_context context_item
  where context_item.organisation_id = target_organisation_id
    and context_item.action_id = target_action_id;

  if not found then
    return;
  end if;

  if context_row.walk_id is distinct from target_walk_id
    or context_row.section_id is distinct from target_section_id
    or context_row.question_id is distinct from target_question_id
    or context_row.observation_id is distinct from target_observation_id then
    raise exception 'gemba action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;
end;
$$;

create or replace function private.assert_five_s_planner_action_idempotency_replay(
  target_organisation_id uuid,
  target_actor_membership_id uuid,
  target_action_id uuid,
  target_audit_id uuid,
  target_section_id uuid,
  target_question_id uuid,
  target_finding_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  action_row public.actions%rowtype;
  context_row public.five_s_action_context%rowtype;
begin
  select action_item.*
  into action_row
  from public.actions action_item
  where action_item.organisation_id = target_organisation_id
    and action_item.id = target_action_id;

  if not found then
    raise exception '5S action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;

  if action_row.created_by_membership_id is distinct from target_actor_membership_id
    or action_row.source_resource_id is distinct from target_audit_id then
    raise exception '5S action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;

  select context_item.*
  into context_row
  from public.five_s_action_context context_item
  where context_item.organisation_id = target_organisation_id
    and context_item.action_id = target_action_id;

  if not found then
    return;
  end if;

  if context_row.audit_id is distinct from target_audit_id
    or context_row.section_id is distinct from target_section_id
    or context_row.question_id is distinct from target_question_id
    or context_row.finding_id is distinct from target_finding_id then
    raise exception '5S action idempotency key reuse mismatch'
      using errcode = '23505';
  end if;
end;
$$;

-- ── Project link asserts: fold missing projects into 42501 ──────────────────

create or replace function private.assert_ci_project_accepts_work_item_links(
  target_organisation_id uuid,
  target_project_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  project_status text;
begin
  if not private.can_read_ci_project(target_organisation_id, target_project_id) then
    raise exception 'project link is not authorised'
      using errcode = '42501';
  end if;

  select project_row.status
  into project_status
  from public.ci_projects project_row
  where project_row.organisation_id = target_organisation_id
    and project_row.id = target_project_id
  for share;

  if not found then
    raise exception 'project link is not authorised'
      using errcode = '42501';
  end if;

  if not private.ci_project_accepts_work_item_links(
    target_organisation_id,
    target_project_id
  ) then
    raise exception
      'This project is completed or cancelled and cannot accept new links.'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function private.assert_ci_project_work_item_link_mutable(
  target_organisation_id uuid,
  target_project_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  project_status text;
begin
  if target_project_id is null then
    return;
  end if;

  select project_row.status
  into project_status
  from public.ci_projects project_row
  where project_row.organisation_id = target_organisation_id
    and project_row.id = target_project_id
  for share;

  if not found then
    raise exception 'project link is not authorised'
      using errcode = '42501';
  end if;

  if not private.ci_project_accepts_work_item_links(
    target_organisation_id,
    target_project_id
  ) then
    raise exception
      'This project link is read-only because the project is completed or cancelled.'
      using errcode = '55000';
  end if;
end;
$$;

-- ── Gemba observation ↔ project (existence oracle ordering) ───────────────────

create or replace function private.set_gemba_observation_linked_project(
  target_observation_id uuid,
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
  walk_id uuid;
  walk_status text;
  current_linked_project_id uuid;
begin
  if org_id is null then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.gemba_walk_observations observation_row
    join public.gemba_walks walk_row
      on walk_row.organisation_id = observation_row.organisation_id
     and walk_row.id = observation_row.walk_id
    where observation_row.organisation_id = org_id
      and observation_row.id = target_observation_id
      and private.can_read_gemba_walk(org_id, walk_row.id)
  ) then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  select observation_row.walk_id, observation_row.linked_project_id
  into walk_id, current_linked_project_id
  from public.gemba_walk_observations observation_row
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id
  for update;

  if not found then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  select walk_row.status
  into walk_status
  from public.gemba_walks walk_row
  where walk_row.organisation_id = org_id
    and walk_row.id = walk_id
  for share;

  if walk_status not in ('draft', 'in_progress') then
    raise exception
      'This walk is completed or cancelled and cannot accept project links.'
      using errcode = '55000';
  end if;

  if not private.can_edit_gemba_walk(org_id, walk_id) then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  if not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  if current_linked_project_id is not null
    and current_linked_project_id <> target_project_id then
    if not private.can_read_ci_project(org_id, current_linked_project_id) then
      if private.ci_project_accepts_work_item_links(
        org_id,
        current_linked_project_id
      ) then
        raise exception 'gemba observation project link is not authorised'
          using errcode = '42501';
      end if;
    end if;

    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      current_linked_project_id
    );
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');
  perform private.assert_current_organisation_module_entitled('projects');

  update public.gemba_walk_observations observation_row
  set linked_project_id = target_project_id
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

  return true;
end;
$$;

create or replace function private.clear_gemba_observation_linked_project(
  target_observation_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  walk_id uuid;
  walk_status text;
  linked_project_id uuid;
begin
  if org_id is null then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.gemba_walk_observations observation_row
    join public.gemba_walks walk_row
      on walk_row.organisation_id = observation_row.organisation_id
     and walk_row.id = observation_row.walk_id
    where observation_row.organisation_id = org_id
      and observation_row.id = target_observation_id
      and private.can_read_gemba_walk(org_id, walk_row.id)
  ) then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  select observation_row.walk_id, observation_row.linked_project_id
  into walk_id, linked_project_id
  from public.gemba_walk_observations observation_row
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id
  for update;

  if not found then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  select walk_row.status
  into walk_status
  from public.gemba_walks walk_row
  where walk_row.organisation_id = org_id
    and walk_row.id = walk_id
  for share;

  if walk_status not in ('draft', 'in_progress') then
    raise exception
      'This walk is completed or cancelled and cannot change project links.'
      using errcode = '55000';
  end if;

  if not private.can_edit_gemba_walk(org_id, walk_id) then
    raise exception 'gemba observation project unlink is not authorised'
      using errcode = '42501';
  end if;

  if linked_project_id is not null then
    if not private.can_read_ci_project(org_id, linked_project_id) then
      if private.ci_project_accepts_work_item_links(org_id, linked_project_id) then
        raise exception 'gemba observation project unlink is not authorised'
          using errcode = '42501';
      end if;
    end if;

    perform private.assert_ci_project_work_item_link_mutable(
      org_id,
      linked_project_id
    );
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');

  update public.gemba_walk_observations observation_row
  set linked_project_id = null
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

  return true;
end;
$$;

-- ── Problem-solving case ↔ project (existence oracle ordering) ───────────────

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

  if not (
    private.can_manage_problem_solving_case(org_id, target_case_id)
    or private.can_contribute_problem_solving_case(org_id, target_case_id)
  ) then
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
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  if case_status not in ('draft', 'active') then
    raise exception
      'This case is closed or cancelled and cannot accept project links.'
      using errcode = '55000';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  if not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'problem solving project link is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.ci_project_source_links link_row
    where link_row.organisation_id = org_id
      and link_row.project_id = target_project_id
      and link_row.source_resource_id = target_case_id
      and link_row.link_kind = 'source'
  ) then
    raise exception 'This case already raised this project'
      using errcode = '22023';
  end if;

  select link_row.project_id
  into current_work_item_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  for update;

  if current_work_item_project_id is not null
    and current_work_item_project_id <> target_project_id then
    if not private.can_read_ci_project(org_id, current_work_item_project_id) then
      if private.ci_project_accepts_work_item_links(
        org_id,
        current_work_item_project_id
      ) then
        raise exception 'problem solving project link is not authorised'
          using errcode = '42501';
      end if;
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

  if not (
    private.can_manage_problem_solving_case(org_id, target_case_id)
    or private.can_contribute_problem_solving_case(org_id, target_case_id)
  ) then
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
    raise exception 'problem solving project unlink is not authorised'
      using errcode = '42501';
  end if;

  if case_status not in ('draft', 'active') then
    raise exception
      'This case is closed or cancelled and cannot change project links.'
      using errcode = '55000';
  end if;

  select link_row.project_id
  into linked_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  for update;

  if linked_project_id is null then
    return true;
  end if;

  if not private.can_read_ci_project(org_id, linked_project_id) then
    if private.ci_project_accepts_work_item_links(org_id, linked_project_id) then
      raise exception 'problem solving project unlink is not authorised'
        using errcode = '42501';
    end if;
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
-- ── Planner actions: namespaced idempotency + FOR SHARE walk/audit ────────────

create or replace function private.create_gemba_action(
  target_title text,
  target_walk_id uuid,
  target_assignee_membership_id uuid,
  target_due_at timestamptz,
  target_idempotency_key text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null,
  target_description text default null,
  target_priority text default 'normal'
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
  namespaced_idempotency_key text;
  unit_id uuid;
  walk_template_version_id uuid;
  observation_row public.gemba_walk_observations%rowtype;
  new_action_id uuid;
  resolved_assignee uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_due_at is null then
    raise exception 'gemba actions require a due date'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null
    or btrim(target_idempotency_key) = '' then
    raise exception 'gemba actions require an idempotency key'
      using errcode = '22023';
  end if;

  namespaced_idempotency_key := private.namespaced_planner_action_idempotency_key(
    'gemba',
    actor_membership_id,
    target_idempotency_key
  );

  resolved_assignee := coalesce(
    target_assignee_membership_id,
    actor_membership_id
  );

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.id = resolved_assignee
  ) then
    raise exception 'assignee is not authorised'
      using errcode = '42501';
  end if;

  select walk_row.unit_id, definition_version.template_version_id
  into unit_id, walk_template_version_id
  from public.gemba_walks walk_row
  join public.gemba_definition_versions definition_version
    on definition_version.organisation_id = walk_row.organisation_id
   and definition_version.id = walk_row.definition_version_id
  where walk_row.organisation_id = org_id
    and walk_row.id = target_walk_id
  for share;

  if not found then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');
  perform private.assert_current_organisation_module_entitled('actions');

  if target_observation_id is not null then
    select observation_item.*
    into observation_row
    from public.gemba_walk_observations observation_item
    where observation_item.organisation_id = org_id
      and observation_item.id = target_observation_id
      and observation_item.walk_id = target_walk_id;

    if not found then
      raise exception 'gemba observation was not found on this walk'
        using errcode = 'P0002';
    end if;

    if target_section_id is not null
      and observation_row.section_id is distinct from target_section_id then
      raise exception 'observation section does not match walk context'
        using errcode = '22023';
    end if;

    if target_question_id is not null
      and observation_row.question_id is distinct from target_question_id then
      raise exception 'observation question does not match walk context'
        using errcode = '22023';
    end if;

    target_section_id := coalesce(target_section_id, observation_row.section_id);
    target_question_id := coalesce(
      target_question_id,
      observation_row.question_id
    );
  end if;

  if target_section_id is not null
    and not exists (
      select 1
      from public.template_sections section_row
      where section_row.organisation_id = org_id
        and section_row.id = target_section_id
        and section_row.template_version_id = walk_template_version_id
    ) then
    raise exception 'section does not belong to this walk'
      using errcode = '22023';
  end if;

  if target_question_id is not null
    and not exists (
      select 1
      from public.template_questions question_row
      where question_row.organisation_id = org_id
        and question_row.id = target_question_id
        and question_row.template_version_id = walk_template_version_id
        and (
          target_section_id is null
          or question_row.section_id = target_section_id
        )
    ) then
    raise exception 'question does not belong to this walk'
      using errcode = '22023';
  end if;

  select action_row.id
  into new_action_id
  from public.actions action_row
  where action_row.organisation_id = org_id
    and action_row.idempotency_key = namespaced_idempotency_key;

  if new_action_id is not null then
    perform private.assert_gemba_planner_action_idempotency_replay(
      org_id,
      actor_membership_id,
      new_action_id,
      target_walk_id,
      target_section_id,
      target_question_id,
      target_observation_id
    );

    if exists (
      select 1
      from public.gemba_action_context context_row
      where context_row.organisation_id = org_id
        and context_row.action_id = new_action_id
    ) then
      return new_action_id;
    end if;
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_walk_id,
    target_due_at,
    namespaced_idempotency_key
  );

  perform private.assert_gemba_planner_action_idempotency_replay(
    org_id,
    actor_membership_id,
    new_action_id,
    target_walk_id,
    target_section_id,
    target_question_id,
    target_observation_id
  );

  if exists (
    select 1
    from public.gemba_action_context context_row
    where context_row.organisation_id = org_id
      and context_row.action_id = new_action_id
  ) then
    return new_action_id;
  end if;

  perform private.set_action_assignee(new_action_id, resolved_assignee);

  begin
    insert into public.gemba_action_context (
      organisation_id,
      action_id,
      walk_id,
      section_id,
      question_id,
      observation_id,
      created_by_membership_id
    )
    values (
      org_id,
      new_action_id,
      target_walk_id,
      target_section_id,
      target_question_id,
      target_observation_id,
      actor_membership_id
    );
  exception
    when unique_violation then
      select action_row.id
      into new_action_id
      from public.actions action_row
      where action_row.organisation_id = org_id
        and action_row.idempotency_key = namespaced_idempotency_key;

      perform private.assert_gemba_planner_action_idempotency_replay(
        org_id,
        actor_membership_id,
        new_action_id,
        target_walk_id,
        target_section_id,
        target_question_id,
        target_observation_id
      );
  end;

  return new_action_id;
end;
$$;

create or replace function private.create_five_s_action(
  target_title text,
  target_audit_id uuid,
  target_assignee_membership_id uuid,
  target_due_at timestamptz,
  target_idempotency_key text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_finding_id uuid default null,
  target_description text default null,
  target_priority text default 'normal'
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
  namespaced_idempotency_key text;
  unit_id uuid;
  audit_template_version_id uuid;
  finding_row public.five_s_audit_findings%rowtype;
  new_action_id uuid;
  resolved_assignee uuid;
begin
  if org_id is null
    or actor_membership_id is null then
    raise exception '5S action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_due_at is null then
    raise exception '5S actions require a due date'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null
    or btrim(target_idempotency_key) = '' then
    raise exception '5S actions require an idempotency key'
      using errcode = '22023';
  end if;

  namespaced_idempotency_key := private.namespaced_planner_action_idempotency_key(
    'five_s',
    actor_membership_id,
    target_idempotency_key
  );

  resolved_assignee := coalesce(
    target_assignee_membership_id,
    actor_membership_id
  );

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.id = resolved_assignee
  ) then
    raise exception 'assignee is not authorised'
      using errcode = '42501';
  end if;

  select audit_row.unit_id, standard_version.template_version_id
  into unit_id, audit_template_version_id
  from public.five_s_audits audit_row
  join public.five_s_standard_versions standard_version
    on standard_version.organisation_id = audit_row.organisation_id
   and standard_version.id = audit_row.standard_version_id
  where audit_row.organisation_id = org_id
    and audit_row.id = target_audit_id
  for share;

  if not found then
    raise exception '5S action creation is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_edit_five_s_audit(org_id, target_audit_id) then
    raise exception '5S action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('five_s');
  perform private.assert_current_organisation_module_entitled('actions');

  if target_finding_id is not null then
    select finding_item.*
    into finding_row
    from public.five_s_audit_findings finding_item
    where finding_item.organisation_id = org_id
      and finding_item.id = target_finding_id
      and finding_item.audit_id = target_audit_id;

    if not found then
      raise exception '5S finding was not found on this audit'
        using errcode = 'P0002';
    end if;

    if target_section_id is not null
      and finding_row.section_id is distinct from target_section_id then
      raise exception 'finding section does not match audit context'
        using errcode = '22023';
    end if;

    if target_question_id is not null
      and finding_row.question_id is distinct from target_question_id then
      raise exception 'finding question does not match audit context'
        using errcode = '22023';
    end if;

    target_section_id := coalesce(target_section_id, finding_row.section_id);
    target_question_id := coalesce(
      target_question_id,
      finding_row.question_id
    );
  end if;

  if target_section_id is not null
    and not exists (
      select 1
      from public.template_sections section_row
      where section_row.organisation_id = org_id
        and section_row.id = target_section_id
        and section_row.template_version_id = audit_template_version_id
    ) then
    raise exception 'section does not belong to this audit'
      using errcode = '22023';
  end if;

  if target_question_id is not null
    and not exists (
      select 1
      from public.template_questions question_row
      where question_row.organisation_id = org_id
        and question_row.id = target_question_id
        and question_row.template_version_id = audit_template_version_id
        and (
          target_section_id is null
          or question_row.section_id = target_section_id
        )
    ) then
    raise exception 'question does not belong to this audit'
      using errcode = '22023';
  end if;

  select action_row.id
  into new_action_id
  from public.actions action_row
  where action_row.organisation_id = org_id
    and action_row.idempotency_key = namespaced_idempotency_key;

  if new_action_id is not null then
    perform private.assert_five_s_planner_action_idempotency_replay(
      org_id,
      actor_membership_id,
      new_action_id,
      target_audit_id,
      target_section_id,
      target_question_id,
      target_finding_id
    );

    if exists (
      select 1
      from public.five_s_action_context context_row
      where context_row.organisation_id = org_id
        and context_row.action_id = new_action_id
    ) then
      return new_action_id;
    end if;
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_audit_id,
    target_due_at,
    namespaced_idempotency_key
  );

  perform private.assert_five_s_planner_action_idempotency_replay(
    org_id,
    actor_membership_id,
    new_action_id,
    target_audit_id,
    target_section_id,
    target_question_id,
    target_finding_id
  );

  if exists (
    select 1
    from public.five_s_action_context context_row
    where context_row.organisation_id = org_id
      and context_row.action_id = new_action_id
  ) then
    return new_action_id;
  end if;

  perform private.set_action_assignee(new_action_id, resolved_assignee);

  begin
    insert into public.five_s_action_context (
      organisation_id,
      action_id,
      audit_id,
      section_id,
      question_id,
      finding_id,
      created_by_membership_id
    )
    values (
      org_id,
      new_action_id,
      target_audit_id,
      target_section_id,
      target_question_id,
      target_finding_id,
      actor_membership_id
    );
  exception
    when unique_violation then
      select action_row.id
      into new_action_id
      from public.actions action_row
      where action_row.organisation_id = org_id
        and action_row.idempotency_key = namespaced_idempotency_key;

      perform private.assert_five_s_planner_action_idempotency_replay(
        org_id,
        actor_membership_id,
        new_action_id,
        target_audit_id,
        target_section_id,
        target_question_id,
        target_finding_id
      );
  end;

  return new_action_id;
end;
$$;
