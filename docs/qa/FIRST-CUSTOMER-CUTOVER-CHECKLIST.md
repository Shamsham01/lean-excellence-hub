# First real customer cutover checklist

Companion to [PROJECT-CURRENT-STATE.md](./PROJECT-CURRENT-STATE.md).

This is an **operator** checklist. Automated agents must not publish Netlify,
mutate hosted Supabase, change Auth, create live Stripe objects, or reset
CookieWorks from a documentation PR.

Use **Sandbox** until the Sandbox rehearsal PASSes. Live money is a later
gate.

Record the exact git SHA against every row.

Severity: stop for **P0/P1**. Do not block on LEH Lite, SSO, tenant merge,
or P3 polish.

---

## APPLICATION

- [ ] Chosen `main` SHA recorded (candidate at audit: `a183ff6b5257636b01110693fd046788147ea882` — replace with the SHA actually published)
- [ ] Fast CI / Quality green on that exact SHA
- [ ] Database CI green if database paths changed on that SHA
- [ ] Full Regression green on that exact SHA (Quality, Database, E2E smoke, E2E shards, Windows QA harness)
- [ ] Production Netlify publish of **that** SHA, explicitly approved
- [ ] Production (or chosen preview) smoke: sign-in page loads; no 5xx
- [ ] Public HTML does not expose git SHA or secrets
- [ ] `BILLING_PROVIDER` on the published runtime is intentional (`stripe` hosted, never an implicit fake fallback)

## DATABASE

- [ ] Hosted project `zsadfvjtknbbfomlmttv` migration list is **name-and-version matched** to the published SHA
- [ ] Latest hosted version is `20261007143820_organisation_ownership_transfer` (or later **only** if that later file is on the published SHA)
- [ ] **No pending migrations**
- [ ] Do **not** replay `20261007143820` or any earlier file, including Coach-04 `20260930103004`
- [ ] Backup / point-in-time recovery posture reviewed on the hosted plan
- [ ] CookieWorks tenant still present; no hosted reset was used as a shortcut

## AUTH / SECURITY

- [ ] Supabase **Pro** if still required for leaked-password protection
- [ ] Leaked-password protection enabled (HaveIBeenPwned) immediately before the first real customer
- [ ] Auth redirect allow-list includes `https://leanexcellencehub.com/auth/callback`, `/auth/confirm`, `/auth/recovery`, `/update-password`
- [ ] Signup confirmation and invitation emails land on the production origin
- [ ] Password recovery uses TokenHash links to `/auth/recovery` (GET must not consume the OTP)
- [ ] Hosted Send Email Hook redeployed from the **same git revision** as the app (`docs/deployment/auth-email-templates.md`)
- [ ] Invitation preview/prepare RPCs remain executable by `anon`; do **not** globally revoke authenticated EXECUTE
- [ ] Security Advisor reviewed: anon DEFINER still the known invitation pair + platform `rls_auto_enable`; no new unexpected anon grants
- [ ] No service-role or Stripe secrets in `NEXT_PUBLIC_*`
- [ ] Invitation accept + founder signup both work on the published origin

## BILLING

### Sandbox rehearsal (required before live)

- [ ] Dedicated Stripe **Sandbox** (not live)
- [ ] Sandbox products/prices for Professional monthly (and annual if exercising it)
- [ ] Sandbox webhook `POST /api/billing/stripe/webhook` with signing secret
- [ ] Customer Portal: payment method, invoices, **cancel at period end** (not immediate cancel)
- [ ] Server env: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PROFESSIONAL_MONTHLY`, `APP_ORIGIN`
- [ ] QA-NEW-ORG-001 PASS on Sandbox (checkout, webhook activation, portal, cancel/reactivate, quantity increase)

### Live cutover (required before real money)

- [ ] Stripe **LIVE** products/prices (do not copy Sandbox IDs)
- [ ] Live webhook endpoint + live signing secret
- [ ] Live Customer Portal
- [ ] Tax/VAT decision recorded (code does not invent a tax strategy)
- [ ] One low-risk live end-to-end payment using a real card the operator controls
- [ ] Cancellation / refund process written down
- [ ] Founder Pilot price IDs attached only if that private offer is in use

## LEGAL / COMMERCIAL

Do **not** tick these as complete unless the documents actually exist.
As of 2026-10-07 they are **missing** from the application.

- [ ] Terms of Service published and linked from signup / footer
- [ ] Privacy Policy published and linked
- [ ] DPA available where appropriate
- [ ] Retention / deletion wording (90-day suspended eligibility; no automatic destructive deletion in v1)
- [ ] Pricing and Founder Pilot agreement
- [ ] Support expectations (hours, channel, what “priority” means)

## OPERATIONS

- [ ] Support contact
- [ ] First-customer onboarding owner
- [ ] Rollback: previous Netlify SHA (does **not** undo database)
- [ ] Incident procedure
- [ ] Backup / export procedure for what the product actually ships (workforce CSV, schedule ICS — not a full tenant dump)
- [ ] CookieWorks remains the historical QA tenant; first customer is a **new** organisation

---

## Stop rules

Stop cutover and file a **new** P0/P1 if any of the following occur on the
published SHA:

1. Cross-tenant or sibling-site data visible or writable
2. Privilege escalation
3. Billing webhook activates the wrong organisation
4. Provisioning organisation can enter operational modules unpaid
5. Password recovery consumes the token on GET / lockout
6. Secrets appear in client bundles or `NEXT_PUBLIC_*`
7. Create action yields an unusable record
8. Silent data loss after save/refresh
