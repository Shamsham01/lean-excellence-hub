# Supabase security & RLS conventions

## Principles (**Implemented** — verify per migration)

- **Default deny** between organisations (`docs/architecture/security-model.md`).
- **Caller-scoped** Supabase client for user-initiated mutations; RLS enforced.
- **Private schema** (`private.*`) for authorisation helpers and sensitive RPC bodies; public wrappers grant least privilege.
- **Session-bound org context** — selection stored for current auth session (ADR-0006).

## AI-specific (**Implemented**)

- `private.can_use_ai()` — membership, `ai.use`, org `ai_enabled`, DB-side limits (ADR-0013).
- Run lifecycle RPCs: `start_ai_run`, `finish_ai_run`, `fail_ai_run`, `claim_ai_run_execution` — see `supabase/migrations/20260827009007_milestone12_ai_run_operations.sql` and `20261104193000_ai_run_execution_claim.sql`.
- Private-by-author AI sessions; case read alone does not grant chat history.

## Problem Solving RPCs (**Implemented**, #331)

- Draft/create/activate/session start via `private.*` functions wrapped in public RPCs.
- Pinned draft activation: draft cases may store `method_version_id` before activation; `activate_problem_solving_case` must honour that exact version (see migration `20261105113335_problem_solving_activate_pinned_draft.sql`).

## Invitations (**Implemented**, intentional anon)

- `preview_organisation_invitation` / `prepare_organisation_invitation_signup_binding` — token digest path. Branded invitation delivery and single-step activation reuse an active signup binding for parallel attempts (#376).

## CI project writes and repair

- #421 (issue #420) guards status, lifecycle dates, charter submission, methodology version, identity, scope and timestamps on `public.ci_projects`. Only `lean_hub_private_owner` can change protected columns. For a repair, use `set local role lean_hub_private_owner;` **inside the same transaction** as the update. The guard runs before the timestamp trigger. See the [database repair guidance](../../supabase/README.md).
- #423 (issue #422) removed the 13 authenticated column UPDATE grants left by #421 and dropped the direct-update RLS policy. Application writes go through owner-controlled project RPCs.
- #424 removed PUBLIC and anon EXECUTE from four private helpers. Authenticated keeps EXECUTE on `can_read_ci_project` for SELECT policies. `can_edit_ci_project`, `guard_ci_project_child_completed_immutable` and `instantiate_ci_project_phases` have owner-only EXECUTE. [Project security tests](../../supabase/tests/database/ci_projects_security.test.sql) cover the ACLs.
- Hosted migrations must carry the version in the repository filename. See the [November migration version ledger](../operations/migration-version-ledger-nov-2026.md).

## Testing (**Implemented**)

- pgTAP: `supabase/tests/database/*.sql`, run via `npm run test:db`.
- Type drift: `npm run db:types` checked in Database CI.

## Advisors & DEFINER (**Operational**)

- Hosted advisor counts documented in QA runbooks; remediations require reviewed migrations — agents must not apply on production.

## Preview vs production DB (**Open question**)

- If preview deployments reuse production `NEXT_PUBLIC_SUPABASE_URL`, RLS does not prevent **writes to production** from preview code — policy needed (R0 epic). No credential values in this doc.
