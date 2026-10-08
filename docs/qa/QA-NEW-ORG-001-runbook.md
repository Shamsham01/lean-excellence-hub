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
| SHA | Exact published git SHA recorded. Candidate at the 2026-10-08 preflight: `90286dd3b6fdb4bcf5e40e03c6f025fe5881805d`. The 7 October candidate `a183ff6` is historical |
| CookieWorks | Still present. Not reset |
| Billing provider | Hosted: `BILLING_PROVIDER=stripe` + Sandbox keys. Local rehearsal: explicit `BILLING_PROVIDER=fake`. Missing secrets never fall back to fake |
| Stripe Sandbox | Products, prices, webhook, Customer Portal from the companion doc |
| Hosted DB | `migration list` matches the SHA. Latest expected on this candidate: `20261008072255_create_module_setup_drafts_from_definition` (230 files). Read-only parity was confirmed 2026-10-08. **Do not replay**. Reconfirm if `main` has moved |
| Auth | Recovery links reach `/auth/recovery`. Send Email Hook matches the app revision |
| Netlify / app env | Server-only Stripe vars. No `NEXT_PUBLIC_STRIPE_*` |

Local fake rehearsal on 2026-10-08 against a disposable local Supabase and a compiled production server (`BILLING_PROVIDER=fake`): **23 passed, 0 failed**. That does **not** replace this human pack. `onboarding-setup.spec.ts`, `first-customer-rollout.spec.ts`, `module-setup-5s-gemba.spec.ts`, and `skills-authoring-empty-org.spec.ts` are not in the Full Regression matrix; the other four specs below are.

Command:

