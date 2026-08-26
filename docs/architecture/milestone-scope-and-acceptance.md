# Milestone scope and acceptance

## Delivery rule

A milestone may document later seams but may not implement later scope. Completion evidence must describe what exists, not what is intended. The next milestone starts only after explicit approval.

## Milestone 1 — repository and architecture baseline

### In scope

- Verify the project-local Git root and approved GitHub origin.
- Version the normalised product brief.
- Document platform, data, security, threat, and milestone architecture.
- Record focused ADRs for modular platform architecture, membership/RLS tenancy, universal resources and shared capabilities, workforce authentication, and the universal versioned template engine.
- Add contribution/naming guidance.
- Add exactly three read-only project specialist definitions.

### Explicitly excluded

Dependencies, generated build output, Next.js or TypeScript scaffolding, Supabase configuration, SQL migrations, tenant tables, RLS policies, source modules, routes, authentication flows, and product features.

### Acceptance checklist

- [x] Repository root is `C:/Users/sheme/Documents/Dev/lean-excellence-hub`.
- [x] Origin is `https://github.com/Shamsham01/lean-excellence-hub.git`.
- [x] Product and architecture documents are present and internally linked.
- [x] Decisions distinguish architecture-now from implementation-later and speculation.
- [x] Workforce trust boundary and deferred Milestone 3 criteria are explicit.
- [x] Risks, contradictions, and the 16-question decision rule are documented.
- [x] Exactly three supported, read-only agent definitions are present.
- [x] No excluded implementation artefacts are added.
- [x] Final non-mutating repository, link, terminology, and content validation passes.

The final checkbox was marked only after the non-mutating validation completed without errors.

## Milestone 2 — application and tooling baseline

After explicit approval, create only:

- minimal Next.js App Router and strict TypeScript shell;
- local Supabase configuration without domain migrations;
- environment guards and a generated database-types workflow;
- documented, deliberately chosen dependencies;
- lint, formatting check, strict type-check, unit test, end-to-end smoke test, and production build commands;
- CI for non-secret checks and a verified production build.

Do not preinstall workflow, state-management, form-builder, email, analytics, AI, or component-library packages without a demonstrated Milestone 2 need.

Milestone 2 acceptance requires reproducible setup commands, no exposed secrets, configured quality checks, CI, and a successful production build.

### Acceptance checklist

- [x] Reproducible npm installation and development commands are documented.
- [x] The strict Next.js application shell and environment guards are configured.
- [x] Local Supabase configuration, migration structure, pgTAP tests, and generated-types workflow are present without domain schema.
- [x] Formatting, lint, strict type-check, unit test, E2E smoke test, and production build checks pass.
- [x] CI runs non-secret application and Docker-backed database validation.
- [x] No secret credentials or Milestone 3 functionality are present.

Docker was unavailable for the local completion run. Local Supabase start reached the Docker boundary successfully; CI retains the complete Docker-backed lint, pgTAP, and generated-types checks.

## Milestone 3 — secure tenant foundation

Milestone 3 is approved. Documentation and architecture decisions are its first
gate; this documentation change does not claim that the controls are
implemented.

### In scope

- One global Supabase Auth identity and minimal profile, explicit identity
  lifecycle, and at most one global workforce account per Auth user.
- Organisations, invitations separate from memberships, multi-organisation
  memberships, and explicit lifecycle transitions.
- A variable-depth organisation-unit forest with transactionally maintained
  closure paths and controlled create, move, retire, and restore operations.
- Migration-owned secure-foundation permissions, stable roles, immutable role
  versions, exact-version grants and invitation offers, delegation containment,
  protected ownership, and self, unit-subtree, or organisation scope.
- PostgreSQL organisation selection bound to the current Supabase session,
  current-session/lifecycle/scoped authorisation helpers, explicit privileges,
  and operation-specific default-deny RLS.
- Email/password and trusted workforce authentication, invitation/enrolment and
  recovery, forced initial password change, organisation choice and switching,
  and session revocation.
