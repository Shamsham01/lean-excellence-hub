# Organisation invitation email delivery

## Scope (isolated from operational notifications)

Organisation **invitation offer** emails use a dedicated pipeline. They do **not** use:

- `private.domain_event_outbox` / N1b notification projector
- `private.notification_delivery_ledger` / `notification-delivery` worker kinds

That separation keeps this work independent from the Suggestions approval/delegation workstream (`bc-ac9528a9`), which extends the existing operational outbox/email transport.

## Architecture

```text
Admin invite (Next.js server action)
  -> register_organisation_invitation_delivery (Postgres)
  -> organisation-invitation-delivery Edge Function (service apikey)
  -> Resend (AUTH_EMAIL_* sender)
  -> Invite email with inbox proof link
  -> /invitations/{token}/activate?inbox_proof=...
  -> attest_organisation_invitation_inbox (GET-safe, no membership grant)
  -> Password setup + service-role createUser (email_confirm) + sign-in
  -> Invitation continue / accept (unchanged)
```

Raw invitation tokens and inbox proofs are never stored in PostgreSQL (only SHA-256 digests).

## Shared mail prerequisites (operator approval gate)

Invitation delivery reuses the **same Resend sender configuration** as auth transactional mail, but does **not** modify auth hook routing.

| Prerequisite | Used by invitations | Used by auth hook (`send-email`) | Used by N1c operational worker |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Yes | Yes | Yes |
| `AUTH_EMAIL_FROM` | Yes | Yes | No (`OPERATIONAL_EMAIL_FROM`) |
| `AUTH_EMAIL_FROM_NAME` | Yes | Yes | No |
| `APP_ORIGIN` | Yes | Yes | Yes |
| Verified Resend domain for `AUTH_EMAIL_FROM` | Required for production | Required for production | Required for operational from-address |
| `SEND_EMAIL_HOOK_SECRET` | No | Yes | No |

**Do not** enable production invitation sending without operator verification of Resend domain/sender (same gate as [custom-auth-email-delivery.md](./custom-auth-email-delivery.md)). This repository does not ship live SMTP secrets.

Local development:

- `supabase functions serve organisation-invitation-delivery --no-verify-jwt`
- Set secrets per `supabase/functions/.env.example`
- Captured mail: Supabase Inbucket (`127.0.0.1:54324`) / Playwright Mailpit helpers

## Files touched (transport-related)

| File | Role |
| --- | --- |
| `supabase/migrations/20261108180000_organisation_invitation_email_delivery.sql` | Invitation-only delivery ledger + RPCs |
| `supabase/functions/organisation-invitation-delivery/index.ts` | New Edge Function entrypoint |
| `supabase/functions/_shared/organisation-invitation-delivery/*` | Renderer + dispatch handler |
| `supabase/functions/_shared/worker-auth.ts` | **Read-only reuse** (apikey auth pattern) |
| `src/modules/identity/invitation-delivery-client.ts` | Server dispatch client |
| `src/modules/identity/schedule-invitation-email.ts` | Register + dispatch orchestration |

**Not modified:** `notification-delivery`, `notification-projector`, `platform-notification-delivery`, suggestion projector kinds, or domain event schemas.

## Overlap with PR #374 (billing)

PR #374 (`cursor/billing-entitlement-readiness-13ce`) may touch `people/page.tsx` and `database.types.ts`. This branch touches the same people settings UI copy and will regenerate types after migration. Merge coordination: prefer billing PR for entitlement shells; prefer this PR for invitation email actions and activate flow.

## Bulk CSV colleague import

`people_invitation_import` still issues invitations inside Postgres without returning raw tokens. Automated invitation email for import rows is **not** included in this slice; operators should reissue from People settings or share links until a follow-up bridges SQL-issued invites to dispatch.
