# Lean Excellence Hub

Lean Excellence Hub is a multi-tenant application for running and improving an organisation's Lean management system.

## Current modules

Teams can run Maturity assessments, 5S audits and Gemba walks, schedule activities, and raise actions from findings. Actions, CI Projects, Suggestions, Benefits and Problem Solving track improvement work. People, Training and Skills support workforce development. LeanAI supports setup and facilitation, with human approval for proposed changes.

Go-live and customer onboarding are targeted for January 2027. See the [release snapshot](docs/qa/PROJECT-CURRENT-STATE.md) and [module map](docs/knowledge/modules.md).

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

In `.env.local`, use the local API URL and publishable key from `db:status`.
Set the server-only `SUPABASE_SECRET_KEY` to the local secret key and replace
`AUTH_RATE_LIMIT_PEPPER` with a random value of at least 32 characters.
The example uses the fake billing provider and disables AI. See
[the environment template](.env.example) for optional integrations.

```powershell
npm run dev
```

Open `http://127.0.0.1:3000`. Keep secret keys out of `NEXT_PUBLIC_` variables.

## Development commands

- `npm run dev` — start the Next.js development server.
- `npm run build` / `npm start` — create and serve the production build.
- `npm run lint` — run the Next.js ESLint rules.
- `npm run format` / `npm run format:check` — write or check Prettier formatting.
- `npm run typecheck` — run strict TypeScript without emitting files.
- `npm test` / `npm run test:watch` — run or watch Vitest unit tests.
- `npm run test:e2e` — run the Playwright suite (use `test:e2e:smoke` for the smoke subset).
- `npm run db:start`, `db:status`, `db:stop`, `db:reset` — manage local Supabase.
- `npm run db:lint` — lint the local PostgreSQL schema.
- `npm run test:db` — run pgTAP database tests.
- `npm run db:types` — generate local database types into
  `src/platform/supabase/database.types.ts`.
- `npm run db:seed-demo` — seed the local-only Apex Manufacturing demo tenant
  (see [demo seed guide](docs/development/demo-seed.md)).
- `npm run validate` — run formatting, lint, types, units, and production build.

Run `npm run test:e2e:install` once if Chromium is not already installed.
Supabase commands require Docker. Commit generated database types alongside schema changes. Database CI checks for drift.

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
src/app/              Marketing, authentication and platform routes
src/modules/          Domain logic and module setup
src/platform/         Cross-domain tooling and platform boundaries
supabase/             Local configuration, migrations, and database tests
tests/unit/           Vitest unit tests
tests/e2e/            Playwright browser journeys
```

Shared components live under `src/components/`.

## Deliberate dependencies

- Next.js, React, and React DOM provide the approved App Router runtime.
- Tailwind CSS and its PostCSS integration provide token-driven styling.
- `next-themes` supplies light, dark, and system-theme state.
- Zod validates explicit public and server environment boundaries.
- ESLint, Prettier, and strict TypeScript enforce source quality.
- Vitest, Testing Library, jsdom, and Playwright establish unit and E2E testing.
- The Supabase CLI provides reproducible local PostgreSQL, migrations, pgTAP
  tests, schema linting, and database type generation.

The app uses Supabase SSR and JavaScript clients for authentication and data access.

## Deployment

[netlify.toml](netlify.toml) configures the Next.js adapter and build command.
See the [release procedure](docs/knowledge/deploy-release.md) for environment and migration checks.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Preserve
milestone boundaries, British spelling, tenant-safe terminology, and the
distinction between decisions and implemented controls.