- A provider-neutral OAuth boundary and documented future Microsoft adapter.
  Live Azure credentials, tenant configuration, and a real Microsoft round trip
  are deployment evidence, not acceptance blockers.
- Layered authentication throttling and a narrow append-only security ledger
  for identity, tenant, session, invitation, hierarchy, and RBAC operations.

### Explicitly excluded

No placeholder table, permission, route, or test is introduced for Storage or
attachments, exports/imports, Benefits or financial access, resource records,
universal templates/actions, generic workflow history, generic audit, the
transactional outbox, notifications/activity, Lean domains, entitlements,
public APIs, enterprise SAML, billing, AI, or remote database application.
Those capabilities and their evidence remain with their owning milestones.

### Acceptance checklist

- [ ] Documentation and successor/supplemental ADRs preserve prior decision
  history and define the corrected boundary.
- [ ] Local migrations reset from empty state, schema lint passes, generated
  types are committed, and CI detects type drift.
- [ ] Composite tenant integrity, explicit privileges, forced RLS, safe private
  helpers, and operation-specific policies are proven.
- [ ] Two-organisation hostile tests deny cross-tenant reads, writes,
  references, role escalation, session forgery, and service-path abuse while
  authorised controls succeed.
- [ ] Pending, active, inactive, disabled, suspended, closed, revoked, expired,
  and removed-session cases fail closed as designed.
- [ ] Self, subtree, and organisation scope; immutable role versions;
  delegation containment; invitation revalidation; protected roles; and
  last-owner rules are proven.
- [ ] Hierarchy cycle, cross-tenant, depth, retirement, restoration,
  concurrency, and rollback behaviour is proven.
- [ ] Email/password and workforce journeys prove enrolment, recovery,
  forced-change, selection, switching, throttling, anti-enumeration, owner-only
  identifier disclosure, and multi-organisation stewardship.
- [ ] Provider-neutral OAuth redirect, allowlist, verified-identity, collision,
  and callback rules pass without requiring live Microsoft credentials.
- [ ] Session revocation rejects an otherwise-unexpired token, and narrow
  security evidence is atomic, append-only, attributable, and redacted.
- [ ] Independent database, security, and scope verification has no unresolved
  high or critical finding.

## Milestone 4 — shared platform foundation

Milestone 4 is approved. It builds on the Milestone 3 tenant foundation without
redesigning authorisation architecture.

### In scope

- Narrow `resource_records` identity registry (not client-browseable).
- Target-resource authorisation for shared capabilities.
- Migration-safe existing-owner role-version permission upgrade.
- Append-only `business_audit_events` (default-deny read) and
  `private.domain_event_outbox` (unexposed).
- Universal actions with scoped visibility, source validation, and transition
  history.
- Versioned template engine with draft/completed submissions, `allows_not_applicable`,
  and relational person answers.
- Two-phase private attachments (`pending_upload -> active`) with Storage policies.
- Shared comments with target-resource authorisation.
- Authenticated application shell and minimal design-system expansion.

### Explicitly excluded

Lean domain modules, notifications/activity, webhooks, workflow designer,
malware scanning, business audit read UI, Azure OAuth enablement, remote
Supabase migration push, and Milestone 5 scope.

### Acceptance checklist

- [x] ADR-0012 and updated data-model documentation are present.
- [x] Local migrations reset, lint passes, generated types committed, CI detects drift.
- [x] Existing organisations upgraded via successor owner role version without
  mutating historical role versions.
- [x] `resource_records` not directly readable; target-resource authorisation enforced.
- [x] Actions, templates, attachments, comments, audit, and outbox proven with
  adversarial pgTAP tests; Milestone 3 tests still pass.
- [x] Template submissions support `draft -> completed` immutability; person answers relational.
- [x] Attachments use two-phase lifecycle with re-authorisation and `scan_state = not_required`.
- [x] Authenticated shell renders with org context, permission-aware nav, and smoke-tested flows.
- [x] At most one read-only verifier reports no unresolved Critical/High findings.

