export type FiveSAuditAnswerSnapshot = {
  text_value?: string | null;
  number_value?: number | null;
  is_not_applicable?: boolean;
};

export function formatFiveSAuditAnswer(
  questionType: string,
  answer?: FiveSAuditAnswerSnapshot,
) {
  if (!answer) {
    return "No response recorded.";
  }
  if (answer.is_not_applicable) {
    return "Not applicable.";
  }
  if (questionType === "yes_no") {
    if (answer.text_value === "yes") return "Yes";
    if (answer.text_value === "no") return "No";
  }
  if (answer.number_value != null) {
    return String(answer.number_value);
  }
  const text = answer.text_value?.trim();
  return text || "No response recorded.";
}
