import type { LeanAiModuleKey } from "@/modules/leanai-context/types";

export const COACH_PRODUCT_KNOWLEDGE_VERSION = "leh-product-knowledge-v1";

export type CoachProductKnowledge = {
  version: string;
  moduleKey: LeanAiModuleKey;
  summary: string;
  facts: string[];
  recommendedPath: string;
};

const KNOWLEDGE: Partial<
  Record<LeanAiModuleKey, Omit<CoachProductKnowledge, "version" | "moduleKey">>
> = {
  organisation: {
    summary:
      "An organisation must have operational access before other Lean Excellence Hub setup can finish reliably.",
    facts: [
      "Billing and onboarding are separate from module configuration.",
      "Platform setup routes stay protected until onboarding is completed.",
    ],
    recommendedPath: "/onboarding/setup",
  },
  sites: {
    summary:
      "A site is the first unit in the organisation structure and anchors workplace activity.",
    facts: [
      "Maturity, 5S, Gemba and Recognition use active sites rather than floating at organisation level.",
      "Create at least one active billable site in Structure settings.",
    ],
    recommendedPath: "/platform/settings/structure",
  },
  people: {
    summary:
      "Job functions describe work roles. They do not grant application permissions.",
    facts: [
      "Training and Skills use job functions to describe what people do.",
      "An organisation owner plus at least one active job function is the minimum people setup.",
    ],
    recommendedPath: "/platform/settings/job-functions",
  },
  maturity: {
    summary:
      "A Maturity Framework defines the pillars and questions used for assessments.",
    facts: [
      "A draft-only framework is not ready for operational use.",
      "Publish at least one version so teams assess against a shared standard.",
      "LeanAI does not publish frameworks automatically. An authorised person publishes through the Maturity authoring interface.",
    ],
    recommendedPath: "/platform/maturity/models",
  },
  suggestions: {
    summary:
      "A Suggestion Programme holds categories, guidance and the published intake form.",
    facts: [
      "Catalogue presence without a published version is not enough.",
      "People cannot submit ideas until a programme version is published.",
    ],
    recommendedPath: "/platform/suggestions/programmes",
  },
  five_s: {
    summary:
      "5S audits run against a published standard applied to an active unit.",
    facts: [
      "Draft-only standards are incomplete.",
      "Sites are a hard prerequisite for 5S.",
    ],
    recommendedPath: "/platform/5s/standards",
  },
  gemba: {
    summary: "A Gemba definition is the published walk template.",
    facts: [
      "It must apply to at least one active unit.",
      "Sites are a hard prerequisite for Gemba.",
    ],
    recommendedPath: "/platform/gemba/definitions",
  },
  training: {
    summary:
      "Training readiness needs a published course and a published curriculum requirement.",
    facts: [
      "A catalogue listing alone is not enough.",
      "Curriculum requirements tell Lean Excellence Hub who needs which course.",
    ],
    recommendedPath: "/platform/training/curriculum",
  },
  skills: {
    summary:
      "Skills is ready only with a published scale, an active skill, and a published capability requirement.",
    facts: [
      "Partial catalogues stay incomplete so people are not assessed against unfinished definitions.",
    ],
    recommendedPath: "/platform/skills",
  },
  recognition: {
    summary:
      "Recognition types describe the kinds of acknowledgement the organisation uses.",
    facts: [
      "Activate at least one type.",
      "Sites are a hard prerequisite for Recognition.",
    ],
    recommendedPath: "/platform/recognition/types",
  },
  lean_ai: {
    summary:
      "Organisation LeanAI enablement, membership permission, and application provider availability are separate.",
    facts: [
      "Deterministic Coach guidance still works when AI is disabled.",
      "Authoritative configuration changes are never made by LeanAI automatically.",
    ],
    recommendedPath: "/platform/settings/ai",
  },
  setup: {
    summary:
      "Setup follows a recommended order: organisation, sites, people, then modules.",
    facts: [
      "Hard prerequisites block 5S, Gemba and Recognition until sites exist.",
      "Users can always continue setup manually.",
    ],
    recommendedPath: "/platform/setup",
  },
  onboarding: {
    summary: "Finish onboarding before using normal platform setup routes.",
    facts: [
      "Once the workspace is open, LeanAI guides remaining setup in order.",
    ],
    recommendedPath: "/onboarding/setup",
  },
  platform: {
    summary:
      "LeanAI Coach offers the next useful setup step for the current page.",
    facts: [
      "Ranking is deterministic and does not call a model.",
      "Explain may use AI only after an explicit user action.",
    ],
    recommendedPath: "/platform",
  },
};

export function coachProductKnowledgeFor(
  moduleKey: LeanAiModuleKey,
): CoachProductKnowledge {
  const entry = KNOWLEDGE[moduleKey] ?? {
    summary:
      "Lean Excellence Hub guides authorised setup without making changes automatically.",
    facts: [
      "Follow the recommended route for the current gap.",
      "LeanAI cannot perform administrative writes.",
    ],
    recommendedPath: "/platform/setup",
  };
  return {
    version: COACH_PRODUCT_KNOWLEDGE_VERSION,
    moduleKey,
    ...entry,
  };
}
