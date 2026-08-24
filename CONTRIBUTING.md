# Contributing

## Scope first

Every change must identify its approved milestone. Milestone 1 is documentation and repository architecture only. Milestone 2 is the next delivery milestone. Milestone 3 and later work must not be implemented without explicit approval.

Do not add speculative tables, placeholder modules, dependencies, generated output, credentials, build artefacts, or framework scaffolding to make later work appear started. Architecture documents may reserve seams, but must label them **architecture now; implementation later**.

## Naming and language

- Use British spelling in product and domain language: `organisation`, `authorisation`, `normalised`, and `realisation`.
- Use stable domain terms from the [product brief](docs/product/lean-hub-brief.md). Do not alternate between tenant/customer/company where `organisation` is meant.
- Use `kebab-case` for Markdown filenames and directories, except numbered ADRs, which use `ADR-NNNN-kebab-case-title.md`.
- Future TypeScript files should use `kebab-case`; exported types and components use `PascalCase`; functions and variables use `camelCase`; constants use descriptive `UPPER_SNAKE_CASE` only when genuinely constant.
- Future PostgreSQL identifiers use lower-case `snake_case`, plural table names, singular foreign-key prefixes, and `organisation_id` for tenant ownership.
- Permission keys use stable `domain.action` names, for example `benefits.validate`.
- Avoid unexplained abbreviations. `RLS`, `RBAC`, and `MFA` are acceptable after first expansion.

## Architecture changes

Create or supersede an ADR when changing a consequential decision. ADRs include status, context, decision, and consequences. Never rewrite an accepted decision so its history disappears.

Before introducing a platform abstraction, apply the [16-question architectural decision rule](docs/architecture/platform-architecture.md#16-question-architectural-decision-rule). Prefer typed domain models unless multiple domains demonstrably share semantics and lifecycle.

## Security and tenancy

- Treat organisation membership in PostgreSQL as authoritative for authorisation.
- Never trust user-editable metadata or an active-organisation JWT claim.
- Every future tenant-owned row and reference must be demonstrably tenant-safe.
- Supabase Auth is the only credential authority. Never store password hashes in application tables.
- Never commit secrets. Examples and documentation use placeholders only.

## Documentation quality

Use relative links, distinguish current facts from future decisions, and state uncertainty rather than fabricating implementation status. Update affected acceptance criteria and risk documentation when changing scope.

Before handing off documentation changes, inspect all changed files and run non-mutating checks for Git status, broken local links, terminology drift, accidental secrets, generated artefacts, dependencies, framework scaffolding, and out-of-scope implementation.
