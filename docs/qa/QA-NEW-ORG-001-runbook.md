# QA-NEW-ORG-001 — Clean-organisation smoke runbook

Create a **brand-new Professional / monthly / 1-site** organisation through
the real onboarding journey and smoke every in-scope module from empty state.

This is preferred over wiping CookieWorks. CookieWorks remains the historical
regression tenant.

**This document is planning only.** Automated agents must not run the hosted
smoke, apply hosted migrations, create Stripe live objects, or mutate
CookieWorks.

Stripe Sandbox configuration: `docs/qa/STRIPE-SANDBOX-ONBOARDING-SMOKE.md`.
Product baseline: `docs/product/pricing-subscription-onboarding-v1.md`.

Parent issue: #170. Tracking issue: #175.

---

## 0. What this smoke proves

- Founder identity → organisation provisioning
- First site + paid site quantity
- Stripe Customer + Checkout (Sandbox) or fake provider (local)
- Webhook-authoritative activation (Checkout return is not success)
- Owner RBAC, skippable onboarding wizard
- Empty-state path for each current module
- Period-end cancellation → suspend → reactivate
- CookieWorks still exists and is unused by this journey

What it does **not** prove (later slices):

- Essentials vs Professional entitlement enforcement (BILLING-02)
- AI overage billing
- SCIM / enterprise SSO
- Automatic tenant deletion
- Live-mode Stripe

---

## 1. Preconditions

| Check | Pass if |
| --- | --- |
| Stacked billing PRs | CORE, LIFECYCLE, and ONBOARD merged or otherwise available on the target SHA |
| CookieWorks | Still present. Not reset for this smoke |
| Billing provider | Hosted: `BILLING_PROVIDER=stripe` + Sandbox keys. Local/CI rehearsal: explicit `BILLING_PROVIDER=fake`. Never rely on a missing-secret fallback. |
| Stripe Sandbox | Products/prices/webhook from the companion doc |
| Hosted DB | Billing migrations applied **only** with explicit approval. Do not replay |
| Netlify / app env | Server-only Stripe vars set. No `NEXT_PUBLIC_STRIPE_*` |

Local fake rehearsal (already automated):

```bash
E2E_WITH_SUPABASE=1 npx playwright test tests/e2e/billing-founding-onboarding.spec.ts --workers=1
```

That spec does **not** replace the Sandbox + full-module human smoke.

---

## 2. Target organisation

| Field | Value |
| --- | --- |
| Plan | Professional |
| Interval | Monthly |
| Site quantity | 1 |
| First site | Any unique name (not a CookieWorks unit name) |
| Country / locale / tz / currency | GB / en-GB / UTC / GBP unless the operator is testing those fields |
| Org name | Unique, e.g. `QA New Org YYYY-MM-DD` |
| Founder | A mailbox the operator controls. Not a CookieWorks persona |

---

## 3. Journey checklist

Record **PASS / FAIL / BLOCKED / PRODUCT GAP**. Screenshot FAILs with URL +
persona. Do not paste secrets.

### A. Identity and provisioning

1. Open `/signup` (or login → Create your organisation).
2. Confirm invitation-only copy is still visible. Workforce self-signup stays closed.
3. Create the founder account and confirm email.
4. Land on `/create-organisation`.
5. Submit organisation + first site + quantity **1**.
6. Organisation is `provisioning`. `/platform` redirects to `/onboarding`.
7. Operational modules are blocked (structure/unit create, maturity, etc.).

### B. Plan and Checkout

1. Choose **Professional** (default). Confirm Enterprise is Contact Sales only and Founder Pilot is not listed.
2. Interval **Monthly**.
3. Continue to Checkout.
4. Confirming screen says Checkout return is not treated as success.
5. Pay with a Sandbox success card. Local fake rehearsal may use **Complete
   sandbox payment** only when `BILLING_PROVIDER=fake` is explicit and the
   session belongs to the selected provisioning organisation.
6. Wait for webhook. Do not treat the success URL as activation.
7. Organisation becomes `active` with `onboarding_required`. Land on `/onboarding/setup`.

### C. Wizard and owner access

1. Skippable wizard lists org/site, invitations, setup approach, module guidance.
2. Finish and enter workspace.
3. Owner can open Settings → Billing: plan `professional`, quantity 1, interval monthly, state active.
4. **Manage billing** opens Customer Portal and returns to Settings → Billing.

### D. Site quantity

1. First site already exists.
2. Adding a second **site** is rejected (paid quantity is 1).
3. Do not expect Stripe quantity to change automatically in this slice.

### E. Module empty-state smoke (Professional)

Use the owner (and invitations if a second persona is needed). Active site =
the first site.

| # | Area | Empty-state / setup check |
| --- | --- | --- |
| 1 | Organisation / People / Sites / invitations | Invite one colleague; accept; they cannot see other tenants |
| 2 | Maturity | Create/review a framework; run Self; run Formal if the empty path allows |
| 3 | 5S | Author a standard or execute the empty path |
| 4 | Gemba | Author/execute a walk |
| 5 | Scheduling | Create a schedule occurrence |
| 6 | Suggestions → Actions → Projects → Benefits | Submit a suggestion, promote/link an action, create a project, record a benefit |
| 7 | Problem Solving | Open a case from empty |
| 8 | Training | Catalogue or assignment empty path |
| 9 | Skills | Profile/capability empty path |
| 10 | Recognition | Award or empty list |
| 11 | Lean AI | Settings visible to owner; a fake or live-allowed prompt if AI is enabled |
| 12 | Exports / integrations in scope | Whatever is shipped; skip unimplemented items as PRODUCT GAP |
| 13 | Mobile / responsive | Phone viewport: nav, submit suggestion, complete a walk or 5S |

Stop on a new P0/P1. Product gaps that match “not in v1” are not billing blockers.

### F. Cancellation, failure, reactivation

1. Customer Portal: cancel **at period end**. LEH stays `active` with
   `cancel_at_period_end`.
2. Advance Test Clock (or wait) to period end. Webhook moves org to
   `suspended`. `/platform` redirects to `/billing`.
3. Data is still there. No auto-delete.
4. Portal / pay invoice: reactivate. Org returns `active` without rebuilding.
5. Optional: `invoice.payment_failed` → `past_due` stays operational for 7
   days. After grace expires, the next application access is denied even if
   Stripe sends no further event: operational RBAC stays closed and the member
   is routed to `/billing`. Ordinary suspended members see the paused message
   and may switch organisation or sign out; only `billing.manage` holders get
   **Manage billing**.

---

## 4. CookieWorks guard

After the smoke:

- CookieWorks org code `cookieworks-manufacturing` still exists.
- CookieWorks personas still sign in.
- No hosted reset script was run as part of this smoke.

---

## 5. Operator follow-ups (not this PR)

- Apply billing migrations to hosted Supabase when CORE+LIFECYCLE+ONBOARD are
  approved to merge.
- Set Netlify server-only Stripe Sandbox env vars.
- Point the Sandbox webhook at the deployed `/api/billing/stripe/webhook`.
- Record the SHA of the deployment under test.
- LIVE-CUTOVER (later): live prices, live webhook, Supabase Pro,
  leaked-password protection, Terms/DPA/retention wording.
