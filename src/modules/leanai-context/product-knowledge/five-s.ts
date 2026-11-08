import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE = "src/modules/5s and supabase/migrations for five_s domain";

const fiveSFields: PlatformKnowledgeField[] = [
  {
    name: "Standard name",
    identifier: "standard_name",
    purpose: "Names the 5S standard teams audit against.",
    required: "required",
    constraints: "Published standard applies to at least one active unit.",
    example: "Packaging line 5S standard",
    mistakes: "Performing audits while only a draft standard exists.",
    dependencies: "Active sites are a hard prerequisite for 5S readiness.",
    permissions: `${FIVE_S_PERMISSIONS.standardsManage} to publish. ${FIVE_S_PERMISSIONS.read} to view.`,
    lifecycle:
      "Draft standards are incomplete; publish before operational audits.",
    consequences: "Audit scores reference the published standard version.",
    setupSteps:
      "/platform/5s/setup → manual, Quick Start, or LeanAI → publish standard.",
  },
  {
    name: "Audit score",
    identifier: "audit_score",
    purpose: "Records performance against the scoring scale on a criterion.",
    required: "required",
    constraints:
      "Must align with the standard's scoring scale integrity rules.",
    example: "Sort scored 4 of 5 with evidence note",
    mistakes:
      "Scoring without visiting the gemba or attaching expected evidence.",
    dependencies: `${FIVE_S_PERMISSIONS.auditPerform} to score. ${FIVE_S_PERMISSIONS.auditReview} to review.`,
    permissions: FIVE_S_PERMISSIONS.auditPerform,
    lifecycle:
      "Audit moves from in progress to submitted/reviewed per workflow.",
    consequences: "Historical trends use published audits only.",
    setupSteps:
      "Start audit on unit with published standard → score criteria → submit.",
  },
];

export const FIVE_S_AUDITED_FIELD_IDENTIFIERS = [
  "standard_name",
  "audit_score",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "five_s",
    workflow,
    sourcePath: SOURCE,
    coverageStatus: "partial",
  });

export const FIVE_S_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] = [
  {
    id: "five_s.overview",
    module: "five_s",
    title: "5S overview",
    workflows: ["five_s_standards", "five_s_audits", "five_s_setup"],
    routePrefixes: ["/platform/5s"],
    purpose:
      "Publish 5S standards and run audits against active organisational units.",
    intendedUsers: "Team leaders and auditors with five_s permissions.",
    facts: [
      "Sites must exist before 5S setup can finish.",
      "Three-path setup matches other modules: manual, Quick Start, LeanAI draft.",
      "LeanAI does not publish standards or submit audits.",
    ],
    fields: fiveSFields,
    provenance: provenance("five_s.overview", "five_s_setup"),
  },
];

export function fiveSKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(
    FIVE_S_AUDITED_FIELD_IDENTIFIERS,
    FIVE_S_KNOWLEDGE_ARTICLES,
  );
}

export function fiveSKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, FIVE_S_KNOWLEDGE_ARTICLES);
}

export function fiveSKnowledgeField(fieldName: string) {
  return knowledgeField(FIVE_S_KNOWLEDGE_ARTICLES, fieldName);
}
