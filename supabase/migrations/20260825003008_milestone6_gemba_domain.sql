create table public.gemba_definitions (
  id uuid primary key,
  organisation_id uuid not null,
  template_id uuid not null,
  display_name text not null,
  description text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint gemba_definitions_organisation_id_id_key unique (organisation_id, id),
  constraint gemba_definitions_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint gemba_definitions_template_fkey
    foreign key (organisation_id, template_id)
    references public.templates(organisation_id, id)
    on delete restrict,
  constraint gemba_definitions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint gemba_definitions_display_name_check
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 160)
);

create table public.gemba_definition_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  definition_id uuid not null,
  template_version_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  expected_duration_minutes integer,
  created_by_membership_id uuid not null,
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint gemba_definition_versions_organisation_id_id_key unique (organisation_id, id),
  constraint gemba_definition_versions_definition_version_key
    unique (organisation_id, definition_id, version_number),
  constraint gemba_definition_versions_template_version_key
    unique (organisation_id, template_version_id),
  constraint gemba_definition_versions_definition_fkey
    foreign key (organisation_id, definition_id)
    references public.gemba_definitions(organisation_id, id)
    on delete restrict,
  constraint gemba_definition_versions_template_version_fkey
    foreign key (organisation_id, template_version_id)
    references public.template_versions(organisation_id, id)
    on delete restrict,
  constraint gemba_definition_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint gemba_definition_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table public.gemba_walks (
  id uuid primary key,
  organisation_id uuid not null,
  definition_version_id uuid not null,
  unit_id uuid not null,
  submission_id uuid not null,
  schedule_occurrence_id uuid,
  leader_membership_id uuid not null,
  status text not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  summary_notes text,
  definition_name_snapshot text,
  template_version_number_snapshot integer,
  unit_name_snapshot text,
  unit_code_snapshot text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint gemba_walks_organisation_id_id_key unique (organisation_id, id),
  constraint gemba_walks_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint gemba_walks_definition_version_fkey
    foreign key (organisation_id, definition_version_id)
    references public.gemba_definition_versions(organisation_id, id)
    on delete restrict,
  constraint gemba_walks_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint gemba_walks_submission_fkey
    foreign key (organisation_id, submission_id)
    references public.template_submissions(organisation_id, id)
    on delete restrict,
  constraint gemba_walks_schedule_occurrence_fkey
    foreign key (organisation_id, schedule_occurrence_id)
    references public.schedule_occurrences(organisation_id, id)
    on delete restrict,
  constraint gemba_walks_leader_fkey
    foreign key (organisation_id, leader_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint gemba_walks_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint gemba_walks_status_check
    check (status in ('draft', 'in_progress', 'completed', 'cancelled'))
);

create table public.gemba_walk_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  walk_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint gemba_walk_participants_organisation_id_id_key unique (organisation_id, id),
  constraint gemba_walk_participants_walk_member_key
    unique (organisation_id, walk_id, membership_id),
  constraint gemba_walk_participants_walk_fkey
    foreign key (organisation_id, walk_id)
    references public.gemba_walks(organisation_id, id)
    on delete restrict,
  constraint gemba_walk_participants_member_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.gemba_walk_observations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  walk_id uuid not null,
  section_id uuid,
  question_id uuid,
  observation_text text not null,
  observation_type text not null,
  severity text,
  priority text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint gemba_walk_observations_organisation_id_id_key unique (organisation_id, id),
  constraint gemba_walk_observations_walk_fkey
    foreign key (organisation_id, walk_id)
    references public.gemba_walks(organisation_id, id)
    on delete restrict,
  constraint gemba_walk_observations_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint gemba_walk_observations_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint gemba_walk_observations_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint gemba_walk_observations_text_check
    check (observation_text = btrim(observation_text) and char_length(observation_text) between 1 and 2000),
  constraint gemba_walk_observations_type_check
    check (observation_type in ('positive_practice', 'improvement_opportunity', 'issue'))
);

