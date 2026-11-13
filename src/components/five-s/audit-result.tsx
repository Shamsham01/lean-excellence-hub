import { EvidenceGallery } from "@/components/attachments/evidence-gallery";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FiveSAuditLinkedActionSummary } from "@/modules/5s/load-audit-linked-actions";
import {
  actionStatusBadgeVariant,
  actionStatusLabel,
  formatDueDate,
} from "@/lib/actions/status";

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
  linkedActions = [],
}: {
  sections: Section[];
  answers: Record<string, AuditAnswer>;
  evidence: EvidenceItem[];
  linkedActions?: FiveSAuditLinkedActionSummary[];
}) {
  const evidenceByQuestion = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    if (!item.question_id) continue;
    const current = evidenceByQuestion.get(item.question_id) ?? [];
    current.push(item);
    evidenceByQuestion.set(item.question_id, current);
  }

  const actionsByQuestion = new Map<string, FiveSAuditLinkedActionSummary[]>();
  for (const action of linkedActions) {
    if (!action.questionId) continue;
    const current = actionsByQuestion.get(action.questionId) ?? [];
    current.push(action);
    actionsByQuestion.set(action.questionId, current);
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
              const questionActions = actionsByQuestion.get(question.id) ?? [];
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
                  {questionActions.length > 0 ? (
                    <div
                      className="mt-2 flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
                      data-testid={`five-s-result-actions-${question.id}`}
                    >
                      <p className="text-sm font-medium">Linked actions</p>
                      {questionActions.map((action) => (
                        <div
                          key={action.id}
                          className="flex flex-col gap-2 border-t border-border/50 pt-3 first:border-0 first:pt-0"
                          data-testid={`five-s-result-action-${action.id}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <AppLink
                              href={`/platform/actions?action=${action.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {action.title}
                            </AppLink>
                            <Badge
                              variant={actionStatusBadgeVariant(action.status)}
                            >
                              {actionStatusLabel(action.status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {action.assigneeDisplayName
                              ? `Assignee: ${action.assigneeDisplayName}`
                              : "Unassigned"}
                            {action.dueAt
                              ? ` · Due ${formatDueDate(action.dueAt)}`
                              : ""}
                          </p>
                          {action.evidence.length > 0 ? (
                            <EvidenceGallery
                              items={action.evidence}
                              contextLabel={`${action.title} evidence`}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
