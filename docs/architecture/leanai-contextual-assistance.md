# LeanAI Contextual Assistance & Intelligent Onboarding v1

Status: **Product / architecture decision baseline**

Date: **2026-09-29**

## Purpose

LeanAI should be an active contextual coach across Lean Excellence Hub (LEH), not only a chatbot that waits for a user to ask a question.

The core experience is:

**LEH detects meaningful product state → evaluates whether help is useful → LeanAI offers a concise contextual CTA → the user decides whether to continue, review or dismiss.**

This capability should improve onboarding, setup quality, problem solving and day-to-day Lean adoption while remaining low-cost, tenant-secure and non-intrusive.

This design extends the existing LEH AI platform. It does **not** replace the current permission-aware orchestrator, provider boundary, usage ledger, source allowlist or human-approval model.

Related architecture:

- `docs/architecture/ai-platform.md`
- `docs/architecture/ai-problem-solving-facilitator.md`
- `docs/product/pricing-subscription-onboarding-v1.md`

---

## 1. Product principle

LeanAI should understand:

- who the user is allowed to act as
- which organisation/site/module is active
- the current organisation setup/readiness state
- relevant recent workflow events
- what the user is trying to accomplish
- what prerequisite or next step is missing
- what LEH can safely help with

LeanAI should then offer timely assistance such as:

> Your organisation has one site but no Maturity Framework yet.
>
> **Use LEH starter framework** · **Build one with me** · **Later**

or:

> You opened Suggestions, but no Suggestion Programme exists yet.
>
> **Set up programme** · **Explain why** · **Later**

The system should prefer **small, actionable prompts** over long AI conversations.

---

## 2. Do not send every click to an LLM

LeanAI must **not** invoke an AI model for every click, route change or UI interaction.

Instead, LEH records **semantic product events** when meaningful business/product actions occur.

Examples:

- `organisation_created`
- `site_created`
- `module_opened:maturity`
- `maturity_framework_missing`
- `maturity_framework_published`
- `suggestion_programme_created`
- `onboarding_step_skipped`
- `training_catalogue_empty`
- `problem_solving_case_created`
- `leanai_prompt_shown`
- `leanai_prompt_accepted`
- `leanai_prompt_dismissed`

Do not collect raw interaction surveillance such as:

- mouse coordinates
- hover duration
- every DOM click
- full keystroke streams
- deleted text
- arbitrary browsing-history detail unrelated to LEH assistance

Most contextual assistance decisions should be possible with **zero AI-token cost**.

---

## 3. Context model

LeanAI context should be assembled from four layers.

### 3.1 Product context

Stable LEH knowledge:

- what each module does
- module prerequisites
- setup order/dependencies
- permissions
- workflow/lifecycle rules
- starter templates
- supported actions
- product terminology

This should be versioned product knowledge, not rediscovered by the model.

### 3.2 Lean knowledge

Curated methodology knowledge, for example:

- Lean
- Six Sigma
- DMAIC
- A3
- PDCA
- 5 Why
- Ishikawa
- Kaizen
- Gemba
- 5S
- maturity assessment
- benefits validation
- training/skills methodology

Use retrieval only where it materially improves the answer. Do not send a large knowledge corpus on every turn.

### 3.3 Organisation context

Permission-scoped organisation state:

- organisation/site hierarchy
- published frameworks
- suggestion programmes
- training catalogue
- active projects
- problem-solving cases
- open actions
- benefits
- skills
- setup/readiness state
- enabled features/entitlements

Organisation context must remain tenant-isolated and tool-authorised.

### 3.4 User journey context

Compact recent workflow context, for example:

- current module
- current site
- current route/workflow
- relevant setup actions completed
- setup prompts accepted/dismissed
- most recent unfinished onboarding step
- current role/permission context

This is **structured state**, not a free-form surveillance transcript.

---

## 4. Setup Readiness Model

Introduce a deterministic organisation setup/readiness read model.

Conceptually:

```
Organisation readiness
  organisation/profile     ready
  sites                    ready
  people                   incomplete
  maturity                 not_started
  suggestions              ready
  five_s                   not_started
  gemba                    not_started
  training                 incomplete
  skills                   not_started
  recognition              not_started
  lean_ai                  available
```

Each readiness item should expose:

- status: `not_started | incomplete | ready | blocked`
- reason
- prerequisite(s)
- recommended CTA
- target route
- optional supporting metrics

This readiness model should be deterministic and queryable without an LLM.

LeanAI consumes it; LeanAI does not invent it.

---

## 5. Intervention engine

Build a server-owned intervention engine that determines whether proactive assistance is appropriate.

Example rule:

