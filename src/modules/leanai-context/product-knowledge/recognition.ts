import { RECOGNITION_PERMISSIONS } from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE =
  "src/app/(platform)/platform/recognition and recognition migrations";

const recognitionFields: PlatformKnowledgeField[] = [
  {
    name: "Recognition type",
    identifier: "recognition_type_id",
    purpose: "Classifies the kind of acknowledgement being awarded.",
    required: "required",
    constraints: "At least one active type required for recognition readiness.",
    example: "Safety highlight",
    mistakes:
      "Creating types but leaving them inactive so readiness stays incomplete.",
    dependencies: "Active sites are a hard prerequisite.",
    permissions: `${RECOGNITION_PERMISSIONS.manage} to maintain types. ${RECOGNITION_PERMISSIONS.award} to nominate.`,
    lifecycle: "Types can be activated or deactivated.",
    consequences: "Inactive-only catalogues block recognition readiness.",
    setupSteps:
      "Recognition → Types → activate at least one type per site rollout.",
  },
  {
    name: "Award recipient",
    identifier: "recipient_membership_id",
    purpose: "Names who receives the recognition.",
    required: "required",
    constraints: "Active membership in scope.",
    example: "Shift lead who coached safe restart",
    mistakes: "Awarding someone outside the reader's visible membership list.",
    dependencies: RECOGNITION_PERMISSIONS.award,
    permissions: `${RECOGNITION_PERMISSIONS.read} to view awards in scope.`,
    lifecycle: "Award recorded when submitted; not payroll or compensation.",
    consequences: "Does not change RBAC or job function.",
    setupSteps: "New recognition → type → recipient → narrative → submit.",
  },
];

export const RECOGNITION_AUDITED_FIELD_IDENTIFIERS = [
  "recognition_type_id",
  "recipient_membership_id",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "recognition",
    workflow,
    sourcePath: SOURCE,
    coverageStatus: "partial",
  });

export const RECOGNITION_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] =
  [
    {
      id: "recognition.overview",
      module: "recognition",
      title: "Recognition overview",
      workflows: ["recognition_types", "recognition_award"],
      routePrefixes: ["/platform/recognition"],
      purpose:
        "Acknowledge behaviours and outcomes using organisation-defined types.",
      intendedUsers: "Managers and peers with recognition.award.",
      facts: [
        "Recognition is not compensation, billing, or HR payroll.",
        "Setup readiness needs active types and sites.",
        "LeanAI does not submit awards on someone's behalf.",
      ],
      fields: recognitionFields,
      provenance: provenance("recognition.overview", "recognition_types"),
    },
  ];

export function recognitionKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(
    RECOGNITION_AUDITED_FIELD_IDENTIFIERS,
    RECOGNITION_KNOWLEDGE_ARTICLES,
  );
}

export function recognitionKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, RECOGNITION_KNOWLEDGE_ARTICLES);
}

export function recognitionKnowledgeField(fieldName: string) {
  return knowledgeField(RECOGNITION_KNOWLEDGE_ARTICLES, fieldName);
}
