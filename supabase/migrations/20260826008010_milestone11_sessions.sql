-- Milestone 11: problem solving sessions domain, participants, entries, and immutability.

create table public.problem_solving_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  title text not null,
  facilitator_membership_id uuid not null,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  summary text,
  status text not null default 'scheduled',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ps_sessions_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_sessions_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint ps_sessions_facilitator_fkey
    foreign key (organisation_id, facilitator_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_sessions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_sessions_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint ps_sessions_summary_check
    check (summary is null or char_length(summary) <= 8000),
  constraint ps_sessions_status_check
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled'))
);

create table public.problem_solving_session_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  session_id uuid not null,
  membership_id uuid not null,
  added_by_membership_id uuid not null,
  added_at timestamptz not null default statement_timestamp(),
  constraint ps_session_participants_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_session_participants_session_member_key
    unique (organisation_id, session_id, membership_id),
  constraint ps_session_participants_session_fkey
    foreign key (organisation_id, session_id)
    references public.problem_solving_sessions(organisation_id, id)
    on delete restrict,
  constraint ps_session_participants_member_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_session_participants_adder_fkey
    foreign key (organisation_id, added_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.problem_solving_session_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  session_id uuid not null,
  entry_type text not null,
  body text not null,
  reference_hypothesis_id uuid,
  reference_action_id uuid,
  reference_attachment_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ps_session_entries_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_session_entries_session_fkey
    foreign key (organisation_id, session_id)
    references public.problem_solving_sessions(organisation_id, id)
    on delete restrict,
  constraint ps_session_entries_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_session_entries_hypothesis_fkey
    foreign key (organisation_id, reference_hypothesis_id)
    references public.problem_solving_hypotheses(organisation_id, id)
    on delete restrict,
  constraint ps_session_entries_action_fkey
    foreign key (organisation_id, reference_action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint ps_session_entries_attachment_fkey
    foreign key (organisation_id, reference_attachment_id)
    references public.attachments(organisation_id, id)
    on delete restrict,
  constraint ps_session_entries_type_check
    check (
      entry_type in (
        'note',
        'question',
        'decision',
        'observation',
        'idea',
        'evidence_reference',
        'hypothesis_reference',
        'action_reference'
      )
    ),
  constraint ps_session_entries_body_check
    check (body = btrim(body) and char_length(body) between 1 and 8000)
);

-- Triggers

create trigger ps_sessions_touch_updated_at
before update on public.problem_solving_sessions
for each row execute function private.touch_updated_at();

create trigger ps_sessions_prevent_org_change
before update on public.problem_solving_sessions
for each row execute function private.prevent_organisation_id_change();

create trigger ps_session_participants_prevent_org_change
before update on public.problem_solving_session_participants
for each row execute function private.prevent_organisation_id_change();

create trigger ps_session_entries_prevent_org_change
before update on public.problem_solving_session_entries
for each row execute function private.prevent_organisation_id_change();

-- Completed session immutability triggers

create or replace function private.prevent_completed_session_entry_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  session_status text;
begin
  select ps_session.status
  into session_status
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and ps_session.id = coalesce(new.session_id, old.session_id);

  if session_status = 'completed' then
    raise exception 'completed session entries are immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.prevent_completed_session_participant_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  session_status text;
begin
  select ps_session.status
  into session_status
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and ps_session.id = coalesce(new.session_id, old.session_id);

  if session_status = 'completed' then
    raise exception 'completed session participants are immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.prevent_completed_session_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' then
    if new.title is distinct from old.title
      or new.facilitator_membership_id is distinct from old.facilitator_membership_id
      or new.scheduled_at is distinct from old.scheduled_at
      or new.started_at is distinct from old.started_at
      or new.completed_at is distinct from old.completed_at
      or new.summary is distinct from old.summary
      or new.created_by_membership_id is distinct from old.created_by_membership_id then
      raise exception 'completed session content is immutable'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

create trigger ps_sessions_prevent_completed_mutation
before update on public.problem_solving_sessions
for each row execute function private.prevent_completed_session_mutation();

create trigger ps_session_entries_prevent_completed_mutation
before insert or update or delete on public.problem_solving_session_entries
for each row execute function private.prevent_completed_session_entry_mutation();

create trigger ps_session_participants_prevent_completed_mutation
before insert or update or delete on public.problem_solving_session_participants
for each row execute function private.prevent_completed_session_participant_mutation();

-- Indexes

create index ps_sessions_case_idx
  on public.problem_solving_sessions (organisation_id, case_id, status);
create index ps_session_participants_session_idx
  on public.problem_solving_session_participants (organisation_id, session_id);
create index ps_session_entries_session_idx
  on public.problem_solving_session_entries (organisation_id, session_id, created_at);

-- RLS

alter table public.problem_solving_sessions enable row level security;
alter table public.problem_solving_sessions force row level security;
alter table public.problem_solving_session_participants enable row level security;
alter table public.problem_solving_session_participants force row level security;
alter table public.problem_solving_session_entries enable row level security;
alter table public.problem_solving_session_entries force row level security;

revoke all on public.problem_solving_sessions from public, anon, authenticated, service_role;
revoke all on public.problem_solving_session_participants from public, anon, authenticated, service_role;
revoke all on public.problem_solving_session_entries from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_sessions to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_session_participants to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_session_entries to lean_hub_private_owner;

create policy private_owner_all_ps_sessions
on public.problem_solving_sessions for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ps_session_participants
on public.problem_solving_session_participants for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ps_session_entries
on public.problem_solving_session_entries for all to lean_hub_private_owner
using (true) with check (true);

-- Authenticated read policies

grant select on public.problem_solving_sessions to authenticated;
grant select on public.problem_solving_session_participants to authenticated;
grant select on public.problem_solving_session_entries to authenticated;

create policy ps_sessions_select
on public.problem_solving_sessions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

create policy ps_session_participants_select
on public.problem_solving_session_participants for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.problem_solving_sessions ps_session
    where ps_session.organisation_id = problem_solving_session_participants.organisation_id
      and ps_session.id = problem_solving_session_participants.session_id
      and private.can_read_problem_solving_case(ps_session.organisation_id, ps_session.case_id)
  )
);

