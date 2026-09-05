# Product review backlog

Non-blocking product and UX improvements deferred from milestone delivery. Items here are intentionally out of current milestone scope unless promoted with explicit approval.

## Milestone 11 — Problem Solving (deferred polish)

- Advanced Fishbone / Ishikawa drag-and-drop canvas and diagram export
- Rich causal-tree visualisation beyond structured node lists
- Method editor UX for custom problem-solving methodologies and stage design
- Session facilitation UX (timers, agendas, live facilitation modes)
- Problem-solving portfolio executive indicators beyond operational filters
- Deeper evidence viewer polish (inline previews, measurement capture helpers)
- Cross-case lessons-learned search and reuse workflows (non-vector)

## Organisation and platform readiness

- Richer organisation setup wizard (industry templates, default units, starter roles)
- Organisation branding (logo, colours, email templates)
- Profile and organisation avatar/image upload polish
- Hierarchy administration UX (bulk moves, visual tree editor, retirement workflows)
- User administration (bulk invite, lifecycle dashboards, membership hygiene)
- Role administration (permission diff views, grant audit, delegation guidance)
- Field formatting and locale display consistency (dates, numbers, currency, units)
- Navigation information architecture review (grouping, labelling, discoverability)
- Light/dark theme polish pass across all flagship modules
- Mobile responsive polish beyond functional 390px smoke (touch gestures, compact tables)
- Dedicated in-product documentation portal (help centre, contextual guides, release notes)

## RBAC2 — module access roles and scoped responsibilities

Future access architecture should separate **organisational placement**, **baseline participation/read access**, and **privileged module responsibility**. The goal is to make access easier for customer administrators to understand without weakening the existing permission, scope, hierarchy, RLS, immutable role-version, or delegation model.

### Core model

1. **Organisation structure answers where the person belongs.**
   - Membership remains linked to the existing organisation-unit hierarchy.
   - Responsibility scope is derived from the existing unit tree rather than a separate manager-reporting relationship.
   - Example: if Przem Prod Manager is scoped to `Production` and John Brown belongs to `Production -> Line 1`, Przem's `unit_subtree` authority naturally includes John's unit. No extra `John reports to Przem` security linkage is required.

2. **Baseline member access answers what normal users may read or participate in.**
   - Module roles must not be required merely to make a module/page visible to an otherwise eligible active member.
   - Module roles are primarily for privileged actions such as create/configure/review/approve/manage/validate/award/administer, not for ordinary read access.
   - Each module should define its own safe baseline participation/read contract. Examples include viewing published/shared information, viewing own records, completing assigned work, and submitting permitted employee-originated records.

3. **Module access roles answer what the person may manage.**
   - A user may hold multiple module roles at the same time.
   - Default user-facing roles should map cleanly to product areas rather than job titles.
   - Proposed standard roles:
     - Admin
     - Maturity
     - 5S
     - Gemba
     - Actions
     - Projects
     - Benefits
     - Problem Solving
     - Suggestions
     - People
     - Training
     - Skills
     - Recognition
   - Future modules may add their own role without requiring new job-title roles.

4. **Scope answers where the privileged role applies.**
   - Reuse the existing `self`, `unit_subtree`, and `organisation` scope model.
   - A module role assignment must be independently scoped.
   - Example: `Suggestions + Production + unit_subtree` allows managing/reviewing Production suggestions and suggestions originating from descendants such as `Production -> Line 1`, while the same person may hold `Projects + organisation` for site-wide project responsibility.

### Admin role

- `Admin` should be a protected organisation-scoped bundle representing full site/organisation administration.
- Do not implement Admin as an application/RLS bypass; it should resolve to the required underlying permissions through the existing RBAC model.
- Preserve protected-role safeguards, grant containment, immutable role versions, delegation rules, auditability, and last-owner/admin protections.

### Baseline-vs-role examples

- **Suggestions**
  - Baseline active member: can view the organisation's suggestion register subject to the final agreed visibility policy, submit a suggestion, and track accessible suggestion lifecycle/status.
  - `Suggestions` role: review, assign/reassign reviewers, approve/decline/park, manage implementation, and administer suggestion workflow within assigned scope.
- **Training**
  - Baseline active member: can view own training and participate in assigned sessions.
  - `Training` role: create/manage training, sessions, completions, and relevant administration within scope.
- **Skills**
  - Baseline active member: can view own skill profile where permitted.
  - `Skills` role: validate/manage skill records within scope.
- **Actions**
  - Baseline active member: can view and complete assigned actions.
  - `Actions` role: create/assign/manage actions within scope.
- **Recognition**
  - Baseline active member: can view permitted recognition records.
  - `Recognition` role: award/manage recognition within scope.
- Other modules should follow the same principle: ordinary read/participation is defined separately from management authority.

### Mandatory Suggestions acceptance scenario

The current QA finding must be treated as an RBAC2 acceptance case:

- An active Production Manager must be allowed to submit a suggestion even if their privileged `Suggestions` responsibility is scoped only to Production.
- Active members should not lose ordinary suggestion participation because they lack a Suggestions management role.
- Everyone with baseline suggestion read access may view suggestions according to the agreed organisation-wide visibility policy.
- A Production Manager with `Suggestions + Production + unit_subtree` may review/manage Production and descendant-unit suggestions, but must not gain management authority over unrelated unit subtrees.
- A Packing Manager can hold the same `Suggestions` role scoped to Packing; no separate `Production Manager` or `Packing Manager` RBAC role should be required.

### Administration UX direction

Provide a simple default experience such as **Access & Responsibilities** on a member profile:

- Admin — entire organisation
- Suggestions — Production subtree
- 5S — Production subtree
- Gemba — Production subtree
- Projects — entire organisation

Allow multiple module responsibilities per user and independent scope per assignment. Keep an advanced role/permission administration surface for organisations that need custom permission bundles, exact role versions, delegation controls, or non-standard combinations.

### Architecture constraints for implementation

- Preserve existing organisation membership and unit hierarchy as the source of scope containment.
- Preserve current permission-first, tenant-first, scope-qualified authorization and fail-closed RLS.
- Do not authorize from job title, display role label, route state, cached client claims, or an inferred manager relationship.
- Preserve exact published role-version binding and contained delegation rules.
- Do not widen child-resource visibility merely because a parent record is readable.
- Audit role assignment, scope changes, role-version migrations, and privilege revocation.
- Existing custom roles should remain supportable; RBAC2 should simplify the default customer experience rather than remove enterprise flexibility.

### Discovery / migration work required before implementation

- Inventory every current permission key, protected/default role, role version, grant, scope helper, sidebar/module visibility check, and module-specific role assumption.
- Verify whether multiple simultaneous role grants already work correctly end-to-end across DB, application, invitations, workforce provisioning, and administration UI.
- Define baseline participation/read policy per module separately from privileged module-role permissions.
- Design a forward-only migration from current default/job-title-like roles to module responsibility roles without silently expanding authority.
- Add hostile two-tenant, cross-unit, wider-scope, stale-grant, inactive-membership, and self-escalation tests.
- Keep hosted rollout migration-first with explicit review and approval.

## Cross-cutting UX

- Shared evidence upload and attachment gallery UX
- Comment threading and @mention polish
- Notification and activity surfacing (post-M11 seam)
- Export / print layouts for A3-style case summaries

## AI and analytics (explicitly later)

- AI facilitator / Copilot for problem-solving sessions (M12+ only; never authoritative verifier)
- Semantic / vector search over lessons learned
- Executive dashboard and enterprise BI connectors
