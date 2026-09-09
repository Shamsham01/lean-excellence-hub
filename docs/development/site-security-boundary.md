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

## Site resolution invariant (fail-closed)

`private.resolve_site_unit_id(org_id, unit_id)` enforces:

| Ancestor sites | Result |
|----------------|--------|
| Exactly one active site ancestor | That site UUID (nearest depth wins only when unambiguous) |
| Zero site ancestors | `NULL` |
| Two or more distinct site ancestors | `NULL` (ambiguous — fail closed) |

**Topology prevention:** `private.create_organisation_unit` rejects creating a site unit under a parent that already has a site ancestor (`nested site units are not permitted`). Cross-site reparent remains blocked in `private.move_organisation_unit`.

This prevents silent “nearest site wins” authorisation when malformed hierarchies exist. PR3 must preserve the single-site-ancestor invariant.

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
| Training | training_sessions | organisation_id | organisational_unit_id (nullable) | **site_unit_id** when unit set |
| Skills | membership_skill_assessments | organisation_id | organisational_unit_id (nullable) | **site_unit_id** when unit set |
| Shared | resource_records | organisation_id | via parent can_read_* | Inherits parent site |
| Shared | attachments, comments | organisation_id | resolve_attachment_target_unit_id | Inherits target resource |
| Child tables | *\_participants, *\_reviews, PS children, etc. | organisation_id | parent FK only | Inherit parent RLS |

### Anchor / snapshot consistency

`private.finalise_operational_site_snapshot` centralises INSERT/UPDATE validation:

- **INSERT:** when site boundary active and anchor mandatory → unresolved site raises `site ownership could not be resolved`
- **UPDATE anchor:** cross-site anchor change → `cross-site operational record move is not permitted`
- **UPDATE site_unit_id:** always blocked (`site ownership is immutable`)
- **Mismatch:** explicit `site_unit_id` that disagrees with resolved anchor → `site snapshot does not match unit anchor`

**Exceptions (nullable anchor allowed):**

| Table | Nullable anchor | Semantics |
|-------|-----------------|-----------|
| actions | `unit_id` | Organisation-level actions permitted |
| training_sessions | `organisational_unit_id` | Organisation-wide sessions permitted |
| membership_skill_assessments | `organisational_unit_id` | Membership-anchored assessments permitted |

All other snapshotted operational roots require a resolvable site when `organisation_requires_site_boundary()` is true.

## Site resolution primitives

| Function | Purpose |
|----------|---------|
| `organisation_requires_site_boundary(org_id)` | True when org has ≥1 active site unit |
| `resolve_site_unit_id(org_id, unit_id)` | Unambiguous site ancestor only; else NULL |
| `count_site_ancestors(org_id, unit_id)` | Diagnostic count for rollout/migration |
| `membership_home_site_unit_id(org_id, membership_id)` | Site from primary job placement |
| `membership_can_access_unit_site(org_id, membership_id, unit_id)` | Home site matches target unit's site |
| `units_share_site_boundary(org_id, unit_a, unit_b)` | Same site or legacy org (no sites) |
| `finalise_operational_site_snapshot(...)` | Central anchor/snapshot enforcement |

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

## Directory enumeration

`organisation_units` SELECT RLS and delegation/maturity scope listing RPCs apply `membership_can_access_unit_site` when boundary active, unless the actor has organisation-wide `hierarchy.read`, `memberships.manage`, or `roles.delegate`.

## Invitation / provisioning containment

| Path | Control |
|------|---------|
| `assert_grant_site_containment` | unit_subtree grants must be within actor's site unless org delegate |
| `assert_membership_placement_site_containment` | Placement unit must be in actor's site unless org memberships.manage |
| `grant_role_version` | Wired to `assert_grant_site_containment` |
| `assign_membership_job_function` | Wired to `assert_membership_placement_site_containment` |
| Workforce provision / invitations | Wired to both assertions |

