-- Action lifecycle operations and Suggestion → Action traceability.
-- Extends the canonical universal actions primitive; does not introduce a second model.

alter table public.actions
  add column if not exists action_number text;

alter table public.actions
  drop constraint if exists actions_action_number_check;

alter table public.actions
  add constraint actions_action_number_check
  check (
    action_number is null
    or (
      action_number = btrim(action_number)
      and char_length(action_number) between 3 and 40
    )
  );

create unique index if not exists actions_organisation_action_number_key
  on public.actions (organisation_id, action_number)
  where action_number is not null;

-- ---------------------------------------------------------------------------
-- create_action: allocate human-readable numbers and tolerate idempotent races
-- ---------------------------------------------------------------------------

create or replace function private.create_action(
  target_title text,
  target_description text default null,
  target_priority text default 'normal',
  target_unit_id uuid default null,
  target_source_resource_id uuid default null,
  target_due_at timestamptz default null,
  target_idempotency_key text default null
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
  new_action_id uuid;
  allocated_action_number text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.has_scoped_permission(org_id, 'actions.create', null, target_unit_id) then
    raise exception 'action creation is not authorised'
      using errcode = '42501';
  end if;

  if target_source_resource_id is not null
    and not private.can_reference_source_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not authorised'
      using errcode = '42501';
  end if;

  if target_idempotency_key is not null then
    select action_row.id
    into new_action_id
    from public.actions action_row
    where action_row.organisation_id = org_id
      and action_row.idempotency_key = target_idempotency_key;

    if new_action_id is not null then
      return new_action_id;
    end if;
  end if;

  allocated_action_number := private.allocate_organisation_document_number(
    org_id,
    'action',
    'ACT'
  );

  begin
    new_action_id := private.register_resource_record(
      org_id,
      'action',
      gen_random_uuid(),
      actor_membership_id
    );

    insert into public.actions (
      id,
      organisation_id,
      action_number,
      title,
      description,
      priority,
      unit_id,
      source_resource_id,
      created_by_membership_id,
      due_at,
      idempotency_key
    )
    values (
      new_action_id,
      org_id,
      allocated_action_number,
      target_title,
      target_description,
      target_priority,
      target_unit_id,
      target_source_resource_id,
      actor_membership_id,
      target_due_at,
      target_idempotency_key
    );
  exception
    when unique_violation then
      if target_idempotency_key is not null then
        select action_row.id
        into new_action_id
        from public.actions action_row
        where action_row.organisation_id = org_id
          and action_row.idempotency_key = target_idempotency_key;

        if new_action_id is not null then
          return new_action_id;
        end if;
      end if;
      raise;
  end;

  insert into public.action_status_transitions (
    organisation_id,
    action_id,
    from_status,
    to_status,
    actor_membership_id
  )
  values (
    org_id,
    new_action_id,
    'open',
    'open',
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'action.created',
    new_action_id,
    'succeeded',
    jsonb_build_object('action_number', allocated_action_number)
  );

  perform private.enqueue_domain_event(
    org_id,
    new_action_id,
    'ActionCreated',
    coalesce(target_idempotency_key, new_action_id::text),
    jsonb_build_object(
      'action_id', new_action_id,
      'action_number', allocated_action_number
    )
  );

  return new_action_id;
end;
$$;

do $$
declare
  action_row record;
begin
  for action_row in
    select existing.id, existing.organisation_id
    from public.actions existing
    where existing.action_number is null
    order by existing.created_at, existing.id
  loop
    update public.actions
    set action_number = private.allocate_organisation_document_number(
      action_row.organisation_id,
      'action',
      'ACT'
    )
    where public.actions.organisation_id = action_row.organisation_id
      and public.actions.id = action_row.id
      and public.actions.action_number is null;
  end loop;
end;
$$;

alter table public.actions
  alter column action_number set not null;

alter table public.actions
  drop constraint if exists actions_action_number_check;

alter table public.actions
  add constraint actions_action_number_check
  check (
    action_number = btrim(action_number)
    and char_length(action_number) between 3 and 40
  );

drop index if exists actions_organisation_action_number_key;

alter table public.actions
  drop constraint if exists actions_organisation_action_number_key;

alter table public.actions
  add constraint actions_organisation_action_number_key
  unique (organisation_id, action_number);

-- ---------------------------------------------------------------------------
-- Authorisation helpers — existing permission keys only; no RBAC broadening
-- ---------------------------------------------------------------------------

create or replace function private.action_has_current_assignee(
  target_organisation_id uuid,
  target_action_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.action_assignees assignee_row
    where assignee_row.organisation_id = target_organisation_id
      and assignee_row.action_id = target_action_id
      and assignee_row.membership_id = private.current_membership_id(target_organisation_id)
  )
$$;

create or replace function private.can_update_action(
  target_organisation_id uuid,
  target_action_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actions action_row
    where action_row.organisation_id = target_organisation_id
      and action_row.id = target_action_id
      and private.can_read_action(target_organisation_id, target_action_id)
      and private.has_scoped_permission(
        target_organisation_id,
        'actions.update',
        null,
        action_row.unit_id
      )
  )
$$;

create or replace function private.can_assign_action(
  target_organisation_id uuid,
  target_action_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actions action_row
    where action_row.organisation_id = target_organisation_id
      and action_row.id = target_action_id
      and private.can_read_action(target_organisation_id, target_action_id)
      and private.has_scoped_permission(
        target_organisation_id,
        'actions.assign',
        null,
        action_row.unit_id
      )
  )
$$;

create or replace function private.can_complete_action(
  target_organisation_id uuid,
  target_action_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.actions action_row
    where action_row.organisation_id = target_organisation_id
      and action_row.id = target_action_id
      and private.can_read_action(target_organisation_id, target_action_id)
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'actions.complete',
          null,
          action_row.unit_id
        )
        or (
          private.action_has_current_assignee(target_organisation_id, target_action_id)
          and private.has_scoped_permission(
            target_organisation_id,
            'actions.complete',
            private.current_membership_id(target_organisation_id),
            action_row.unit_id
          )
        )
      )
  )
