# Shared standards vs site-local execution

Status: **MULTISITE-EXPAND-01C + 01D implementation record**

Date: **2026-10-06**

Lean Excellence Hub keeps one organisation tenant and many operational sites.

- **Organisation** = company / business / group / tenant boundary
- **Site** = operational scope and billable quantity
- Site-based billing, not per-user billing
- Multi-site intent (`organisations.multi_site_intent`) is product context only. It never grants access or subscribed site capacity.

This document records the governance taxonomy we are moving toward. MULTISITE-EXPAND-01C proves **one vertical slice (Maturity)** rather than changing every module.

Access remains explicit RBAC. Organisation-wide visibility is never inferred from job title, email domain, founder status after role changes, or hierarchy position.

## Organisation vs Site in first-customer onboarding

Founding captures:

1. Organisation name — the company or group
2. First site name — the operational location being set up first
3. Whether the site is part of a wider multi-site organisation (`yes` / `no` / `not_sure`)

Legacy organisations with `NULL` intent are treated as **not sure** in product UX. Existing names, sites, grants, and history are not rewritten.

## Shared standard vs site-local execution

| Domain | Organisation / shared | Site-local execution | Current behaviour | Follow-up |
| --- | --- | --- | --- | --- |
| Maturity | Frameworks / model versions | Assessments and results | Organisation-owned catalogue; assessments unit-anchored with `site_unit_id` | Proven in this slice |
| 5S | Standards / templates | Audits | Organisation-owned standards; audits carry unit and site | None this PR |
| Gemba | Definitions / templates | Walks | Organisation-owned definitions; walks carry unit and site | None this PR |
| Training | Courses / curricula | Sessions | Organisation catalogue; sessions may be unit-null | Confirm unit-null sessions stay intentional |
| Skills | Skill and capability definitions | Assessments / assignments | Organisation-owned definitions; membership assessments carry site | None this PR |
| Suggestions | Programmes / categories | Ideas / workflow | Programmes organisation-owned; a version has one optional unit | Programme applicability is single-unit |
| Actions | — | Actions | Unit is optional; site is set when a unit exists | Do not silently broaden unit-less actions |
| Projects | Methodologies | CI projects | Organisation methodologies; projects require unit and site | None this PR |
| Benefits | Categories / settings | Benefit records | Organisation categories; records carry unit and site | None this PR |

Source of truth in code: `src/modules/organisation-rollout/taxonomy.ts`.

Do not silently broaden visibility for existing records. Mismatches are follow-ups, not automatic inheritance.

## Vertical proof: Maturity

Organisation:

- Shared Maturity Framework (model + published version)

Each site:

- Its own assessments and results

Sibling-site users cannot read another site’s assessments. Organisation-wide authorised users can access permitted sites according to explicit grants. Site B setup must not mutate Site A history.

## Rollout & Governance

Home: Settings → Organisation → Rollout & Governance.

Guided **Roll out another site** orchestrates existing capabilities:

1. Capacity — #247 / #249; exhausted capacity points at Add site capacity when the actor has `billing.manage`
2. Site — `create_organisation_unit` with the database site-capacity guard; no shadow/pending sites
3. Local access — published delegatable RBAC, site-scoped only in this flow
4. Standards — explain reuse of the organisation Maturity Framework

`billing.manage` cannot create sites. `hierarchy.manage` without billing cannot buy capacity.

## Organisation-wide vs site-scoped access

| Customer language | Grant shape |
| --- | --- |
| Entire organisation | `scope_type = organisation` and `scope_unit_id` is null |
| Specific site | `scope_type = unit_subtree` and `scope_unit_id` = that site |

Null `scope_unit_id` alone is not organisation-wide (`self` also uses null). Delegation remains fail-closed: a site-scoped administrator cannot offer organisation-wide grants.

## Ownership transfer

