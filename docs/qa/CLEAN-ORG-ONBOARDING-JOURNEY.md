# Clean organisation onboarding journey (automated)

Automated counterpart to [QA-NEW-ORG-001-runbook.md](./QA-NEW-ORG-001-runbook.md).
CookieWorks is **not** used or reset; each CI run provisions a disposable
founding user and organisation.

## Spec

`tests/e2e/clean-org-onboarding-journey.spec.ts` (helpers in
`tests/e2e/helpers/clean-org-journey.ts`).

## CI

Full Regression **E2E platform** shard (`/.github/workflows/ci-full.yml`), with
`BILLING_PROVIDER=fake`, local Supabase, and `db:seed-demo` (CookieWorks
unchanged).

## Coverage

| Area | Automated check |
| --- | --- |
| Account + founding binding | `provisionFoundingE2eUser` |
| Organisation + first site (country/locale/tz/currency) | Create form + Professional plan |
| Stripe handoff | Fake **Complete sandbox payment** (webhook path, not redirect) |
| Structure-first onboarding | Start simple → people skip → platform setup |
| Organisation / People / Sites | Settings structure, people, directory |
| Maturity | Overview + models quick start |
| 5S / Gemba | Empty states + 5S Quick Start draft |
| Scheduling | Schedule list + new schedule link |
| Suggestions pipeline | Programme + category bootstrap, first suggestion |
| Actions / Projects / Benefits / Problem solving | Empty portfolio + first action, PS draft case |
| Training / Skills / Recognition | Empty hub states |
| LeanAI settings | `/platform/settings/ai` loads |
| Invitation | RPC issue + Mailpit confirm + accept |
| Mobile 390×844 + desktop 1440×900 | No horizontal overflow; console errors guarded on touched flows |

Not in this spec (still manual / other E2E): hosted Stripe live, Essentials
entitlement matrix, Gemba walk completion, training curriculum matrix,
recognition award, cancellation, second-site capacity, ownership transfer.

## Fixes shipped with this journey

1. **Founding owner primary site assignment** — migration
   `20261108170000_founding_owner_primary_site_assignment.sql` assigns the
   founding owner to the first site with a default job function so suggestion
   submission works without a separate profile step.
2. **5S / Gemba empty-state test IDs** — `five-s-empty-state`, `gemba-empty-state`
   for reliable empty-catalog assertions.
3. **Structure-first E2E helper** — `completeStructureFirstSetupToPlatform` handles
   wizard steps when job functions are already satisfied.

## Owner decisions (not automatable here)

- Hosted **Stripe Sandbox** products, prices, webhook signing secret, Customer Portal
- **Auth** Send Email Hook and recovery templates on production
- **Netlify** env for `BILLING_PROVIDER=stripe` and server-only Stripe keys
- Essentials vs Professional entitlement enforcement (BILLING-002)
- Training session creation from empty org (no session list control today)
