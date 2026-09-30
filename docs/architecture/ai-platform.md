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

Foreground execution with conservative `AI_RUN_TIMEOUT_MS` default **45_000** ms (below hosted
synchronous limits). Bounded tool iterations, context size, and response size. Timeout fails safely;
core domains continue without AI.

### Usage ledger

`ai_usage_events` is append-only authoritative telemetry (input/output/cached/reasoning tokens,
provider, model). No hard-coded pricing. Logical model classes (`economy`, `standard`, `deep`)
are mapped server-side; see [ADR-0018](../adr/ADR-0018-general-leanai-coach-sessions.md).

### Security controls (authoritative)

- Session-bound context: Problem Solving sessions require a real case; Coach
  sessions bind to organisation, membership, module and optional authorised
  site. Tools do not accept model-supplied tenant identifiers.
- Strict tool registry; no write tools
- Source allowlist per run + re-authorization on click
- Prompt injection defence is tool security, not prompt text alone

## Related

- [ai-problem-solving-facilitator.md](./ai-problem-solving-facilitator.md)
- [problem-solving-engine.md](./problem-solving-engine.md)
