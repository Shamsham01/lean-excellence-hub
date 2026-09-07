# Site security boundary — Issue #57 PR2

**Status:** PR 2 of Issue #57 (pre-smoke security gate)  
**Branch:** `cursor/site-security-boundary-pr2`  
**Depends on:** PR #60 RBAC2 foundation, PR #61 CI Performance V2

## Executive summary

PR2 makes **site** a real database-enforced security boundary within a multi-site organisation. Active members receive **baseline participation reads within their home site** only. Module responsibility grants remain independent; `unit_subtree` grants are **site-contained**; `organisation` grants may legitimately span sites.

## Design decision: hybrid site ownership model

| Question | Decision | Why safe |
|----------|----------|----------|
| A. Derive site from hierarchy only? | **Partial** — used for live resolution | Stable for membership placement and grant scope evaluation via indexed closure table |
| B. Explicit `site_unit_id` on records? | **Yes** — on operational root entities | Historical ownership cannot change when hierarchy is reparented in PR3 |
| C. Hybrid? | **Selected** | Derive for placement/grants; snapshot for operational records |

**Site identity** reuses MAT1a semantic normalisation (`private.normalise_organisation_unit_semantic_scope`): `site`, `plant`, `facility`, `factory`, `location` → site semantics. Sites are `organisation_units` with normalised type = `site`; no parallel hierarchy.

**Single-site compatibility:** When an organisation has **no** active site units, `organisation_requires_site_boundary()` returns false and organisation-mode baseline behaves as PR1 (legacy permissive within tenant).

## Ownership inventory

| Module | Table / resource | Tenant anchor | Unit anchor | Site strategy |
|--------|------------------|---------------|-------------|---------------|
| Foundation | organisations | id | — | Tenant boundary |
| Foundation | organisation_memberships | organisation_id | placement via job assignment | Home site from placement |
| Foundation | organisation_units | organisation_id | parent_unit_id | Site = semantic type |
| Foundation | organisation_unit_closure | organisation_id | ancestor/descendant | Subtree + site resolution |
| Foundation | access_grants | organisation_id | scope_unit_id | unit_subtree site-contained |
| Maturity | maturity_assessments | organisation_id | unit_id | **site_unit_id** snapshot |
| 5S | five_s_audits | organisation_id | unit_id | **site_unit_id** snapshot |
| Gemba | gemba_walks | organisation_id | unit_id | **site_unit_id** snapshot |
| Schedules | schedule_definitions, schedule_occurrences | organisation_id | unit_id | **site_unit_id** snapshot |
| Actions | actions | organisation_id | unit_id (nullable) | **site_unit_id** snapshot when unit set |
| Projects | ci_projects | organisation_id | unit_id | **site_unit_id** snapshot |
| Suggestions | improvement_suggestions | organisation_id | origin_unit_id (+ target/jurisdiction) | **site_unit_id** from origin |
| Benefits | improvement_benefits | organisation_id | organisational_unit_id | **site_unit_id** snapshot |
| Problem Solving | problem_solving_cases | organisation_id | organisation_unit_id | **site_unit_id** snapshot |
| Recognition | recognition_awards | organisation_id | organisational_unit_id | **site_unit_id** snapshot |
| Training | training_sessions | organisation_id | organisational_unit_id | **site_unit_id** snapshot |
| Skills | membership_skill_assessments | organisation_id | organisational_unit_id | **site_unit_id** snapshot |
| Shared | resource_records | organisation_id | via parent can_read_* | Inherits parent site |
| Shared | attachments, comments | organisation_id | resolve_attachment_target_unit_id | Inherits target resource |
| Child tables | *\_participants, *\_reviews, PS children, etc. | organisation_id | parent FK only | Inherit parent RLS |

## Site resolution primitives

| Function | Purpose |
|----------|---------|
| `organisation_requires_site_boundary(org_id)` | True when org has ≥1 active site unit |
| `resolve_site_unit_id(org_id, unit_id)` | Nearest ancestor site via closure (indexed) |
| `membership_home_site_unit_id(org_id, membership_id)` | Site from primary job placement |
| `membership_can_access_unit_site(org_id, membership_id, unit_id)` | Home site matches target unit's site |
| `units_share_site_boundary(org_id, unit_a, unit_b)` | Same site or legacy org (no sites) |

## Membership home site

Primary placement from `membership_job_function_assignments` (is_primary = true, valid window). Home site = `resolve_site_unit_id(placement_unit_id)`.

| Placement | Home site |
|-----------|-----------|
| Site unit itself | That site |
| Department/line descendant | Ancestor site |
| Organisation root without site ancestor | **null** → fail closed when boundary required |
| Ambiguous / inactive | **null** → fail closed |

Organisation-level users with `organisation`-scoped grants bypass site via grant path, not baseline.

## Baseline participation (PR1 tightening)

| Mode | PR1 | PR2 |
|------|-----|-----|
| Probe (`membership_has_baseline_participation_probe`) | Active member → module visible | Unchanged |
| Scoped org-mode (`membership_has_baseline_participation`) | `target_unit_id` ignored | Requires matching home site when boundary active |
| Scoped org-mode, null unit | Authorised | **Denied** when boundary active (no record-wide baseline) |
| Self-mode | Membership anchor | Unchanged |

`has_scoped_permission` now includes scoped baseline for the current session actor (central fix for `can_read_*` RLS paths).

## Module responsibility × site

| Grant scope | Cross-site |
|-------------|------------|
| `organisation` | Allowed per permission |
| `unit_subtree` | **Contained** — scope_unit and target must share site |
| `self` | Unchanged |

Multiple module grants evaluate independently (OR union unchanged).

## Child resource inheritance

Children without unit columns inherit parent `can_read_*` / `can_access_resource`. Site boundary enforced at parent permission evaluation. Direct UUID access to child rows denied when parent is hidden.

## Historical ownership / reparenting contract (PR3 handoff)

1. **`site_unit_id`** set on INSERT via trigger; **immutable** (update blocked).
2. **Cross-site reparent** blocked in `move_organisation_unit` when boundary active.
3. PR3 Organisation Structure V2 will implement safe reparent lifecycle respecting snapshotted ownership.

## Invitation / provisioning containment

| Path | Control |
|------|---------|
| `assert_grant_site_containment` | unit_subtree grants must be within actor's site unless org delegate |
| `assert_membership_placement_site_containment` | Placement unit must be in actor's site unless org memberships.manage |
| Workforce provision / invitations | Wired to both assertions |

## Custom roles

Custom roles without scope policies retain legacy permissive scope but **unit_subtree evaluation** still applies site containment when boundary active.

## Migration

`20260907220027_site_security_boundary.sql` — forward-only; local/CI only until hosted rollout gate.

## Test coverage

`supabase/tests/database/site_security_boundary.test.sql` — CookieWorks two-site fixture:

- Site resolution
- Home site from placement
- Baseline read Bodmin ✓ Exeter ✗
- RLS direct UUID denial
- unit_subtree management site containment
- organisation grant cross-site
- Cross-site reparent blocked
- site_unit_id immutability

## PR3 Organisation Structure V2 handoff

- Safe reparent UX and lifecycle
- Hierarchy editor
- Cross-site transfer workflow (explicit, audited)
- site_unit_id contract is stable — reparent must not rewrite snapshots

## Hosted rollout

**Do not deploy** until PR2 CI green and Issue #57 gate approves. Hosted CookieWorks data unchanged.