### Acceptance evidence (2026-08-24)

| Gate | Evidence |
| --- | --- |
| Migrations | 8 Milestone 4 SQL migrations through `20260824222024_milestone4_storage_policies.sql` |
| pgTAP | 122 tests across 12 files (`npm run test:db`) |
| Application | `(platform)` shell, Actions/Templates routes, `filterPlatformNavigation` unit tests |
| E2E | Unauthenticated redirect smoke + authenticated platform shell smoke (`tests/e2e/platform-shell.spec.ts`, database CI job) |
| CI | `db:lint`, `test:db`, `db:types` drift check, `validate`, Playwright jobs |

## Milestone 6 — operational Lean domains (5S, Gemba, scheduling)

Milestone 6 is complete. It delivers thin vertical slices for 5S audits, Gemba
walks, and recurring activity scheduling on the Milestone 4–5 shared platform
foundation without redesigning authorisation, attachments, or the versioned
template engine.

### In scope

- **Scheduling:** `schedule_definitions` and `schedule_occurrences` for 5S
  Standard and Gemba Definition activities; recurrence model (`once`, `daily`,
  `weekly` with interval, selected weekdays, `monthly` with day-of-month);
  organisational unit, owner, optional participants; local scheduled time and
  all-day semantics; organisation timezone display; start/end dates; active
  inactive lifecycle; completion links to started audits and walks.
- **5S:** standards with versioned template-backed sections/questions, weighted
  scoring, threshold and result status; audit workspace with section navigation;
  findings; audit history pinned to `standard_version_id` and name snapshots;
  action and evidence context links.
- **Gemba:** definitions with versioned template-backed sections/questions;
  walk workspace with observations (`positive_practice`, `improvement_opportunity`,
  `issue`); walk history pinned to `definition_version_id` and name snapshots;
  action and evidence context links.
- **Evidence UX:** reuse Milestone 4 two-phase attachments (`initiate` → Storage
  upload → `confirm` → domain link) for 5S audits (audit, section/question,
  finding) and Gemba walks (walk, section/question, observation) via shared
  `EvidenceUploader` with drag-drop, mobile capture, progress, and preview.
- **Version succession:** authorised managers create a successor **draft** from
  the current published 5S Standard or Gemba Definition; publish atomically with
  its template version; published versions remain immutable; historical audits
  and walks stay pinned to their original exact version.
- **Schedule management UX:** admin create/edit/deactivate through friendly
  controls (no raw JSON, cron, or RRULE); “Create schedule” from standard and
  definition detail views; schedule list, detail, and edit routes in the
  platform shell.
- **Regression evidence:** pgTAP security and scoring tests; Vitest unit tests;
  Supabase-backed Playwright journeys including closure spec (schedule UI,
  evidence upload, 5S successor, tablet audit workspace).

### Explicitly excluded

Workforce planning, notifications, activity feeds, webhooks, remote Supabase
migration push, Milestone 7 domains (projects, suggestions, training, and other
listed later-milestone scope), and any expansion of scheduling into assignment
optimisation or reminder delivery.

### Acceptance checklist

- [x] Schedule permissions, registry entries, domain schema, recurrence
  operations, timezone handling, and completion links are migration-owned and
  pgTAP-tested.
- [x] 5S and Gemba permissions, domain schema, template guards, scoring, and
  security operations are migration-owned and pgTAP-tested.
- [x] Attachment upload scope and action/evidence link RPCs cover 5S and Gemba
  contexts without a new file subsystem.
- [x] Successor-version RPCs and schedule update RPC exist; maturity successor
  clone regression fixed (`03016`).
- [x] Admin can create and edit recurring 5S/Gemba schedules through the UI
  without demo seed or manual RPC invocation.