create policy ps_session_entries_select
on public.problem_solving_session_entries for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.problem_solving_sessions ps_session
    where ps_session.organisation_id = problem_solving_session_entries.organisation_id
      and ps_session.id = problem_solving_session_entries.session_id
      and private.can_read_problem_solving_case(ps_session.organisation_id, ps_session.case_id)
  )
);

-- Private session RPCs

create or replace function private.start_problem_solving_session(
  target_case_id uuid,
  target_title text,
  target_facilitator_membership_id uuid default null,
  target_scheduled_at timestamptz default null
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
  resolved_facilitator uuid;
  new_session_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'session creation is not authorised'
      using errcode = '42501';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'active' then
    raise exception 'sessions can only be started on active cases'
      using errcode = '55000';
  end if;

  if not private.can_contribute_problem_solving_case(org_id, target_case_id) then
    raise exception 'session creation is not authorised'
      using errcode = '42501';
  end if;

  resolved_facilitator := coalesce(target_facilitator_membership_id, actor_membership_id);

  insert into public.problem_solving_sessions (
    organisation_id,
    case_id,
    title,
    facilitator_membership_id,
    scheduled_at,
    started_at,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_title),
    resolved_facilitator,
    target_scheduled_at,
    statement_timestamp(),
    'in_progress',
    actor_membership_id
  )
  returning id into new_session_id;

  insert into public.problem_solving_session_participants (
    organisation_id,
    session_id,
    membership_id,
    added_by_membership_id
  )
  values (
    org_id,
    new_session_id,
    resolved_facilitator,
    actor_membership_id
  )
  on conflict (organisation_id, session_id, membership_id) do nothing;

  if resolved_facilitator <> actor_membership_id then
    insert into public.problem_solving_session_participants (
      organisation_id,
      session_id,
      membership_id,
      added_by_membership_id
    )
    values (
      org_id,
      new_session_id,
      actor_membership_id,
      actor_membership_id
    )
    on conflict (organisation_id, session_id, membership_id) do nothing;
  end if;

  perform private.append_business_audit(
    org_id,
    'problem_solving.session_started',
    target_case_id,
    'succeeded',
    jsonb_build_object('session_id', new_session_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingSessionStarted',
    new_session_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'session_id', new_session_id
    )
  );

  return new_session_id;
end;
$$;

create or replace function private.add_session_entry(
  target_session_id uuid,
  target_entry_type text,
  target_body text,
  target_reference_hypothesis_id uuid default null,
  target_reference_action_id uuid default null,
  target_reference_attachment_id uuid default null
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
  session_row public.problem_solving_sessions%rowtype;
  new_entry_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'session entry creation is not authorised'
      using errcode = '42501';
  end if;

  select ps_session.*
  into session_row
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = org_id
    and ps_session.id = target_session_id;

  if not found then
    raise exception 'session not found'
      using errcode = 'P0002';
  end if;

  if session_row.status <> 'in_progress' then
    raise exception 'entries can only be added to in-progress sessions'
      using errcode = '55000';
  end if;

  if not private.can_contribute_problem_solving_case(org_id, session_row.case_id) then
    raise exception 'session entry creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_session_entries (
    organisation_id,
    session_id,
    entry_type,
    body,
    reference_hypothesis_id,
    reference_action_id,
    reference_attachment_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_session_id,
    target_entry_type,
    btrim(target_body),
    target_reference_hypothesis_id,
    target_reference_action_id,
    target_reference_attachment_id,
    actor_membership_id
  )
  returning id into new_entry_id;

  insert into public.problem_solving_session_participants (
    organisation_id,
    session_id,
    membership_id,
    added_by_membership_id
  )
  values (
    org_id,
    target_session_id,
    actor_membership_id,
    actor_membership_id
  )
  on conflict (organisation_id, session_id, membership_id) do nothing;

  return new_entry_id;
