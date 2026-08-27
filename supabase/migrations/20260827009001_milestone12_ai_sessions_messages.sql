-- Milestone 12: AI sessions and messages.

create table public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  problem_solving_case_id uuid not null,
  problem_solving_session_id uuid,
  created_by_membership_id uuid not null,
  mode text not null,
  status text not null default 'active',
  title text,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  constraint ai_sessions_organisation_id_id_key unique (organisation_id, id),
  constraint ai_sessions_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint ai_sessions_ps_session_fkey
    foreign key (organisation_id, problem_solving_session_id)
    references public.problem_solving_sessions(organisation_id, id)
    on delete restrict,
  constraint ai_sessions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ai_sessions_mode_check
    check (mode in ('ask', 'facilitate', 'review', 'challenge')),
  constraint ai_sessions_status_check
    check (status in ('active', 'completed', 'cancelled')),
  constraint ai_sessions_title_check
    check (title is null or (title = btrim(title) and char_length(title) between 1 and 200))
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  ai_session_id uuid not null,
  role text not null,
  content text not null,
  ai_run_id uuid,
  structured_payload jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint ai_messages_organisation_id_id_key unique (organisation_id, id),
  constraint ai_messages_session_fkey
    foreign key (organisation_id, ai_session_id)
    references public.ai_sessions(organisation_id, id)
    on delete restrict,
  constraint ai_messages_role_check
    check (role in ('user', 'assistant')),
  constraint ai_messages_content_check
    check (content = btrim(content) and char_length(content) between 1 and 32000),
  constraint ai_messages_structured_payload_check
    check (structured_payload is null or jsonb_typeof(structured_payload) = 'object')
);

create index ai_sessions_case_idx
  on public.ai_sessions (organisation_id, problem_solving_case_id, created_at desc);

create index ai_sessions_creator_idx
  on public.ai_sessions (organisation_id, created_by_membership_id, created_at desc);

create index ai_messages_session_idx
  on public.ai_messages (organisation_id, ai_session_id, created_at);

alter table public.ai_sessions enable row level security;
alter table public.ai_sessions force row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_messages force row level security;

revoke all on public.ai_sessions from public, anon, authenticated, service_role;
revoke all on public.ai_messages from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.ai_sessions to lean_hub_private_owner;
grant select, insert, update, delete on public.ai_messages to lean_hub_private_owner;

create policy private_owner_all_ai_sessions
on public.ai_sessions for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ai_messages
on public.ai_messages for all to lean_hub_private_owner
using (true) with check (true);

grant select on public.ai_sessions to authenticated;
grant select on public.ai_messages to authenticated;

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
      'problem_solving_case',
      'ai_session',
      'ai_run',
      'ai_proposal'
    )
  );

-- AI sessions participate in business audit resource FK via resource_records.
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
    'problem_solving_case',
    'ai_session',
    'ai_run',
    'ai_proposal'
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
