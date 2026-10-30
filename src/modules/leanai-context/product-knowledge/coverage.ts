import { skillsKnowledgeFieldGaps } from "./skills";

export type PlatformKnowledgeCoverage = {
  module: string;
  status: "complete" | "partial" | "not_started";
  followUp: string;
};

const skillsFieldGaps = skillsKnowledgeFieldGaps();

/** Skills is the only module with field-level product knowledge in this release. */
export const PLATFORM_KNOWLEDGE_COVERAGE: readonly PlatformKnowledgeCoverage[] =
  [
    {
      module: "skills",
      status: skillsFieldGaps.length === 0 ? "complete" : "partial",
      followUp:
        skillsFieldGaps.length === 0
          ? "Audited Skills authoring and assessment fields are in this bundle. Guided setup labels What the scale means, What this level means, and Target proficiency map to Scale description, Level guidance, and Required level. Matrix states are facts, not data-entry fields. Other modules are not covered by this bundle."
          : `These audited Skills fields are not in the bundle yet: ${skillsFieldGaps.join(", ")}.`,
    },
    {
      module: "maturity",
      status: "partial",
      followUp:
        "Builder prompts and coach facts exist. Field-level knowledge for levels, pillars, criteria, and questions is not in the versioned bundle.",
    },
    {
      module: "five_s",
      status: "partial",
      followUp:
        "Setup builder and Quick Start exist. Audit scoring fields are not in the versioned knowledge bundle.",
    },
    {
      module: "gemba",
      status: "partial",
      followUp:
        "Setup builder and Quick Start exist. Walk question fields are not in the versioned knowledge bundle.",
    },
    {
      module: "training",
      status: "partial",
      followUp:
        "Readiness copy exists. Course, curriculum, and completion fields are not covered. No three-path setup yet.",
    },
    {
      module: "suggestions",
      status: "partial",
      followUp:
        "Programme versus category is documented for the assistant. Submission and review fields are not a full bundle.",
    },
    {
      module: "people",
      status: "partial",
      followUp:
        "Job functions and invitations have coach facts. Assessment knowledge is included only because Skills owns that workflow.",
    },
    {
      module: "recognition",
      status: "not_started",
      followUp:
        "Add recognition types, nominations, and permissions before claiming coverage.",
    },
    {
      module: "problem_solving",
      status: "partial",
      followUp:
        "Case facilitation has its own prompts and evals. It is not part of this product-knowledge bundle.",
    },
    {
      module: "projects_and_benefits",
      status: "not_started",
      followUp:
        "Charter, milestone, and benefit fields need their own articles.",
    },
    {
      module: "billing_and_administration",
      status: "not_started",
      followUp:
        "Do not answer plan, invoice, or ownership-transfer questions from the Skills bundle.",
    },
  ];

export function knowledgeCoverageStatement(): string {
  return "LeanAI has complete field-level product knowledge for Skills only. Other modules are partial or not started, so answer those from the shorter coach facts or say the detailed guide is not available yet.";
}
