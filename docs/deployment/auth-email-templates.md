# Hosted Auth email templates and recovery links

Git does **not** automatically redeploy a hosted Supabase Send Email Hook or
change hosted Auth email templates. Production parity is an operator step.

## Production application origin

Canonical origin:

```text
https://leanexcellencehub.com
```

Password recovery, signup confirmation, and invitation confirmation must use
this origin.

## Recovery flow

LEH uses a TokenHash link on its own domain:

```text
https://leanexcellencehub.com/auth/recovery?token_hash=...&type=recovery
```

The GET request does **not** verify or consume the one-time token. It stages
the recovery intent in a short-lived HttpOnly, SameSite=Lax cookie, strips the
token from the browser URL, and redirects to:

```text
/recover?continue=true
```

Only the human-triggered **Continue account recovery** POST verifies the OTP.
This is intentional. Enterprise mail systems and link-security scanners may
prefetch GET links; consuming a Supabase one-time token on GET can invalidate
the recovery link before the user clicks it.

Supabase's production guidance specifically warns about this behaviour for
single-use password-reset and signup links.

## resetPasswordForEmail redirect target

The application keeps:

```text
https://leanexcellencehub.com/update-password
```

as the `resetPasswordForEmail(..., { redirectTo })` target because that URL is
already part of the production Auth redirect configuration. LEH's custom
TokenHash email link goes to `/auth/recovery` directly, so this release does
not require a new hosted redirect allow-list entry merely to send recovery
email.

## Hosted Send Email Hook

The hosted project currently uses the `send-email` Edge Function for Auth
email delivery. After the application route is deployed, redeploy that function
from the same Git revision so new recovery emails point directly to
`/auth/recovery`.

Until the hook is redeployed, existing production recovery emails that still
point to:

```text
/auth/confirm?token_hash=...&type=recovery
```

remain compatible. `/auth/confirm` forwards recovery traffic into the new
staged recovery flow without consuming the token.

This compatibility is deliberate so the app can be deployed before the email
hook without creating an outage window.

## Reset Password template

If the hosted project ever uses Supabase's built-in template instead of the
Send Email Hook, use:

```html
<a
  href="{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery"
>
  Continue account recovery
</a>
```

Subject:

```text
Recover your Lean Excellence Hub account
```

Do not point recovery at a route that verifies the token on GET.

## Signup and invitation templates

Signup and invitations remain on `/auth/confirm`:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
```

## Release sequence

1. Merge and deploy the application route first.
2. Verify a legacy `/auth/confirm?...&type=recovery` link reaches the staged
   recovery page.
3. Redeploy the hosted `send-email` Edge Function from the same Git revision.
4. Send a new recovery email to a known test account.
5. Confirm the email GET lands on `/recover?continue=true` without consuming
   the OTP.
6. Click **Continue account recovery** and confirm it reaches
   `/update-password`.
7. Confirm replaying the same link and pressing Continue gives
   `/recover?error=expired`.

Do not deploy the new email hook before the application route is live.
