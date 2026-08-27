# Problem Solving Engine (Milestone 11)

## Purpose

Milestone 11 delivers a reusable **structured human problem-solving engine** — not an electronic A3 form. Cases progress from problem definition through current condition, containment, cause hypotheses, structured analysis, tests, verified causes, countermeasures, universal actions, effectiveness verification, sustainment, sessions, and governed closure.

The data model is designed so a future permission-aware AI facilitator (Milestone 12+) can read case semantics safely. **AI must never become the authoritative verifier of root cause or closure.**

## Architectural placement

| Concern | Mechanism |
| --- | --- |
| Identity | `resource_records` type `problem_solving_case` |
| Tenancy | `organisation_id` on every table; composite FKs |
| Authorisation | Eight scoped permissions + case team visibility (not RBAC escalation) |
| Mutations | `private.*` RPCs with thin `public.*` wrappers |
| Reads | Curated JSON query RPCs (`get_problem_solving_*`) |
| Evidence | Shared `attachments` via `problem_solving_evidence_links` |
| Tasks | Universal `actions` via `problem_solving_action_context` |
| Audit / events | `business_audit_events` + `domain_event_outbox` on lifecycle transitions |
| Methods | Versioned `problem_solving_methods` / `_method_versions` / `_method_stages` |

See [milestone-scope-and-acceptance.md](./milestone-scope-and-acceptance.md) for acceptance evidence.

## Domain invariants

### Semantic separation (never collapse)

The engine **must** distinguish:

| Concept | Meaning |
| --- | --- |
| Fact / observation | Recorded or measured current-condition item with category |
| Assumption | Explicit uncertain belief; cannot be reclassified to fact without supersession |
| Cause hypothesis | Testable proposed cause (`proposed` → `testing` → `supported` / `rejected`) |
| Supported hypothesis | Evidence or tests support further investigation; **not** verified cause |
| Verified cause | Hypothesis passed controlled `verify_cause_hypothesis` with rationale and basis |
| Rejected cause | Remains historically visible |
| Countermeasure | First-class corrective action linked to cause hypotheses |
| Containment | Temporary risk control; not a permanent countermeasure |

**Never** represent root cause as an unchecked boolean. **Never** auto-verify a hypothesis from a single supporting test. **Never** force closure with a fabricated verified cause.

### Method versioning

- Built-in methods are provisioned per organisation (`a3_structured`, `rapid_rca`, `five_why`).
- **Published method versions are immutable.** Stages cannot change after publish.
- When a case activates, `method_version_id` and `current_method_stage_id` are **pinned**.
- Later method changes do not rewrite historical cases.

### Case lifecycle

| Status | Meaning |
| --- | --- |
| `draft` | Incomplete; method not pinned |
| `active` | Method pinned; investigation in progress |
| `closed` | Governed closure with `closure_outcome` |
| `cancelled` | Distinct from resolved closure; requires rationale |

Methodology **stage** (`current_method_stage_id`) is separate from case **status**.

### Current condition

- Items are categorised: `observation`, `measured_fact`, `recorded_fact`, `assumption`, `constraint_context`.
- Verified facts record `verified_by_membership_id`, `verified_at`, and rationale.
- Assumptions cannot silently become facts; supersession creates a new item.

### Hypotheses and verification

- Status flow: `proposed` → `testing` / `supported` → `verified` or `rejected` (or `superseded`).
- `verify_cause_hypothesis` requires `problem_solving.verify_cause` permission, non-empty rationale, and verification basis (completed test with `supports` conclusion and/or linked evidence per `hypothesis_has_verification_basis`).
- `complete_hypothesis_test` does **not** auto-verify.

### Analysis artifacts

- Types: `five_whys`, `fishbone`, `cause_tree`, `brainstorm`.
- `problem_solving_analysis_nodes` form a tree; hypotheses remain authoritative statements.
- Fishbone uses category nodes (e.g. People, Machine, Method, Material, Measurement, Environment).
- Cycle prevention enforced on node parent links.

### Containment and actions