```bash
E2E_WITH_SUPABASE=1 BILLING_PROVIDER=fake npx playwright test \
  tests/e2e/billing-founding-onboarding.spec.ts \
  tests/e2e/onboarding-setup.spec.ts \
  tests/e2e/first-customer-rollout.spec.ts \
  tests/e2e/site-capacity.spec.ts \
  tests/e2e/organisation-ownership-transfer.spec.ts \
  tests/e2e/password-recovery.spec.ts \
  tests/e2e/module-setup-5s-gemba.spec.ts \
  tests/e2e/skills-authoring-empty-org.spec.ts \
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

Record each step **PASS / FAIL / BLOCKED / PRODUCT GAP**. This audit did **not** execute the hosted pack. Leave every hosted result blank until an operator fills it.

| Step | Result | Operator | Notes |
| --- | --- | --- | --- |
| 1 Account creation |  | Human |  |
| 2 Email confirmation |  | Human | Hosted Auth template |
| 3 Password recovery |  | Human | GET must not consume the token |
| 4 Organisation + first site |  | Human |  |
| 5 Stripe Sandbox Checkout |  | Human | Professional monthly, quantity 1 |
| 6 Webhook activation |  | Human | Success URL is not activation |
| 7 Structure-first onboarding |  | Human |  |
| 8 Job functions / people |  | Human |  |
| 9 Invitation + acceptance |  | Human | Second browser |
| 10 Maturity |  | Human |  |
| 11 5S |  | Human | PASS: published standard, operator-chosen applicable area, completed audit, answers and evidence still present after reload. A draft alone is FAIL |
| 12 Gemba |  | Human | PASS: published definition and a completed walk. Completed URL is `/platform/gemba/walks/{id}` with no `?prompt=`. A draft alone is FAIL |
| 13 Scheduling |  | Human |  |
| 14 Suggestions |  | Human |  |
| 15 Actions |  | Human |  |
| 16 Problem Solving |  | Human |  |
| 17 Projects |  | Human |  |
| 18 Benefits |  | Human |  |
| 19 Training |  | Human | PASS: one published curriculum with a mandatory requirement shows Required for an applicable person on Training matrix, and stays after reload. A published course alone is FAIL |
| 20 Skills |  | Human | Empty-org path in the step below |
| 21 Recognition |  | Human | PASS: a persisted award whose recipient is a person's name. Empty history is FAIL |
| 22 LeanAI |  | Human | Explain stays advice-only |
| 23 Mobile sanity |  | Human | About 390px |
| 24 Billing settings |  | Human | Portal return |
| 25 Second-site capacity denial |  | Human | Must not claim Stripe quantity already changed |
| 26 Quantity increase 1 → 2 |  | Human | Webhook authoritative |
| 27 Second site |  | Human | Same organisation |
| 28 Sibling-site isolation |  | Human |  |
| 29 Ownership transfer |  | Human |  |
| 30 Cancellation / reactivation |  | Human | Test Clock or wait. No auto-delete |
| CookieWorks still present |  | Human | Do not reset |

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

Use the first site of the new organisation. Prefer **LEH Quick Start** so
the questions are already present. Manual is valid if you add at least one
question yourself. Leave **Build with LeanAI** unused for this pass. If you
do open it, stop at a draft you review: LeanAI must not publish, choose
applicable areas, or grant permissions.

1. Open 5S. The empty organisation offers **Set up 5S**.
2. On **Choose how to start**, open **LEH Quick Start** (**Preview starting point**). Confirm the starting point is **LEH Workplace 5S Standard**.
3. Under **Applicable areas**, tick the first site. The form says the template does not guess this. If the list is empty, select the active site in the sidebar first.
4. Leave **Target threshold (%)** at 80 unless you are deliberately changing it, then **Use this starting point**.
5. Confirm the copy **This creates an editable draft. Nothing is published until you publish it.** The version badge is **v1 · draft**, and the page says this is an editable draft. Change one question prompt, or use **Add question**, and confirm the edit remains.
6. **Publish standard** stays unavailable until there is at least one question and at least one applicable area. Publish it yourself with **Publish standard**. The badge becomes **v1 · published**. There is no automatic publish.
7. On the published standard, **Start audit for unit** for the first site, then **Start audit**.
8. Answer questions with **Yes** or **No**. Each answer shows **Saved**. On one question, **Select file** and wait for **Evidence attached**. Use **Next** to move through the standard.
9. **Complete audit**. The page title becomes **5S audit result**, with a score, the target, and the unit.
10. Reload that result. The score, answers, and attached evidence are still there.

**PASS:** a published standard was used to complete an audit, and the
answers, completion, and evidence survive a reload. A draft that was never
published, or a published standard that was never audited, is **FAIL**.

### 12. Gemba

Same organisation and first site.

1. Open Gemba. The empty organisation offers **Set up Gemba**.
2. On **Choose how to start**, open **LEH Quick Start**. Confirm **LEH Operational Gemba Walk**.
3. Tick the first site under **Applicable areas**, then **Use this starting point**.
4. Confirm **v1 · Draft** and the editable-draft notice. Change one prompt, or use **Add prompt**, and confirm the edit remains. LeanAI is not used on this pass and must not publish or choose applicability.
5. **Publish definition**. It stays unavailable until there is at least one prompt and one applicable area. The badge becomes **v1 · Published**.
6. **Start walk for unit** for the first site, then **Start walk**.
7. Enter **Notes** for the prompts you answer. **Saved** appears. While you use **Next**, the address may include `?prompt=`. That is expected during the walk. Attach evidence with **Select file** where the uploader is shown (**Evidence attached**).
8. **Capture observation**. Choose a type (**Positive practice**, **Improvement opportunity**, or **Issue**), enter the observation, and **Save**.
9. **Complete walk**. **Required prompts unanswered** must be 0 before **Confirm completion** is available. Add a **Summary / overall conclusion**, then **Confirm completion**.
10. The address is `/platform/gemba/walks/{id}` with no `?prompt=`. The title is **Gemba walk summary** and the status is **Completed**. Reload. The summary, observations, and evidence are still there.

**PASS:** a published definition was used to complete a walk, the walk
persists after reload, and the completed address has no `?prompt=`. A draft
or an unfinished walk is **FAIL**.

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

Start from an empty catalogue. The owner can manage the catalogue and the
curriculum. Publish **one** curriculum in this rehearsal. The Training matrix
reads a single published curriculum version, with no chosen order, so a
second published curriculum can hide this requirement.

1. Open Training. Courses says **No courses yet**. **Manage catalogue** says **No training courses yet**.
2. **New course**. **Course name** is required. Leave the generated course code. **Create draft course**.
3. On **Edit draft**, enter **Learning objectives**. Duration, validity, delivery method, trainer requirements, and evidence notes are optional. The publish notice says extra fields are not required. **Save draft**, then **Publish course**. The catalogue status becomes **Published**.
4. From Training, open **Curriculum editor** under **Setup**. The page title is **Training curricula**. An empty list already shows **New curriculum**. **Curriculum name** is required. Leave the generated code. **Create draft curriculum**.
5. **Add requirement**. Choose the course you just published. Under **Who this applies to**, select **Everyone in the organisation**. Under **Requirement status**, select **Mandatory**. Leave **Completion deadline (days)** and **Validity override (days)** blank. Those values are stored, and current compliance does not use them to show or hide a matrix cell. **Add requirement**.
6. In **Review before publishing**, confirm the course, **mandatory**, and **Everyone in the organisation needs this course.** Then **Publish curriculum**.
7. Open **Training matrix** (**Who needs what training, and where are the gaps?**).
8. The founder row shows the course with **Required**. The invited colleague appears the same way when they are an active member in the people directory. Reload. The same **Required** cell is still there.

Job function and unit choices do not filter who appears on this matrix.
**Job function, with a recorded organisational unit** says it does not
currently restrict compliance. Use **Everyone in the organisation** for this
pass.

Recording a completion is a separate session workspace: **Bulk completion**
on an existing session. The sessions list has no control to create a
session, so a fresh organisation cannot record a completion from this
journey. Leave completion out of this pass. If a session already exists,
**Bulk completion** is optional and the matrix cell can then show
**Completed**.

**PASS:** the authored mandatory requirement is visible as **Required** for
an applicable person on the Training matrix, and it is still there after
reload. A published course with no curriculum, or an optional requirement,
is **FAIL**. If the matrix cannot show that cell after this sequence,
record **PRODUCT GAP** with the URL and what the cell showed.

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
version. Published scales and standards are read-only. The database rejects
adding a level or requirement to a published or archived version, and it
rejects publishing a scale with fewer than two levels or a skills standard
whose requirements are missing or no longer valid.

### 21. Recognition

The founder is the award issuer. The Organisation Owner has every
permission, including **recognition.manage** (**Types**) and
**recognition.award** (**Award recognition**). A new organisation has no
recognition type, and an award cannot be issued until one exists.

The recipient can be the founder, when the founder appears under
**Recipient**, or the colleague from step 9. A second member is required
only for the unauthorised check, and that persona must be a **Team Member**.
Team Member has **recognition.read** only. A **Manager** can award, so do
not use a Manager for the denial check. If step 9 invited a Manager and no
Team Member exists, issue the award anyway and record the denial check as
**BLOCKED** with that reason.

1. Open Recognition. Confirm **Award recognition** and **Types** are both present for the owner. The feed may say **No recognition awards yet.** That empty state is the starting point, not the result.
2. Open **Types**. Under **Create recognition type**, enter **Name** and **Code**. Description is optional. **Create type**. The new type is listed.
3. **Award recognition**. **Recognition type** shows the type you created. Enter **Title** and **Message**. Choose the first site under **Organisation unit** and a person under **Recipient**. If **Organisation unit** is empty, select the active site in the sidebar first. **Award**.
4. The detail page title is the award title. Under **Recipients**, the link text is the person's name. A membership id in the profile address is expected. A membership UUID as the visible name is **FAIL**. If the name is the fallback **Person**, the membership has no display name: record that and treat it as **FAIL** for this check.
5. Return to Recognition. The award is in the feed and in **History**, with its title, message, and type. Reload. It is still there.
6. Sign in as the Team Member. **Award recognition** is absent. Opening `/platform/recognition/new` directly does not show the award form.

**PASS:** one award was issued, it is still in History after reload, and
the recipient is shown as a person's name. Empty History is **FAIL**.

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

- Confirm hosted migrations through `20261008072255` (230/230). Do not replay. The 2026-10-07 expectation `20261007143820` / 228 files is historical.
- Set Netlify server-only Stripe Sandbox env vars.
- Point the Sandbox webhook at the deployed `/api/billing/stripe/webhook`.
- Record the SHA under test.
- LIVE-CUTOVER only after this pack PASSes: live prices, live webhook,
  Supabase Pro, leaked-password protection, Terms/DPA/retention wording.
