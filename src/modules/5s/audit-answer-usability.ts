import type { AuditAnswer } from "@/components/five-s/audit-answer-state";

export type FiveSAuditQuestion = {
  question_type: string;
  allows_not_applicable: boolean;
};

export function hasUsableFiveSAuditAnswer(
  question: FiveSAuditQuestion,
  answer: AuditAnswer | undefined,
): boolean {
  if (answer?.is_not_applicable && question.allows_not_applicable) {
    return true;
  }

  if (question.question_type === "yes_no") {
    const value = answer?.text_value?.trim().toLowerCase();
    return value === "yes" || value === "no";
  }

  if (
    question.question_type === "score" ||
    question.question_type === "number" ||
    question.question_type === "percentage"
  ) {
    return answer?.number_value != null && Number.isFinite(answer.number_value);
  }

  return Boolean(answer?.text_value?.trim());
}
