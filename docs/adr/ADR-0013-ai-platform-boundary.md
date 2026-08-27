# ADR-0013: AI platform boundary (Milestone 12)

## Status

Accepted (Milestone 12).

## Context

Lean Excellence Hub needs a reusable AI capability for problem-solving facilitation without
creating an autonomous application actor, permission escalation path, or second generic write API
around domain modules.

## Decision

1. **Provider abstraction** — `AIProvider.createResponse()` translates provider-neutral types;
   Lean Hub orchestrator owns tool execution, authorization, and proposal persistence.
2. **Database eligibility** — `private.can_use_ai()` checks membership, `ai.use`, org
   `ai_enabled`, and DB-side limits only. Application env (`AI_ENABLED`, credentials) gates
   outbound provider calls separately.
3. **No service-role user path** — ordinary AI flows use authenticated caller-scoped Supabase
   clients; proposals accept via exact existing M11 public RPCs with human membership as actor.
4. **Typed context** — M12 AI sessions bind to `problem_solving_case_id` (no speculative
   polymorphic context).
5. **Private-by-author sessions** — case read alone does not grant AI conversation access;
   creator or `ai.view_history` plus current case read required.
6. **Typed source references** — exact-one nullable FK columns; no authoritative
   `source_type + source_id` pairs.
7. **Source allowlist** — model citations validated against server-built allowlist per run.
8. **Append-only usage** — `ai_usage_events` is commercial telemetry; no ordinary updates/deletes.
9. **OpenAI Responses** — `store: false`; Lean Hub owns conversation state; no Assistants API.

## Consequences

- Future modules (Projects, Maturity) add deliberate context architecture when requirements exist.
- Live provider validation is opt-in; CI uses FakeAIProvider.
- Long-running/queued AI is deferred; foreground execution respects Netlify limits (~40–45s).
