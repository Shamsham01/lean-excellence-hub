-- Milestone 9: improvement suggestions domain, status history, draft RPCs.

create table public.improvement_suggestions (
  id uuid primary key,
  organisation_id uuid not null,
  suggestion_number text,
  programme_version_id uuid not null,
  programme_name_snapshot text,
  programme_code_snapshot text,
  title text not null,
  problem_or_opportunity text not null,
  proposed_idea text not null,
  expected_benefit_summary text,
  category_id uuid not null,
  category_name_snapshot text,
  category_code_snapshot text,
  origin_unit_id uuid not null,
  origin_unit_name_snapshot text,
  origin_unit_code_snapshot text,
  target_unit_id uuid,
  target_unit_name_snapshot text,
  target_unit_code_snapshot text,
  review_jurisdiction_unit_id uuid not null,
  author_membership_id uuid not null,
  template_submission_id uuid,
  status text not null default 'draft',
  submitted_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  implementation_started_at timestamptz,
  implemented_at timestamptz,
  withdrawn_at timestamptz,
  implementation_summary text,
  implementation_outcome text,
  implemented_by_membership_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint improvement_suggestions_organisation_id_id_key unique (organisation_id, id),
  constraint improvement_suggestions_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_programme_version_fkey
    foreign key (organisation_id, programme_version_id)
    references public.suggestion_programme_versions(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_category_fkey
    foreign key (organisation_id, category_id)
    references public.suggestion_categories(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_origin_unit_fkey
    foreign key (organisation_id, origin_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_target_unit_fkey
    foreign key (organisation_id, target_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_jurisdiction_unit_fkey
    foreign key (organisation_id, review_jurisdiction_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_author_fkey
    foreign key (organisation_id, author_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_template_submission_fkey
    foreign key (organisation_id, template_submission_id)
    references public.template_submissions(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_implemented_by_fkey
    foreign key (organisation_id, implemented_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint improvement_suggestions_number_org_key
    unique (organisation_id, suggestion_number),
  constraint improvement_suggestions_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint improvement_suggestions_problem_check
    check (problem_or_opportunity = btrim(problem_or_opportunity) and char_length(problem_or_opportunity) between 1 and 4000),
  constraint improvement_suggestions_idea_check
    check (proposed_idea = btrim(proposed_idea) and char_length(proposed_idea) between 1 and 4000),
  constraint improvement_suggestions_status_check
    check (
      status in (
        'draft',
        'submitted',
        'under_review',
        'accepted',
        'implementing',
        'implemented',
        'rejected',
        'withdrawn'
      )
    ),
  constraint improvement_suggestions_outcome_check
    check (
      implementation_outcome is null
      or implementation_outcome in (
        'implemented_as_proposed',
        'implemented_with_changes',
        'partial_implementation'
      )
    )
);

create table public.suggestion_status_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  suggestion_id uuid not null,
  from_status text not null,
  to_status text not null,
  changed_by_membership_id uuid not null,
  reason text,
  changed_at timestamptz not null default statement_timestamp(),
  constraint suggestion_status_history_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_status_history_suggestion_fkey
    foreign key (organisation_id, suggestion_id)
    references public.improvement_suggestions(organisation_id, id)
    on delete restrict,
  constraint suggestion_status_history_actor_fkey
    foreign key (organisation_id, changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create or replace function private.prevent_submitted_suggestion_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    if new.title is distinct from old.title
      or new.problem_or_opportunity is distinct from old.problem_or_opportunity
      or new.proposed_idea is distinct from old.proposed_idea
      or new.expected_benefit_summary is distinct from old.expected_benefit_summary
      or new.category_id is distinct from old.category_id
      or new.origin_unit_id is distinct from old.origin_unit_id
      or new.target_unit_id is distinct from old.target_unit_id
      or new.programme_version_id is distinct from old.programme_version_id
      or new.author_membership_id is distinct from old.author_membership_id
      or new.programme_name_snapshot is distinct from old.programme_name_snapshot
      or new.programme_code_snapshot is distinct from old.programme_code_snapshot
      or new.category_name_snapshot is distinct from old.category_name_snapshot
      or new.category_code_snapshot is distinct from old.category_code_snapshot
      or new.origin_unit_name_snapshot is distinct from old.origin_unit_name_snapshot
      or new.origin_unit_code_snapshot is distinct from old.origin_unit_code_snapshot
      or new.target_unit_name_snapshot is distinct from old.target_unit_name_snapshot
      or new.target_unit_code_snapshot is distinct from old.target_unit_code_snapshot
      or new.review_jurisdiction_unit_id is distinct from old.review_jurisdiction_unit_id
      or new.template_submission_id is distinct from old.template_submission_id then
      raise exception 'submitted suggestion content is immutable'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

create trigger improvement_suggestions_prevent_submitted_mutation
before update on public.improvement_suggestions
for each row execute function private.prevent_submitted_suggestion_mutation();

create trigger improvement_suggestions_touch_updated_at
before update on public.improvement_suggestions
for each row execute function private.touch_updated_at();

create trigger improvement_suggestions_prevent_org_change
before update on public.improvement_suggestions
for each row execute function private.prevent_organisation_id_change();

create trigger suggestion_status_history_prevent_update
before update on public.suggestion_status_history
for each row execute function private.prevent_update_or_delete();

create trigger suggestion_status_history_prevent_delete
before delete on public.suggestion_status_history
for each row execute function private.prevent_update_or_delete();

create index improvement_suggestions_org_status_idx
  on public.improvement_suggestions (organisation_id, status);
create index improvement_suggestions_org_author_idx
  on public.improvement_suggestions (organisation_id, author_membership_id);
create index improvement_suggestions_org_jurisdiction_idx
  on public.improvement_suggestions (organisation_id, review_jurisdiction_unit_id);

alter table public.improvement_suggestions enable row level security;
alter table public.improvement_suggestions force row level security;
alter table public.suggestion_status_history enable row level security;
alter table public.suggestion_status_history force row level security;

revoke all on public.improvement_suggestions from public, anon, authenticated, service_role;
revoke all on public.suggestion_status_history from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.improvement_suggestions to lean_hub_private_owner;
grant select, insert, update, delete on public.suggestion_status_history to lean_hub_private_owner;

create policy private_owner_all_improvement_suggestions
on public.improvement_suggestions for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_suggestion_status_history
on public.suggestion_status_history for all to lean_hub_private_owner using (true) with check (true);

-- can_read_improvement_suggestion completed in 06003 after contributor/reviewer tables exist.

-- RLS select policies installed in 06003 after can_read_improvement_suggestion exists.

alter function private.prevent_submitted_suggestion_mutation() owner to lean_hub_private_owner;
