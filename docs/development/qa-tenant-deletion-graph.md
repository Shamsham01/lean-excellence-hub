# CookieWorks QA tenant deletion graph

This document describes how the CookieWorks destructive reset (`npm run qa:cookie:reset` /
`npm run qa:cookie:hosted-reset`) removes tenant-owned module data while preserving foundation
records and leaving other organisations untouched.

## Scope

| Scope | Included |
| --- | --- |
| Organisation | `cookieworks-manufacturing` only |
| Database | `public` module tables with `organisation_id`, selected `private` operational tables, indirect child tables |
| Storage | `organisation-evidence` bucket objects under `{organisation_id}/` prefix |
| Excluded | Apex demo tenant, unrelated organisations, shared buckets outside CookieWorks prefix |

## Foundation allowlist

Foundation tables are preserved during purge. They are defined in
`scripts/qa-tenant/deletion-graph.ts` (`FOUNDATION_TABLES`) and include:

- Organisation shell: `organisations`, `organisation_memberships`, `organisation_units`,
  `organisation_unit_closure`
- Access control: `roles`, `role_versions`, `role_permissions`,
  `role_grant_scope_policies`, `access_grants`
- Invitations/provisioning: `organisation_invitations`, `organisation_invitation_grants`,
  `organisation_invitation_provisioning`, `organisation_document_sequences`
- Settings and bootstrap catalogue: `organisation_ai_settings`, `benefit_reporting_settings`,
  `problem_solving_methods`, `problem_solving_method_versions`, `problem_solving_method_stages`
- Workforce foundation: `workforce_provision_intents`, `workforce_import_jobs`,
  `workforce_import_rows`, `workforce_import_row_credentials`, `private.workforce_aliases`
- Append-only audit streams: `security_audit_events`, `business_audit_events`
- Notification contacts: `membership_notification_contacts`

## Direct module deletion

Almost every LEH module table carries `organisation_id`. The reset discovers these tables from
`information_schema` at runtime and deletes rows scoped to the CookieWorks organisation.

Deletion uses a deterministic multi-pass sweep (max 160 passes):

1. Fail closed if unclassified append-only DELETE/UPDATE protections are discovered.
2. Pre-delete private operational envelopes/outbox rows for the organisation.
3. Pre-delete known indirect children (see below).
4. Explicitly unlock and delete the maturity subgraph.
5. Controlled-retirement-delete approved module-stage append-only history
   (`suggestion_reviews`, `suggestion_status_history`, `action_status_transitions`,
   and the other tables in `MODULE_STAGE_CONTROLLED_RETIREMENT_TABLES`) by
   disabling only those named DELETE triggers, deleting `organisation_id`-scoped
   rows, then re-enabling the triggers. Production FKs and triggers are not
   changed.
6. For each pass, attempt `DELETE FROM public.<table> WHERE organisation_id = $org`
   on ordinary-deletable module tables.
7. `foreign_key_violation` is tolerated temporarily to allow parent/child ordering.
8. Any other SQL error aborts the reset with table context.
9. If passes exhaust with rows still deleted on the final pass, the reset fails.
10. After passes complete, remaining module rows (including module-stage history)
    for the organisation fail the reset.

This approach removes deep graphs such as:

```text
organisation
  -> maturity_model -> version -> pillar -> criterion -> assessment -> answer/evidence
  -> ci_project -> metric -> measurement / action / comment / attachment
  -> improvement_benefit -> forecast/realisation
  -> problem_solving_case -> stage/activity/items
```

because all participating tables currently expose `organisation_id`.

## Indirect tenant ownership

Schema audit (Sep 2026) found only these tenant-owned resources without direct
`organisation_id`:

| Resource | Ownership path | Reset handling |
| --- | --- | --- |
| `public.organisation_invitation_signup_bindings` | `invitation_id -> organisation_invitations.organisation_id` | Pre-delete via parent invitations |
| `storage.objects` in `organisation-evidence` | object path prefix `{organisation_id}/` | Explicit storage cleanup after DB purge |

If new indirect-only tables are introduced, they must be added to
`INDIRECT_TENANT_CHECKS` in `deletion-graph.ts` and handled in purge/verification logic.
Unknown indirect ownership is treated as a verification failure.

## Storage cleanup

Attachment/evidence metadata lives in `public.attachments` and is removed by the module purge.
Binary objects are stored in the shared `organisation-evidence` bucket using paths:

```text
{organisation_id}/{resource_type}/{attachment_id}/...
```

`scripts/qa-tenant/storage-cleanup.ts` deletes only objects whose `name` starts with the
CookieWorks organisation UUID prefix. It never truncates a shared bucket.

