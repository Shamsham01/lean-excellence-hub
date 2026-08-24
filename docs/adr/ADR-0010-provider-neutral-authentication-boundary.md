# ADR-0010: Provider-neutral authentication boundary

## Status

Accepted for Milestone 3 implementation. This ADR supplements
[ADR-0004](ADR-0004-workforce-authentication.md).

## Context

Milestone 3 needs concrete email/password and workforce paths. Microsoft
authentication is a planned corporate entry method, but coupling tenant access
or milestone acceptance to live Azure credentials would mix an external
deployment dependency with the secure tenant foundation.

## Decision

Put OAuth initiation, callback, redirect validation, identity collision and
linking rules, and provider allowlisting behind a provider-neutral application
boundary. Use Proof Key for Code Exchange (PKCE), exact allowlisted redirects,
and verified provider identity attributes. Authentication method never grants
tenant authority; all successful identities still pass session-bound,
database-current lifecycle, membership, permission, and RLS checks.

Document the future Microsoft adapter's required `email` scope, verified-email
and `xms_edov` handling, optional Microsoft tenant restriction, local
`localhost` callback limitation, and secret rotation. Do not fabricate live
credentials or claim a provider round trip.

Milestone 3 keeps the neutral initiation and callback seam but explicitly
disables every OAuth provider in both application code and local Supabase
configuration. There is no configuration-only path to enable Azure. A future
implementation requires its own security review and deliberate code changes
that enforce the approved tenant restriction, verified-identity, collision,
callback, and redirect policies. Email/password and workforce authentication
are the concrete end-to-end acceptance paths.

## Consequences

- Microsoft integration can be added without changing tenant authorisation.
- Provider-specific claims cannot become roles, organisation selection, or
  permissions.
- The neutral seam must remain narrow and must not imply enterprise SAML or
  unrestricted account linking.
- External provider availability is not confused with local security
  acceptance.
