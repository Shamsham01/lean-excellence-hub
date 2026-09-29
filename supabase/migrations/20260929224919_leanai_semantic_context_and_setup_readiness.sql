-- LEANAI-CONTEXT-01: semantic event context and deterministic setup readiness.
-- Zero model calls. Tenant-scoped assistance telemetry, not clickstream or
-- employee surveillance. Do not apply this migration to hosted Supabase
-- without an explicit rollout approval.

-- ---------------------------------------------------------------------------
-- Organisation LeanAI assistance settings (not provider secrets)
-- ---------------------------------------------------------------------------

alter table public.organisation_ai_settings
  add column if not exists proactive_assistance_enabled boolean not null default true;

alter table public.organisation_ai_settings
  add column if not exists journey_event_retention_days integer not null default 90;

alter table public.organisation_ai_settings
  drop constraint if exists organisation_ai_settings_journey_event_retention_days_check;

alter table public.organisation_ai_settings
  add constraint organisation_ai_settings_journey_event_retention_days_check
  check (journey_event_retention_days between 7 and 730);

comment on column public.organisation_ai_settings.proactive_assistance_enabled is
  'Organisation control for proactive LeanAI assistance. Independent of model/provider credentials.';

comment on column public.organisation_ai_settings.journey_event_retention_days is
  'Retention window for temporary LeanAI journey events. Durable domain state stays in module tables.';

-- ---------------------------------------------------------------------------
-- Semantic events
-- ---------------------------------------------------------------------------

create table public.leanai_semantic_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  event_key text not null,
  event_version integer not null default 1,
  module_key text,
  intervention_key text,
  site_unit_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint leanai_semantic_events_organisation_id_id_key
    unique (organisation_id, id),
  constraint leanai_semantic_events_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint leanai_semantic_events_site_fkey
    foreign key (organisation_id, site_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint leanai_semantic_events_event_key_check
    check (event_key in (
      'onboarding.started',
      'onboarding.step_completed',
      'onboarding.step_skipped',
      'onboarding.completed',
      'module.opened',
      'leanai.intervention_shown',
      'leanai.intervention_accepted',
      'leanai.intervention_dismissed',
      'leanai.intervention_snoozed'
    )),
  constraint leanai_semantic_events_event_version_check
    check (event_version = 1),
  constraint leanai_semantic_events_module_key_check
    check (
      module_key is null
      or module_key in (
        'organisation',
        'sites',
        'people',
        'maturity',
        'suggestions',
        'five_s',
        'gemba',
        'training',
        'skills',
        'recognition',
        'lean_ai',
        'problem_solving',
        'setup',
        'onboarding',
        'platform'
      )
    ),
  constraint leanai_semantic_events_intervention_key_check
    check (
      intervention_key is null
      or intervention_key ~ '^[a-z][a-z0-9_]{0,62}$'
    ),
  constraint leanai_semantic_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint leanai_semantic_events_metadata_size_check
    check (pg_catalog.pg_column_size(metadata) <= 2048)
);

create index leanai_semantic_events_org_occurred_idx
  on public.leanai_semantic_events (organisation_id, occurred_at desc);

create index leanai_semantic_events_org_membership_occurred_idx
  on public.leanai_semantic_events (organisation_id, membership_id, occurred_at desc);

create index leanai_semantic_events_org_event_occurred_idx
  on public.leanai_semantic_events (organisation_id, event_key, occurred_at desc);

comment on table public.leanai_semantic_events is
  'Bounded LeanAI assistance events. Not clickstream, mouse/keystroke capture, productivity scoring, or employee surveillance. Visible only to the acting membership in the current organisation.';

-- ---------------------------------------------------------------------------
-- Compact journey read-model (current state, not a behavioural warehouse)
-- ---------------------------------------------------------------------------

create table public.leanai_journey_contexts (
  organisation_id uuid not null
    references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  recent_module_key text,
  recent_module_opened_at timestamptz,
  onboarding_status text not null default 'not_started',
  last_onboarding_step_key text,
  last_onboarding_event_key text,
  last_onboarding_at timestamptz,
  last_intervention_key text,
  last_intervention_event_key text,
  last_intervention_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (organisation_id, membership_id),
  constraint leanai_journey_contexts_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint leanai_journey_contexts_onboarding_status_check
    check (onboarding_status in ('not_started', 'in_progress', 'completed')),
  constraint leanai_journey_contexts_recent_module_key_check
    check (
      recent_module_key is null
      or recent_module_key in (
        'organisation',
        'sites',
        'people',
        'maturity',
        'suggestions',
        'five_s',
        'gemba',
        'training',
        'skills',
        'recognition',
        'lean_ai',
        'problem_solving',
        'setup',
        'onboarding',
        'platform'
      )
    )
);

comment on table public.leanai_journey_contexts is
  'Compact per-membership LeanAI journey state for setup assistance and prompt cooldown. Not an employee monitoring timeline.';

create table public.leanai_intervention_states (
  organisation_id uuid not null
    references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  intervention_key text not null,
  last_event_key text not null,
  last_shown_at timestamptz,
  last_accepted_at timestamptz,
  last_dismissed_at timestamptz,
  snoozed_until timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (organisation_id, membership_id, intervention_key),
  constraint leanai_intervention_states_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint leanai_intervention_states_intervention_key_check
    check (intervention_key ~ '^[a-z][a-z0-9_]{0,62}$'),
  constraint leanai_intervention_states_last_event_key_check
    check (last_event_key in (
      'leanai.intervention_shown',
      'leanai.intervention_accepted',
      'leanai.intervention_dismissed',
      'leanai.intervention_snoozed'
    ))
);

comment on table public.leanai_intervention_states is
  'Current intervention cooldown/dismissal state for the acting membership only. Stores last outcome timestamps, not dismissal counts or ranking scores.';

-- ---------------------------------------------------------------------------
-- RLS / grants
-- ---------------------------------------------------------------------------

alter table public.leanai_semantic_events enable row level security;
alter table public.leanai_semantic_events force row level security;
alter table public.leanai_journey_contexts enable row level security;
alter table public.leanai_journey_contexts force row level security;
alter table public.leanai_intervention_states enable row level security;
alter table public.leanai_intervention_states force row level security;

revoke all on public.leanai_semantic_events from public, anon, authenticated, service_role;
revoke all on public.leanai_journey_contexts from public, anon, authenticated, service_role;
revoke all on public.leanai_intervention_states from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.leanai_semantic_events to lean_hub_private_owner;
grant select, insert, update, delete on public.leanai_journey_contexts to lean_hub_private_owner;
grant select, insert, update, delete on public.leanai_intervention_states to lean_hub_private_owner;

grant select on public.leanai_semantic_events to authenticated;
grant select on public.leanai_journey_contexts to authenticated;
grant select on public.leanai_intervention_states to authenticated;

create policy private_owner_all_leanai_semantic_events
on public.leanai_semantic_events for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_leanai_journey_contexts
on public.leanai_journey_contexts for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_leanai_intervention_states
on public.leanai_intervention_states for all to lean_hub_private_owner
using (true) with check (true);

create policy leanai_semantic_events_select_own
on public.leanai_semantic_events for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and membership_id = private.current_membership_id(organisation_id)
);

create policy leanai_journey_contexts_select_own
on public.leanai_journey_contexts for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and membership_id = private.current_membership_id(organisation_id)
);

create policy leanai_intervention_states_select_own
on public.leanai_intervention_states for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and membership_id = private.current_membership_id(organisation_id)
);