## Post-reset verification

`scripts/qa-tenant/verification.ts` performs exhaustive verification:

- Discovers all direct `organisation_id` module tables dynamically
- Counts remaining rows per table for CookieWorks
- Counts indirect resources from `INDIRECT_TENANT_CHECKS`
- Counts foundation tables for reporting
- Emits `FOUNDATION-ONLY VERIFIED` only when all module and indirect counts are zero

Inventory summaries (`npm run qa:cookie:inventory`) remain useful for human-readable module
categories; verification is the authoritative fail-closed gate.

## Fail-closed guarantees

The reset aborts on:

- Unexpected SQL errors (anything other than transient `foreign_key_violation` or documented immutability/append-only conflicts during ordering)
- Remaining deletable module rows after the final purge pass, including
  module-stage append-only history that controlled retirement should have cleared
- Residual indirect rows (signup bindings, storage objects)
- Failed post-reset verification
- Unclassified append-only tables discovered before mutation

Silent `WHEN OTHERS THEN NULL` handling is not used.

## Append-only history during CookieWorks reset (CW-RESET-001)

CookieWorks `qa:cookie:reset` is `module-foundation-only`. It must return the tenant
to foundation-only, including after integrated smoke has created published
programmes, reviews, actions, and projects.

Module-stage append-only tables are **not** retained. They are retired with the
same named-trigger disable/delete/enable sequence already used for
`full-tenant-removal`. Foundation-stage ledgers (`security_audit_events`,
`business_audit_events`) stay on the foundation allowlist.

The harness therefore:

- archives published template versions and reopens completed template submissions before purge
- retires approved module-stage history in a deterministic order before the generic DELETE loop
- excludes only template/resource registry infrastructure tables from remaining-row
  failure counts during CookieWorks module purge (`module-foundation-only`)
- discovers custom append-only triggers (`prevent_ai_usage_event_mutation`,
  `guard_benefit_overlap_allocation_history_mutation`) in addition to
  `prevent_update_or_delete`
- fails closed on unclassified append-only protections instead of skipping them
- does **not** add `ON DELETE CASCADE` to product tables, disable RLS, or weaken
  production append-only rules

Hosted destructive CookieWorks reset still requires explicit confirmation and
must not be used from implementation PRs. Full physical `organisations` row
deletion remains out of scope for module purge.

## Cross-stage FK dependencies (QA2e)

Some foundation-preserved rows reference parents that are not themselves foundation tables.
During `full-tenant-removal`, those parents must **not** be deleted in the module purge while
foundation-stage append-only audit ledgers still exist.

### Policy classes

| Class | Constant | Lifecycle |
| --- | --- | --- |
| Module-purge infrastructure | `MODULE_PURGE_INFRASTRUCTURE_TABLES` | Deleted explicitly during module purge (`templates`, `template_*`) |
| Foundation-stage dependency | `FOUNDATION_STAGE_DEPENDENCY_TABLES` | Deferred to foundation deletion after audit ledger retirement |

`FOUNDATION_STAGE_DEPENDENCY_TABLES` currently contains only `resource_records`.

### Why `resource_records` survives module purge

`public.business_audit_events` is foundation-stage append-only and may carry a non-null
`resource_record_id`. The schema enforces:

```text
business_audit_events (organisation_id, resource_record_id)
  -> resource_records (organisation_id, id) ON DELETE RESTRICT
```

Deleting `resource_records` during module purge therefore fails with
`business_audit_events_resource_fkey` whenever audit evidence references a resource record.
`security_audit_events` does not reference `resource_records`; the cross-stage edge is specific
to the business audit ledger.

### CookieWorks module purge order (`module-foundation-only`)

```text
MODULE PURGE
  append-only unknown guard
  private notification infrastructure
  maturity explicit unlock deletes
  controlled module append-only retirement
  generic module DELETE loop
  retain templates, security_audit_events, business_audit_events, resource_records
```

### Full tenant removal order

```text
MODULE PURGE
  append-only unknown guard
  cross-stage FK guard
  private notification infrastructure
  controlled module append-only retirement
  maturity explicit unlock deletes
  generic module DELETE loop
  template infrastructure deletes
  retain: security_audit_events, business_audit_events, resource_records

FOUNDATION DELETION
  foundation append-only controlled delete (security + business audit ledgers)
  foundation-stage dependency delete (resource_records)
  memberships + remaining foundation graph
  organisation row
```

`scripts/qa-tenant/cross-stage-fk-safety.ts` derives the live FK catalog from
`information_schema` and fails closed when a foundation-preserved child has a RESTRICT / NO ACTION
edge to a module-deleted parent that is not explicitly deferred.
