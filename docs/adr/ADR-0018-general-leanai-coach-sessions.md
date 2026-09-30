# ADR-0018: General LeanAI Coach sessions

## Status

Accepted for LEANAI-CONTEXT-04 (#195).

## Context

Milestone 12 bound `public.ai_sessions` to `problem_solving_case_id` (ADR-0013).
That is correct for the Problem Solving facilitator. It is insufficient for
general LeanAI Coach interactions such as explaining Maturity setup.

Creating dummy Problem Solving cases, or passing fabricated case IDs, would:

- mix product-setup conversations into the investigation domain
- grant Coach turns a path toward Problem Solving tools and proposals
- pollute case lists, audit, and usage attribution
- violate tenant/product semantics

Two options were investigated:

1. **Extend `ai_sessions` with an explicit `context_type` discriminator.**
2. **Add a separate Coach session table** that still shares `ai_runs`,
   `ai_messages`, and `ai_usage_events`.

Option 2 still needs a session foreign key on the existing run/message/usage
tables. That is either a second nullable FK (polymorphic in practice) or a
duplicated run stack. Both are worse than a typed discriminator on the table
that those ledgers already reference.

## Decision

Extend the current AI session model with an explicit context type.

1. `ai_sessions.context_type` is `'problem_solving' | 'coach'`.
2. Existing rows default to `'problem_solving'`. `create_ai_session` remains
   the Problem Solving API and still requires a real case.
3. `problem_solving_case_id` becomes nullable. A CHECK constraint requires a
   case for Problem Solving sessions and **forbids** a case (and a Problem
   Solving human session) for Coach sessions. Never create dummy cases.
4. Coach sessions bind to the current organisation, authenticated membership,
   optional authorised site, module, and intervention key.
5. New public Coach APIs are **SECURITY INVOKER** wrappers over private
   SECURITY DEFINER helpers (`search_path=''`, no anonymous execute). This
   preserves the SEC-RPC-002 privilege boundary from #192.
6. `start_ai_run`, `finish_ai_run`, `fail_ai_run`, and `ai_usage_events` are
   reused. Coach runs cannot persist Problem Solving proposals.
7. `can_read_ai_session` retains creator-or-`ai.view_history` access for
   Problem Solving sessions, conditional on current case read. Personal Coach
   conversations are **creator-only** within the current active organisation;
   `ai.view_history` alone never exposes another employee's Coach questions.
8. Problem Solving tools stay owned by the Problem Solving orchestrator. Coach
   turns must not register or execute those tools.
9. Organisation switching remains session-bound (`current_organisation_id`).
   Coach history never crosses organisations.

### Logical model routing

Provider-independent classes `economy`, `standard`, and `deep` map to
server-side model IDs. Credentials and mappings are never sent to the browser.

Official OpenAI API identifiers (not ChatGPT product names) used as defaults:

| Class | Default API ID | Why |
| --- | --- | --- |
| `economy` | `gpt-4.1-nano` | Short explanations; 4× cheaper than the current default; supports structured output and tools |
| `standard` | `gpt-4.1-mini` | Same identifier as the existing Problem Solving default (`AI_MODEL_DEFAULT`) |
| `deep` | `gpt-4.1` | Higher-capability model in the same family; reserved for complex reasoning |

Problem Solving continues to use `AI_MODEL_DEFAULT` and is **not** silently
retargeted through class routing. Ordinary Coach Explain uses `economy` only.
There is no automatic cost escalation or unbounded retry.

### 16-question summary

1. Users need context-aware Explain without a Problem Solving case.
2. Authorised by #195 / LEANAI-CONTEXT-04 under programme #183.
3. Foundation for general LeanAI, not speculative polymorphism.
4. Current organisation owns every session row.
5. Composite org FKs, RLS, and session-bound `current_organisation_id`.
6. `can_use_ai`, operational membership, optional site existence in-org.
7. No user metadata, client org IDs, or model-supplied case IDs.
8. Typed CHECK + nullable exact FKs; no `source_type`/`source_id` pairs.
9. Shared AI run/usage infrastructure; Coach vs Problem Solving invariants kept.
10. Usage ledger remains append-only; context provenance is a compact manifest.
11. Manifest stores hashes/keys, not customer transcripts or clickstreams.
12. Org AI disable retains deterministic Coach; sessions stay tenant-owned.
13. Existing idempotency and one-running-run-per-session lock reused.
14. Partial unique index for one active Coach session per membership/intervention.
15. pgTAP covers isolation, dummy-case refusal, suspended orgs, and grants.
16. Smallest change that unblocks CONTEXT-04 without a second orchestrator.

## Consequences

- CONTEXT-04 can assemble compact Coach context and invoke the existing
  orchestrator without dummy cases.
- Problem Solving AI remains backward compatible.
- A later Intelligent Onboarding slice (LEANAI-ONBOARD-01) can reuse Coach
  sessions and `standard` routing without another session model.
- Hosted migrations are **not** applied by this change.
