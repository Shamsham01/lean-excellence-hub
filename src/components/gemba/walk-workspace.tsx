"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  completeGembaWalk,
  saveGembaWalkAnswer,
} from "@/app/(platform)/platform/gemba/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { GembaEvidenceBlock } from "@/components/gemba/gemba-evidence-block";
import {
  ANSWER_SAVE_ERROR_MESSAGE,
  COMPLETE_WALK_SAVE_ERROR_MESSAGE,
  useWalkAnswerState,
  type SaveStatus,
} from "@/components/gemba/walk-answer-state";
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
  canComplete?: boolean;
  onComplete?: typeof completeGembaWalk;
  onObservation?: (type: string) => void;
};

function AnswerSaveFeedback({
  status,
  error,
  canRetry,
  onRetry,
}: {
  status: SaveStatus;
  error: string | null;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex min-h-6 flex-wrap items-center gap-2"
      aria-live="polite"
      data-testid="answer-save-status"
    >
      {status === "saving" ? (
        <p className="text-sm text-muted-foreground">Saving…</p>
      ) : null}
      {status === "saved" ? (
        <p className="text-sm text-success">Saved</p>
      ) : null}
      {status === "error" ? (
        <>
          <p className="text-sm text-destructive" role="alert">
            {error ?? ANSWER_SAVE_ERROR_MESSAGE}
          </p>
          {canRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={onRetry}
              data-testid="answer-save-retry"
            >
              Retry
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function isCompleteSuccess(result: unknown) {
  if (!result || typeof result !== "object") return false;
  const record = result as { ok?: unknown; error?: unknown };
  return record.ok === true && record.error == null;
}

export function GembaWalkWorkspace({
  walkId,
  status,
  sections,
  answers,
  evidence,
  canEdit,
  canComplete = false,
  onComplete = completeGembaWalk,
}: GembaWalkWorkspaceProps) {
  const router = useRouter();
  const flatQuestions = sections.flatMap((s) =>
    s.questions.map((q) => ({ section: s, question: q })),
  );
  const [index, setIndex] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const current = flatQuestions[index];
  const progress = flatQuestions.length
    ? Math.round(((index + 1) / flatQuestions.length) * 100)
    : 0;
  const {
    getAnswer,
    getStatus,
    getError,
    isQuestionBusy,
    changeText,
    flushQuestion,
    flushAllQuestions,
    retryQuestion,
  } = useWalkAnswerState({
    walkId,
    answers,
    canEdit,
    saveAnswer: saveGembaWalkAnswer,
  });

  async function moveTo(nextIndex: number) {
    if (!current) return;
    if (nextIndex === index) return;
    setNavigating(true);
    try {
      const saved = await flushQuestion(current.question.id);
      if (!saved) return;
      setIndex(nextIndex);
    } finally {
      setNavigating(false);
    }
  }

  async function handleComplete() {
    if (!canComplete || completing) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const flushed = await flushAllQuestions(
        flatQuestions.map((item) => item.question.id),
      );
      if (!flushed) {
        setCompleteError(COMPLETE_WALK_SAVE_ERROR_MESSAGE);
        return;
      }
      const result = await onComplete(walkId);
      if (!isCompleteSuccess(result)) {
        const record = result as { error?: unknown } | null | undefined;
        setCompleteError(
          typeof record?.error === "string"
            ? record.error
            : "Couldn't complete this walk.",
        );
        return;
      }
      router.refresh();
    } catch (error) {
      setCompleteError(
        error instanceof Error ? error.message : "Couldn't complete this walk.",
      );
    } finally {
      setCompleting(false);
    }
  }

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">No prompts configured.</p>
    );
  }

  const answer = getAnswer(current.question.id);
  const saveStatus = getStatus(current.question.id);
  const saveError = getError(current.question.id);
  const questionBusy = navigating || isQuestionBusy(current.question.id);

  return (
    <div className="flex flex-col gap-6" data-testid="gemba-walk-workspace">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">{status}</Badge>
        <Progress
          value={progress}
          className="h-2 w-full max-w-xs"
          aria-label="Walk progress"
        />
        {canComplete ? (
          <Button
            type="button"
            className="min-h-11 sm:ml-auto"
            disabled={completing}
            onClick={() => {
              void handleComplete();
            }}
            data-testid="gemba-complete-walk"
          >
            {completing ? "Completing…" : "Complete walk"}
          </Button>
        ) : null}
      </div>
      {completeError ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="gemba-complete-error"
        >
          {completeError}
        </p>
      ) : null}

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
            data-testid="gemba-walk-notes"
            onChange={(e) => changeText(current.question.id, e.target.value)}
            onBlur={() => {
              void flushQuestion(current.question.id);
            }}
          />
        </div>
        <div className="mt-4">
          <AnswerSaveFeedback
            status={saveStatus}
            error={saveError}
            canRetry={canEdit}
            onRetry={() => retryQuestion(current.question.id)}
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
          disabled={index === 0 || questionBusy}
          onClick={() => moveTo(Math.max(0, index - 1))}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="default"
          className="min-h-11 flex-1"
          disabled={index >= flatQuestions.length - 1 || questionBusy}
          onClick={() => moveTo(Math.min(flatQuestions.length - 1, index + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
