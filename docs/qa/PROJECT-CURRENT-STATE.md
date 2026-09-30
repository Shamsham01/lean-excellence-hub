# Lean Excellence Hub — Current Project and Release State

Updated: **2026-09-30** (hosted Coach-04 migration applied). This is the
release-state entry point. Reconcile GitHub checks, `main` and the hosted
Supabase migration ledger again immediately before any deploy; the figures
below are a dated audit, not an automatic application-publication
authorisation.

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

## Release checkpoint after hosted Coach-04 migration

- Inspected git `main`:
  `74aa551c3e3166599de60f76175517bec203daf0` (squash-merge of docs PR
  #198). Coach application code is in parent
  `70f41c4a4f41cfd46bf3f052597f8414cda36246` (#197), itself parented by
  `591aaa2ba8c067be0e544664d2ae9231b6d15dfb` (#196).
- Hosted project `zsadfvjtknbbfomlmttv` (`eu-west-1`, `ACTIVE_HEALTHY`) now
  has **217/217** migration versions *and names* matching the repository.
  Official CLI `npx supabase` v2.115.0 applied the canonical file
  `20260930103004_leanai_general_coach_sessions.sql` **once** via
  `supabase db push --linked`. Remote history records version
  `20260930103004` / name `leanai_general_coach_sessions`. There is **no**
  generated replacement timestamp. A follow-up dry run reports the remote
  database up to date.
- Pre-apply gate (linked CLI): 216 matched through
  `20260930081134_sec_rpc_002_billing_leanai_privilege_boundary`; the only
  pending file was `20260930103004`. MCP `apply_migration` was **not** used.
  Migration history was **not** repaired. CookieWorks, Stripe and Netlify
  were **not** mutated.
- Hosted `ai_sessions` now has `context_type` `NOT NULL` (default
  `problem_solving`) and nullable `problem_solving_case_id`, plus
  `module_key`, `intervention_key`, `site_unit_id` and
  `context_contract_version`. RLS remains enabled and forced. Binding and
  mode checks from ADR-0018 are present.
- `public.create_ai_coach_session` is SECURITY INVOKER, `search_path=""`,
  EXECUTE for `authenticated` only. `public.get_ai_session_detail` remains
  SECURITY DEFINER and guarded. Existing Problem Solving
  `public.create_ai_session(uuid, text, uuid, text)` remains. Hosted
  `ai_sessions` contained 0 rows at apply time, so existing case-bound
  sessions did not need backfill.
- Security Advisor after apply (official CLI `--type security`): **3**
  anonymous SECURITY DEFINER warnings, **261** authenticated SECURITY
  DEFINER warnings, leaked-password protection disabled. Unchanged from the
  pre-Coach audit. Intentional invitation bootstrap remains public; no
  global revocation. `public.create_ai_coach_session` is not flagged.
- **There is still no operator-approved published application SHA.** Do not
  treat `74aa551c` or `70f41c4a` as live until a coordinated Netlify deploy
  happens after this schema change.
- Code-gate CI: PR #197 Full Regression
  ([#36729672720](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/36729672720))
  is green. The later docs-only `main` push `74aa551c` Full Regression
  ([#36733771089](https://github.com/Shamsham01/lean-excellence-hub/actions/runs/36733771089))
  failed on E2E platform `five-s-journeys.spec.ts` (image-evidence
  save-status timeout). Quality, Database core, Windows QA and the other
  E2E shards on that run were green. That flake does not undo the hosted
  schema apply; it does block treating `74aa551c` as a publish SHA.

## Verified baseline before Coach-04 merge

- `main` at the 30 September pre-Coach checkpoint:
  `1bcdd26801d53f62c4c29b6df750a3c477093f06`.
- Hosted Supabase project `zsadfvjtknbbfomlmttv` was **216/216** through
  `20260930081134_sec_rpc_002_billing_leanai_privilege_boundary`. Issue
  #193 (generated-version mismatch) was repaired. Do not reapply it.
- Security Advisor at the 30 September post-#197 audit (hosted, pre-Coach
  migration): three anonymous and 261 authenticated SECURITY DEFINER
  warnings, plus leaked-password protection disabled. Post-apply counts
  match that baseline.
- Billing core #176, lifecycle #177, replacement founder/onboarding #181 and
  QA runbook #179 are merged. The old #178/#180 stacked branches are superseded.
  Billing migrations are in hosted history; **Stripe Sandbox operational setup
  and actual hosted payment/onboarding smoke were not verified** by this audit.
- LeanAI architecture #184, semantic context #186, intervention UI #190 and
  privilege hardening #192 are merged. ADR-0018 general Coach sessions (#196)
  and Coach Explain (#197) are merged. The hosted schema for #196 is now
  applied.

## Coach-04 release gate

- PR #196: merged **and hosted**. Introduces
  `20260930103004_leanai_general_coach_sessions.sql`. Existing Problem
  Solving sessions remain case bound. New personal Coach history is
  creator-only.
- PR #197: merged. Explicit Explain and bounded follow-up, economy model
  routing, no Problem Solving tools, usage ledger reused, deterministic
  fallbacks, server-owned session binding and six-turn accounting. It does
  **not** add another migration.
- Hosted schema gate: **complete** for canonical `20260930103004` on
  project `zsadfvjtknbbfomlmttv`. See
  [COACH-04-HOSTED-MIGRATION-RUNBOOK.md](./COACH-04-HOSTED-MIGRATION-RUNBOOK.md).
  Do not replay the file. Do not use a tool that generates an untracked
  replacement timestamp. Do not touch CookieWorks as part of a migration.

## First-customer readiness

**Still outstanding before a fresh-organisation human smoke test:**

1. ~~Apply canonical hosted migration `20260930103004`.~~ **Done** on
   30 September 2026 with the official linked CLI. Coach schema, RPC
   security and Security Advisor were re-checked after apply.
2. Coordinated Netlify deploy of an approved SHA **after** that migration.
   Do not deploy incidentally. Current `main` `74aa551c` is not an approved
   publish SHA (docs-only merge; later Full Regression platform shard
   flake).
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

Do **not** mark the customer-readiness gate complete merely because the
hosted Coach migration succeeded.

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
