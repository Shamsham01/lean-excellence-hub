# RELEASE-SMOKE-01 — CookieWorks master register (reconciled)

Canonical GitHub tracker: **[#67](https://github.com/Shamsham01/lean-excellence-hub/issues/67)**.
This file is the repository snapshot for **FIRST-CUSTOMER-READINESS-01**, reconciled against current `main` on 2026-09-29.

Companion files:

- Protocol / remaining human smoke: `docs/qa/RELEASE-SMOKE-01-protocol.md`
- Go-live and billing boundary: `docs/qa/RELEASE-SMOKE-01-go-live.md`

Do **not** reopen items below that are `VERIFIED` or `IMPLEMENTED` from older issue text that still says `OPEN` or `NEEDS HOSTED RETEST`. Hosted human smoke of the current protocol is still outstanding as evidence. It is not a product-code defect and it does not block billing/onboarding development.

Baseline (read-only inspection 2026-09-29):

| Item | Value |
| --- | --- |
| Code `main` | `ad6edcec5972fba6a9c5d51a0bc9ee8bedcedd98` — `fix(maturity): preview draft hierarchy during framework review (#168)` |
| Confirmed on `main` | #153 CookieWorks smoke/reset, #156 CI Manager programme permission, #158 project owner/team names, #161 Gemba completion + shared evidence, #166 maturity structural authoring / assessor review / action lineage, #168 draft Review hierarchy. Also previously merged: #142 training catalogue, #144 training curriculum, #150 SEC-RPC-001, #151 suggestion listing. |
| Hosted DB (read-only `list_migrations`) | Project `zsadfvjtknbbfomlmttv` (`ACTIVE_HEALTHY`). Latest applied = `20260928210635_maturity_assessor_review_and_action_lineage`. Includes `20260928210634_maturity_framework_structural_authoring`, `20260925160321_perf_suggestion_listing`, and `20260925122602_sec_rpc_001_anon_execute_and_search_path`. **Nothing later is committed. Do not replay.** |
| Production app | `https://leanexcellencehub.com` returned **HTTP 200** (`server: Netlify`, `x-powered-by: Next.js`) on 2026-09-29. Exact git SHA is **not** in public headers. Operator exercise of the recent Maturity authoring changes is the production behaviour evidence for MAT-UX-003. Do not publish from this reconciliation. |
| CookieWorks tenant | Do not reset or mutate hosted fixtures from this reconciliation. |

Finding states: `OPEN`, `PROMOTED → #issue`, `IMPLEMENTED`, `VERIFIED`, `DEFERRED`, `EXPECTED`.

---

## Release decision

**READY FOR BILLING/ONBOARDING DEVELOPMENT**

**P0/P1 product-code blockers on `main`: none.**

Historical workflow blockers are implemented. Training catalogue and curriculum are merged. PERF-001 code and hosted migrations are applied. SEC-RPC-001 is applied. Supabase leaked-password protection stays a Free-plan operator action immediately before the first real customer, after the organisation upgrades to Pro. It is not a development blocker.

The remaining hosted human-smoke checklist in the protocol is evidence to record. It does not have to finish before Stripe sandbox and organisation-onboarding implementation starts.

---

## Open issue reconciliation

Classifications: `COMPLETE` (can close), `IMPLEMENTED` (hosted/human verification still useful), `DEFERRED` (does not block billing), `ACTIVE P0/P1 BLOCKER`, `P2/P3 backlog`.

Issues were **not** closed from this reconciliation. Close only the rows marked **can close**, and only after a human confirms the recommendation.

| Issue | Current reality on `main` / hosted | Classification | Recommended action |
| --- | --- | --- | --- |
| **#67** master register | Body and 2026-09-28 comments stop at `0de567a` / “listing migration outstanding” / #153 still in PR. Those statements are stale. #153, #156, and later product PRs are merged. This file replaces that snapshot. | **DEFERRED** (living register) | **Keep open.** Post this snapshot when convenient. Close only after the protocol checklist is recorded with PASS/FAIL evidence. |
| **#134** PERF-001 | Slices merged: nav batch (#137/#138), redundant suggestion count (#136), `get_delegatable_access_offers` (#145), suggestion listing (#151). Hosted `20260924111211` and `20260925160321` are applied. Last issue comment already says no further code is indicated. | **IMPLEMENTED** | **Keep open** until Suggestions and People/Manage are noted during human smoke. Not a code blocker. Do not reopen the profiling write-up. |
| **#140** Training catalogue | PR **#142** merged (`1fda646`). No migration. Workforce shard includes `training-course-authoring.spec.ts`. Issue checkboxes were never ticked after merge; the written acceptance criteria are satisfied in code and CI. | **IMPLEMENTED** | **Can close.** Hosted catalogue click-through remains TRN-01 in the protocol, not an open defect. |
| **#143** Training curriculum | PR **#144** merged (`179bb2c`). Acceptance criteria on the issue are checked. Hosted `20260923233254` applied and previously verified. Do not replay. | **COMPLETE** | **Can close.** TRN-02 in the protocol is confirmation, not a reason to keep the feature issue open. |
| **#149** SEC-RPC-001 | PR **#150** merged. Hosted `20260925122602` applied. Expected advisor baseline stands: 3 anon `SECURITY DEFINER` (invitation preview, invitation prepare, platform `rls_auto_enable`), 0 mutable `search_path`, authenticated `SECURITY DEFINER` volume deferred. Maturity migrations #166 revoke anon on the new RPCs; no new anonymous exposure was found. | **IMPLEMENTED** (code) + **DEFERRED** (leftovers) | **Can close** the implementation issue. Carry leaked-password (Pro, pre-first-real-customer) and the authenticated `SECURITY DEFINER` audit on this register. Do not globally revoke authenticated definer functions. |
| **#123** BEN-UX-003 | PR **#125** merged. Unit coverage for empty-category guidance. | **P2/P3 backlog** (done) | **Can close.** Optional hosted glance in BEN-01. |
| **#124** UX-001 sticky sidebar | PR **#126** then **#148** merged. Unit + platform-shell E2E. | **P2/P3 backlog** (done) | **Can close.** |
| **#127** SUG-UX-001 auto codes | PR **#128** merged. Protocol SUG-01 already uses generated codes. | **P2/P3 backlog** (done) | **Can close.** |
| **#129** Lean AI usage summary | PR **#130** merged. Human-readable summary; raw JSON dump removed. | **P2/P3 backlog** (done) | **Can close.** AI-01 still validates current behaviour only. |

No open issue is an **ACTIVE P0/P1 BLOCKER**.

---

## P0 — security / data integrity / release stop

| ID | Status | Evidence | Hosted |
| --- | --- | --- | --- |
| **SEC-RPC-001** | **IMPLEMENTED** | #149 / PR **#150**. Migration `20260925122602` applied hosted. Invitation bootstrap anon RPCs are intentional. Last hosted advisor reading (2026-09-28, before the maturity migrations): 3 anon definer, 0 mutable `search_path`, 261 authenticated definer, leaked-password disabled. This reconciliation did not re-query the advisor. | Do not replay. Invitation smoke remains a protocol step, not a code fix. |
| **Auth leaked-password protection** | **DEFERRED** (operator, Supabase Pro) | Free-plan HaveIBeenPwned toggle. Not an LEH code defect. Enable when the organisation upgrades to Pro, immediately before the first real customer. | Do not toggle from a docs PR. Not a billing-development blocker. |
| **Authenticated SECURITY DEFINER volume** | **DEFERRED** | Authenticated definer warnings after #150 stay deferred. Must not be globally revoked. `20260928210634` and `20260928210635` revoke `anon` on the new maturity RPCs. No new anonymous EXECUTE grant was found in those files. | Code inspection only. Advisor not re-run on 2026-09-29. |
| **Cross-site / tenant leak** | **VERIFIED locally; protocol spot-check remains** | `cookieworks-ci-loop.spec.ts`, `cookieworks-two-site-hostile.spec.ts`, `site-security-boundary.spec.ts`, `cookieworks-execution-site-context.spec.ts`. | Repeat ISO-01..05 when the human checklist is run. |

---

## P1 — architecture / core workflow

All original P1 smoke blockers are **implemented on `main`**. Do not re-file them from stale #67 wording.

| ID | Status | Implementation | Do not reopen as |
| --- | --- | --- | --- |
| ADM-ARCH-001 | **VERIFIED** | #68 / PR #69 | Missing active-site switcher |
| PEOPLE-UX-001 | **VERIFIED** | #68 / PR #69 | Raw UUID people selectors |
| BEN-UX-001 / BEN-UX-002 | **VERIFIED** | #68 / PR #69; #111 / PR #112 | Raw IDs / mixed-site unit lists |
| ROUTE-001 | **VERIFIED** locally | PR #117 | Intermittent `/settings/people` 404 unless newly reproduced |
| ACT-BLK-001 / SUG-INT-001 / SUG-INT-002 | **IMPLEMENTED** | #91 / PR #96 / #97 | Unusable actions; missing Open action/project; UUID-primary labels |
| PROJ-BLK-001 / PROJ-VAL-001 / BEN-ARCH-001 | **IMPLEMENTED** | #92 / PR #97 / #100 / #112 | Read-only charter; submit-while-incomplete; raw resource IDs |
| Project owner/team labels | **IMPLEMENTED** | PR **#158** | Raw membership UUIDs on project owner/team |
| 5S-BLK-001 / 5S-VAL-001 / GEMBA-BLK-001 / GEMBA-VAL-001 | **IMPLEMENTED** | #70 / PR #72 | Child questions/sections vanish; publish-before-ready |
| Gemba completion / evidence | **IMPLEMENTED** | PR **#161**. `gemba-journeys.spec.ts` asserts canonical completed URL without `?prompt=` and image evidence after reload. Shared `EvidenceGallery`. | Stale prompt query; lost completed image |
| MAT-BLK / MAT-ARCH / MAT-VAL / MAT-UX-004 / MAT-UX-005 | **IMPLEMENTED** | #71 / PR #109 | Duplicate position; in-place published edit; empty-criterion publish |
| Maturity structural authoring, assessor review, action lineage | **IMPLEMENTED** | PR **#166**. Migrations `20260928210634` and `20260928210635` applied hosted. `maturity-journeys.spec.ts` covers formal submit, Lead Assessor review, score edit, return for correction, resubmit, approve, publish, and assessment-linked action filters. | Silent published mutation; broken assessor loop |
| MAT-UX-003 draft Review hierarchy | **VERIFIED** (operator, 2026-09-29) | PR **#168**. Questions group under the draft hierarchy; Review shows the new version; published structure stays separate. E2E: successor review preview in `maturity-journeys.spec.ts`. | Flat or stale draft Review |

---

## P2 — UX / performance (not release-stopping)

| ID | Status | Notes |
| --- | --- | --- |
| UX-001 / NAV-UX-002 | **IMPLEMENTED** | #124 / PR #148. Recommend close #124. |
| MOBILE-001 shared chrome | **IMPLEMENTED** | PR #133 / #148. `mobile-shell-tabs.spec.ts`. |
| MOBILE-001 form overflow | **P2/P3 backlog** | Programme/benefit/admin forms. Does not block billing. |
| PERF-001 | **IMPLEMENTED** | Hosted migrations applied. #134 stays open only for a human performance note. |
| SUG-UX-001 / SUG-UX-002 | **IMPLEMENTED** | PR #128 / #147. Evidence migration `20260924190446` applied hosted. |
| BEN-UX-003 | **IMPLEMENTED** | PR #125. Recommend close #123. |
| MAT-UX-001 / MAT-UX-002 | **IMPLEMENTED** | #132 / PR #135. |
| UX-002 remainder / UX-004..008 | **P2/P3 backlog** | Information architecture. |
| UX-026 | **EXPECTED / operator** | Netlify “Powered by” badge. Production currently serves HTTP 200. |
| SCHED-REACTIVATE-001 | **P2/P3 backlog** | Reactivate not exposed. |
| THEME-SELECT-001 | **P2/P3 backlog** | Dark-mode select contrast if reproduced. |
| CW-CI-MGR-001 | **IMPLEMENTED** | #154 closed via PR **#156**. CI Manager includes `suggestions.programmes.manage`. SUG-01 uses CI Manager. Operator and Finance stay denied. |
| CW-RESET-001 | **IMPLEMENTED** | #155 closed via PR **#153**. |
| Training TRN-01 / TRN-02 | **IMPLEMENTED** | #142 / #144 merged. Curriculum migration applied hosted. Recommend close #140 and #143. |

---

## Verified / expected (do not retest as defects)

| ID | Status |
| --- | --- |
| SHELL-02 theme persistence | VERIFIED |
| ORG-01 / ORG-02 / ORG-BLK-001 / SEC-ORG-01 | VERIFIED |
| Suggestions core review (historical) | VERIFIED; protocol still walks the current loop once |
| Suggestion → Project record creation | VERIFIED; draft lifecycle implemented |
| DATA-001 missing job functions on Admin/Assessor/CI/Finance | EXPECTED seed state |
| Notification centre UI (NOTIF-UI-001) | EXPECTED product scope unless promoted |

Larger P2 information-architecture and form-overflow work already has homes. Do not open a combined “fix everything” PR before billing.
