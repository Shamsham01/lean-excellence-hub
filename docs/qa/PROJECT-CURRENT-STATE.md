# Lean Excellence Hub — Current Project and Release State

Updated: **2026-10-07**. Canonical as of
[FIRST-CUSTOMER-READINESS-02 (#263)](https://github.com/Shamsham01/lean-excellence-hub/issues/263).

This is the release-state entry point. Reconcile GitHub checks, `main`, and
the hosted Supabase migration ledger immediately before any deploy. The
figures below are a dated audit of **code on `main`**, not an automatic
publication authorisation.

Do **not** use older snapshots in this folder as current gates:

- 30 September Coach-04 checkpoint
- 29 September FIRST-CUSTOMER-READINESS-01 (`ad6edce` / `4ae04302`)
- CookieWorks register wording that still says billing is unimplemented

---

## CURRENT MAIN

| Item | Value |
| --- | --- |
| Git `main` audited | `a183ff6b5257636b01110693fd046788147ea882` |
| Tip commit | `chore: reconcile ownership migration ledger timestamp (#262)` |
| Immediately previous | `ec6d879` — MULTISITE-EXPAND-01D organisation ownership transfer (#261) |
| Production published SHA | **Unverified.** `https://leanexcellencehub.com` is not an approved publication of this tip |

This tip includes, among other merged work since the stale 30 September
docs:

- billing / Stripe Sandbox application foundation
- founder onboarding and structure-first setup
- LeanAI contextual Coach + Explain + logical model routing
- Maturity Quick Start + conversational AI builder
- multi-site capacity enforcement and self-service quantity increase
- first-customer multi-site rollout governance
- organisation ownership transfer
- password recovery hardening (mail-scanner-safe TokenHash staging)
- cinematic public homepage
- SEC-BILLING-002 member billing projection
- numerous performance and SECURITY DEFINER privilege-boundary fixes

---

## CURRENT HOSTED MIGRATION PARITY

Known from **source history**, not from a live hosted ledger query in this
audit. This PR did **not** link to hosted Supabase and must **not** replay
anything.

| Item | Value |
| --- | --- |
| Hosted project | `zsadfvjtknbbfomlmttv` (`eu-west-1`) |
| Repository migration files | **228** SQL files |
| Latest repository version | `20261007143820_organisation_ownership_transfer` |
| Coach-04 | `20260930103004_leanai_general_coach_sessions` applied 30 September 2026 via official linked CLI. Do not replay |
| Ownership transfer | Hosted applied as ledger version `20261007143820`. Source filename reconciled in #262. **Do not replay** |
| Intermediate files after Coach-04 | Applied with their respective merged slices (billing, LeanAI, Maturity, site capacity, quantity increase, multi-site intent, SEC-BILLING-002). Operator must confirm hosted `migration list` is **228/228 name-and-version matched** before smoke |
| CookieWorks | Preserve. Do not reset for first-customer smoke |

Operator dry-run immediately before smoke:

```bash
npx supabase link --project-ref zsadfvjtknbbfomlmttv
npx supabase migration list
```

Expect latest remote version `20261007143820` / name
`organisation_ownership_transfer` and **no pending files**. If anything is
pending, stop and get an explicit apply approval. Never use a tool that
generates an untracked replacement timestamp.

---

## CURRENT PRODUCT CAPABILITIES

Classifications are from **code and tests on `a183ff6`**, not from issue
titles.

| Area | Classification | Evidence (short) |
| --- | --- | --- |
| Organisation / tenant model | **IMPLEMENTED** | Founding RPC, org selection, structure v2 E2E + pgTAP |
| Sites / multi-site | **IMPLEMENTED** | Site context switcher, site-boundary pgTAP/E2E, CookieWorks two-site hostile |
| Billing application foundation | **IMPLEMENTED / NEEDS HUMAN HOSTED SMOKE** | Fake provider E2E + pgTAP lifecycle. Stripe Sandbox path coded; hosted payment not proven by this audit |
| Founder onboarding | **IMPLEMENTED** | Signup → create org/site → plan/checkout → structure-first setup |
| People / invitations | **IMPLEMENTED** | Invite lifecycle, role picker, workforce provision, CSV/XLSX import |
| RBAC | **IMPLEMENTED** | Versioned roles, org vs unit-subtree grants, batched permission probes |
| Maturity | **IMPLEMENTED** | Authoring, Self/Formal, Quick Start, AI builder |
| 5S | **IMPLEMENTED** | Standards, audits, evidence, journeys E2E |
| Gemba | **IMPLEMENTED** | Definitions, walks, completion URL rules |
| Suggestions | **IMPLEMENTED** | Programmes, submit+evidence, reviewer workflow |
| Actions | **IMPLEMENTED** | Lifecycle + lineage |
| Problem Solving | **IMPLEMENTED** | Cases + backward-compatible case-bound AI |
| Projects | **IMPLEMENTED** | Charter lifecycle, methodologies, site scope |
| Benefits | **IMPLEMENTED** | Forecast/realisation/validation queue |
| Training | **IMPLEMENTED** | Catalogue, curriculum, sessions, matrix |
| Skills | **IMPLEMENTED** | Empty organisation can publish a proficiency scale, create skills, publish a skills standard against existing job functions, and record a validated assessment that the matrix keeps. Draft levels and requirements are append-only; published versions are read-only until a later versioning RPC exists. Matrix uses the latest published skills standard |
| Recognition | **IMPLEMENTED** | Types + award flow |
| Scheduling | **IMPLEMENTED** | Recurrence + `.ics` download |
| LeanAI contextual Coach | **IMPLEMENTED** | Deterministic Coach, explicit Explain, economy/standard/deep routing, `store:false`, usage ledger |
| Public / authentication | **IMPLEMENTED** | Login, signup, invitations, org create/select. Social OAuth provider route is a 404 stub |
| Password recovery | **IMPLEMENTED** | Staged `/auth/recovery` TokenHash; GET does not consume OTP |
| Mobile / responsive shell | **IMPLEMENTED** | Mobile chrome + viewport E2E. Hosted form polish remains P2/P3 |
| Ownership transfer | **IMPLEMENTED** | Owner-only RPC + confirmation UI + E2E |
| Site quantity increase / second-site rollout | **IMPLEMENTED** | DB capacity guard, Stripe quantity claim, rollout workspace |
| Exports currently shipped | **PARTIAL** | Workforce CSV import/export, schedule ICS, Stripe webhook. No public product API / Slack / Zapier |
| Legal pages (Terms / Privacy / DPA) | **BACKLOG** | No customer-facing legal routes. Operator/legal work, not application code |
| LEH Lite | **NOT REQUIRED FOR V1** | #235 backlog only |
| Enterprise SSO/SCIM / tenant merge / benchmarking | **NOT REQUIRED FOR V1** | Catalogue flags stay false |

---

## CURRENT CI BASELINE

Authoritative workflows: Fast CI, path-filtered Database CI, Full Regression
(`docs/development/ci-strategy.md`).

| Check | Status at audit time |
| --- | --- |
| PR #261 (ownership transfer) Fast CI / Database CI / Full Regression | Green on reviewed head `a1891d7380dc48e54a4de27eb9d97098d908f797` — [Full Regression #37632016497](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/37632016497) |
| Post-merge `ec6d879` Full Regression | Failed **E2E platform** only: Playwright click on `ownership-complete-back` in `organisation-ownership-transfer.spec.ts`. 115 passed. Treat as **CI flake**, not a product defect |
| PR #262 (ledger rename, SQL unchanged) Fast CI / Database CI / Full Regression | Green on `8a8683934776b6c32d46da2b1374ac0326255530` |
| `main` `a183ff6` Full Regression | [run #37640294086](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/37640294086): Quality, Database core, E2E smoke/workforce/improvement/cookieworks/ai-closure **green**. E2E platform **failed** again on the same ownership-transfer back-click (240s timeout; webserver also logged destination-stream closures). Not a missing feature |
| This reconciliation PR | Fast CI on the docs head. Full Regression waits until the PR is marked Ready after orchestrator review |

Do **not** call `a183ff6` an operator-approved published SHA merely because
PR checks were green.

Local Fast CI equivalent:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

Local Database CI equivalent (after `npm run db:start:ci`):

```bash
npm run db:lint && npm run test:db && npm run db:types
git diff --exit-code -- src/platform/supabase/database.types.ts
```

---

## CURRENT FIRST-CUSTOMER GATE

### Severity model

| Severity | Meaning | Stops first-customer onboarding? |
| --- | --- | --- |
| **P0** | Security, tenant isolation, data integrity | **Yes** |
| **P1** | First-customer core workflow blocker | **Yes** |
| **P2** | Significant UX / performance friction | No, unless it makes the paid journey unusable |
| **P3** | Polish / later product | No |

Do **not** block v1 for LEH Lite, SSO/SCIM, generic tenant merging,
enterprise benchmarking, advanced AI duplicate detection, automatic
recurring-action escalation, homepage animation polish, or every open P3.

### Remaining P0/P1 **code** blockers

**None identified in this code audit.**

Caveats that stay **operator / evidence**, not missing features:

1. Exact-head Full Regression on the SHA that will be published.
2. Hosted Stripe Sandbox rehearsal of the coded billing path.
3. Fresh-organisation human smoke (QA-NEW-ORG-001).
4. CookieWorks hosted isolation smoke (ISO-01..05) as a hostile-tenant check.
5. Legal documents do not exist yet — that is a **legal/commercial** P1
   before accepting real money, not an application-code gap.

### Remaining P0/P1 **operator** blockers (before a controlled first customer)

See [FIRST-CUSTOMER-CUTOVER-CHECKLIST.md](./FIRST-CUSTOMER-CUTOVER-CHECKLIST.md).
Headline:

- Confirm hosted migration parity through `20261007143820`
- Publish an approved application SHA to Netlify
- Configure Stripe **Sandbox** products, webhook, Customer Portal, env
- Run QA-NEW-ORG-001 on that pair
- Password recovery / invitation Auth templates + Send Email Hook revision
- Supabase Pro + leaked-password protection
- Terms / Privacy / DPA / retention wording
- Stripe **LIVE** cutover only after Sandbox smoke PASS, before real money

---

## CURRENT NON-BLOCKING BACKLOG

| Item | Severity | Recommendation |
| --- | --- | --- |
| #235 LEH Lite | P3 / product | Keep open as backlog. Do not implement now |
| Domain-based “existing organisation” onboarding hint (#219 AC11) | P3 / privacy-sensitive | **#264** `ONBOARD-SAFE-ORG-HINT-01`. Then close #219. Not required for first customer. No domain disclosure |
| Cross-module Manual / LeanAI / Quick Start shell | P3 | **#267** `LEANAI-MODULE-SETUP-01`. Maturity already has three modes |
| Skills catalogue authoring UI | Delivered | **#266** `SKILLS-AUTHORING-01`. Empty-org setup is in the application. Close when this change merges |
| BILLING-02 Essentials vs Professional module gating | After smoke | Catalogue + resolver exist; first customer should be Professional or Founder Pilot |
| Authenticated SECURITY DEFINER advisor volume | Deferred | Do **not** globally revoke. Invitation anon RPCs stay |
| CookieWorks P2/P3 UX register items | P2/P3 | Historical #67 register. Not first-customer blockers |
| Public product API / third-party integrations | Not v1 | Entitlement flags only |

---

## CURRENT OPERATOR ACTIONS

Human only. This PR does not perform them.

1. Confirm hosted `migration list` = 228/228 through `20261007143820`.
2. Do **not** replay `20261007143820` or any earlier version.
3. Configure Stripe Sandbox per [STRIPE-SANDBOX-ONBOARDING-SMOKE.md](./STRIPE-SANDBOX-ONBOARDING-SMOKE.md).
4. Set server-only Netlify env (`BILLING_PROVIDER=stripe`, Sandbox keys, price IDs). Never `NEXT_PUBLIC_STRIPE_*`.
5. Publish an approved SHA only after explicit approval.
6. Redeploy the hosted Auth Send Email Hook from the same revision as the app.
7. Run [QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md). Do not wipe CookieWorks.
8. Optionally record CookieWorks ISO-01..05 on the published SHA.
9. Before real money: Supabase Pro, leaked-password protection, live Stripe, legal pack.

---

## OPEN ISSUE RECONCILIATION

Do **not** close these automatically from this PR. Recommendations for the
orchestrator:

| Issue | Delivered | Outstanding | Stale wording | Recommendation |
| --- | --- | --- | --- | --- |
| **#67** CookieWorks register | Historical P0/P1 product blockers implemented; sub-issues 6/6 complete | Hosted CookieWorks isolation/persona evidence on a current SHA | Body still talks about PR #153 in flight, listing migration outstanding, `ad6edce` | **UPDATE AND KEEP OPEN** as the historical register until ISO-01..05 are recorded, then close. Not a code blocker |
| **#134** PERF-001 | Nav batch (#137/#138), suggestion count (#136), delegatable offers (#145), listing (#151). Hosted migrations applied | Hosted browser timing on Suggestions + People/Manage | “Fix PR deferred” checkboxes | **CLOSE** after noting remaining hosted timing in the smoke protocol. No further speculative optimisation |
| **#170** BILLING-001 | Sub-issues #172–#175 closed. Application foundation + fake E2E complete | Hosted Stripe Sandbox smoke; live cutover; legal | Issue reads as unimplemented programme | **SPLIT remaining work into operator smoke / LIVE-CUTOVER** (this issue #263 + cutover checklist). Then **CLOSE** the code umbrella |
| **#183** LEANAI-CONTEXT-001 | Coach foundation + #206–#210 Maturity/onboarding slices in code | Cross-module three-mode shell (P3) | Body still says “complete the fresh-organisation smoke before starting these enhancements” | **CLOSE**. Remaining cross-module setup is P3 backlog, not this programme |
| **#195** LEANAI-CONTEXT-04 | PRs #196/#197 delivered general Coach sessions, Explain, routing, fallback, usage, `store:false`, PS compatibility | None in the issue acceptance | Issue never commented after merge | **CLOSE** |
| **#219** MULTISITE-EXPAND-01 | AC 1–10 and 12. Slices 01A–01D closed | AC11 domain hint **not implemented** and **not required** for v1 | Parent still open with 4/4 children complete | **CLOSE** — remaining AC11 is **#264** |
| **#235** LEH Lite | None (intentionally) | Entire starter product | None — correctly backlog | **BACKLOG ONLY**. Keep open. Do not implement |
| **#263** this reconciliation | This document pack | Orchestrator review, Fast CI, later Ready + Full Regression | n/a | Keep open until the gate is accepted |

#194 (billing provider identifiers on member RPCs) is **already closed** via
PR #238 / `20261005113608`. Older current-state prose that listed it as
outstanding is obsolete.

---

## #219 ACCEPTANCE MATRIX

| # | Criterion | Status | Evidence |
| --- | ---: | --- | --- |
| 1 | Founder onboarding distinguishes organisation vs first site | **COMPLETE** | `founding-organisation-form.tsx`; E2E `first-customer-rollout.spec.ts`, `billing-founding-onboarding.spec.ts` |
| 2 | One-site billing still works | **COMPLETE** | Quantity 1 founding E2E; capacity guard |
| 3 | Multiple active sites under one tenant | **COMPLETE** | `first-customer-rollout.spec.ts` Plymouth → Bristol |
| 4 | Billing quantity maps to subscribed capacity | **COMPLETE** | `site-capacity.ts`; Settings “N of M”; pgTAP |
| 5 | Adding a site cannot bypass purchased capacity | **COMPLETE** | DB trigger + `SITE_CAPACITY_EXHAUSTED`; `site-capacity.spec.ts` |
| 6 | Site-scoped users isolated unless granted | **COMPLETE** | `site_security_boundary.test.sql`; CookieWorks hostile E2E |
| 7 | Organisation-wide users can be granted cross-site access | **COMPLETE** | `scope_type = organisation`; rollout grant flow |
| 8 | Pilot-site history survives expansion | **COMPLETE** | Expansion does not recreate tenant; E2E keeps first site |
| 9 | Shared org-level standards reusable across sites | **COMPLETE for first customer** (Maturity proven; other domains already follow the taxonomy) | `shared-standards-and-site-execution.md`; Maturity E2E |
| 10 | Ownership can evolve without tenant recreation | **COMPLETE** | `20261007143820`; `organisation-ownership-transfer.spec.ts` |
| 11 | Safe onboarding warning about possible existing org membership | **NOT IMPLEMENTED** | No domain discovery. Signup still requires invitation to join. **Not required for first customer.** Privacy-sensitive; split later. Do not implement generic org discovery |
| 12 | No generic tenant-merging in v1 | **COMPLETE** (by design) | No merge APIs |

**Can #219 close without AC11?** Yes. Invitation remains the join path.
AC11 is a duplicate-signup reduction enhancement, not a release blocker.

---

## #170 BILLING MATRIX

Separate **code**, **operator configuration**, and **legal/commercial**.

| Capability | Class | Status |
| --- | --- | --- |
| Billing account | CODE | Implemented |
| Subscription state | CODE | Implemented |
| Stripe provider abstraction | CODE | Implemented |
| Fake provider | CODE | Implemented; CI/local must set `BILLING_PROVIDER=fake` explicitly |
| Stripe Sandbox path | CODE + OPERATOR | App rejects `sk_live`. Products/prices/webhook/env are operator |
| Checkout | CODE + OPERATOR | Coded; Sandbox price IDs required |
| Webhook signing / idempotency | CODE + OPERATOR | `claim_billing_webhook_event`; `whsec` is operator |
| Customer Portal | CODE + OPERATOR | Session creation coded; Portal features are Stripe Dashboard config |
| Period-end cancellation | CODE | pgTAP + unit |
| Grace / suspension | CODE | 7-day grace; fail-closed access |
| Reactivation | CODE | Restores `active` without deleting tenant data |
| Plan / site quantity | CODE + LEGAL/COMMERCIAL | Catalogue coded; £ prices are commercial hypotheses |
| First-site onboarding | CODE | Implemented |
| Site-capacity increase | CODE | 01B monotonic claim |
| Lifecycle gates | CODE | provisioning / active / suspended |
| Hosted Sandbox end-to-end | OPERATOR | **Outstanding** |
| Professional empty-org full module smoke | OPERATOR | **Outstanding** (runbook exists) |
| Live Stripe objects | OPERATOR | Later LIVE-CUTOVER |
| VAT / tax | LEGAL/COMMERCIAL | Not decided in code |
| Terms / Privacy / DPA / retention wording | LEGAL/COMMERCIAL | Documents do **not** exist |
| Founder Pilot commercial agreement | LEGAL/COMMERCIAL | Catalogue supports private founder prices; commercial offer is operator |

Application acceptance in #170 is met **except** the hosted Sandbox /
clean-tenant human smoke, which were never in the code slices.

---

## #183 / #195 LEANAI STATUS

|#195 checklist | In code? |
| --- | --- |
| General Coach sessions (not dummy PS cases) | Yes — `ai_sessions.context_type = coach` |
| Explicit Explain | Yes — user-triggered only |
| Logical tiers economy / standard / deep | Yes — `src/platform/ai/model-routing.ts` |
| `AI_ENABLED=0` deterministic fallback | Yes |
| Permission / organisation / site context | Yes |
| Token accounting / `ai_usage_events` | Yes |
| `store:false` | Yes |
| Problem Solving backward compatible | Yes — `create_ai_session` unchanged |
| No model call on render | Yes |
| Bounded follow-up (6 turns) | Yes |
| `create_ai_coach_session` INVOKER, `search_path=''`, authenticated only | Yes |

|#183 follow-ons | In code? |
| --- | --- |
| #206 structure-first onboarding | Yes |
| #207 three-mode module setup | **Maturity only.** Cross-module shell remains P3 |
| #208 conversational Maturity builder | Yes |
| #209 Quick Start template | Yes |
| #210 simplify Maturity authoring | Yes |

**#195 can close.** **#183 can close** as the contextual Coach programme;
do not keep it open for P3 cross-module setup.

---

## #134 PERFORMANCE STATUS

Original hotspots and what landed:

| Hotspot | Fix | Result |
| --- | --- | --- |
| ~18× `member_has_permission` nav probes | #137 / #138 `member_has_permissions` batch + request store | Shell permission RPC fan-out removed |
| `get_delegatable_access_offers` O(roles × units) | #145 set-based rewrite | Local CookieWorks 16-unit owner ~1.9s → tens of ms (historical profile) |
| Suggestions triple scan | #136 drop redundant head count; #151 listing RPC | Hosted `20260925160321` applied |
| Full admin profile for sidebar label | Covered by later shell work; not reopened here | — |
| Settings invitation grants | Filtered to pending IDs in #145 | — |

Last issue comment (2026-09-28): no additional code work indicated; keep
open only for hosted/browser acceptance.

This audit did **not** mutate hosted CookieWorks. No checked-in PERF
harness exists. Local re-profile is not required to close the code issue.
Remaining hosted timing belongs on the smoke protocol as P2 evidence, not
as a reason to start speculative optimisation.

**Recommendation: CLOSE #134.**

---

## SECURITY REVIEW (read-only)

This audit did not globally revoke authenticated EXECUTE and did not query
the hosted Security Advisor.

| Surface | Finding |
| --- | --- |
| Anonymous RPC execute | Production `GRANT EXECUTE TO anon` remains the **intentional** invitation pair: `preview_organisation_invitation`, `prepare_organisation_invitation_signup_binding` (token digest, not org ids). Coach, billing, ownership, LeanAI revoke anon |
| SECURITY DEFINER since Coach-04 | Public INVOKER wrappers over private DEFINER helpers with `search_path=''` is the dominant pattern. `claim_site_quantity_increase` is a new public DEFINER, billing-manage gated, authenticated only |
| `search_path` | Post-`20260930` DEFINER creates inspected in this audit set `search_path=''` |
| Tenant isolation | pgTAP `tenant_isolation.test.sql`, Coach cross-org cases, billing foreign-id denial |
| Site isolation | `site_security_boundary.test.sql`; CookieWorks two-site hostile E2E |
| Billing provider data | #194 closed. Members get `has_open_checkout` boolean only. Managers with `billing.manage` see provider ids |
| Account enumeration | Recover always redirects `?sent=true` with “If an eligible account exists…” copy. Login failures generic |
| Password reset | GET `/auth/recovery` stages cookie and does **not** consume OTP. POST continues. Rate limited |
| Ownership transfer | Owner-only, same-org active members, advisory locks, anon denied |
| Invitation flow | Anon preview by digest; authenticated accept |

**No new exploitable issue found that warrants a dedicated security
ticket.** Remaining advisor volume on authenticated DEFINER functions is
the known deferred audit, not a mass-revoke candidate.

---

## CURRENT RELEASE SCORECARD

| Area | Code | Automated | Hosted / human | First-customer blocker? |
| --- | --- | --- | --- | --- |
| Authentication | PASS | PASS | Final smoke + Auth template/hook verify | Operator before live |
| Password recovery | PASS | PASS | Hosted email path | Operator before live |
| Tenant isolation | PASS | PASS | Final hostile smoke | Hosted evidence, not missing code |
| Site isolation | PASS | PASS | CookieWorks ISO-01..05 | Hosted evidence |
| RBAC / invitations | PASS | PASS | Invite + accept on fresh org | No (code) |
| Billing Sandbox | PASS | PASS (fake) | Hosted Sandbox rehearsal | **Yes before live money**; not a code rebuild |
| Billing live | N/A | N/A | LIVE-CUTOVER | **Yes before real money** |
| Founder onboarding | PASS | PASS | Fresh-org smoke | No (code) |
| Structure / people | PASS | PASS | Fresh-org smoke | No |
| Maturity | PASS | PASS | Fresh-org smoke | No |
| 5S | PASS | PASS | Fresh-org smoke | No |
| Gemba | PASS | PASS | Fresh-org smoke | No |
| Scheduling | PASS | PASS | Fresh-org smoke | No |
| Suggestions | PASS | PASS | Fresh-org smoke | No |
| Actions | PASS | PASS | Fresh-org smoke | No |
| Problem Solving | PASS | PASS | Fresh-org smoke | No |
| Projects | PASS | PASS | Fresh-org smoke | No |
| Benefits | PASS | PASS | Fresh-org smoke | No |
| Training | PASS | PASS | Fresh-org smoke | No |
| Skills | PASS | Empty-org authoring E2E + existing consume/assess | Fresh-org smoke should follow the updated step 20 | No |
| Recognition | PASS | PASS | Fresh-org smoke | No |
| LeanAI Coach | PASS | PASS | Hosted Explain with real or fake provider | No (code) |
| Multi-site capacity / increase | PASS | PASS | Fresh-org steps 25–28 | No (code) |
| Ownership transfer | PASS | PASS (PR head); post-merge flake candidate | Fresh-org step 29 | No (code) |
| Mobile shell | PASS | PASS | Phone viewport sanity | No |
| Performance (PERF-001) | PASS | pgTAP/CI | Hosted timing optional P2 | No |
| Legal pages | MISSING | n/a | Must exist before real money | **Legal P1** |
| LEH Lite / SSO / merge | BACKLOG | n/a | n/a | No |

---

## FINAL RECOMMENDATION

**A. Is LEH feature-complete enough for a first controlled customer?**

Yes, **as a controlled Professional (or Founder Pilot) customer after
operator cutover**, not because tests are green and not as an unbounded
self-serve public launch. The operational product on `main` covers the
first-customer modules. What remains is hosted proof, operator
configuration, legal, and live billing.

**B. Remaining P0/P1 CODE blockers?**

None identified. Do not start LEH Lite, SSO, tenant merge, or another
substantial feature before the fresh-organisation smoke.

**C. Remaining OPERATOR blockers?**

Hosted migration confirmation, approved Netlify publish, Stripe Sandbox
rehearsal, QA-NEW-ORG-001, Auth email hook/templates, then — before real
money — Supabase Pro, leaked-password protection, legal pack, Stripe LIVE.

**D. Stale issues that can close?**

#195, #183, #134, and #219 (after splitting AC11). #170 can close as a
**code** umbrella once the orchestrator agrees remaining work is operator
cutover tracked by #263. #67 stays until CookieWorks ISO evidence is
recorded. #235 stays backlog.

**E. Exact next implementation task?**

**No product slice.** Next work is operator: publish + Sandbox +
QA-NEW-ORG-001.

The only optional **code** follow-up is Playwright stability for
`organisation-ownership-transfer.spec.ts` (`ownership-complete-back` click
timed out on two consecutive `main` Full Regression platform shards after
#261; the reviewed PR head itself was green). That is CI hygiene, not a
customer workflow gap. Do not start LEH Lite, SSO, or AC11 (#264).

**F. When to run the final human fresh-organisation smoke?**

After:

1. hosted ledger confirmed through `20261007143820`
2. an approved SHA is published (or a Deploy Preview explicitly chosen)
3. Stripe Sandbox products, webhook, and server env are set
4. Fast CI is green on that SHA and Full Regression on `main`/`a183ff6` (or
   the published SHA) is green

Do **not** run it from this documentation PR. Do **not** wipe CookieWorks.

**G. What must happen before accepting real money?**

Sandbox smoke PASS, then LIVE-CUTOVER: live Stripe products/webhook/portal,
a low-risk live payment test, cancellation/refund process, Supabase Pro,
leaked-password protection, Terms/Privacy/DPA/retention, pricing/Founder
Pilot agreement, support owner, rollback/incident procedures.

---

## Where to go next

| Need | Document |
| --- | --- |
| Fresh-org executable checklist | [QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md) |
| Stripe Sandbox configuration | [STRIPE-SANDBOX-ONBOARDING-SMOKE.md](./STRIPE-SANDBOX-ONBOARDING-SMOKE.md) |
| CookieWorks isolation regression | [RELEASE-SMOKE-01-protocol.md](./RELEASE-SMOKE-01-protocol.md) |
| First real customer cutover | [FIRST-CUSTOMER-CUTOVER-CHECKLIST.md](./FIRST-CUSTOMER-CUTOVER-CHECKLIST.md) |
| Historical CookieWorks register | [RELEASE-SMOKE-01-register.md](./RELEASE-SMOKE-01-register.md) |
| Pricing decision | [../product/pricing-subscription-onboarding-v1.md](../product/pricing-subscription-onboarding-v1.md) |
