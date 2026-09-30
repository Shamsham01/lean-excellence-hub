# RELEASE-SMOKE-01 — Go-live blockers and deployment checklist

> **Release-state notice (30 September 2026):** The original checklist below
> is a historical gate review from 29 September, not a current declaration
> of hosted schema state. For the maintained merge/migration/CI status and
> remaining customer-release gates, see
> [PROJECT-CURRENT-STATE.md](./PROJECT-CURRENT-STATE.md).
>
> The original report predates merged Stripe/onboarding and LeanAI work.
> Its claims that billing was not implemented and no migrations existed
> after `20260928210635` must **not** be used for deployment decisions.
> Check the actual hosted migration ledger and current `main` before every
> migration push; never replay historical files.

---

## Historical go-live checkpoint (29 September 2026)


**This document is planning only.** Automated agents and implementation PRs must not mutate hosted Supabase, CookieWorks fixtures, Auth, Netlify, or billing.

Inspected read-only on 2026-09-29 (FIRST-CUSTOMER-READINESS-01):

- GitHub `main` = `ad6edcec5972fba6a9c5d51a0bc9ee8bedcedd98` (#168). Includes merged #153, #156, #158, #161, #166, #168.
- Hosted project `zsadfvjtknbbfomlmttv` (eu-west-1, `ACTIVE_HEALTHY`)
- Hosted migration list matches the repository through `20260928210635_maturity_assessor_review_and_action_lineage`
- No later migration is committed
- Production `https://leanexcellencehub.com`: HTTP **200**, `server: Netlify`, `x-powered-by: Next.js`. Exact production git SHA is **not** in public response headers. Do not publish or change Netlify config.

---

## Go / no-go

Two different gates:

| Gate | Status | Blocks billing/onboarding **development**? |
| --- | --- | --- |
| P0/P1 **product-code** blockers on `main` | **None** | No |
| Hosted schema vs `main` | **Matched** through `20260928210635` | No |
| SEC-RPC-001 and suggestion-listing migrations | **Applied hosted.** Do not replay | No |
| Leaked-password protection | **Deferred** until Supabase Pro, immediately before the first real customer | **No.** Not a present development blocker |
| Authenticated `SECURITY DEFINER` audit | **Deferred.** Do not globally revoke | No |
| Hosted CookieWorks protocol | **Not yet recorded** on the updated checklist | **No.** Record it in parallel. A new reproduced P0/P1 would stop the transition |
| Exact production git SHA in public headers | **Unverified** | No. Operator exercise already covered the recent Maturity authoring behaviour |
| Stripe / subscription schema | **Not implemented** (intentionally) | This is the next development task, not a missing hotfix |

**Verdict: READY FOR BILLING/ONBOARDING DEVELOPMENT.**

First **real customer** cutover is a later operator gate: run `docs/qa/RELEASE-SMOKE-01-protocol.md`, upgrade the Supabase project from Free to Pro, and enable leaked-password protection before that customer is invited. Those steps are not prerequisites for starting sandbox subscription work.

---

## Deployment checklist (maintainer, explicit approval each row)

### A. Pre-flight (read-only)

- [x] `main` recorded: `ad6edcec5972fba6a9c5d51a0bc9ee8bedcedd98`
- [x] Hosted `supabase migration list` latest: `20260928210635` (read-only, 2026-09-29)
- [ ] Fast CI + Full Regression green on the SHA that will be published, when a publish is authorised
- [ ] Dry-run only, if a tenant reset is ever approved: `npm run qa:cookie:hosted-replacement -- --dry-run`

### B. Hosted migrations — do not replay

| Version | Name | Hosted? | Action |
| --- | --- | --- | --- |
| `20260923233254` | `training_curriculum_requirement_authoring` | **Yes** | Do not replay |
| `20260924111211` | `perf_delegatable_access_offers` | **Yes** | Do not replay |
| `20260924190446` | `suggestion_submission_evidence` | **Yes** | Do not replay |
| `20260925122602` | `sec_rpc_001_anon_execute_and_search_path` | **Yes** | Do not replay |
| `20260925160321` | `perf_suggestion_listing` | **Yes** | Do not replay. The earlier “outstanding” note is stale |
| `20260928210634` | `maturity_framework_structural_authoring` | **Yes** | Do not replay |
| `20260928210635` | `maturity_assessor_review_and_action_lineage` | **Yes** | Do not replay. Latest in repo and hosted |

No later committed migration needs hosted deployment.

### C. Application publication

| Surface | Verified 2026-09-29 |
| --- | --- |
| Production URL | `https://leanexcellencehub.com` **HTTP 200**, Netlify, Next.js sign-in |
| Exact production SHA | **Unverified** from public headers |
| Account / credit / pause | **Unverified** from this environment. Response was not 503 `usage_exceeded` |

- [ ] Keep auto-publish disabled unless a maintainer explicitly enables it
- [ ] Publish a chosen SHA only when authorised — **not** from a docs reconciliation
- [ ] UX-026: hide the Netlify “Powered by” badge in site settings (**operator**)

### D. Supabase Auth / security (operator)

- [ ] Leave invitation bootstrap RPCs executable by `anon` (`preview_organisation_invitation`, `prepare_organisation_invitation_signup_binding`)
- [ ] Leave `rls_auto_enable` to the platform
- [ ] Do **not** globally revoke authenticated EXECUTE on the remaining SECURITY DEFINER RPCs
- [ ] Enable **leaked-password protection** only after the Free → Pro upgrade, immediately before the first real customer
- [ ] No service-role key in Netlify `NEXT_PUBLIC_*`

Last hosted advisor reading is **2026-09-28** (after SEC-RPC-001 and the listing migration, before the maturity migrations). This reconciliation did not re-query the advisor. That reading was:

- Anon SECURITY DEFINER: **3** (invitation preview/prepare + `rls_auto_enable`)
- Mutable search_path: **0**
- Authenticated SECURITY DEFINER: **261** (deferred audit, not a mass revoke)
- Leaked-password protection: **disabled**

`20260928210634` and `20260928210635` revoke `anon` on the new maturity RPCs. No new anonymous EXECUTE grant was found in those files. That is a code inspection, not a fresh advisor run.

### E. CookieWorks data

- [ ] Preserve existing hosted CookieWorks unless a reset is separately approved
- [ ] Destructive hosted reset only with `LEANHUB_QA_RESET_CONFIRM=DELETE_COOKIEWORKS_ONLY` and written approval
- [ ] Never run `npm run db:seed-demo` against hosted
- [ ] Never run `npm run qa:cookie:inventory` against hosted credentials (local-only)

### F. Rollback considerations

| Layer | Rollback | Caution |
| --- | --- | --- |
| Netlify app | Redeploy previous SHA | Does not undo DB |
| `20260925122602` (SEC-RPC) | **No down migration** | Invitation RPCs must remain anon-executable |
| `20260925160321` (PERF listing) | Forward-only | Keep app and DB paired |
| `20260928210634` / `20260928210635` (Maturity) | Forward-only | Do not drop structural or assessor-review objects to “undo” a docs PR |
| CookieWorks tenant | Restore from backup / re-seed foundation only with approval | Reset deletes QA tenant data only |
| Auth leaked-password toggle | Turn the setting off | Does not rewrite data |

If a hosted migration apply fails part-way: **stop**. Do not re-run historical migrations.

---

## Billing / onboarding prerequisites

Stripe is **not** implemented here, and this reconciliation does not add billing schema.

The platform already exposes the attachment points a subscription implementation needs:

| Prerequisite | Present? | Where |
| --- | --- | --- |
| Organisation identity | **Yes** | `organisations` (`id`, unique `code`, `name`, locale, time zone, reporting currency) |
| Organisation owner | **Yes** | `private.provision_organisation` creates the owner membership and the protected `organisation-owner` role (`is_owner_role`) |
| Organisation admin | **Yes** | Owner role receives the permission catalogue; additional admin roles are delegated grants |
| Lifecycle / status | **Yes** | `provisioning \| active \| suspended \| closed`, with reason required for `suspended` and `closed` |
| Invitation / onboarding | **Yes** | `organisation_invitations`, workforce provisioning, and the two intentional anonymous invitation RPCs |
| Permissions | **Yes** | Versioned roles, `access_grants` (`self`, `unit_subtree`, `organisation`) |
| Tenant isolation | **Yes** | `organisation_id` on tenant rows, composite foreign keys, RLS |
| Feature / module boundaries | **Partial, sufficient to start** | Navigation and server checks are permission keys (`maturity.read`, `five_s.read`, `suggestions.read`, `training.catalog.manage`, `ai.manage_settings`, and the rest). There is **no** commercial plan or entitlement table. That map is billing work, not a missing tenant primitive |
| Lean AI usage | **Yes, for later metering** | Append-only `ai_usage_events` (tokens, tool calls, organisation, membership) and `get_ai_usage_summary`. No plan quota yet |

**No platform prerequisite is missing that must be solved before billing implementation starts.**

What billing work itself still has to introduce (out of scope here):

- Stripe customer / subscription identifiers
- A plan or entitlement record, if module access must follow a price rather than RBAC alone
- The operator Pro upgrade and leaked-password toggle before the first real customer

`suspended` is the existing organisation status a later non-payment policy can use. Do not invent a second lifecycle.

---

## Automation still covering this release

| Workflow | What it covers now |
| --- | --- |
| Fast CI | Format, lint, typecheck, unit tests, production build on pull requests |
| Database CI | Path-filtered pgTAP, database lint, generated types; QA replacement and Windows harness when those paths change |
| Full Regression | Quality on `main`, database core, and Playwright shards below. Also runs on non-draft PRs |
| Platform E2E | Shell, maturity journeys (including draft Review and formal assessor loop), maturity authoring reload, 5S/Gemba journeys (including prompt completion and canonical completed URL), scheduling, mobile shell, site boundary, CookieWorks execution site context |
| Workforce E2E | Training catalogue, training curriculum, invitations, people settings reload, provisioning, import |
| Improvement E2E | Suggestions (including submission evidence), actions, project/benefit lineage, problem solving |
| CookieWorks E2E | `cookieworks-ci-loop.spec.ts` and `cookieworks-two-site-hostile.spec.ts`, each with its own reset |
| AI closure | `milestone12-closure.spec.ts` |
| Windows QA harness | QA-tenant unit tests and Supabase CLI resolution on `windows-latest` |

Meaningful gap, accepted for this gate: the full CookieWorks **hosted** persona walk (image evidence on a real 5S audit, successor-draft Review on CookieWorks data, finance validation) is manual. Demo and CookieWorks automated suites already cover those behaviours on local Supabase. No additional automated suite was added.

---

## Local / CI evidence retained from the smoke pack

| Check | Where |
| --- | --- |
| CookieWorks isolation + CI loop | Full Regression shard `cookieworks` |
| Prior compiled-production pack | 11/11 on the #153 head (`cookieworks-ci-loop.spec.ts` and `cookieworks-two-site-hostile.spec.ts`) |
| Maturity draft Review and assessor loop | `tests/e2e/maturity-journeys.spec.ts` |
| Gemba completed URL / evidence reload | `tests/e2e/gemba-journeys.spec.ts` |
| Hosted mutation from this reconciliation | **None** |
