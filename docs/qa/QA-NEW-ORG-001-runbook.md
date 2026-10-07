# QA-NEW-ORG-001 — Fresh-organisation first-customer smoke

Create a **brand-new Professional / monthly** organisation through the real
customer journey and prove the current product from empty state.

This is the **primary** first-customer release test. CookieWorks stays the
historical two-site regression tenant. **Do not wipe CookieWorks.**

Canonical current-state: [PROJECT-CURRENT-STATE.md](./PROJECT-CURRENT-STATE.md).
Stripe Sandbox configuration: [STRIPE-SANDBOX-ONBOARDING-SMOKE.md](./STRIPE-SANDBOX-ONBOARDING-SMOKE.md).
Cutover (real money): [FIRST-CUSTOMER-CUTOVER-CHECKLIST.md](./FIRST-CUSTOMER-CUTOVER-CHECKLIST.md).
CookieWorks isolation (secondary): [RELEASE-SMOKE-01-protocol.md](./RELEASE-SMOKE-01-protocol.md).

Parent tracking: #263. Historical billing programme: #170.

**This document is planning only.** Automated agents must not run the hosted
smoke, apply hosted migrations, create Stripe live objects, or mutate
CookieWorks.

---

## 0. What this smoke proves

The current product on the published SHA, including:

- founder identity, email confirmation, password recovery
- organisation vs first-site onboarding
- Stripe Sandbox Checkout and webhook-authoritative activation
- structure-first setup, people, invitations
- every in-scope operational module from empty state
- LeanAI contextual Coach
- mobile sanity
- second-site capacity, quantity increase, sibling isolation
- ownership transfer
- cancellation / reactivation

What it does **not** prove:

- Essentials vs Professional entitlement enforcement (BILLING-02 — after this smoke)
- AI overage billing
- SCIM / enterprise SSO
- generic tenant merge / domain-based organisation discovery
- LEH Lite
- automatic tenant deletion
- Stripe **live** mode

---

## 1. Preconditions

| Check | Pass if |
| --- | --- |
| SHA | Exact published git SHA recorded. Candidate at audit: `a183ff6b5257636b01110693fd046788147ea882` |
| CookieWorks | Still present. Not reset |
| Billing provider | Hosted: `BILLING_PROVIDER=stripe` + Sandbox keys. Local rehearsal: explicit `BILLING_PROVIDER=fake`. Missing secrets never fall back to fake |
| Stripe Sandbox | Products, prices, webhook, Customer Portal from the companion doc |
| Hosted DB | `migration list` matches the SHA. Latest expected: `20261007143820_organisation_ownership_transfer`. **Do not replay** |
| Auth | Recovery links reach `/auth/recovery`. Send Email Hook matches the app revision |
| Netlify / app env | Server-only Stripe vars. No `NEXT_PUBLIC_STRIPE_*` |

Local fake rehearsal (does **not** replace this human pack):

```bash
E2E_WITH_SUPABASE=1 npx playwright test \
  tests/e2e/billing-founding-onboarding.spec.ts \
  tests/e2e/onboarding-setup.spec.ts \
  tests/e2e/first-customer-rollout.spec.ts \
  tests/e2e/site-capacity.spec.ts \
  tests/e2e/organisation-ownership-transfer.spec.ts \
  tests/e2e/password-recovery.spec.ts \
  --workers=1
```

---

## 2. Target organisation

| Field | Value |
| --- | --- |
| Plan | Professional |
| Billing | Stripe Sandbox (hosted) or fake provider (local only) |
| Interval | Monthly |
| Site quantity | **1 initially** |
| Multi-site intent | **Yes** or **Not sure** |
| First site | A unique operational name (not a CookieWorks unit name) |
| Organisation name | Unique group/company name, **not** identical to the first site when intent is Yes |
| Country / locale / tz / currency | GB / en-GB / UTC / GBP unless testing those fields |
| Founder | A mailbox the operator controls. Not a CookieWorks persona |
| Second site (later) | A second unique name under the same organisation |

---

