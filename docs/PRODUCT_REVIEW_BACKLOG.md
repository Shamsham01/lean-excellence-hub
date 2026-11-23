# Product review backlog

This file contains **deliberately deferred, non-blocking product ideas and polish only**.

Active defects, blockers, architecture changes, and prioritised implementation work belong in **GitHub Issues**. The current CookieWorks manual-smoke source of truth is **Issue #67**. When an item is promoted to active work, remove it from this backlog rather than maintaining two competing todo lists.

See `docs/DEVELOPMENT_QUALITY_WORKFLOW.md` for the finding → issue → PR → retest workflow.

## Milestone 11 — Problem Solving (deferred polish)

- Advanced Fishbone / Ishikawa drag-and-drop canvas and diagram export
- Rich causal-tree visualisation beyond structured node lists
- Method editor UX for custom problem-solving methodologies and stage design beyond current active defects
- Session facilitation UX (timers, agendas, live facilitation modes)
- Problem-solving portfolio executive indicators beyond operational filters
- Deeper evidence viewer polish (inline previews, measurement capture helpers)
- Cross-case lessons-learned search and reuse workflows (non-vector)

## Organisation and platform readiness (deferred)

- Richer organisation setup wizard (industry templates, default units, starter roles)
- Organisation branding (logo, colours, email templates)
- Profile and organisation avatar/image upload polish
- User administration enhancements beyond active smoke defects (lifecycle dashboards and membership hygiene)
- Role administration enhancements (permission diff views, grant audit, delegation guidance)
- Field formatting and locale display consistency (dates, numbers, currency, units)
- Dedicated in-product documentation portal (help centre, contextual guides, release notes)

## Cross-cutting UX (deferred)

- Shared evidence upload and attachment gallery UX beyond module-specific active smoke defects
- Comment threading and @mention polish
- Notification and activity surfacing beyond active traceability defects
- Export / print layouts for A3-style case summaries

## AI and analytics (explicitly later)

- Semantic / vector search over lessons learned
- Executive dashboard and enterprise BI connectors

## Implemented / promoted history

- **Done — Problem Solving facilitator.** LeanAI proposes stage drafts for human review. The case lifecycle gates drafting, and practitioners verify causes. [#352](https://github.com/Shamsham01/lean-excellence-hub/pull/352), [#402](https://github.com/Shamsham01/lean-excellence-hub/pull/402), [#407](https://github.com/Shamsham01/lean-excellence-hub/pull/407), [#418](https://github.com/Shamsham01/lean-excellence-hub/pull/418)
- **Done — bulk colleague invitations and profile avatars.** CSV import uses the invitation pipeline, and profile avatars are available. Organisation branding remains deferred. [#357](https://github.com/Shamsham01/lean-excellence-hub/pull/357), [#367](https://github.com/Shamsham01/lean-excellence-hub/pull/367), [#376](https://github.com/Shamsham01/lean-excellence-hub/pull/376)
- **Done — notification entry point and record navigation.** A single bell opens authorised records. Further activity surfacing remains deferred. [#383](https://github.com/Shamsham01/lean-excellence-hub/pull/383)
- **Delivered within the fishbone scope.** Manual cause editing and promotion to hypotheses shipped. Drag-and-drop and diagram export remain deferred. [#403](https://github.com/Shamsham01/lean-excellence-hub/pull/403)

- RBAC2, site isolation, and Organisation Structure V2 were promoted from the old backlog into pre-smoke **Issue #57**, implemented, and the issue is now closed as completed.
- Active CookieWorks manual-smoke findings are tracked in **Issue #67** and must not be duplicated here.