import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE = "src/modules/maturity and supabase/migrations/20260825001002_milestone5_maturity_domain.sql";

const modelFields: PlatformKnowledgeField[] = [
  {
    name: "Framework name",
    identifier: "display_name",
    purpose: "Names the maturity framework people recognise in lists and assessments.",
    required: "required",
    constraints: "1 to 160 characters, trimmed.",
    example: "Operational excellence standard",
    mistakes: "Using a site name as the only title when the framework is organisation-wide.",
    dependencies: "Belongs to the maturity model. Versions carry the assessable structure.",
    permissions: `${MATURITY_PERMISSIONS.modelsManage} to author. ${MATURITY_PERMISSIONS.read} to view.`,
    lifecycle: "Editable on draft versions. Published versions are read-only until a successor is published.",
    consequences: "Renaming does not rewrite completed assessment history tied to prior versions.",
    setupSteps:
      "Create a model → add a draft version → build levels, pillars, criteria, and questions → publish the version.",
  },
  {
    name: "Level number",
    identifier: "level_number",
    purpose: "Orders maturity levels from least to most capable.",
    required: "required",
    constraints: "Whole number unique per version.",
    example: "1 Developing, 2 Capable, 3 Leading",
    mistakes: "Skipping numbers or treating the level as a person's job grade.",
    dependencies: "Each level has a name and optional guidance on the same version.",
    permissions: `${MATURITY_PERMISSIONS.modelsManage} while the version is draft.`,
    lifecycle: "Frozen when the version is published.",
    consequences: "Assessments score against the published level definitions.",
    setupSteps: "Open Maturity authoring → Levels step → add ordered levels before pillars.",
  },
  {
    name: "Pillar weight",
    identifier: "pillar_weight",
    purpose: "Shows how much this pillar contributes to the overall score.",
    required: "required",
    constraints: "Must be greater than zero.",
    example: "Leadership 20%, Process 35%",
    mistakes: "Leaving weights that do not reflect how the organisation wants to score.",
    dependencies: "Criteria under the pillar also carry weights.",
    permissions: MATURITY_PERMISSIONS.modelsManage,
    lifecycle: "Editable on draft versions only.",
    consequences: "Published weights drive official results calculations.",
    setupSteps: "Authoring → Pillars → set name, position, and weight.",
  },
  {
    name: "Criterion expected evidence",
    identifier: "expected_evidence",
    purpose: "Tells assessors what proof to look for at this criterion.",
    required: "optional",
    constraints: "Up to 4,000 characters.",
    example: "Signed standard work for the line, last 30 days.",
    mistakes: "Writing the score you want instead of what evidence should exist.",
    dependencies: "Linked to questions that may contribute to score.",
    permissions: MATURITY_PERMISSIONS.modelsManage,
    lifecycle: "Travels with the published version.",
    consequences: "Does not auto-collect evidence; assessors attach or reference it.",
    setupSteps: "Authoring → Criteria → describe expected evidence per criterion.",
  },
  {
    name: "Assessment type",
    identifier: "assessment_type",
    purpose: "Chooses self or formal assessment workflow.",
    required: "required",
    constraints: "self or formal.",
    example: "formal",
    mistakes: "Starting formal without a lead assessor when formal requires review steps.",
    dependencies: "Formal assessments use review, approve, and publish permissions.",
    permissions: `${MATURITY_PERMISSIONS.assessSelf} or ${MATURITY_PERMISSIONS.assessFormal} to start.`,
    lifecycle: "draft → in_progress → submitted → assessor_review → approved → published → completed.",
    consequences: "Self assessments skip formal review gates.",
    setupSteps: "Start assessment → pick unit and published model version → choose type.",
  },
];

export const MATURITY_AUDITED_FIELD_IDENTIFIERS = [
  "display_name",
  "level_number",
  "pillar_weight",
  "expected_evidence",
  "assessment_type",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "maturity",
    workflow,
    sourcePath: SOURCE,
  });

export const MATURITY_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] = [
  {
    id: "maturity.overview",
    module: "maturity",
    title: "Maturity overview",
    workflows: ["maturity_portfolio", "maturity_authoring", "maturity_assessment"],
    routePrefixes: ["/platform/maturity"],
    purpose:
      "Maturity measures capability against a published framework version at a chosen organisational scope.",
    intendedUsers: "Framework authors, assessors, and reviewers with maturity permissions.",
    facts: [
      "A draft framework version is not operational until it is published.",
      "Assessments and results stay scoped to the site or unit being assessed.",
      "The LEH Operational Excellence Standard Quick Start creates an organisation-owned draft; template updates do not change existing copies.",
      "LeanAI may propose draft structure. A person with maturity.models.manage publishes.",
      "Formal assessments need review and approve permissions before results publish.",
    ],
    fields: modelFields,
    provenance: provenance("maturity.overview", "maturity_authoring"),
  },
];

export function maturityKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(MATURITY_AUDITED_FIELD_IDENTIFIERS, MATURITY_KNOWLEDGE_ARTICLES);
}

export function maturityKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, MATURITY_KNOWLEDGE_ARTICLES);
}

export function maturityKnowledgeField(fieldName: string) {
  return knowledgeField(MATURITY_KNOWLEDGE_ARTICLES, fieldName);
}

export const MATURITY_PERMISSIONS_EXPORT = Object.values(MATURITY_PERMISSIONS);
