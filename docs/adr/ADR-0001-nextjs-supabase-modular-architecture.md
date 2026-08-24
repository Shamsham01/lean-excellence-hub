# ADR-0001: Next.js and Supabase modular architecture

## Status

Accepted for future implementation; no application scaffold exists in Milestone 1.

## Context

Lean Hub needs a web platform that can grow across Lean domains, external APIs, imports, and workers without embedding business rules in UI routes or exposing database shapes as the permanent public contract. It needs managed identity, relational integrity, row-level tenant enforcement, private object storage, local development, and generated types.

## Decision

Use Next.js App Router with strict TypeScript and Supabase Auth, PostgreSQL, and Storage. Use local Supabase development and generated database types when application tooling is approved.

Organise future code by domain under `src/modules/` and cross-domain capabilities under `src/platform/`. Route components, route handlers, server actions, future `/api/v1` endpoints, and import workers are adapters over shared application use-cases. Business transitions and transactional orchestration belong in those use-cases.

Use caller-scoped Supabase clients by default so RLS remains effective. Reserve service-role access for isolated workers and controlled administration, with explicit re-authorisation, least privilege, audit, and tests.

## Consequences

- Web, API, and worker entry points can share rules without sharing transport contracts.
- Supabase provides a coherent security and data platform while PostgreSQL remains the integrity boundary.
- Domain modules remain typed and independently understandable.
- Cross-domain abstractions require demonstrated shared semantics and the 16-question decision rule.
- Milestone 2 must keep dependencies minimal and prove lint, formatting, types, tests, CI, and production build.
- Authentication, tables, migrations, RLS, shared capabilities, and domains remain deferred to Milestone 3+.