$$;

create or replace function private.action_transition_is_allowed(
  from_status text,
  to_status text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    from_status is distinct from to_status
    and (
      (from_status = 'open' and to_status in ('in_progress', 'completed', 'cancelled'))
      or (from_status = 'in_progress' and to_status in ('open', 'completed', 'cancelled'))
      or (from_status = 'completed' and to_status = 'open')
      or (from_status = 'cancelled' and to_status = 'open')
    )
$$;

create or replace function private.can_transition_action_status(
  target_organisation_id uuid,
  target_action_id uuid,
  target_to_status text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_to_status = 'completed' then
    return private.can_complete_action(target_organisation_id, target_action_id);
  end if;

  if target_to_status = 'in_progress' then
    return private.can_update_action(target_organisation_id, target_action_id)
      or private.can_complete_action(target_organisation_id, target_action_id);
  end if;

  return private.can_update_action(target_organisation_id, target_action_id);
end;
$$;

create or replace function private.action_source_summary(
  target_organisation_id uuid,
  target_source_resource_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resource_row public.resource_records%rowtype;
  source_title text;
  source_reference text;
  source_href text;
begin
  if target_source_resource_id is null then
    return null;
  end if;

  select resource_registry.*
  into resource_row
  from public.resource_records resource_registry
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_source_resource_id
    and resource_registry.retired_at is null;

  if not found then
    return null;
  end if;

  if not private.can_access_resource(target_organisation_id, target_source_resource_id) then
    return null;
  end if;

  case resource_row.resource_type
    when 'improvement_suggestion' then
      select suggestion_row.title, suggestion_row.suggestion_number
      into source_title, source_reference
      from public.improvement_suggestions suggestion_row
      where suggestion_row.organisation_id = target_organisation_id
        and suggestion_row.id = target_source_resource_id;
      source_href := '/platform/suggestions/' || target_source_resource_id::text;
    when 'ci_project' then
      select project_row.title, project_row.project_number
      into source_title, source_reference
      from public.ci_projects project_row
      where project_row.organisation_id = target_organisation_id
        and project_row.id = target_source_resource_id;
      source_href := '/platform/projects/' || target_source_resource_id::text;
    when 'five_s_audit' then
      select coalesce(audit_row.standard_name_snapshot, '5S audit'),
             audit_row.unit_name_snapshot
      into source_title, source_reference
      from public.five_s_audits audit_row
      where audit_row.organisation_id = target_organisation_id
        and audit_row.id = target_source_resource_id;
      source_href := '/platform/5s/audits/' || target_source_resource_id::text;
    when 'gemba_walk' then
      select coalesce(walk_row.definition_name_snapshot, 'Gemba walk'),
             walk_row.unit_name_snapshot
      into source_title, source_reference
      from public.gemba_walks walk_row
      where walk_row.organisation_id = target_organisation_id
        and walk_row.id = target_source_resource_id;
      source_href := '/platform/gemba/walks/' || target_source_resource_id::text;
    when 'problem_solving_case' then
      select case_row.title, case_row.case_number
      into source_title, source_reference
      from public.problem_solving_cases case_row
      where case_row.organisation_id = target_organisation_id
        and case_row.id = target_source_resource_id;
      source_href := '/platform/problem-solving/' || target_source_resource_id::text;
    when 'maturity_assessment' then
      source_title := 'Maturity assessment';
      source_reference := null;
      source_href := '/platform/maturity/assessments/' || target_source_resource_id::text;
    else
      source_title := initcap(replace(resource_row.resource_type, '_', ' '));
      source_reference := null;
      source_href := null;
  end case;

  return jsonb_build_object(
    'id', target_source_resource_id,
    'resource_type', resource_row.resource_type,
    'title', source_title,
    'reference', source_reference,
    'href', source_href
  );
end;
$$;

create or replace function private.append_action_status_transition(
  target_organisation_id uuid,
  target_action_id uuid,
  target_from_status text,
  target_to_status text,
  target_actor_membership_id uuid,
  target_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  transition_id uuid;
begin
  insert into public.action_status_transitions (
    organisation_id,
    action_id,
    from_status,
    to_status,
    actor_membership_id,
    reason
  )
  values (
    target_organisation_id,
    target_action_id,
    target_from_status,
    target_to_status,
    target_actor_membership_id,
    nullif(btrim(coalesce(target_reason, '')), '')
  )
  returning id into transition_id;

  return transition_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mutations
-- ---------------------------------------------------------------------------

create or replace function private.update_action(
  target_action_id uuid,
  target_title text default null,
  target_description text default null,
  target_priority text default null,
  target_due_at timestamptz default null,
  target_clear_due_at boolean default false,
  target_expected_version integer default null
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
  action_row public.actions%rowtype;
  next_title text;
  next_description text;
  next_priority text;
  next_due_at timestamptz;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'action update is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id
  for update;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  if not private.can_update_action(org_id, target_action_id) then
    raise exception 'action update is not authorised'
      using errcode = '42501';
  end if;

  if action_row.status in ('completed', 'verified', 'cancelled') then
    raise exception 'completed actions cannot be edited'
      using errcode = '55000';
  end if;

  if target_expected_version is not null
    and action_row.version is distinct from target_expected_version then
    raise exception 'action changed since you opened it'
      using errcode = '55000';
  end if;

  next_title := coalesce(nullif(btrim(coalesce(target_title, '')), ''), action_row.title);
  next_description := case
    when target_description is null then action_row.description
    else nullif(btrim(target_description), '')
  end;
  next_priority := coalesce(nullif(btrim(coalesce(target_priority, '')), ''), action_row.priority);
  next_due_at := case
    when target_clear_due_at then null
    when target_due_at is null then action_row.due_at
    else target_due_at
  end;

  if next_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'invalid action priority'
      using errcode = '22023';
  end if;

  update public.actions action_table
  set title = next_title,
      description = next_description,
      priority = next_priority,
      due_at = next_due_at,
      version = action_row.version + 1,
      updated_at = statement_timestamp()
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id;

  perform private.append_business_audit(
    org_id,
    'action.updated',
    target_action_id,
    'succeeded',
    jsonb_build_object('version', action_row.version + 1)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_action_id,
    'ActionUpdated',
    format('action-updated:%s:%s', target_action_id, action_row.version + 1),
    jsonb_build_object('action_id', target_action_id)
  );

  return true;
end;
$$;

create or replace function private.set_action_assignee(
  target_action_id uuid,
  target_membership_id uuid default null
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
  action_row public.actions%rowtype;
  assignee_exists boolean;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'action assignment is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id
  for update;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  if not private.can_assign_action(org_id, target_action_id) then
    raise exception 'action assignment is not authorised'
      using errcode = '42501';
  end if;

  if action_row.status in ('completed', 'verified', 'cancelled') then
    raise exception 'completed actions cannot be reassigned'
      using errcode = '55000';
  end if;

  if target_membership_id is not null then
    select exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = org_id
        and membership_row.id = target_membership_id
        and membership_row.status = 'active'
    )
    into assignee_exists;

    if not assignee_exists then
      raise exception 'assignee is not an active organisation member'
        using errcode = '22023';
    end if;
  end if;

  delete from public.action_assignees assignee_row
  where assignee_row.organisation_id = org_id
    and assignee_row.action_id = target_action_id
    and (
      target_membership_id is null
      or assignee_row.membership_id is distinct from target_membership_id
    );

  if target_membership_id is not null then
    insert into public.action_assignees (
      organisation_id,
      action_id,
      membership_id,
      assigned_by_membership_id
    )
    values (
      org_id,
      target_action_id,
      target_membership_id,
      actor_membership_id
    )
    on conflict (organisation_id, action_id, membership_id) do nothing;
  end if;

  update public.actions action_table
  set version = action_row.version + 1,
      updated_at = statement_timestamp()
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id;

  perform private.append_business_audit(
    org_id,
    'action.assigned',
    target_action_id,
    'succeeded',
    jsonb_build_object(
      'membership_id', target_membership_id,
      'version', action_row.version + 1
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_action_id,
    'ActionAssigned',
    format('action-assigned:%s:%s', target_action_id, action_row.version + 1),
    jsonb_build_object(
      'action_id', target_action_id,
      'membership_id', target_membership_id
    )
  );

  return true;
end;
$$;

create or replace function private.transition_action_status(
  target_action_id uuid,
  target_to_status text,
  target_reason text default null,
  target_expected_version integer default null
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
  action_row public.actions%rowtype;
  transition_id uuid;
  next_completed_at timestamptz;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'action transition is not authorised'
      using errcode = '42501';
  end if;

  if target_to_status is null
    or target_to_status not in ('open', 'in_progress', 'completed', 'cancelled') then
    raise exception 'invalid action status'
      using errcode = '22023';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id
  for update;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  if not private.action_transition_is_allowed(action_row.status, target_to_status) then
    raise exception 'action transition is not allowed'
      using errcode = '55000';
  end if;

  if not private.can_transition_action_status(org_id, target_action_id, target_to_status) then
    raise exception 'action transition is not authorised'
      using errcode = '42501';
  end if;

  if target_expected_version is not null
    and action_row.version is distinct from target_expected_version then
    raise exception 'action changed since you opened it'
      using errcode = '55000';
  end if;

  next_completed_at := case
    when target_to_status = 'completed' then statement_timestamp()
    else null
  end;

  update public.actions action_table
  set status = target_to_status,
      completed_at = next_completed_at,
      version = action_row.version + 1,
      updated_at = statement_timestamp()
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id;

  transition_id := private.append_action_status_transition(
    org_id,
    target_action_id,
    action_row.status,
    target_to_status,
    actor_membership_id,
    target_reason
  );

  perform private.append_business_audit(
    org_id,
    case
      when target_to_status = 'completed' then 'action.completed'
      when action_row.status in ('completed', 'cancelled')
        and target_to_status = 'open' then 'action.reopened'
      else 'action.status_changed'
    end,
    target_action_id,
    'succeeded',
    jsonb_build_object(
      'from_status', action_row.status,
      'to_status', target_to_status,
      'transition_id', transition_id,
      'actor_membership_id', actor_membership_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_action_id,
    case
      when target_to_status = 'completed' then 'ActionCompleted'
      when action_row.status in ('completed', 'cancelled')
        and target_to_status = 'open' then 'ActionReopened'
      else 'ActionStatusChanged'
    end,
    format('action-status:%s:%s', target_action_id, action_row.version + 1),
    jsonb_build_object(
      'action_id', target_action_id,
      'from_status', action_row.status,
      'to_status', target_to_status
    )
  );

  return true;
end;
$$;

create or replace function private.complete_action(
  target_action_id uuid,
  target_reason text default null,
  target_expected_version integer default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return private.transition_action_status(
    target_action_id,
    'completed',
    target_reason,
    target_expected_version
  );
end;
$$;

create or replace function private.reopen_action(
  target_action_id uuid,
  target_reason text default null,
  target_expected_version integer default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return private.transition_action_status(
    target_action_id,
    'open',
    target_reason,
    target_expected_version
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

create or replace function public.get_action_detail(
  target_action_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  action_row public.actions%rowtype;
  creator_name text;
  unit_name text;
  assignees jsonb;
  history jsonb;
begin
  if org_id is null
    or not private.can_read_action(org_id, target_action_id) then
    raise exception 'action detail is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  select nullif(
    btrim(coalesce(membership_row.display_name, profile_row.display_name, '')),
    ''
  )
  into creator_name
  from public.organisation_memberships membership_row
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where membership_row.organisation_id = org_id
    and membership_row.id = action_row.created_by_membership_id;

  select unit_row.name
  into unit_name
  from public.organisation_units unit_row
  where unit_row.organisation_id = org_id
    and unit_row.id = action_row.unit_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'membership_id', assignee_row.membership_id,
        'display_name', coalesce(
          nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name, '')), ''),
          'Team member'
        ),
        'assigned_at', assignee_row.assigned_at
      )
      order by assignee_row.assigned_at
    ),
    '[]'::jsonb
  )
  into assignees
  from public.action_assignees assignee_row
  left join public.organisation_memberships membership_row
    on membership_row.organisation_id = assignee_row.organisation_id
   and membership_row.id = assignee_row.membership_id
  left join public.profiles profile_row
    on profile_row.user_id = membership_row.user_id
  where assignee_row.organisation_id = org_id
    and assignee_row.action_id = target_action_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', transition_row.id,
        'from_status', transition_row.from_status,
        'to_status', transition_row.to_status,
        'reason', transition_row.reason,
        'created_at', transition_row.created_at,
        'actor_membership_id', transition_row.actor_membership_id,
        'actor_display_name', coalesce(
          nullif(btrim(coalesce(actor_membership.display_name, actor_profile.display_name, '')), ''),
          'Team member'
        )
      )
      order by transition_row.created_at, transition_row.id
    ),
    '[]'::jsonb
  )
  into history
  from public.action_status_transitions transition_row
  left join public.organisation_memberships actor_membership
    on actor_membership.organisation_id = transition_row.organisation_id
   and actor_membership.id = transition_row.actor_membership_id
  left join public.profiles actor_profile
    on actor_profile.user_id = actor_membership.user_id
  where transition_row.organisation_id = org_id
    and transition_row.action_id = target_action_id;

  return jsonb_build_object(
    'id', action_row.id,
    'action_number', action_row.action_number,
    'title', action_row.title,
    'description', action_row.description,
    'status', action_row.status,
    'priority', action_row.priority,
    'due_at', action_row.due_at,
    'completed_at', action_row.completed_at,
    'verified_at', action_row.verified_at,
    'unit_id', action_row.unit_id,
    'unit_name', unit_name,
    'site_unit_id', action_row.site_unit_id,
    'source_resource_id', action_row.source_resource_id,
    'source', private.action_source_summary(org_id, action_row.source_resource_id),
    'created_by_membership_id', action_row.created_by_membership_id,
    'created_by_display_name', coalesce(creator_name, 'Team member'),
    'created_at', action_row.created_at,
    'updated_at', action_row.updated_at,
    'version', action_row.version,
    'assignees', assignees,
    'status_history', history,
    'permissions', jsonb_build_object(
      'can_update', private.can_update_action(org_id, target_action_id),
      'can_assign', private.can_assign_action(org_id, target_action_id),
      'can_complete', private.can_complete_action(org_id, target_action_id),
      'can_start', private.can_transition_action_status(org_id, target_action_id, 'in_progress'),
      'can_reopen', private.can_update_action(org_id, target_action_id),
      'can_cancel', private.can_update_action(org_id, target_action_id)
    )
  );
end;
$$;

create or replace function public.get_suggestion_detail(target_suggestion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  suggestion_row public.improvement_suggestions%rowtype;
  linked_actions jsonb;
begin
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion detail is not authorised'
      using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', action_row.id,
        'action_number', action_row.action_number,
        'title', action_row.title,
        'status', action_row.status,
        'href', '/platform/actions/' || action_row.id::text,
        'can_open', private.can_read_action(org_id, action_row.id)
      )
      order by action_row.created_at, action_row.id
    ),
    '[]'::jsonb
  )
  into linked_actions
  from public.suggestion_action_context context_row
  join public.actions action_row
    on action_row.organisation_id = context_row.organisation_id
   and action_row.id = context_row.action_id
  where context_row.organisation_id = org_id
    and context_row.suggestion_id = target_suggestion_id;

  return jsonb_build_object(
    'id', suggestion_row.id,
    'suggestion_number', suggestion_row.suggestion_number,
    'title', suggestion_row.title,
    'problem_or_opportunity', suggestion_row.problem_or_opportunity,
    'proposed_idea', suggestion_row.proposed_idea,
    'expected_benefit_summary', suggestion_row.expected_benefit_summary,
    'status', suggestion_row.status,
    'programme_name_snapshot', suggestion_row.programme_name_snapshot,
    'category_name_snapshot', suggestion_row.category_name_snapshot,
    'origin_unit_name_snapshot', suggestion_row.origin_unit_name_snapshot,
    'target_unit_name_snapshot', suggestion_row.target_unit_name_snapshot,
    'author_membership_id', suggestion_row.author_membership_id,
    'submitted_at', suggestion_row.submitted_at,
    'implementation_summary', suggestion_row.implementation_summary,
    'implementation_outcome', suggestion_row.implementation_outcome,
    'employee_outcome', suggestion_row.employee_outcome,
    'implemented_at', suggestion_row.implemented_at,
    'linked_actions', linked_actions
  );
