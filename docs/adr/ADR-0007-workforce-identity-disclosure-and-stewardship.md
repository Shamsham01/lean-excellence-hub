# ADR-0007: Workforce identity disclosure and stewardship

## Status

Accepted for Milestone 3 implementation. This ADR supplements and narrowly
supersedes the absolute non-disclosure statement in
[ADR-0004](ADR-0004-workforce-authentication.md). ADR-0004 remains authoritative
for the credential boundary, trusted resolver, and anti-enumeration controls.

## Context

Supabase Auth requires a login identifier for password sign-in. The trusted
workforce resolver must hide that identifier before authentication, but an
authenticated owner can observe values associated with their own Auth identity
and may subsequently call Supabase password sign-in directly. Treating the
identifier as permanently secret would promise a boundary that Supabase Auth
does not provide.

One person may also join several organisations. Creating a credential identity
per membership would fragment recovery and disabling, duplicate credentials,
and make cross-organisation effects unclear.

## Decision

Maintain one global Supabase Auth user and at most one global workforce account
and high-entropy internal Auth login identifier for that user. The identifier is
globally unique, random, non-derivable from organisation or workforce inputs,
and never authorisation state. Organisation-scoped, canonically normalised
workforce aliases map memberships to that single account.

The resolver protects pre-authentication discovery with bounded input,
equivalent failures, layered hashed throttles, and no identifier, password, or
account leakage in logs or audit metadata. The authenticated owner may view
their own internal identifier. The resulting ability to sign in directly
through Supabase Auth is accepted; strong Supabase Auth password throttling
remains mandatory.

Organisation administrators may initiate one-time enrolment or recovery only
for an identity stewarded solely by their organisation. During provisioning or
an authorised credential reset they may see a **system-generated temporary
password once**. They must never choose predictable passwords, retrieve an old
temporary password, or see or recover the employee's permanent password. After
first login the employee owns their password.

Optional notification email is independent of the hidden internal Auth
identifier for workforce accounts.

Shared or multi-organisation identities require platform-managed recovery
because a credential reset affects every membership. Global
disablement or identifier rotation is a controlled platform operation that
updates Supabase Auth and the mapping atomically where possible, revokes all
sessions, records the cross-organisation effect, and provides a recoverable
failure path.

## Consequences

- Adding an organisation does not create another credential identity.
- Owner-only post-authentication disclosure is allowed; anonymous and
  cross-user discovery remain prohibited.
- Membership lifecycle cannot implicitly disable a global account.
- Stewardship and shared-identity recovery require explicit, tested rules.
- Milestone 3 must prove alias normalisation, account uniqueness, disclosure
  boundaries, direct-Auth behaviour, throttling, recovery, rotation, and
  cross-organisation session revocation.
