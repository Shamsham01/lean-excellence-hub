import { EvidenceGallery } from "@/components/attachments/evidence-gallery";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Section = {
  id: string;
  title: string;
  questions: Array<{
    id: string;
    prompt: string;
    question_type: string;
    help_text: string | null;
  }>;
};

type AuditAnswer = {
  text_value?: string | null;
  number_value?: number | null;
  is_not_applicable?: boolean;
};

export function formatFiveSAuditAnswer(
  questionType: string,
  answer?: AuditAnswer,
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

export function FiveSAuditResult({
  sections,
  answers,
  evidence,
}: {
  sections: Section[];
  answers: Record<string, AuditAnswer>;
  evidence: EvidenceItem[];
}) {
  const evidenceByQuestion = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    if (!item.question_id) continue;
    const current = evidenceByQuestion.get(item.question_id) ?? [];
    current.push(item);
    evidenceByQuestion.set(item.question_id, current);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="five-s-audit-result">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {section.questions.map((question) => {
              const linkedEvidence = evidenceByQuestion.get(question.id) ?? [];
              return (
                <div
                  key={question.id}
                  className="flex flex-col gap-2"
                  data-testid={`five-s-result-question-${question.id}`}
                >
                  <p className="font-medium">{question.prompt}</p>
                  <p className="text-sm">
                    {formatFiveSAuditAnswer(
                      question.question_type,
                      answers[question.id],
                    )}
                  </p>
                  <EvidenceGallery
                    items={linkedEvidence}
                    contextLabel={question.prompt}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
