"use client";

import { useState } from "react";

import { saveFiveSAuditAnswer } from "@/app/(platform)/platform/5s/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { FiveSEvidenceBlock } from "@/components/five-s/five-s-evidence-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Section = {
  id: string;
  title: string;
  questions: Array<{
    id: string;
    prompt: string;
    question_type: string;
    is_required: boolean;
    allows_not_applicable: boolean;
    help_text: string | null;
  }>;
};

type AuditWorkspaceProps = {
  auditId: string;
  status: string;
  sections: Section[];
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
};

export function FiveSAuditWorkspace({
  auditId,
  status,
  sections,
  answers,
  evidence,
  canEdit,
}: AuditWorkspaceProps) {
  const flatQuestions = sections.flatMap((s) =>
    s.questions.map((q) => ({ section: s, question: q })),
  );
  const [index, setIndex] = useState(0);
  const current = flatQuestions[index];
  const progress = flatQuestions.length
    ? Math.round(((index + 1) / flatQuestions.length) * 100)
    : 0;

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">No questions configured.</p>
    );
  }

  const answer = answers[current.question.id] ?? {};

  async function saveField(payload: {
    isNotApplicable?: boolean;
    textValue?: string | null;
    numberValue?: number | null;
  }) {
    if (!canEdit || !current) return;
    await saveFiveSAuditAnswer(auditId, current.question.id, payload);
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
      <nav
        className="flex flex-wrap gap-2 lg:sticky lg:top-4 lg:flex-col lg:gap-1 lg:self-start"
        aria-label="Categories"
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className="min-h-11 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-surface lg:w-full"
            onClick={() => {
              const idx = flatQuestions.findIndex(
                (f) => f.section.id === section.id,
              );
              if (idx >= 0) setIndex(idx);
            }}
          >
            {section.title}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">{status}</Badge>
          <span className="text-sm text-muted-foreground">
            {current.section.title}
          </span>
          <Progress
            value={progress}
            className="h-2 w-full max-w-xs"
            aria-label="Audit progress"
          />
          <span className="text-sm text-muted-foreground">{progress}%</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
          <h2 className="typography-section-title">
            {current.question.prompt}
          </h2>
          {current.question.help_text ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {current.question.help_text}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-4">
            {current.question.question_type === "yes_no" ? (
              <div className="flex gap-3">
                {["yes", "no"].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="default"
                    variant={
                      answer.text_value === value ? "default" : "outline"
                    }
                    className="min-h-11 min-w-24"
                    disabled={!canEdit}
                    onClick={() => saveField({ textValue: value })}
                  >
                    {value === "yes" ? "Yes" : "No"}
                  </Button>
                ))}
              </div>
            ) : current.question.question_type === "score" ||
              current.question.question_type === "number" ||
              current.question.question_type === "percentage" ? (
              <div>
                <Label htmlFor="answer-number">Score</Label>
                <Input
                  id="answer-number"
                  type="number"
                  className="mt-2 min-h-11 max-w-xs text-lg"
                  value={answer.number_value ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    saveField({
                      numberValue: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="answer-text">Response</Label>
                <Textarea
                  id="answer-text"
                  className="mt-2 min-h-24"
                  value={answer.text_value ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => saveField({ textValue: e.target.value })}
                />
              </div>
            )}

            {current.question.allows_not_applicable ? (
              <Button
                type="button"
                variant={answer.is_not_applicable ? "secondary" : "outline"}
                className="min-h-11"
                disabled={!canEdit}
                onClick={() =>
                  saveField({
                    isNotApplicable: true,
                    textValue: null,
                    numberValue: null,
                  })
                }
              >
                N/A
              </Button>
            ) : null}
          </div>

          <FiveSEvidenceBlock
            auditId={auditId}
            sectionId={current.section.id}
            questionId={current.question.id}
            evidence={evidence}
            canEdit={canEdit}
          />
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-border bg-background py-4">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="min-h-11 flex-1"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="default"
            className="min-h-11 flex-1"
            disabled={index >= flatQuestions.length - 1}
            onClick={() =>
              setIndex((i) => Math.min(flatQuestions.length - 1, i + 1))
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
