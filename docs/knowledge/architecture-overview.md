# Architecture overview

## Stack (**Implemented**)

| Layer | Location | Notes |
| --- | --- | --- |
| Web app | `src/app/` (Next.js App Router) | Marketing + authenticated platform routes |
| Domain modules | `src/modules/*` | Business use-cases per domain |
| Shared platform | `src/platform/*` | Supabase clients, AI, auth helpers |
| Database | `supabase/migrations/` | PostgreSQL + RLS + private RPCs |
| Edge workers | `supabase/functions/` | Notifications / delivery (**Implemented**, scoped) |
| Tests | `tests/unit/`, `tests/e2e/`, `tests/integration/` | Tiered CI |

## Tenancy model (**Implemented**)

- Supabase Auth session + **session-bound organisation selection** in Postgres (ADR-0006).
- Authorisation: membership, permissions, row `organisation_id`; JWT/org route hints are untrusted.
- Docs: `docs/architecture/platform-architecture.md`, `docs/architecture/security-model.md`.

## AI boundary (**Implemented** with constraints)

- AI is **not** an org member; proposals require human acceptance via domain RPCs (ADR-0013).
- Foreground execution on Netlify; no background worker for facilitator turns on `main` (async design **Proposed** in incidents).

## Hosting (**Implemented**)

- Production site on Netlify (Next.js adapter); synchronous server/route handlers subject to **~60s** platform limit (not configurable per PR #327).
- Env template: `.env.example` (publishable vs server-only split).

## Deploy / DB coupling (**Implemented**, risk noted)

- Hosted app env points at a Supabase project; migration head must match features on deployed SHA (`docs/qa/PROJECT-CURRENT-STATE.md`).
- **Open question:** whether Netlify **deploy previews** share production Supabase credentials — treat as **unsafe until proven otherwise**; R0 requires explicit preview/prod separation policy (see [known-issues.md](./known-issues.md)).

## Evolution seams (**Mixed**)

| Seam | Status |
| --- | --- |
| Idempotency keys on AI turns | **Implemented** (`start_ai_run`, client keys) |
| Generic transactional outbox for all domains | **Proposed** (ADR-0003; N1a notification outbox **Implemented**) |
| Universal resource registry | **Proposed** |
| Offline/PWA queues | **Proposed** |
