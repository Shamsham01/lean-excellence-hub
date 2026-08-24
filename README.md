# Lean Excellence Hub

Lean Excellence Hub is a greenfield platform for running and improving an
organisation's Lean management system.

## Current status

- **Implemented:** the Milestone 1 architecture baseline and Milestone 2
  application/tooling baseline.
- **Deferred:** authentication, organisations, memberships, domain migrations,
  RLS, shared capabilities, Lean modules, Benefits, integrations, and all other
  product features require explicit approval for Milestone 3 or later.

Architecture documents describe approved future design as well as implemented
foundations. They are not evidence that deferred controls or features exist.

## Prerequisites

- Node.js 24 or later and npm 11 or later
- Docker for the local Supabase stack and database tests

## Setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:start
npm run db:status
```

Replace the publishable-key placeholder in `.env.local` with the local
publishable key reported by Supabase, then start the application:

```powershell
npm run dev
```

The application is available at `http://127.0.0.1:3000`. Environment validation
fails early when either required publishable Supabase value is missing or
malformed. Never put a secret or service-role key in a `NEXT_PUBLIC_` variable.

## Development commands

- `npm run dev` — start the Next.js development server.
- `npm run build` / `npm start` — create and serve the production build.
- `npm run lint` — run the Next.js ESLint rules.
- `npm run format` / `npm run format:check` — write or check Prettier formatting.
- `npm run typecheck` — run strict TypeScript without emitting files.
- `npm test` / `npm run test:watch` — run or watch Vitest unit tests.
- `npm run test:e2e` — run the Playwright application-shell smoke test.
- `npm run db:start`, `db:status`, `db:stop`, `db:reset` — manage local Supabase.
- `npm run db:lint` — lint the local PostgreSQL schema.
- `npm run test:db` — run pgTAP database baseline tests.
- `npm run db:types` — generate local database types into
  `src/platform/supabase/database.types.ts`.
- `npm run db:seed-demo` — seed the local-only Apex Manufacturing demo tenant
  (see [demo seed guide](docs/development/demo-seed.md)).
- `npm run validate` — run formatting, lint, types, units, and production build.

Run `npm run test:e2e:install` once if Chromium is not already installed.
Supabase commands require Docker. The generated database types are intentionally
untracked until an approved milestone adds application schema.

## Architecture baseline

- [Normalised product brief](docs/product/lean-hub-brief.md)
- [Platform architecture](docs/architecture/platform-architecture.md)
- [Data model](docs/architecture/data-model.md)
- [Security model](docs/architecture/security-model.md)
- [Threat model](docs/architecture/threat-model.md)
- [Milestone scope and acceptance](docs/architecture/milestone-scope-and-acceptance.md)
- [Architecture decision records](docs/adr/)

## Repository shape

```text
.github/workflows/    Non-secret continuous integration
.cursor/agents/       Read-only specialist definitions
docs/                 Product, architecture, and ADR source of truth
src/app/              Thin Next.js App Router shell
src/platform/         Cross-domain tooling and platform boundaries
supabase/             Local configuration, migrations, and database tests
tests/unit/           Vitest unit tests
tests/e2e/            Playwright smoke tests
```

Business domains under `src/modules/` remain absent until their milestones are
approved.

## Deliberate dependencies

- Next.js, React, and React DOM provide the approved App Router runtime.
- Tailwind CSS and its PostCSS integration provide token-driven styling.
- `next-themes` supplies light, dark, and system-theme state without product UI.
- Zod validates explicit public and server environment boundaries.
- ESLint, Prettier, and strict TypeScript enforce source quality.
- Vitest, Testing Library, jsdom, and Playwright establish unit and E2E testing.
- The Supabase CLI provides reproducible local PostgreSQL, migrations, pgTAP
  tests, schema linting, and database type generation.

No Supabase application client is introduced yet because Milestone 2 has no
database-backed business behaviour.

## Deployment

The application uses standard Next.js build and runtime behaviour. Netlify
detects supported Next.js applications and supplies its OpenNext adapter without
repository-specific runtime code, so no Netlify package or configuration file is
required. Configure the two publishable environment variables in the deployment
environment. This keeps deployment configuration minimal and replaceable.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Preserve
milestone boundaries, British spelling, tenant-safe terminology, and the
distinction between decisions and implemented controls.