## 3. Result recording

Record each step **PASS / FAIL / BLOCKED / PRODUCT GAP**.

Screenshot FAILs with URL + persona. Do not paste secrets, Stripe live
PANs, or webhook signing secrets.

**Release-stopping (pause and file a new P0/P1):**

1. Cross-tenant or sibling-site leak
2. Privilege escalation
3. Webhook activates the wrong organisation
4. Unpaid provisioning org enters operational modules
5. Create action yields an unusable record
6. Silent data loss after save/refresh
7. Password recovery lockout / token consumed on GET
8. Hosted app 5xx so the pack cannot run

P2/P3 (slow pages, mobile overflow): **log and continue**. Skills authoring
is implemented. If an empty organisation still cannot publish a scale, create
a skill, publish a skills standard, and see that requirement on the matrix,
record **FAIL**, not a known product gap.

---

## 4. Executable journey

### 1. Account creation

1. Open `/signup`.
2. Confirm invitation-only workforce copy remains: joining an existing
   organisation still requires an invitation.
3. Check-email state must **not** claim a confirmation email was definitely sent.
4. Create the founder account.

### 2. Email confirmation

1. Confirm email via the hosted template.
2. Land on `/create-organisation` (or login → create organisation).

### 3. Password recovery sanity

1. Sign out.
2. `/recover` with the founder email.
3. Copy must not confirm that the account exists.
4. Open the recovery link. GET must **not** invalidate the token.
5. Continue recovery, set a new password, sign in.

### 4. Organisation + first-site creation

1. Organisation name = company/group (placeholder example: Acme Foods Ltd).
2. First site = operational location (placeholder example: Plymouth Factory).
3. Multi-site intent = Yes or Not sure.
4. Quantity **1**.
5. Organisation is `provisioning`. `/platform` redirects to `/onboarding`.
6. Operational modules are blocked.

### 5. Stripe Sandbox Checkout

1. Choose **Professional**. Enterprise is Contact Sales only. Founder Pilot is not listed.
2. Interval **Monthly**.
3. Continue to Checkout.
4. Confirming screen says Checkout return is not treated as success.
5. Pay with a Sandbox success card. Local fake rehearsal may use
   **Complete sandbox payment** only when `BILLING_PROVIDER=fake` is
   explicit and the session belongs to this provisioning organisation.

### 6. Webhook activation

1. Wait for webhook. Do **not** treat the success URL as activation.
2. Organisation becomes `active` with onboarding required.
3. Land on `/onboarding/setup`.

### 7. Structure-first onboarding

1. Confirm organisation profile and first site. Do not recreate the site.
2. Choose a structure path (start simple / suggestion / manual).
3. Readiness can skip remaining structure steps; skipped stays visible as skipped.

### 8. Job functions / people

1. Optionally add job functions. Job functions are **not** access roles.
2. Owner membership is present.

### 9. Invitation + acceptance

1. Invite one colleague with an appropriate site or organisation grant.
2. Accept on a second browser/profile.
3. Invitee cannot see other tenants (including CookieWorks).

### 10. Maturity

Empty-state: create or Quick Start a draft framework; publish if the path
allows; run a Self assessment on the first site. Formal assessment if a
second persona exists.

### 11. 5S

Author a standard or execute the empty path on the first site. Persist
answers after reload.

### 12. Gemba

Author/execute a walk on the first site. Completed walk uses the canonical
URL without a leftover `?prompt=`.

### 13. Scheduling

Create a schedule occurrence (5S or Gemba). Optional: download `.ics`.

### 14. Suggestions

Configure a programme if required. Submit a suggestion with optional
evidence. Reviewer path if a second persona exists.

### 15. Actions

Create or promote an action. Open workspace; start → complete; history
after refresh.

### 16. Problem Solving

Open a case from empty. Record enough to prove the workspace saves.

### 17. Projects

Create a project (from suggestion or empty). Charter fields persist.

### 18. Benefits

Record a benefit, preferably from the project. Finance validation if a
finance persona exists; otherwise owner path.

