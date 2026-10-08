# RELEASE-SMOKE-01 — CookieWorks isolation / persona protocol

Secondary hosted checklist for **CookieWorks Manufacturing** (Bodmin + Exeter).

The **primary** first-customer release test is a brand-new organisation:

[QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md)

Use this CookieWorks pack to record **hostile two-site isolation** and
persona evidence on a published SHA. It does **not** replace the fresh-org
journey and it does **not** need to finish before Sandbox onboarding work.

Canonical current-state: [PROJECT-CURRENT-STATE.md](./PROJECT-CURRENT-STATE.md).
Cutover: [FIRST-CUSTOMER-CUTOVER-CHECKLIST.md](./FIRST-CUSTOMER-CUTOVER-CHECKLIST.md).
Historical finding register: [RELEASE-SMOKE-01-register.md](./RELEASE-SMOKE-01-register.md)
(stale SHA/migration rows — do not treat that file as the current gate).

Personas: `docs/development/qa-tenant.md`.
Isolation contract: `docs/qa/cookieworks-two-site-smoke-runbook.md`.

**Do not** run a hosted destructive reset, apply or replay migrations, send
invitation email, publish Netlify, or change Auth/billing while executing
this pack from an implementation or docs PR.

Current `main` at the 2026-10-08 preflight:
`90286dd3b6fdb4bcf5e40e03c6f025fe5881805d`.
The FIRST-CUSTOMER-READINESS-02 audit SHA
`a183ff6b5257636b01110693fd046788147ea882` is historical.

---

## 0. Preconditions

| Check | Pass if |
| --- | --- |
| Hosted app | Sign-in at the intended URL responds. Record the SHA if the deployment UI shows it. Public HTML does not expose the git SHA |
| Hosted DB | Latest applied migration on the 2026-10-08 read-only check is `20261008072255_create_module_setup_drafts_from_definition` (or later only if that later file is on the published SHA). **Do not replay.** Coach-04 `20260930103004`, ownership `20261007143820`, and the retired filename `20261007224043` stay historical |
| CookieWorks foundation | 1 org, 2 site roots, 16 units, 8 personas, 8 role grants, 3 job functions, 4 placements |
| Module data | Foundation-only **or** a recorded existing-smoke dataset (do not wipe without approval) |
| Credentials | Hosted disposable passwords — **not** the local `docs/development/qa-tenant.md` values unless this is local |
| Billing on CookieWorks | CookieWorks is a legacy unmetered QA tenant. Do not run Stripe Checkout against it. Do not reset it to “test billing” |

Local compiled-production (safe):

```bash
npm run db:start:ci
npm run db:reset
eval "$(npx supabase status -o env)"
export CI=1 E2E_WITH_SUPABASE=1 LEANHUB_ALLOW_QA_TENANT=1
export APP_ORIGIN=http://127.0.0.1:3000
export AUTH_RATE_LIMIT_PEPPER="playwright-only-pepper-that-is-at-least-32-characters"
export AI_ENABLED=1 AI_PROVIDER=fake AI_ALLOW_FAKE_PROVIDER=1
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"
export SUPABASE_SECRET_KEY="$SERVICE_ROLE_KEY"
export CREDENTIAL_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
npx playwright test tests/e2e/cookieworks-ci-loop.spec.ts tests/e2e/cookieworks-two-site-hostile.spec.ts --workers=1
```

