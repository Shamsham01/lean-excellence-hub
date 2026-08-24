# ADR-0005: Universal versioned template engine

## Status

Accepted for later shared-foundation implementation; conceptual only in Milestone 1.

## Context

Gemba, 5S, Leader Standard Work, maturity assessments, and similar experiences all need configurable sections, questions, submissions, and answers. Independent engines would duplicate publication, history, reporting, attachment, action, and permission behaviour. Editing published questions in place would make historical answers ambiguous. Conversely, forcing curricula or structured problem-solving into a generic questionnaire would erase genuinely different semantics.

## Decision

Build one reusable engine with:

- stable template identity;
- immutable template versions with Draft, Published, and Archived lifecycle metadata;
- reusable, ordered sections and questions owned by an exact version;
- submissions that reference the exact template version used;
- answers that reference the exact versioned question;
- transactional publication and successor-version creation;
- no in-place edits to published content;
- shared resource identity for actions, attachments, workflow, audit, and events where applicable;
- organisation ownership, composite tenant integrity, RLS, optimistic concurrency, and idempotent submission operations.

Gemba, 5S, Leader Standard Work, maturity, and comparable configurable audit/form experiences consume this engine through typed experience configuration and application use-cases. Add typed domain extensions only when semantics genuinely differ, including training curricula and structured problem-solving. A typed extension may reference templates for a form step without making its full domain lifecycle generic.

## Consequences

- Publication and historical reporting are consistent across configurable form experiences.
- New question types and validation rules require compatibility and rendering discipline.
- Published-version immutability increases stored versions but removes ambiguity.
- The engine must not become an arbitrary no-code data model or visual workflow designer.
- Domain-specific scoring, transitions, and reporting remain in domain services when they are not truly universal.
- Later acceptance requires immutability, exact-version answer traceability, transactional publication, tenant isolation, concurrent draft handling, and migration compatibility tests.
