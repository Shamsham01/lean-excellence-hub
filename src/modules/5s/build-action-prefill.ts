import {
  formatFiveSAuditAnswer,
  type FiveSAuditAnswerSnapshot,
} from "@/modules/5s/format-audit-answer";

export type { FiveSAuditAnswerSnapshot };

export function buildFiveSActionPrefill(input: {
  questionPrompt: string;
  questionType: string;
  answer?: FiveSAuditAnswerSnapshot;
  standardName: string;
  unitName: string;
}): { title: string; description: string } {
  const location = [input.standardName.trim(), input.unitName.trim()]
    .filter(Boolean)
    .join(" · ");
  const scoreLine = formatFiveSAuditAnswer(input.questionType, input.answer);
  const title =
    input.questionPrompt.trim().length > 0
      ? input.questionPrompt.trim().slice(0, 200)
      : "5S audit action";
  const description = [
    location ? `Location: ${location}` : null,
    `Question: ${input.questionPrompt.trim()}`,
    `Response: ${scoreLine}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { title, description };
}
