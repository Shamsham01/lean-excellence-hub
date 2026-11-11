import { EvidenceGallery } from "@/components/attachments/evidence-gallery";
import { FiveSRaiseActionButton } from "@/components/five-s/five-s-raise-action-button";
import {
  FiveSQuestionLinkedActions,
  type FiveSLinkedAction,
} from "@/components/five-s/five-s-question-linked-actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatFiveSAuditAnswer,
  type FiveSAuditAnswerSnapshot,
} from "@/modules/5s/format-audit-answer";

export { formatFiveSAuditAnswer };

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

type AuditAnswer = FiveSAuditAnswerSnapshot;

export function FiveSAuditResult({
  sections,
  answers,
  evidence,
  auditId,
  standardName,
  unitName,
  canRaiseAction,
  linkedActions = [],
}: {
  sections: Section[];
  answers: Record<string, AuditAnswer>;
  evidence: EvidenceItem[];
  auditId: string;
  standardName: string;
  unitName: string;
  canRaiseAction: boolean;
  linkedActions?: FiveSLinkedAction[];
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
                  {canRaiseAction ? (
                    <FiveSRaiseActionButton
                      context={{
                        auditId,
                        sectionId: section.id,
                        questionId: question.id,
                        questionPrompt: question.prompt,
                        questionType: question.question_type,
                        standardName,
                        unitName,
                        ...(answers[question.id]
                          ? { answer: answers[question.id] }
                          : {}),
                      }}
                      testId={`five-s-raise-action-${question.id}`}
                    />
                  ) : null}
                  <FiveSQuestionLinkedActions
                    questionId={question.id}
                    actions={linkedActions}
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
