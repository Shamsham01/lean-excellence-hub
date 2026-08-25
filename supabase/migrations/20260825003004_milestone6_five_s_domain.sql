create table public.five_s_standards (
  id uuid primary key,
  organisation_id uuid not null,
  template_id uuid not null,
  display_name text not null,
  description text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint five_s_standards_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_standards_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint five_s_standards_template_fkey
    foreign key (organisation_id, template_id)
    references public.templates(organisation_id, id)
    on delete restrict,
  constraint five_s_standards_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint five_s_standards_display_name_check
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 160)
);

create table public.five_s_standard_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  standard_id uuid not null,
  template_version_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  target_threshold_percent numeric not null default 90,
  weighting_enabled boolean not null default true,
  result_status_mappings jsonb not null default '{"meets_standard":{"min":90,"max":100},"below_standard":{"min":0,"max":89}}'::jsonb,
  created_by_membership_id uuid not null,
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_standard_versions_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_standard_versions_standard_version_key
    unique (organisation_id, standard_id, version_number),
  constraint five_s_standard_versions_template_version_key
    unique (organisation_id, template_version_id),
  constraint five_s_standard_versions_standard_fkey
    foreign key (organisation_id, standard_id)
    references public.five_s_standards(organisation_id, id)
    on delete restrict,
  constraint five_s_standard_versions_template_version_fkey
    foreign key (organisation_id, template_version_id)
    references public.template_versions(organisation_id, id)
    on delete restrict,
  constraint five_s_standard_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint five_s_standard_versions_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint five_s_standard_versions_threshold_check
    check (target_threshold_percent >= 0 and target_threshold_percent <= 100)
);

create table public.five_s_section_weights (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  standard_version_id uuid not null,
  section_id uuid not null,
  weight numeric not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_section_weights_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_section_weights_version_section_key
    unique (organisation_id, standard_version_id, section_id),
  constraint five_s_section_weights_version_fkey
    foreign key (organisation_id, standard_version_id)
    references public.five_s_standard_versions(organisation_id, id)
    on delete restrict,
  constraint five_s_section_weights_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint five_s_section_weights_weight_check
    check (weight > 0)
);

create table public.five_s_question_scoring (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  standard_version_id uuid not null,
  question_id uuid not null,
  contributes_to_score boolean not null default false,
  scoring_metadata jsonb,
  weight numeric not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_question_scoring_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_question_scoring_version_question_key
    unique (organisation_id, standard_version_id, question_id),
  constraint five_s_question_scoring_version_fkey
    foreign key (organisation_id, standard_version_id)
    references public.five_s_standard_versions(organisation_id, id)
    on delete restrict,
  constraint five_s_question_scoring_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint five_s_question_scoring_weight_check
    check (weight > 0),
  constraint five_s_question_scoring_metadata_check
    check (
      scoring_metadata is null
      or pg_catalog.jsonb_typeof(scoring_metadata) = 'object'
    )
);

create table public.five_s_audits (
  id uuid primary key,
  organisation_id uuid not null,
  standard_version_id uuid not null,
  unit_id uuid not null,
  submission_id uuid not null,
  schedule_occurrence_id uuid,
  auditor_membership_id uuid not null,
  status text not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  overall_score_percent numeric,
  target_percent numeric,
  result_status text,
  standard_name_snapshot text,
  template_version_number_snapshot integer,
  unit_name_snapshot text,
  unit_code_snapshot text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint five_s_audits_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_audits_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint five_s_audits_standard_version_fkey
    foreign key (organisation_id, standard_version_id)
    references public.five_s_standard_versions(organisation_id, id)
    on delete restrict,
  constraint five_s_audits_unit_fkey
    foreign key (organisation_id, unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint five_s_audits_submission_fkey
    foreign key (organisation_id, submission_id)
    references public.template_submissions(organisation_id, id)
    on delete restrict,
  constraint five_s_audits_schedule_occurrence_fkey
    foreign key (organisation_id, schedule_occurrence_id)
    references public.schedule_occurrences(organisation_id, id)
    on delete restrict,
  constraint five_s_audits_auditor_fkey
    foreign key (organisation_id, auditor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint five_s_audits_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint five_s_audits_status_check
    check (status in ('draft', 'in_progress', 'completed', 'cancelled'))
);

create table public.five_s_audit_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  audit_id uuid not null,
  section_id uuid not null,
  section_name_snapshot text not null,
  score_percent numeric not null,
  weight numeric not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_audit_score_snapshots_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_audit_score_snapshots_audit_section_key
    unique (organisation_id, audit_id, section_id),
  constraint five_s_audit_score_snapshots_audit_fkey
    foreign key (organisation_id, audit_id)
    references public.five_s_audits(organisation_id, id)
    on delete restrict,
  constraint five_s_audit_score_snapshots_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint five_s_audit_score_snapshots_score_check
    check (score_percent >= 0 and score_percent <= 100),
  constraint five_s_audit_score_snapshots_weight_check
    check (weight > 0)
);

create table public.five_s_audit_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  audit_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_audit_participants_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_audit_participants_audit_member_key
    unique (organisation_id, audit_id, membership_id),
  constraint five_s_audit_participants_audit_fkey
    foreign key (organisation_id, audit_id)
    references public.five_s_audits(organisation_id, id)
    on delete restrict,
  constraint five_s_audit_participants_member_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.five_s_audit_findings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  audit_id uuid not null,
  section_id uuid,
  question_id uuid,
  observation text not null,
  severity text,
  priority text,
  action_required boolean not null default false,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_audit_findings_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_audit_findings_audit_fkey
    foreign key (organisation_id, audit_id)
    references public.five_s_audits(organisation_id, id)
    on delete restrict,
  constraint five_s_audit_findings_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint five_s_audit_findings_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint five_s_audit_findings_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint five_s_audit_findings_observation_check
    check (observation = btrim(observation) and char_length(observation) between 1 and 2000)
);

