# RBAC2 foundation — discovery and design

**Status:** PR 1 of Issue #57 (pre-smoke foundation gate)  
**Scope:** Module responsibilities, baseline participation, Access & Responsibilities UX  
**Out of scope:** Site isolation, Organisation Structure V2 (follow in PR 2+)

## Executive summary

RBAC2 is an evolution of the existing permission-first, version-bound RBAC model — not a replacement. The database already supports **multiple simultaneous `access_grants`** per membership with independent roles and scopes. PR 1 adds:

1. A **default module responsibility catalogue** (capability × scope)
2. **Baseline participation** for active members (separate from module management)
3. **Access & Responsibilities** administration UX

## What already works (unchanged)

| Area | Finding |
|------|---------|
| Core tables | `permission_definitions`, `roles`, `role_versions`, `role_permissions`, `access_grants`, `role_grant_scope_policies` |
| Multi-grant | Partial unique index on active grant identity; evaluation is **union (OR)** across grants |
| Scope semantics | `organisation` (any target), `self` (membership anchor), `unit_subtree` (closure table) |
| Role lifecycle | Draft → published → retired; immutable published versions; guards on grants |
| Delegation | `role_version_is_delegatable_at_scope`, grant containment, no self-escalation |
| Protected roles | Owner/admin protected; protected permissions only on protected roles |
| Custom roles | No scope policy → legacy permissive scope; fully supported |
| Invitations / provisioning | Single-grant flows work; multi-grant at DB layer proven in PS visibility tests |

## What must change (this PR)

| Gap | Solution |
|-----|----------|
| Job-title default roles (`manager`, `team-member`) conflate placement and capability | Add **module responsibility** roles; legacy roles retained for compatibility |
| Module visibility requires `*.read` grant | **Baseline participation** grants read/submit/participate to active members |
| Admin UX exposes opaque role versions | **Access & Responsibilities** UX with module labels and scope |
| Suggestions submit requires grant | Baseline `suggestions.submit` for active members |
| Production manager with scoped Suggestions responsibility cannot submit | Baseline submit independent of management grant |

## Module responsibility catalogue

Default protected catalogue roles (`roles.module_responsibility_key`):

| Key | Display | Management permissions (scoped) | Allowed grant scopes |
|-----|---------|-----------------------------------|----------------------|
| `admin` | Admin | Organisation administration bundle (existing `organisation-administrator`) | `organisation` |
| `maturity` | Maturity | models.manage, assess.formal, review, schedules.* | `organisation`, `unit_subtree` |
| `five_s` | 5S | standards.manage, audit.review | `organisation`, `unit_subtree` |
| `gemba` | Gemba | definitions.manage, walk.review | `organisation`, `unit_subtree` |
| `actions` | Actions | create, update, assign, complete | `organisation`, `unit_subtree` |
| `projects` | Projects | manage | `organisation`, `unit_subtree` |
| `benefits` | Benefits | manage, categories.manage, create, validate.ci, realisation.record | `organisation`, `unit_subtree` |
| `problem_solving` | Problem Solving | manage, methods.manage, create, facilitate | `organisation`, `unit_subtree` |
| `suggestions` | Suggestions | review, manage, programmes.manage (+ read within scope) | `organisation`, `unit_subtree` |
| `people` | People | capability.read, memberships.read, job_functions.* | `organisation`, `unit_subtree` |
| `training` | Training | catalog/curriculum/sessions/completions.manage | `organisation`, `unit_subtree` |
| `skills` | Skills | catalog/requirements.manage, assess | `organisation`, `unit_subtree` |
| `recognition` | Recognition | manage, award | `organisation`, `unit_subtree` |

Legacy roles (`manager`, `team-member`, `finance-validator`) remain provisioned and delegatable for backward compatibility.

## Baseline participation

Active members with complete identity enrolment receive **implicit** baseline permissions via `private.membership_has_baseline_participation()` integrated into `membership_has_scoped_permission` and `member_has_permission`.

