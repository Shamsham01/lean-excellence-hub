-- Milestone 12: AI proposals, typed source references, acceptance provenance.

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  ai_session_id uuid not null,
  ai_run_id uuid not null,
  ai_message_id uuid,
  proposal_type text not null,
  status text not null default 'pending',
  payload_json jsonb not null,
  human_explanation text not null,
  display_permission_key text,
  problem_solving_case_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  resolved_by_membership_id uuid,
  rejection_reason text,
  constraint ai_proposals_organisation_id_id_key unique (organisation_id, id),
  constraint ai_proposals_session_fkey
    foreign key (organisation_id, ai_session_id)
    references public.ai_sessions(organisation_id, id)
    on delete restrict,
  constraint ai_proposals_run_fkey
    foreign key (organisation_id, ai_run_id)
    references public.ai_runs(organisation_id, id)
    on delete restrict,
  constraint ai_proposals_message_fkey
    foreign key (organisation_id, ai_message_id)
    references public.ai_messages(organisation_id, id)
    on delete restrict,
  constraint ai_proposals_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint ai_proposals_resolver_fkey
    foreign key (organisation_id, resolved_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ai_proposals_type_check
    check (
      proposal_type in (
        'current_condition_item',
        'hypothesis',
        'hypothesis_test',
        'containment',
        'countermeasure',
        'universal_action',
        'effectiveness_check',
        'sustainment_item',
        'session_question',
        'session_summary',
        'lessons_learned'
      )
    ),
  constraint ai_proposals_status_check
    check (status in ('pending', 'accepted', 'rejected', 'expired', 'superseded')),
  constraint ai_proposals_payload_check
    check (jsonb_typeof(payload_json) = 'object'),
  constraint ai_proposals_explanation_check
    check (
      human_explanation = btrim(human_explanation)
      and char_length(human_explanation) between 1 and 4000
    )
);