## Migration / rollout safety

`20260907220027_site_security_boundary.sql` — forward-only; local/CI only until hosted rollout gate.

After backfill, migration **fails** if any site-boundary organisation has site-owned operational rows with a non-null anchor but `site_unit_id IS NULL`. No silent partial rollout.

### Transition path

1. **Single-site legacy** — no active site units → boundary inactive; legacy behaviour preserved.
2. **Introduce first explicit site** — boundary activates; existing anchored records must backfill deterministically or migration aborts with table-level diagnostics.
3. **Add second site** — cross-site isolation active; administrators must not leave anchored records in ambiguous/unresolved state.

## Test coverage

`supabase/tests/database/site_security_boundary.test.sql` — CookieWorks two-site fixture:

- Site resolution (self, descendant, ambiguous, no ancestry)
- Nested site prevention
- Home site from placement
- Baseline read Bodmin ✓ Exeter ✗ (per-module matrix)
- Multi-responsibility independent scope + revoke
- Child UUID leakage (comments, PS children, suggestions)
- RLS direct UUID denial
- unit_subtree management site containment
- organisation grant cross-site
- Cross-site reparent blocked
- Anchor/site consistency + immutability
- Directory enumeration + delegation scope picker
- Invitation provisioning hostile tests

Focused E2E: `tests/e2e/site-security-boundary.spec.ts` (local QA seed).

## PR3 Organisation Structure V2

**Status:** PR 3 of Issue #57 — implemented on `cursor/organisation-structure-v2-pr3`.

### Lifecycle

| Operation | RPC | Notes |
|-----------|-----|-------|
| Create | `create_organisation_unit` | Unchanged; hierarchy.manage on parent |
| Edit | `update_organisation_unit` | Name and unit type only; code immutable; UUID preserved |
| Reparent | `move_organisation_unit` | Same-site only when boundary active; closure rebuilt |
| Archive | `set_organisation_unit_status(..., 'retired', reason)` | Non-destructive; blocks active children, placements, scoped grants |
| Reactivate | `set_organisation_unit_status(..., 'active', ...)` | Requires active parent |

Hard delete is not exposed in the structure UI. Retirement does not revoke grants or move placements — administrators must resolve blockers explicitly.

### Stable UUID rule

All lifecycle operations mutate `organisation_units` rows in place. Identifiers (`id`, `code`) are preserved for historic references, grants, and operational snapshots.

### Archive vs delete

| | Archive (retire) | Delete |
|--|------------------|--------|
| UUID | Preserved | Would break FK history |
| Status | `retired` | N/A in PR3 UI |
| Active tree | Hidden | N/A |
| Historic grants | Remain visible with unit name | N/A |
| New scope offers | Excluded (`status = active` filter) | N/A |

### Within-site reparent

`move_organisation_unit` rejects cross-site parent selection when `organisation_requires_site_boundary()` is true (`cross-site unit reparent is not permitted`). Cycles, self-parent, and descendant-as-parent are rejected.

### Cross-site move blocked

Cross-site transfer workflow is out of scope for PR3. Operational `site_unit_id` snapshots remain immutable.

### Interaction with scoped responsibilities

- `get_delegatable_access_offers` lists only **active** units for `unit_subtree` scopes
- Existing grants on archived units continue to evaluate; profile UI shows `scope_unit_name` from the unit row
- Revoking one grant does not affect other grants (unchanged RBAC2 union semantics)
- Archive rejects units that anchor active `unit_subtree` grants

### UI

`/platform/settings/structure` — active tree with edit/move/archive actions, archived section with reactivate, create form unchanged.

### Tests

- `supabase/tests/database/organisation_structure_v2.test.sql`
- `tests/e2e/organisation-structure-v2.spec.ts`

## Hosted rollout

**Do not deploy** until PR2 CI green and Issue #57 gate approves. Hosted CookieWorks data unchanged.
