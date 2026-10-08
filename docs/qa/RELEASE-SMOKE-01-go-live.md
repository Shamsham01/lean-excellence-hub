# RELEASE-SMOKE-01 — Go-live / first-customer operator gate

Canonical current-state: [PROJECT-CURRENT-STATE.md](./PROJECT-CURRENT-STATE.md).
Executable cutover ticks: [FIRST-CUSTOMER-CUTOVER-CHECKLIST.md](./FIRST-CUSTOMER-CUTOVER-CHECKLIST.md).
Primary product smoke: [QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md).
CookieWorks isolation: [RELEASE-SMOKE-01-protocol.md](./RELEASE-SMOKE-01-protocol.md).
Stripe Sandbox: [STRIPE-SANDBOX-ONBOARDING-SMOKE.md](./STRIPE-SANDBOX-ONBOARDING-SMOKE.md).

**This document is planning only.** Automated agents and implementation PRs
must not mutate hosted Supabase, CookieWorks fixtures, Auth, Netlify, or
billing.

---

## Current gate (8 October 2026)

Evidence: [QA-NEW-ORG-001-PREFLIGHT-REPORT.md](./QA-NEW-ORG-001-PREFLIGHT-REPORT.md).
The 7 October gate (`a183ff6`, 228 files, `20261007143820`) is historical.

| Item | Value |
| --- | --- |
| Git `main` | `90286dd3b6fdb4bcf5e40e03c6f025fe5881805d` (#273) |
| Includes | #269 Skills authoring, #272 guided 5S/Gemba drafts, #273 ledger reconciliation |
| Hosted project | `zsadfvjtknbbfomlmttv` (`eu-west-1`) |
| Latest migration | `20261008072255_create_module_setup_drafts_from_definition` (230 source files, 230 hosted rows, read-only match) |
| Ownership hosted apply | `20261007143820`. **Do not replay** |
| Production `https://leanexcellencehub.com` | Exact published git SHA **unverified**. Do not publish from this docs PR |
| Application billing | **Implemented** (fake + Stripe Sandbox providers). Hosted Sandbox smoke **not** recorded as PASS |
| Legal pages | **Missing** |

### Two different gates

| Gate | Status | Blocks first **controlled** customer? |
| --- | --- | --- |
| P0/P1 **product-code** blockers on `main` | **None identified** in FIRST-CUSTOMER-READINESS-02 | No |
| Hosted schema vs `main` | Read-only 230/230 match through `20261008072255` on 2026-10-08. Reconfirm immediately before publish | Reconfirm; do not replay |
| Hosted Stripe Sandbox rehearsal | Outstanding | Yes, before treating billing as proven |
| QA-NEW-ORG-001 human smoke | Outstanding | Yes, before inviting a real customer |
| CookieWorks ISO-01..05 | Outstanding as hosted evidence | Isolation is P0 if it fails; the pack itself is evidence, not missing code |
| Leaked-password protection | Deferred until Supabase Pro | **Yes before real customer login on production** |
| Terms / Privacy / DPA | Documents do not exist | **Yes before real money** |
| Stripe live mode | Not started | **Yes before real money** |

**Verdict: FEATURE-COMPLETE ENOUGH FOR A CONTROLLED FIRST CUSTOMER AFTER OPERATOR CUTOVER.**

Not “production ready” merely because CI is green. Not a licence to publish
or to take live payment from this reconciliation.

---

## Deployment checklist (maintainer, explicit approval each row)

### A. Pre-flight (read-only)

- [ ] `main` SHA recorded for the intended publish
- [ ] Hosted `supabase migration list` latest = `20261008072255` (or the SHA’s true tip). Names match. Nothing pending
- [ ] Fast CI + Full Regression green on **that** SHA
- [ ] Dry-run only, if a tenant reset is ever approved: `npm run qa:cookie:hosted-replacement -- --dry-run`

### B. Hosted migrations — do not replay

Do not paste historical “latest = 20260928210635” rows into a deploy
decision. That was 29 September.

Operator must list remote versions against the 230 repository files.
The 7 October instruction to expect 228 files through `20261007143820` is
historical.
Known already-applied from source history (non-exhaustive; all earlier
files are also applied if the ledger is healthy):

| Version | Name | Action |
| --- | --- | --- |
| `20260930103004` | `leanai_general_coach_sessions` | Do not replay |
| `20261005113608` | `sec_billing_002_member_billing_projection` | Do not replay |
| `20261006085407` | `site_capacity_enforcement` | Do not replay |
| `20261006130432` | `site_quantity_increase_monotonic_claim` | Do not replay |
| `20261006150528` / `20261006165240` | `multi_site_intent` | Do not replay |
| `20261007143820` | `organisation_ownership_transfer` | Do not replay |
| `20261007220929` | `skills_authoring_draft_integrity` | Do not replay |
| `20261008072255` | `create_module_setup_drafts_from_definition` | Do not replay |

If a hosted apply ever fails part-way: **stop**. Do not re-run historical
migrations. Do not use MCP `apply_migration` in a way that generates an
untracked timestamp.

### C. Application publication

- [ ] Keep auto-publish disabled unless a maintainer explicitly enables it
- [ ] Publish a chosen SHA only when authorised — **not** from a docs reconciliation
- [ ] UX-026: hide the Netlify “Powered by” badge in site settings (**operator**)
- [ ] Record the published SHA independently (Netlify UI). Public HTML will not show it

### D. Supabase Auth / security (operator)

- [ ] Leave invitation bootstrap RPCs executable by `anon` (`preview_organisation_invitation`, `prepare_organisation_invitation_signup_binding`)
- [ ] Leave `rls_auto_enable` to the platform
- [ ] Do **not** globally revoke authenticated EXECUTE on remaining SECURITY DEFINER RPCs
- [ ] Redeploy the Send Email Hook from the published revision (`docs/deployment/auth-email-templates.md`)
- [ ] Enable **leaked-password protection** only after Free → Pro, immediately before the first real customer
- [ ] No service-role key in Netlify `NEXT_PUBLIC_*`

### E. CookieWorks data

- [ ] Preserve existing hosted CookieWorks unless a reset is separately approved
- [ ] Destructive hosted reset only with `LEANHUB_QA_RESET_CONFIRM=DELETE_COOKIEWORKS_ONLY` and written approval
- [ ] Never run `npm run db:seed-demo` against hosted
- [ ] Never run `npm run qa:cookie:inventory` against hosted credentials (local-only)

### F. Billing

Sandbox first. Live later. See the Stripe companion and the cutover
checklist. Do not mix Sandbox and live price IDs.

### G. Rollback

| Layer | Rollback | Caution |
| --- | --- | --- |
| Netlify app | Redeploy previous SHA | Does not undo DB |
| Forward-only SQL | **No down migration** | Keep app and DB paired |
| CookieWorks tenant | Restore from backup / re-seed foundation only with approval | Reset deletes QA tenant data only |
| Auth leaked-password toggle | Turn the setting off | Does not rewrite data |
| Stripe | Dashboard / support; LEH remains access authority | Do not “fix” access by replaying webhooks with foreign ids |

---

## Historical checkpoint (29 September 2026)

The original FIRST-CUSTOMER-READINESS-01 report (`ad6edce`, hosted through
`20260928210635`, “Stripe not implemented”) is **obsolete**. Do not use it
for deployment decisions. It remains in git history only.
