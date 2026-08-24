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

## Later milestones

1. Shared platform foundation: resource records, audit/outbox, private attachments, universal templates, universal actions, workflow history, and responsive design system.
2. Core Lean domains: maturity, training/skills, projects, suggestions, scheduling, problem-solving, and form experiences as thin vertical slices.
3. Benefits and engagement: reserved Benefits lifecycle, notification/activity capabilities, and trustworthy forecast/validated/realised reporting.
4. Enterprise extensions: staged import/export, search, API/webhooks, entitlements, integrations, AI, advanced workflow, and constrained offline capability only where requirements justify them.

Later verification includes published-version immutability, append-only audit, event idempotency, optimistic concurrency, strict Benefit value separation, and permission-aware machine paths.

## Speculative boundary

Visual workflow designer, enterprise BI, AI summaries/agents, full Hoshin Kanri, TPM, daily management/tier meetings, advanced Kaizen, coaching/recognition, enterprise SSO beyond the Microsoft seam, billing, Slack/Teams/push, and general offline synchronisation must not influence V1 complexity without new evidence and approval.

## Hard stop

Milestone 3 ends at the secure tenant foundation above. Remote Supabase changes
and every explicitly excluded capability require separate approval. Completion
cannot be claimed until every Milestone 3 acceptance item is evidenced.
