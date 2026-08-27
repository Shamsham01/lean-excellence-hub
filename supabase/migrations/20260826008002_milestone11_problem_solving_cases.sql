-- Milestone 11: problem solving cases, status/stage history, source links, participants.

create table public.problem_solving_cases (
  id uuid primary key,
  organisation_id uuid not null,
  case_number text,
  title text not null,
  problem_statement text,
  background text,
  business_impact text,
  scope_in text,
  scope_out text,
  target_condition text,
  detected_at timestamptz,
  organisation_unit_id uuid not null,
  priority text,
  severity text,
  owner_membership_id uuid not null,
  facilitator_membership_id uuid,
  method_version_id uuid,
  current_method_stage_id uuid,
  status text not null default 'draft',
  target_due_at timestamptz,
  activated_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by_membership_id uuid,
  cancellation_rationale text,
  closure_outcome text,
  closure_rationale text,
  transferred_to_reference text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_cases_organisation_id_id_key unique (organisation_id, id),
  constraint problem_solving_cases_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint problem_solving_cases_unit_fkey
    foreign key (organisation_id, organisation_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint problem_solving_cases_owner_fkey
    foreign key (organisation_id, owner_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_cases_facilitator_fkey
    foreign key (organisation_id, facilitator_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_cases_method_version_fkey
    foreign key (organisation_id, method_version_id)
    references public.problem_solving_method_versions(organisation_id, id)
    on delete restrict,
  constraint problem_solving_cases_current_stage_fkey
    foreign key (organisation_id, current_method_stage_id)
    references public.problem_solving_method_stages(organisation_id, id)
    on delete restrict,
  constraint problem_solving_cases_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_cases_cancelled_by_fkey
    foreign key (organisation_id, cancelled_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_cases_number_org_key unique (organisation_id, case_number),
  constraint problem_solving_cases_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint problem_solving_cases_status_check
    check (status in ('draft', 'active', 'closed', 'cancelled')),
  constraint problem_solving_cases_priority_check
    check (priority is null or priority in ('low', 'medium', 'high', 'critical')),
  constraint problem_solving_cases_severity_check
    check (severity is null or severity in ('minor', 'moderate', 'major', 'critical')),
  constraint problem_solving_cases_closure_outcome_check
    check (
      (status <> 'closed' and closure_outcome is null)
      or (status = 'closed' and closure_outcome in (
        'resolved', 'partially_resolved', 'not_resolved', 'transferred'
      ))
    ),
  constraint problem_solving_cases_cancelled_fields_check
    check (
      (status <> 'cancelled')
      or (cancelled_at is not null and cancelled_by_membership_id is not null
          and cancellation_rationale is not null)
    ),
  constraint problem_solving_cases_active_requires_method
    check (
      status = 'draft'
      or (method_version_id is not null and current_method_stage_id is not null)
    )
);

create table public.problem_solving_status_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  from_status text not null,
  to_status text not null,
  changed_by_membership_id uuid not null,
  changed_at timestamptz not null default statement_timestamp(),
  rationale text,
  constraint problem_solving_status_history_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_status_history_actor_fkey
    foreign key (organisation_id, changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_status_history_status_check
    check (
      from_status in ('draft', 'active', 'closed', 'cancelled')
      and to_status in ('draft', 'active', 'closed', 'cancelled')
      and from_status <> to_status
    )
);

create table public.problem_solving_stage_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  from_stage_id uuid,
  to_stage_id uuid not null,
  changed_by_membership_id uuid not null,
  changed_at timestamptz not null default statement_timestamp(),
  notes text,
  constraint problem_solving_stage_history_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_stage_history_from_stage_fkey
    foreign key (organisation_id, from_stage_id)
    references public.problem_solving_method_stages(organisation_id, id)
    on delete restrict,
  constraint problem_solving_stage_history_to_stage_fkey
    foreign key (organisation_id, to_stage_id)
    references public.problem_solving_method_stages(organisation_id, id)
    on delete restrict,
  constraint problem_solving_stage_history_actor_fkey
    foreign key (organisation_id, changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.problem_solving_source_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  source_resource_id uuid not null,
  link_role text not null default 'related',
  source_resource_type text,
  source_title_snapshot text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_source_links_organisation_id_id_key unique (organisation_id, id),
  constraint problem_solving_source_links_case_source_role_key
    unique (organisation_id, case_id, source_resource_id, link_role),
  constraint problem_solving_source_links_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_source_links_source_fkey
    foreign key (organisation_id, source_resource_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint problem_solving_source_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_source_links_role_check
    check (link_role in ('primary', 'related'))
);

create table public.problem_solving_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  membership_id uuid not null,
  participant_role text not null,
  added_by_membership_id uuid not null,
  added_at timestamptz not null default statement_timestamp(),
  removed_at timestamptz,
  constraint problem_solving_participants_organisation_id_id_key unique (organisation_id, id),
  constraint problem_solving_participants_case_member_role_key
    unique (organisation_id, case_id, membership_id, participant_role),
  constraint problem_solving_participants_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_participants_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_participants_added_by_fkey
    foreign key (organisation_id, added_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_participants_role_check
    check (participant_role in ('problem_owner', 'facilitator', 'contributor', 'subject_matter_expert'))
);

-- Triggers
create trigger problem_solving_cases_touch_updated_at
before update on public.problem_solving_cases
for each row execute function private.touch_updated_at();

create trigger problem_solving_cases_prevent_org_change
before update on public.problem_solving_cases
for each row execute function private.prevent_organisation_id_change();

create trigger problem_solving_status_history_prevent_org_change
before update on public.problem_solving_status_history
for each row execute function private.prevent_organisation_id_change();

create trigger problem_solving_stage_history_prevent_org_change
before update on public.problem_solving_stage_history
for each row execute function private.prevent_organisation_id_change();

create trigger problem_solving_source_links_prevent_org_change
before update on public.problem_solving_source_links
for each row execute function private.prevent_organisation_id_change();

create trigger problem_solving_participants_prevent_org_change
before update on public.problem_solving_participants
for each row execute function private.prevent_organisation_id_change();

-- Indexes
create index problem_solving_cases_org_status_idx
  on public.problem_solving_cases (organisation_id, status);
create index problem_solving_cases_org_unit_idx
  on public.problem_solving_cases (organisation_id, organisation_unit_id);
create index problem_solving_cases_owner_idx
  on public.problem_solving_cases (organisation_id, owner_membership_id);
create index problem_solving_status_history_case_idx
  on public.problem_solving_status_history (organisation_id, case_id);
create index problem_solving_stage_history_case_idx
  on public.problem_solving_stage_history (organisation_id, case_id);
create index problem_solving_source_links_case_idx
  on public.problem_solving_source_links (organisation_id, case_id);
create index problem_solving_source_links_source_idx
  on public.problem_solving_source_links (organisation_id, source_resource_id);
create index problem_solving_participants_case_idx
  on public.problem_solving_participants (organisation_id, case_id);
create index problem_solving_participants_membership_idx
  on public.problem_solving_participants (organisation_id, membership_id);

-- RLS
alter table public.problem_solving_cases enable row level security;
alter table public.problem_solving_cases force row level security;
alter table public.problem_solving_status_history enable row level security;
alter table public.problem_solving_status_history force row level security;
alter table public.problem_solving_stage_history enable row level security;
alter table public.problem_solving_stage_history force row level security;
alter table public.problem_solving_source_links enable row level security;
alter table public.problem_solving_source_links force row level security;
alter table public.problem_solving_participants enable row level security;
alter table public.problem_solving_participants force row level security;

revoke all on public.problem_solving_cases from public, anon, authenticated, service_role;
revoke all on public.problem_solving_status_history from public, anon, authenticated, service_role;
revoke all on public.problem_solving_stage_history from public, anon, authenticated, service_role;
revoke all on public.problem_solving_source_links from public, anon, authenticated, service_role;
revoke all on public.problem_solving_participants from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.problem_solving_cases to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_status_history to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_stage_history to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_source_links to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_participants to lean_hub_private_owner;

create policy private_owner_all_problem_solving_cases
on public.problem_solving_cases for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_problem_solving_status_history
on public.problem_solving_status_history for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_problem_solving_stage_history
on public.problem_solving_stage_history for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_problem_solving_source_links
on public.problem_solving_source_links for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_problem_solving_participants
on public.problem_solving_participants for all to lean_hub_private_owner
using (true) with check (true);

-- Stub can_read for authenticated select (completed in 08011).
create or replace function private.can_read_problem_solving_case(
  target_organisation_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.problem_solving_cases case_row
    where case_row.organisation_id = target_organisation_id
      and case_row.id = target_case_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.view',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.view',
          null,
          case_row.organisation_unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'problem_solving.view',
          case_row.owner_membership_id,
          null
        )
      )
  )
$$;

-- Authenticated select policies
create policy problem_solving_cases_select
on public.problem_solving_cases for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, id)
);

create policy problem_solving_status_history_select
on public.problem_solving_status_history for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

create policy problem_solving_stage_history_select
on public.problem_solving_stage_history for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

create policy problem_solving_source_links_select
on public.problem_solving_source_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

create policy problem_solving_participants_select
on public.problem_solving_participants for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

grant select on public.problem_solving_cases to authenticated;
grant select on public.problem_solving_status_history to authenticated;
grant select on public.problem_solving_stage_history to authenticated;
grant select on public.problem_solving_source_links to authenticated;
grant select on public.problem_solving_participants to authenticated;

-- RPCs

create or replace function private.create_problem_solving_case_draft(
  target_title text,
  target_organisation_unit_id uuid,
  target_problem_statement text default null,
  target_background text default null,
  target_business_impact text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_target_condition text default null,
  target_detected_at timestamptz default null,
  target_priority text default null,
  target_severity text default null,
  target_owner_membership_id uuid default null,
  target_facilitator_membership_id uuid default null,
  target_method_version_id uuid default null,
  target_source_resource_id uuid default null
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
  resolved_owner_membership_id uuid;
  new_case_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'problem solving case creation is not authorised'
      using errcode = '42501';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.create', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.create', null, target_organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, target_organisation_unit_id)
  ) then
    raise exception 'problem solving case creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.ensure_builtin_problem_solving_methods(org_id);

  resolved_owner_membership_id := coalesce(target_owner_membership_id, actor_membership_id);

  new_case_id := private.register_resource_record(
    org_id,
    'problem_solving_case',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.problem_solving_cases (
    id,
    organisation_id,
    title,
    problem_statement,
    background,
    business_impact,
    scope_in,
    scope_out,
    target_condition,
    detected_at,
    organisation_unit_id,
    priority,
    severity,
    owner_membership_id,
    facilitator_membership_id,
    method_version_id,
    status,
    target_due_at,
    created_by_membership_id
  )
  values (
    new_case_id,
    org_id,
    btrim(target_title),
    target_problem_statement,
    target_background,
    target_business_impact,
    target_scope_in,
    target_scope_out,
    target_target_condition,
    target_detected_at,
    target_organisation_unit_id,
    target_priority,
    target_severity,
    resolved_owner_membership_id,
    target_facilitator_membership_id,
    target_method_version_id,
    'draft',
    null,
    actor_membership_id
  );

  if target_source_resource_id is not null then
    if not private.can_reference_source_resource(org_id, target_source_resource_id) then
      raise exception 'source resource is not referenceable'
        using errcode = '42501';
    end if;

    insert into public.problem_solving_source_links (
      organisation_id,
      case_id,
      source_resource_id,
      link_role,
      created_by_membership_id
    )
    values (
      org_id,
      new_case_id,
      target_source_resource_id,
      'primary',
      actor_membership_id
    );
  end if;

  perform private.append_business_audit(
    org_id,
    'problem_solving_case.created',
    new_case_id,
    'succeeded',
    jsonb_build_object('title', btrim(target_title))
  );

  return new_case_id;
end;
$$;

create or replace function private.update_problem_solving_case_draft(
  target_case_id uuid,
  target_title text default null,
  target_problem_statement text default null,
  target_background text default null,
  target_business_impact text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_target_condition text default null,
  target_detected_at timestamptz default null,
  target_priority text default null,
  target_severity text default null,
  target_owner_membership_id uuid default null,
  target_facilitator_membership_id uuid default null,
  target_method_version_id uuid default null,
  target_target_due_at timestamptz default null
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
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'draft update is not authorised'
      using errcode = '42501';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'draft' then
    raise exception 'only draft cases can be updated via this function'
      using errcode = '55000';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, case_row.organisation_unit_id)
    or (case_row.created_by_membership_id = actor_membership_id)
    or (case_row.owner_membership_id = actor_membership_id)
  ) then
    raise exception 'draft update is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_cases case_table
  set title = coalesce(btrim(target_title), case_table.title),
      problem_statement = coalesce(target_problem_statement, case_table.problem_statement),
      background = coalesce(target_background, case_table.background),
      business_impact = coalesce(target_business_impact, case_table.business_impact),
      scope_in = coalesce(target_scope_in, case_table.scope_in),
      scope_out = coalesce(target_scope_out, case_table.scope_out),
      target_condition = coalesce(target_target_condition, case_table.target_condition),
      detected_at = coalesce(target_detected_at, case_table.detected_at),
      priority = coalesce(target_priority, case_table.priority),
      severity = coalesce(target_severity, case_table.severity),
      owner_membership_id = coalesce(target_owner_membership_id, case_table.owner_membership_id),
      facilitator_membership_id = coalesce(target_facilitator_membership_id, case_table.facilitator_membership_id),
      method_version_id = coalesce(target_method_version_id, case_table.method_version_id),
      target_due_at = coalesce(target_target_due_at, case_table.target_due_at)
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  return true;
end;
$$;