```
WHEN
  module = maturity
  AND framework_count = 0
  AND prompt maturity_first_setup has not been recently dismissed

THEN
  candidate = maturity_first_setup
```

Candidate properties should include:

- intervention key
- priority
- context reason
- CTA(s)
- route/surface
- eligibility requirements
- cooldown/dismissal policy
- whether LLM enrichment is allowed
- required permissions
- source context IDs

Prefer deterministic rules first.

An AI model may enrich wording, explain the recommendation or answer follow-up questions, but it should not be required to detect simple missing-state conditions.

---

## 6. Intelligent CTA / Coach UI

Create a reusable LeanAI contextual assistance component.

Possible presentation modes:

- small inline coach card
- dismissible popup
- side-panel prompt
- onboarding step card
- contextual empty-state CTA

Avoid modal spam.

A prompt should normally provide 2–3 clear choices such as:

- **Do it**
- **Show me / Explain**
- **Later**

For higher-impact changes:

- **Review setup**
- **Apply**

LeanAI must not silently perform authoritative changes.

---

## 7. Human control

The existing LEH AI principle remains:

**AI is not an authoritative organisation member.**

LeanAI may:

- explain
- recommend
- summarise
- compare
- identify missing setup
- prepare a typed proposal
- draft configuration
- navigate a user to the correct workflow

LeanAI must not autonomously:

- approve benefits
- close problem-solving cases
- publish official maturity results
- assign protected RBAC
- delete tenant data
- make irreversible business decisions

Where LeanAI proposes a write:

```
LeanAI proposes
  -> authorised human reviews
  -> normal LEH domain/RBAC path applies
  -> audit trail is preserved
```

---

## 8. Agent architecture

Do not introduce a multi-agent swarm in v1.

Use a single **LeanAI Manager / orchestrator** with specialist capabilities exposed as tools or bounded workflows.

Conceptually:

```
LeanAI Manager
  ├─ Product / setup context
  ├─ Organisation context tools
  ├─ Lean knowledge retrieval
  ├─ Maturity coaching
  ├─ Problem-solving coaching
  ├─ Project coaching
  ├─ Training/skills coaching
  └─ Benefits coaching
```

The user experiences one LeanAI identity.

Specialists should not maintain independent uncontrolled memories or compete for the conversation.

### Framework decision

For v1, **keep the existing LEH server-owned AI orchestrator and provider abstraction**.

Do not migrate the whole platform to another agent framework just to deliver contextual onboarding.

The existing architecture already provides:

- provider abstraction
- bounded tool loop
- typed tools
- usage accounting
- source allowlist
- proposal sanitisation
- human approval
- stateless provider use

If a formal agent framework is adopted later, the preferred shape is a **self-hosted TypeScript agent framework behind the LEH security/context boundary**, not a hosted state system that becomes the source of truth for tenant context.

---

## 9. Model routing and cost control

Do not bind product behaviour to one provider model name.

Introduce logical model classes such as:

- `economy` — classification, CTA wording, simple help
- `standard` — normal LeanAI coaching and onboarding
- `deep` — complex problem solving / cross-module reasoning

Map these classes to actual provider/model IDs using environment/configuration.

Cost controls:

1. semantic events do not call AI
2. readiness evaluation does not call AI
3. intervention selection should usually not call AI
4. use AI only when:
   - user opens/accepts a LeanAI interaction
   - contextual natural-language explanation is valuable
   - a complex recommendation requires reasoning
5. keep organisation context compact and tool-retrieved
6. exploit provider prompt caching where available
7. preserve existing `ai_usage_events` accounting
8. enforce organisation AI ceilings/entitlements

LeanAI must degrade gracefully:

- if AI is unavailable, deterministic CTAs and onboarding still work
- core LEH functions remain available
- no onboarding dead-end because the model/provider is unavailable

---

## 10. Knowledge base strategy

Do not create a single vector store containing everything.

Use the right representation for each context:

| Context | Preferred representation |
| --- | --- |
| Product behaviour | versioned structured product knowledge |
| Module readiness | deterministic read model |
| User journey | structured semantic events / compact state |
| Organisation records | permission-scoped tools/read models |
| Lean methodology | curated retrieval/RAG where useful |
| Conversation | bounded session history |

The model should retrieve only what is needed for the current task.

---

## 11. Privacy / customer policy position

LeanAI contextual assistance must be designed as **product assistance**, not worker surveillance.

Product policy baseline:

- collect only semantic workflow events necessary for assistance
- do not collect raw mouse/keystroke surveillance
- do not use LeanAI journey telemetry for employee productivity scoring
- do not use it for disciplinary profiling
- make proactive AI assistance visible to users
- provide organisation-level controls
- retain only the journey context needed for the assistance purpose
- keep tenant context isolated
- respect existing AI enable/disable settings and permissions
- do not send customer content to the provider unless an AI invocation is actually needed

