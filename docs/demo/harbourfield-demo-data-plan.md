# Harbourfield demo data plan

Harbourfield Foods Group — Bodmin Bakery is the **hosted live-demo organisation** Przem uses for sales calls (admin, manager, and operator accounts). Local development continues to use **Apex Manufacturing** (`npm run db:seed-demo`) and **CookieWorks** (`npm run qa:cookie:*`) for QA. This document defines the **target storyline**, **gaps** versus what exists in the repo today, and the **records** the idempotent top-up script maintains.

## Current state in the repository

| Asset | What exists | Gap for Harbourfield |
| --- | --- | --- |
| Sales narrative | [LEH-DEMO-PRESENTATION-PLAYBOOK.md](../sales/LEH-DEMO-PRESENTATION-PLAYBOOK.md), marketing lineage on the homepage | No seeded records matching GEM → ACT → PS → PRJ → BEN chain |
| Local demo seed | `scripts/demo-seed/*` → Apex Manufacturing, full module coverage | Different org, Cornwall Plant naming, not the Bodmin Bakery story |
| QA tenant | `scripts/qa-tenant/*` → CookieWorks two-site harness | Different org; not for presenter demos |
| Hosted Harbourfield | Referenced in presenter checklist; real org code/ID **not** committed | Needs scoped top-up script + explicit hosted runbook (no ad-hoc seeding on calls) |
| Manager home “Needs attention” | `buildHomeAttentionItems` (overdue actions, ideas awaiting review, benefits awaiting validation) | Demo org must hold at least one of each |
| PPS / walk / audit UX polish | Mobile footers, session guidance (post #332) | Active PPS case with session; in-progress and completed 5S / Gemba |

## Demo storyline by role

### Admin

1. **Organisation setup** — Confirm Bodmin Bakery site hierarchy (plant → packing → Packing Line 1) and that maturity / 5S / Gemba catalogues are published.
2. **Governance** — Roles and memberships unchanged by the script on hosted; local-only run can provision `@harbourfield.local` personas.
3. **Modules touched** — Organisation structure, maturity framework, 5S standard, Gemba definition, suggestion programme, benefit categories.

### Manager (primary presenter)

1. **Home** — “Needs attention” strip shows overdue actions, ideas awaiting review, and benefits awaiting validation.
2. **Gemba** — Completed walk with finding *Packaging film misaligned on Packing Line 1*; optional in-progress walk for mobile footer demo.
3. **Actions** — Story corrective action *Realign the film guide and confirm the first-off pack* plus at least one **overdue** open action.
4. **Problem solving** — Active case *Recurring film wander on Packing Line 1* with an open **session** and linked actions (AI / PPS demo).
5. **Projects & benefits** — Active project *Packing Line 1 film-path countermeasures*; benefit *Packing line film-path stability improvement* **awaiting validation** (not shown as verified savings).
6. **5S** — One **completed** audit and one **in-progress** audit on the packing area, with at least one finding on the in-progress audit.
7. **Maturity** — Published official result history for Bodmin Bakery plus an in-progress self-assessment.
8. **Suggestions** — At least one submitted idea **awaiting review**.
9. **Modules touched** — Platform home, Gemba, Actions, Problem solving, Projects, Benefits, 5S, Maturity, Suggestions, Schedule (where schedules exist).

### Operator

1. **Shop floor** — Perform or resume in-progress 5S audit / Gemba walk (mobile footers).
2. **Contributions** — Visible assigned actions; optional contributor on the PPS case.
3. **Suggestions** — Can submit ideas; seeded “awaiting review” item demonstrates manager queue.
4. **Modules touched** — 5S, Gemba, Actions, Suggestions (read/submit).

## Record checklist (top-up contract)

Stable keys are **display titles / codes** in `scripts/harbourfield-demo/constants.ts`. The script only creates missing records or normalises status/dates on re-run.

| Area | Records |
| --- | --- |
| Sites / areas | `bodmin-bakery`, `packing`, `packing-line-1` |
| Maturity | Model “Harbourfield Operating Standard”; one published formal assessment; one in-progress self-assessment |
| 5S | Standard “Bodmin Bakery Packing 5S Standard”; completed audit; in-progress audit with finding |
| Gemba | Definition “Bodmin Bakery Morning Gemba”; completed walk (film misalignment observation); in-progress walk |
| Actions | Story corrective action; ≥1 overdue open action; actions linked from PPS where applicable |
| PPS | Case “Recurring film wander on Packing Line 1”; active session; containment / case actions |
| Projects | “Packing Line 1 film-path countermeasures” (active) |
| Benefits | “Packing line film-path stability improvement” (awaiting validation) |
| Suggestions | Programme + categories if missing; “Improve film splice checklist at Packing Line 1” (submitted, awaiting review) |
| Notifications | Driven by domain events when users work the app; script does not write delivery ledger rows |

## Safety and scope

- **Organisation scope** — Only the organisation matching `LEANHUB_HARBOURFIELD_ORG_CODE` (default `harbourfield-foods-group`) or explicit `LEANHUB_HARBOURFIELD_ORG_ID`. Abort if multiple matches.
- **Hosted** — Blocked unless `LEANHUB_HARBOURFIELD_DEMO_TARGET=hosted` with matching project ref and (for apply) `LEANHUB_HARBOURFIELD_DEMO_CONFIRM`.
- **Local** — `npm run demo:harbourfield:top-up` (apply) or `:dry-run` (plan only). Optional local foundation when the org is missing (`LEANHUB_HARBOURFIELD_PROVISION_LOCAL=1`, default on local apply).
- **Never** — Apex/CookieWorks orgs, other tenants, production schema changes from this task.

## Przem approval before hosted apply

Confirm and set in CI secrets or a one-off shell (not in repo):

1. Exact **organisation code** (and optionally UUID) on the hosted demo project.
2. **Supabase project ref** for the demo environment only.
3. **Service role** and publishable keys via `LEANHUB_HARBOURFIELD_DEMO_*` env vars (see script header).
4. Written approval to run **apply** (not dry-run) against hosted Harbourfield.

## Running locally

```bash
npm run db:start
npm run demo:harbourfield:top-up:dry-run
npm run demo:harbourfield:top-up
```

Re-run apply safely; dry-run prints planned creates/updates without writes.