create table public.gemba_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  walk_id uuid not null,
  attachment_id uuid not null,
  section_id uuid,
  question_id uuid,
  observation_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint gemba_evidence_links_organisation_id_id_key unique (organisation_id, id),
  constraint gemba_evidence_links_walk_attachment_key
    unique (organisation_id, walk_id, attachment_id),
  constraint gemba_evidence_links_walk_fkey
    foreign key (organisation_id, walk_id)
    references public.gemba_walks(organisation_id, id)
    on delete restrict,
  constraint gemba_evidence_links_attachment_fkey
    foreign key (organisation_id, attachment_id)
    references public.attachments(organisation_id, id)
    on delete restrict,
  constraint gemba_evidence_links_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint gemba_evidence_links_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint gemba_evidence_links_observation_fkey
    foreign key (organisation_id, observation_id)
    references public.gemba_walk_observations(organisation_id, id)
    on delete restrict,
  constraint gemba_evidence_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.gemba_action_context (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  walk_id uuid not null,
  section_id uuid,
  question_id uuid,
  observation_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint gemba_action_context_organisation_id_id_key unique (organisation_id, id),
  constraint gemba_action_context_action_key unique (organisation_id, action_id),
  constraint gemba_action_context_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint gemba_action_context_walk_fkey
    foreign key (organisation_id, walk_id)
    references public.gemba_walks(organisation_id, id)
    on delete restrict,
  constraint gemba_action_context_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint gemba_action_context_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint gemba_action_context_observation_fkey
    foreign key (organisation_id, observation_id)
    references public.gemba_walk_observations(organisation_id, id)
    on delete restrict,
  constraint gemba_action_context_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create index gemba_definition_versions_definition_idx
  on public.gemba_definition_versions (organisation_id, definition_id, status);
create index gemba_walks_org_status_idx
  on public.gemba_walks (organisation_id, status);
create index gemba_walks_unit_idx
  on public.gemba_walks (organisation_id, unit_id);
create index gemba_walk_observations_walk_idx
  on public.gemba_walk_observations (organisation_id, walk_id);
create index gemba_evidence_links_walk_idx
  on public.gemba_evidence_links (organisation_id, walk_id);
create index gemba_action_context_walk_idx
  on public.gemba_action_context (organisation_id, walk_id);

create trigger gemba_definitions_touch_updated_at
before update on public.gemba_definitions
for each row execute function private.touch_updated_at();

create trigger gemba_walks_touch_updated_at
before update on public.gemba_walks
for each row execute function private.touch_updated_at();

create or replace function private.guard_gemba_walk_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  walk_status text;
begin
  select walk_row.status
  into walk_status
  from public.gemba_walks walk_row
  where walk_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and walk_row.id = coalesce(new.walk_id, old.walk_id);

  if walk_status = 'completed' then
    raise exception 'completed gemba walk is immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger gemba_evidence_links_guard_immutable
before update or delete on public.gemba_evidence_links
for each row execute function private.guard_gemba_walk_immutable();

create trigger gemba_action_context_guard_immutable
before update or delete on public.gemba_action_context
for each row execute function private.guard_gemba_walk_immutable();

create trigger gemba_walk_observations_guard_immutable
before update or delete on public.gemba_walk_observations
for each row execute function private.guard_gemba_walk_immutable();

alter table public.gemba_definitions enable row level security;
alter table public.gemba_definitions force row level security;
alter table public.gemba_definition_versions enable row level security;
alter table public.gemba_definition_versions force row level security;
alter table public.gemba_walks enable row level security;
alter table public.gemba_walks force row level security;
alter table public.gemba_walk_participants enable row level security;
alter table public.gemba_walk_participants force row level security;
alter table public.gemba_walk_observations enable row level security;
alter table public.gemba_walk_observations force row level security;
alter table public.gemba_evidence_links enable row level security;
alter table public.gemba_evidence_links force row level security;
alter table public.gemba_action_context enable row level security;
alter table public.gemba_action_context force row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'gemba_definitions',
    'gemba_definition_versions',
    'gemba_walks',
    'gemba_walk_participants',
    'gemba_walk_observations',
    'gemba_evidence_links',
    'gemba_action_context'
  ]
  loop
    execute format(
      'revoke all on public.%I from public, anon, authenticated, service_role',
      relation_name
    );
    execute format(
      'grant select, insert, update, delete on public.%I to lean_hub_private_owner',
      relation_name
    );
    execute format(
      'create policy private_owner_all_%I on public.%I for all to lean_hub_private_owner using (true) with check (true)',
      relation_name,
      relation_name
    );
  end loop;
end
$$;
