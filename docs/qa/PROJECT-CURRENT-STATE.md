# Lean Excellence Hub — Current Project and Release State

Updated: **2026-09-30** (post-#197 merge). This is the release-state entry
point. Reconcile GitHub checks, `main` and the hosted Supabase migration
ledger again immediately before any deploy; the figures below are a dated
audit, not an automatic deployment authorisation.

## Product intent

Lean Excellence Hub (LEH) digitises each customer's **own** Operational
Excellence operating system. Customers can author/import their existing
maturity, 5S, Gemba, Problem Solving, training and improvement standards.
Optional starter templates and one-click LeanAI assistance accelerate setup;
LEH must not force customers into an unfamiliar proprietary methodology.

The multi-tenant product connects Assess, Improve, Develop and Prove through
common organisation/site permissions, reusable actions, evidence, schedules,
benefits and LeanAI. LeanAI is one contextual assistant, not an uncontrolled
swarm: deterministic readiness and interventions first, user-triggered model
calls when useful, permission-scoped context, no employee surveillance and
human approval before authoritative writes. Future organisational-memory
similarity must search *only readable* suggestions, cases and other records.

## Release checkpoint after #197 merge

- `main` is `70f41c4a4f41cfd46bf3f052597f8414cda36246`: squash-merge of PR
  #197 (Coach Explain) on 30 September. Parent is
  `591aaa2ba8c067be0e544664d2ae9231b6d15dfb` (#196).
- PR #197 head `88b5cde0aa2ebfd46fefab6114b3423865f3cdc1` passed Fast CI
  ([#36725890835](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/36725890835)),
  Database CI
  ([#36725890889](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/36725890889),
  including Windows QA) and Full Regression
  ([#36725890568](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/36725890568),
  including Windows QA). An earlier Windows types-verify 5s timeout was
  fixed on that head; Coach security, session-binding and turn-budget
  behaviour were not changed.
- Merged `main` Full Regression
  ([#36729672720](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/36729672720))
  is green, including Quality, Database, E2E smoke and Windows QA. Fast CI
  and Database CI do not run on `push` to `main`; the Full Regression
  quality job executed the suite on this SHA.
- The repository has **217** migration files. Hosted project
  `zsadfvjtknbbfomlmttv` still has **216** recorded migrations. The **only**
  pending file remains
  `20260930103004_leanai_general_coach_sessions.sql`. Hosted `ai_sessions`
  still has `problem_solving_case_id` `NOT NULL` and does not yet have
  `context_type` / Coach columns. `create_ai_coach_session` is not in the
  hosted schema.
- **Hosted Coach migration was not applied** during this recovery. Official
  CLI `supabase link --project-ref zsadfvjtknbbfomlmttv` failed with
  `LegacyPlatformAuthRequiredError` (no `SUPABASE_ACCESS_TOKEN` in this
  operator environment). MCP `apply_migration` was **not** used. No
  Netlify, Auth, Stripe or CookieWorks mutation was made.
- There is **no** operator-approved published application SHA. Do not treat
  `70f41c4a` as live until a coordinated Netlify deploy happens after the
  hosted migration.

## Verified baseline before Coach-04 merge

- `main` at the 30 September pre-Coach checkpoint:
  `1bcdd26801d53f62c4c29b6df750a3c477093f06`.
- Hosted Supabase project `zsadfvjtknbbfomlmttv`: **216/216** migration
  versions *and names* matched `main` at that checkpoint. The last was
  `20260930081134_sec_rpc_002_billing_leanai_privilege_boundary`.
  Issue #193 (generated-version mismatch) was repaired. Do not reapply it.
- Security Advisor at the 30 September post-#197 audit (hosted, pre-Coach
  migration): three anonymous and 261 authenticated SECURITY DEFINER
  warnings, plus leaked-password protection disabled. Intentional invitation
  bootstrap remains public; no global revocation. Audit individual
  authenticated functions separately.
- Billing core #176, lifecycle #177, replacement founder/onboarding #181 and
  QA runbook #179 are merged. The old #178/#180 stacked branches are superseded.
  Billing migrations are in hosted history; **Stripe Sandbox operational setup
  and actual hosted payment/onboarding smoke were not verified** by this audit.
- LeanAI architecture #184, semantic context #186, intervention UI #190 and
  privilege hardening #192 are merged. ADR-0018 general Coach sessions (#196)
  and Coach Explain (#197) are merged in git only.

## Coach-04 release gate

- PR #196: merged. Introduces
  `20260930103004_leanai_general_coach_sessions.sql`. Existing Problem
  Solving sessions remain case bound. New personal Coach history is
  creator-only.
- PR #197: merged. Explicit Explain and bounded follow-up, economy model
  routing, no Problem Solving tools, usage ledger reused, deterministic
  fallbacks, server-owned session binding and six-turn accounting. It does
  **not** add another migration.
- Remaining schema gate: apply the canonical hosted migration from an
  authenticated operator environment using the official linked CLI. See
  [COACH-04-HOSTED-MIGRATION-RUNBOOK.md](./COACH-04-HOSTED-MIGRATION-RUNBOOK.md).
  Confirm project `zsadfvjtknbbfomlmttv`, `supabase migration list --linked`,
  `supabase db push --linked --dry-run` lists **only** `20260930103004`,
  then `supabase db push --linked` once. Never apply SQL twice or use a tool
  that generates an untracked replacement timestamp; never touch CookieWorks
  as part of a migration.

## First-customer readiness

**Still outstanding before a fresh-organisation human smoke test:**

1. Apply canonical hosted migration `20260930103004` with the official
   linked CLI, then verify Coach schema, RPC security and Security Advisor.
2. Coordinated Netlify deploy of an approved SHA **after** that migration.
   Do not deploy incidentally.
3. Stripe Sandbox products, webhook and hosted payment/onboarding smoke
   (not only fake local tests).
4. A **new** Professional/monthly/one-site QA organisation following
   [QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md) and
   [STRIPE-SANDBOX-ONBOARDING-SMOKE.md](./STRIPE-SANDBOX-ONBOARDING-SMOKE.md).
   Preserve CookieWorks; do not reset the hosted QA tenant.
5. Capture PASS/FAIL evidence for provisioning, billing-state access and
   recovery, invitations, onboarding, each module empty-state, and
   contextual Coach Explain.

**Still outstanding before the first real customer:** #194 (billing provider
identifiers visible to ordinary members), final CookieWorks persona smoke,
hosted security review of authenticated SECURITY DEFINER functions,
privacy/terms and retention wording, Supabase Pro, and leaked-password
protection. Commercial plan entitlement enforcement (BILLING-02) is separate
from the merged billing foundation; do not claim it is implemented.

## Relevant tracking and source documents

- [Pricing/subscriptions/onboarding product decision](../product/pricing-subscription-onboarding-v1.md)
- [Contextual LeanAI architecture](../architecture/leanai-contextual-assistance.md)
- [Coach intervention engine](../architecture/leanai-intervention-engine.md)
- [AI platform boundary](../architecture/ai-platform.md)
- [Hosted Coach migration runbook](./COACH-04-HOSTED-MIGRATION-RUNBOOK.md)
- [Historical release-smoke checklist](./RELEASE-SMOKE-01-go-live.md)
- [Historical billing implementation/operator report](./BILLING-001-operator-report.md)
- GitHub: #67 (historical smoke register), #134 (performance), #170 (billing
  programme), #183 (LeanAI contextual programme), #194 (billing API exposure),
  #195 (Coach-04), #196, #197, #198.