create table public.ai_source_references (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  ai_run_id uuid,
  ai_message_id uuid,
  ai_proposal_id uuid,
  problem_solving_case_id uuid,
  current_condition_item_id uuid,
  containment_id uuid,
  hypothesis_id uuid,
  hypothesis_test_id uuid,
  countermeasure_id uuid,
  effectiveness_check_id uuid,
  sustainment_item_id uuid,
  problem_solving_session_id uuid,
  action_id uuid,
  lesson_learned_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  constraint ai_source_references_organisation_id_id_key unique (organisation_id, id),
  constraint ai_source_references_run_fkey
    foreign key (organisation_id, ai_run_id)
    references public.ai_runs(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_message_fkey
    foreign key (organisation_id, ai_message_id)
    references public.ai_messages(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_proposal_fkey
    foreign key (organisation_id, ai_proposal_id)
    references public.ai_proposals(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_cc_item_fkey
    foreign key (organisation_id, current_condition_item_id)
    references public.problem_solving_current_condition_items(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_containment_fkey
    foreign key (organisation_id, containment_id)
    references public.problem_solving_containments(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_hypothesis_fkey
    foreign key (organisation_id, hypothesis_id)
    references public.problem_solving_hypotheses(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_hypothesis_test_fkey
    foreign key (organisation_id, hypothesis_test_id)
    references public.problem_solving_hypothesis_tests(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_countermeasure_fkey
    foreign key (organisation_id, countermeasure_id)
    references public.problem_solving_countermeasures(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_effectiveness_fkey
    foreign key (organisation_id, effectiveness_check_id)
    references public.problem_solving_effectiveness_checks(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_sustainment_fkey
    foreign key (organisation_id, sustainment_item_id)
    references public.problem_solving_sustainment_items(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_ps_session_fkey
    foreign key (organisation_id, problem_solving_session_id)
    references public.problem_solving_sessions(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_lesson_fkey
    foreign key (organisation_id, lesson_learned_id)
    references public.problem_solving_lessons_learned(organisation_id, id)
    on delete restrict,
  constraint ai_source_references_exact_one_check
    check (
      num_nonnulls(
        problem_solving_case_id,
        current_condition_item_id,
        containment_id,
        hypothesis_id,
        hypothesis_test_id,
        countermeasure_id,
        effectiveness_check_id,
        sustainment_item_id,
        problem_solving_session_id,
        action_id,
        lesson_learned_id
      ) = 1
    )
);

create table public.ai_acceptance_provenance (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  ai_proposal_id uuid not null,
  accepted_by_membership_id uuid not null,
  ai_run_id uuid not null,
  current_condition_item_id uuid,
  containment_id uuid,
  hypothesis_id uuid,
  hypothesis_test_id uuid,
  countermeasure_id uuid,
  effectiveness_check_id uuid,
  sustainment_item_id uuid,
  problem_solving_session_id uuid,
  session_entry_id uuid,
  action_id uuid,
  lesson_learned_id uuid,
  accepted_at timestamptz not null default statement_timestamp(),
  constraint ai_acceptance_provenance_organisation_id_id_key unique (organisation_id, id),
  constraint ai_acceptance_provenance_proposal_key unique (organisation_id, ai_proposal_id),
  constraint ai_acceptance_provenance_proposal_fkey
    foreign key (organisation_id, ai_proposal_id)
    references public.ai_proposals(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_accepter_fkey
    foreign key (organisation_id, accepted_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_run_fkey
    foreign key (organisation_id, ai_run_id)
    references public.ai_runs(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_cc_item_fkey
    foreign key (organisation_id, current_condition_item_id)
    references public.problem_solving_current_condition_items(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_containment_fkey
    foreign key (organisation_id, containment_id)
    references public.problem_solving_containments(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_hypothesis_fkey
    foreign key (organisation_id, hypothesis_id)
    references public.problem_solving_hypotheses(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_hypothesis_test_fkey
    foreign key (organisation_id, hypothesis_test_id)
    references public.problem_solving_hypothesis_tests(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_countermeasure_fkey
    foreign key (organisation_id, countermeasure_id)
    references public.problem_solving_countermeasures(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_effectiveness_fkey
    foreign key (organisation_id, effectiveness_check_id)
    references public.problem_solving_effectiveness_checks(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_sustainment_fkey
    foreign key (organisation_id, sustainment_item_id)
    references public.problem_solving_sustainment_items(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_ps_session_fkey
    foreign key (organisation_id, problem_solving_session_id)
    references public.problem_solving_sessions(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_session_entry_fkey
    foreign key (organisation_id, session_entry_id)
    references public.problem_solving_session_entries(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_action_fkey
    foreign key (organisation_id, action_id)
    references public.actions(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_lesson_fkey
    foreign key (organisation_id, lesson_learned_id)
    references public.problem_solving_lessons_learned(organisation_id, id)
    on delete restrict,
  constraint ai_acceptance_provenance_exact_one_check
    check (
      num_nonnulls(
        current_condition_item_id,
        containment_id,
        hypothesis_id,
        hypothesis_test_id,
        countermeasure_id,
        effectiveness_check_id,
        sustainment_item_id,
        problem_solving_session_id,
        session_entry_id,
        action_id,
        lesson_learned_id
      ) = 1
    )
);

create index ai_proposals_session_idx
  on public.ai_proposals (organisation_id, ai_session_id, created_at desc);

create index ai_proposals_pending_idx
  on public.ai_proposals (organisation_id, status)
  where status = 'pending';

alter table public.ai_proposals enable row level security;
alter table public.ai_proposals force row level security;
alter table public.ai_source_references enable row level security;
alter table public.ai_source_references force row level security;
alter table public.ai_acceptance_provenance enable row level security;
alter table public.ai_acceptance_provenance force row level security;

revoke all on public.ai_proposals from public, anon, authenticated, service_role;
revoke all on public.ai_source_references from public, anon, authenticated, service_role;
revoke all on public.ai_acceptance_provenance from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.ai_proposals to lean_hub_private_owner;
grant select, insert, update, delete on public.ai_source_references to lean_hub_private_owner;
grant select, insert, update, delete on public.ai_acceptance_provenance to lean_hub_private_owner;

create policy private_owner_all_ai_proposals
on public.ai_proposals for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ai_source_references
on public.ai_source_references for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ai_acceptance_provenance
on public.ai_acceptance_provenance for all to lean_hub_private_owner
using (true) with check (true);

grant select on public.ai_proposals to authenticated;
grant select on public.ai_source_references to authenticated;
grant select on public.ai_acceptance_provenance to authenticated;