### 19. Training

Catalogue empty path: draft course → publish, or record PRODUCT GAP only if
the UI cannot create a course (it should).

### 20. Skills

Empty-organisation path, as an authorised administrator:

1. Open Skills. The empty state offers **Set up skills**.
2. Create a proficiency scale, add at least two levels, and publish it.
3. Create a skill. The name is the label; the code can stay suggested.
4. Create a skills standard. Assign that skill to an existing job function
   at a published proficiency level, then publish the standard.
5. Open the skills matrix. A person whose primary job function matches shows
   **Not assessed** for that skill.
6. Record a validated assessment from that person's capability profile.
7. Reload the matrix. The cell shows meets, below, or above the requirement,
   and the same state is still there after another reload.

If job functions do not exist yet, the standard explains that and links to
job function setup. Do not create job functions from inside Skills.

Saved levels and saved requirements cannot be edited or removed in this
version. Published scales and standards are read-only.

### 21. Recognition

Award or empty list. Recipient shows a human name, not a UUID.

### 22. LeanAI contextual Coach

1. Owner can open Settings → AI.
2. Deterministic Coach still renders with no model call on page load.
3. Explicit **Explain** (if AI is enabled) stays advice-only.
4. If `AI_ENABLED` is off, static fallback still works.

### 23. Mobile sanity

Phone viewport: platform nav, submit suggestion, complete a walk or 5S
control. Overflow/contrast issues are P2/P3 unless a workflow cannot finish.

### 24. Billing settings

1. Settings → Billing: plan `professional`, quantity 1, interval monthly, state active.
2. **Manage billing** opens Customer Portal and returns to Settings → Billing.

### 25. Second-site capacity behaviour

1. Attempt to add a second **site** at quantity 1.
2. Rejected with capacity exhausted. Billing-authorised users are directed
   to add capacity. The app must **not** claim Stripe quantity already changed.

### 26. Increase subscription quantity

1. Billing-authorised user increases site quantity **1 → 2**.
2. Webhook / provider update is authoritative.
3. Settings show remaining capacity.

### 27. Roll out second site

1. Settings → Organisation → Rollout & Governance (or structure create).
2. Create the second site under the **same** organisation.
3. Grant a site-scoped role on the second site.

### 28. Verify sibling-site isolation

1. First-site-only user cannot enumerate second-site operational records.
2. Second-site-only user cannot enumerate first-site operational records.
3. Organisation-wide owner/admin can see both when explicitly granted.
4. First-site history is unchanged.

### 29. Ownership-transfer journey

1. Invite/activate a second **active** member who should become corporate owner.
2. Current owner: Settings → Organisation → Transfer ownership.
3. Type the organisation name to confirm.
4. Former owner remains a member. Sites and history are unchanged.
5. Former owner can no longer open the transfer page as owner.

### 30. Cancellation / reactivation

1. Customer Portal: cancel **at period end**. LEH stays `active` with
   `cancel_at_period_end`.
2. Advance Test Clock (or wait) to period end. Webhook moves org to
   `suspended`. `/platform` redirects to `/billing`.
3. Data is still there. No auto-delete.
4. Portal / pay invoice: reactivate. Org returns `active` without rebuilding.
5. Optional: `invoice.payment_failed` → `past_due` stays operational for 7
   days. After grace expires, the next application access is denied even if
   Stripe sends no further event.

---

## 5. CookieWorks guard

After the smoke:

- CookieWorks org code `cookieworks-manufacturing` still exists.
- CookieWorks personas still sign in.
- No hosted reset script was run as part of this smoke.

---

## 6. Operator follow-ups (not this PR)

- Confirm hosted migrations through `20261007143820`. Do not replay.
- Set Netlify server-only Stripe Sandbox env vars.
- Point the Sandbox webhook at the deployed `/api/billing/stripe/webhook`.
- Record the SHA under test.
- LIVE-CUTOVER only after this pack PASSes: live prices, live webhook,
  Supabase Pro, leaked-password protection, Terms/DPA/retention wording.
