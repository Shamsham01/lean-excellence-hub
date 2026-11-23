# LeanAI runtime

## Orchestrator pattern (**Implemented**)

1. **DB:** `start_ai_run` — validation, concurrency lock (one running row per session), idempotency.
2. **Optional:** `claim_ai_run_execution` — execution lease (`20261104193000_ai_run_execution_claim.sql`).
3. **App:** Provider loop — `createResponse`, tool execution, envelope parsing.
4. **DB:** `finish_ai_run` or `fail_ai_run` — atomic terminal state + messages/usage.

Entry points:

| Workflow | Code |
| --- | --- |
| Problem Solving facilitator | `src/platform/ai/orchestrator.ts` |
| Module setup (Skills, Maturity, …) | `src/platform/ai/module-setup-builder-orchestrator.ts` |
| Coach | LeanAI coach orchestrator tests / components under `src/components/leanai/` |

Prompts: e.g. `src/platform/ai/prompts/problem-solving-facilitator.ts` (`PROMPT_KEY`, `PROMPT_VERSION`).

## Time budgets

| Constant | Value | File |
| --- | --- | --- |
| `AI_RUN_TIMEOUT_MS` (env) | default `45000` | `.env.example` |
| `AI_TURN_WALL_CLOCK_DEFAULT_MS` | `45000` | `src/platform/ai/run-deadline.ts` |
| Finalize buffer | `2500` ms | same |
| Netlify sync ceiling | ~`60000` ms | platform constraint (PR #327) |

Mechanisms:

- `createAiRunDeadline` / `runWithinAiTurnBudget` race work against remaining wall clock.
- Stale recovery: `recoverStaleAiRunsForSession` → `fail_ai_run` category `timeout` (`src/platform/ai/stale-ai-run-recovery.ts`).

Problem Solving disables SDK retries and budgets provider work to leave time for settlement (#327, #356, #372). The shared multiline composer and safe Markdown renderer ship on main (#417).

## Provider & models (**Implemented**)

- Registry: `src/platform/ai/registry.ts`, config `src/platform/ai/config.ts`.
- OpenAI Responses API, `store: false` (ADR-0013).
- CI: Fake provider when gated (`AI_ALLOW_FAKE_PROVIDER`, `NODE_ENV=test`).

## Tool loops (**Implemented**)

- Problem Solving read tools: `src/platform/ai/tools/problem-solving-schemas.ts`
- Executors: `src/platform/ai/tools/problem-solving-executors.ts`
- `AI_MAX_TOOL_CALLS` default 8 (`.env.example`)

## Reconciliation (**Implemented**)

- `src/platform/ai/ai-run-reconciliation.ts`, `stale-ai-run-recovery.ts`
- User strings: `AI_TURN_IN_PROGRESS_MESSAGE`, `AI_TURN_UNCERTAIN_COMPLETION_MESSAGE` in `run-deadline.ts`

## Async / background turns (**Proposed**)

- ADR-0019 records sync-budget decision; full async worker not on `main`.

## Related ADRs

- ADR-0013, ADR-0018, ADR-0019
