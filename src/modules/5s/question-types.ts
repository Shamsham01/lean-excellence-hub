export const FIVE_S_AUTHORING_QUESTION_TYPES = ["yes_no", "score"] as const;

export type FiveSAuthoringQuestionType =
  (typeof FIVE_S_AUTHORING_QUESTION_TYPES)[number];

const AUTHORING_TYPE_SET = new Set<string>(FIVE_S_AUTHORING_QUESTION_TYPES);

export function fiveSAuthoringQuestionTypeError(type: string): string | null {
  if (AUTHORING_TYPE_SET.has(type)) {
    return null;
  }
  return "5S questions can only be Yes / No or Score.";
}
