import { BENEFITS_PERMISSIONS } from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE =
  "src/lib/benefits and supabase/migrations/20260826007002_milestone10_benefits_domain.sql";

const benefitFields: PlatformKnowledgeField[] = [
  {
    name: "Benefit class",
    identifier: "benefit_class",
    purpose: "Chooses financial versus non-financial tracking.",
    required: "required",
    constraints: "financial | non_financial with paired type enums.",
    example: "financial",
    mistakes: "Entering currency amounts on a non-financial benefit.",
    dependencies: "Validation queues differ for CI and finance approvers.",
    permissions: `${BENEFITS_PERMISSIONS.create} to draft. ${BENEFITS_PERMISSIONS.validateFinance} for financial validation.`,
    lifecycle:
      "draft → submitted → approved → realising → realised (or rejected/withdrawn/cancelled).",
    consequences: "Realisation recording is separate from approval.",
    setupSteps: "Benefits → Create → class → type → planned values.",
  },
  {
    name: "Planned realisation date",
    identifier: "planned_realisation_date",
    purpose: "When the organisation expects to realise value.",
    required: "optional",
    constraints: "Must follow date ordering rules in benefits validation.",
    example: "2026-12-31",
    mistakes:
      "Backdating realised benefits without realisation.record permission.",
    dependencies: BENEFITS_PERMISSIONS.realisationRecord,
    permissions: BENEFITS_PERMISSIONS.manage,
    lifecycle: "Updated while draft or submitted unless locked by status.",
    consequences: "Forecast views use planned versus actual realisation.",
    setupSteps: "Set during create wizard or edit while editable.",
  },
  {
    name: "Benefit status",
    identifier: "status",
    purpose: "Shows approval and realisation progress.",
    required: "required",
    constraints: "See benefits status constants in src/lib/benefits/status.ts.",
    example: "submitted",
    mistakes: "Assuming LeanAI can validate or approve financial benefits.",
    dependencies: `${BENEFITS_PERMISSIONS.validateCi} and ${BENEFITS_PERMISSIONS.validateFinance}.`,
    permissions: BENEFITS_PERMISSIONS.read,
    lifecycle: "Transitions enforced by server validation.",
    consequences: "Problem Solving closure does not approve a benefit.",
    setupSteps: "Submit for validation → approvers act in queue.",
  },
];

export const BENEFITS_AUDITED_FIELD_IDENTIFIERS = [
  "benefit_class",
  "planned_realisation_date",
  "status",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "benefits",
    workflow,
    sourcePath: SOURCE,
    coverageStatus: "partial",
  });

export const BENEFITS_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] =
  [
    {
      id: "benefits.overview",
      module: "benefits",
      title: "Benefits overview",
      workflows: ["benefits_portfolio", "benefit_workspace"],
      routePrefixes: ["/platform/benefits"],
      purpose: "Track financial and non-financial value from improvement work.",
      intendedUsers: "CI and finance validators with benefits permissions.",
      facts: [
        "Benefits link to projects or other sources; they are not invoices.",
        "LeanAI cannot approve, validate, or record realisation.",
        "Separate CI and finance validation permissions exist.",
      ],
      fields: benefitFields,
      provenance: provenance("benefits.overview", "benefits_portfolio"),
    },
  ];

export function benefitsKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(
    BENEFITS_AUDITED_FIELD_IDENTIFIERS,
    BENEFITS_KNOWLEDGE_ARTICLES,
  );
}

export function benefitsKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, BENEFITS_KNOWLEDGE_ARTICLES);
}

export function benefitsKnowledgeField(fieldName: string) {
  return knowledgeField(BENEFITS_KNOWLEDGE_ARTICLES, fieldName);
}
