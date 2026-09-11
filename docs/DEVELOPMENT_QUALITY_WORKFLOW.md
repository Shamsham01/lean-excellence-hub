# LEH development quality workflow

This document defines how Lean Excellence Hub turns QA findings, product ideas, defects, and architecture changes into implementation work without maintaining competing todo lists.

## Source of truth

- **GitHub Issues = active work.** Active, prioritised, or expected implementation work lives in Issues.
- **`docs/PRODUCT_REVIEW_BACKLOG.md` = deferred ideas only.** Items promoted to active work move to an Issue rather than remaining duplicated in both places.
- **Pull requests = implementation evidence.** PRs reference Issues; they are not a second backlog.
- **Manual smoke findings = master QA issue first.** Promote a finding to a dedicated Issue only when it is ready for implementation or needs independent acceptance criteria.

## Priority model

- **P0 — security / data integrity / release stop:** cross-tenant or cross-site leak, privilege escalation, destructive corruption, unrecoverable data loss, outage.
- **P1 — core workflow / architecture blocker:** a primary journey cannot be completed safely or correctly; admin architecture causes ambiguous or unsafe selection; a module creates unusable records.
- **P2 — significant UX / performance / workflow friction:** the journey works but is confusing, slow, poorly responsive, or unnecessarily manual.
- **P3 — polish / future enhancement:** cosmetic improvements, low-frequency convenience, or deliberately deferred capability.

Security and data-integrity concerns outrank convenience work regardless of visual severity.

## Finding lifecycle

Use these states in the master QA issue:

- **OPEN** — reproduced and unscheduled.
- **PROMOTED → #issue** — dedicated implementation issue created; detailed work lives there.
- **IN PR → #pr** — implementation under review.
- **RESOLVED / NEEDS RETEST** — merged but manual acceptance still required.
- **VERIFIED** — manual acceptance passed.
- **DEFERRED** — intentionally moved to the product review backlog.
- **EXPECTED** — observed behaviour is intentional and needs no fix.

Do not delete resolved findings; retain them as QA history.

## Implementation sequence

1. Reproduce and classify before coding.
2. Promote only the next coherent problem family to a dedicated Issue.
3. For cross-cutting architecture, inventory existing helpers, RLS/RPC boundaries, and reuse opportunities before changing schema or permissions.
4. Define acceptance criteria, including hostile/security cases where tenant, site, scope, or authority is involved.
5. Cursor implements on a branch / PR. Cursor must not mutate hosted Supabase.
6. Run Fast CI + Database CI where applicable; run Full Regression before merge for platform changes.
7. Assistant reviews the diff, architecture, tests, RBAC impact, and scope creep. CI green alone is not enough.
8. User explicitly approves merge.
9. Hosted rollout is separate; hosted Supabase mutation requires explicit approval and migration-first deployment.
10. Retest the exact reproduction and mark VERIFIED.
11. Resume smoke testing from the point it stopped; do not restart unaffected modules.

## Architecture rules for fixes

- Preserve tenant-first, permission-first, scope-qualified authorization and fail-closed RLS.
- UI filters never replace server-side security boundaries.
- Do not broaden authority to make tests pass.
- Prefer shared primitives and shared selectors over module-specific copies.
- For organisation admins, use an explicit active-site context and filter site-scoped selectors to that site; do not permanently render verbose hierarchy paths everywhere just to disambiguate duplicate unit names.
- Preserve stable UUIDs and audit/history semantics.
- Prefer forward-only migrations.
- Keep production UI free of internal UUIDs, raw membership IDs, resource IDs, or implementation codes unless the user explicitly needs them.

## PR scope discipline

A PR should normally solve one coherent problem family, for example:

- active-site admin context and shared site-aware selectors;
- Maturity authoring and assessment workflow defects;
- 5S/Gemba template persistence and publish validation;
- Actions execution lifecycle;
- Projects draft lifecycle;
- Benefits architecture and savings workflow.

Do not combine all smoke findings into one PR.

## Smoke-test discipline

- Continue past P2/P3 findings and record them.
- Pause immediately for P0.
- Pause for P1 only when it blocks the next meaningful journey or exposes architecture that would invalidate broad downstream testing.
- Preserve useful QA data unless corrupted.
- Use the CookieWorks two-site tenant to prove multi-site behaviour rather than infer it.

The goal is not to make every screen perfect before continuing. The goal is to find foundational defects early, fix them in priority order, and avoid repeated testing caused by architecture changes.