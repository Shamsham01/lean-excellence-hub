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

## Milestone 3 — explicit approval required

Secure tenant foundation: profiles, organisations, multi-organisation memberships, invitations, organisation hierarchy and closure, scoped RBAC, private authorisation helpers, default-deny RLS, session middleware, organisation selection, Microsoft/email authentication UX, and trusted workforce login.

Acceptance includes local migration reset and generated types; hostile tests across two organisations, multiple/disabled/no memberships, hierarchy scopes, financial permissions, suspended tenants, and privileged paths; cross-tenant read/write/reference/Storage/export/role-escalation denial; and workforce anti-enumeration, reset, forced initial change, disabling, throttling, revocation, audit, and MFA seams.

## Later milestones

1. Shared platform foundation: resource records, audit/outbox, private attachments, universal templates, universal actions, workflow history, and responsive design system.
2. Core Lean domains: maturity, training/skills, projects, suggestions, scheduling, problem-solving, and form experiences as thin vertical slices.
3. Benefits and engagement: reserved Benefits lifecycle, notification/activity capabilities, and trustworthy forecast/validated/realised reporting.
4. Enterprise extensions: staged import/export, search, API/webhooks, entitlements, integrations, AI, advanced workflow, and constrained offline capability only where requirements justify them.

Later verification includes published-version immutability, append-only audit, event idempotency, optimistic concurrency, strict Benefit value separation, and permission-aware machine paths.

## Speculative boundary

Visual workflow designer, enterprise BI, AI summaries/agents, full Hoshin Kanri, TPM, daily management/tier meetings, advanced Kaizen, coaching/recognition, enterprise SSO beyond the Microsoft seam, billing, Slack/Teams/push, and general offline synchronisation must not influence V1 complexity without new evidence and approval.

## Hard stop

This requested delivery ends at Milestone 2. Milestone 3+ is not implemented without explicit approval.
