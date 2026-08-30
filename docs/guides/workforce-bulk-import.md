# Workforce bulk import (M2)

## Overview

M2 adds CSV/XLSX bulk workforce provisioning on top of the M1 sealed-intent
architecture. Administrators upload a file, validate the complete dataset,
review resolved mappings, provision securely from the browser, and download a
one-time credential export. Imports are resumable from `/platform/settings/people/import/{jobId}`.

Entry point: `/platform/settings/people/import`

Permission: `workforce.import` (Organisation Owner and Organisation
Administrator only).

## Supported files

- `.csv`
- `.xlsx`
- Maximum 1,000 rows per import

## Canonical columns

| Column | Required | Notes |
| --- | --- | --- |
| `first_name` | Yes | |
| `last_name` | Yes | |
| `username` | Yes | Normalised to lowercase; must be unique in file and organisation |
| `notification_email` | No | Operational contact only; never used for Auth login |
| `job_title` | No | Free text |
| `job_function` | Yes | Resolved against active job functions by name |
| `primary_unit_path` | Yes | `Site > Department > Area` using `>` separators |
| `application_role` | Yes | Published role display name, e.g. `Team Member` |
| `access_scope_unit_path` | Conditional | Required for unit-scoped roles (`Team Member`, `Manager`); leave blank for organisation-wide roles (`Finance Validator`, `Organisation Administrator`) |

### Access scope by role type

Bulk import derives `scope_type` from each role's authoritative grant-scope policy:

| Role scope policy | `access_scope_unit_path` | Resolved scope |
| --- | --- | --- |
| `unit_subtree` only | Required — full path, e.g. `Cornwall Plant > Operations` | `unit_subtree` at resolved unit |
| `organisation` only | Must be blank | `organisation` with no scope unit |
| Both (custom roles) | Blank → organisation; path → `unit_subtree` | Derived from supplied value |

Examples:

- `Team Member` at `Cornwall Plant > Operations` — provide the same path in `access_scope_unit_path`
- `Finance Validator` — leave `access_scope_unit_path` blank (organisation-wide role)

Validation errors when scope and role policy disagree:

- Organisation-wide role with a path: *"{Role} is an organisation-wide role. Leave access_scope_unit_path blank."*
- Unit-scoped role without a path: *"{Role} requires an access scope. Provide the full organisational path."*

## Validation rules

Validation runs on the **entire file** before any Auth users are created.

- File: headers, duplicates, unsupported columns, empty file, row limit
- Person: required fields, username format/uniqueness, email format
- Organisation: unique resolution for job function, units, role, scope
- Ambiguity: partial paths that match multiple units are rejected with actionable guidance
- Delegation: actor must be authorised to assign each role/scope pair

Provisioning is blocked until `error_rows = 0`.

## Provisioning architecture

1. `start_workforce_import_provisioning`
2. Browser repeatedly calls the Next.js `runImportBatch` server action
3. Each cycle claims one row via `claim_workforce_import_batch`, provisions it
   through the existing `workforce-provision` edge function, then finalises the
   row through `workforce-import-finalize`
4. Temporary passwords are encrypted with AES-GCM and stored in
   `workforce_import_row_credentials`
5. Job progress is tracked in `workforce_import_jobs` / `workforce_import_rows`

Batch size **1** keeps each Next.js server-action request within Netlify/serverless
wall-clock limits while each row still performs Auth user creation plus edge
finalisation. Database job state is authoritative, so administrators can refresh,
sign out, or close the browser and resume later from Recent workforce imports.

## Resumability

- Job detail route: `/platform/settings/people/import/{jobId}`
- Recent imports expose context-appropriate actions such as Resume validation,
  Continue review, Resume provisioning, and Download credentials
- Wizard state is reconstructed from persisted job progress on page load
- Completed rows are not reprovisioned; `claim_workforce_import_batch` only
  claims `valid`, `warning`, `provisioning`, and retryable `failed` rows

## Credential security lifecycle

- Encryption key: `CREDENTIAL_ENCRYPTION_KEY` (32-byte value, Edge Function secret only)
- Storage: ciphertext + 12-byte nonce in `workforce_import_row_credentials`
- Plaintext never stored in Postgres, logs, audit events, or domain payloads
- TTL: 24 hours from job completion
- Export: `workforce-import-export` Edge Function decrypts, returns CSV, then
  `mark_workforce_import_credentials_exported` deletes encrypted material
- Re-export is not possible after successful export
- Lost/expired credentials cannot be recovered; regenerate via credential reset (M1 permission)

## Retry and remediation

- Validation failures: fix file and re-upload
- Runtime failures: `failed` rows can be retried; `completed` rows are immutable
- `auth_created` rows follow the M1 crash-recovery path
- Unsafe orphan Auth users become `needs_platform_remediation` (no aggressive deletion)

## Deployment requirements

### Migrations (forward only)

1. `20260831010000_workforce_import_permissions.sql`
2. `20260831010001_workforce_import_schema.sql`
3. `20260831010002_workforce_import_rpcs.sql`
4. `20260831120000_workforce_import_organisation_scope_hotfix.sql`

### Edge Functions to deploy

- `workforce-import-export`
- `workforce-import-finalize`
- `workforce-provision` (unchanged contract; reused per row)

### Secrets (Edge Functions only)

| Secret | Requirement |
| --- | --- |
| `CREDENTIAL_ENCRYPTION_KEY` | 32-byte key as 64-char hex or base64-encoded 32 bytes |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing |
| `SUPABASE_URL` | Existing |
| `SUPABASE_ANON_KEY` | Existing |

Generate example (hex):

```bash
openssl rand -hex 32
```

Set locally:

```bash
supabase secrets set CREDENTIAL_ENCRYPTION_KEY=<64-char-hex>
```

**Never** add `CREDENTIAL_ENCRYPTION_KEY` to Next.js environment variables.

## Hosted rollout sequence

1. Apply the four forward migrations to hosted Postgres (including the organisation-scope hotfix)
2. Set `CREDENTIAL_ENCRYPTION_KEY` in hosted Edge Function secrets
3. Deploy `workforce-provision`, `workforce-import-finalize`, `workforce-import-export`
4. Verify Owner/Admin `workforce.import` permission on a staging organisation
5. Run a small staged import, export credentials once, confirm invalidation
6. Monitor `security_audit_events` for `workforce.import_job_created` and
   `workforce.import_credentials_exported`

## Deferred (explicit)

- Employee notification email workflow (N1)
- Entra / SCIM
- AI workforce mapping
- Navigation / maturity redesign
