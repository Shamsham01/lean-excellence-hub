# Data model

## Status

Milestone 3 delivered the secure tenant foundation. Milestone 4 implements the
shared platform foundation described below.

## Identity, tenancy, hierarchy, and access

Approved Milestone 3 foundations:

- `profiles`: one minimal global display profile keyed to `auth.users`; no
  tenant roles or selected organisation.
- private identity controls: global account lifecycle, enrolment state,
  stewardship where applicable, and security timestamps. Auth deletion or
  anonymisation must not cascade away historical evidence.
- `organisations`: tenant root, reporting currency, locale/time zone, optimistic
  version, and `provisioning | active | suspended | closed` lifecycle.
- `organisation_memberships`: a unique user-to-organisation binding with
  tenant-specific person attributes and `pending | active | inactive`
  lifecycle. `pending` is allowed only after an Auth user is bound but before
  acceptance or enrolment completes.
- `organisation_invitations`: a separate, non-authorising recipient offer with
  token digest, expiry, lifecycle, inviter, and accepted membership reference.
  Invitation grants bind exact immutable role versions and scopes.
- `organisation_units`: an active/retired adjacency-list forest supporting
  customer-defined presentation without fixed depth or fixed site/department
  columns.
- `organisation_unit_closure`: transactionally maintained
  ancestor/descendant/depth rows, including depth-zero self rows.
- `permission_definitions`: migration-owned immutable keys for the secure
  foundation only. Benefits, exports, Storage, templates, and other future
  domains introduce their own permissions in their owning milestones.
- `roles`: stable organisation-owned role identities.
- `role_versions` and `role_permissions`: immutable published permission
  snapshots with explicit draft, published, and retired lifecycle.
- `access_grants`: revocable membership grants bound to an exact role version
  and `self`, `unit_subtree`, or `organisation` scope.
- private session organisation contexts: one selected organisation and
  membership per matching Supabase Auth session and user.
- private workforce accounts and aliases: at most one global account and
  high-entropy internal Auth identifier per Auth user, with
  organisation-scoped aliases mapped through memberships.
- `security_audit_events`: a narrow append-only Milestone 3 security ledger,
  not the later generic audit capability.
- server-only authentication rate-limit windows keyed by hashes rather than
  plaintext workforce or network identifiers.

Every exposed tenant-owned row carries `organisation_id` and a composite uniqueness target such as `(organisation_id, id)`. Composite foreign keys prevent cross-tenant references. Tenant-leading indexes support RLS predicates and common lifecycle, status, and unit queries.

See [ADR-0006](../adr/ADR-0006-session-bound-organisation-context.md),
[ADR-0007](../adr/ADR-0007-workforce-identity-disclosure-and-stewardship.md),
[ADR-0008](../adr/ADR-0008-version-bound-rbac-and-delegation.md), and
[ADR-0009](../adr/ADR-0009-tenant-lifecycle-and-hierarchy-mutation.md).

## Shared resource identity (Milestone 4)

- `resource_records`: narrow identity registry; not client-browseable.
- `private.can_access_resource(...)`: typed target-resource authorisation.
- Domain tables share primary keys with registry rows.

Shared capabilities implemented in Milestone 4:

- `actions`, `action_assignees`, `action_status_transitions`;
- `templates`, `template_versions`, `template_sections`, `template_questions`,
  `template_submissions`, `template_answers`, `template_answer_people`;
- `attachments` with two-phase `pending_upload -> active` lifecycle;
- `comments` with target-resource authorisation;
- `business_audit_events` (append-only, default-deny read);
- `private.domain_event_outbox` (unexposed transactional event seam).

See [ADR-0012](../adr/ADR-0012-milestone-4-shared-foundation-boundary.md).

## Shared resource identity (conceptual remainder)

## Universal versioned forms

- `templates` provide stable identity and experience/type classification.
- `template_versions` are immutable after publication and carry Draft, Published, or Archived lifecycle metadata.
- Version-owned sections and questions define the exact form content and ordering.
- Submissions reference the exact template version used.
- Answers reference the exact versioned question answered.
- Publishing and successor-version creation are transactional; published rows are never edited in place.

Gemba, 5S, Leader Standard Work, maturity, and similar forms share this engine. Curriculum and structured problem-solving use typed domain extensions where their semantics genuinely differ.

## Workflow, audit, events, and history

Domains define stable states and transition rules in application services. Shared transition history records the actor, tenant, resource, from/to states, reason, and time. Audit is tamper-resistant evidence, outbox events enable reactions, and activity is user-facing; they remain separate.

Historical labels or context are snapshotted only where reports must preserve wording. Immutable published versions, Benefit revisions, validations, realisations, transition history, and audit provide historical truth without universal temporal tables.

Milestone 3 introduces only the bounded security ledger needed for identity,
session, tenant, hierarchy, invitation, and RBAC operations. The generic audit
model, transactional outbox, user-facing activity, and domain workflow history
remain in the later shared foundation. See
[ADR-0011](../adr/ADR-0011-milestone-3-security-ledger.md).

