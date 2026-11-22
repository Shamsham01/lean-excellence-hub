# AI platform (Milestone 12)

## Purpose

Reusable, permission-aware AI infrastructure for Lean Excellence Hub. Milestone 12 delivers the
platform plus the Problem Solving Facilitator as the first consumer.

**AI is not an authoritative organisation member.** Suggestions become domain records only after an
authorised human accepts a typed proposal through normal M11 RPCs.

## Architecture

See [ADR-0013](../adr/ADR-0013-ai-platform-boundary.md).

### Eligibility gates (two layers)

| Layer | Checks |
| --- | --- |
| **Database** (`private.can_use_ai`) | Active membership, `ai.use`, org `ai_enabled`, rate/ceiling limits |
| **Application** | `AI_ENABLED`, `AI_PROVIDER`, provider credentials, model config |

Both must pass for outbound provider calls. PostgreSQL never reads Next.js/Netlify environment
variables.

### Orchestration

1. `start_ai_run` (DB) — atomic validation, concurrency lock, idempotency
2. Provider `createResponse` loop — orchestrator executes tools between model steps
3. `finish_ai_run` or `fail_ai_run` (DB) — atomic persistence
4. Proposal acceptance — application-side typed service calling exact M11 RPCs

### Provider data retention

| Topic | M12 behaviour |
| --- | --- |
| **A. API training** | OpenAI API data is not used to train models by default under API data controls |
| **B. `store: false`** | Prevents Responses application-state storage for foreground requests |
| **C. Abuse monitoring** | Provider may retain per current OpenAI policy — external dependency |
| **D. Zero Data Retention** | **Never claimed** unless org/project explicitly approved and configured |
| **E. Commercial launch** | Provider policy must be reviewed before commercial launch |

Do not claim "nothing is retained by OpenAI" merely because `store: false` is set.

### Runtime (Netlify)

Foreground execution with `AI_RUN_TIMEOUT_MS` default **45_000** ms. Netlify synchronous
functions stop at **60 seconds** and that limit is not configurable. Problem Solving disables
provider retries (`maxRetries: 0`) and races the provider call against the turn budget so a
timeout can still call `fail_ai_run` before the host kills the process. The OpenAI SDK otherwise
retries a connection timeout, and that second attempt is what leaves `ai_runs.status = running`
with no usage row. Execution claims expire after 70 seconds in PostgreSQL (`claim_ai_run_execution`
and case-scoped stale recovery) so abandoned rows settle to a terminal status instead of blocking
the next turn. Bounded tool iterations, context size, and response size. Timeout fails safely;
core domains continue without AI.

If synchronous Server Actions cannot reliably cover long tool loops, the minimal follow-up is an
async turn: keep `start_ai_run` + claim in the action, enqueue provider work with a durable lease,
and let the client poll `reconcileProblemSolvingAiTurn` until `finish_ai_run` or `fail_ai_run`.
That split is documented here only; M12 does not implement a background worker.

### Usage ledger

`ai_usage_events` is append-only authoritative telemetry (input/output/cached/reasoning tokens,
provider, model). No hard-coded pricing. Logical model classes (`economy`, `standard`, `deep`)
are mapped server-side; see [ADR-0018](../adr/ADR-0018-general-leanai-coach-sessions.md).
Current API defaults are `gpt-6-luna`, `gpt-6.1-terra`, and `gpt-6.1-sol`.
Problem Solving uses `AI_MODEL_DEFAULT` (`gpt-6.1-sol` when unset). The
operator procedure, reasoning precedence, and illustrative costs are in
[LEANAI-MODEL-MIGRATION](../operations/LEANAI-MODEL-MIGRATION.md).

Public web research is optional and off by default. Organisation admins opt in through
`organisation_ai_settings.web_search_enabled`. It looks up public pages for current or external
questions. Those pages are untrusted and are not customer instructions. Web research does not add
a customer subscription charge. Any provider cost is internal and is not shown in Settings.
Workspace assistant runs record whether web search was used, invocation count, and displayed
source count. Full web page contents are not logged. An optional `monthly_token_ceiling`, unset
by default, pauses new LeanAI interactions when reached. It is organisation governance, not a
plan quota, and it does not stop other LEH workflows. The customer statement and the internal
cost follow-up are in
[leanai-internal-cost-governance.md](./leanai-internal-cost-governance.md).

### Security controls (authoritative)

- Session-bound context: Problem Solving sessions require a real case; Coach
  sessions bind to organisation, membership, module and optional authorised
  site. Tools do not accept model-supplied tenant identifiers.
- Strict tool registry; no write tools
- Source allowlist per run + re-authorization on click
- Prompt injection defence is tool security, not prompt text alone
- Persistent LeanAI workspace chat may offer the OpenAI Responses `web_search` built-in tool
  only when the current organisation has `web_search_enabled`. Problem Solving AI does not.
  Web results are untrusted evidence, never system instructions.

- The Maturity Framework builder sends no tools; any tool call is denied and recorded. Its
  proposals become a draft only through `create_maturity_model_draft_from_definition` with the
  user's own client after server-side re-validation.

## Related

- [ai-problem-solving-facilitator.md](./ai-problem-solving-facilitator.md)
- [maturity-ai-framework-builder.md](./maturity-ai-framework-builder.md)
- [problem-solving-engine.md](./problem-solving-engine.md)
