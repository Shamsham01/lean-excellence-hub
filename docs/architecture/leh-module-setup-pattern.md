# LEH Module Setup Pattern

Status: **Implemented for 5S and Gemba** (`LEANAI-MODULE-SETUP-01A` / #271)

Parent: **#267** remains open. Training, Skills, and other configurable modules
are later slices.

Date: **2026-10-07**

## Product intent

LEH is an engine, not a prescribed Lean methodology.

> Your framework. Your standards. Your way of working.

Configurable modules can offer the same three ways to start that Maturity
already uses. This slice proves that pattern for **5S** and **Gemba** only.
It does not claim that every LEH module can be built with LeanAI.

| Path | Meaning | Output |
| --- | --- | --- |
| Manual | The organisation builds its own standard from an empty draft | Draft |
| LEH Quick Start | An optional, editable starting point shipped with the product | Draft |
| Build with LeanAI | LeanAI translates the organisation's own description into a proposal | Draft |

Human review is mandatory. Nothing in these paths publishes, schedules, assigns
owners, grants permissions, or chooses organisational applicability.

The person sees: **Setup mode → Draft → Review → Publish**.

## Where it lives

Dedicated routes, not a setup wall on the operational dashboard:

- `/platform/5s/setup`
- `/platform/5s/setup/quick-start`
- `/platform/5s/setup/leanai`
- `/platform/gemba/setup`
- `/platform/gemba/setup/quick-start`
- `/platform/gemba/setup/leanai`

An empty module offers **Set up 5S** or **Set up Gemba**. A module that already
has configuration keeps its operational overview and offers **New standard** or
**New definition**, which opens the same chooser.

Manual continues into the existing authoring forms:

- `/platform/5s/standards#create-standard`
- `/platform/gemba/definitions#create-definition`

## Shared primitives

Presentation and orchestration live under `src/modules/module-setup` and
`src/components/module-setup`. Domain rules stay in the 5S and Gemba modules.

- `ModuleSetupMode`: `manual` | `quick_start` | `leanai`
- `ModuleSetupChooser`
- `QuickStartPreview`
- `DeployQuickStartForm`
- `SetupBuilderWorkspace`
- readiness helper and exact-name warning

Each module supplies its manage permission, routes, template catalogue, and
proposal schema. Shared code does not invent a second AI entitlement system
and does not write configuration by itself.

## Quick Start

Templates are source-controlled. They are not hosted mutable content.

| Module | Key | Name |
| --- | --- | --- |
| 5S | `leh-workplace-5s-standard` | LEH Workplace 5S Standard |
| Gemba | `leh-operational-gemba-walk` | LEH Operational Gemba Walk |

Deployment copies the catalogue into an organisation-owned **draft** through a
narrow database function. The browser does not insert sections one request at
a time. The person must select the applicable organisational units. The
template does not guess them. A 5S deployment also asks for a starting
threshold, which remains editable.

## Atomic draft creation

Migration:

`supabase/migrations/20261008072255_create_module_setup_drafts_from_definition.sql`

The earlier filename `20261007224043_create_module_setup_drafts_from_definition.sql` was reconciled in #273 so the source version matches the hosted ledger. Do not recreate `20261007224043`.

Public functions are `SECURITY INVOKER` with `search_path = ''` and no `anon`
execute grant:

- `public.create_five_s_standard_draft_from_definition`
- `public.create_gemba_definition_draft_from_definition`

Each calls a `SECURITY DEFINER` implementation owned by
`lean_hub_private_owner`. That implementation:

- derives the organisation and membership from the authenticated context
- requires `five_s.standards.manage` or `gemba.definitions.manage`
- validates the definition shape, including size limits
- verifies every unit belongs to the current organisation
- creates the header, version, sections, and questions in one function
- leaves the version as `draft`
- rolls back the statement if any step fails

There is no generic “insert template JSON” API.

## LeanAI

The builders reuse the Coach session model already used by Maturity:

- `ai_sessions` with context type Coach
- module keys `five_s` and `gemba`
- intervention key `setup_builder`
- `ai_runs`, `ai_messages`, usage accounting, model routing, token ceilings,
  and rate limits
- `store: false` in the provider
- membership-bound sessions
- explicit idempotency on each user turn

Opening a setup page or the builder does not create a session and does not
call a model. A model run starts only when the person sends a message, asks
for a proposal, refines, or retries.

The model reply is validated with Zod, stored on the member's conversation,
and shown as a proposal. **Create draft** sends only the proposal message id.
The server re-reads the trusted latest proposal, validates it again, and then
calls the same draft function used by Quick Start. Browser JSON is not
authoritative.

Applicability and, for 5S, the confirmed threshold are human form fields at
acceptance time. They are not model decisions.

If draft creation fails, the conversation remains so the person can retry
without another model turn.

A close exact name match warns the person. It does not block creation, and it
does not use fuzzy model similarity.

When LeanAI is off, the plan does not include it, the person lacks `ai.use`,
or a usage ceiling is reached, Manual and Quick Start stay available.

## Human authority

LeanAI may ask, explain, propose, and refine.

LeanAI may not publish, create schedules, assign owners, grant permissions,
create sites, change billing, perform audits or walks, overwrite a live
standard, or choose where a draft applies.

## What this slice does not do

Training and Skills still use their existing authoring. Maturity keeps its own
three-mode implementation. Later work can adopt these primitives without
turning this layer into a generic CMS.
