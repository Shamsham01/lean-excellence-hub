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

## Problem Solving RPCs (**Implemented**, bug #324)

- Draft/create/activate/session start via `private.*` functions wrapped in public RPCs.
- Known mismatch: pinned draft method vs activate validation — tracked #324.

## Invitations (**Implemented**, intentional anon)

- `preview_organisation_invitation` / `prepare_organisation_invitation_signup_binding` — token digest path; documented in `docs/qa/PROJECT-CURRENT-STATE.md`.

## Testing (**Implemented**)

- pgTAP: `supabase/tests/database/*.sql`, run via `npm run test:db`.
- Type drift: `npm run db:types` checked in Database CI.

## Advisors & DEFINER (**Operational**)

- Hosted advisor counts documented in QA runbooks; remediations require reviewed migrations — agents must not apply on production.

## Preview vs production DB (**Open question**)

- If preview deployments reuse production `NEXT_PUBLIC_SUPABASE_URL`, RLS does not prevent **writes to production** from preview code — policy needed (R0 epic). No credential values in this doc.
