# Security model

## Status and security objective

This document retains the Milestone 1 security baseline and records the
approved Milestone 3 secure-tenant controls. It does not claim those controls
are implemented. The primary objective is default-deny isolation between
organisations while preserving scoped access, historical accountability, and
safe frontline authentication.

## Trust boundaries

Untrusted inputs include browsers, route parameters, organisation selection, user metadata, JWT display hints, uploaded content, import files, future API clients, webhook payloads, and AI-generated content. Trusted components are narrowly scoped server-side use-cases, PostgreSQL constraints and RLS, private authorisation helpers, Supabase Auth, and controlled privileged workers.

Supabase Auth is the only credential and password authority. Lean Hub never stores password hashes or creates a parallel credential system.

## Authentication and workforce resolution

Approved entry methods are:

1. Microsoft identity for corporate users;
2. email and password where appropriate;
3. organisation code plus workforce ID/username plus password for users without corporate email.

Email and provider identities map one global Auth identity to current
organisation memberships. OAuth uses a provider-neutral PKCE boundary with
strict redirect and provider allowlists; Microsoft remains an adapter whose
live tenant configuration is deployment evidence rather than a Milestone 3
acceptance blocker.

Workforce login uses rate-limited trusted server-side logic to normalise and
resolve organisation code plus workforce alias to one global, high-entropy
Supabase Auth login identifier, then delegates password verification to
Supabase Auth. Pre-authentication responses cannot enumerate organisations,
accounts, identifiers, or memberships. The authenticated owner may view their
own internal identifier and can consequently call Supabase Auth directly; this
risk is accepted and the identifier never grants authority.

Membership identity remains organisation-specific. One Auth user has at most
one global workforce account; another organisation adds an alias and
membership, not another credential identity. Organisation-managed recovery is
limited to solely organisation-stewarded identities. Shared identities require
platform recovery because credential changes affect every membership.

See [ADR-0004](../adr/ADR-0004-workforce-authentication.md),
[ADR-0007](../adr/ADR-0007-workforce-identity-disclosure-and-stewardship.md),
and [ADR-0010](../adr/ADR-0010-provider-neutral-authentication-boundary.md).

## Authorisation and RLS

- Current database membership, not `raw_user_meta_data` or stale JWT roles, is authoritative.
- Organisation selection is stored per current Supabase session and user in
  PostgreSQL. The route and JWT remain untrusted.
- Every operation verifies the matching `auth.sessions` row, active global
  identity, active selected membership, active organisation, and the row's
  `organisation_id`.
- Stable roles have immutable published versions. Grants and invitations bind
  an exact role version and self, unit-subtree, or organisation scope.
- Administration requires explicit permission and containment: no actor may
  delegate permissions or scope they do not currently possess.
- Every exposed tenant table enables RLS immediately with explicit default-deny `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies. Updates require the row to be selectable and the new row to satisfy checks.
- Narrow authorisation helpers live in an unexposed private schema. Any security-definer helper sets a safe `search_path`, is non-user-writable, and never lives in an exposed schema.
- Exposed views use `security_invoker`.
- Composite tenant foreign keys reject cross-organisation references even when application checks fail.

Application use-cases normally use caller-scoped clients. Service-role access is exceptional: isolate the path, re-authorise the actor and target, minimise scope, audit it, and adversarially test it.

Hierarchy and lifecycle mutations are controlled operations. Organisation unit
adjacency and closure paths change atomically under an organisation-scoped lock;
cycles, cross-tenant parents, and excessive depth fail completely. Invitations
are non-authorising records separate from memberships.

See [ADR-0006](../adr/ADR-0006-session-bound-organisation-context.md),
[ADR-0008](../adr/ADR-0008-version-bound-rbac-and-delegation.md), and
[ADR-0009](../adr/ADR-0009-tenant-lifecycle-and-hierarchy-mutation.md).

## Data protection

- Financial Benefit separation, exports, Storage buckets, object paths, upload
  controls, and scanning remain requirements for their later owning milestones;
  Milestone 3 creates no placeholder permissions or artefacts for them.
- Audit before/after content is redacted and minimised; secrets and credential material are never logged.
- Exports, search, APIs, imports, analytics, and future AI paths apply the same tenant and permission checks as interactive reads.
- Environment secrets remain outside version control; client code receives publishable values only.

## Integrity, accountability, and availability

Milestone 3 security mutations append narrow, redacted evidence atomically.
Ordinary clients cannot update or delete it. This ledger is distinct from the
later generic audit, workflow history, activity, and transactional outbox.
Correlation identifiers connect requests to security outcomes without logging
secrets, tokens, passwords, or internal login identifiers.

Rate limits apply to authentication resolution, resets, and invitations.
Session revocation follows account, membership, organisation, and administrator
security events, and every tenant policy rejects a removed session even before
JWT expiry. Later exports, public APIs, and outbox consumers own their own
limits and monitoring.

See [ADR-0011](../adr/ADR-0011-milestone-3-security-ledger.md).

## Required security evidence for later milestones

Milestone 3 uses at least two organisations and identities with pending, active,
inactive, multiple, and no memberships. Test cross-tenant read, write and
reference denial; hierarchy integrity and scope; lifecycle transitions;
suspended organisations; immutable role-version delegation; invitations;
privileged paths; workforce anti-enumeration and disclosure; recovery; session
selection and revocation; and append-only security evidence. Storage, export,
Benefits/financial, template, generic audit/outbox, and event-idempotency
evidence belongs to later milestones.

Entitlements remain commercial controls and cannot weaken these requirements.
