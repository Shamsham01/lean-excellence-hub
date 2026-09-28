# RELEASE-SMOKE-01 — Go-live blockers and deployment checklist

**This document is planning only.** Automated agents and implementation PRs must not mutate hosted Supabase, CookieWorks fixtures, Auth, Netlify, or billing.

Inspected read-only on 2026-09-28:

- GitHub `main` = `e399f79` (PR **#151** squash-merged; PR **#150** is in history)
- Hosted project `zsadfvjtknbbfomlmttv` (eu-west-1, `ACTIVE_HEALTHY`)
- Hosted migration list matches `main` through `20260925122602_sec_rpc_001_anon_execute_and_search_path`
- Outstanding hosted migration: `20260925160321_perf_suggestion_listing` (code is on `main`; **not** applied hosted)
- Netlify Deploy Preview for PR #153: https://deploy-preview-153--lean-excellence-hub.netlify.app (**available**)
- Production `https://leanexcellencehub.com`: HTTP **200** sign-in, `server: Netlify`, not 503 `usage_exceeded`. Exact production git SHA is **not** in public response headers/HTML. Account/credit state is **not** readable here. Do not publish or change Netlify config.

---

## Go / no-go (first customer)

| Gate | Status | Stopper? |
| --- | --- | --- |
| P0/P1 **code** blockers on `main` | **None** (register reconciled) | — |
| Hosted schema vs `main` | **Behind by one**: `20260925160321_perf_suggestion_listing` | **YES** for a SHA-paired hosted smoke of current `main` until explicitly applied |
| Hosted **application publication** | Deploy Preview **exists** for PR #153. Production URL is **up** (HTTP 200) but the **exact production SHA is unverified**. Historical pause/`usage_exceeded` is no longer the observed production symptom. | **YES** until production is confirmed on the intended SHA |
| Hosted CookieWorks **integrated smoke** on current SHA | **Not done** | **YES** until protocol PASS on isolation + CI loop + one module each side of 5S/Gemba/Maturity |
| Auth leaked-password protection | **Disabled** (Advisor WARN) | **Recommended YES** for first customer; operator Auth toggle — not a code change |
| PR #151 suggestions listing | **In the code release train.** Hosted apply of `20260925160321` still needs approval. | Yes for SHA-paired DB/app; not a product-code defect |
| #154 CI Manager programme grant | P2 / role-playbook. Protocol SUG-01 uses **Admin**. | No |
| Remaining P2 IA / mobile forms / assessor UX | Open by design | No |

**Verdict: NO-GO for first-customer hosted release** until (1) production is confirmed on the intended SHA, (2) `20260925160321_perf_suggestion_listing` is applied hosted **with explicit approval** (or the smoke explicitly uses a pre-#151 app/DB pair), (3) leaked-password protection is decided, and (4) the CookieWorks protocol in `RELEASE-SMOKE-01-protocol.md` is executed with evidence.

---

## Deployment checklist (maintainer, explicit approval each row)

### A. Pre-flight (read-only)

- [ ] `git fetch origin main && git log -1 --oneline origin/main` — record SHA (baseline `e399f79` unless `main` advanced)
- [ ] Confirm PR **#151 is in** the code release train
- [ ] `supabase migration list` against hosted `zsadfvjtknbbfomlmttv` — expected latest applied: `20260925122602`; outstanding: `20260925160321`
- [ ] **Do not replay** already-applied hosted migrations (`20260924190446`, `20260924111211`, `20260923233254`, `20260925122602`, …)
- [ ] Fast CI + Full Regression green on that SHA
- [ ] Dry-run only: `npm run qa:cookie:hosted-replacement -- --dry-run` (read-only)

### B. Outstanding hosted migrations

| Version | Name | Hosted? | Action |
| --- | --- | --- | --- |
| `20260925122602` | `sec_rpc_001_anon_execute_and_search_path` | **Yes** | Do not replay |
| `20260924190446` | `suggestion_submission_evidence` | **Yes** | Do not replay |
| `20260924111211` | `perf_delegatable_access_offers` | **Yes** | Do not replay |
| `20260925160321` | `perf_suggestion_listing` | **No** | **Outstanding.** Explicit approval required before the final hosted smoke of current `main`. Do not apply from this PR. |

No other `main` migrations are pending hosted apply.

### C. Application publication

Distinguish **Deploy Preview** from **production**:

| Surface | Verified 2026-09-28 |
| --- | --- |
| Deploy Preview (PR #153) | **Ready** — https://deploy-preview-153--lean-excellence-hub.netlify.app (Netlify bot; commit on the PR head) |
| Production URL | `https://leanexcellencehub.com` **HTTP 200**, `server: Netlify`, sign-in renders. **Not** 503 `usage_exceeded` |
| Exact production SHA | **Unverified** (not in public headers/HTML; no GitHub deployment records) |
| Account / credit / pause | **Unverified** from this environment. Historical pause/`usage_exceeded` is no longer the observed production HTTP symptom |

- [ ] Confirm auto-publish policy (historically **disabled** — keep disabled unless approved)
- [ ] Publish the **exact** release SHA to production when authorised — **not** from this PR
- [ ] Confirm `leanexcellencehub.com` (or staging URL) serves that SHA
- [ ] UX-026: hide Netlify “Powered by” badge in site settings (**operator**, not CSS)

### D. Supabase Auth / security (operator; do not change from this PR)

- [ ] Enable **leaked-password protection** (HaveIBeenPwned) when authorised
- [ ] Leave invitation bootstrap RPCs executable by `anon` (`preview_organisation_invitation`, `prepare_organisation_invitation_signup_binding`)
- [ ] Leave `rls_auto_enable` to the platform
- [ ] Do **not** globally revoke authenticated EXECUTE on the remaining ~261 SECURITY DEFINER RPCs
- [ ] Confirm JWT expiry / session settings still match `docs/architecture/security-model.md`
- [ ] No service-role key in Netlify `NEXT_PUBLIC_*`

Post-apply Security Advisor expectation (already observed hosted after #150):

- Anon SECURITY DEFINER: **3** (invitation preview/prepare + `rls_auto_enable`)
- Mutable search_path: **0**
- Authenticated SECURITY DEFINER: **261** (deferred)

### E. CookieWorks data

- [ ] Prefer **preserve existing** hosted CookieWorks if smoke data is still useful
- [ ] Destructive hosted reset only with `LEANHUB_QA_RESET_CONFIRM=DELETE_COOKIEWORKS_ONLY` and written approval
- [ ] Never run `npm run db:seed-demo` against hosted
- [ ] Never run `npm run qa:cookie:inventory` against hosted credentials (local-only)

### F. Rollback considerations

| Layer | Rollback | Caution |
| --- | --- | --- |
| Netlify app | Redeploy previous SHA | Instant; does not undo DB |
| `20260925122602` (SEC-RPC) | **No down migration.** Restore = re-grant EXECUTE. Treat as forward-only. | Invitation RPCs must remain anon-executable |
| `20260924190446` (evidence) | Forward-only. Rolling back the app without DB is OK; rolling back DB is not | Do not drop columns/storage policies |
| CookieWorks tenant | Restore from backup / re-seed foundation only with approval | Destructive reset deletes QA tenant data only, not the whole project |
| Auth leaked-password toggle | Turn the setting off | Does not rewrite data |
| `20260925160321` (PERF listing, #151) | Forward-only listing helper. Keep app and DB paired after apply. | Do not apply without approval |

If a hosted migration apply fails part-way: **stop**. Dry-run inventory. Do not re-run blindly.

---

## Local / CI evidence for this pack

| Check | Where |
| --- | --- |
| CookieWorks isolation + CI loop E2E | Full Regression shard `cookieworks` (`cookieworks-ci-loop.spec.ts` then `cookieworks-two-site-hostile.spec.ts`, `--workers=1`, each spec resets) |
| Local compiled-production (this pack) | **11/11 passed** in 1.5m on `960e5a8` (`CI=1 E2E_WITH_SUPABASE=1`, `--workers=1 --retries=0`): `cookieworks-ci-loop.spec.ts` (8) then `cookieworks-two-site-hostile.spec.ts` (3), each spec `qa:cookie:reset` in `beforeAll` |
| Fast CI / Quality | GitHub **success** on `960e5a8` (https://github.com/Shamsham01/lean-excellence-hub/actions/runs/36421448481) |
| Existing demo happy paths | platform / workforce / improvement / ai-closure shards |
| pgTAP + types | Local `test:db` **PASS** Files=121 Tests=2247. GitHub Database CI **success** on `960e5a8` (https://github.com/Shamsham01/lean-excellence-hub/actions/runs/36421448467) |
| QA hosted-replacement integration | Local vitest only — **not** a hosted apply |
| Hosted mutation | **None** from this PR |
