# RELEASE-SMOKE-01 — CookieWorks master register (reconciled)

Canonical GitHub tracker: **[#67](https://github.com/Shamsham01/lean-excellence-hub/issues/67)**.
This file is the repository snapshot after reconciling the register against `main` at **PR #151** (`e399f79`). PR **#151 is merged** and is part of the code release train. Hosted Supabase has **not** yet applied `20260925160321_perf_suggestion_listing`.

Do **not** reopen items below that are `VERIFIED` or `IMPLEMENTED / NEEDS HOSTED RETEST` from their original 2026-09-11 smoke wording. Hosted CookieWorks browser retest is still outstanding because production publication on the intended SHA is not confirmed.

Baseline (read-only inspection 2026-09-28):

| Item | Value |
| --- | --- |
| Code `main` | `e399f79` — `perf(suggestions): batch page permissions and set-based listing (PERF-001) (#151)` |
| Hosted DB (read-only) | Latest applied migration `20260925122602_sec_rpc_001_anon_execute_and_search_path`. Outstanding: `20260925160321_perf_suggestion_listing` |
| PR #151 | **Merged** into `main`. Preserve listing/security parity evidence; do **not** apply the hosted migration without explicit approval |
| CookieWorks tenant | Foundation-only QA tenant; do not mutate hosted without explicit approval |
| Netlify Deploy Preview | **Available** for PR #153: https://deploy-preview-153--lean-excellence-hub.netlify.app |
| Netlify production | `https://leanexcellencehub.com` returns **HTTP 200** sign-in (not 503 `usage_exceeded`). Exact production git SHA is **not** exposed in public headers/HTML. Account/credit state is **not** readable from this environment. Do not publish production. |

Finding states: `OPEN`, `PROMOTED → #issue`, `IN PR → #pr`, `IMPLEMENTED / NEEDS HOSTED RETEST`, `VERIFIED`, `DEFERRED`, `EXPECTED`.

---

## Current smoke position

**P0/P1 product-code blockers on `main`: none.**

Historical P1 workflow blockers (Actions, Projects, Benefits lineage, 5S/Gemba authoring, Maturity integrity, site context, People settings reload) are implemented with automated tests. They must not be re-filed from stale #67 body text.

Integrated **hosted** CookieWorks smoke is still the first-customer gate:

1. Confirm production publication on the intended SHA (Deploy Preview ≠ production).
2. Apply `20260925160321_perf_suggestion_listing` to hosted **only with explicit approval**, then keep app and DB paired.
3. Run `docs/qa/RELEASE-SMOKE-01-protocol.md` on CookieWorks (disposable credentials; no shared-fixture mutation unless approved).
4. Only then promote newly **reproduced** P0/P1 defects.

---

## P0 — security / data integrity / release stop

| ID | Status | Evidence | Hosted |
| --- | --- | --- | --- |
| **SEC-RPC-001** | **IMPLEMENTED / NEEDS HOSTED RETEST** | #149 / PR **#150**. Migration `20260925122602` is on `main` **and** applied hosted. Advisor now: 3 anon SECURITY DEFINER (`preview_organisation_invitation`, `prepare_organisation_invitation_signup_binding`, `rls_auto_enable`); 0 mutable `search_path`; 261 authenticated SECURITY DEFINER (deferred). | DB applied. App publication + invitation bootstrap smoke still required. |
| **Auth leaked-password protection** | **OPEN (operator Auth setting)** | Hosted Security Advisor `auth_leaked_password_protection`. Not an LEH code defect. Enable HaveIBeenPwned in hosted Auth **only with explicit approval**. Tracked on #149 deferred checklist. | Do not toggle from this PR. |
| **Cross-site / tenant leak** | **VERIFIED locally; hosted spot-check required** | `tests/e2e/cookieworks-ci-loop.spec.ts` (isolation + Exeter denial of Bodmin action/project), `cookieworks-two-site-hostile.spec.ts` (Full Regression cookieworks shard; own reset), `site-security-boundary.spec.ts`, `cookieworks-execution-site-context.spec.ts`. Historical hosted: SEC-ORG-01 VERIFIED. | Repeat ISO-01 in the protocol after publish. |

No other P0 product defects are open on `main`.

---

## P1 — architecture / core workflow

All original P1 smoke blockers are **implemented on `main`**. Status is hosted retest, not re-implementation.

| ID | Status | Implementation | Do not reopen as |
| --- | --- | --- | --- |
| ADM-ARCH-001 | **VERIFIED** (hosted 2026-09-23) + retest after publish | #68 / PR #69 | Missing active-site switcher |
| PEOPLE-UX-001 | **VERIFIED** | #68 / PR #69 | Raw UUID people selectors |
| BEN-UX-001 / BEN-UX-002 | **VERIFIED** | #68 / PR #69; #111 / PR #112 | Raw IDs / mixed-site unit lists |
| ROUTE-001 | **VERIFIED** locally (`people-settings-reload.spec.ts`, PR #117) | 404 was delegation-gate race | Intermittent `/settings/people` 404 unless newly reproduced |
| ACT-BLK-001 | **IMPLEMENTED / NEEDS HOSTED RETEST** | #91 / PR #96; `action-lifecycle.spec.ts` | “Actions created but unusable” |
| SUG-INT-001 | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR #96; Activity “Open action” | Missing action traceability |
| SUG-INT-002 | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR #96 / #97; `suggestions-nav-click.spec.ts` | Raw UUID / no Open project |
| PROJ-BLK-001 | **IMPLEMENTED / NEEDS HOSTED RETEST** | #92 / PR #97; `project-charter-benefits-lineage.spec.ts` | Read-only draft charter |
| PROJ-VAL-001 | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR #97 / #100; charter readiness gate | Submit enabled while incomplete |
| BEN-ARCH-001 | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR #97 / #112; project selector | Raw Project/Suggestion resource IDs |
| 5S-BLK-001 / 5S-VAL-001 | **IMPLEMENTED / NEEDS HOSTED RETEST** | #70 / PR #72; `five-s-gemba-authoring.spec.ts` | Child questions vanish; publish-before-ready |
| GEMBA-BLK-001 / GEMBA-VAL-001 | **IMPLEMENTED / NEEDS HOSTED RETEST** | #70 / PR #72 | Child sections vanish; publish-before-ready |
| MAT-BLK-001 / MAT-ARCH-001 / MAT-VAL-001 / MAT-UX-004 / MAT-UX-005 | **IMPLEMENTED / NEEDS HOSTED RETEST** | #71 / PR #109; `maturity-authoring-step-reload.spec.ts` | Duplicate position key; in-place published edit; empty-criterion publish |

Promoted feature slices (not smoke defects): Training catalogue **#140 / PR #142**, curriculum **#143 / PR #144** — merged, hosted migration applied, **frontend unpublished**.

---

## P2 — UX / performance (not release-stopping)

| ID | Status | Notes |
| --- | --- | --- |
| UX-001 / NAV-UX-002 | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR #126 then #148 (`ec42d8a`). `ux1-platform-shell.spec.ts`. Close #124 after hosted sticky-sidebar check. |
| MOBILE-001 shared chrome | **IMPLEMENTED / NEEDS HOSTED RETEST** | #131 / PR #133 / #148. `mobile-shell-tabs.spec.ts`. |
| MOBILE-001 form overflow | **OPEN** | Programme/benefit/admin forms — later pass. |
| PERF-001 P0 nav probes | **IMPLEMENTED** | PR #137 / #138; hosted `20260922190000` + `20260923120000`. |
| PERF-001 People offers | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR #145; hosted `20260924111211`. |
| PERF-001 Suggestions listing | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR **#151** merged (`e399f79`). Code is in the release train. Hosted migration `20260925160321_perf_suggestion_listing` is **outstanding** — apply only with explicit approval before the final hosted smoke. Listing/security parity: batch `member_has_permissions`, set-based overview/portfolio, self-read remains author-only. |
| SUG-UX-001 | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR #128. Auto-generated programme/category codes. |
| SUG-UX-002 | **IMPLEMENTED / NEEDS HOSTED RETEST** | #146 / PR #147; hosted `20260924190446`. Optional submission evidence. |
| BEN-UX-003 | **IMPLEMENTED / NEEDS HOSTED RETEST** | PR #125. |
| MAT-UX-001 / MAT-UX-002 | **IMPLEMENTED / NEEDS HOSTED RETEST** | #132 / PR #135. |
| MAT-UX-003 / 006 / 007 polish / MAT-ASSESS-UX-001 | **OPEN (feature gap)** | Not P1. |
| UX-002 remainder / UX-004..007 / UX-008 | **OPEN (P2 IA)** | Scale hierarchy + Settings/People naming. |
| UX-026 | **EXPECTED / operator** | Netlify “Powered by” badge. Production URL currently serves HTTP 200; exact SHA and account/credit state are not verified from public responses. |
| SCHED-REACTIVATE-001 | **OPEN (P2)** | Reactivate not exposed. |
| THEME-SELECT-001 | **OPEN (P2)** | Dark-mode select contrast if reproduced. |
| CW-CI-MGR-001 | **PROMOTED → #154** | CookieWorks CI Manager lacks `suggestions.programmes.manage`. Protocol uses Admin for SUG-01. P2 / role-playbook alignment — **not** a first-customer product-code blocker. Do before or after hosted smoke; not required to start hosted smoke. |
| CW-RESET-001 | **IN PR → #153** | CookieWorks module purge now retires suggestion/action history in a dependency-aware order. Local compiled-production: **11/11** (`--workers=1`, each spec resets). GitHub Fast CI and Database CI green on `960e5a8`. |

---

## Verified / expected (do not retest as defects)

| ID | Status |
| --- | --- |
| SHELL-02 theme persistence | VERIFIED |
| ORG-01 / ORG-02 / ORG-BLK-001 / SEC-ORG-01 | VERIFIED |
| Suggestions core review (demo + historical CookieWorks) | VERIFIED; re-run on current SHA after publish |
| Suggestion → Project **record creation** | VERIFIED; draft lifecycle now implemented (PROJ-BLK-001) |
| DATA-001 missing job functions on Admin/Assessor/CI/Finance | EXPECTED seed state |
| Notification centre UI (NOTIF-UI-001) | EXPECTED product scope unless promoted |

---

## Dedicated issues still open (do not duplicate)

| Issue | Disposition |
| --- | --- |
| #67 | Master register (this snapshot) |
| #124 | UX-001 — code merged via #148; close after hosted retest |
| #123 | BEN-UX-003 — merged #125; close after hosted retest |
| #127 | SUG-UX-001 — merged #128; close after hosted retest |
| #129 | Lean AI usage copy — merged #130; close after hosted retest |
| #134 | PERF-001 umbrella; listing slice merged as PR **#151**; hosted apply of `20260925160321` still required with approval |
| #140 / #143 | Training slices merged (#142 / #144); hosted DB applied; app unpublished |
| #149 | SEC-RPC-001 merged + hosted DB applied; leftover = leaked-password toggle + authenticated DEFINER volume |
| #154 | CW-CI-MGR-001 — CookieWorks CI Manager cannot manage suggestion programmes (P2; Admin workaround in SUG-01) |
| #155 | CW-RESET-001 — CookieWorks module purge; **fixed in PR #153** |

Larger remaining work (P2 IA, assessor UX, form overflow) already has homes. Do not open a combined “fix everything” PR.
