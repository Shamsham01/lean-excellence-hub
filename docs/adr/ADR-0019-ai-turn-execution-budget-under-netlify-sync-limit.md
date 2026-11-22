# ADR-0019: AI turn execution budget under the Netlify synchronous limit

## Status

Accepted (documentation). Implementation tracked in PR [#327](https://github.com/Shamsham01/lean-excellence-hub/pull/327) and incident [#326](https://github.com/Shamsham01/lean-excellence-hub/issues/326).

## Context

LeanAI Problem Solving runs as **foreground** Next.js server work on Netlify. The host enforces a **~60 second** synchronous execution ceiling for serverless/SSR paths; it is not configurable per site.

The application already uses a conservative **45 second** turn wall clock (`AI_RUN_TIMEOUT_MS` / `AI_TURN_WALL_CLOCK_DEFAULT_MS` in `src/platform/ai/run-deadline.ts`) with a **2.5s** finalize buffer before `finish_ai_run` / `fail_ai_run`.

Netlify can still terminate the function **after** `claim_ai_run_execution` but **before** `fail_ai_run` when:

- the OpenAI SDK performs **connection retries** (`maxRetries` default 2), extending wall time beyond the host kill window; or
- combined provider + tool + DB work exceeds the host limit even when app budget math is correct.

Symptoms (production Nov 2026): `ai_runs.status = running` with no terminal usage row, browser non-RSC error, session lock blocking retries with new idempotency keys. Zero recorded tokens does **not** prove the provider was never invoked.

ADR-0013 deferred background/queued AI; this ADR records how sync execution must behave until an async design is approved.

## Decision

1. **Single host-fit attempt for Problem Solving provider calls** — disable SDK-level retries for the facilitator workflow (`maxRetries: 0`) so one bounded attempt plus DB finalisation can complete inside ~60s.
2. **Keep application turn budget at 45s default** — leaves headroom for finalize RPCs and host overhead; do not raise budget to fill 60s.
3. **Race provider I/O against remaining turn budget** — use `runWithinAiTurnBudget` / deadline helpers so timeouts call `fail_ai_run` while the function is still alive when possible.
4. **Session-scoped stale recovery** — after host limit + grace (proposed 65s in PR #327), authorised callers may `fail_ai_run` stale **same-session** rows to release locks; no cross-session sweeps without a separate approved worker.
5. **Client idempotency** — on uncertain completion, retain user message and idempotency key; surface explicit in-progress/uncertain copy (`AI_TURN_*_MESSAGE` in `run-deadline.ts`).
6. **No background worker in this decision** — if sync turns cannot meet product SLOs, a follow-up ADR must design async turns (queue, webhook, or polling) rather than silently exceeding Netlify limits.
7. **Hosted reconciliation** — stuck rows are settled only via owner-approved `fail_ai_run` policies; no agent-initiated replay or delete.

Other LeanAI workflows may retain SDK retry defaults **only if** measured end-to-end time fits the same host ceiling.

## Consequences

- Long provider latencies fail visibly and release locks instead of orphaning runs.
- External provider billing for orphaned runs remains **unknowable** from DB alone; incident playbooks must say so.
- Full Regression E2E with instant fake provider does not detect host-limit races; unit tests and timed integration tests are required (see PR #327).
- Commercial launch (R6) must revalidate host limits if platform or region changes.

## References

- `src/platform/ai/run-deadline.ts`
- `src/platform/ai/orchestrator.ts`
- `supabase/migrations/20261104193000_ai_run_execution_claim.sql`
- [docs/knowledge/leanai-runtime.md](../knowledge/leanai-runtime.md)
- [docs/knowledge/known-issues.md](../knowledge/known-issues.md)
