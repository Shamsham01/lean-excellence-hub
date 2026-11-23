# Modules map

Domain folders under `src/modules/` (each typically owns setup, permissions, and UI adapters via `src/app/`).

| Module folder | Product area | Maturity |
| --- | --- | --- |
| `problem-solving` | Cases, sessions, facilitator AI | **Implemented** (hypothesis tests, manual fishbone and guarded closure, #402–#404, #407, #409, #418) |
| `skills` | Competence/skills setup + LeanAI builder | **Implemented** (validation methods and unit-scoped requirements, #391, #392) |
| `maturity` | Maturity frameworks + AI builder | **Implemented** |
| `training` | Courses/curriculum (platform routes) | **Implemented** |
| `5s` | Score-only Quick Start, site-scoped standards and audit actions (#389, #390, #399, #400) | **Implemented** |
| `gemba` | Site-scoped definitions, observation actions and schedule activity selection (#390, #401, #405) | **Implemented** |
| `operational` | Operational excellence tooling | **Implemented** |
| `workplace` | Workplace structure | **Implemented** |
| `people` / `workforce-import` / `workforce-provision` | Workforce identity & import | **Implemented** |
| `organisation*` / `organisations` | Org lifecycle, rollout, invitations and single-step activation (#376, #379) | **Implemented** |
| `rbac2` | Version-bound RBAC | **Implemented** |
| `billing` | Stripe sandbox entitlements | **Implemented** (plan gates and credit accounting on main, #374) |
| `leanai-context` | General LeanAI coach sessions | **Implemented** (ADR-0018) |
| `module-setup` | Shared module setup shell | **Implemented** (#368) |
| `platform-admin` / `platform-shell` | Admin chrome | **Implemented** |
| `settings` | Org settings incl. AI toggles | **Implemented** |
| `suggestions` | Suggestions module | **Implemented** (approval routing and permission-scoped related suggestions and actions, #375, #364) |
| `identity` | Identity adapters | **Implemented** |

Actions Planner supports labels, checklists, comments and attachments (#394, #395). Its project picker can link actions to Draft and On hold projects (#405, #419). The notification bell opens the source record (#383). Scheduled in-app chases are implemented and stay off until founder approval (#378, #380).

## LeanAI consumers (**Implemented**)

- Problem Solving facilitator — `src/platform/ai/orchestrator.ts`
- Module setup builders — `src/platform/ai/module-setup-builder-orchestrator.ts`
- Coach / contextual assistance — `src/components/leanai/`, `src/modules/leanai-context/`

## Cross-module intelligence

Permission-scoped operational search (#366) and module knowledge bundles (#370) shipped. The learning graph and proactive advisory remain roadmap items (#314).

## Reference patterns

- Module setup pattern: `docs/architecture/leh-module-setup-pattern.md`
- Problem solving engine: `docs/architecture/problem-solving-engine.md`