Each CookieWorks spec performs its own `qa:cookie:reset` (CW-RESET-001 / #155).

---

## 1. Persona and permissions matrix

Scope: **Org** = whole CookieWorks; **Bodmin Ops** = Operations subtree;
**Exeter Ops** = Exeter Operations subtree; **Self** = own membership.

| Persona | Email key | Scope | Typical smoke jobs | Must not |
| --- | --- | --- | --- | --- |
| **Admin** | `admin` | Org owner | Structure, People, site switcher, Auth/settings, Lean AI settings, ownership transfer UI | None within tenant; still cannot see other tenants |
| **CI Manager** | `ciManager` | Org | Maturity/5S/Gemba authoring, Suggestions programme/category setup, projects, benefits (CI), training/skills catalog, PS create/facilitate, Lean AI use | Not site-locked; still cannot cross tenant boundaries |
| **Bodmin PM** | `productionManager` | Bodmin Ops | 5S/Gemba execute, schedules, suggestion review, actions, projects, PS | Enumerate/manage Exeter units |
| **Exeter PM** | `exeterProductionManager` | Exeter Ops | Same as Bodmin PM on Exeter | Enumerate/manage Bodmin operational units |
| **Team Leader** | `teamLeader` | Bodmin Ops | 5S audit, Gemba walk, complete schedules, claim/review suggestions, recognition read | Programme admin, publish frameworks, finance validate |
| **Operator** | `operator` | Self (Packing) | Submit suggestion (+ optional evidence), self-assess, perform assigned 5S/Gemba, view own training/skills | Admin routes, other-site data, award recognition, create projects |
| **Assessor** | `assessor` | Org | Formal maturity review (Lead Assessor) | Configure frameworks, finance, CI project manage |
| **Finance** | `finance` | Org | Benefits finance validation / realisation | Unrelated admin modules |

CI Manager **has** `suggestions.programmes.manage` (CW-CI-MGR-001 / #156).
Operator and Finance do not.

Active-site switcher: **Admin** and **CI Manager** use it to disambiguate
duplicate unit names (Packing × 2). Security remains RLS/RPC. The switcher
is UX context only.

---

## 2. Result, evidence, and stop rules

Record each step as **PASS / FAIL / BLOCKED / PRODUCT GAP**.

**Evidence (every FAIL or stop):**

- URL + persona + active site
- Screenshot of the control and the resulting record (business reference, not raw UUID)
- Browser console errors / network 4xx–5xx on the failing action
- Time and approximate hosted SHA if known

**Error checks on every page:**

- No unexpected `console.error` / page crash
- No raw UUID as the primary user-visible label (people, project owner, team)
- Forbidden routes hide or 403 — they do not leak the other site’s records
- Refresh retains the created record

### Release-stopping conditions (pause immediately)

Stop and file a **new** P0/P1 issue if any of these occur on hosted CookieWorks:

1. Cross-site or cross-tenant data visible or writable (Bodmin PM sees Exeter units/records, or the reverse).
2. Privilege escalation (Operator reaches admin/config; Finance reaches unrelated admin).
3. A create action yields an **unusable** record (cannot open, edit, or progress it).
4. Publish/submit succeeds while server-side readiness should have blocked it.
5. Silent data loss after save/refresh in authoring or completed visual evidence (5S question, Gemba section/summary, Maturity question, image preview).
6. A published Maturity framework version changes in place, or draft Review shows the old published structure as if it were the draft.
7. A completed Gemba walk stays on `?prompt=` or loses its summary after reload.
8. Authentication lockout / session corruption affecting multiple personas.
9. Hosted app 5xx so the pack cannot run.

P2/P3 (slow pages, information architecture, mobile form overflow, dark-mode
select contrast): **log and continue**. PERF-001 code is already merged;
hosted slowness is P2 evidence, not a reason to reopen optimisation.

Do not file a P0/P1 because an older GitHub issue still says OPEN.

---

## 3. Ordered hosted checklist

Run in this order. Do not skip isolation because demo E2E passed.

Billing, founder checkout, site-quantity increase, and ownership transfer
on a **new** organisation belong in QA-NEW-ORG-001, not here.

### A. Organisation / People / isolation

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| ISO-01 | Bodmin PM | `/platform/settings/structure` | Bodmin tree only; **no** “Exeter Cookie Factory” |
| ISO-02 | Exeter PM | Same | Exeter tree only; **no** Bodmin factory |
| ISO-03 | CI Manager | Same | Both site roots |
| ISO-04 | Admin | Attempt reparent Exeter unit under Bodmin | Rejected |
| ISO-05 | Admin | Site switcher Bodmin → Exeter → All sites | Selectors follow site; All-sites warns/gates execution modules |
| ORG-01 | Admin | Structure CRUD on a **new disposable** Bodmin child: create, rename, move, archive, reactivate | Persists after refresh |
| PPL-01 | Admin | `/platform/settings/people` load + **5× hard refresh** | Page stable; invite form visible; **no 404** |
| PPL-02 | Operator | People directory / settings admin URLs | Hidden or forbidden |
| PPL-03 | Admin | People selectors (role labels, Benefits owner, Recognition recipient, project owner/team) | Human names, not membership UUIDs |

### B. 5S

Use a published Bodmin-applicable standard. Author a disposable standard first if none is suitable (draft → question → publish). Do not edit a published version in place.

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| 5S-01 | Bodmin PM or Team Leader | Start audit on a Bodmin applicable unit | Audit workspace opens for that unit only |
| 5S-02 | Same | Record answers and at least one finding | Answers and finding text persist |
| 5S-03 | Same | Attach an image | Image appears in the visual evidence gallery |
| 5S-04 | Same | Complete the audit | Completed state; score/result visible |
| 5S-05 | Same | Reload the completed audit | Image evidence and result still visible |
| 5S-06 | Exeter PM | With a Bodmin-only standard | Cannot execute on an Exeter unit |

### C. Gemba

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| GEM-01 | Team Leader | Start a walk, leave it in progress on a specific prompt, then resume from overview/history | Prompt-scoped walk resumes; URL may include `?prompt=` while in progress |
| GEM-02 | Same | Add an observation and an image on a prompt | Observation text and image gallery visible before completion |
| GEM-03 | Same | Complete the walk | Summary visible. URL is the canonical walk path **without** `?prompt=` |
| GEM-04 | Same | Reload the completed walk | Summary, observation, and image survive. `?prompt=` does not return |

### D. Maturity

If a published CookieWorks framework already exists, create a **successor draft**. Do not mutate the published version in place.

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| MAT-01 | CI Manager | Open the published version | Structure is read-only. Published preview is separate from the draft editor |
| MAT-02 | CI Manager | Create a successor draft | New draft version; published version unchanged |
| MAT-03 | CI Manager | Move a question onto another criterion (structural move) | Question appears under the destination pillar/criterion. Published preview does not gain it |
| MAT-04 | CI Manager | Open draft **Review** | Preview groups questions in the **new** hierarchy. Old published structure stays in the published disclosure |
| MAT-05 | Operator | Self assessment on Bodmin: score, complete | Completes without an official published result |
| MAT-06 | Assessor (Lead Assessor) | Formal assessment: answer, comment, image evidence, submit | Status Submitted. Lead Assessor name is human-readable |
| MAT-07 | Assessor | Begin assessor review. Change score, comment, and evidence | Edits save during review |
| MAT-08 | Assessor | Create a contextual action from the assessment | Action opens. Actions list filtered by this assessment shows it |
| MAT-09 | Assessor | Return for correction | Submitter can edit again |
| MAT-10 | Assessor or submitter | Resubmit | Returns to Submitted |
| MAT-11 | Assessor | Approve, then publish official result | Published. Scores lock. Official result is recorded |
| MAT-12 | Operator | Framework configuration URLs | Cannot configure or publish frameworks |

### E. Suggestions → Actions → Projects → Benefits

Foundation may have **no** programmes. Configure once, then run the loop. Preserve lineage across reload.

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| SUG-01 | **CI Manager** | Programmes: New programme (auto-code) → Publish; New category | Operator can submit. Operator and Finance cannot manage programmes |
| SUG-02 | Operator | New suggestion, optional evidence, submit | Detail URL; evidence accessible after reload |
| SUG-03 | Team Leader | Unassigned queue → claim → begin → approve | Status Accepted; no UUID-primary labels |
| SUG-04 | Bodmin PM | Implementation → Create action → **Open action** | Action workspace; start → complete; history after refresh |
| SUG-05 | Bodmin PM | Implementation → Create project | Lands on project workspace with `PROJ-…` reference. Owner and team show **names** |
| SUG-06 | Bodmin PM | Suggestion Activity | “Open action” and “Open project” links still resolve after reload |
| PRJ-01 | Bodmin PM | Draft charter: edit fields, assign team owner, pick published methodology | Fields persist; Submit disabled until ready; then submit succeeds |
| BEN-01 | CI Manager / Bodmin PM | Benefit **from project**. Global New benefit uses the project selector | Inherited site/unit; owner names not UUIDs. Benefit still linked after reload |
| BEN-02 | Finance | Validation queue for the submitted benefit | Approve/reject recorded; no unrelated admin |
| BEN-03 | Exeter PM | Open the Bodmin project/benefit | Not a writable Bodmin record |

### F. Training / Skills / Recognition

Validate the current administration and normal-user journeys. Do not expand scope.

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| TRN-01 | CI Manager / Admin | Catalogue: draft course → publish | Appears in the catalogue. Operator cannot manage courses |
| TRN-02 | CI Manager | Curricula: requirements with named course / job function / unit → publish | Published version immutable; successor if a change is required |
| TRN-03 | Operator | Own training view | Sees assigned/published training. Cannot open catalogue admin |
| SKL-01 | CI Manager | Skill + scale; PM records an operator assessment | Matrix updates and survives reload. CookieWorks may already have a framework — assess the existing one. A brand-new organisation authors the framework in Skills (QA-NEW-ORG-001 step 20) |
| REC-01 | Bodmin PM or Team Leader if permitted | Award operator | Recipient picker shows a name. Operator sees the award and cannot award others |

### G. Lean AI

Validate current functionality only. Do not expand Lean AI scope.

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| AI-01 | Admin | Settings: usage summary is human-readable (runs, tokens, tool calls). Empty state if none | Operator cannot open AI settings |
| AI-02 | CI Manager | On one Problem Solving case, use Lean AI in **that case’s** context | Proposals stay on the case. No other-tenant or other-site leakage |
| AI-03 | CI Manager or Admin | Contextual Coach on a platform page: deterministic card renders; **Explain** is explicit | No model call on render. Fallback if AI disabled |

Scheduling (recurring 5S/Gemba occurrence, Exeter unit absent from the Bodmin picker) may be logged if time remains. It is not required to call this isolation checklist complete.

PERF-PPL / PERF-SUG (optional P2): note whether People/settings and Suggestions feel acceptable on hosted. Do not start optimisation from a feeling.

---

## 4. Coverage vs automation

| Area | Automated on current `main` | Human still required |
| --- | --- | --- |
| Two-site structure isolation | Full Regression `cookieworks` shard: `cookieworks-ci-loop.spec.ts`, `cookieworks-two-site-hostile.spec.ts` | ISO-04 reparent on hosted |
| 5S/Gemba execution site context | `cookieworks-execution-site-context.spec.ts` (platform shard) | Hosted image evidence on a completed 5S audit |
| Gemba prompt completion | `gemba-journeys.spec.ts` | Hosted CookieWorks persona |
| Suggestion → action → project loop | `cookieworks-ci-loop.spec.ts`; improvement shard lineage specs | Hosted evidence upload, charter, finance validation |
| Maturity authoring, draft Review, formal assessor loop | `maturity-journeys.spec.ts` | Hosted CookieWorks official result on the successor draft |
| People settings reload | `people-settings-reload.spec.ts` | Hosted 5× refresh as Admin |
| Training catalogue and curriculum | `training-course-authoring.spec.ts`, `training-curriculum-authoring.spec.ts` | One hosted admin pass (TRN-01, TRN-02) |
| Lean AI Coach / PS | `leanai-coach.spec.ts`, `leanai-coach-explain.spec.ts`, `milestone12-closure.spec.ts` | AI-01..03 on hosted if AI is entitled |
| Founding / billing / rollout / ownership | `billing-founding-onboarding.spec.ts`, `first-customer-rollout.spec.ts`, `organisation-ownership-transfer.spec.ts` | **QA-NEW-ORG-001 on hosted Sandbox** — not this CookieWorks pack |
| Demo module happy paths | platform / workforce / improvement / ai-closure shards | Do **not** treat an Apex demo PASS as a CookieWorks PASS |

`cookieworks-maturity-smoke.spec.ts` remains a local MAT0 smoke and is outside the CI duration budget.