end;
$$;

create or replace function private.complete_problem_solving_session(
  target_session_id uuid,
  target_summary text default null
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
  session_row public.problem_solving_sessions%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'session completion is not authorised'
      using errcode = '42501';
  end if;

  select ps_session.*
  into session_row
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = org_id
    and ps_session.id = target_session_id
  for update;

  if not found then
    raise exception 'session not found'
      using errcode = 'P0002';
  end if;

  if session_row.status <> 'in_progress' then
    raise exception 'only in-progress sessions can be completed'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, session_row.case_id)
    and session_row.facilitator_membership_id <> actor_membership_id then
    raise exception 'session completion is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_sessions ps_session
  set status = 'completed',
      completed_at = statement_timestamp(),
      summary = target_summary,
      updated_at = statement_timestamp()
  where ps_session.organisation_id = org_id
    and ps_session.id = target_session_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.session_completed',
    session_row.case_id,
    'succeeded',
    jsonb_build_object('session_id', target_session_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    session_row.case_id,
    'ProblemSolvingSessionCompleted',
    target_session_id::text,
    jsonb_build_object(
      'case_id', session_row.case_id,
      'session_id', target_session_id
    )
  );

  return true;
end;
$$;

-- Public RPC wrappers

create or replace function public.start_problem_solving_session(
  target_case_id uuid,
  target_title text,
  target_facilitator_membership_id uuid default null,
  target_scheduled_at timestamptz default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.start_problem_solving_session(
  target_case_id,
  target_title,
  target_facilitator_membership_id,
  target_scheduled_at
) $$;

create or replace function public.add_session_entry(
  target_session_id uuid,
  target_entry_type text,
  target_body text,
  target_reference_hypothesis_id uuid default null,
  target_reference_action_id uuid default null,
  target_reference_attachment_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.add_session_entry(
  target_session_id,
  target_entry_type,
  target_body,
  target_reference_hypothesis_id,
  target_reference_action_id,
  target_reference_attachment_id
) $$;

create or replace function public.complete_problem_solving_session(
  target_session_id uuid,
  target_summary text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.complete_problem_solving_session(
  target_session_id,
  target_summary
) $$;

grant execute on function public.start_problem_solving_session(uuid, text, uuid, timestamptz)
  to authenticated;
grant execute on function public.add_session_entry(uuid, text, text, uuid, uuid, uuid)
  to authenticated;
grant execute on function public.complete_problem_solving_session(uuid, text)
  to authenticated;

revoke all on function public.start_problem_solving_session(uuid, text, uuid, timestamptz)
  from public, anon;
revoke all on function public.add_session_entry(uuid, text, text, uuid, uuid, uuid)
  from public, anon;
revoke all on function public.complete_problem_solving_session(uuid, text)
  from public, anon;

revoke all on function private.start_problem_solving_session(uuid, text, uuid, timestamptz)
  from public;
revoke all on function private.add_session_entry(uuid, text, text, uuid, uuid, uuid)
  from public;
revoke all on function private.complete_problem_solving_session(uuid, text)
  from public;
revoke all on function private.prevent_completed_session_entry_mutation() from public;
revoke all on function private.prevent_completed_session_participant_mutation() from public;
revoke all on function private.prevent_completed_session_mutation() from public;

grant execute on function private.start_problem_solving_session(uuid, text, uuid, timestamptz)
  to lean_hub_private_owner;
grant execute on function private.add_session_entry(uuid, text, text, uuid, uuid, uuid)
  to lean_hub_private_owner;
grant execute on function private.complete_problem_solving_session(uuid, text)
  to lean_hub_private_owner;
grant execute on function private.prevent_completed_session_entry_mutation()
  to lean_hub_private_owner;
grant execute on function private.prevent_completed_session_participant_mutation()
  to lean_hub_private_owner;
grant execute on function private.prevent_completed_session_mutation()
  to lean_hub_private_owner;

alter function private.start_problem_solving_session(uuid, text, uuid, timestamptz)
  owner to lean_hub_private_owner;
alter function private.add_session_entry(uuid, text, text, uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.complete_problem_solving_session(uuid, text)
  owner to lean_hub_private_owner;
alter function private.prevent_completed_session_entry_mutation()
  owner to lean_hub_private_owner;
alter function private.prevent_completed_session_participant_mutation()
  owner to lean_hub_private_owner;
alter function private.prevent_completed_session_mutation()
  owner to lean_hub_private_owner;
