# ADR-0014: Workforce provisioning and notification foundation

## Status

Accepted for M1 implementation (workforce provisioning core).

## Context

Lean Hub must onboard frontline employees primarily through administrator
creation and bulk CSV import rather than email invitation. Supabase Auth
remains the sole credential authority. Privileged provisioning must coexist
with the existing invitation-only public signup hook without weakening it.

## Decision

### Sealed provisioning intents

`preauthorize_workforce_provision()` creates only a sealed intent. It does
not create memberships or Auth users. The intent stores:

- actor membership and organisation;
- validated username, job function, unit, role version, and scope;
- a pre-generated high-entropy internal Auth identifier (`*@workforce.invalid`).

### Crash-safe Auth creation

Provisioning states:

`pending` → `auth_created` → `completed`

`record_workforce_auth_created()` transitions after `auth.admin.createUser()`.
`finalize_workforce_provision()` is service-role only, does not rely on caller
session context, and re-validates the sealed intent before creating membership,
workforce mappings, grants, and optional notification contacts.

Retries after Auth creation must not create duplicate Auth identities.

### Temporary password policy

An authorised Organisation Owner or Organisation Administrator may see the
system-generated temporary password **once** during provisioning or an
authorised credential reset.

They must never:

- choose predictable or shared passwords;
- retrieve an old temporary password;
- see the employee's permanent password;
- recover the employee's permanent password.

After first login the employee owns their password. Manual create returns the
temporary password once in the successful Edge Function response; it is never
persisted in PostgreSQL or audit metadata.

### Internal workforce Auth identifier

Workforce accounts use a high-entropy internal email-shaped Auth identifier.
Usernames, notification emails, and employee real emails are never used as the
Supabase credential identifier.

`auth.admin.createUser()` sets `email_confirm: true` because no mailbox exists
for the internal identifier. Enrolment control remains
`password_change_required` until the employee changes their password. No
confirmation email is sent.

### Signup hook interaction

`hook_require_invitation_for_signup` allows Auth user creation only when
`user_metadata.workforce_provision_intent_id` matches a valid pending or
`auth_created` intent and the signup email equals the sealed internal identifier.
Public signup without invitation binding remains blocked.

### Permissions

`workforce.provision` and `workforce.credentials.reset` are granted only to
Organisation Owner and Organisation Administrator baseline roles.

`workforce.import` (M2) is granted to the same roles for bulk CSV/XLSX import.

### Bulk import credential vault (M2)

Bulk import stores temporary passwords using AES-GCM encryption in
`workforce_import_row_credentials`. The `CREDENTIAL_ENCRYPTION_KEY` secret
exists only in Edge Functions. Credential export is one-time; encrypted
material is deleted after successful export or after the 24-hour TTL.

See [workforce bulk import guide](../guides/workforce-bulk-import.md).

## Consequences

- Privileged provisioning is isolated in the `workforce-provision` Edge Function
  with service-role finalisation RPCs.
- Bulk import (M2) will extend the same intent pattern with encrypted credential
  storage.
- Notification foundation (M4+) will consume `membership_notification_contacts`
  independently of Auth identifiers.

## Related

- [ADR-0004](ADR-0004-workforce-authentication.md)
- [ADR-0007](ADR-0007-workforce-identity-disclosure-and-stewardship.md)
