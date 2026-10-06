# Shared standards vs site-local execution

Status: **MULTISITE-EXPAND-01C implementation record**

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

No first-class owner-transfer RPC exists. Ownership is an organisation-scoped grant of the organisation-owner role. Last-owner revoke/inactivate is blocked.

This slice does **not** invent an owner-transfer capability. Follow-up: #251.

## LeanAI

LeanAI may know organisation name, site names, multi-site intent, readiness, and whether a Maturity Framework exists. It is advisory only. It must not create a site, buy capacity, grant permissions, publish standards, invite people, or transfer ownership.