end;
$$;

create or replace function private.create_suggestion_action(
  target_suggestion_id uuid,
  target_title text,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
  target_purpose text default null
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
  suggestion_row public.improvement_suggestions%rowtype;
  existing_action_id uuid;
  new_action_id uuid;
  idempotency_key text;
begin
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion action creation is not authorised'
      using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  if suggestion_row.status not in ('accepted', 'implementing') then
    raise exception 'suggestion is not eligible for action creation'
      using errcode = '55000';
  end if;

  idempotency_key := format('suggestion-action:%s', target_suggestion_id);

  select context_row.action_id
  into existing_action_id
  from public.suggestion_action_context context_row
  where context_row.organisation_id = org_id
    and context_row.suggestion_id = target_suggestion_id
  order by context_row.created_at, context_row.id
  limit 1;

  if existing_action_id is not null then
    return existing_action_id;
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    suggestion_row.review_jurisdiction_unit_id,
    target_suggestion_id,
    target_due_at,
    idempotency_key
  );

  insert into public.suggestion_action_context (
    organisation_id,
    suggestion_id,
    action_id,
    purpose,
    created_by_membership_id
  )
  values (
    org_id,
    target_suggestion_id,
    new_action_id,
    target_purpose,
    actor_membership_id
  )
  on conflict (organisation_id, action_id) do nothing;

  insert into public.suggestion_implementation_links (
    organisation_id,
    suggestion_id,
    implementation_resource_id,
    implementation_role,
    created_by_membership_id
  )
  values (
    org_id,
    target_suggestion_id,
    new_action_id,
    'action',
    actor_membership_id
  )
  on conflict (organisation_id, suggestion_id, implementation_resource_id, implementation_role)
  do nothing;

  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    'SuggestionActionLinked',
    new_action_id::text,
    jsonb_build_object(
      'action_id', new_action_id,
      'suggestion_id', target_suggestion_id
    )
  );

  return new_action_id;
