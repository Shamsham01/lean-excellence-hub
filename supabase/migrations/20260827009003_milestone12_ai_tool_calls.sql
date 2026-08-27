-- Milestone 12: AI tool calls.

create table public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  ai_run_id uuid not null,
  sequence_number integer not null,
  tool_name text not null,
  arguments_json jsonb not null,
  arguments_hash text not null,
  status text not null,
  result_metadata_json jsonb,
  denial_reason text,
  duration_ms integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  constraint ai_tool_calls_organisation_id_id_key unique (organisation_id, id),
  constraint ai_tool_calls_run_fkey
    foreign key (organisation_id, ai_run_id)
    references public.ai_runs(organisation_id, id)
    on delete restrict,
  constraint ai_tool_calls_sequence_key
    unique (organisation_id, ai_run_id, sequence_number),
  constraint ai_tool_calls_status_check
    check (status in ('succeeded', 'denied', 'failed')),
  constraint ai_tool_calls_arguments_json_check
    check (jsonb_typeof(arguments_json) = 'object'),
  constraint ai_tool_calls_duration_check
    check (duration_ms >= 0)
);

create index ai_tool_calls_run_idx
  on public.ai_tool_calls (organisation_id, ai_run_id, sequence_number);

alter table public.ai_tool_calls enable row level security;
alter table public.ai_tool_calls force row level security;

revoke all on public.ai_tool_calls from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.ai_tool_calls to lean_hub_private_owner;

create policy private_owner_all_ai_tool_calls
on public.ai_tool_calls for all to lean_hub_private_owner
using (true) with check (true);

grant select on public.ai_tool_calls to authenticated;
