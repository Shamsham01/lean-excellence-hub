"use client";

import { useState, type ReactNode } from "react";

import { saveAssessmentAnswer } from "@/app/(platform)/platform/maturity/actions";
import { EvidenceUploader } from "@/components/maturity/evidence-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { AssessmentStatusBadge } from "@/modules/maturity/status-badges";

type Question = {
  id: string;
  prompt: string;
  question_type: string;
  is_required: boolean;
  allows_not_applicable: boolean;
  help_text: string | null;
  options: unknown;
  contributes_to_score: boolean;
};

type Criterion = {
  id: string;
  name: string;
  description: string | null;
  guidance: string | null;
  questions: Question[];
};

type Pillar = {
  id: string;
  name: string;
  criteria: Criterion[];
};

type EvidenceItem = {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  question_id: string | null;
  criterion_id: string;
};

type AssessmentWorkspaceProps = {
  assessmentId: string;
  status: string;
  assessmentType: string;
  pillars: Pillar[];
  answers: Record<
    string,
    {
      text_value?: string | null;
      number_value?: number | null;
      is_not_applicable?: boolean;
    }
  >;
  evidence: EvidenceItem[];
  canEdit: boolean;
  actionSlot?: ReactNode;
};

export function AssessmentWorkspace({
  assessmentId,
  status,
  assessmentType,
  pillars,
  answers,
  evidence,
  canEdit,
  actionSlot,
}: AssessmentWorkspaceProps) {
  const flatCriteria = pillars.flatMap((p) =>
    p.criteria.map((c) => ({ pillar: p, criterion: c })),
  );
  const [index, setIndex] = useState(0);
  const current = flatCriteria[index];
  const progress = flatCriteria.length
    ? Math.round(((index + 1) / flatCriteria.length) * 100)
    : 0;

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">No criteria configured.</p>
    );
  }

  const { pillar, criterion } = current;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[12rem_1fr_16rem] lg:gap-8">
      <aside className="hidden flex-col gap-1 lg:flex">
        {pillars.map((p) => (
          <div key={p.id} className="mb-3">
            <p className="px-2 text-xs font-semibold text-muted-foreground uppercase">
              {p.name}
            </p>
            {p.criteria.map((c) => {
              const idx = flatCriteria.findIndex(
                (fc) => fc.criterion.id === c.id,
              );
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setIndex(idx)}
                  className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                    idx === index
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <AssessmentStatusBadge status={status} />
          <span className="text-sm text-muted-foreground capitalize">
            {assessmentType.replace("_", " ")}
          </span>
        </div>
        <Progress value={progress} aria-label="Assessment progress" />
        <div>
          <p className="typography-section-title">{pillar.name}</p>
          <h2 className="mt-1 text-lg font-semibold">{criterion.name}</h2>
          {criterion.description ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {criterion.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {criterion.questions.map((question) => {
            const answer = answers[question.id];
            return (
              <QuestionField
                key={question.id}
                assessmentId={assessmentId}
                criterionId={criterion.id}
                question={question}
                evidence={evidence}
                {...(answer ? { answer } : {})}
                canEdit={canEdit}
              />
            );
          })}
        </div>

        {actionSlot ? (
          <div className="max-w-lg rounded-lg border border-border bg-card p-4">
            {actionSlot}
          </div>
        ) : null}

        <div className="sticky bottom-4 flex gap-2 rounded-lg border border-border bg-background/95 p-2 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            disabled={index >= flatCriteria.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <aside className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-semibold">Guidance</p>
        <p className="mt-2 text-muted-foreground">
          {criterion.guidance ??
            "Review the criterion and provide evidence where required."}
        </p>
      </aside>
    </div>
  );
}

function QuestionField({
  assessmentId,
  criterionId,
  question,
  answer,
  evidence,
  canEdit,
}: {
  assessmentId: string;
  criterionId: string;
  question: Question;
  evidence: EvidenceItem[];
  answer?: {
    text_value?: string | null;
    number_value?: number | null;
    is_not_applicable?: boolean;
  };
  canEdit: boolean;
}) {
  const [saving, setSaving] = useState(false);

  async function save(payload: {
    textValue?: string | null;
    numberValue?: number | null;
    isNotApplicable?: boolean;
  }) {
    if (!canEdit) return;
    setSaving(true);
    await saveAssessmentAnswer(assessmentId, question.id, payload);
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Label className="text-sm font-medium">{question.prompt}</Label>
      {question.help_text ? (
        <p className="typography-helper mt-1">{question.help_text}</p>
      ) : null}

      {question.question_type === "score" ||
      question.question_type === "number" ? (
        <Input
          type="number"
          className="mt-3 max-w-[8rem]"
          disabled={!canEdit}
          value={answer?.number_value ?? ""}
          onChange={(e) =>
            save({
              numberValue: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      ) : question.question_type === "long_text" ? (
        <Textarea
          className="mt-3"
          disabled={!canEdit}
          value={answer?.text_value ?? ""}
          onChange={(e) => save({ textValue: e.target.value })}
        />
      ) : question.question_type === "yes_no" ? (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={answer?.text_value === "yes" ? "default" : "outline"}
            disabled={!canEdit}
            onClick={() => save({ textValue: "yes" })}
          >
            Yes
          </Button>
          <Button
            type="button"
            size="sm"
            variant={answer?.text_value === "no" ? "default" : "outline"}
            disabled={!canEdit}
            onClick={() => save({ textValue: "no" })}
          >
            No
          </Button>
        </div>
      ) : (
        <Input
          className="mt-3"
          disabled={!canEdit}
          value={answer?.text_value ?? ""}
          onChange={(e) => save({ textValue: e.target.value })}
        />
      )}

      {question.allows_not_applicable ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          disabled={!canEdit}
          onClick={() => save({ isNotApplicable: true })}
        >
          Mark N/A
        </Button>
      ) : null}

      {saving ? <p className="typography-caption mt-2">Saving…</p> : null}

      <EvidenceUploader
        assessmentId={assessmentId}
        criterionId={criterionId}
        questionId={question.id}
        existingEvidence={evidence}
        canEdit={canEdit}
      />
    </div>
  );
}