- Containment is **first-class** (`problem_solving_containments`), not only an action title.
- Universal actions link through `problem_solving_action_context` with roles: `containment`, `countermeasure`, `sustainment`.
- Action lifecycle is owned by the universal Actions domain.

### Countermeasures

- Statuses include `proposed`, `selected`, `rejected`, `implementing`, `implemented`, `effective`, `ineffective`, `superseded`.
- Many-to-many links to hypotheses via `problem_solving_countermeasure_cause_links`.
- Selection/rejection records provenance.

### Effectiveness and sustainment

- Effectiveness checks are explicit (`pass` / `fail` / `inconclusive`); numeric fields use PostgreSQL `NUMERIC`.
- Completing an action does **not** close a case.
- Sustainment items capture standardisation follow-through; may link training sessions or schedules by resource id.
- Lessons learned are structured and queryable (no vector search in M11).

### Closure governance

| Outcome | Requirements |
| --- | --- |
| `resolved_verified_cause` | ≥1 verified hypothesis; selected countermeasure when applicable; passing effectiveness checks |
| `resolved_without_verified_cause` | Explicit `closure_rationale`; effectiveness when countermeasures exist |
| `transferred` | Destination reference where applicable |
| `cancelled` | Separate RPC; not a resolution outcome |

`close_problem_solving_case` requires `problem_solving.close` (delegated to manage permission path).

### Source links (no leak)

- `problem_solving_source_links` reference `resource_records` generically.
- Linking a case to a project/suggestion **does not grant** source access.
- Query summaries (`build_problem_solving_source_links_summary`) return context only when the caller can independently read the source.

### Team vs RBAC

- Participant roles (`problem_owner`, `facilitator`, `contributor`, `subject_matter_expert`) are case-scoped.
- Adding a participant **does not** grant organisation-wide permissions.
- Self-scoped read/contribute may include owner, facilitator, and active participants per `can_read_problem_solving_case` / `can_contribute_problem_solving_case`.

### Sessions

- Human-led `problem_solving_sessions` with structured entries (`note`, `question`, `decision`, `observation`, `idea`, references).
- Completed session records are append-only / immutable per triggers.
- No AI actor in M11.

### Security

- Every tenant table: `FORCE RLS`, default deny, SELECT-only authenticated policies where exposed.
- Cross-tenant read/write, fabricated foreign keys, and permission bypass are rejected in pgTAP.
- Closed/cancelled cases block mutating child records per RPC guards.

## Permissions (exactly eight)

| Key | Purpose |
| --- | --- |
| `problem_solving.view` | Read cases in scope |
| `problem_solving.create` | Create drafts |
| `problem_solving.contribute` | Add observations, evidence, hypotheses, session participation |
| `problem_solving.manage` | Lifecycle, containment, countermeasures, effectiveness |
| `problem_solving.facilitate` | Facilitation duties |
| `problem_solving.verify_cause` | Authoritative cause verification |
| `problem_solving.close` | Governed closure |
| `problem_solving.methods.manage` | Method catalogue administration |

Owner role receives all eight via migration upgrade pattern.

## M12 AI seam (read-only in M11)

A future facilitator may read:

- Problem statement, current condition categories, and evidence links
- Hypothesis status history and test conclusions
- Verified causes and countermeasure–cause links
- Effectiveness results and session decisions

It must **not** be able to call `verify_cause_hypothesis` or `close_problem_solving_case` without explicit human permission grants — and product policy forbids delegating those decisions to AI.

## Local demo story

`db:seed-demo` creates **Packaging Line 3 Recurring Seal Defects** — a closed case with `resolved_verified_cause`, seeded entirely through authoritative RPCs. Manager (`plant-manager` role) holds problem-solving permissions; operator holds none.

## Related documents

- [data-model.md](./data-model.md) — entity catalogue
- [PRODUCT_REVIEW_BACKLOG.md](../PRODUCT_REVIEW_BACKLOG.md) — deferred UX
- [ADR-0003](../adr/ADR-0003-universal-resource-and-shared-capabilities.md) — shared capabilities
