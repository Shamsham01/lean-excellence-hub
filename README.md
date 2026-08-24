# Lean Excellence Hub

Lean Excellence Hub is a greenfield, multi-tenant platform for running and improving an organisation's Lean management system. This repository currently contains the approved Milestone 1 product and architecture baseline only.

## Current status

- **Implemented now:** repository guidance, product brief, architecture decisions, security and threat models, milestone boundaries, and read-only specialist agent definitions.
- **Next (Milestone 2):** a minimal Next.js App Router and strict TypeScript shell, local Supabase configuration, quality tooling, tests, CI, and a verified production build.
- **Deferred:** authentication UX, tenancy, database migrations, RLS, shared capabilities, Lean modules, Benefits, integrations, and other product features require explicit approval for Milestone 3 or later.

Nothing in the architecture documents should be read as implemented unless it is explicitly labelled as part of the current foundation.

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
.cursor/agents/       Read-only project specialist definitions
docs/product/         Product source of truth
docs/architecture/    Platform, data, security, threat, and scope models
docs/adr/             Numbered architecture decision records
```

Application directories such as `src/` and `supabase/` are intentionally absent. They belong to later approved milestones.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. In particular, preserve milestone boundaries, British spelling, tenant-safe terminology, and the distinction between decisions made now and implementation deferred.
