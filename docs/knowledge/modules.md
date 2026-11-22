# Modules map

Domain folders under `src/modules/` (each typically owns setup, permissions, and UI adapters via `src/app/`).

| Module folder | Product area | Maturity |
| --- | --- | --- |
| `problem-solving` | Cases, sessions, facilitator AI | **Implemented** (P0 fixes in flight #324, #326) |
| `skills` | Competence/skills setup + LeanAI builder | **Implemented** (#325 contract issue) |
| `maturity` | Maturity frameworks + AI builder | **Implemented** |
| `training` | Courses/curriculum (platform routes) | **Implemented** |
| `5s` | 5S workplace module | **Implemented** |
| `gemba` | Gemba walks | **Implemented** |
| `operational` | Operational excellence tooling | **Implemented** |
| `workplace` | Workplace structure | **Implemented** |
| `people` / `workforce-import` / `workforce-provision` | Workforce identity & import | **Implemented** |
| `organisation*` / `organisations` | Org lifecycle, onboarding, rollout, setup | **Implemented** |
| `rbac2` | Version-bound RBAC | **Implemented** |
| `billing` | Stripe sandbox entitlements | **Implemented** (not merged/deployed per QA billing report — verify current branch) |
| `leanai-context` | General LeanAI coach sessions | **Implemented** (ADR-0018) |
| `module-setup` | Shared module setup shell | **Implemented** / extending (#267 **Proposed**) |
| `platform-admin` / `platform-shell` | Admin chrome | **Implemented** |
| `settings` | Org settings incl. AI toggles | **Implemented** |
| `suggestions` | Suggestions module | **Implemented** (LEANAI similarity epics **Proposed** #312) |
| `identity` | Identity adapters | **Implemented** |

## LeanAI consumers (**Implemented**)

- Problem Solving facilitator — `src/platform/ai/orchestrator.ts`
- Module setup builders — `src/platform/ai/module-setup-builder-orchestrator.ts`
- Coach / contextual assistance — `src/components/leanai/`, `src/modules/leanai-context/`

## Cross-module intelligence (**Proposed**)

Issues #310–#314 (superpowers, knowledge, retrieval, advisory) — design docs in `docs/architecture/leanai-*.md`, not fully shipped.

## Reference patterns

- Module setup pattern: `docs/architecture/leh-module-setup-pattern.md`
- Problem solving engine: `docs/architecture/problem-solving-engine.md`
