import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatGembaObservationType,
  formatGembaWalkStatus,
} from "@/modules/operational/gemba-display";

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

type WalkObservation = {
  id: string;
  observation_text: string;
  observation_type: string;
};

export function GembaWalkSummary({
  definitionName,
  unitName,
  status,
  completedAt,
  summaryNotes,
  sections,
  answers,
  observations,
  evidence,
}: {
  definitionName: string;
  unitName: string | null;
  status: string;
  completedAt: string | null;
  summaryNotes: string | null;
  sections: Section[];
  answers: Record<
    string,
    { text_value?: string | null; is_not_applicable?: boolean }
  >;
  observations: WalkObservation[];
  evidence: EvidenceItem[];
}) {
  const evidenceByObservation = new Map<string, EvidenceItem[]>();
  const evidenceByQuestion = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    if (item.observation_id) {
      const current = evidenceByObservation.get(item.observation_id) ?? [];
      current.push(item);
      evidenceByObservation.set(item.observation_id, current);
    }
    if (item.question_id) {
      const current = evidenceByQuestion.get(item.question_id) ?? [];
      current.push(item);
      evidenceByQuestion.set(item.question_id, current);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="gemba-walk-summary">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success" data-testid="gemba-walk-status">
          {formatGembaWalkStatus(status)}
        </Badge>
        {completedAt ? (
          <p className="text-sm text-muted-foreground">
            Completed {new Date(completedAt).toLocaleDateString("en-GB")}
          </p>
        ) : null}
      </div>
      <p
        className="text-sm text-muted-foreground"
        data-testid="gemba-walk-unit"
      >
        {unitName}
      </p>
      <p className="font-medium">{definitionName}</p>

      {summaryNotes ? (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="whitespace-pre-wrap"
              data-testid="gemba-summary-notes"
            >
              {summaryNotes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Observations</CardTitle>
        </CardHeader>
        <CardContent>
          {observations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No observations recorded.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {observations.map((observation) => {
                const linkedEvidence =
                  evidenceByObservation.get(observation.id) ?? [];
                return (
                  <li
                    key={observation.id}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <Badge variant="outline">
                      {formatGembaObservationType(observation.observation_type)}
                    </Badge>
                    <p className="mt-2 text-sm whitespace-pre-wrap">
                      {observation.observation_text}
                    </p>
                    {linkedEvidence.length > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Evidence:{" "}
                        {linkedEvidence.map((item) => item.filename).join(", ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Answers</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sections.flatMap((section) =>
            section.questions.map((question) => {
              const answer = answers[question.id];
              const display = answer?.is_not_applicable
                ? "Not applicable."
                : answer?.text_value?.trim() || "No notes recorded.";
              const linkedEvidence = evidenceByQuestion.get(question.id) ?? [];
              return (
                <div key={question.id} className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    {section.title}
                  </p>
                  <p className="font-medium">{question.prompt}</p>
                  <p className="text-sm">{display}</p>
                  {linkedEvidence.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Evidence:{" "}
                      {linkedEvidence.map((item) => item.filename).join(", ")}
                    </p>
                  ) : null}
                </div>
              );
            }),
          )}
        </CardContent>
      </Card>
    </div>
  );
}
