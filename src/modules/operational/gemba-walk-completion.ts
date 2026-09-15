export type GembaPromptQuestion = {
  id: string;
  is_required: boolean;
  allows_not_applicable: boolean;
};

export type GembaPromptAnswer = {
  text_value?: string | null;
  number_value?: number | null;
  date_value?: string | null;
  json_value?: unknown;
  is_not_applicable?: boolean;
};

export function hasUsableGembaPromptAnswer(
  question: Pick<GembaPromptQuestion, "allows_not_applicable">,
  answer: GembaPromptAnswer | undefined,
) {
  if (answer?.is_not_applicable && question.allows_not_applicable) {
    return true;
  }

  if (answer?.text_value?.trim()) return true;
  if (answer?.number_value != null) return true;
  if (answer?.date_value) return true;
  if (answer?.json_value != null) return true;
  return false;
}

export function countUnansweredRequiredGembaPrompts(
  questions: GembaPromptQuestion[],
  getAnswer: (questionId: string) => GembaPromptAnswer | undefined,
) {
  return questions.filter(
    (question) =>
      question.is_required &&
      !hasUsableGembaPromptAnswer(question, getAnswer(question.id)),
  ).length;
}
