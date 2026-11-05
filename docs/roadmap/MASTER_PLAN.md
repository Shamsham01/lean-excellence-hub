# LEH master plan (R0–R6)

Living roadmap aligned to **open GitHub issues** and `docs/knowledge/`. P0 reliability work (#324–#326, PR #327) is owned by **separate Cursor implementation workstreams** — this document coordinates, does not duplicate their PRs.

**Legend:** **Gate** = must pass before phase exit. **Human approval** = platform owner explicit sign-off.

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

### Acceptance criteria

- Notification delivery ledger reconciles for test org; schedule exports valid ICS in E2E.

### Gates

- Cross-site isolation re-verified (CookieWorks protocol).

### Human approval

Owner approves sustainment content for customer-facing use.

---

## R4 — Cross-module intelligence

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

### Acceptance criteria

- Clean-org onboarding with chosen plan completes in staging with fake/sandbox billing.
- Legal/privacy artifacts linked from `/demo` before public booking URL enabled.

### Gates

- R0 complete; no open P0/P1 billing security issues.
- Fail-closed deploy without Stripe secrets verified.

### Human approval

Founder commercial launch + live billing enablement.

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
