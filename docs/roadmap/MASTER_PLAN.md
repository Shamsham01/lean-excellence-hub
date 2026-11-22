# LEH master plan (R0–R6)

Living roadmap aligned to **open GitHub issues** and `docs/knowledge/`. P0 reliability work (#324–#326, PR #327) is owned by **separate Cursor implementation workstreams** — this document coordinates, does not duplicate their PRs.

**Legend:** **Gate** = must pass before phase exit. **Human approval** = platform owner explicit sign-off. **Pilot** = required for founder pilot cohort; **Post-pilot** = after first 1–3 month early-supporter tranche.

---

## Pilot programme (founder direction)

**Horizon:** **1–3 months** to first pilot cohort on production (after Pilot Readiness cut line below).

**Cohort shape (choose one per tranche):**

| Option | Shape |
| --- | --- |
| **A** | **One organisation with 5+ sites**, plus **one additional organisation** (any site count) |
| **B** | **~5 single-site organisations** |

Early supporters receive commercial privileges via the [Early Supporter Programme](#e66-early-supporter-programme-post-pilot-enrolment-pilot-commitments) (R6 / LAUNCH).

### Pilot win criteria

Founder-visible outcomes for the cohort:

1. **Fast full setup from templates** — new org/site teams reach usable module configuration quickly (Quick Start / template paths), gaining momentum without bespoke implementation.
2. **AI Problem Solving → actions and results** — facilitated cases lead to **meaningful accepted actions** and measurable movement (countermeasures, owners, dates), not chat-only engagement.
3. **Integrated Assessments, Audits, and Gemba Walks** — digital workflows **replace spreadsheet trackers** for the pilot scope: structured execution, **photos/evidence**, **notifications**, and **action management** (including auto-created actions where the product supports them today).
4. **LeanAI action stewardship (human-in-the-loop)** — LeanAI **oversees** open actions: follow-ups, requests for data/evidence/clarification, **proposed** suggestions and next steps; **every record change** remains **human-approved** (no autonomous verify/close/benefit/RBAC writes; aligned with `docs/architecture/leanai-superpowers.md`).

### Pilot Readiness cut line (R0–R3)

Everything **not listed here** is **post-pilot** unless the founder explicitly pulls it forward. R4–R6 remain post-pilot except Early Supporter **commitments** captured under R6.

| # | Phase | Milestone | Ship for pilot | Acceptance criteria (pilot) |
| --- | --- | --- | --- | --- |
| P1 | R0 | **E0.1** Problem Solving activation (#324) | **Yes** | Pinned/unpinned draft → Active on seeded method; sessions start on Active; smoke on published SHA |
| P2 | R0 | **E0.2** Facilitator run settlement (#326, PR #327, ADR-0019) | **Yes** | Turns terminal within budget; no orphaned `running` rows under test; composer retains idempotency on uncertain completion |
| P3 | R0 | **E0.3** Skills AI contract (#325) | **Yes** | Skills builder completes discovery/proposal without `invalid_response` on pilot smoke scenarios |
| P4 | R0 | **E0.4** Deploy & migration truth | **Yes** | Runbook records Netlify SHA ↔ Supabase migration head before each pilot release |
| P5 | R0 | **E0.5** Preview vs prod DB policy | **Yes** | Written policy: previews use non-prod Supabase **or** previews disabled; no unreviewed preview writes to production |
| P6 | R0 | **E0.6** Human smoke | **Yes** | `docs/qa/QA-NEW-ORG-001-runbook.md` (or successor) passed on pilot release SHA |
| P7 | R1 | **E1.1** Template / Quick Start setup (pilot modules) | **Yes** | Maturity, Gemba, 5S, Skills (and Problem Solving manual path) setup to **published** usable state in **≤1 working session** per module on a fresh org (founder timed smoke) |
| P8 | R1 | **E1.2** Invitation / signup (#292) | **Yes** | Pilot invitees complete signup without dead-end confirmation |
| P9 | R1 | **E1.3** Onboarding org hint (#264) | **Yes** | Safe hint behaviour; no tenant enumeration |
| P10 | R1 | **E1.5** LeanAI composer UX (#318) | **Stretch** | Multiline + safe Markdown if ready; not a pilot blocker if S0–S1 facilitator usable |
| P11 | R1 | **E1.4** CookieWorks register (#67) | **Post-pilot** | Internal QA only |
| P12 | R2 | **S0** Guardrails | **Yes** | Forbidden proposals rejected; source labels on claims; 8D/DMAIC honesty |
| P13 | R2 | **S1** Intelligent capture | **Yes** | Win criterion (2): brief + typed proposals + visible gaps → human accept |
| P14 | R2 | **S2** Method-fit rules | **Yes** | Recommendations only onto `five_why`, `a3_structured`, `rapid_rca` |
| P15 | R2 | **S3** Facilitation anti-patterns (core) | **Yes** | Leading/circular/reverse-engineered detection on pilot facilitator fixtures |
| P16 | R2 | **S4** Falsifiable verification | **Post-pilot** | Supported/testing discipline continues; full S4 P0 canvas set not required for pilot entry |
| P17 | R2 | **S5** 12-week sustainability + SLT pack | **Post-pilot** | Pilot may use manual sustainment; R2 S5 before SLT-grade closure reporting |
| P18 | R2 | Parallel **#316** usage surfaces | **Post-pilot** | Internal cost governance can follow pilot |
| P19 | R3 | **E3.1** Notifications reliability | **Yes** | Win criterion (3): assessment/audit/gemba events notify assignees; delivery ledger reconciles on test org |
| P20 | R3 | **E3.P** Field execution: Assessments, Audits, Gemba | **Yes** | Win criterion (3): pilot sites run end-to-end walks/assessments/audits in LEH with **photos/evidence**, **actions** (create/assign/complete), replacing spreadsheet tracker for pilot scope |
| P21 | R3 | **E3.P** LeanAI action stewardship | **Yes** | Win criterion (4): LeanAI proposes follow-ups, evidence requests, and next steps on **existing** actions; humans approve all writes; no autonomous action completion |
| P22 | R3 | **E3.2** Schedules & ICS | **Post-pilot** | Unless pilot site requires ICS for gemba/audit cadence — pull forward only by founder exception |
| P23 | R3 | **E3.3** Sustainment execution (12-week product loop) | **Post-pilot** | After R2 S5; pilot uses weekly checks manually if needed |
| P24 | R3 | **E3.4** Similarity & suggestions (#312) | **Post-pilot** | Optional demo; not required for pilot win |

**Pilot entry gate:** P1–P9, P12–P15, P19–P21 green on the **same published SHA**; P5 documented; founder signs cohort option A or B.

**Explicitly post-pilot (non-exhaustive):** R2 S4–S5 full canvas P0, R4 cross-module intelligence (#314 learning graph, vector search), R5 premium UX programme, R6 production billing & public GTM (#170, #283 live booking), LEH Lite (#235), platform owner console (#303), native 8D/DMAIC method records.

---

## R0 — Production reliability

**Goal:** Trustworthy production behaviour, deploy/migration alignment, honest AI run settlement, preview/prod safety.

**Owning agent:** PULSE (coordination ATLAS)

### Epics

| Epic | Milestones | Dependencies | Issues / PRs |
| --- | --- | --- | --- |
| E0.1 Problem Solving activation | RPC state machine + migration; pinned draft UX; pgTAP + E2E | SENTINEL review | #324 |
| E0.2 Facilitator run settlement | `maxRetries: 0`, budget race, stale recovery, composer keys | NEXUS implementation | #326, PR #327 |
| E0.3 Skills AI contract | Schema↔Zod trace; safe reason codes; regression tests | TALENT domain | #325 |
| E0.4 Deploy & migration truth | Record Netlify SHA ↔ Supabase migration head on every release | VERIFY smoke | #326 notes, `docs/qa/PROJECT-CURRENT-STATE.md` |
| E0.5 Preview vs prod DB | Document env strategy; separate preview Supabase or block writes | FORGE ADR supplement | **Open question** (knowledge index) |
| E0.6 Human smoke | QA-NEW-ORG + facilitator + Skills paths on published SHA | LAUNCH later billing optional | `docs/qa/QA-NEW-ORG-001-runbook.md` |

**Pilot:** E0.1–E0.6 required (see [Pilot Readiness](#pilot-readiness-cut-line-r0r3) P1–P6).

### Acceptance criteria (measurable)

- Zero known P0 issues (#324–#326) open with verified fix on **deployed** SHA.
- 100% of new facilitator turns reach `completed` or `failed` within 65s session-scoped recovery window under synthetic slow-provider tests (PR #327 suite).
- Hosted migration head matches migration files at deployed SHA (read-only verification checklist signed).
- Preview deployments either use non-production Supabase or are disabled until policy documented.

### Security / reliability gates

- Database CI + Full Regression green on merge PRs touching code.
- No hosted data mutation without owner-approved runbook row list.
- ADR-0019 behaviour deployed or explicitly waived with incident acceptance.

### Human approval gate

Owner deploy to Netlify + optional hosted migration + smoke sign-off.

---

## R1 — Functional readiness

**Goal:** Core modules usable end-to-end for a clean org without P0 dead ends.

**Owning agent:** VERIFY + module owners (FORGE coordination)

### Epics

| Epic | Milestones | Issues |
| --- | --- | --- |
| E1.1 Module setup shell beyond Maturity | LeanAI/manual/quick start parity | #267 |
| E1.2 Invitation / signup edge cases | Confirmation consumption fix | #292 |
| E1.3 Onboarding safety | Org hint without tenant leak | #264 |
| E1.4 CookieWorks register | Close or defer items in #67 | #67 |
| E1.5 LeanAI chat UX baseline | Multiline composer, safe Markdown | #318 |

**Pilot:** E1.1–E1.3 required; E1.5 stretch; E1.4 post-pilot (P7–P11).

### Acceptance criteria

- QA-NEW-ORG runbook passes on published SHA without manual DB repair.
- No P1 dead-end flows in Problem Solving, Skills, Maturity setup on fresh org.

### Gates

- Full Regression E2E shards green; no new P0 security advisor findings unmitigated.

### Human approval

Owner marks R1 complete after smoke + product review backlog triage (`docs/PRODUCT_REVIEW_BACKLOG.md`).

---

## R2 — LeanAI problem solving MVP

**Goal:** Practitioner-grade Problem Solving facilitation: honest capture, method fit on **seeded** methods, anti-pattern coaching, falsifiable verification, and a default **12-week sustainability** design for SLT-ready closure — without autonomous domain writes.

**Owning agent:** KAIZEN (domain) + NEXUS (runtime) + VERIFY (acceptance)

**Authoritative requirements (KAIZEN):** [R2 Problem Solving LeanAI Facilitator — Canvas](https://cursor.com/canvas/store-8ca2b392-604f-4ea5-a5c7-8b1614a999ad/8fbe9136-37f1-4d3a-b8c4-ffde7dfebdc0)

**Grounding:** [`docs/architecture/leanai-superpowers.md`](../architecture/leanai-superpowers.md) (capability matrix, forbidden proposals, seeded methods, retrieval rules). Programme context: [#310](https://github.com/Shamsham01/lean-excellence-hub/issues/310) (superpowers platform). **Out of R2:** organisational learning graph / proactive OpEx advice in [#314](https://github.com/Shamsham01/lean-excellence-hub/issues/314) — after facilitation honesty and retrieval boundaries are proven.

**Release hygiene (not a substitute for S0–S5):** R0 must close activation (#324), run settlement (#326, PR #327, ADR-0019), and Skills contract (#325) before R2 slices ship to production.

**Pilot:** S0–S3 required; S4–S5 post-pilot (P12–P17).

### Build order (slices)

Ship in order. **S0 gates every R2 change** (prompt, tool, UI, knowledge bundle).

| Slice | Name | Intent | Smallest valuable outcome |
| --- | --- | --- | --- |
| **S0** | Guardrails | Human authority + honest labels + method-record truth | Every R2 PR passes S0 acceptance; no regression on forbidden writes |
| **S1** | Intelligent capture | 5W1H, baseline, scope, target as **typed proposals** with **visible gaps** | One-sentence complaint → draft brief + gap list; accept/decline per field |
| **S2** | Method-fit rules | Recommend onto `five_why`, `a3_structured`, `rapid_rca` only | Falsifiable rule table + fixtures; 8D/DMAIC = methodology rec only |
| **S3** | Facilitation anti-patterns | Honest questioning and cause language | Detect leading/circular/reverse-engineered chains; observation ≠ hypothesis ≠ verified |
| **S4** | Falsifiable verification | Test design before “supported” | **Supported ≠ verified**; verify only via human `verify_cause` |
| **S5** | Sustainability + SLT pack | Default **12 weekly observations**; closure checklist | 12-week plan proposals; SLT draft with **forecast ≠ validation** |

#### S0 — Guardrails (release gates on every R2 change)

- LeanAI **never** verifies a cause, closes a case, records effectiveness pass, or approves a benefit — proposals only; person accepts via existing RPCs (aligned with superpowers forbidden types).
- Every factual/causal claim carries a **source class**: verified LEH product fact · current authorised site fact · historical verified outcome · unverified user statement · Lean methodology recommendation · AI hypothesis.
- Historical closed-case matches are **evidence about that case only**, never proof for the open problem (`historical_verified_outcome` framing).
- **Seeded methods today:** `five_why`, `a3_structured`, `rapid_rca`. **8D / DMAIC** may be recommended for **methodology fit** but must **not** be presented as selectable method records until seeded.

#### S1 — Intelligent capture (first feature slice)

- Complete minimal problem brief: 5W1H, measurable baseline, in/out scope, target condition — **fewest turns** with **gaps explicit** (no invented numbers).
- Prefer **structured proposals** (title, statement, baseline, scope, target) over chat essays; no silent overwrite of confirmed fields.
- Long narrative: extract candidate facts; confirm ambiguities only.
- Baseline and target share a metric family, or agree an **observation definition** instead of a fake KPI.
- Related-work search after enough text: **non-blocking**, empty = no hidden-match language (superpowers retrieval rules).

#### S2 — Method-fit rules

- Explicit, falsifiable rules; default bias = **smallest method** matching risk and recurrence; user override recorded as **user choice**, not AI decision.
- **five_why:** local, linear, containable, speed over documentation depth.
- **rapid_rca:** urgent multi-factor disruption; containment before deep cause work.
- **a3_structured:** cross-functional / recurring after simpler attempts; shared storyboard need.
- **8D / DMAIC fit:** labelled **Lean methodology recommendation**; map to nearest seeded method + **product gap** note until native records exist.
- Never recommend a method because the user **solution-shopped** first (countermeasure before problem definition).

#### S3 — Facilitation anti-patterns

- Modes: Facilitate · Challenge · Review · Ask (existing session modes).
- One primary question per turn in Facilitate; Challenge stress-tests before accepting chains.
- Detect and rewrite/refuse: **leading questions**, **circular 5 Whys**, **causes reverse-engineered from countermeasures**, solution-first language.
- Strict language: **observation · hypothesis · verified**; operator/human error not accepted as verified root without system conditions.

#### S4 — Falsifiable verification

- Hypothesis → testing requires a **falsifiable test** (true/false predictions, where/when, observer, pass/fail).
- **Supported is not verified**; verified only after human `verify_cause` with evidence recorded.
- Prefer go-and-see / before-after / controlled compare over meeting consensus.
- Review mode: discriminating tests when multiple hypotheses are open.

#### S5 — Default 12-week sustainability + SLT pack

- Default **12 weekly observations** of the improved standard (framework override allowed, labelled).
- Weekly check = pass / finding / **missed** (no record = missed, not pass).
- SLT closure pack: brief, method, verified or explicitly unresolved cause path, countermeasures with owners/dates, **benefit forecast vs validation separate**, 12-week result.
- No invented financial savings; competence not inferred from training completion alone.

### Parallel tracks (not slice replacements)

| Track | Owner | Notes |
| --- | --- | --- |
| Facilitator SLO / run lifecycle | NEXUS | #326 closed, ADR-0019 + PR #327 on deployed SHA |
| Activation / session UX | PIXEL + SENTINEL | #324 — pinned draft method honesty |
| Customer usage surfaces | LAUNCH / NEXUS | #316 |
| Release-matched PS knowledge bundle | NEXUS | #311 extends superpowers first slice |

### Out of R2 MVP

- Seeding native **8D** and **DMAIC** problem-solving **method records** (product seeding work; facilitator recommends fit only until then).
- [#314](https://github.com/Shamsham01/lean-excellence-hub/issues/314) **organisational learning graph** and proactive OpEx prompts.
- Semantic / **pgvector** search; cross-customer benchmarks.
- **Autonomous** verify, close, benefit validation, or RBAC changes.
- Inferring competence from training completion alone.

### Acceptance criteria (R2 exit)

- Canvas requirements **S0-1 through S5-3** (P0 rows) satisfied with linked tests or scripted facilitator fixtures (VERIFY sign-off).
- S0 checklist attached to every merged R2 PR.
- S1 shipped and demo-able on fresh org: capture → typed proposals → human accept without invented metrics.
- No facilitator turn completes forbidden proposal types; `PROMPT_VERSION` bumped when behaviour changes.
- R0 reliability gates still met (no stuck `running` runs beyond session recovery window).

### Security / reliability gates

- S0 forbidden-write regression tests green on every R2 PR.
- Historical search and facilitator tools remain caller-scoped; no cross-org leakage (SENTINEL).
- Full Regression when R2 PRs touch orchestrator, prompts, or RPCs.

### Human approval gate

KAIZEN + owner sign-off on facilitator behaviour against the Canvas P0 set; LAUNCH may label “demo-ready” only after S1 + S0 on published SHA.

---

## R3 — Collaborative execution & 12-week sustainment

**Goal:** Teams execute actions, schedules, and sustainment loops in product.

**Owning agent:** CONNECT + KAIZEN

### Epics

| Epic | Milestones | Issues |
| --- | --- | --- |
| E3.1 Notifications reliability | Outbox/delivery worker hardening | ADR-0016 runbooks |
| E3.2 Schedules & ICS | Lifecycle completeness | `docs/architecture/schedule-lifecycle.md` |
| E3.3 Sustainment execution | Schedules/actions for 12-week checks in product (R2 S5 designs the plan) | KAIZEN + CONNECT |
| E3.4 Similarity & suggestions | Permission-safe related items | #312 |
| E3.P Field execution (Assessments, Audits, Gemba) | Photos, notifications, action lifecycle replacing spreadsheets for pilot scope | Maturity, 5S, Gemba modules + shared actions |
| E3.P LeanAI action stewardship | Follow-ups, evidence/clarification requests, proposed suggestions — human approves all writes | LeanAI + actions/RPCs; superpowers guardrails |

**Pilot:** E3.1 + E3.P required; E3.2–E3.4 post-pilot unless founder exception (P19–P24).

### Acceptance criteria

- Notification delivery ledger reconciles for test org; schedule exports valid ICS in E2E.

### Gates

- Cross-site isolation re-verified (CookieWorks protocol).

### Human approval

Owner approves sustainment content for customer-facing use.

---

## R4 — Cross-module intelligence

**Post-pilot** (after pilot win criteria validated; #314 not in pilot scope).

**Goal:** Secure retrieval and advisory LeanAI across LEH data.

**Owning agent:** NEXUS + SENTINEL

### Epics (mostly **Proposed**)

| Epic | Issues |
| --- | --- |
| E4.1 Superpowers platform | #310 |
| E4.2 Operational knowledge search | #313 |
| E4.3 Evidence-based advisory | #314 |
| E4.4 Retrieval hardening | Threat model updates |

### Acceptance criteria

- Permission-safe retrieval proven by adversarial tests; no cross-org leakage in pgTAP/security review.

### Gates

- SENTINEL sign-off on any new anon/authenticated RPC or vector store.

### Human approval

Owner approves expanded AI data scopes per org.

---

## R5 — Premium UX

**Post-pilot** (pilot uses current UX; targeted fixes only if P0/P1 blockers).

**Goal:** LEH premium design system applied consistently; accessibility wins.

**Owning agent:** PIXEL

### Epics

| Epic | Milestones | Issues |
| --- | --- | --- |
| E5.1 Design system adoption | Component audit vs LEH premium skill | `.cursor/skills/leh-premium-design/` |
| E5.2 Accessibility | WCAG-oriented fixes on core flows | #318 |
| E5.3 Mobile platform UX | Touch-first module workspaces | marketing + platform |

### Acceptance criteria

- Defined critical path flows meet agreed a11y checklist (VERIFY + PIXEL).

### Human approval

Owner design sign-off on marketing + platform chrome.

---

## R6 — Commercial launch

**Post-pilot** for full commercial launch; **Early Supporter Programme** commitments apply during pilot.

**Goal:** SaaS onboarding, billing, demo funnel, legal readiness.

**Owning agent:** LAUNCH

### Epics

| Epic | Milestones | Issues |
| --- | --- | --- |
| E6.1 Billing production | Stripe sandbox → production readiness | #170, ADR-0017 |
| E6.2 LEH Lite path | Suggestions-first land-expand | #235 |
| E6.3 Demo booking & privacy | Cal.com + notice | #283, `docs/sales/*` |
| E6.4 Platform owner console | Cross-org ops dashboard | #303 |
| E6.5 Provider & AI commercial | OpenAI policy review per ADR-0013 | LAUNCH checklist |
| E6.6 Early Supporter Programme | Privileges for pilot cohort + future early adopters | Founder direction (this doc) |

#### E6.6 Early Supporter Programme (post-pilot enrolment; pilot commitments)

**Intent:** Reward organisations that join during the **1–3 month pilot tranche** (cohort shape A or B) with durable commercial privileges as LEH scales.

**Placeholder entitlements** (exact SKUs / plan flags TBD in billing ADR-0017 follow-on):

| Entitlement | Description |
| --- | --- |
| **Early access** | Preview features behind flags for Early Supporter orgs before general availability |
| **Premium products** | Included or discounted access to designated premium modules or capacity tiers (**placeholder** — define with `#170` / plan entitlements) |
| **Pilot voice** | Structured feedback channel into roadmap (no SLA on feature delivery) |

**Pilot cohort:** Founder selects option A or B; LAUNCH records org ids and start date in internal roster (not customer-facing marketing until privacy/legal ready).

**Acceptance (programme ops):**

- Written entitlement list approved by founder before first pilot org invite.
- No Stripe live charges until E6.1 complete; pilot may run on **manual / sandbox / unmetered** arrangement documented per org.

### Acceptance criteria

- Clean-org onboarding with chosen plan completes in staging with fake/sandbox billing.
- Legal/privacy artifacts linked from `/demo` before public booking URL enabled.

### Gates

- R0 complete; no open P0/P1 billing security issues.
- Fail-closed deploy without Stripe secrets verified.
- Pilot Readiness cut line (R0–R3) met before Early Supporter go-live.

### Human approval

Founder commercial launch + live billing enablement; founder approves Early Supporter roster and entitlements placeholder before cohort invites.

---

## Issue map (avoid duplicate epics)

| Issue | Phase | Notes |
| --- | --- | --- |
| #324, #325, #326 | R0 | Active implementation workstreams |
| #327 | R0 | Merge/deploy decision by owner |
| #318 | R1 / R5 | LeanAI UX |
| #316 | R2 | Usage governance (parallel track) |
| #311, #310 | R2 / R4 | Knowledge bundle & superpowers programme |
| #314 | R4 (not R2) | Learning graph — after R2 S0–S4 proven |
| #267 | R1 | Module setup |
| #292, #264 | R1 | Onboarding |
| #170, #235, #283, #303 | R6 | Commercial |
| #67 | R1 | Legacy smoke register |

---

## Agent ownership summary

| Phase | Primary | Supporting |
| --- | --- | --- |
| R0 | PULSE | NEXUS, SENTINEL, VERIFY, TALENT, PIXEL |
| R1 | VERIFY | FORGE, module agents |
| R2 | NEXUS | KAIZEN, TALENT |
| R3 | CONNECT | KAIZEN, VERIFY |
| R4 | NEXUS | SENTINEL, FORGE |
| R5 | PIXEL | VERIFY |
| R6 | LAUNCH | SENTINEL, VERIFY |

**ATLAS** orchestrates; **KAIZEN** live for OpEx language; others activated on demand per [agents/README.md](../../agents/README.md).
