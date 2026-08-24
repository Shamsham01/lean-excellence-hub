# Microsoft Entra ID authentication seam

Milestone 3 retains only the provider-neutral route and callback seam.
Microsoft Entra ID is explicitly disabled and deferred: the application has no
OAuth enablement environment variable, every provider route is rejected, the
callback rejects every provider, and local Supabase configuration fixes
`auth.external.azure.enabled` to `false`. Live tenant configuration is not a
Milestone 3 acceptance dependency.

Azure must not be enabled by configuration alone. A later milestone requires a
dedicated security review and an intentional code change before this seam may
be activated. That review must verify the approved tenant restriction,
provider-verified identity attributes, account-linking behavior, callback and
redirect allowlists, session handling, and the tests that enforce them.

## Requirements for a future reviewed implementation

- Register the exact Supabase Auth callback URL shown by the Supabase dashboard.
- Configure the application origin callback as
  `<APP_ORIGIN>/auth/callback`; do not use wildcard production redirects.
- Request the `email` scope. Treat an email address as verified only when the
  provider assertion is verified, including `xms_edov` where applicable.
- Decide whether the deployment accepts all Entra tenants or an explicit tenant
  allowlist before enabling the provider.
- Keep client secrets server-side, rotate them under the platform secret
  management process, and revoke superseded secrets.
- Azure may require `localhost` rather than `127.0.0.1` for development redirect
  registration. Keep the application and Supabase redirect allowlists exact and
  aligned when this seam is enabled locally.

## Identity collision policy

Supabase Auth remains the sole global identity authority. Automatic linking by
matching unverified email is prohibited. An OAuth identity may attach only
through Supabase's verified identity-linking behavior or an explicit,
authenticated account-linking operation. Organisation memberships and
workforce aliases remain scoped to their organisation and never create a
second global credential identity for an existing user.
