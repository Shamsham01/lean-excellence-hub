import type { MaturityFrameworkScopeType } from "@/modules/maturity/semantic-scope";

export const LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY =
  "leh-operational-excellence-standard" as const;

export const LEH_OE_STANDARD_EXPECTED_COUNTS = {
  levels: 5,
  pillars: 5,
  criteria: 30,
  scoredQuestions: 60,
  questionsPerCriterion: 2,
} as const;

/** Matches `template_questions_prompt_check` (1..500). */
export const MATURITY_TEMPLATE_QUESTION_PROMPT_MAX_LENGTH = 500;

export type MaturityTemplateQuestion = {
  prompt: string;
  allowsNotApplicable?: boolean;
};

export type MaturityTemplateCriterion = {
  name: string;
  description: string;
  guidance: string;
  questions: readonly MaturityTemplateQuestion[];
};

export type MaturityTemplatePillar = {
  name: string;
  description?: string;
  guidance?: string;
  criteria: readonly MaturityTemplateCriterion[];
};

export type MaturityTemplateLevel = {
  name: string;
  description: string;
  guidance: string;
  colorToken: string;
};

export type MaturityFrameworkTemplate = {
  key: string;
  name: string;
  description: string;
  assessmentScopes: readonly MaturityFrameworkScopeType[];
  levels: readonly MaturityTemplateLevel[];
  pillars: readonly MaturityTemplatePillar[];
};

export type MaturityTemplateCounts = {
  levels: number;
  pillars: number;
  criteria: number;
  scoredQuestions: number;
};

export type MaturityTemplateValidationIssue = {
  path: string;
  message: string;
};

export type MaturityQuickStartDefinition = {
  key: string;
  name: string;
  description: string;
  assessmentScopes: MaturityFrameworkScopeType[];
  levels: Array<{
    name: string;
    colorToken: string;
    description: string;
    guidance: string;
  }>;
  pillars: Array<{
    name: string;
    description: string | null;
    guidance: string | null;
    criteria: Array<{
      name: string;
      description: string;
      guidance: string;
      questions: Array<{
        prompt: string;
        allowsNotApplicable: boolean;
      }>;
    }>;
  }>;
};