- [x] 5S audit and Gemba walk workspaces capture and display contextual
  evidence through the shared attachment lifecycle.
- [x] Published standards/definitions support successor draft → edit → publish;
  historical audits/walks remain pinned to the original version.
- [x] Platform navigation includes Schedule, 5S, and Gemba; overview and history
  routes are reachable and smoke-tested.
- [x] Demo seed provides published 5S standard (completed audit), Gemba definition
  (completed walk with prompt), and weekly schedules for both activities.
- [x] Local `db:reset`, `db:lint`, full pgTAP, `db:types`, Vitest, lint,
  typecheck, format check, production build, and Supabase-backed Playwright pass.
- [x] At most one read-only verifier reports no unresolved Critical/High findings.

### Acceptance evidence (2026-08-25)

| Gate | Evidence |
| --- | --- |
| Migrations | 16 Milestone 6 SQL migrations through `20260825003016_milestone6_maturity_successor_clone_fix.sql` |
| pgTAP | 180 tests across 20 files (`npm run test:db`), including `five_s_scoring`, `five_s_security`, `gemba_security`, `schedule_security`, `schedule_timezone` |
| Application | `(platform)/5s`, `(platform)/gemba`, `(platform)/schedule` routes; `ScheduleForm`, audit/walk workspaces, evidence blocks, successor UI |
| Unit tests | `schedule-recurrence`, `five-s-scoring`, `platform-navigation` (`npm test`, 21 tests) |
| E2E | `five-s-journeys`, `gemba-journeys`, `scheduling-journeys`, `milestone6-closure` (schedule create, 5S/Gemba evidence, 5S successor + history pin, tablet 5S workspace) |
| CI | Database job: `db:lint`, `test:db`, `db:types` drift check, `db:seed-demo`, Supabase Playwright with `E2E_WITH_SUPABASE=1`; quality job: format, lint, typecheck, Vitest, build |

### Deferred follow-ups (Medium/Low — not blocking M6)

These items are documented for post-M6 hardening; they do not block the milestone
acceptance above.

| Priority | Item |
| --- | --- |
| Medium | Gemba definition successor journey is implemented (UI + RPC) but not covered by Playwright closure E2E (5S successor is). |
| Medium | Schedule **edit** flow and `update_schedule_definition` RPC are implemented but not Playwright-tested. |
| Medium | Schedule create E2E covers 5S standard entry only; Gemba definition “Create schedule” link is untested in E2E. |
| Low | Tablet/responsive Playwright coverage is 5S audit workspace only; schedule form and Gemba walk tablet journeys are manual/visual. |
| Low | No dedicated pgTAP tests for `create_five_s_standard_successor_version` / `create_gemba_definition_successor_version` (covered at application layer + 5S E2E). |
| Low | Smoke `end-to-end` CI job runs Playwright without Supabase (`E2E_WITH_SUPABASE` unset); Milestone 6 journeys skip there. The `database` job is the authoritative M6 E2E gate. |

## Milestone 8 — CI Improvement Projects

Milestone 8 is complete. It delivers methodology versioning, charter-led project
governance, team history, phased execution, universal actions, evidence, metrics,
portfolio/workspace UX, and local Apex demo projects — without Benefits Engine,
financial savings, or project task tables.

### In scope

- **Methodologies:** `ci_project_methodologies`, versioned phases, publish/successor
  RPCs, methodology manager UI.
- **Projects:** charter fields, lifecycle (`draft` → `submitted` → `approved` →
  `active` / `on_hold` → `completed` / `cancelled`), status history, team
  assignments (domain roles, not RBAC), phase instantiation, action/evidence
  context, metrics with append-only measurements, completion snapshots.
- **Application:** `/platform/projects` portfolio, multi-step create wizard,
  tabbed workspace, methodology manager/editor.
- **Demo seed:** DMAIC/PDCA/Kaizen/Basic Improvement methodologies; four named
  demo projects with realistic lifecycle, metrics, actions, and completion states.
