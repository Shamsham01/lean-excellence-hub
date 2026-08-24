# Data model

## Status

This is a conceptual data model reserved during Milestone 1. It contains no implemented schema. Migrations, generated types, constraints, indexes, policies, and tenant tables are deferred to Milestone 3 or later as stated below.

## Identity, tenancy, hierarchy, and access

Planned Milestone 3 foundations:

- `profiles`: minimal global identity data keyed to `auth.users`; no tenant roles.
- `organisations`: tenant root, reporting currency, locale/time zone, lifecycle state.
- `organisation_memberships`: user-to-organisation membership, invitation/status, tenant-specific person attributes, and timestamps. A person may have multiple memberships.
- `organisation_units`: adjacency-list hierarchy supporting company, site, department, area, team, and customer-defined presentation without fixed depth.
- `organisation_unit_closure`: transactional ancestor/descendant/depth rows for subtree access and reporting.
- `permission_definitions`: stable platform keys such as `benefits.validate` and `benefits.view_financial`.
- `roles`, `role_permissions`, and `access_grants`: organisation-owned roles granted to memberships at `self`, `unit_subtree`, or `organisation` scope.

Every exposed tenant-owned row carries `organisation_id` and a composite uniqueness target such as `(organisation_id, id)`. Composite foreign keys prevent cross-tenant references. Tenant-leading indexes support RLS predicates and common lifecycle, status, and unit queries.

## Shared resource identity

A later `resource_records` registry contains only stable identity, `organisation_id`, resource type, and creation metadata. Typed domain records reference that identity while retaining relational columns and domain constraints. Tenant-safe composite references let shared capabilities point to resources without free-form `entity_type/entity_id` pairs.

Planned shared capabilities include:

- `actions` plus tenant-safe contextual links;
- private attachment metadata and resource links;
- workflow transition history;
- append-only audit entries;
- an idempotent transactional event outbox;
- comments, activity, schedules, and Benefits links where approved.

The registry is not an entity-attribute-value model and does not hold arbitrary domain fields.

## Universal versioned forms

- `templates` provide stable identity and experience/type classification.
- `template_versions` are immutable after publication and carry Draft, Published, or Archived lifecycle metadata.
- Version-owned sections and questions define the exact form content and ordering.
- Submissions reference the exact template version used.
- Answers reference the exact versioned question answered.
- Publishing and successor-version creation are transactional; published rows are never edited in place.

Gemba, 5S, Leader Standard Work, maturity, and similar forms share this engine. Curriculum and structured problem-solving use typed domain extensions where their semantics genuinely differ.

## Workflow, audit, events, and history

Domains define stable states and transition rules in application services. Shared transition history records the actor, tenant, resource, from/to states, reason, and time. Audit is tamper-resistant evidence, outbox events enable reactions, and activity is user-facing; they remain separate.

Historical labels or context are snapshotted only where reports must preserve wording. Immutable published versions, Benefit revisions, validations, realisations, transition history, and audit provide historical truth without universal temporal tables.

## Benefits

Reserved for later implementation:

- `benefit_types`: organisation-configurable definitions seeded from defaults.
- `benefits`: authoritative identity, one originating resource, owner, type, lifecycle, and non-sensitive description.
- `benefit_links`: contextual navigation only; never additional reportable value.
- `benefit_revisions`: immutable forecast/calculation inputs and assumptions.
- `benefit_financial_details`: sensitive values and currency behind independent financial permission.
- `benefit_validations`: decisions against an exact revision with default creator/owner separation of duties.
- `benefit_realisations`: dated delivered value distinct from forecast and validation.

Reporting calculates forecast, validated, and realised totals from their respective authoritative records. Original currency and organisation reporting-currency context are retained; conversion and calculators are deferred.

## Lifecycle and retention

No universal soft-delete convention is approved. Each aggregate must choose and document inactive, disabled, archived, closed, anonymised, or hard-delete behaviour based on history, legal obligations, and restoration needs. Disabling a tenant membership removes that tenant's access without necessarily deleting global Auth identity or historical actor references.

## Deferred validation

Milestone 3+ must prove migration reset, generated types, composite integrity, tenant-leading index use, published-version immutability, append-only history, event idempotency, optimistic concurrency, financial separation, and cross-tenant denial. No empty speculative tables are created before those milestones.
