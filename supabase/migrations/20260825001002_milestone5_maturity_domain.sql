create table public.maturity_models (
  id uuid primary key,
  organisation_id uuid not null,
  template_id uuid not null,
  display_name text not null,
  description text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint maturity_models_organisation_id_id_key unique (organisation_id, id),
  constraint maturity_models_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint maturity_models_template_fkey
    foreign key (organisation_id, template_id)
    references public.templates(organisation_id, id)
    on delete restrict,
  constraint maturity_models_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint maturity_models_display_name_check
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 160)
);

create table public.maturity_model_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  model_id uuid not null,
  template_version_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  weighting_enabled boolean not null default true,
  created_by_membership_id uuid not null,
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_model_versions_organisation_id_id_key unique (organisation_id, id),
  constraint maturity_model_versions_model_version_key
    unique (organisation_id, model_id, version_number),
  constraint maturity_model_versions_template_version_key
    unique (organisation_id, template_version_id),
  constraint maturity_model_versions_model_fkey
    foreign key (organisation_id, model_id)
    references public.maturity_models(organisation_id, id)
    on delete restrict,
  constraint maturity_model_versions_template_version_fkey
    foreign key (organisation_id, template_version_id)
    references public.template_versions(organisation_id, id)
    on delete restrict,
  constraint maturity_model_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint maturity_model_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table public.maturity_levels (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  model_version_id uuid not null,
  level_number integer not null,
  name text not null,
  description text,
  color_token text not null,
  guidance text,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_levels_organisation_id_id_key unique (organisation_id, id),
  constraint maturity_levels_version_level_key
    unique (organisation_id, model_version_id, level_number),
  constraint maturity_levels_version_fkey
    foreign key (organisation_id, model_version_id)
    references public.maturity_model_versions(organisation_id, id)
    on delete restrict,
  constraint maturity_levels_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint maturity_levels_color_token_check
    check (color_token = btrim(color_token) and char_length(color_token) between 1 and 40)
);

create table public.maturity_pillars (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  model_version_id uuid not null,
  section_id uuid not null,
  position integer not null,
  name text not null,
  description text,
  weight numeric not null default 1,
  guidance text,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_pillars_organisation_id_id_key unique (organisation_id, id),
  constraint maturity_pillars_version_position_key
    unique (organisation_id, model_version_id, position),
  constraint maturity_pillars_version_section_key
    unique (organisation_id, model_version_id, section_id),
  constraint maturity_pillars_version_fkey
    foreign key (organisation_id, model_version_id)
    references public.maturity_model_versions(organisation_id, id)
    on delete restrict,
  constraint maturity_pillars_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint maturity_pillars_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint maturity_pillars_weight_check
    check (weight > 0)
);

create table public.maturity_criteria (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  pillar_id uuid not null,
  position integer not null,
  name text not null,
  description text,
  expected_evidence text,
  guidance text,
  weight numeric not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_criteria_organisation_id_id_key unique (organisation_id, id),
  constraint maturity_criteria_pillar_position_key
    unique (organisation_id, pillar_id, position),
  constraint maturity_criteria_pillar_fkey
    foreign key (organisation_id, pillar_id)
    references public.maturity_pillars(organisation_id, id)
    on delete restrict,
  constraint maturity_criteria_name_check
    check (name = btrim(name) and char_length(name) between 1 and 200),
  constraint maturity_criteria_weight_check
    check (weight > 0)
);

create table public.maturity_criterion_questions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  criterion_id uuid not null,
  question_id uuid not null,
  contributes_to_score boolean not null default false,
  scoring_metadata jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_criterion_questions_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_criterion_questions_criterion_question_key
    unique (organisation_id, criterion_id, question_id),
  constraint maturity_criterion_questions_criterion_fkey
    foreign key (organisation_id, criterion_id)
    references public.maturity_criteria(organisation_id, id)
    on delete restrict,
  constraint maturity_criterion_questions_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint maturity_criterion_questions_metadata_check
    check (
      scoring_metadata is null
      or pg_catalog.jsonb_typeof(scoring_metadata) = 'object'
    )
);

