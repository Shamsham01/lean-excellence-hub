# Known issues & incident summary

Concise pointers for agents. **No customer identifiers.**

## P0 — open (Nov 2026)

| ID | Title | Owner agent | Workstream |
| --- | --- | --- | --- |
| [#325](https://github.com/Shamsham01/lean-excellence-hub/issues/325) | Skills LeanAI response → `invalid_response` | NEXUS + TALENT | Separate PR; trace schema/Zod/storage |
| [#326](https://github.com/Shamsham01/lean-excellence-hub/issues/326) | Three facilitator runs stuck `running` | PULSE + NEXUS | Diagnostics + reconciliation policy; related fix PR #327 |

## PR [#327](https://github.com/Shamsham01/lean-excellence-hub/pull/327) — LeanAI turn budget vs Netlify 60s

**Status:** Open (not merged at knowledge index time).

**Summary:**

- Netlify synchronous limit **60s** (not configurable).
- Default turn budget **45s** (`AI_RUN_TIMEOUT_MS`) with finalize buffer (`run-deadline.ts`).
- OpenAI SDK **default retries** can push Problem Solving past 60s after `claim_ai_run_execution`, killing the function before `fail_ai_run` → stuck `running`, non-RSC browser error, idempotency/session lock issues.
- Fix direction: `maxRetries: 0` for PS, race provider against budget, stale session recovery, retain composer idempotency key.
- **Three hosted runs:** do not replay/delete; owner-approved `fail_ai_run` only; missing usage ≠ proof provider uncalled.

**ADR:** [ADR-0019](../adr/ADR-0019-ai-turn-execution-budget-under-netlify-sync-limit.md)

## Deploy / migration alignment

- Do not assume `main` == production deploy (#326).
- Baseline references: `34cb9a1` production SHA; migration head `20261104193000_ai_run_execution_claim`.

## Preview vs production Supabase

**Open question:** deploy previews may share production DB credentials — treat as R0 policy gap; no writes from previews until separated.

## Historical (context only)

- #321 / PR #322 — execution claim & reconciliation (landed on `main`; incident shows remaining gaps).
- #320 / PR #323 — Skills discovery retry (precedes #325).

## Other open issues (roadmap input)

See [MASTER_PLAN.md](../roadmap/MASTER_PLAN.md) for mapping (#318, #310–#314, #170, #235, #303, …).