| Module | Baseline permissions | Scope mode | Notes |
|--------|---------------------|------------|-------|
| Suggestions | read (UI probe only), submit (scoped) | organisation | `suggestions.read` excluded from scoped evaluation to preserve record-level RBAC |
| Actions | read, complete | self | Assignee/creator paths use membership anchor |
| Training | read | self | Own training visibility |
| Skills | read | self | Own skill profile |
| People | capability.read | self | Own capability profile |
| Maturity, 5S, Gemba, PS, Projects, Benefits, Recognition | read / view | organisation | **Read visibility only**; `target_unit_id` not evaluated in PR1 |
| Shared reads | templates.read, attachments.read, comments.read, schedules.read | organisation | Module visibility / participation reads |

### Explicitly excluded from baseline (PR1)

These require assignment, participant, or module-responsibility grants — **not** organisation-wide baseline:

| Permission | Reason |
|------------|--------|
| `five_s.audit.perform` | `start_five_s_audit` only checks scoped permission; no assignment gate |
| `gemba.walk.perform` | `start_gemba_walk` only checks scoped permission |
| `problem_solving.contribute` | Case contribute checks org-wide scoped permission |
| `submissions.create` | Generic write without assignment seam |
| `comments.create` | Generic write without assignment seam |

Assigned-work perform/contribute authority must be granted via module responsibility or legacy role grants until a dedicated assignment-aware participation seam exists.

### `membership_has_baseline_participation` scope semantics

Two evaluation paths exist:

- **`membership_has_baseline_participation_probe`** — used by `member_has_permission` for UI/navigation probes. Active membership alone is sufficient; no anchor checks.
- **`membership_has_baseline_participation`** — used by `membership_has_scoped_permission` for record/RPC authorization. Respects `include_in_scoped_permission` and anchor rules:
  - **organisation mode:** authorises when `target_membership_id is null`. Does **not** evaluate `target_unit_id`.
  - **self mode:** authorises only when `target_membership_id = actor_membership.id` (never via null anchor).

`suggestions.read` is probe-only (`include_in_scoped_permission = false`) so record-level suggestion visibility remains grant/assignment qualified.

Module **management** permissions are never implied by baseline.

## Migration strategy

- Forward-only migration `20260907172036_rbac2_module_responsibilities_foundation.sql`
- Idempotent role provisioning by `canonical_name` (`responsibility-*`)
- Backfill module catalogue for existing organisations (no grant mutation)
- `organisation-administrator` tagged with `module_responsibility_key = 'admin'`
- No silent widening of existing scoped management authority

## Compatibility risks

| Risk | Mitigation |
|------|------------|
| Custom role publish does not migrate grants | Documented; unchanged; advanced admin path |
| `member_has_permission` ignores scope | Baseline integrated; scoped checks use `has_scoped_permission` |
| Legacy manager grants overlap module responsibilities | Both coexist; admins assign module responsibilities going forward |
| Site isolation not yet enforced | Documented handoff for PR 2 |

## Handoff — Site isolation (PR 2)

- Operational records use `organisation_id` + `organisational_unit_id`; no universal `site_id` yet
- `unit_subtree` scope follows hierarchy, not site boundary
- Multi-site CookieWorks QA requires explicit site security boundary before smoke testing
- RBAC2 scoped grants are necessary but not sufficient for cross-site denial

## Handoff — Organisation Structure V2 (PR 3)

- Units are editable via existing RPCs; retirement/move policies need V2 lifecycle
- Reparenting across sites is a security-sensitive operation (blocked or controlled transfer)
- Stable UUID preservation already supported

## Test coverage

See `supabase/tests/database/rbac2_foundation.test.sql` for:

- Multi-responsibility grants (Suggestions + 5S + Projects)
- Scope containment
- Baseline suggestions submit without management role
- Revoked/inactive denial
- Custom role compatibility
- Self-escalation denial
