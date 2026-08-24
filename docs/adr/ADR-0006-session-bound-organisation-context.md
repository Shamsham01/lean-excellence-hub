# ADR-0006: Session-bound organisation context

## Status

Accepted for Milestone 3 implementation. This ADR supplements and narrowly
supersedes the route-only organisation-selection detail in
[ADR-0002](ADR-0002-multi-tenant-membership-and-rls.md); the remaining
ADR-0002 decisions continue to apply.

## Context

A person can hold memberships in several organisations. A route, browser value,
user metadata, or organisation claim in a JSON Web Token (JWT) can be forged or
remain stale after access changes. A user-level preference is also insufficient:
simultaneous Supabase sessions may legitimately select different organisations.
Revoking a session must take effect before an otherwise valid access token
expires.

## Decision

Persist the selected organisation in PostgreSQL per Supabase Auth session and
user. A context is valid only when all of the following are current:

- `auth.uid()` identifies the context owner;
- the JWT `session_id` identifies an existing matching `auth.sessions` row;
- the selected membership belongs to that user and organisation and is active;
- the global identity and organisation are active; and
- the requested permission and scope authorise the operation.

Route values, JWT organisation or role hints, `raw_user_meta_data`, and cached
claims remain untrusted. Public bootstrap operations may list only the caller's
eligible organisations and switch context only after validating the current
session and lifecycle state. They grant no tenant access by themselves.

Membership, identity, or organisation security events revoke affected Supabase
sessions where required. Every tenant authorisation path verifies that the
referenced session still exists, so deletion or revocation of the session fails
closed without waiting for JWT expiry.

## Consequences

- Organisation selection is isolated between concurrent sessions.
- A selected context never substitutes for current membership or permission.
- Session context and revocation require database-current checks on every
  tenant operation.
- Missing, malformed, mismatched, expired, or revoked sessions receive no
  tenant data.
- Milestone 3 evidence must cover dual-organisation switching, concurrent
  sessions, forged context, lifecycle changes, and revoked unexpired tokens.
