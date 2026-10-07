export const GEMBA_BUILDER_MODULE_KEY = "gemba" as const;
export const GEMBA_BUILDER_INTERVENTION_KEY = "setup_builder" as const;
export const GEMBA_BUILDER_SESSION_TITLE = "LeanAI Gemba setup";
export const GEMBA_BUILDER_CONTEXT_CONTRACT =
  "gemba-setup-builder-context-v1" as const;
export const GEMBA_BUILDER_PAYLOAD_KIND = "gemba_setup_builder" as const;
export const GEMBA_BUILDER_PAYLOAD_VERSION = 1 as const;
export const GEMBA_BUILDER_DECLARED_KEY = "leanai-gemba-builder" as const;
export const GEMBA_BUILDER_ROUTE = "/platform/gemba/setup/leanai" as const;
export const GEMBA_BUILDER_COOKIE_PATH = "/platform/gemba" as const;

export const GEMBA_BUILDER_LIMITS = {
  minSections: 1,
  maxSections: 8,
  minPromptsPerSection: 1,
  maxPromptsPerSection: 5,
  maxPromptsTotal: 24,
  nameMax: 160,
  descriptionMax: 600,
  sectionNameMax: 160,
  promptMax: 400,
  guidanceMax: 400,
} as const;

export type GembaBuilderPrompt = {
  prompt: string;
  guidance: string | null;
};

export type GembaBuilderSection = {
  name: string;
  description: string | null;
  prompts: GembaBuilderPrompt[];
};

export type GembaBuilderProposal = {
  name: string;
  description: string;
  sections: GembaBuilderSection[];
};

export const GEMBA_UNDERSTANDING_FIELDS = [
  ["purpose", "Purpose"],
  ["environment", "Environment"],
  ["focus", "Focus"],
  ["audience", "Audience"],
  ["depth", "Depth"],
  ["terminology", "Terminology"],
] as const;
