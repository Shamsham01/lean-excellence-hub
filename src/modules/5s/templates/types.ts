export const LEH_WORKPLACE_5S_STANDARD_KEY =
  "leh-workplace-5s-standard" as const;

export const LEH_WORKPLACE_5S_STANDARD_VERSION = 1 as const;

export const LEH_WORKPLACE_5S_STARTING_THRESHOLD = 80 as const;

export const FIVE_S_TEMPLATE_QUESTION_TYPES = [
  "yes_no",
  "score",
  "short_text",
  "long_text",
] as const;

export type FiveSTemplateQuestionType =
  (typeof FIVE_S_TEMPLATE_QUESTION_TYPES)[number];

export type FiveSTemplateQuestion = {
  prompt: string;
  questionType: FiveSTemplateQuestionType;
  guidance?: string;
};

export type FiveSTemplateCategory = {
  name: string;
  description: string;
  questions: readonly FiveSTemplateQuestion[];
};

export type FiveSQuickStartTemplate = {
  key: typeof LEH_WORKPLACE_5S_STANDARD_KEY;
  version: number;
  name: string;
  description: string;
  notes: string;
  startingThresholdPercent: number;
  categories: readonly FiveSTemplateCategory[];
};

export type FiveSTemplateCounts = {
  categories: number;
  questions: number;
};

export type FiveSDraftDefinition = {
  key: string;
  name: string;
  description: string;
  thresholdPercent: number;
  categories: Array<{
    name: string;
    questions: Array<{
      prompt: string;
      questionType: FiveSTemplateQuestionType;
      helpText: string | null;
    }>;
  }>;
};
