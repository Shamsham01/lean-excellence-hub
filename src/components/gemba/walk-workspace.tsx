"use client";

import { useState } from "react";

import { saveGembaWalkAnswer } from "@/app/(platform)/platform/gemba/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { GembaEvidenceBlock } from "@/components/gemba/gemba-evidence-block";
import { Button } from "@/components/ui/button";
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
    help_text: string | null;
  }>;
};

type GembaWalkWorkspaceProps = {
  walkId: string;
  status: string;
  sections: Section[];
  answers: Record<string, { text_value?: string | null }>;
  evidence: EvidenceItem[];
  canEdit: boolean;
  onObservation?: (type: string) => void;
};

export function GembaWalkWorkspace({
  walkId,
  status,
  sections,
  answers,
  evidence,
  canEdit,
}: GembaWalkWorkspaceProps) {
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
      <p className="text-sm text-muted-foreground">No prompts configured.</p>
    );
  }

  const answer = answers[current.question.id] ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">{status}</Badge>
        <Progress
          value={progress}
          className="h-2 w-full max-w-xs"
          aria-label="Walk progress"
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">{current.section.title}</p>
        <h2 className="typography-section-title mt-2">
          {current.question.prompt}
        </h2>
        <div className="mt-6">
          <Label htmlFor="walk-notes">Notes</Label>
          <Textarea
            id="walk-notes"
            className="mt-2 min-h-24"
            value={answer.text_value ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              saveGembaWalkAnswer(walkId, current.question.id, {
                textValue: e.target.value,
              })
            }
          />
        </div>

        <GembaEvidenceBlock
          walkId={walkId}
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
  );
}
