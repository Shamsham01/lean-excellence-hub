# ADR-0004: Workforce authentication

## Status

Accepted architecture; implementation deferred to Milestone 3.

## Context

Lean Hub must support corporate users and frontline workers who may lack corporate email. A custom password database would duplicate security-critical credential handling. Mapping visible workforce identifiers directly to Auth login identifiers could expose accounts, organisations, or membership. Global authentication identity and tenant-specific workforce identity have different lifecycles.

## Decision

Support three future entry methods:

1. Microsoft authentication for corporate users;
2. email and password where appropriate;
3. organisation code plus workforce ID/username plus password.

Supabase Auth is the sole credential, password, and session authority for every method. Lean Hub never stores password hashes or verifies passwords independently.

Microsoft and email login map a verified Auth identity to current organisation memberships. Workforce login sends organisation code and workforce ID/username to rate-limited trusted server-side logic. That logic normalises the inputs, resolves an active organisation-scoped membership to a non-public Supabase Auth login identifier, and delegates password verification to Supabase Auth. The browser never receives or derives internal login identifiers and receives generic, non-enumerating failures.

Keep global Auth identity separate from tenant membership. A membership may carry an organisation-unique normalised workforce ID and username. Disabling a membership removes access to that organisation without necessarily deleting global identity or historical records.

Preserve explicit seams for:

- administrator-initiated password reset and secure enrolment;
- forced password change on first login/reset;
- membership and global-account disabling;
- layered failed-attempt throttling and generic responses;
- authentication, resolution, reset, and administration audit events;
- session revocation after relevant security or membership changes;
- future MFA and Microsoft policy integration.

All post-authentication authorisation uses current database membership and RLS, never the successful login method, user-editable metadata, or a tenant role claim.

## Consequences

- Frontline access does not create a second credential authority.
- Trusted resolution adds a sensitive server boundary that must be rate-limited, monitored, audited, and timing-conscious.
- Organisation codes and workforce identifiers can be user-friendly while internal Auth identifiers remain private.
- Administrator lifecycle UX and Supabase administration calls require tightly controlled privileged server code.
- Milestone 3 must test account and organisation enumeration, normalisation collisions, disabled membership, forced initial change, reset abuse, throttling, session revocation, multiple memberships, generic errors, audit, and MFA seams.
- No workforce login UI, resolver, credential mapping, or schema is implemented in Milestones 1–2.
