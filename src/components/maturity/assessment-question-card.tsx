"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  saveAssessmentAnswer,
  saveQuestionNote,
} from "@/app/(platform)/platform/maturity/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { EvidenceUploader } from "@/components/maturity/evidence-uploader";
import {
  SaveStatus,
  type FieldSaveState,
} from "@/components/maturity/save-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AssessmentAnswer,
  AssessmentLevel,
  AssessmentQuestion,
} from "@/modules/maturity/assessment-workspace-types";

type QuestionCardProps = {
  assessmentId: string;
  criterionId: string;
  question: AssessmentQuestion;
  answer?: AssessmentAnswer;
  comment: string;
  evidence: EvidenceItem[];
  levels: AssessmentLevel[];
  canEdit: boolean;
  highlight?: boolean;
  trackSave: <T>(promise: Promise<T>) => Promise<T>;
  registerFlush?: (flush: () => Promise<void>) => () => void;
  onAnswerChange: (questionId: string, answer: AssessmentAnswer) => void;
  onCommentChange: (questionId: string, comment: string) => void;
};

export function QuestionCard({
  assessmentId,
  criterionId,
  question,
  answer,
  comment,
  evidence,
  levels,
  canEdit,
  highlight = false,
  trackSave,
  registerFlush,
  onAnswerChange,
  onCommentChange,
}: QuestionCardProps) {
  const [answerState, setAnswerState] = useState<FieldSaveState>("idle");
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [commentState, setCommentState] = useState<FieldSaveState>("idle");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [numberValue, setNumberValue] = useState(
    answer?.number_value != null ? String(answer.number_value) : "",
  );
  const [textValue, setTextValue] = useState(answer?.text_value ?? "");
  const [commentValue, setCommentValue] = useState(comment);
  const commentTimer = useRef<number | null>(null);
  const commentValueRef = useRef(comment);
  const pendingCommentRef = useRef(false);
  const useLevelChoices =
    question.question_type === "score" && levels.length > 0;
  const selectedLevel =
    answer?.number_value != null
      ? levels.find(
          (level) =>
            level.level_number === Math.round(Number(answer.number_value)),
        )
      : null;

  const persistAnswer = useCallback(
    async (payload: {
      textValue?: string | null;
      numberValue?: number | null;
      isNotApplicable?: boolean;
    }) => {
      if (!canEdit) return;
      onAnswerChange(question.id, {
        text_value: payload.textValue ?? null,
        number_value: payload.numberValue ?? null,
        is_not_applicable: payload.isNotApplicable ?? false,
      });
      setAnswerState("saving");
      setAnswerError(null);
      const result = await trackSave(
        saveAssessmentAnswer(assessmentId, question.id, payload),
      );
      if (result.error) {
        setAnswerState("error");
        setAnswerError(result.error);
        return;
      }
      setAnswerState("saved");
      window.setTimeout(() => setAnswerState("idle"), 2000);
    },
    [assessmentId, canEdit, onAnswerChange, question.id, trackSave],
  );

  const persistComment = useCallback(
    async (value: string) => {
      if (!canEdit) return;
      const trimmed = value.trim();
      if (!trimmed) {
        pendingCommentRef.current = false;
        return;
      }
      pendingCommentRef.current = false;
      setCommentState("saving");
      setCommentError(null);
      const result = await trackSave(
        saveQuestionNote(assessmentId, question.id, trimmed),
      );
      if (result.error) {
        pendingCommentRef.current = true;
        setCommentState("error");
        setCommentError(result.error);
        return;
      }
      onCommentChange(question.id, trimmed);
      setCommentState("saved");
      window.setTimeout(() => setCommentState("idle"), 2000);
    },
    [assessmentId, canEdit, onCommentChange, question.id, trackSave],
  );

  useEffect(() => {
    if (!registerFlush) {
      return;
    }
    return registerFlush(async () => {
      if (commentTimer.current) {
        window.clearTimeout(commentTimer.current);
        commentTimer.current = null;
      }
      if (pendingCommentRef.current) {
        await persistComment(commentValueRef.current);
      }
    });
  }, [persistComment, registerFlush]);

  function scheduleCommentSave(value: string) {
    commentValueRef.current = value;
    pendingCommentRef.current = true;
    onCommentChange(question.id, value);
    if (commentTimer.current) {
      window.clearTimeout(commentTimer.current);
    }
    commentTimer.current = window.setTimeout(() => {
      void persistComment(value);
    }, 600);
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
        highlight && "ring-2 ring-primary",
      )}
      data-testid={`question-card-${question.id}`}
      data-question-id={question.id}
    >
      <div>
        <Label className="text-sm font-medium">{question.prompt}</Label>
        {question.help_text ? (
          <p className="typography-helper mt-1">{question.help_text}</p>
        ) : null}
      </div>

      {useLevelChoices ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {levels.map((level) => {
            const selected =
              !answer?.is_not_applicable &&
              answer?.number_value != null &&
              Math.round(Number(answer.number_value)) === level.level_number;
            return (
              <Button
                key={level.level_number}
                type="button"
                variant={selected ? "default" : "outline"}
                className="min-h-11 justify-start sm:min-w-[10rem]"
                disabled={!canEdit}
                data-testid="level-choice"
                data-level-number={level.level_number}
                data-selected={selected ? "true" : "false"}
                onClick={() => {
                  setNumberValue(String(level.level_number));
                  void persistAnswer({ numberValue: level.level_number });
                }}
              >
                {level.level_number} {level.name}
              </Button>
            );
          })}
        </div>
      ) : question.question_type === "score" ||
        question.question_type === "number" ? (
        <Input
          type="number"
          className="mt-1 max-w-[8rem]"
          disabled={!canEdit}
          value={numberValue}
          onChange={(event) => setNumberValue(event.target.value)}
          onBlur={() => {
            void persistAnswer({
              numberValue: numberValue ? Number(numberValue) : null,
            });
          }}
        />
      ) : question.question_type === "long_text" ? (
        <Textarea
          disabled={!canEdit}
          value={textValue}
          onChange={(event) => setTextValue(event.target.value)}
          onBlur={() => {
            void persistAnswer({ textValue });
          }}
        />
      ) : question.question_type === "yes_no" ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={answer?.text_value === "yes" ? "default" : "outline"}
            disabled={!canEdit}
            onClick={() => void persistAnswer({ textValue: "yes" })}
          >
            Yes
          </Button>
          <Button
            type="button"
            size="sm"
            variant={answer?.text_value === "no" ? "default" : "outline"}
            disabled={!canEdit}
            onClick={() => void persistAnswer({ textValue: "no" })}
          >
            No
          </Button>
        </div>
      ) : (
        <Input
          disabled={!canEdit}
          value={textValue}
          onChange={(event) => setTextValue(event.target.value)}
          onBlur={() => {
            void persistAnswer({ textValue });
          }}
        />
      )}

      {question.allows_not_applicable ? (
        <Button
          type="button"
          variant={answer?.is_not_applicable ? "default" : "ghost"}
          size="sm"
          disabled={!canEdit}
          data-testid="mark-not-applicable"
          onClick={() => void persistAnswer({ isNotApplicable: true })}
        >
          Mark N/A
        </Button>
      ) : null}

      {selectedLevel?.guidance ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="selected-level-guidance"
        >
          {selectedLevel.name}: {selectedLevel.guidance}
        </p>
      ) : null}

      <SaveStatus
        state={answerState}
        error={answerError}
        onRetry={() => {
          if (useLevelChoices && numberValue) {
            void persistAnswer({ numberValue: Number(numberValue) });
            return;
          }
          if (
            question.question_type === "score" ||
            question.question_type === "number"
          ) {
            void persistAnswer({
              numberValue: numberValue ? Number(numberValue) : null,
            });
            return;
          }
          void persistAnswer({ textValue });
        }}
      />

      <div>
        <Label htmlFor={`question-note-${question.id}`}>Question comment</Label>
        <Textarea
          id={`question-note-${question.id}`}
          className="mt-2"
          rows={3}
          disabled={!canEdit}
          value={commentValue}
          onChange={(event) => {
            setCommentValue(event.target.value);
            scheduleCommentSave(event.target.value);
          }}
          onBlur={() => void persistComment(commentValue)}
          data-testid="question-comment"
          placeholder="Observation, evidence narrative, or scoring rationale for this question."
        />
        <SaveStatus
          state={commentState}
          error={commentError}
          onRetry={() => void persistComment(commentValue)}
        />
      </div>

      <EvidenceUploader
        assessmentId={assessmentId}
        criterionId={criterionId}
        questionId={question.id}
        existingEvidence={evidence}
        canEdit={canEdit}
      />
    </article>
  );
}
