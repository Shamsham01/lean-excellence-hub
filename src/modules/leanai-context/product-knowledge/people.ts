import {
  JOB_FUNCTION_PERMISSIONS,
  PEOPLE_PERMISSIONS,
} from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE =
  "src/lib/people and supabase/migrations/20261030183000_multi_grant_invitations.sql";

const peopleFields: PlatformKnowledgeField[] = [
  {
    name: "Job function",
    identifier: "job_function",
    purpose: "Describes the work someone performs, not application permissions.",
    required: "required",
    constraints: "Active job function in the organisation catalogue.",
    example: "Line Operator",
    mistakes: "Treating job function as a substitute for Workplace Viewer or admin roles.",
    dependencies: "Used by Training curriculum and Skills requirements.",
    permissions: `${JOB_FUNCTION_PERMISSIONS.manage} to maintain. ${PEOPLE_PERMISSIONS.capabilityRead} to view capability profiles.`,
    lifecycle: "Archived functions stop appearing on new assignments.",
    consequences: "Does not grant login or module access by itself.",
    setupSteps: "Settings → Job functions → create → assign on membership.",
  },
  {
    name: "Invitation roles",
    identifier: "invitation_role_grants",
    purpose: "Lists application permissions sent with an invite.",
    required: "required",
    constraints: "One or more roles, each with explicit scope.",
    example: "Workplace Viewer + Suggestions Contributor at Bodmin site",
    mistakes: "Assuming Operator preset cannot be edited before send.",
    dependencies: "Operator preset bundles two roles at one site.",
    permissions: "people.invite and role-specific grants managed by administrators.",
    lifecycle: "Becomes active membership grants when accepted.",
    consequences: "Editing one site's grant does not change another site.",
    setupSteps: "People → Invite → choose roles and scope → send.",
  },
  {
    name: "Primary organisational assignment",
    identifier: "primary_assignment",
    purpose: "Default unit for submissions such as suggestions.",
    required: "required",
    constraints: "Active assignment on an organisational unit.",
    example: "Bodmin packaging area",
    mistakes: "Leaving primary assignment empty then wondering why submit is blocked.",
    dependencies: "Distinct from job function and from RBAC scope.",
    permissions: PEOPLE_PERMISSIONS.capabilityRead,
    lifecycle: "Can be updated by administrators without changing login email.",
    consequences: "Suggestion submit uses this unit when not overridden.",
    setupSteps: "Member profile → set primary assignment on a real unit.",
  },
];

export const PEOPLE_AUDITED_FIELD_IDENTIFIERS = [
  "job_function",
  "invitation_role_grants",
  "primary_assignment",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "people",
    workflow,
    sourcePath: SOURCE,
    coverageStatus: "partial",
  });

export const PEOPLE_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] = [
  {
    id: "people.overview",
    module: "people",
    title: "People overview",
    workflows: ["people_directory", "people_invite", "people_capability"],
    routePrefixes: ["/platform/people", "/platform/settings/people"],
    purpose: "Directory, invitations, and capability views separate work roles from access grants.",
    intendedUsers: "HR administrators and members reviewing their own access.",
    facts: [
      "Job functions describe work. Roles describe application permissions.",
      "Workplace Viewer is not the same as Team Member or full module read access.",
      "Skills assessments are documented in the Skills knowledge bundle.",
      "Organisation ownership transfer does not reassign site administration.",
    ],
    fields: peopleFields,
    provenance: provenance("people.overview", "people_directory"),
  },
];

export function peopleKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(PEOPLE_AUDITED_FIELD_IDENTIFIERS, PEOPLE_KNOWLEDGE_ARTICLES);
}

export function peopleKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, PEOPLE_KNOWLEDGE_ARTICLES);
}

export function peopleKnowledgeField(fieldName: string) {
  return knowledgeField(PEOPLE_KNOWLEDGE_ARTICLES, fieldName);
}
