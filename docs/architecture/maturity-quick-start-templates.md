# Maturity Quick Start templates

Status: **Implemented for Maturity** (`MAT-TEMPLATE-01` / #209)

Date: **2026-10-04**

## Product intent

A new organisation should not need to author maturity levels, pillars, criteria
and dozens of questions before it can experience the Maturity module.

LEH provides **optional, product-owned Quick Start templates**. The first
reference implementation is:

- Key: `leh-operational-excellence-standard`
- Name: **LEH Operational Excellence Standard**
- Default assessment scope: Site
- 5 levels, 5 pillars, 30 criteria, 60 scored questions

This is a **recommended starting point**, not a mandatory Lean methodology.
Customers remain owners of the copy they deploy.

## Built-in template versus customer copy

| | Built-in LEH template | Customer framework |
| --- | --- | --- |
| Ownership | Product / source-controlled | Organisation tenant |
| Storage | Application catalogue under `src/modules/maturity/templates/` | `maturity_models` and related tables |
| Mutability | Immutable product content | Fully editable draft, then normal publish lifecycle |
| Seeded into tenants? | No | Only after an authorised administrator chooses **Use this template** |
| Later catalogue edits | Do not change existing copies | Independent from future built-in updates |

The browser sends only a recognised template key. The server action
`instantiateMaturityQuickStartTemplate` resolves the canonical catalogue
definition and then calls a permission-checked bulk RPC. A giant framework
payload from the browser is not trusted as product content.

The RPC itself does **not** verify LEH provenance. Any supplied template key is
caller-declared metadata. Admins with `maturity.models.manage` can also call the
RPC with a custom definition; that must not be audited as an official Quick
Start deploy.

## Deployment contract

1. Authorised administrator (`maturity.models.manage`) chooses **Use this template**.
2. Server action `instantiateMaturityQuickStartTemplate` resolves the catalogue
   entry and calls `public.create_maturity_model_draft_from_definition`.
3. One database transaction creates the complete organisation-owned **draft**.
4. The user is redirected to `/platform/maturity/models/[modelId]?step=review`.
5. A human must explicitly **Publish**. Instantiation never publishes.

The bulk RPC audit event is `maturity.model.draft_created_from_definition` with
`declared_template_key`. It must not claim verified official-template
provenance.

If instantiation fails, the transaction rolls back. No partial framework remains
visible. Retry is safe. Accidental double-click is prevented in the UI by
disabling the initiating control while the request is pending. Intentional reuse
of the same built-in template is allowed.

## Architecture

Canonical TypeScript contract:

- `src/modules/maturity/templates/types.ts`
- `src/modules/maturity/templates/catalogue.ts`
- `src/modules/maturity/templates/leh-operational-excellence-standard.ts`
- `src/modules/maturity/templates/validation.ts`
- `src/modules/maturity/templates/payload.ts`

Positions are derived from array order. Template authors do not supply raw
position numbers.

Forward migrations (applied to hosted Supabase on 2026-10-04):

- `supabase/migrations/20261004110720_instantiate_maturity_quick_start_template.sql`
  introduced the original bulk RPC.
- `supabase/migrations/20261004110729_create_maturity_model_draft_from_definition.sql`
  replaces it with `create_maturity_model_draft_from_definition`, a neutral audit
  event, and null-safe JSON validation.

The filenames match the canonical hosted migration versions. Do not replay
these migrations. Future schema changes require new forward migrations.

This Maturity path is the reference implementation for later Quick Start
templates in 5S, Gemba, Suggestions, Training and Skills, and for the broader
three-mode setup shell (#207). Those modules are out of scope here.

## LeanAI

Persistent LeanAI understands the Maturity frameworks list and the template
preview. Starter prompts explain whether Quick Start is appropriate and which
parts to tailor. LeanAI must **not** deploy or publish the template, and must
not call a model merely because the page loaded.

When no framework exists, deterministic setup guidance may mention starting
manually or deploying the LEH Operational Excellence Standard as a draft.
