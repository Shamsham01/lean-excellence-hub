# Lean Excellence Hub — Current Project and Release State

Updated: **2026-10-08**. Tracking:
[#274](https://github.com/Shamsham01/lean-excellence-hub/issues/274).
Canonical detail:
[QA-NEW-ORG-001-PREFLIGHT-REPORT.md](./QA-NEW-ORG-001-PREFLIGHT-REPORT.md).

This is the release-state entry point. Reconcile GitHub checks, `main`, and
the hosted Supabase migration ledger immediately before any deploy. The
figures below are a dated audit, not an automatic publication authorisation.

The 2026-10-07 FIRST-CUSTOMER-READINESS-02 snapshot (`a183ff6`, 228 files,
latest `20261007143820`) is historical. Do not use it as the current gate.
Later sections that still quote that snapshot are labelled as that audit.

Do **not** use older snapshots in this folder as current gates:

- 30 September Coach-04 checkpoint
- 29 September FIRST-CUSTOMER-READINESS-01 (`ad6edce` / `4ae04302`)
- 7 October FIRST-CUSTOMER-READINESS-02 (`a183ff6` / `20261007143820`)
- CookieWorks register wording that still says billing is unimplemented
- Retired filename `20261007224043_create_module_setup_drafts_from_definition`

---

## CURRENT MAIN

| Item | Value |
| --- | --- |
| Git `main` audited | `90286dd3b6fdb4bcf5e40e03c6f025fe5881805d` |
| Tip commit | `chore: reconcile module setup migration ledger timestamp (#273)` |
| Audit date | 2026-10-08 |
| Open pull requests | None |
| Production published SHA | **Unverified.** `https://leanexcellencehub.com` is not an approved publication of this tip |

Since the historical `a183ff6` snapshot, `main` has added Skills empty-organisation authoring (#269), the Skills ledger reconciliation (#270), guided 5S and Gemba setup (#272), and the module-setup ledger reconciliation (#273). #271 is closed. #267 stays open for later modules and is P3.

Historical context still true of this tip, from work merged before that snapshot:

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

Read-only hosted ledger query on **2026-10-08** against
`zsadfvjtknbbfomlmttv` (`eu-west-1`). This audit did not apply or replay
migrations.

| Item | Value |
| --- | --- |
| Repository migration files | **230** SQL files |
| Hosted `schema_migrations` rows | **230** |
| Latest version and name | `20261008072255` / `create_module_setup_drafts_from_definition` |
| Source vs hosted | Versions and names match. Both intentional `multi_site_intent` rows (`20261006150528` and `20261006165240`) are preserved. No pending or divergent rows |
| Retired filename | `20261007224043_create_module_setup_drafts_from_definition` was reconciled to `20261008072255` in #273. Do not recreate it |
| Coach-04 | `20260930103004_leanai_general_coach_sessions`. **Do not replay** |
| Ownership transfer | `20261007143820_organisation_ownership_transfer`. **Do not replay** |
| CookieWorks | Preserve. Do not reset for first-customer smoke |

Operator dry-run immediately before smoke, even though this audit already matched 230/230:

```bash
npx supabase link --project-ref zsadfvjtknbbfomlmttv
npx supabase migration list
```

Expect latest remote version `20261008072255` / name
`create_module_setup_drafts_from_definition` and **no pending files**. If
anything is pending, stop and get an explicit apply approval. Never use a
tool that generates an untracked replacement timestamp.

---

## CURRENT PRODUCT CAPABILITIES

Classifications are from **code and tests on `90286dd`**, not from issue
titles. Rows that only quote the 2026-10-07 audit are still accurate unless
the 2026-10-08 preflight report says otherwise.

| Area | Classification | Evidence (short) |
| --- | --- | --- |
| Organisation / tenant model | **IMPLEMENTED** | Founding RPC, org selection, structure v2 E2E + pgTAP |
| Sites / multi-site | **IMPLEMENTED** | Site context switcher, site-boundary pgTAP/E2E, CookieWorks two-site hostile |
| Billing application foundation | **IMPLEMENTED / NEEDS HUMAN HOSTED SMOKE** | Fake provider E2E + pgTAP lifecycle. Stripe Sandbox path coded; hosted payment not proven by this audit |
| Founder onboarding | **IMPLEMENTED** | Signup → create org/site → plan/checkout → structure-first setup |
| People / invitations | **IMPLEMENTED** | Invite lifecycle, role picker, workforce provision, CSV/XLSX import |
| RBAC | **IMPLEMENTED** | Versioned roles, org vs unit-subtree grants, batched permission probes |
| Maturity | **IMPLEMENTED** | Authoring, Self/Formal, Quick Start, AI builder |
| 5S | **IMPLEMENTED** | Standards, audits, evidence, journeys E2E. Guided setup (Manual / Quick Start / LeanAI) creates an editable organisation-owned draft and does not publish |
| Gemba | **IMPLEMENTED** | Definitions, walks, completion URL rules. Guided setup follows the same draft-only pattern |
| Suggestions | **IMPLEMENTED** | Programmes, submit+evidence, reviewer workflow |
| Actions | **IMPLEMENTED** | Lifecycle + lineage |
| Problem Solving | **IMPLEMENTED** | Cases + backward-compatible case-bound AI |
| Projects | **IMPLEMENTED** | Charter lifecycle, methodologies, site scope |
| Benefits | **IMPLEMENTED** | Forecast/realisation/validation queue |
| Training | **IMPLEMENTED** | Catalogue, curriculum, sessions, matrix |
| Skills | **IMPLEMENTED** | Empty organisation can publish a proficiency scale, create skills, publish a skills standard against existing job functions, and record a validated assessment that the matrix keeps. The database rejects levels and requirements on any version that is not a draft, and it rejects an incomplete publish. Saved rows still cannot be edited in place, and there is no successor-version RPC yet. Matrix uses the latest published skills standard |
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
| `main` `90286dd` Full Regression | [run #37745078910](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/37745078910) **success** on the exact tip. Quality, Database core, Database gate, E2E smoke, E2E platform, E2E workforce, E2E improvement, E2E cookieworks, E2E ai-closure, QA hosted replacement, and Windows QA harness succeeded. Prepare quality gate was skipped because this was a `main` push, not a pull request |
| `main` `244c18b` (#272) Full Regression | [run #37743261305](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/37743261305) failed E2E platform on `platform-reliability.spec.ts` Gemba Next/Previous (180s click timeout, destination-stream closures). The following ledger-only commit `90286dd` passed the same suite. Treat as CI flake history, not an open product defect |
| Historical `a183ff6` Full Regression | [run #37640294086](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/37640294086) failed the ownership-transfer back-click. Superseded. The ownership E2E passed on `90286dd` and again in the 2026-10-08 local rehearsal |

Do **not** call `90286dd` an operator-approved published SHA merely because
exact-head CI is green.

These first-customer specs are **not** in the Full Regression matrix. The
2026-10-08 local production rehearsal ran them: `onboarding-setup.spec.ts`,
`first-customer-rollout.spec.ts`, `module-setup-5s-gemba.spec.ts`,
`skills-authoring-empty-org.spec.ts`. Billing, site capacity, ownership
transfer, and password recovery are in the matrix and were also re-run
locally.

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

- Confirm hosted migration parity through `20261008072255` (230/230). This audit already matched that ledger read-only; reconfirm immediately before publish
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

1. Confirm hosted `migration list` = 230/230 through `20261008072255`.
2. Do **not** replay `20261008072255` or any earlier version.
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

The 2026-10-07 review did not globally revoke authenticated EXECUTE. The
2026-10-08 preflight **did** query the hosted Security Advisor read-only.
Findings and the decision not to revoke invitation or `rls_auto_enable`
permissions are in
[QA-NEW-ORG-001-PREFLIGHT-REPORT.md](./QA-NEW-ORG-001-PREFLIGHT-REPORT.md).
The notes below remain the code-review record from the earlier audit.

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

Reconfirm hosted migration parity immediately before publish (230/230 through
`20261008072255` matched read-only on 2026-10-08), approved Netlify publish,
Stripe Sandbox rehearsal, QA-NEW-ORG-001, Auth email hook/templates, then —
before real money — Supabase Pro, leaked-password protection, legal pack,
Stripe LIVE.

**D. Stale issues that can close?**

#195, #183, #134, and #219 (after splitting AC11). #170 can close as a
**code** umbrella once the orchestrator agrees remaining work is operator
cutover tracked by #263. #67 stays until CookieWorks ISO evidence is
recorded. #235 stays backlog.

**E. Exact next implementation task?**

**No product slice.** Next work is operator: publish + Sandbox +
QA-NEW-ORG-001.

The ownership-transfer click timeout recorded against historical `a183ff6`
did not reproduce on exact-head Full Regression `90286dd` or in the
2026-10-08 local rehearsal. A Gemba RSC click timeout on `244c18b` also
passed on the next exact-head run. Those are CI hygiene history, not a
customer workflow gap. Do not start LEH Lite, SSO, AC11 (#264), or
LEANAI-MODULE-SETUP-01B.

**F. When to run the final human fresh-organisation smoke?**

After:

1. hosted ledger confirmed through `20261008072255` (matched read-only on 2026-10-08; reconfirm if `main` moves)
2. an approved SHA is published (or a Deploy Preview explicitly chosen)
3. Stripe Sandbox products, webhook, and server env are set
4. Fast CI is green on that SHA and Full Regression on `main`/`90286dd` (or
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
| 2026-10-08 preflight evidence | [QA-NEW-ORG-001-PREFLIGHT-REPORT.md](./QA-NEW-ORG-001-PREFLIGHT-REPORT.md) |
| Fresh-org executable checklist | [QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md) |
| Stripe Sandbox configuration | [STRIPE-SANDBOX-ONBOARDING-SMOKE.md](./STRIPE-SANDBOX-ONBOARDING-SMOKE.md) |
| CookieWorks isolation regression | [RELEASE-SMOKE-01-protocol.md](./RELEASE-SMOKE-01-protocol.md) |
| First real customer cutover | [FIRST-CUSTOMER-CUTOVER-CHECKLIST.md](./FIRST-CUSTOMER-CUTOVER-CHECKLIST.md) |
| Historical CookieWorks register | [RELEASE-SMOKE-01-register.md](./RELEASE-SMOKE-01-register.md) |
| Pricing decision | [../product/pricing-subscription-onboarding-v1.md](../product/pricing-subscription-onboarding-v1.md) |
