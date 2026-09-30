# Lean Excellence Hub — Current Project and Release State

Updated: **2026-09-30**. This is the release-state entry point. Reconcile
GitHub checks, `main` and the hosted Supabase migration ledger again immediately
before any deploy; the figures below are a dated audit, not an automatic
deployment authorisation.

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

## Release checkpoint after #196 merge

- `main` is `591aaa2ba8c067be0e544664d2ae9231b6d15dfb`: PR #196
  passed Fast CI, Database CI and Full Regression and merged on 30 September.
- The repository now has **217** migration files. Hosted Supabase still has
  **216** recorded migrations; the **only** pending file is the canonical
  `20260930103004_leanai_general_coach_sessions.sql`. No hosted Coach
  migration or application deployment was performed in this checkpoint.
- PR #197 has been reconciled onto current `main` at
  `5404124f073d90923e58a4b19fd5de517dbfd12f` and is mergeable.
  Fast CI and targeted database/Full Regression database-core checks have
  passed. The other long-running checks must complete. One existing Windows
  QA database-types test hit its five-second timeout in Full Regression;
  the same Windows harness passed on #196 and the post-merge main run.
- Documentation PR #198 is a draft pending the final #197 regression and
  definitive hosted migration evidence. Refresh this section and the exact
  published application SHA before first-customer approval.

## Verified baseline before Coach-04 merge

- `main` at the 30 September pre-Coach checkpoint:
  `1bcdd26801d53f62c4c29b6df750a3c477093f06`.
- Hosted Supabase project `zsadfvjtknbbfomlmttv`: **216/216** migration
  versions *and names* matched `main` at that checkpoint. The last was
  `20260930081134_sec_rpc_002_billing_leanai_privilege_boundary`.
  Issue #193 (generated-version mismatch) was repaired. Do not reapply it.
- Security Advisor at the same checkpoint: three anonymous and 261
  authenticated SECURITY DEFINER warnings. Intentional invitation bootstrap
  remains public; no global revocation. Audit individual authenticated
  functions separately.
- Billing core #176, lifecycle #177, replacement founder/onboarding #181 and
  QA runbook #179 are merged. The old #178/#180 stacked branches are superseded.
  Billing migrations are in hosted history; **Stripe Sandbox operational setup
  and actual hosted payment/onboarding smoke were not verified** by this audit.
- LeanAI architecture #184, semantic context #186, intervention UI #190 and
  privilege hardening #192 are merged. ADR-0018 adds general Coach sessions
  on top of this foundation.

## Coach-04 release gate (update after merge)

- PR #196: general Coach sessions and logical model routing. Introduces
  `20260930103004_leanai_general_coach_sessions.sql`; **never deploy it while
  review/CI is outstanding**. Existing Problem Solving sessions remain case
  bound. New personal Coach history is creator-only.
- PR #197: stacked Coach Explain; explicit Explain and bounded follow-up,
  economy model routing, no Problem Solving tools, usage ledger reused,
  deterministic fallbacks. It does **not** add another migration.
- Both PRs must pass Fast CI, Database CI and Full Regression at the final
  reviewed heads. Merge #196 before #197, then verify the final `main`
  regression on its merged SHA.
- The hosted Coach migration must retain the **canonical file timestamp**.
  Deploy from the up-to-date repository with the official linked Supabase CLI:
  confirm correct project, inspect `supabase migration list --linked`, run
  `supabase db push --dry-run --linked`, verify the *only* pending file is
  `20260930103004`, run `supabase db push --linked`, and verify the list
  again. Never apply SQL twice or use a tool that generates an untracked
  replacement timestamp; never touch CookieWorks as part of a migration.

## First-customer readiness

After the Coach-04 gate, preserve CookieWorks and create a **new**
Professional/monthly/one-site QA organisation. Follow
[QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md) and
[STRIPE-SANDBOX-ONBOARDING-SMOKE.md](./STRIPE-SANDBOX-ONBOARDING-SMOKE.md).
Use the real Stripe Sandbox webhook (not only a fake local test); confirm
provisioning, billing-state access and recovery, invitations, onboarding,
each module's empty-state setup and the contextual Coach. Capture actual
PASS/FAIL evidence, unresolved blockers and the **exact published Netlify
SHA**. Never silently publish or reset the hosted QA tenant.

Before the **first real customer**, independently close the remaining
security/operational gates, including #194 (billing provider identifiers
visible to ordinary members), final CookieWorks persona smoke, the hosted
security review, privacy/terms and retention wording, Supabase Pro and
leaked-password protection. Commercial plan entitlement enforcement
(BILLING-02) is separate from the merged billing foundation; do not claim it
is implemented.

## Relevant tracking and source documents

- [Pricing/subscriptions/onboarding product decision](../product/pricing-subscription-onboarding-v1.md)
- [Contextual LeanAI architecture](../architecture/leanai-contextual-assistance.md)
- [Coach intervention engine](../architecture/leanai-intervention-engine.md)
- [AI platform boundary](../architecture/ai-platform.md)
- [Historical release-smoke checklist](./RELEASE-SMOKE-01-go-live.md)
- [Historical billing implementation/operator report](./BILLING-001-operator-report.md)
- GitHub: #67 (historical smoke register), #134 (performance), #170 (billing
  programme), #183 (LeanAI contextual programme), #194 (billing API exposure),
  #195 (Coach-04).