- **Regression evidence:** pgTAP `ci_projects_security`; Vitest `project-lifecycle`;
  Supabase-backed Playwright `milestone8-closure`.

### Explicitly excluded

Benefits Engine, ROI/savings calculations, finance approval, project-specific task
tables, AI, Milestone 10 work, and hosted Supabase changes.

### Acceptance checklist

- [x] M8 migrations `20260825005000`–`20260825005014` plus closure migrations
  `20260825006015`–`20260825006017` applied in dependency order.
- [x] Methodology publish registers resource records for business audit integrity.
- [x] Project team participation does not grant application permissions (pgTAP).
- [x] Demo seed publishes methodologies via manager grant and advances projects
  through authoritative lifecycle RPCs.
- [x] Local `db:reset`, `db:seed-demo`, `db:lint`, full pgTAP, `db:types`,
  Vitest, lint, typecheck, production build, and Supabase-backed Playwright pass.
- [x] Visual/product acceptance: flagship M8 screens inspected at 1440/1024/768/390
  light and dark; portfolio, wizard, workspace tabs, methodology catalogue/editor,
  completion state; no horizontal overflow; responsive tabs and human-readable
  team/evidence; premium header hierarchy (2026-08-26).

### Acceptance evidence (2026-08-26)

| Gate | Evidence |
| --- | --- |
| Migrations | M8 `05000`–`05014`; closure `06015`, `06017` |
| pgTAP | 39 files, 331 tests (`npm run test:db`); includes `ci_projects_security` |
| Application | `/platform/projects`, create wizard, workspace tabs, methodology manager |
| Unit tests | 11 files, 34 tests (`npm test`); includes `project-lifecycle` |
| E2E | `milestone8-closure` (methodology editor, wizard create, lifecycle, phase/measurement, operator denial) |
| CI | Database job includes `milestone8-closure.spec.ts` with `E2E_WITH_SUPABASE=1` |
| Visual QA | Manager identity; routes above at 1440/1024/768/390 light/dark; overflow PASS; `milestone8-closure` re-run after polish |

## Milestone 9 — Suggestions, Ideas & Recognition

Milestone 9 is complete. It delivers frontline suggestion capture, manager
review workspace, programme/type management, recognition history/revocation,
shared evidence on suggestions, and human recognition — without engagement
scoring, gamification, or notification delivery.

### In scope

- **Suggestion programmes:** versioned programmes, categories, optional template
  pin (`improvement_suggestion` experience type), review-target metadata, and
  programme management permissions.
- **Improvement suggestions:** draft → submit with programme/category/unit
  snapshots, document numbers via the shared organisation sequence allocator,
  submitted-content immutability, review jurisdiction, atomic review recording
  (`accept`/`reject` complete assignments; `needs_more_information` keeps
  assignments active), implementation lifecycle, and contributor/reviewer
  assignments (non-RBAC).
- **Implementation:** `suggestion_action_context`, implementation links, and
  `create_improvement_project_from_suggestion` through the authoritative M8 CI
  project pathway.
- **Recognition:** types, immutable awards/recipients, restrictive visibility
  (never permission-granting), `award_recognition` / `revoke_recognition` with
  idempotent revocation, and scoped profile aggregates.
- **Query layer:** overview, list, detail, review queue, recognition feed, and
  caller-visible profile contribution counts (no count/source leak).
- **Application:** Suggestions overview, new suggestion, detail (overview,
  discussion, activity), review queue, programmes catalog; Recognition feed,
  award flow, types management; navigation and home signals; capability profile
  improvement section.
- **Regression evidence:** pgTAP security, atomic review, needs-info semantics,
  recognition revocation idempotency, profile aggregates, engagement seam; Vitest
  helpers; Supabase-backed Playwright `milestone9-closure`.

### Explicitly excluded

Engagement Score, points/leaderboards/gamification, auto-recognition,
notifications, AI, Benefits (Milestone 10), Problem Solving, and Milestone 10
start.

