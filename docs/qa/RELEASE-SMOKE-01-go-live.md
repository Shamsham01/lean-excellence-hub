# RELEASE-SMOKE-01 — Go-live blockers and deployment checklist

**This document is planning only.** Automated agents and implementation PRs must not mutate hosted Supabase, CookieWorks fixtures, Auth, Netlify, or billing.

Inspected read-only on 2026-09-28:

- GitHub `main` = `4538c80` (PR **#150** merged; PR **#151** open / not merged)
- Hosted project `zsadfvjtknbbfomlmttv` (eu-west-1, `ACTIVE_HEALTHY`)
- Hosted migration list matches `main` through `20260925122602_sec_rpc_001_anon_execute_and_search_path`

---

## Go / no-go (first customer)

| Gate | Status | Stopper? |
| --- | --- | --- |
| P0/P1 **code** blockers on `main` | **None** (register reconciled) | — |
| Hosted schema vs `main` | **In sync** through SEC-RPC-001 | No extra LEH migration required for `main` |
| Hosted **application publication** | **Not ready** — Netlify has been paused; last recorded production symptom was `usage_exceeded` 503 (2026-09-23) | **YES** |
| Hosted CookieWorks **integrated smoke** on current SHA | **Not done** | **YES** until protocol PASS on isolation + CI loop + one module each side of 5S/Gemba/Maturity |
| Auth leaked-password protection | **Disabled** (Advisor WARN) | **Recommended YES** for first customer; operator Auth toggle — not a code change |
| PR #151 suggestions listing | Optional perf; **do not block** shipping `main` | No |
| Remaining P2 IA / mobile forms / assessor UX | Open by design | No |

**Verdict: NO-GO for first-customer hosted release** until (1) the app is published on the intended SHA, (2) leaked-password protection is decided, and (3) the CookieWorks protocol in `RELEASE-SMOKE-01-protocol.md` is executed with evidence.

---

## Deployment checklist (maintainer, explicit approval each row)

### A. Pre-flight (read-only)

- [ ] `git fetch origin main && git log -1 --oneline origin/main` — record SHA
- [ ] Confirm PR #151 is **in or out** of the release train (default: **out**)
- [ ] `supabase migration list` against hosted `zsadfvjtknbbfomlmttv` — expected latest on `main`: `20260925122602`
- [ ] **Do not replay** already-applied hosted migrations (`20260924190446`, `20260924111211`, `20260923233254`, `20260925122602`, …)
- [ ] Fast CI + Full Regression green on that SHA
- [ ] Dry-run only: `npm run qa:cookie:hosted-replacement -- --dry-run` (read-only)

### B. Outstanding hosted migrations

| Version | Name | Hosted? | Action |
| --- | --- | --- | --- |
| `20260925122602` | `sec_rpc_001_anon_execute_and_search_path` | **Yes** | Do not replay |
| `20260924190446` | `suggestion_submission_evidence` | **Yes** | Do not replay |
| `20260924111211` | `perf_delegatable_access_offers` | **Yes** | Do not replay |
| `20260925160321` | `perf_suggestion_listing` | **No** | Only after **#151 merge + explicit approval** |

No other `main` migrations are pending hosted apply.

### C. Application publication

- [ ] Restore Netlify account quota / disable pause (**operator**)
- [ ] Confirm auto-publish policy (historically **disabled** — keep disabled unless approved)
- [ ] Publish the **exact** release SHA
- [ ] Confirm `leanexcellencehub.com` (or staging URL) serves that SHA — not 503 `usage_exceeded`
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
| PR #151 if applied later | Forward-only listing helper | Keep app and DB paired |

If a hosted migration apply fails part-way: **stop**. Dry-run inventory. Do not re-run blindly.

---

## Local / CI evidence for this pack

| Check | Where |
| --- | --- |
| CookieWorks isolation + CI loop E2E | Full Regression shard `cookieworks` (`cookieworks-ci-loop.spec.ts` only until #155) |
| Local compiled-production (this pack) | **8/8 passed** in 45.9s, `PLAYWRIGHT_EXIT=0` — `/opt/cursor/artifacts/cookieworks-e2e.log` |
| Fast CI / Quality | Green on PR #153 (`c216fa2` and follow-up head) |
| Existing demo happy paths | platform / workforce / improvement / ai-closure shards (Full Regression skipped while draft) |
| pgTAP + types | Database CI / Full Regression database core |
| Hosted mutation | **None** from this PR |