create table public.maturity_assessments (
  id uuid primary key,
  organisation_id uuid not null,
  assessment_type text not null,
  status text not null default 'draft',
  unit_id uuid not null,
  model_version_id uuid not null,
  submission_id uuid not null,
  lead_assessor_membership_id uuid,
  created_by_membership_id uuid not null,
  started_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint maturity_assessments_organisation_id_id_key unique (organisation_id, id),
  constraint maturity_assessments_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint maturity_assessments_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint maturity_assessments_model_version_fkey
    foreign key (organisation_id, model_version_id)
    references public.maturity_model_versions(organisation_id, id)
    on delete restrict,
  constraint maturity_assessments_submission_fkey
    foreign key (organisation_id, submission_id)
    references public.template_submissions(organisation_id, id)
    on delete restrict,
  constraint maturity_assessments_lead_assessor_fkey
    foreign key (organisation_id, lead_assessor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint maturity_assessments_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint maturity_assessments_type_check
    check (assessment_type in ('self', 'formal')),
  constraint maturity_assessments_status_check
    check (
      status in (
        'draft',
        'in_progress',
        'submitted',
        'assessor_review',
        'approved',
        'published',
        'completed',
        'cancelled'
      )
    )
);

create table public.maturity_assessment_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assessment_id uuid not null,
  membership_id uuid not null,
  participant_role text not null default 'contributor',
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_assessment_participants_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_assessment_participants_assessment_member_key
    unique (organisation_id, assessment_id, membership_id),
  constraint maturity_assessment_participants_assessment_fkey
    foreign key (organisation_id, assessment_id)
    references public.maturity_assessments(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_participants_member_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_participants_role_check
    check (participant_role in ('contributor', 'observer'))
);

create table public.maturity_assessment_transitions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assessment_id uuid not null,
  from_status text not null,
  to_status text not null,
  actor_membership_id uuid not null,
  reason text,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_assessment_transitions_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_assessment_transitions_assessment_fkey
    foreign key (organisation_id, assessment_id)
    references public.maturity_assessments(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_transitions_actor_fkey
    foreign key (organisation_id, actor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.maturity_assessment_scores (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assessment_id uuid not null,
  score_level text not null,
  entity_id uuid,
  score numeric not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_assessment_scores_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_assessment_scores_assessment_level_entity_key
    unique (organisation_id, assessment_id, score_level, entity_id),
  constraint maturity_assessment_scores_assessment_fkey
    foreign key (organisation_id, assessment_id)
    references public.maturity_assessments(organisation_id, id)
    on delete restrict,
  constraint maturity_assessment_scores_level_check
    check (score_level in ('question', 'criterion', 'pillar', 'overall')),
  constraint maturity_assessment_scores_score_check
    check (score >= 0)
);

create table public.maturity_official_results (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assessment_id uuid not null,
  model_version_id uuid not null,
  overall_score numeric not null,
  published_by_membership_id uuid not null,
  published_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_official_results_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_official_results_assessment_key
    unique (organisation_id, assessment_id),
  constraint maturity_official_results_assessment_fkey
    foreign key (organisation_id, assessment_id)
    references public.maturity_assessments(organisation_id, id)
    on delete restrict,
  constraint maturity_official_results_model_version_fkey
    foreign key (organisation_id, model_version_id)
    references public.maturity_model_versions(organisation_id, id)
    on delete restrict,
  constraint maturity_official_results_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint maturity_official_results_score_check
    check (overall_score >= 0)
);

create table public.maturity_official_result_pillars (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  official_result_id uuid not null,
  pillar_id uuid not null,
  pillar_name text not null,
  pillar_position integer not null,
  score numeric not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_official_result_pillars_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_official_result_pillars_result_pillar_key
    unique (organisation_id, official_result_id, pillar_id),
  constraint maturity_official_result_pillars_result_fkey
    foreign key (organisation_id, official_result_id)
    references public.maturity_official_results(organisation_id, id)
    on delete restrict,
  constraint maturity_official_result_pillars_pillar_fkey
    foreign key (organisation_id, pillar_id)
    references public.maturity_pillars(organisation_id, id)
    on delete restrict,
  constraint maturity_official_result_pillars_score_check
    check (score >= 0)
);

create table public.maturity_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assessment_id uuid not null,
  attachment_id uuid not null,
  criterion_id uuid not null,
  question_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_evidence_links_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_evidence_links_assessment_attachment_criterion_key
    unique (organisation_id, assessment_id, attachment_id, criterion_id, question_id),
  constraint maturity_evidence_links_assessment_fkey
    foreign key (organisation_id, assessment_id)
    references public.maturity_assessments(organisation_id, id)
    on delete restrict,
  constraint maturity_evidence_links_attachment_fkey
    foreign key (organisation_id, attachment_id)
    references public.attachments(organisation_id, id)
    on delete restrict,
  constraint maturity_evidence_links_criterion_fkey
    foreign key (organisation_id, criterion_id)
    references public.maturity_criteria(organisation_id, id)
    on delete restrict,
  constraint maturity_evidence_links_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint maturity_evidence_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.maturity_action_context (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  assessment_id uuid not null,
  pillar_id uuid not null,
  criterion_id uuid not null,
  question_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint maturity_action_context_organisation_id_id_key
    unique (organisation_id, id),
  constraint maturity_action_context_action_key
    unique (organisation_id, action_id),
  constraint maturity_action_context_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint maturity_action_context_assessment_fkey
    foreign key (organisation_id, assessment_id)
    references public.maturity_assessments(organisation_id, id)
    on delete restrict,
  constraint maturity_action_context_pillar_fkey
    foreign key (organisation_id, pillar_id)
    references public.maturity_pillars(organisation_id, id)
    on delete restrict,
  constraint maturity_action_context_criterion_fkey
    foreign key (organisation_id, criterion_id)
    references public.maturity_criteria(organisation_id, id)
    on delete restrict,
  constraint maturity_action_context_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint maturity_action_context_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create index maturity_model_versions_model_idx
  on public.maturity_model_versions (organisation_id, model_id, status);
create index maturity_levels_version_idx
  on public.maturity_levels (organisation_id, model_version_id, level_number);
create index maturity_pillars_version_idx
  on public.maturity_pillars (organisation_id, model_version_id, position);
create index maturity_criteria_pillar_idx
  on public.maturity_criteria (organisation_id, pillar_id, position);
create index maturity_assessments_org_status_idx
  on public.maturity_assessments (organisation_id, status);
create index maturity_assessments_unit_idx
  on public.maturity_assessments (organisation_id, unit_id);
create index maturity_assessment_scores_assessment_idx
  on public.maturity_assessment_scores (organisation_id, assessment_id);
create index maturity_evidence_links_assessment_idx
  on public.maturity_evidence_links (organisation_id, assessment_id);
create index maturity_action_context_assessment_idx
  on public.maturity_action_context (organisation_id, assessment_id);

create trigger maturity_models_touch_updated_at
before update on public.maturity_models
for each row execute function private.touch_updated_at();

create trigger maturity_models_prevent_org_change
before update on public.maturity_models
for each row execute function private.prevent_organisation_id_change();

create trigger maturity_assessments_touch_updated_at
before update on public.maturity_assessments
for each row execute function private.touch_updated_at();

create trigger maturity_assessments_prevent_org_change
before update on public.maturity_assessments
for each row execute function private.prevent_organisation_id_change();

create trigger maturity_assessment_transitions_prevent_update
before update on public.maturity_assessment_transitions
for each row execute function private.prevent_update_or_delete();

create trigger maturity_assessment_transitions_prevent_delete
before delete on public.maturity_assessment_transitions
for each row execute function private.prevent_update_or_delete();

create trigger maturity_official_results_prevent_update
before update on public.maturity_official_results
for each row execute function private.prevent_update_or_delete();

create trigger maturity_official_results_prevent_delete
before delete on public.maturity_official_results
for each row execute function private.prevent_update_or_delete();

create trigger maturity_official_result_pillars_prevent_update
before update on public.maturity_official_result_pillars
for each row execute function private.prevent_update_or_delete();

create trigger maturity_official_result_pillars_prevent_delete
before delete on public.maturity_official_result_pillars
for each row execute function private.prevent_update_or_delete();

create or replace function private.guard_maturity_assessment_context_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assessment_status text;
  assessment_type text;
begin
  select assessment_row.status, assessment_row.assessment_type
  into assessment_status, assessment_type
  from public.maturity_assessments assessment_row
  where assessment_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and assessment_row.id = coalesce(new.assessment_id, old.assessment_id);

  if assessment_status = 'published'
    or (assessment_type = 'self' and assessment_status = 'completed') then
    raise exception 'maturity assessment context is immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger maturity_evidence_links_guard_immutable
before update or delete on public.maturity_evidence_links
for each row execute function private.guard_maturity_assessment_context_immutable();

create trigger maturity_action_context_guard_immutable
before update or delete on public.maturity_action_context
for each row execute function private.guard_maturity_assessment_context_immutable();

alter table public.maturity_models enable row level security;
alter table public.maturity_models force row level security;
alter table public.maturity_model_versions enable row level security;
alter table public.maturity_model_versions force row level security;
alter table public.maturity_levels enable row level security;
alter table public.maturity_levels force row level security;
alter table public.maturity_pillars enable row level security;
alter table public.maturity_pillars force row level security;
alter table public.maturity_criteria enable row level security;
alter table public.maturity_criteria force row level security;
alter table public.maturity_criterion_questions enable row level security;
alter table public.maturity_criterion_questions force row level security;
alter table public.maturity_assessments enable row level security;
alter table public.maturity_assessments force row level security;
alter table public.maturity_assessment_participants enable row level security;
alter table public.maturity_assessment_participants force row level security;
alter table public.maturity_assessment_transitions enable row level security;
alter table public.maturity_assessment_transitions force row level security;
alter table public.maturity_assessment_scores enable row level security;
alter table public.maturity_assessment_scores force row level security;
alter table public.maturity_official_results enable row level security;
alter table public.maturity_official_results force row level security;
alter table public.maturity_official_result_pillars enable row level security;
alter table public.maturity_official_result_pillars force row level security;
alter table public.maturity_evidence_links enable row level security;
alter table public.maturity_evidence_links force row level security;
alter table public.maturity_action_context enable row level security;
alter table public.maturity_action_context force row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'maturity_models',
    'maturity_model_versions',
    'maturity_levels',
    'maturity_pillars',
    'maturity_criteria',
    'maturity_criterion_questions',
    'maturity_assessments',
    'maturity_assessment_participants',
    'maturity_assessment_transitions',
    'maturity_assessment_scores',
    'maturity_official_results',
    'maturity_official_result_pillars',
    'maturity_evidence_links',
    'maturity_action_context'
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

create policy maturity_models_select
on public.maturity_models for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'maturity.read', null, null)
);

create policy maturity_model_versions_select
on public.maturity_model_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'maturity.read', null, null)
);

