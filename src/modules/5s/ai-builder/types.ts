import type { FiveSTemplateQuestionType } from "@/modules/5s/templates";

export const FIVE_S_BUILDER_MODULE_KEY = "five_s" as const;
export const FIVE_S_BUILDER_INTERVENTION_KEY = "setup_builder" as const;
export const FIVE_S_BUILDER_SESSION_TITLE = "LeanAI 5S setup";
export const FIVE_S_BUILDER_CONTEXT_CONTRACT =
  "five-s-setup-builder-context-v1" as const;
export const FIVE_S_BUILDER_PAYLOAD_KIND = "five_s_setup_builder" as const;
export const FIVE_S_BUILDER_PAYLOAD_VERSION = 1 as const;
export const FIVE_S_BUILDER_DECLARED_KEY = "leanai-five-s-builder" as const;
export const FIVE_S_BUILDER_ROUTE = "/platform/5s/setup/leanai" as const;
export const FIVE_S_BUILDER_COOKIE_PATH = "/platform/5s" as const;

export const FIVE_S_BUILDER_LIMITS = {
  minCategories: 1,
  maxCategories: 8,
  minQuestionsPerCategory: 1,
  maxQuestionsPerCategory: 6,
  maxQuestionsTotal: 30,
  nameMax: 160,
  descriptionMax: 600,
  categoryNameMax: 160,
  promptMax: 400,
  guidanceMax: 400,
} as const;

export const FIVE_S_QUESTION_TYPES = [
  "yes_no",
  "score",
  "short_text",
  "long_text",
] as const satisfies readonly FiveSTemplateQuestionType[];

export type FiveSBuilderQuestion = {
  prompt: string;
  questionType: FiveSTemplateQuestionType;
  guidance: string | null;
};

export type FiveSBuilderCategory = {
  name: string;
  description: string | null;
  questions: FiveSBuilderQuestion[];
};

export type FiveSBuilderProposal = {
  name: string;
  description: string;
  thresholdPercent: number;
  categories: FiveSBuilderCategory[];
};

export const FIVE_S_UNDERSTANDING_FIELDS = [
  ["environment", "Environment"],
  ["purpose", "Purpose"],
  ["auditStyle", "Audit style"],
  ["depth", "Depth"],
  ["evidence", "Evidence"],
  ["scoring", "Scoring"],
  ["terminology", "Terminology"],
] as const;