end;
$$;

create or replace function public.update_action(
  target_action_id uuid,
  target_title text default null,
  target_description text default null,
  target_priority text default null,
  target_due_at timestamptz default null,
  target_clear_due_at boolean default false,
  target_expected_version integer default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.update_action(
    target_action_id,
    target_title,
    target_description,
    target_priority,
    target_due_at,
    target_clear_due_at,
    target_expected_version
  )
$$;

create or replace function public.set_action_assignee(
  target_action_id uuid,
  target_membership_id uuid default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.set_action_assignee(target_action_id, target_membership_id)
$$;

create or replace function public.transition_action_status(
  target_action_id uuid,
  target_to_status text,
  target_reason text default null,
  target_expected_version integer default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.transition_action_status(
    target_action_id,
    target_to_status,
    target_reason,
    target_expected_version
  )
$$;

create or replace function public.complete_action(
  target_action_id uuid,
  target_reason text default null,
  target_expected_version integer default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.complete_action(
    target_action_id,
    target_reason,
    target_expected_version
  )
$$;

create or replace function public.reopen_action(
  target_action_id uuid,
  target_reason text default null,
  target_expected_version integer default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.reopen_action(
    target_action_id,
    target_reason,
    target_expected_version
  )
$$;

revoke all on function public.get_action_detail(uuid) from public, anon;
revoke all on function public.update_action(uuid, text, text, text, timestamptz, boolean, integer)
  from public, anon;
revoke all on function public.set_action_assignee(uuid, uuid) from public, anon;
revoke all on function public.transition_action_status(uuid, text, text, integer)
  from public, anon;
revoke all on function public.complete_action(uuid, text, integer) from public, anon;
revoke all on function public.reopen_action(uuid, text, integer) from public, anon;

grant execute on function public.get_action_detail(uuid) to authenticated;
grant execute on function public.get_suggestion_detail(uuid) to authenticated;
grant execute on function public.update_action(uuid, text, text, text, timestamptz, boolean, integer)
  to authenticated;
grant execute on function public.set_action_assignee(uuid, uuid) to authenticated;
grant execute on function public.transition_action_status(uuid, text, text, integer)
  to authenticated;
grant execute on function public.complete_action(uuid, text, integer) to authenticated;
grant execute on function public.reopen_action(uuid, text, integer) to authenticated;