create policy maturity_levels_select
on public.maturity_levels for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'maturity.read', null, null)
);

create policy maturity_pillars_select
on public.maturity_pillars for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'maturity.read', null, null)
);

create policy maturity_criteria_select
on public.maturity_criteria for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'maturity.read', null, null)
);

create policy maturity_criterion_questions_select
on public.maturity_criterion_questions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.has_scoped_permission(organisation_id, 'maturity.read', null, null)
);

create policy maturity_assessments_select
on public.maturity_assessments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, id)
);

create policy maturity_assessment_participants_select
on public.maturity_assessment_participants for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, assessment_id)
);

create policy maturity_assessment_transitions_select
on public.maturity_assessment_transitions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, assessment_id)
);

create policy maturity_assessment_scores_select
on public.maturity_assessment_scores for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, assessment_id)
);

create policy maturity_official_results_select
on public.maturity_official_results for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, assessment_id)
);

create policy maturity_official_result_pillars_select
on public.maturity_official_result_pillars for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.maturity_official_results official_result
    where official_result.organisation_id = maturity_official_result_pillars.organisation_id
      and official_result.id = maturity_official_result_pillars.official_result_id
      and private.can_read_maturity_assessment(
        official_result.organisation_id,
        official_result.assessment_id
      )
  )
);

create policy maturity_evidence_links_select
on public.maturity_evidence_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, assessment_id)
);

create policy maturity_action_context_select
on public.maturity_action_context for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_maturity_assessment(organisation_id, assessment_id)
);

grant select on public.maturity_models to authenticated;
grant select on public.maturity_model_versions to authenticated;
grant select on public.maturity_levels to authenticated;
grant select on public.maturity_pillars to authenticated;
grant select on public.maturity_criteria to authenticated;
grant select on public.maturity_criterion_questions to authenticated;
grant select on public.maturity_assessments to authenticated;
grant select on public.maturity_assessment_participants to authenticated;
grant select on public.maturity_assessment_transitions to authenticated;
grant select on public.maturity_assessment_scores to authenticated;
grant select on public.maturity_official_results to authenticated;
grant select on public.maturity_official_result_pillars to authenticated;
grant select on public.maturity_evidence_links to authenticated;
grant select on public.maturity_action_context to authenticated;

alter function private.guard_maturity_assessment_context_immutable()
  owner to lean_hub_private_owner;