Status: **MULTISITE-EXPAND-01D** (#251)

Organisation ownership is an organisation-scoped grant of the protected
`organisation-owner` role (`roles.is_owner_role`) bound to the current published
role version. There is no separate owner column and no parallel ownership model.

### Authority

Only a current effective organisation owner may initiate a transfer
(`private.current_membership_is_owner` / `private.membership_is_effective_owner`).

`hierarchy.manage`, `billing.manage`, site-scoped manager grants, and
`roles.delegate` alone are not sufficient.

### Target eligibility (v1)

The target must already be an **active** member of the **same** organisation,
with complete identity enrolment.

Not eligible:

- an email that is not yet a member
- a pending invitation
- pending or inactive membership
- a member of another organisation
- inferred users from email domain or job title

If the desired person is not yet an active member, invite them first through
People. Invitation and ownership transfer remain two explicit steps.

The eligible-target query is organisation-scoped in the database. It never loads
platform memberships for client-side filtering. The current owner is excluded.
A member who is already an owner may be listed as **Already an owner**; transfer
still completes by removing the source owner grant and does not create a
duplicate owner grant.

### Transaction

`public.transfer_organisation_ownership(target_membership_id)` is a narrow domain
RPC. The public wrapper is `SECURITY INVOKER`; the implementation is private
`SECURITY DEFINER` with `search_path = ''`.

Inside one transaction:

1. Authenticate the current membership and organisation
2. Take the organisation advisory lock (`pg_advisory_xact_lock`)
3. Verify the source is an active organisation owner
4. Lock source/target memberships and owner grants (`FOR UPDATE`)
5. Verify the target is an eligible active member of the same organisation
6. Resolve the current published organisation-owner role version
7. Grant that version to the target if they do not already hold an effective
   organisation-owner grant (reuses `private.grant_role_version`)
8. Revoke only the source organisation-owner grant(s) (reuses
   `private.revoke_access_grant`)
9. Preserve source membership and all other source grants
10. Verify at least one effective owner remains
11. Append `organisation.ownership_transferred`
12. Commit

Any failure rolls back. The browser must not grant then revoke in two calls.

### Concurrency and last-owner safety

Two tabs are serialised on the organisation advisory lock. After a successful
transfer the former owner is no longer authorised; a replay returns
`organisation ownership transfer is not authorised` (`42501`). That is not an
idempotent success path.

Existing last-owner revoke/inactivate protections remain fail-closed.

### Former owner

The former owner remains an organisation member. Unrelated grants, including
site-scoped CI/admin access, are unchanged. Transfer does **not** invent a
replacement role. If they still need site administration, assign it through
People.

### Audit

Successful transfers append `organisation.ownership_transferred` with
organisation, source membership, target membership, grant ids, timestamp, and
`succeeded`. Failed attempts follow the existing grant/revoke pattern: raise and
roll back without a noisy denied event that could leak cross-tenant membership
data. Metadata does not store secrets or tokens.

### Failure and recovery

Because the operation is atomic:

- If the database call fails, ownership is unchanged and the source remains
  owner. The UI shows a retryable error.
- If the client disconnects after commit, reload shows the authoritative
  owner. Do not attempt automatic rollback.
- Hosted manual SQL is not part of the normal process.

### Product UI

Settings → Organisation → Rollout & Governance shows the current owner where
`memberships.read` allows, and **Transfer ownership** only for the current
owner. The dedicated flow is
`/platform/settings/organisation/ownership`.

This implements #219 acceptance criterion 10 (ownership can evolve from site
pilot owner to corporate owner without tenant recreation). Parent #219 remains
open until remaining criteria are complete.

### LeanAI / billing / site effects

Ownership transfer must not change subscription quantity, Stripe customer,
sites, multi-site intent, published Maturity frameworks, operational records,
or other members. LeanAI must not transfer ownership.

## LeanAI

LeanAI may know organisation name, site names, multi-site intent, readiness, and whether a Maturity Framework exists. It is advisory only. It must not create a site, buy capacity, grant permissions, publish standards, invite people, or transfer ownership.