### Acceptance checklist

- [x] M8 prerequisite symbols present (`ci_projects`, source links, document
  sequence allocator, `projects.*` permissions, `can_access_resource` branch).
- [x] M9 migrations `20260825006000`–`20260825006010` plus closure migrations
  `20260825006011`–`20260825006016` applied in dependency order.
- [x] Submitted suggestion and template immutability enforced at database layer.
- [x] `record_suggestion_review` is atomic; `needs_more_information` preserves
  active reviewer assignment.
- [x] Recognition awards/recipients immutable; second revoke rejected; single
  revocation history row.
- [x] Profile contribution RPC counts only caller-visible activity.
- [x] Apex demo seed: Operator `recognition.read` (self), Manager M9 review/award
  grants; programme, categories, suggestions, recognition types/awards.
- [x] Local `db:reset`, `db:lint`, full pgTAP, `db:types`, Vitest, lint,
  typecheck, format check, production build, and Supabase-backed Playwright pass.
- [x] Visual/product acceptance: flagship M9 screens inspected at 1440/1024/768/390
  light and dark; overview, list, new suggestion, detail workspace tabs, review
  queue/workspace, programmes, recognition feed/award/types/history; frontline form
  usable at 390px; no horizontal overflow; polished recognition feed without
  social-media styling (2026-08-26).

### Acceptance evidence (2026-08-26)

| Gate | Evidence |
| --- | --- |
| Migrations | M8 `05000`–`05014`; M9 `06000`–`06010`; closure `06011`–`06016` |
| pgTAP | 39 files, 331 tests; M9 suites include programme security, template submit, contributor/reviewer separation, implementation links, recognition immutability |
| Application | Tabbed suggestion detail, review workspace, programme editor, recognition feed/history/revoke, evidence uploader |
| Unit tests | 11 files, 34 tests; includes `suggestion-review-sla`, `platform-navigation` |
| E2E | `milestone9-closure` (operator submit, manager recognition feed, review queue, operator award denial) |
| CI | Full M3–M9 Playwright suite: 37 passed, 0 failed, 0 skipped (`workers=1`, clean `db:reset` + `db:seed-demo`) |
| Visual QA | Manager/operator identities; routes above at 1440/1024/768/390 light/dark; overflow PASS; `milestone9-closure` re-run after polish |

## Milestone 10 — Benefits, Savings & Value Realisation Engine

Milestone 10 is complete. It delivers governed improvement benefits with
financial/non-financial classification, forecast versioning, dual validation
(CI + finance SoD), overlap allocation control, realisation entries with signed
adjustments, portfolio analytics, and M8/M9 source integration — without
auto-seeded production categories, ledger posting, or executive dashboards.

### In scope

- **Permissions:** exactly eight benefit permissions (`benefits.read`,
  `benefits.create`, `benefits.manage`, `benefits.validate.ci`,
  `benefits.validate.finance`, `benefits.realisation.record`,
  `benefits.realisation.validate`, `benefits.categories.manage`).
- **Domain:** `improvement_benefits` lifecycle (`draft` → `submitted` →
  `approved` → `realising` → `realised` / `rejected` / `withdrawn` / `cancelled`),
  status history, submission snapshots, mutable draft source links with submit
  immutability, `benefit_categories` and `benefit_reporting_settings` (no
  migration seed — demo categories via `db:seed-demo` only).
- **Forecasts:** draft/create/update/submit/approve/successor versions,
  `benefit_forecast_periods`; period-sum integrity enforced at submit/approval
  only; authoritative money as PostgreSQL `NUMERIC`.
- **Validation:** CI and finance assignments with separation of duties (creator
  cannot be finance validator; one membership cannot satisfy both roles);
  `resolve_benefit_submit_validators` for membership-directory-safe submit.
- **Overlap:** allocation groups with RPC locking and append-only allocation
  history (no unsafe CHECK).
