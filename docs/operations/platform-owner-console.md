# Platform owner console

The console at `/org_admin` is for Lean Excellence Hub operators. It is separate
from customer Organisation Owner administration. It is read-only: this release
does not suspend, close, delete, or disable organisations, and it does not
change Stripe subscriptions.

## Authorisation

Access requires both of the following:

1. The Auth user id is an active row in `private.platform_admins`.
2. The session authenticator assurance level is `aal2` (TOTP).

An organisation-owner role, an email address, JWT user metadata, and knowledge
of the URL do not grant access. There is no signup page and no public RPC that
inserts the allowlist. Unauthorised sessions receive a not-found response
before any cross-tenant read. Anonymous visitors see only the sign-in form.

The console and `/api/org-admin` responses send `X-Robots-Tag: noindex, nofollow`,
`Cache-Control: private, no-store`, and `Referrer-Policy: no-referrer`. Do not
add a `robots.txt` disallow rule for `/org_admin`; that would advertise the path.
Customer navigation does not link to the console.

Privileged reads use the server-side secret key. The browser never receives it.

## Manual bootstrap

Run this once, as the database owner, against the target database. Do not put
the password or the chosen user id in git. Do not create the user through the
Supabase dashboard or a public signup: the `before_user_created` hook rejects
accounts that are not invitations or founding signups. A direct insert bypasses
that hook. `private.handle_new_auth_user` still creates the profile and identity
control rows.

Replace `operator@example.com` and the password before running. Use a password
manager. Confirm the Auth instance id if this project does not use the local
all-zero instance.

```sql
begin;

create extension if not exists pgcrypto with schema extensions;

with operator as (
  select gen_random_uuid() as id
),
created as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    is_sso_user,
    is_anonymous
  )
  select
    '00000000-0000-0000-0000-000000000000',
    operator.id,
    'authenticated',
    'authenticated',
    'operator@example.com',
    extensions.crypt('replace-with-a-long-password', extensions.gen_salt('bf')),
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp(),
    '',
    '',
    '',
    '',
    false,
    false
  from operator
  returning id, email
)
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  created.id::text,
  created.id,
  jsonb_build_object('sub', created.id::text, 'email', created.email),
  'email',
  statement_timestamp(),
  statement_timestamp(),
  statement_timestamp()
from created;

insert into private.platform_admins (auth_user_id, label, bootstrap_note)
select id, 'Platform owner', 'Manual bootstrap'
from auth.users
where email = 'operator@example.com';

commit;
```

Hosted Auth must allow authenticator enrollment. `supabase/config.toml` enables
`[auth.mfa.totp]` `enroll_enabled` and `verify_enabled`. Apply that Auth setting
on the hosted project before the first operator signs in. Phone MFA stays
disabled. Customer screens do not ask for an authenticator; only `/org_admin`
does.

Then:

1. Open `/org_admin` and sign in. The console stays hidden until MFA.
2. Enrol a TOTP authenticator and confirm a code. That raises the session to `aal2`.
3. Confirm the overview loads and a row exists in `private.platform_admin_access_events`.

Revoke access with SQL. Do not delete the Auth user from the application.

```sql
update private.platform_admins
set status = 'revoked',
    revoked_at = statement_timestamp()
where auth_user_id = '<auth-user-uuid>'
  and status = 'active';
```

## Operator email

`private.platform_notification_settings` is created with delivery disabled and
recipient `admin.lean.excellence.hub@gmail.com`. Triggers enqueue:

- `founder.email_confirmed` when a founding signup binding is consumed by a
  confirmed Auth user;
- `organisation.founded` when an organisation enters `provisioning`;
- `subscription.entitlement_activated` when a Stripe subscription enters
  `active` or `trialing` from a non-entitled state;
- `billing.payment_failed` when Stripe billing becomes `past_due`;
- `subscription.cancelled` when Stripe billing becomes `cancel_at_period_end`
  or `ended`.

Fake billing fixtures and synthetic addresses (`.test`, `.invalid`, `.example`,
`@example.com`, `@workforce.invalid`, and similar) are stored as `suppressed`
and are not sent. Idempotency keys stop webhook replays from inserting a second
row. Checkout success URLs do not enqueue these events.

The `platform-notification-delivery` Edge Function claims due rows, sends
through the existing Resend operational email provider, and completes or
retries with the same lease token. It authenticates with the same secret-key
check as `notification-delivery` (`verify_jwt = false` in `config.toml` because
the function checks the key itself).

Leave delivery disabled until the function secrets below are set. Enabling it
sends every still-pending row, including events queued while delivery was off.

```sql
update private.platform_notification_settings
set delivery_enabled = true,
    updated_at = statement_timestamp()
where singleton;
```

## Migration and secrets

Apply the repo migration `20261031150941_platform_owner_console.sql` through the
normal migration path. Do not edit hosted data by hand except for the bootstrap
and the delivery switch above.

No new Next.js environment variable is required. The console uses:

| Name | Use |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Server-side reads. Never expose it to the browser. |
| `AUTH_RATE_LIMIT_PEPPER` | HMAC key for login and console rate-limit buckets. At least 32 characters. |
| `APP_ORIGIN` | Canonical origin for sign-in redirects. |
| `TRUSTED_PROXY_IP_HEADER` | Optional. One of `cf-connecting-ip`, `fly-client-ip`, `x-real-ip`. When unset, address limits share an `untrusted` bucket. |
| `STRIPE_SECRET_KEY` | Read only to label the configured key as test or live. The value is not sent to the browser. The app still rejects `sk_live` where billing startup already does. |
| `BILLING_PROVIDER` | Shows whether self-service checkout is Stripe in this deployment. |

Edge function `platform-notification-delivery` uses the existing operational
email secrets:

| Name | Use |
| --- | --- |
| `SUPABASE_URL` | Supabase API URL inside the function. |
| `SUPABASE_SECRET_KEYS` | Worker authentication and the privileged client. Legacy `SUPABASE_SERVICE_ROLE_KEY` remains the temporary fallback already used by notification delivery. |
| `RESEND_API_KEY` | Send provider. Required only when delivery is enabled. |
| `OPERATIONAL_EMAIL_FROM` | From address. |
| `OPERATIONAL_EMAIL_FROM_NAME` | Optional display name. |
| `APP_ORIGIN` | Optional console link in the email. |

Resend idempotency is still limited to the provider window already documented
for operational email. The database idempotency key prevents a second outbox
row; a replay inside an active lease is skipped.

## Rate limits and audit

Console reads allow 120 requests per allowlisted user, or 30 anonymous requests,
per 5 minutes, then block for 15 minutes. Sign-in allows 10 attempts per email
and per address in the same window. Keys stored in Postgres are HMAC digests,
not raw addresses. Limit failures are fail-closed.

`private.platform_admin_access_events` is append-only. Reads of the overview,
directory, organisation, and notification history write an allowed event after
the authorisation check. Denied, MFA, and rate-limited visits are recorded
without returning tenant data.
