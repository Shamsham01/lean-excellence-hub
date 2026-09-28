# RELEASE-SMOKE-01 — CookieWorks human-smoke protocol

Executable first-customer pack for **CookieWorks Manufacturing** (Bodmin + Exeter).
Use this instead of restarting the historical paused Benefits wizard.

Companion files:

- Register: `docs/qa/RELEASE-SMOKE-01-register.md`
- Deploy / rollback: `docs/qa/RELEASE-SMOKE-01-go-live.md`
- Personas: `docs/development/qa-tenant.md`
- Isolation contract: `docs/qa/cookieworks-two-site-smoke-runbook.md`

**Do not** run hosted destructive reset, apply migrations, send invitation email, publish Netlify, or change Auth/billing from an implementation PR.

---

## 0. Preconditions

| Check | Pass if |
| --- | --- |
| Hosted app is the intended SHA | About/commit or Netlify deploy SHA = `main` (or explicitly recorded exception) |
| Hosted DB | `20260925122602` applied; **do not replay**. `20260925160321_perf_suggestion_listing` is **outstanding** until explicitly approved |
| CookieWorks foundation | 1 org, 2 site roots, 16 units, 8 personas, 8 role grants, 3 job functions, 4 placements |
| Module data | Foundation-only **or** a recorded existing-smoke dataset (do not wipe without approval) |
| Credentials | Hosted disposable passwords — **not** the local `docs/development/qa-tenant.md` values unless this is local |

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
# Each spec performs its own qa:cookie:reset (CW-RESET-001 / #155).
# Extra (already in the Full Regression platform shard):
#   tests/e2e/cookieworks-execution-site-context.spec.ts
```

---

## 1. Persona and permissions matrix

Scope: **Org** = whole CookieWorks; **Bodmin Ops** = Operations subtree; **Exeter Ops** = Exeter Operations subtree; **Self** = own membership.

| Persona | Email key | Scope | Typical smoke jobs | Must not |
| --- | --- | --- | --- | --- |
| **Admin** | `admin` | Org owner | Structure, People, site switcher, Auth/settings, Lean AI settings | None within tenant; still cannot see other tenants |
| **CI Manager** | `ciManager` | Org | Maturity/5S/Gemba authoring, projects, benefits (CI), training/skills catalog, PS create/facilitate, Lean AI use | Programme/category **authoring** (`suggestions.programmes.manage` is not on the CookieWorks CI Manager role — use Admin until that seed gap is closed); not site-locked |
| **Bodmin PM** | `productionManager` | Bodmin Ops | 5S/Gemba execute, schedules, suggestion review, actions, projects, PS | Enumerate/manage Exeter units |
| **Exeter PM** | `exeterProductionManager` | Exeter Ops | Same as Bodmin PM on Exeter | Enumerate/manage Bodmin operational units |
| **Team Leader** | `teamLeader` | Bodmin Ops | 5S audit, Gemba walk, complete schedules, claim/review suggestions, recognition read | Programme admin, publish frameworks, finance validate |
| **Operator** | `operator` | Self (Packing) | Submit suggestion (+ optional evidence), self-assess, perform assigned 5S/Gemba, view own training/skills | Admin routes, other-site data, award recognition, create projects |
| **Assessor** | `assessor` | Org | Formal maturity review | Configure frameworks, finance, CI project manage |
| **Finance** | `finance` | Org | Benefits finance validation / realisation | Unrelated admin modules |

Active-site switcher: **Admin** and **CI Manager** use it to disambiguate duplicate unit names (Packing × 2). Security remains RLS/RPC — the switcher is UX context only.

---

## 2. Result, evidence, and stop rules

Record each step as **PASS / FAIL / BLOCKED / PRODUCT GAP**.

**Evidence (every FAIL or stop):**

- URL + persona + active site
- Screenshot of the control and the resulting record (business reference, not raw UUID)
- Browser console errors / network 4xx–5xx on the failing action
- Time and approximate hosted SHA

**Error checks on every page:**

- No unexpected `console.error` / page crash
- No raw UUID as the primary user-visible label
- Forbidden routes hide or 403 — they do not leak the other site’s records
- Refresh retains the created record

### Release-stopping conditions (pause immediately)

Stop and file a **P0/P1** issue if any of these occur on hosted CookieWorks:

1. Cross-site or cross-tenant data visible or writable (Bodmin PM sees Exeter units/records, or the reverse).
2. Privilege escalation (Operator reaches admin/config; Finance reaches unrelated admin).
3. A create action yields an **unusable** record (cannot open, edit, or progress it).
4. Publish/submit succeeds while server-side readiness should have blocked it.
5. Silent data loss after save/refresh in authoring (5S question, Gemba section, Maturity question).
6. Authentication lockout / session corruption affecting multiple personas.
7. Hosted app 5xx / `usage_exceeded` / wrong SHA so the pack cannot run.

P2/P3 (slow, sticky-nav, IA, mobile overflow): **log and continue**.

---

## 3. Execution order

Run **ISO** first. Then **ORG/PEOPLE**. Then modules in the table. Do not skip isolation because demo E2E passed.

### A. Isolation and organisation

| ID | Persona | Action | Expected | Evidence |
| --- | --- | --- | --- | --- |
| ISO-01 | Bodmin PM | `/platform/settings/structure` | Bodmin tree only; **no** “Exeter Cookie Factory” | Screenshot of tree |
| ISO-02 | Exeter PM | Same | Exeter tree only; **no** Bodmin factory | Screenshot |
| ISO-03 | CI Manager | Same | Both site roots | Screenshot |
| ISO-04 | Admin | Attempt reparent Exeter unit under Bodmin | Rejected | Error copy |
| ISO-05 | Admin | Site switcher Bodmin → Exeter → All sites | Selectors follow site; All-sites warns/gates execution modules | Site chip + unit picker |
| ORG-01 | Admin | Structure CRUD on a **new disposable** Bodmin child: create, rename, move, archive, reactivate | Persists after refresh | Unit name in tree |
| PPL-01 | Admin | `/platform/settings/people` load + **5× hard refresh** | Page stable; invite form visible; **no 404** | Network + screenshot |
| PPL-02 | Operator | People directory / settings admin URLs | Hidden or forbidden | Screenshot |
| PPL-03 | Admin | People selectors (Benefits owner later, Recognition recipient) | Human names, not membership UUIDs | Selector open state |

### B. 5S → Gemba → Scheduling

Use **Bodmin** first, then one Exeter spot-check.

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| 5S-01 | CI Manager | 5S empty/list → new draft → add category + question → refresh | Question still present; Publish disabled until ready |
| 5S-02 | CI Manager | Publish when ready | v1 published; create-schedule link appears |
| 5S-03 | Bodmin PM or Team Leader | Start/complete audit on Bodmin applicable unit | Score saved; answers survive refresh |
| 5S-04 | Exeter PM | With Bodmin-only standard: cannot execute on Exeter unit | Empty/blocked unit picker — not a mixed list |
| GEM-01 | CI Manager | Gemba draft → section + prompt → refresh → publish | Same persistence/readiness as 5S |
| GEM-02 | Team Leader | Start walk, add observation, complete | Walk listed; resume works if left in progress |
| SCH-01 | Bodmin PM | Recurring schedule against published 5S/Gemba, Bodmin unit | Occurrences listed; Exeter unit absent from picker |
| SCH-02 | Operator or Team Leader | Complete one occurrence | Completion recorded |

### C. Maturity

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| MAT-01 | CI Manager | Create draft framework, levels, pillar, criterion, question | Save confirmation; tab/step survives refresh (`?step=`) |
| MAT-02 | CI Manager | Publish blocked while a criterion has 0 questions; publish when ready | Server-side rejection if forced; UI disabled until ready |
| MAT-03 | CI Manager | Published version not silently editable; successor draft | Historical assessments stay on published version |
| MAT-04 | CI Manager / Assessor | Formal assessment for **Bodmin**, evidence upload, submit, review, approve/publish official result | Official snapshot; Operator cannot configure |

If a **pre-existing** CookieWorks published framework is dirty, use successor-draft — do not mutate the published version in place.

### D. Suggestions → Actions → Projects → Benefits

Foundation has **no** programmes. Configure once, then run the loop.

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| SUG-01 | **Admin** (owner) | Programmes: New programme (auto-code) → Publish; New category | Operator can submit; no manual code required. CookieWorks CI Manager currently lacks `suggestions.programmes.manage` (#154). |
| SUG-02 | Operator | New suggestion, optional evidence, submit | Detail URL; evidence accessible after reload |
| SUG-03 | Team Leader | Unassigned queue → claim → begin → approve | Status Accepted; no UUID-primary labels |
| SUG-04 | Bodmin PM | Implementation → Create action → **Open action** | Action workspace; start → complete; History after refresh |
| SUG-05 | Bodmin PM | Implementation → Create project | Lands on project workspace with `PROJ-…` reference — **not** a raw UUID toast |
| SUG-06 | Bodmin PM | Suggestion Activity | “Open action” and “Open project” links |
| PRJ-01 | Bodmin PM | Draft charter: edit fields, assign team owner, pick published methodology | Fields persist; Submit disabled until ready; then submit succeeds |
| BEN-01 | CI Manager / Bodmin PM | Benefit **from project** (canonical). Global New benefit uses project selector, not resource IDs | Inherited site/unit; owner names not UUIDs |
| BEN-02 | Finance | Validation queue for submitted benefit | Approve/reject recorded; no unrelated admin |

Exeter spot-check: Exeter PM must not open the Bodmin project/benefit as a writable Bodmin record.

### E. Problem Solving, Training, Skills, Recognition, Lean AI

| ID | Persona | Action | Expected |
| --- | --- | --- | --- |
| PS-01 | Bodmin PM | Create + activate case (builtin method) | Portfolio row; owner/facilitator show **names** |
| PS-02 | Operator | Contribute only | Cannot manage/close |
| TRN-01 | CI Manager / Admin | Catalogue: draft course → publish | Appears in catalogue; Operator cannot manage |
| TRN-02 | CI Manager | Curricula: requirements with named course / job function / unit → publish | Published immutable; successor if needed |
| SKL-01 | CI Manager | Skill + scale; PM records operator assessment | Matrix updates |
| REC-01 | Bodmin PM or Team Leader if permitted | Award operator; recipient picker shows name | Operator sees award; cannot award others |
| AI-01 | Admin | Settings: enable AI if entitled; usage summary **human-readable** (not raw JSON) | Operator blocked from AI settings |
| AI-02 | CI Manager | On a PS case, Lean AI (fake/live per env) in **that case’s** context | Proposals stay on the case; no other-tenant/site leakage |

---

## 4. Coverage vs automation

| Area | Automated on CookieWorks | Human still required |
| --- | --- | --- |
| Two-site structure isolation | `cookieworks-ci-loop.spec.ts` and `cookieworks-two-site-hostile.spec.ts` (Full Regression cookieworks shard; each file resets). | ISO-04 reparent, hosted SHA |
| 5S/Gemba execution site context | `cookieworks-execution-site-context.spec.ts` | Foundation empty→publish on hosted |
| Suggestion → action → project loop | Same `cookieworks-ci-loop.spec.ts` after isolation | Evidence upload, charter complete, benefit finance |
| Maturity full MAT0 | `cookieworks-maturity-smoke.spec.ts` (local; not in CI duration budget) | Hosted official result |
| People settings reload | `people-settings-reload.spec.ts` (demo + CW delegate) | Hosted 5× refresh as Admin |
| Demo module happy paths | Full Regression platform/workforce/improvement/ai-closure | Do **not** treat Apex demo PASS as CookieWorks PASS |