Suggested organisation settings:

- LeanAI enabled
- proactive contextual assistance enabled
- organisation data may be used for contextual assistance
- cross-site AI insights enabled/disabled
- journey-context retention period

Before commercial launch, legal/privacy wording must accurately describe actual telemetry and provider data handling.

Do not claim Zero Data Retention unless it is explicitly configured and contractually supported.

---

## 12. Suggested retention approach

Use two categories:

### Durable product/business state

Examples:

- framework published
- training configured
- suggestion programme exists

This already belongs in the normal LEH domain model and should not be duplicated as temporary AI telemetry.

### Journey/intervention telemetry

Examples:

- prompt shown
- prompt dismissed
- prompt accepted
- onboarding step skipped

Use a configurable retention window and aggregate where possible.

Do not make long-term individual behavioural history a requirement for LeanAI.

---

## 13. Initial onboarding experience

For a new organisation:

### Organisation created

LeanAI:

> Welcome to Lean Excellence Hub. I can guide you through the highest-value setup steps.

### Structure

> Your first site is ready. I recommend setting up your structure next because Maturity, Gemba, Training, Skills and Actions use it.

**Set up structure** · **Explain why** · **Later**

### Maturity

> You do not have a Maturity Framework yet.

**Use LEH starter framework** · **Build one with LeanAI** · **Later**

### Suggestions

> Suggestions are available, but no programme is configured.

**Create starter programme** · **Show recommended setup** · **Later**

### Completion

Display a simple readiness summary, e.g.:

```
8 / 10 recommended setup areas ready

✓ Organisation
✓ Sites
✓ People
✓ Maturity
✓ Suggestions
✓ 5S
✓ Gemba
✓ Training
○ Skills
○ Recognition
```

The user should always be able to continue manually.

---

## 14. First implementation slices

### LEANAI-CONTEXT-01 — Semantic Event & Context Foundation

- semantic event taxonomy
- minimal journey-state persistence
- privacy boundaries
- server-side event API
- no LLM requirement
- tenant isolation
- retention policy

### LEANAI-CONTEXT-02 — Setup Readiness

- organisation/module readiness evaluator
- prerequisite graph
- CTA metadata
- tests across empty / partial / mature tenant states

### LEANAI-CONTEXT-03 — Intervention Engine + UI

- intervention candidate rules
- cooldown/dismissal
- reusable LeanAI coach component
- deterministic copy fallback
- permission checks

### LEANAI-CONTEXT-04 — AI Enrichment

Implemented as a two-PR sequence:

- **Foundation (ADR-0018)** — general Coach `ai_sessions.context_type`, secure
  session lifecycle, logical model routing (`economy` / `standard` / `deep`),
  reuse of `ai_usage_events`. No dummy Problem Solving cases.
- **Enrichment** — compact `coach-explain-v1` context, user-triggered Explain,
  bounded follow-up, Coach UI (static vs AI-generated), mocked-provider tests.
  Ordinary Explain uses the `economy` class only. Deterministic copy remains
  the fallback when AI is unavailable, disabled, or over limit.

### LEANAI-ONBOARD-01 — Intelligent Onboarding

- use the intervention engine across the new-organisation onboarding journey
- step-by-step setup guidance
- starter setup actions
- manual route always available
- use the next fresh QA organisation as the end-to-end acceptance test

---

## 15. Acceptance principles

The milestone is successful when:

- a brand-new organisation receives useful contextual guidance without a chatbot prompt being required
- no AI call is made for ordinary clicks/events
- deterministic onboarding still works with AI provider disabled
- LeanAI does not expose cross-tenant data
- interventions respect permissions
- prompts do not repeatedly nag after dismissal
- users can always choose manual setup
- recommendations link to or propose real LEH actions
- AI writes remain human-approved
- usage is recorded in existing AI telemetry
- no employee surveillance/profile scoring is introduced
- the final clean-organisation smoke can exercise both onboarding and every LEH module from zero

---

## 16. Decision summary

For LEH v1:

- **LeanAI becomes a proactive contextual coach**
- **semantic events, not raw click surveillance**
- **readiness and intervention detection are deterministic**
- **AI is invoked only when it adds value**
- **one LeanAI identity / manager**
- **keep the current LEH orchestrator for now**
- **specialist capabilities are tools/workflows, not autonomous agents**
- **human approval remains mandatory for authoritative writes**
- **context is tenant/permission scoped**
- **no employee productivity scoring**
- **AI provider/model selection remains configurable**
- **build contextual onboarding before the final clean-organisation smoke**
