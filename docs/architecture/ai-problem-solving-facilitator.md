# AI Problem Solving Facilitator (Milestone 12)

## Purpose

Stage-aware Lean AI embedded in the Problem Solving case workspace. Modes: Facilitate, Challenge,
Review, Ask.

## Boundaries

AI **may**: read authorised case semantics, propose hypotheses/tests/containment/countermeasures,
facilitate human sessions, cite sources from allowlisted records.

AI **must not**: verify root cause, close cases, approve benefits, assign RBAC, execute arbitrary
SQL, or use service-role for ordinary workflows.

## M11 semantic invariants

The facilitator reinforces: observation ≠ fact, hypothesis ≠ root cause, containment ≠
countermeasure, action completed ≠ problem solved, case closed ≠ necessarily verified cause.

## Session model

- **M11 `problem_solving_sessions`** — authoritative human team sessions
- **M12 `ai_sessions`** — AI interaction log, optional link to human session
- AI sessions are **private-by-author** by default; not exposed to all case readers

## Proposals

Typed proposals only. Acceptance invokes exact M11 public RPCs via application-side service with
human as `created_by`. Provenance in `ai_acceptance_provenance` (typed FKs).

Forbidden proposal types: verify root cause, close case, benefit approval, RBAC, countermeasure
selection, effectiveness PASS recording.

## Similar cases

`search_similar_problem_solving_cases` returns only cases the caller can currently read via
`can_read_problem_solving_case` (not broad org view alone).