create table public.five_s_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  audit_id uuid not null,
  attachment_id uuid not null,
  section_id uuid,
  question_id uuid,
  finding_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_evidence_links_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_evidence_links_audit_attachment_key
    unique (organisation_id, audit_id, attachment_id),
  constraint five_s_evidence_links_audit_fkey
    foreign key (organisation_id, audit_id)
    references public.five_s_audits(organisation_id, id)
    on delete restrict,
  constraint five_s_evidence_links_attachment_fkey
    foreign key (organisation_id, attachment_id)
    references public.attachments(organisation_id, id)
    on delete restrict,
  constraint five_s_evidence_links_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint five_s_evidence_links_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint five_s_evidence_links_finding_fkey
    foreign key (organisation_id, finding_id)
    references public.five_s_audit_findings(organisation_id, id)
    on delete restrict,
  constraint five_s_evidence_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.five_s_action_context (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  action_id uuid not null,
  audit_id uuid not null,
  section_id uuid,
  question_id uuid,
  finding_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint five_s_action_context_organisation_id_id_key unique (organisation_id, id),
  constraint five_s_action_context_action_key unique (organisation_id, action_id),
  constraint five_s_action_context_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint five_s_action_context_audit_fkey
    foreign key (organisation_id, audit_id)
    references public.five_s_audits(organisation_id, id)
    on delete restrict,
  constraint five_s_action_context_section_fkey
    foreign key (organisation_id, section_id)
    references public.template_sections(organisation_id, id)
    on delete restrict,
  constraint five_s_action_context_question_fkey
    foreign key (organisation_id, question_id)
    references public.template_questions(organisation_id, id)
    on delete restrict,
  constraint five_s_action_context_finding_fkey
    foreign key (organisation_id, finding_id)
    references public.five_s_audit_findings(organisation_id, id)
    on delete restrict,
  constraint five_s_action_context_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create index five_s_standard_versions_standard_idx
  on public.five_s_standard_versions (organisation_id, standard_id, status);
create index five_s_section_weights_version_idx
  on public.five_s_section_weights (organisation_id, standard_version_id);
create index five_s_audits_org_status_idx
  on public.five_s_audits (organisation_id, status);
create index five_s_audits_unit_idx
  on public.five_s_audits (organisation_id, unit_id);
create index five_s_audit_score_snapshots_audit_idx
  on public.five_s_audit_score_snapshots (organisation_id, audit_id);
create index five_s_evidence_links_audit_idx
  on public.five_s_evidence_links (organisation_id, audit_id);
create index five_s_action_context_audit_idx
  on public.five_s_action_context (organisation_id, audit_id);

create trigger five_s_standards_touch_updated_at
before update on public.five_s_standards
for each row execute function private.touch_updated_at();

create trigger five_s_standards_prevent_org_change
before update on public.five_s_standards
for each row execute function private.prevent_organisation_id_change();

create trigger five_s_audits_touch_updated_at
before update on public.five_s_audits
for each row execute function private.touch_updated_at();

create trigger five_s_audits_prevent_org_change
before update on public.five_s_audits
for each row execute function private.prevent_organisation_id_change();

create trigger five_s_audit_score_snapshots_prevent_update
before update on public.five_s_audit_score_snapshots
for each row execute function private.prevent_update_or_delete();

create trigger five_s_audit_score_snapshots_prevent_delete
before delete on public.five_s_audit_score_snapshots
for each row execute function private.prevent_update_or_delete();

create or replace function private.guard_five_s_audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  audit_status text;
begin
  select audit_row.status
  into audit_status
  from public.five_s_audits audit_row
  where audit_row.organisation_id = coalesce(new.organisation_id, old.organisation_id)
    and audit_row.id = coalesce(new.audit_id, old.audit_id);

  if audit_status = 'completed' then
    raise exception 'completed 5S audit is immutable'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger five_s_evidence_links_guard_immutable
before update or delete on public.five_s_evidence_links
for each row execute function private.guard_five_s_audit_immutable();

create trigger five_s_action_context_guard_immutable
before update or delete on public.five_s_action_context
for each row execute function private.guard_five_s_audit_immutable();

create trigger five_s_audit_findings_guard_immutable
before update or delete on public.five_s_audit_findings
for each row execute function private.guard_five_s_audit_immutable();

alter table public.five_s_standards enable row level security;
alter table public.five_s_standards force row level security;
alter table public.five_s_standard_versions enable row level security;
alter table public.five_s_standard_versions force row level security;
alter table public.five_s_section_weights enable row level security;
alter table public.five_s_section_weights force row level security;
alter table public.five_s_question_scoring enable row level security;
alter table public.five_s_question_scoring force row level security;
alter table public.five_s_audits enable row level security;
alter table public.five_s_audits force row level security;
alter table public.five_s_audit_score_snapshots enable row level security;
alter table public.five_s_audit_score_snapshots force row level security;
alter table public.five_s_audit_participants enable row level security;
alter table public.five_s_audit_participants force row level security;
alter table public.five_s_audit_findings enable row level security;
alter table public.five_s_audit_findings force row level security;
alter table public.five_s_evidence_links enable row level security;
alter table public.five_s_evidence_links force row level security;
alter table public.five_s_action_context enable row level security;
alter table public.five_s_action_context force row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'five_s_standards',
    'five_s_standard_versions',
    'five_s_section_weights',
    'five_s_question_scoring',
    'five_s_audits',
    'five_s_audit_score_snapshots',
    'five_s_audit_participants',
    'five_s_audit_findings',
    'five_s_evidence_links',
    'five_s_action_context'
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
