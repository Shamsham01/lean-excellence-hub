-- Milestone 12: AI runs and context manifest.

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  ai_session_id uuid not null,
  requested_by_membership_id uuid not null,
  provider text not null,
  model text not null,
  prompt_key text not null,
  prompt_version text not null,
  prompt_hash text not null,
  status text not null default 'running',
  provider_request_id text,
  error_category text,
  idempotency_key text,
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  final_output text,
  input_token_count integer not null default 0,
  output_token_count integer not null default 0,
  cached_input_token_count integer not null default 0,
  reasoning_token_count integer not null default 0,
  tool_call_count integer not null default 0,
  constraint ai_runs_organisation_id_id_key unique (organisation_id, id),
  constraint ai_runs_session_fkey
    foreign key (organisation_id, ai_session_id)
    references public.ai_sessions(organisation_id, id)
    on delete restrict,
  constraint ai_runs_requester_fkey
    foreign key (organisation_id, requested_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ai_runs_status_check
    check (status in ('running', 'completed', 'failed', 'timed_out', 'denied')),
  constraint ai_runs_idempotency_key
    unique (organisation_id, idempotency_key),
  constraint ai_runs_token_counts_check
    check (
      input_token_count >= 0
      and output_token_count >= 0
      and cached_input_token_count >= 0
      and reasoning_token_count >= 0
      and tool_call_count >= 0
    )
);

create unique index ai_runs_one_running_per_session_idx
  on public.ai_runs (ai_session_id)
  where status = 'running';

create table public.ai_run_context_manifest (
  ai_run_id uuid primary key,
  organisation_id uuid not null,
  manifest_version text not null,
  manifest_json jsonb not null,
  manifest_hash text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ai_run_context_manifest_run_fkey
    foreign key (organisation_id, ai_run_id)
    references public.ai_runs(organisation_id, id)
    on delete restrict,
  constraint ai_run_context_manifest_json_check
    check (jsonb_typeof(manifest_json) = 'object')
);

alter table public.ai_messages
  add constraint ai_messages_run_fkey
  foreign key (organisation_id, ai_run_id)
  references public.ai_runs(organisation_id, id)
  on delete restrict;

create index ai_runs_session_idx
  on public.ai_runs (organisation_id, ai_session_id, started_at desc);

alter table public.ai_runs enable row level security;
alter table public.ai_runs force row level security;
alter table public.ai_run_context_manifest enable row level security;
alter table public.ai_run_context_manifest force row level security;

revoke all on public.ai_runs from public, anon, authenticated, service_role;
revoke all on public.ai_run_context_manifest from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.ai_runs to lean_hub_private_owner;
grant select, insert, update, delete on public.ai_run_context_manifest to lean_hub_private_owner;

create policy private_owner_all_ai_runs
on public.ai_runs for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ai_run_context_manifest
on public.ai_run_context_manifest for all to lean_hub_private_owner
using (true) with check (true);

grant select on public.ai_runs to authenticated;
grant select on public.ai_run_context_manifest to authenticated;