## Benefits

Implemented in Milestone 10 as governed improvement-benefit value (not a general ledger):

- `benefit_reporting_settings`: organisation reporting currency and fiscal-year configuration.
- `benefit_categories`: organisation-configurable categories (no production migration seed; demo via `db:seed-demo`).
- `improvement_benefits`: authoritative benefit identity, classification (financial/non-financial), owner, unit, lifecycle, reporting-currency snapshot, standalone/source metadata.
- `benefit_status_history`: append-only lifecycle transitions.
- `benefit_submission_snapshots`: immutable submit-time benefit + forecast snapshot.
- `benefit_source_links`: draft-mutable, submit-immutable links to originating resources (project/suggestion); no value duplication.
- `benefit_forecast_versions` / `benefit_forecast_periods`: versioned forecasts with draft/submit/approve/successor lifecycle; period sums validated at submit/approval.
- `benefit_validation_assignments` / `benefit_validations`: CI and finance validation with separation of duties.
- `benefit_overlap_groups` / `benefit_overlap_allocations` / `benefit_overlap_allocation_history`: overlap control with RPC locking and append-only history.
- `benefit_realisation_entries`: dated actuals/measures with signed-delta adjustments and finance validation.

Authoritative money is stored as PostgreSQL `NUMERIC`. Portfolio queries aggregate forecast, validated, and realised totals separately by classification. M8/M9 integration uses `get_project_benefits` and `get_suggestion_benefits` without extending `get_ci_project_detail` or `get_suggestion_detail`.

## Problem Solving (Milestone 11)

Governed structured problem-solving cases with versioned methods and semantic separation of facts, assumptions, hypotheses, and verified causes:

- `problem_solving_methods`, `problem_solving_method_versions`, `problem_solving_method_stages`: built-in and organisation methods; published versions immutable; semantic stage keys (`DEFINE`, `CURRENT_CONDITION`, `CONTAIN`, `ROOT_CAUSE_ANALYSIS`, `COUNTERMEASURES`, `EFFECTIVENESS_CHECK`, `SUSTAIN`, etc.).
- `problem_solving_cases`: first-class case identity in `resource_records`; lifecycle `draft` → `active` → `closed` / `cancelled`; pinned `method_version_id` and `current_method_stage_id`; closure outcomes `resolved_verified_cause`, `resolved_without_verified_cause`, `transferred`.
- `problem_solving_status_history`, `problem_solving_stage_history`: append-only transition evidence.
- `problem_solving_source_links`: generic resource links (`primary` / `related`) without granting source access.
- `problem_solving_participants`: case team roles separate from RBAC grants.
- `problem_solving_current_condition_items`: categorised observations/facts/assumptions with verification and supersession.
- `problem_solving_evidence_links`: shared attachment links with exactly-one subject constraint (condition, containment, hypothesis, test, countermeasure, effectiveness, sustainment, session, case-level).
- `problem_solving_containments`: temporary control records (`proposed` / `active` / `released`).
- `problem_solving_hypotheses`, `problem_solving_hypothesis_status_history`: cause hypotheses with controlled verification.
- `problem_solving_hypothesis_tests`: explicit tests (`supports` / `refutes` / `inconclusive`).
- `problem_solving_analyses`, `problem_solving_analysis_nodes`: structured analysis graphs linked to hypotheses.
- `problem_solving_countermeasures`, `problem_solving_countermeasure_cause_links`: countermeasure lifecycle and cause relationships.
- `problem_solving_action_context`: links universal `actions` to containment, countermeasure, or sustainment context.
- `problem_solving_effectiveness_checks`, `problem_solving_effectiveness_evidence_links`: post-implementation verification.
- `problem_solving_sustainment_items`, `problem_solving_lessons_learned`: standardisation and closure knowledge.
- `problem_solving_sessions`, `problem_solving_session_participants`, `problem_solving_session_entries`: human facilitation history.

Authoritative mutations use scoped RPCs; portfolio/detail reads use `get_problem_solving_overview`, `get_problem_solving_list`, `get_problem_solving_detail`, and `get_problem_solving_methods`. See [problem-solving-engine.md](./problem-solving-engine.md).

## Lifecycle and retention

No universal soft-delete convention is approved. Each aggregate chooses an
explicit lifecycle based on history, legal obligations, and restoration needs.
Only active global identity, organisation, and membership state authorises
normal tenant access. Disabling one membership removes that organisation path
without disabling the global Auth identity or another membership. Relevant
security transitions preserve historical actor references, record actor/reason
and time, and revoke affected sessions.

## Deferred validation

Milestone 3 must prove its migration reset and generated types, composite
integrity, tenant-leading index use, immutable role versions, append-only
security evidence, hierarchy concurrency and rollback, lifecycle enforcement,
session-bound selection, scoped delegation, and cross-tenant denial. Published
template immutability, generic audit/outbox behaviour, event idempotency,
Storage, exports, and financial separation belong to later milestones. No empty
speculative tables are created before their owning milestone.
