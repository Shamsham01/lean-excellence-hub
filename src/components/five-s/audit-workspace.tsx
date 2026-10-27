"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  completeFiveSAudit,
  saveFiveSAuditAnswer,
} from "@/app/(platform)/platform/5s/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import {
  ANSWER_SAVE_ERROR_MESSAGE,
  COMPLETE_AUDIT_SAVE_ERROR_MESSAGE,
  useAuditAnswerState,
  type SaveStatus,
} from "@/components/five-s/audit-answer-state";
import { FiveSEvidenceBlock } from "@/components/five-s/five-s-evidence-block";
import { FiveSScoreControl } from "@/components/five-s/score-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  LEGACY_FIVE_S_SCORING_SCALE,
  scoreIsOnFiveSScale,
  type FiveSScoringScale,
} from "@/modules/5s/scoring-scale";

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
  canComplete?: boolean;
  scoringScale?: FiveSScoringScale;
  onComplete?: typeof completeFiveSAudit;
};

function AnswerSaveFeedback({
  status,
  error,
  canRetry,
  onRetry,
  suppressSaved = false,
}: {
  status: SaveStatus;
  error: string | null;
  canRetry: boolean;
  onRetry: () => void;
  suppressSaved?: boolean;
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
      {status === "saved" && !suppressSaved ? (
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

export function FiveSAuditWorkspace({
  auditId,
  status,
  sections,
  answers,
  evidence,
  canEdit,
  canComplete = false,
  scoringScale = LEGACY_FIVE_S_SCORING_SCALE,
  onComplete = completeFiveSAudit,
}: AuditWorkspaceProps) {
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
    getNumberDraft,
    isQuestionBusy,
    selectYesNo,
    selectNotApplicable,
    selectScore,
    changeText,
    changeNumber,
    flushQuestion,
    flushAllQuestions,
    retryQuestion,
    isScoreDraftInvalid,
  } = useAuditAnswerState({
    auditId,
    answers,
    canEdit,
    scoringScale,
    saveAnswer: saveFiveSAuditAnswer,
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
      const offScale = flatQuestions.some((item) => {
        const questionType = item.question.question_type;
        if (
          questionType !== "score" &&
          questionType !== "number" &&
          questionType !== "percentage"
        ) {
          return false;
        }
        const currentAnswer = getAnswer(item.question.id);
        if (currentAnswer.is_not_applicable) return false;
        if (isScoreDraftInvalid(item.question.id)) return true;
        return (
          currentAnswer.number_value != null &&
          !scoreIsOnFiveSScale(currentAnswer.number_value, scoringScale)
        );
      });
      if (offScale) {
        setCompleteError(
          "A score is outside the published scale. Choose a permitted value before completing.",
        );
        return;
      }
      const flushed = await flushAllQuestions(
        flatQuestions.map((item) => item.question.id),
      );
      if (!flushed) {
        setCompleteError(COMPLETE_AUDIT_SAVE_ERROR_MESSAGE);
        return;
      }
      const result = await onComplete(auditId);
      if (!isCompleteSuccess(result)) {
        const record = result as { error?: unknown } | null | undefined;
        setCompleteError(
          typeof record?.error === "string"
            ? record.error
            : "Couldn't complete this audit.",
        );
        return;
      }
      router.refresh();
    } catch (error) {
      setCompleteError(
        error instanceof Error
          ? error.message
          : "Couldn't complete this audit.",
      );
    } finally {
      setCompleting(false);
    }
  }

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">No questions configured.</p>
    );
  }

  const answer = getAnswer(current.question.id);
  const saveStatus = getStatus(current.question.id);
  const saveError = getError(current.question.id);
  const questionBusy = navigating || isQuestionBusy(current.question.id);
  const yesSelected = !answer.is_not_applicable && answer.text_value === "yes";
  const noSelected = !answer.is_not_applicable && answer.text_value === "no";
  const numericQuestion =
    current.question.question_type === "score" ||
    current.question.question_type === "number" ||
    current.question.question_type === "percentage";
  const draftInvalid = isScoreDraftInvalid(current.question.id);
  const storedOffScale =
    numericQuestion &&
    !answer.is_not_applicable &&
    !draftInvalid &&
    answer.number_value != null &&
    !scoreIsOnFiveSScale(answer.number_value, scoringScale);

  return (
    <div
      className="flex flex-col gap-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-8"
      data-testid="five-s-audit-workspace"
    >
      <nav
        className="flex flex-wrap gap-2 lg:sticky lg:top-4 lg:flex-col lg:gap-1 lg:self-start"
        aria-label="Categories"
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className="min-h-11 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-surface lg:w-full"
            disabled={questionBusy}
            onClick={() => {
              const idx = flatQuestions.findIndex(
                (f) => f.section.id === section.id,
              );
              if (idx >= 0) {
                return moveTo(idx);
              }
              return undefined;
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
          {canComplete ? (
            <Button
              type="button"
              className="min-h-11 sm:ml-auto"
              disabled={completing}
              onClick={() => {
                void handleComplete();
              }}
              data-testid="five-s-complete-audit"
            >
              {completing ? "Completing…" : "Complete audit"}
            </Button>
          ) : null}
        </div>
        {completeError ? (
          <p
            className="text-sm text-destructive"
            role="alert"
            data-testid="five-s-complete-error"
          >
            {completeError}
          </p>
        ) : null}

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
                {(["yes", "no"] as const).map((value) => {
                  const selected = value === "yes" ? yesSelected : noSelected;
                  return (
                    <Button
                      key={value}
                      type="button"
                      size="default"
                      variant={selected ? "default" : "outline"}
                      className="min-h-11 min-w-24"
                      disabled={!canEdit}
                      aria-pressed={selected}
                      onClick={() => selectYesNo(current.question.id, value)}
                    >
                      {value === "yes" ? "Yes" : "No"}
                    </Button>
                  );
                })}
              </div>
            ) : numericQuestion ? (
              <div>
                <FiveSScoreControl
                  questionId={current.question.id}
                  scale={scoringScale}
                  draft={getNumberDraft(current.question.id)}
                  selectedValue={
                    answer.is_not_applicable
                      ? null
                      : (answer.number_value ?? null)
                  }
                  disabled={!canEdit}
                  invalid={draftInvalid}
                  onDraftChange={(value) =>
                    changeNumber(current.question.id, value)
                  }
                  onSelect={(value) => selectScore(current.question.id, value)}
                  onBlur={() => {
                    void flushQuestion(current.question.id);
                  }}
                />
                {storedOffScale ? (
                  <p
                    className="mt-2 text-sm text-destructive"
                    role="alert"
                    data-testid="five-s-score-correction"
                  >
                    This saved score is outside the published scale. Choose a
                    permitted value. It stays unchanged until you do.
                  </p>
                ) : null}
              </div>
            ) : (
              <div>
                <Label htmlFor="answer-text">Response</Label>
                <Textarea
                  id="answer-text"
                  className="mt-2 min-h-24"
                  value={
                    answer.is_not_applicable ? "" : (answer.text_value ?? "")
                  }
                  disabled={!canEdit}
                  onChange={(e) =>
                    changeText(current.question.id, e.target.value)
                  }
                  onBlur={() => {
                    void flushQuestion(current.question.id);
                  }}
                />
              </div>
            )}

            {current.question.allows_not_applicable ? (
              <Button
                type="button"
                variant={answer.is_not_applicable ? "secondary" : "outline"}
                className="min-h-11"
                disabled={!canEdit}
                aria-pressed={Boolean(answer.is_not_applicable)}
                onClick={() => selectNotApplicable(current.question.id)}
              >
                N/A
              </Button>
            ) : null}

            <AnswerSaveFeedback
              status={saveStatus}
              error={saveError}
              canRetry={canEdit}
              suppressSaved={draftInvalid || storedOffScale}
              onRetry={() => retryQuestion(current.question.id)}
            />
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
            onClick={() =>
              moveTo(Math.min(flatQuestions.length - 1, index + 1))
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
