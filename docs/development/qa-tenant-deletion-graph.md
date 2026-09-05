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

1. Pre-delete private operational envelopes/outbox rows for the organisation.
2. Pre-delete known indirect children (see below).
3. For each pass, attempt `DELETE FROM public.<table> WHERE organisation_id = $org`.
4. `foreign_key_violation` is tolerated temporarily to allow parent/child ordering.
5. Any other SQL error aborts the reset with table context.
6. If passes exhaust with rows still deleted on the final pass, the reset fails.
7. After passes complete, remaining module rows for the organisation fail the reset.

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
- Remaining deletable module rows after the final purge pass
- Residual indirect rows (signup bindings, storage objects)
- Failed post-reset verification

Silent `WHEN OTHERS THEN NULL` handling is not used.

## Known limitations (no migration in QA1a)

LEH retains append-only workflow history (for example `maturity_assessment_transitions`,
`suggestion_status_history`, `action_status_transitions`) and immutable published template
subgraphs. Records that create these histories cannot be deleted with the current Supabase CLI
connection role. The harness therefore:

- archives published template versions and reopens completed template submissions before purge
- tolerates documented immutability/append-only SQLSTATE `55000` conflicts during ordering passes
- excludes append-only DELETE-protected tables and template/resource registry infrastructure tables
  from verification failure counts during CookieWorks module purge (`module-foundation-only`)
- performs controlled append-only retirement deletes during legacy full tenant removal
  (`full-tenant-removal`), including `ai_usage_events`
- discovers custom append-only triggers (`prevent_ai_usage_event_mutation`,
  `guard_benefit_overlap_allocation_history_mutation`) in addition to
  `prevent_update_or_delete`
- proves purge correctness with draft-level module fixtures that do not enter irreversible workflow
  states

A future maintainer-only `SECURITY DEFINER` purge RPC (migration) would be required for destructive
cleanup of workflow-completed module data. Until then, hosted destructive reset must not be used
for tenants that have entered those irreversible states.