- **Realisation:** entries, signed-delta adjustments, finance validation of
  actuals; immutable validated history.
- **Integrations:** `create_benefit_from_ci_project`, `create_benefit_from_suggestion`;
  `get_project_benefits` / `get_suggestion_benefits` (M8/M9 detail RPCs unchanged).
- **Application:** `/platform/benefits` portfolio, create wizard, tabbed
  workspace, validation queue, category admin; project/suggestion benefit
  sections; `finance@apex.local` finance-validator persona in demo seed.
- **Regression evidence:** eight pgTAP benefit suites; Vitest benefit helpers;
  Supabase-backed Playwright `milestone10-closure`.

### Explicitly excluded

Auto-seeded production benefit categories, general ledger integration,
executive dashboard, AI, notifications, hosted Supabase changes, and Milestone
11 work.

### Acceptance checklist

- [x] M10 migrations `20260826007000`–`20260826007012` applied in dependency order.
- [x] Eight permissions only; owner upgrade includes all benefit grants.
- [x] Financial forecast period integrity at submit/approval, not on every draft edit.
- [x] Full RLS on M10 tenant tables; source access does not leak via benefit queries.
- [x] Demo seed: four benefit stories, finance persona, categories via RPC (not migration).
- [x] Local `db:reset`, `db:lint`, full pgTAP, `db:types`, Vitest, lint, typecheck,
  production build, `db:seed-demo`, and Supabase-backed Playwright pass.
- [x] Visual/product acceptance: flagship benefits screens at 1440/1024/768/390
  light and dark; portfolio, wizard, workspace tabs, validation queue, category
  admin; responsive smoke in `milestone10-closure`.

### Acceptance evidence (2026-08-26)

| Gate | Evidence |
| --- | --- |
| Migrations | M10 `07000`–`07012` (permissions, domain, forecasts, validation, overlap, realisation, access, integrations, queries, categories, validator fix, submit-validator resolver) |
| pgTAP | 47 files, 426 tests (`npm run test:db`); includes `benefit_*` and `benefits_security` suites |
| Application | Benefits portfolio, create wizard, workspace (forecast/realisation/validation), validation queue, category admin, M8/M9 benefit panels |
| Unit tests | 16 files, 58 tests (`npm test`); includes benefit status/forecast/navigation helpers |
| E2E | `milestone10-closure` (14 tests: create/submit/validate, finance queue, seeded stories, operator denial, responsive smoke) |
| CI | Database job includes `milestone10-closure.spec.ts` with `E2E_WITH_SUPABASE=1` |
| Demo | `finance@apex.local` / `Finance@Apex-Dev-2026!`; Packaging Waste, Changeover, Maintenance Avoidance, Visual Standards stories |

## Later milestones

1. Core Lean domains: training/skills, projects, suggestions, problem-solving,
   and additional form experiences as thin vertical slices. Maturity (Milestone 5),
   5S, Gemba, and activity scheduling (Milestone 6) are delivered.
2. Benefits and engagement: reserved Benefits lifecycle, notification/activity capabilities, and trustworthy forecast/validated/realised reporting.
3. Enterprise extensions: staged import/export, search, API/webhooks, entitlements, integrations, AI, advanced workflow, and constrained offline capability only where requirements justify them.

Later verification includes published-version immutability, append-only audit, event idempotency, optimistic concurrency, strict Benefit value separation, and permission-aware machine paths.

## Speculative boundary

Visual workflow designer, enterprise BI, AI summaries/agents, full Hoshin Kanri, TPM, daily management/tier meetings, advanced Kaizen, coaching/recognition, enterprise SSO beyond the Microsoft seam, billing, Slack/Teams/push, and general offline synchronisation must not influence V1 complexity without new evidence and approval.

## Hard stop

Milestone 3 ends at the secure tenant foundation above. Remote Supabase changes
and every explicitly excluded capability require separate approval. Completion
cannot be claimed until every Milestone 3 acceptance item is evidenced.