create or replace function private.add_problem_solving_source_link(
  target_case_id uuid,
  target_source_resource_id uuid,
  target_link_role text default 'related'
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
  case_row public.problem_solving_cases%rowtype;
  new_link_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'source link is not authorised'
      using errcode = '42501';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if not private.can_read_problem_solving_case(org_id, target_case_id) then
    raise exception 'source link is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_reference_source_resource(org_id, target_source_resource_id) then
    raise exception 'source resource is not referenceable'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_source_links (
    organisation_id,
    case_id,
    source_resource_id,
    link_role,
    source_resource_type,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_source_resource_id,
    target_link_role,
    (select rr.resource_type from public.resource_records rr
     where rr.organisation_id = org_id and rr.id = target_source_resource_id),
    actor_membership_id
  )
  on conflict (organisation_id, case_id, source_resource_id, link_role) do nothing
  returning id into new_link_id;

  if new_link_id is null then
    select link_row.id
    into new_link_id
    from public.problem_solving_source_links link_row
    where link_row.organisation_id = org_id
      and link_row.case_id = target_case_id
      and link_row.source_resource_id = target_source_resource_id
      and link_row.link_role = target_link_role;
  end if;

  return new_link_id;
end;
$$;

create or replace function private.remove_problem_solving_source_link(
  target_link_id uuid
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
  link_row public.problem_solving_source_links%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'source link removal is not authorised'
      using errcode = '42501';
  end if;

  select link_table.*
  into link_row
  from public.problem_solving_source_links link_table
  where link_table.organisation_id = org_id
    and link_table.id = target_link_id
  for update;

  if not found then
    raise exception 'source link not found'
      using errcode = 'P0002';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or link_row.created_by_membership_id = actor_membership_id
  ) then
    raise exception 'source link removal is not authorised'
      using errcode = '42501';
  end if;

  delete from public.problem_solving_source_links
  where organisation_id = org_id
    and id = target_link_id;

  return true;
end;
$$;

create or replace function private.add_problem_solving_participant(
  target_case_id uuid,
  target_membership_id uuid,
  target_participant_role text
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
  case_row public.problem_solving_cases%rowtype;
  new_participant_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'participant addition is not authorised'
      using errcode = '42501';
  end if;

  select case_table.*
  into case_row
  from public.problem_solving_cases case_table
  where case_table.organisation_id = org_id
    and case_table.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'cannot add participants to a closed or cancelled case'
      using errcode = '55000';
  end if;

  if not (
    private.has_scoped_permission(org_id, 'problem_solving.manage', null, null)
    or private.has_scoped_permission(org_id, 'problem_solving.manage', null, case_row.organisation_unit_id)
    or private.has_scoped_permission(org_id, 'problem_solving.facilitate', null, null)
    or (case_row.owner_membership_id = actor_membership_id)
    or (case_row.facilitator_membership_id = actor_membership_id)
  ) then
    raise exception 'participant addition is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_participants (
    organisation_id,
    case_id,
    membership_id,
    participant_role,
    added_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    target_membership_id,
    target_participant_role,
    actor_membership_id
  )
  on conflict (organisation_id, case_id, membership_id, participant_role)
  do update set removed_at = null
  returning id into new_participant_id;

  return new_participant_id;
end;
$$;

-- Public wrappers
create or replace function public.create_problem_solving_case_draft(
  target_title text,
  target_organisation_unit_id uuid,
  target_problem_statement text default null,
  target_background text default null,
  target_business_impact text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_target_condition text default null,
  target_detected_at timestamptz default null,
  target_priority text default null,
  target_severity text default null,
  target_owner_membership_id uuid default null,
  target_facilitator_membership_id uuid default null,
  target_method_version_id uuid default null,
  target_source_resource_id uuid default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_problem_solving_case_draft(
  target_title,
  target_organisation_unit_id,
  target_problem_statement,
  target_background,
  target_business_impact,
  target_scope_in,
  target_scope_out,
  target_target_condition,
  target_detected_at,
  target_priority,
  target_severity,
  target_owner_membership_id,
  target_facilitator_membership_id,
  target_method_version_id,
  target_source_resource_id
) $$;

create or replace function public.update_problem_solving_case_draft(
  target_case_id uuid,
  target_title text default null,
  target_problem_statement text default null,
  target_background text default null,
  target_business_impact text default null,
  target_scope_in text default null,
  target_scope_out text default null,
  target_target_condition text default null,
  target_detected_at timestamptz default null,
  target_priority text default null,
  target_severity text default null,
  target_owner_membership_id uuid default null,
  target_facilitator_membership_id uuid default null,
  target_method_version_id uuid default null,
  target_target_due_at timestamptz default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.update_problem_solving_case_draft(
  target_case_id,
  target_title,
  target_problem_statement,
  target_background,
  target_business_impact,
  target_scope_in,
  target_scope_out,
  target_target_condition,
  target_detected_at,
  target_priority,
  target_severity,
  target_owner_membership_id,
  target_facilitator_membership_id,
  target_method_version_id,
  target_target_due_at
) $$;

create or replace function public.add_problem_solving_source_link(
  target_case_id uuid,
  target_source_resource_id uuid,
  target_link_role text default 'related'
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_problem_solving_source_link(
  target_case_id,
  target_source_resource_id,
  target_link_role
) $$;

create or replace function public.remove_problem_solving_source_link(target_link_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.remove_problem_solving_source_link(target_link_id) $$;

create or replace function public.add_problem_solving_participant(
  target_case_id uuid,
  target_membership_id uuid,
  target_participant_role text
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_problem_solving_participant(
  target_case_id,
  target_membership_id,
  target_participant_role
) $$;

-- Grants
grant execute on function public.create_problem_solving_case_draft(
  text, uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid, uuid, uuid
) to authenticated;
grant execute on function public.update_problem_solving_case_draft(
  uuid, text, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid, uuid, timestamptz
) to authenticated;
grant execute on function public.add_problem_solving_source_link(uuid, uuid, text) to authenticated;
grant execute on function public.remove_problem_solving_source_link(uuid) to authenticated;
grant execute on function public.add_problem_solving_participant(uuid, uuid, text) to authenticated;

revoke all on function public.create_problem_solving_case_draft(
  text, uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid, uuid, uuid
) from public, anon;
revoke all on function public.update_problem_solving_case_draft(
  uuid, text, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid, uuid, timestamptz
) from public, anon;
revoke all on function public.add_problem_solving_source_link(uuid, uuid, text) from public, anon;
revoke all on function public.remove_problem_solving_source_link(uuid) from public, anon;
revoke all on function public.add_problem_solving_participant(uuid, uuid, text) from public, anon;

-- Ownership
alter function private.can_read_problem_solving_case(uuid, uuid) owner to lean_hub_private_owner;
alter function private.create_problem_solving_case_draft(
  text, uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid, uuid, uuid
) owner to lean_hub_private_owner;
alter function private.update_problem_solving_case_draft(
  uuid, text, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid, uuid, timestamptz
) owner to lean_hub_private_owner;
alter function private.add_problem_solving_source_link(uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.remove_problem_solving_source_link(uuid) owner to lean_hub_private_owner;
alter function private.add_problem_solving_participant(uuid, uuid, text) owner to lean_hub_private_owner;
