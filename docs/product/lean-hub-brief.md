# Lean Hub product brief

## Document authority

This is the normalised architecture source of truth for the supplied greenfield product requirements. It preserves the requirements approved for architecture planning; it does not claim that any product capability has been implemented. Where the original brief implied an existing architecture or audit trail, none existed in the repository at Milestone 1, so this baseline records the initial decisions.

## Product intent

Lean Excellence Hub will help organisations establish, operate, assess, and continuously improve a Lean management system. It should provide one secure multi-tenant platform for corporate and frontline users, work across differing organisation structures, and grow by reusing trustworthy shared capabilities rather than building isolated module silos.

The target platform is a Next.js App Router application using strict TypeScript and Supabase Auth, PostgreSQL, and Storage. It should be responsive and touch-first, with progressive-web-app and offline-ready design seams, but general offline synchronisation is not an initial feature.

## People, tenancy, and access

- A person can belong to multiple organisations through separate current memberships.
- Each organisation can model company, site, department, area, team, or customer-specific structures without fixed hierarchy depth.
- Organisation-owned roles grant stable permissions at self, unit-subtree, or whole-organisation scope.
- Every request selects an organisation for context, but every query and mutation independently proves access using current database membership and row tenancy.
- Corporate users will eventually use Microsoft identity or email/password. Frontline users without corporate email will use organisation code, workforce ID or username, and password.
- Supabase Auth remains the sole authority for identities, credentials, and passwords. Tenant membership disabling, administrator reset, forced initial password change, throttling, revocation, audit, and future MFA are required seams.
- Commercial entitlements may later control product availability, but never replace permissions or row-level security.

## Lean management capabilities

Planned core domains include:

- organisation maturity assessments;
- training curricula, learning progress, skills, and competence;
- improvement projects and suggestions;
- structured problem-solving;
- Gemba, 5S, Leader Standard Work, audits, and configurable assessments;
- scheduling and recurring management activity;
- Lean actions and workflow histories;
- evidence, comments, activity, and audit;
- strategic alignment where justified by later requirements.

One universal, versioned template engine must serve Gemba, 5S, Leader Standard Work, maturity, and similar configurable forms. Templates contain immutable published versions, versioned sections and questions, submissions tied to the exact version used, and answers tied to exact versioned questions. Typed extensions are allowed only for genuinely different semantics such as curricula and structured problem-solving.

## Shared platform capabilities

- **Resource identity:** a narrow, tenant-safe registry links typed domain records to shared capabilities without unsafe free-form polymorphic identifiers.
- **Actions:** one tenant-owned action capability supports source/context links, owner or assignee, unit, dates, status, priority, idempotency, and optimistic concurrency.
- **Attachments:** private objects and authorised metadata links use organisation-prefixed paths, signed access, MIME and size rules, and a future malware-scanning state.
- **Workflow:** domains own stable semantic states and valid transitions while sharing a transition protocol and append-only history.
- **Audit:** tamper-resistant, append-only evidence records actor, organisation, resource, action, request correlation, and suitably redacted changes.
- **Events:** an idempotent transactional outbox provides a later seam for notifications, activity, webhooks, analytics, and cache refresh.
- **Historical truth:** immutable published versions and revisions plus deliberate label/context snapshots preserve reporting meaning without copying every mutable field or adding universal temporal tables.
- **Mobile readiness:** touch-first forms, client-generated idempotency keys, version columns, and draft-safe APIs prepare for later queued/offline work.

Future public `/api/v1` endpoints, imports, and workers must adapt the same application use-cases as the web application. Database and PostgREST shapes are not the permanent public contract.

## Benefits requirements

One Benefits domain will serve projects, suggestions, problem-solving, and later Kaizen capabilities:

- organisation-configurable benefit types seeded from defaults;
- a single authoritative benefit with one originating resource and non-sensitive descriptive lifecycle data;
- contextual links for navigation that never duplicate reportable value;
- immutable forecast/calculation revisions with baseline, improved condition, quantity/rate, methodology, assumptions, units, dates, and recurrence;
- separately secured financial detail controlled by `benefits.view_financial`;
- validation decisions against exact revisions, with default separation of duties preventing creator or owner self-validation;
- dated realisation entries kept distinct from forecasts and validation;
- trustworthy reporting of forecast, validated, and realised totals from authoritative sources;
- audit and workflow records for validation, rejection, revision, and realisation;
- shared evidence attachments and original/reporting currency context.

Exchange-rate conversion, configurable calculators, and BI cubes are deferred.

## Delivery classification

### Initial foundation — Milestone 1

Repository verification; this product brief; platform, data, security, threat, and milestone documentation; focused ADRs; contribution and naming guidance; and exactly three read-only specialist project agents.

### Next — Milestone 2

A minimal Next.js App Router and strict TypeScript shell; local Supabase configuration without domain migrations; environment validation; generated database type workflow; linting, formatting, type-checking, unit and end-to-end smoke tests; CI; and a successful production build. Dependencies must be deliberate and documented.

### Architecture now; implementation later

- **Milestone 3 secure tenant foundation:** authentication UX, invitations, workforce login, organisation switching, profiles, organisations, memberships, hierarchy closure, scoped RBAC, database helpers, and default-deny RLS.
- **Later shared foundation:** resource registry, audit/outbox, private attachments, universal templates, universal actions, workflows, and design system.
- **Later Lean domains:** maturity, training/skills, projects, suggestions, scheduling, problem-solving, and configurable Lean forms.
- **Later benefits and engagement:** Benefits lifecycle, notifications, inbox/email/digests, and minimum trustworthy reporting.
- **Later enterprise extensions:** custom fields, staged import/export, permission-aware search, entitlements, public API, webhooks, integrations, advanced workflow configuration, terminology overrides, currency conversion, calculators, retention/deletion operations, and constrained offline handling.

### Speculative; must not drive V1 complexity

Visual workflow design, enterprise BI, AI summaries or agents, full Hoshin Kanri, TPM, daily management or tier meetings, advanced Kaizen, coaching/recognition, enterprise SSO beyond the planned Microsoft seam, billing, Slack/Teams/push integrations, and general offline synchronisation.

## Product constraints and corrections

- A generic `entity_type/entity_id` link is insufficiently safe; shared capabilities use a narrow resource registry while domain data stays typed.
- Organisation-configurable labels cannot redefine core workflow semantics.
- Fixed site/department columns cannot represent variable customer hierarchies.
- Financial details cannot sit in broadly visible benefit rows.
- Soft deletion is not universal; lifecycle and retention are aggregate-specific, and deleting Auth identity must not erase management history.
- Audit, domain events, and user-facing activity are distinct concerns.
- Service-role access is exceptional, isolated, re-authorised, audited, and tested.
- Published content is immutable; successor versions are explicit and transactional.

## Success principles

The platform succeeds when tenant isolation is independently enforceable, current membership drives access, shared capabilities remove genuine duplication without erasing domain meaning, historical and financial reporting remain trustworthy, frontline access does not weaken credential security, and each milestone is independently reproducible and accepted before later scope begins.

See [milestone scope and acceptance](../architecture/milestone-scope-and-acceptance.md) for delivery gates and [platform architecture](../architecture/platform-architecture.md) for the architectural decision rule.
