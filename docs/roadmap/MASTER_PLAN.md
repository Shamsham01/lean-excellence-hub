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

**Goal:** Reliable facilitated problem solving as the flagship AI workflow.

**Owning agent:** NEXUS + KAIZEN

### Epics

| Epic | Milestones | Issues |
| --- | --- | --- |
| E2.1 Facilitator SLO | Turn latency/error UX; prompt versioning discipline | #326 closed, ADR-0019 live |
| E2.2 Method fidelity | Activation/session semantics; method education copy | #324, KAIZEN reviews |
| E2.3 Usage visibility | Customer-friendly usage surfaces | #316 |
| E2.4 Module knowledge (product) | Release-matched internal knowledge | #311 |

### Acceptance criteria

- Facilitator success rate &gt; agreed threshold on smoke suite (define in VERIFY runbook).
- Prompt `PROMPT_VERSION` bump process documented when behaviour changes.

### Gates

- No stuck `running` runs &gt; 5 minutes without automated or session recovery path.

### Human approval

Owner approves MVP label for sales demos (coordination with LAUNCH).

---

## R3 — Collaborative execution & 12-week sustainment

**Goal:** Teams execute actions, schedules, and sustainment loops in product.

**Owning agent:** CONNECT + KAIZEN

### Epics

| Epic | Milestones | Issues |
| --- | --- | --- |
| E3.1 Notifications reliability | Outbox/delivery worker hardening | ADR-0016 runbooks |
| E3.2 Schedules & ICS | Lifecycle completeness | `docs/architecture/schedule-lifecycle.md` |
| E3.3 Sustainment playbook | 12-week templates in product copy/training | KAIZEN **Proposed** content |
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
| #316 | R2 | Usage governance |
| #311–#314, #310 | R2 / R4 | LeanAI knowledge & intelligence |
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
