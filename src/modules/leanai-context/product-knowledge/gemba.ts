import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";

import {
  knowledgeField,
  knowledgeFieldGaps,
  knowledgeForPath,
  platformKnowledgeProvenance,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
} from "./contract";

const SOURCE = "src/modules/gemba and gemba walk migrations";

const gembaFields: PlatformKnowledgeField[] = [
  {
    name: "Walk definition name",
    identifier: "definition_name",
    purpose: "Names the published walk template people execute.",
    required: "required",
    constraints: "Definition must apply to at least one active unit.",
    example: "Daily packaging supervisor walk",
    mistakes: "Starting walks while the definition is still draft-only.",
    dependencies: "Sites are required before Gemba readiness completes.",
    permissions: `${GEMBA_PERMISSIONS.definitionsManage} to publish. ${GEMBA_PERMISSIONS.read} to view.`,
    lifecycle:
      "Draft → published; walks instantiate from published definitions.",
    consequences: "Observation answers are stored per walk instance.",
    setupSteps:
      "/platform/gemba/setup → publish definition → schedule or start walk.",
  },
  {
    name: "Observation answer",
    identifier: "observation_text",
    purpose: "Captures what the walker saw at a question on the route.",
    required: "optional",
    constraints: "Text per question; may include photos per walk rules.",
    example: "Labels drifting on lane two",
    mistakes: "Treating conversational LeanAI text as an official observation.",
    dependencies: `${GEMBA_PERMISSIONS.walkPerform} to record. ${GEMBA_PERMISSIONS.walkReview} to review.`,
    permissions: GEMBA_PERMISSIONS.walkPerform,
    lifecycle: "Walk progresses in_progress → completed or cancelled.",
    consequences: "Summaries aggregate completed walks the member can read.",
    setupSteps: "Open active walk → answer questions → complete walk.",
  },
];

export const GEMBA_AUDITED_FIELD_IDENTIFIERS = [
  "definition_name",
  "observation_text",
] as const;

const provenance = (id: string, workflow: string) =>
  platformKnowledgeProvenance({
    knowledgeId: id,
    module: "gemba",
    workflow,
    sourcePath: SOURCE,
    coverageStatus: "partial",
  });

export const GEMBA_KNOWLEDGE_ARTICLES: readonly PlatformKnowledgeArticle[] = [
  {
    id: "gemba.overview",
    module: "gemba",
    title: "Gemba overview",
    workflows: ["gemba_definitions", "gemba_walks", "gemba_setup"],
    routePrefixes: ["/platform/gemba"],
    purpose:
      "Published walk definitions and structured observations from the workplace.",
    intendedUsers: "Supervisors and reviewers with gemba permissions.",
    facts: [
      "Definitions are organisation templates; walks are instances on units.",
      "LeanAI setup builder proposes drafts; humans publish.",
      "Historical walks respect unit and gemba.read scope.",
    ],
    fields: gembaFields,
    provenance: provenance("gemba.overview", "gemba_setup"),
  },
];

export function gembaKnowledgeFieldGaps(): string[] {
  return knowledgeFieldGaps(
    GEMBA_AUDITED_FIELD_IDENTIFIERS,
    GEMBA_KNOWLEDGE_ARTICLES,
  );
}

export function gembaKnowledgeForPath(pathname: string) {
  return knowledgeForPath(pathname, GEMBA_KNOWLEDGE_ARTICLES);
}

export function gembaKnowledgeField(fieldName: string) {
  return knowledgeField(GEMBA_KNOWLEDGE_ARTICLES, fieldName);
}
