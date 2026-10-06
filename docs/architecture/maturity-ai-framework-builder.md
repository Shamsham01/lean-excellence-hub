# Maturity Framework builder with LeanAI

Status: **Implemented for Maturity** (`MAT-AI-BUILDER-01` / #208)

Date: **2026-10-06**

## Product intent

LEH is the engine, not the Lean methodology. **Your framework. Your standards.
Your way of working.**

Many organisations already know how they assess operational maturity — in a
spreadsheet, a corporate standard, or in their heads. **Build with LeanAI**
helps them translate that into an LEH Maturity Framework through a short
guided conversation, instead of authoring every level, pillar, criterion and
question by hand. LeanAI never claims to know "the correct Lean framework"; it
proposes structure in the organisation's own language and suggests content
only where asked.

The three setup paths sit side by side on `/platform/maturity/models`:

| Path | What it does | Output |
| --- | --- | --- |
| Quick Start | Copies the product-owned LEH Operational Excellence Standard | Draft |
| Build with LeanAI | Conversation → typed proposal → human review | Draft |
| Manual | Blank framework built in the editor | Draft |

Quick Start and Manual are unchanged and do not depend on AI.

## Journey

1. **Entry** — the models page shows a "Build with LeanAI" card for users with
   `maturity.models.manage`. Rendering the card or opening
   `/platform/maturity/builder` never creates a session or calls a model.
2. **Discovery** — the user describes what the framework should assess. LeanAI
   asks short questions (with suggested answers) about assessment scope,
   pillars, level philosophy, existing criteria/standards, where LEH should
   suggest content, and whether an existing framework is being translated.
   A "What LeanAI understands so far" panel shows the seven discovery facts.
   The user can ask for a proposal at any point.
3. **Proposal** — a structured preview: name, description, assessment scopes,
   3–5 levels, 1–8 pillars, criteria and scored questions, plus guidance. It is
   badged **LeanAI proposal · not saved** with a revision number.
4. **Refine** — every part (framework, levels, any pillar, any criterion) has
   a Refine control. The user describes the change; LeanAI returns a complete
   new revision that changes only the focused part and lists what changed.
5. **Accept** — **Create draft framework** opens a confirmation that states the
   counts and that nothing is published. Confirming creates an
   organisation-owned draft and redirects to
   `/platform/maturity/models/<id>?step=review` in the normal editor.
6. **Publish** — remains an explicit human action in the editor. The builder
   has no publish path.

**Start over** clears the visible conversation and the unsaved proposal.
**Set up manually instead** is always available once a proposal exists.

## Architecture decisions

### One AI architecture

The builder is a consumer of the existing Coach session path
([ADR-0018](../adr/ADR-0018-general-leanai-coach-sessions.md)), not a second
AI stack:

| Concern | Reused mechanism |
| --- | --- |
| Session | `create_ai_coach_session('maturity', 'maturity_framework_builder', …)` — one active session per membership, organisation-bound, creator-only reads |
| Eligibility | `private.can_use_ai` (membership, `ai.use`, `organisation_ai_settings.ai_enabled`) inside `start_ai_run` |
| Limits | `start_ai_run` monthly token ceiling, rate limit and idempotency |
| Usage | `finish_ai_run` writes `ai_usage_events`; `fail_ai_run` records no usage |
| Provider | Existing provider abstraction, `store: false`, strict JSON schema output |
| Routing | New task `framework_builder` mapped to the `standard` logical class in `src/platform/ai/model-routing.ts` |
| Assistant | Persistent LeanAI pane recognises the `maturity_builder` workflow; no competing chat surface |

The builder orchestrator (`src/platform/ai/maturity-builder-orchestrator.ts`)
sends `tools: []`. Any tool call the provider returns is denied
(`maturity_builder_has_no_tools`) and recorded; LeanAI cannot reach database
operations.

### No new migration

Acceptance uses the existing atomic RPC
`public.create_maturity_model_draft_from_definition` with declared key
`leanai-maturity-builder`. It already enforces `maturity.models.manage`,
validates the whole definition, creates everything in one transaction, refuses
to publish, and writes the neutral audit event
`maturity.model.draft_created_from_definition` with `declared_template_key`.
The builder never claims Quick Start provenance. No hosted migration is needed
or applied for this slice.

### Model output is never authoritative

1. The provider must return the strict envelope schema
   (`src/platform/ai/prompts/maturity-framework-builder.ts`).
2. `parseMaturityBuilderEnvelope` / `validateMaturityBuilderProposal`
   (`src/modules/maturity/ai-builder/proposal.ts`) reject — never repair —
   proposals that break counts, required text, length limits, duplicate names
   or total ceilings (36 criteria, 72 questions).
3. Stored payloads are re-validated every time the conversation is read.
4. Acceptance takes only a **message id**. The server re-reads the session,
   checks the id is the current valid proposal (otherwise `stale_proposal`),
   re-validates it, derives colour tokens (`maturity-1…n`) and the declared key
   itself, then calls the RPC **with the user's own Supabase client** so RLS
   and `maturity.models.manage` apply.

`finish_ai_run` is callable by authenticated users, so a member could write
their own assistant payload into their own session. That grants nothing: the
payload is re-validated and the RPC still requires `maturity.models.manage`,
which already allows manual authoring of the same content.

### Bounded, untrusted context

Each turn sends a compact `maturity-builder-context-v1` block built in
`src/modules/maturity/ai-builder/context.ts`:

- organisation name, site count and up to 10 site names
- organisational unit type counts and up to 24 other unit names
- up to 20 job function names
- up to 10 existing framework names
- the understanding so far, the current proposal, the request intent/focus and
  the hard limits

No people, memberships, assessment results or free-text records are sent. The
system prompt treats all organisation text and user text as untrusted data.
Only the last six turns are replayed. The stored user message is a compact
`[Maturity framework builder · context <hash>]` line plus the user's request;
the full context block goes only to the provider.

### Failure and retry

| Failure | Behaviour |
| --- | --- |
| Envelope does not match the schema | Run finished with `response_status: invalid_response`; usage recorded; previous proposal kept; **Try again** shown |
| Proposal fails validation | Run finished with `proposal_status: invalid`; usage recorded; previous proposal kept; **Try again** shown |
| Provider error or timeout | `fail_ai_run`; no usage; the same submission can be retried |
| Tool call requested | Denied and recorded; treated as an invalid response |

Retry replays the last user turn with its original intent and focus and sets
`request.retry` so the model knows the previous attempt was unusable.

### Restart boundary

**Start over** writes an httpOnly cookie
`leh_maturity_builder_start_<organisationId>` (path `/platform/maturity`,
30 days) containing the latest message time + 1 ms. Turns before it are hidden
and no longer replayed. History is not deleted and usage is unaffected.
Creating a draft writes the same boundary so the builder starts fresh.

## Access matrix

Checked in `loadMaturityBuilderAccess` before any RPC, and again by the
database:

| Condition | Result |
| --- | --- |
| No `maturity.models.manage` | Builder card hidden; page shows the unavailable state; actions deny before any AI call |
| Application AI unavailable (`AI_ENABLED`, provider config, subscription, entitlement) | Unavailable state with Quick Start / manual links |
| Organisation AI disabled | Unavailable state explaining an administrator can enable LeanAI |
| No `ai.use` | Unavailable state |
| Different organisation | Coach session and draft are invisible; `get_ai_session_detail` is denied |

Accepting a proposal also requires builder access. If LeanAI is turned off
after a proposal was generated, the unsaved proposal cannot be accepted; Quick
Start and Manual remain available. Coach sessions are creator-only under RLS,
so a member can only ever accept a proposal from their own conversation.

## Limits

- 2,000 characters per message, 20 user messages per conversation
- Output capped at 6,000 tokens per turn; `AI_RUN_TIMEOUT_MS` (default 45 s)
- Proposal: 3–5 levels, 1–8 pillars, 1–6 criteria per pillar (36 total),
  1–3 scored questions per criterion (72 total)

## Code map

- Domain: `src/modules/maturity/ai-builder/` (`types`, `proposal`, `context`,
  `conversation`, `load`)
- Prompt: `src/platform/ai/prompts/maturity-framework-builder.ts`
- Orchestrator: `src/platform/ai/maturity-builder-orchestrator.ts`
- Fake provider: `src/platform/ai/providers/fake-maturity-builder.ts`
  (triggers `MALFORMED_PROPOSAL_TEST`, `BROKEN_ENVELOPE_TEST`,
  `TOOL_REQUEST_TEST`)
- Route and actions: `src/app/(platform)/platform/maturity/builder/`
- UI: `src/components/maturity/ai-builder/`
- Assistant context: `maturity_builder` workflow in
  `src/modules/leanai-context/assistant/`

## Tests

- Unit: `tests/unit/maturity-ai-builder-{domain,orchestrator,actions,ui}.test.*`
- Database: `supabase/tests/database/maturity_ai_builder_draft.test.sql` —
  builder session, usage, failed runs, no records before acceptance, exact
  non-uniform hierarchy, draft only, editable afterwards, audit provenance,
  sibling isolation, and AI access never substituting for
  `maturity.models.manage`
- E2E (fake provider only): `tests/e2e/maturity-ai-builder.spec.ts` — AI
  disabled, discovery → proposal → refine → create draft → edit → reload,
  malformed output and retry, mobile 390×844 keyboard journey, sibling
  organisation

CI never calls a real provider.

## Next slice (not implemented)

- **Patch-based refinement** — the model returns a typed patch for the focused
  element instead of a complete proposal, reducing output tokens and timeout
  risk for large frameworks.
- **Import an existing framework** — paste or upload an existing assessment
  and map it into a proposal, with explicit per-item confirmation.
- **Builder for an existing draft** — refine a saved draft with LeanAI through
  the normal authoring RPCs, one confirmed change at a time.
- The cross-module Manual / Build with LeanAI / Quick Start setup shell (#207).
