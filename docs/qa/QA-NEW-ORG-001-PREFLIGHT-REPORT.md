# QA-NEW-ORG-001-PREFLIGHT-01 — release preflight report

Audit date: **2026-10-08**. Tracking issue:
[#274](https://github.com/Shamsham01/lean-excellence-hub/issues/274).

This report records what was verified from the repository, GitHub, a
read-only hosted Supabase inspection, and a disposable local rehearsal.
It does **not** record a hosted Stripe Sandbox rehearsal. No hosted
migration, Auth setting, CookieWorks row, Stripe object, Edge Function, or
Netlify publish was changed.

Recommendation: **A. Ready for hosted human rehearsal.**

That means the application on the audited `main` SHA is ready for an
operator to run QA-NEW-ORG-001 on a new organisation with Stripe Sandbox.
It does not mean production is ready to take real money, and it does not
mean CI alone authorises publication.

---

## Release preflight status

**CONDITIONAL** for a real paying customer. **Ready** for the hosted human
rehearsal that still has to be performed.

| Gate | Status |
| --- | --- |
| Code P0/P1 blockers found in this audit | None |
| Exact-head Full Regression | PASS — run `37745078910` |
| Source/hosted migration parity | PASS — 230/230, read-only |
| Local fake-provider first-customer rehearsal | PASS — 23/23 |
| Hosted Stripe Sandbox + fresh organisation | HUMAN REQUIRED |
| Legal pack and Stripe LIVE | Outstanding before real money |

---

## GitHub

| Item | Value |
| --- | --- |
| Repository | `Shamsham01/lean-excellence-hub` |
| `origin/main` SHA | `90286dd3b6fdb4bcf5e40e03c6f025fe5881805d` |
| Tip | `chore: reconcile module setup migration ledger timestamp (#273)` |
| Tip time | 2026-10-08 08:42 +0100 |
| Open pull requests | None at audit time |
| Handoff SHA | `90286dd3b6fdb4bcf5e40e03c6f025fe5881805d` |

`main` had **not** advanced past the handoff SHA. `git fetch origin main`
confirmed the same commit.

### Commits since the 2026-10-07 current-state snapshot `a183ff6`

The previous canonical snapshot stopped at ownership-ledger reconciliation.
These commits are already on the audited tip:

| SHA | Change |
| --- | --- |
| `1256b93` | SKILLS-AUTHORING-01 (#269) |
| `0c565a8` | Skills migration ledger timestamp (#270) |
| `244c18b` | Guided 5S and Gemba setup (#272) |
| `90286dd` | Module-setup migration ledger timestamp (#273) |

#271 is closed. Parent #267 remains open for Training, Skills, and other
modules that do not yet share the three-mode shell. That remainder is P3.
This audit did not start LEANAI-MODULE-SETUP-01B.

### Exact-head CI

[Full Regression run 37745078910](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/37745078910)
on `90286dd3b6fdb4bcf5e40e03c6f025fe5881805d`, completed 2026-10-08 07:55 UTC.

| Job | Result |
| --- | --- |
| Quality (format, lint, typecheck, unit tests, production build) | success |
| Database core (db lint, pgTAP, generated types) | success |
| Database gate | success |
| E2E smoke | success |
| E2E platform | success |
| E2E workforce | success |
| E2E improvement | success |
| E2E cookieworks | success |
| E2E ai-closure | success |
| QA hosted replacement | success |
| Windows QA harness | success |
| Prepare quality gate | skipped (main push, not a pull request) |

The immediately previous `main` push, `244c18b` / run
[37743261305](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/37743261305),
failed E2E platform only:
`platform-reliability.spec.ts` “Gemba save then Next/Previous” timed out
clicking after repeated RSC refreshes, with destination-stream closures.
The ledger-only follow-up commit passed the same suite. Treat that failure
as CI flake history, not an open product defect.

Historical `a183ff6` run 37640294086 failed an ownership-transfer back
click. That failure is superseded: the ownership spec passed in run
37745078910 and again in the local rehearsal below.

### Open issues

| Issue | Classification | This audit |
| --- | --- | --- |
| #67 CookieWorks register | Historical register. Remaining items are P2/P3 UX plus hosted ISO-01..05 evidence. Body is stale (PR #153 era, listing migration outstanding). Listing migration `20260925160321` is in the hosted ledger | Keep open until ISO evidence is recorded. Do not reopen implemented P0/P1 product items |
| #170 BILLING-001 | Code sub-issues 4/4 complete. Hosted Sandbox smoke and live cutover remain | P1 **operator** evidence before a real customer. Not a code rebuild. Keep open as the operator tracker |
| #235 LEH Lite | P3 backlog | Do not implement |
| #264 Organisation hint | P3. Must not disclose tenant data | Do not implement |
| #267 Guided module setup | 5S and Gemba delivered. Training, Skills, and other modules remain | P3. Do not start 01B for this release |

#263 FIRST-CUSTOMER-READINESS-02 is closed. Its SHA and migration counts are
historical.

---

## Supabase

Hosted project `zsadfvjtknbbfomlmttv`, region `eu-west-1`, Postgres 17,
status ACTIVE_HEALTHY at audit time. Queries were read-only
(`schema_migrations`, function metadata, grants, Security Advisor).

| Check | Result |
| --- | --- |
| Latest repository migration | `20261008072255_create_module_setup_drafts_from_definition.sql` |
| Latest hosted ledger row | version `20261008072255`, name `create_module_setup_drafts_from_definition` |
| Counts | 230 source SQL files, 230 hosted rows |
| Pending or divergent | None observed |
| `multi_site_intent` | Both `20261006150528` and `20261006165240` present. Left untouched |
| Retired filename | `20261007224043_...` is not a current file. Do not recreate it |

### 5S / Gemba draft RPC

Confirmed in source and in hosted `pg_proc` / privilege metadata:

| Control | Hosted evidence |
| --- | --- |
| Public wrappers | `public.create_five_s_standard_draft_from_definition` and `public.create_gemba_definition_draft_from_definition` are `SECURITY INVOKER` (`prosecdef = false`) |
| `search_path` | `search_path=""` on the public wrappers and the private implementations |
| Anonymous execute | Revoked on both public wrappers and both private implementations |
| Authenticated execute | Granted on the public wrappers |
| Private implementations | `SECURITY DEFINER`, owned by `lean_hub_private_owner`, permission-gated (`five_s.standards.manage` / `gemba.definitions.manage`), organisation taken from the authenticated context |
| Unit scope | Passed into `set_five_s_standard_applicable_units` / the Gemba equivalent, which reject units that are not active units of the current organisation |
| Draft only | Inserts a `draft` version and raises if that draft row is missing. No publish call |
| Applicability | Caller must supply 1–50 unit ids. The function does not invent them |

Authenticated execute on the private definer functions is required so the
`SECURITY INVOKER` public wrappers can call them. The private schema is not
the client API. The public functions the client calls are invoker wrappers.

pgTAP `supabase/tests/database/module_setup_drafts_from_definition.test.sql`
covers draft creation, cross-organisation unit rejection, and permission
denial. It ran inside exact-head Database core. This audit did not re-run
the full pgTAP suite locally.

### Security Advisor (hosted, 2026-10-08)

Three WARN lints. No ERROR lints were returned.

| Finding | Decision |
| --- | --- |
| `anon` can execute `public.preview_organisation_invitation` and `public.prepare_organisation_invitation_signup_binding` (SECURITY DEFINER) | **Keep.** These are the invitation preview/prepare path used before the invitee has a session. They take a token digest, not an organisation search. Do not revoke |
| `anon` can execute `public.rls_auto_enable()` | **Keep.** This is a platform event trigger that enables RLS when a table is created in `public`. It is not an onboarding data API. Do not revoke it from this release task |
| 262 `authenticated` SECURITY DEFINER functions | **Known volume.** Do not mass-revoke. The new draft-from-definition public wrappers are INVOKER and are not in this list. Older public `create_five_s_standard_draft` and `create_gemba_definition_draft` remain DEFINER and are in the list; they are the pre-existing authoring RPCs, still permission-gated |
| Leaked password protection disabled | **Operator action before real customer login.** Requires the Auth setting (Supabase Pro / HaveIBeenPwned). Not changed here |

Remediation references:

- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Remaining hosted risks

- Production Netlify SHA is unverified. Do not assume the live site is `90286dd`.
- Stripe Sandbox products, webhook, and server env were not inspected or changed.
- Auth email templates and the Send Email Hook were not redeployed.
- CookieWorks was not queried for mutation and was not reset. Hosted ISO-01..05 remains human evidence.
- Legal pages are still absent. That blocks real money, not the QA rehearsal.

---

## Automated rehearsal

Environment: disposable local Supabase already running on `127.0.0.1:54321`.
Unused local Studio, analytics, realtime, vector, and pg-meta containers were
stopped to free memory. Hosted project ref `zsadfvjtknbbfomlmttv` is absent
from the production build. `BILLING_PROVIDER=fake` was explicit.
`npm run build` completed (`BUILD_OK`), then `next start` served
`http://127.0.0.1:3000`. Playwright reused that production server.

### Local suite (2026-10-08)

23 tests, **23 passed**, 0 failed, 0 skipped. About 1.3 minutes, `--workers=1`, `--retries=0`.

| Spec | Tests | Result | In Full Regression? |
| --- | --- | --- | --- |
| `billing-founding-onboarding.spec.ts` | 1 | PASS | Yes (platform) |
| `first-customer-rollout.spec.ts` | 1 | PASS | No |
| `module-setup-5s-gemba.spec.ts` | 5 | PASS | No |
| `onboarding-setup.spec.ts` | 4 | PASS | No |
| `organisation-ownership-transfer.spec.ts` | 1 | PASS | Yes (platform) |
| `password-recovery.spec.ts` | 5 | PASS | Yes (workforce) |
| `site-capacity.spec.ts` | 4 | PASS | Yes (platform) |
| `skills-authoring-empty-org.spec.ts` | 2 | PASS | No |

The first local run failed one stale assertion in `onboarding-setup.spec.ts`
(heading “Core setup” / “Recommended next steps”, and homepage “Continuous
improvement”). The setup page now says “Get the first site ready”, “Before
this site can run”, and “Choose what to configure next”. The homepage H1 is
“Operational excellence. Connected.” The spec was updated to those current
strings, the Sign in link was scoped to the banner, and the structure-unit
name was made unique so a repeat against the same local organisation stays
strict-mode safe. The clean rerun is the 23/23 above.

That assertion drift is a test gap, not a product defect. The accessibility
snapshot of the setup page showed organisation, administrator, and first site
complete, with the owner assignment still not started.

### Not re-run locally, because exact-head CI already passed them

Format, lint, typecheck, unit tests, production build, database lint, pgTAP,
database type drift, E2E smoke, the rest of the E2E shards (Maturity, 5S and
Gemba journeys, scheduling, suggestions, actions, problem solving, projects,
benefits, training, recognition, LeanAI, mobile shell, site security,
CookieWorks hostile), and the Windows QA harness.

Local Node was v22.14.0. CI Quality uses Node 24. The local production build
and Playwright run still completed.

### Journey classification

| Journey | Classification | Evidence |
| --- | --- | --- |
| Signup / founding org / fake checkout / activation | PASS | Local `billing-founding-onboarding.spec.ts` |
| Email confirmation on hosted Auth | HUMAN REQUIRED | Local tests confirm users through the admin API |
| Password recovery, including GET not consuming the token | PASS | Local `password-recovery.spec.ts`. Hosted template delivery is HUMAN REQUIRED |
| Organisation selection | PASS | Covered by founding and rollout specs |
| Structure-first setup and empty-org home | PASS | `onboarding-setup.spec.ts`, `first-customer-rollout.spec.ts` |
| Unpaid / provisioning denial and capacity | PASS | Billing and site-capacity specs. Hosted Stripe webhook is HUMAN REQUIRED |
| Cancellation and reactivation | VERIFIED BY CI | pgTAP and billing unit coverage on run 37745078910. Hosted Test Clock is HUMAN REQUIRED |
| Maturity, operational 5S/Gemba, scheduling, suggestions, actions, problem solving, projects, benefits, training, recognition | VERIFIED BY CI | E2E shards on run 37745078910 |
| 5S/Gemba guided setup drafts, including LeanAI not publishing | PASS | Local `module-setup-5s-gemba.spec.ts` plus pgTAP in CI. Not in the CI matrix |
| Skills empty organisation | PASS | Local `skills-authoring-empty-org.spec.ts`, desktop and 390px. Not in the CI matrix |
| Tenant and sibling-site isolation | VERIFIED BY CI | Database and CookieWorks/site-boundary E2E on run 37745078910. Hosted ISO-01..05 is HUMAN REQUIRED |
| Ownership transfer | PASS | Local spec and CI platform shard |
| Mobile 390px | PASS for the routes this rehearsal executed (site-capacity confirmation, skills matrix, and the module-setup spec’s own 390px cases). Broader shell coverage is VERIFIED BY CI | Hosted phone pass remains HUMAN REQUIRED |
| LeanAI hosted provider | HUMAN REQUIRED | Local and CI use the fake provider |
| Stripe Sandbox Checkout, webhook, portal, quantity increase on hosted | HUMAN REQUIRED | Fake provider does not prove Stripe |

---

## First-customer gate

### P0 blockers

None identified.

### P1 blockers

No application-code P1 was demonstrated.

These are operator gates, not code remediation:

1. Publish an approved SHA and record it. The live site SHA is unverified.
2. Run QA-NEW-ORG-001 on a **new** organisation with Stripe Sandbox. Fake-provider tests do not count.
3. Before real money: Terms, Privacy, DPA, retention wording, Stripe LIVE, Supabase Pro, leaked-password protection.

### P2 / P3 deferred

| Item | Severity |
| --- | --- |
| #67 hosted CookieWorks ISO evidence and leftover P2/P3 UX | P2 evidence / P3 polish |
| #264 safe organisation hint | P3 |
| #267 three-mode setup for modules other than Maturity, 5S, and Gemba | P3 |
| #235 LEH Lite | P3 |
| Four first-customer specs absent from the Full Regression matrix | P2 process. They passed locally. Do not block the rehearsal on adding them |
| CI click-timeout history on `244c18b` and historical `a183ff6` | P3 hygiene. Exact head is green |
| Authenticated SECURITY DEFINER advisor volume | Deferred. Do not mass-revoke |
| #67 issue body still describes September migration and PR state | Documentation staleness on a historical register. Not rewritten here, so the historical register is preserved |

### Hosted human evidence outstanding

Account email delivery, hosted password-recovery mail, Stripe Sandbox
Checkout and webhook activation, Customer Portal, Test Clock cancellation,
second-site quantity on real Stripe, sibling isolation on the new
organisation, CookieWorks ISO-01..05, and a phone pass on the published
origin.

---

## Operator actions

Do these in order. Do not reset CookieWorks. Do not point the rehearsal at
live Stripe. Record PASS / FAIL / BLOCKED in
[QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md).

1. Reconfirm `npx supabase migration list` against project `zsadfvjtknbbfomlmttv`. Expect 230/230 and latest `20261008072255`. If `main` has moved, use that SHA’s real tip. Stop if anything is pending. Do not replay.
2. Choose the SHA to publish. Candidate: `90286dd3b6fdb4bcf5e40e03c6f025fe5881805d`, or a later green `main` if one exists. Confirm Full Regression is green on that exact SHA.
3. Publish that SHA only with explicit approval. Record the Netlify SHA. Confirm `/login` returns without 5xx.
4. Set server-only Stripe **Sandbox** env (`BILLING_PROVIDER=stripe`, `sk_test_…`, webhook secret, Professional monthly price). No `NEXT_PUBLIC_STRIPE_*`.
5. Point the Sandbox webhook at `POST /api/billing/stripe/webhook`. Enable Customer Portal cancel-at-period-end.
6. Redeploy the Auth Send Email Hook from the same git revision. Confirm recovery links land on `/auth/recovery`.
7. Create a new founder mailbox. Do not reuse a CookieWorks persona.
8. Execute runbook steps 1–30. Fill every PASS / FAIL / BLOCKED cell. Steps that need the operator directly: email confirmation, recovery mail, Stripe payment, portal, Test Clock, invitation acceptance in a second browser, and the phone pass.
9. After the pack, confirm CookieWorks `cookieworks-manufacturing` still signs in. Optionally record ISO-01..05.
10. Only after the pack PASSes, start LIVE-CUTOVER. Do not take real money before legal pages, Supabase Pro, leaked-password protection, and a live Stripe test.

---

## What changed in this preflight

- Release docs now use `90286dd` and migration `20261008072255` / 230 files.
- Historical `a183ff6` / 228 files / `20261007143820` / filename `20261007224043` stay labelled as history.
- `onboarding-setup.spec.ts` assertions match the structure-first setup page and the current homepage, and the created unit name is unique.

No product feature was added. LEH Lite, the homepage, and module-setup 01B were not started.
