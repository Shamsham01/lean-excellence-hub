import {
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  allowedActionTransitions,
} from "@/lib/actions/status";
import { ACTIONS_PERMISSIONS } from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE =
  "src/lib/actions and supabase/migrations/20260824220656_universal_actions.sql";

const actionFields: PlatformKnowledgeField[] = [
  {
    name: "Action title",
    identifier: "title",
    purpose: "Names the follow-up task in lists and planner boards.",
    required: "required",
    constraints: "1 to 200 characters, trimmed.",
    example: "Replace sealer jaw before Monday run",
    mistakes: "Using vague titles like Fix it without a verifiable outcome.",
    dependencies:
      "May link to a source record such as maturity, suggestion, or problem solving.",
    permissions: `${ACTIONS_PERMISSIONS.create} to create. ${ACTIONS_PERMISSIONS.read} to view in granted scope.`,
    lifecycle: `Statuses: ${ACTION_STATUSES.join(", ")}. From open: ${allowedActionTransitions("open").join(", ")}.`,
    consequences: "Completing does not automatically verify effectiveness.",
    setupSteps:
      "Actions → Create → title, unit, priority, optional description.",
  },
  {
    name: "Priority",
    identifier: "priority",
    purpose: "Signals urgency for planners and assignees.",
    required: "required",
    constraints: ACTION_PRIORITIES.join(" | "),
    example: "high",
    mistakes: "Marking everything urgent so planners cannot triage.",
    dependencies: "Used in planner filters and list sort.",
    permissions: ACTIONS_PERMISSIONS.update,
    lifecycle: "Editable while open or in progress.",
    consequences: "Does not change RBAC or due dates by itself.",
    setupSteps: "Set on create or edit while the action is editable.",
  },
  {
    name: "Organisation unit",
    identifier: "organisation_unit_id",
    purpose: "Scopes who can read and complete the action.",
    required: "required",
    constraints: "Must be a unit in the current organisation.",
    example: "Bodmin packaging",
    mistakes: "Choosing a unit assignees cannot access.",
    dependencies:
      "Org-wide actions.read can see all units; site scope cannot see siblings.",
    permissions: ACTIONS_PERMISSIONS.read,
    lifecycle: "Set at creation; moves may require update permission.",
    consequences: "Hidden from members without read access to that unit.",
    setupSteps: "Pick the unit that owns the work before assigning.",
  },
  {
    name: "Assignee",
    identifier: "assignee_membership_id",
    purpose: "Names who is responsible for delivery.",
    required: "optional",
    constraints: "Active membership in this organisation.",
    example: "Maintenance technician",
    mistakes: "Assigning someone without actions.read in that unit.",
    dependencies: `${ACTIONS_PERMISSIONS.assign} to change assignee.`,
    permissions: `${ACTIONS_PERMISSIONS.assign} and ${ACTIONS_PERMISSIONS.read}`,
    lifecycle: "Can change while open or in progress.",
    consequences:
      "Assignee sees the action in their planner, not automatic completion.",
    setupSteps: "Open action → Assign → choose member.",
  },
  {
    name: "Status",
    identifier: "status",
    purpose: "Shows progress from open through verified or cancelled.",
    required: "required",
    constraints: ACTION_STATUSES.join(" | "),
    example: "in_progress",
    mistakes:
      "Jumping to verified without evidence when your organisation expects verification.",
    dependencies:
      "actions.complete to mark completed. actions.verify exists in the permission registry for verification workflows.",
    permissions: `${ACTIONS_PERMISSIONS.complete} to complete. Verification may need actions.verify where enabled.`,
    lifecycle: `Transitions follow allowedActionTransitions in src/lib/actions/status.ts.`,
    consequences: "Reopen from completed or cancelled returns to open.",
    setupSteps: "Use planner or detail sheet transitions aligned to your role.",
  },
];

export const ACTIONS_AUDITED_FIELD_IDENTIFIERS = [
  "title",
  "priority",
  "organisation_unit_id",
  "assignee_membership_id",
  "status",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "actions",
    workflow,
    sourcePath: SOURCE,
  });

export const ACTIONS_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] = [
  {
    id: "actions.overview",
    module: "actions",
    title: "Actions overview",
    workflows: ["actions_list", "actions_planner", "action_detail"],
    routePrefixes: ["/platform/actions"],
    purpose:
      "Universal follow-up tasks across improvement modules with scoped visibility.",
    intendedUsers: "Operators through CI leads with actions permissions.",
    facts: [
      "Actions can originate from maturity gaps, suggestions, problem solving, and other sources.",
      "Planner and list views share the same records; filters change presentation only.",
      "LeanAI does not create or complete actions without a person confirming.",
      "Evidence attachments follow the shared attachment model.",
    ],
    fields: actionFields,
    provenance: provenance("actions.overview", "actions_list"),
  },
];

export function actionsKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(
    ACTIONS_AUDITED_FIELD_IDENTIFIERS,
    ACTIONS_KNOWLEDGE_ARTICLES,
  );
}

export function actionsKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, ACTIONS_KNOWLEDGE_ARTICLES);
}

export function actionsKnowledgeField(fieldName: string) {
  return knowledgeField(ACTIONS_KNOWLEDGE_ARTICLES, fieldName);
}
