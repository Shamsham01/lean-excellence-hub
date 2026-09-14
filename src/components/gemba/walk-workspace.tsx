"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  completeGembaWalk,
  saveGembaWalkAnswer,
} from "@/app/(platform)/platform/gemba/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { GembaEvidenceBlock } from "@/components/gemba/gemba-evidence-block";
import {
  GembaObservationPanel,
  type ObservationIntegrity,
  type WalkObservation,
} from "@/components/gemba/observation-panel";
import {
  ANSWER_SAVE_ERROR_MESSAGE,
  COMPLETE_WALK_SAVE_ERROR_MESSAGE,
  useWalkAnswerState,
  type SaveStatus,
} from "@/components/gemba/walk-answer-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  countGembaObservationsByType,
  formatGembaObservationType,
  formatGembaWalkStatus,
} from "@/modules/operational/gemba-display";
import {
  buildGembaWalkPromptSearch,
  clearStoredGembaWalkPromptId,
  readGembaWalkPromptIdFromSearch,
  readStoredGembaWalkPromptId,
  resolveGembaWalkPromptIndex,
  subscribeGembaWalkPromptLocation,
  writeStoredGembaWalkPromptId,
} from "@/modules/operational/gemba-walk-prompt";

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
  observations?: WalkObservation[];
  canEdit: boolean;
  canComplete?: boolean;
  initialPromptId?: string | null;
  onComplete?: typeof completeGembaWalk;
};

export const DIRTY_OBSERVATION_COMPLETE_MESSAGE =
  "Save or discard the observation you are editing before completing this walk.";

export const OBSERVATION_SAVE_COMPLETE_ERROR_MESSAGE =
  "Couldn't save all observations. Fix the error and try again.";

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

function waitForObservationIdle(
  getIntegrity: () => ObservationIntegrity,
  timeoutMs = 8_000,
) {
  const current = getIntegrity();
  if (!current.busy) {
    return Promise.resolve(!current.error);
  }

  return new Promise<boolean>((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const integrity = getIntegrity();
      if (!integrity.busy || Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(!integrity.busy && !integrity.error);
      }
    }, 20);
  });
}

export function GembaWalkWorkspace({
  walkId,
  status,
  sections,
  answers,
  evidence,
  observations = [],
  canEdit,
  canComplete = false,
  initialPromptId = null,
  onComplete = completeGembaWalk,
}: GembaWalkWorkspaceProps) {
  const router = useRouter();
  const flatQuestions = sections.flatMap((s) =>
    s.questions.map((q) => ({ section: s, question: q })),
  );
  const questionIds = useMemo(
    () => sections.flatMap((section) => section.questions.map((q) => q.id)),
    [sections],
  );
  const restoredPromptId = useSyncExternalStore(
    subscribeGembaWalkPromptLocation,
    () =>
      readGembaWalkPromptIdFromSearch(window.location.search) ??
      readStoredGembaWalkPromptId(walkId),
    () => initialPromptId,
  );
  const restoredIndex = resolveGembaWalkPromptIndex({
    questionIds,
    preferredQuestionId: restoredPromptId ?? initialPromptId,
    storedQuestionId: restoredPromptId,
  });
  const [userIndex, setUserIndex] = useState<number | null>(null);
  const [indexWalkId, setIndexWalkId] = useState(walkId);
  if (indexWalkId !== walkId) {
    setIndexWalkId(walkId);
    setUserIndex(null);
  }
  const [navigating, setNavigating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [completeError, setCompleteError] = useState<string | null>(null);
  const observationIntegrityRef = useRef<ObservationIntegrity>({
    dirty: false,
    busy: false,
    error: false,
  });
  const handleObservationIntegrity = useCallback(
    (next: ObservationIntegrity) => {
      observationIntegrityRef.current = next;
    },
    [],
  );
  const index = userIndex ?? restoredIndex;
  const safeIndex =
    flatQuestions.length === 0
      ? 0
      : Math.min(Math.max(index, 0), flatQuestions.length - 1);
  const current = flatQuestions[safeIndex];
  const progress = flatQuestions.length
    ? Math.round(((safeIndex + 1) / flatQuestions.length) * 100)
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

  useEffect(() => {
    const questionId = flatQuestions[safeIndex]?.question.id;
    if (!questionId || status !== "in_progress") return;
    writeStoredGembaWalkPromptId(walkId, questionId);
    const nextSearch = buildGembaWalkPromptSearch(questionId);
    if (window.location.search !== nextSearch) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextSearch}`,
      );
    }
  }, [flatQuestions, safeIndex, status, walkId]);

  async function moveTo(nextIndex: number) {
    if (!current) return;
    if (nextIndex === safeIndex) return;
    setNavigating(true);
    try {
      const saved = await flushQuestion(current.question.id);
      if (!saved) return;
      setUserIndex(nextIndex);
    } finally {
      setNavigating(false);
    }
  }

  function openCompletePanel() {
    if (!canComplete || completing) return;
    setCompleteError(null);
    if (observationIntegrityRef.current.dirty) {
      setCompleteError(DIRTY_OBSERVATION_COMPLETE_MESSAGE);
      return;
    }
    if (observationIntegrityRef.current.error) {
      setCompleteError(OBSERVATION_SAVE_COMPLETE_ERROR_MESSAGE);
      return;
    }
    setCompleteOpen(true);
  }

  async function handleConfirmComplete() {
    if (!canComplete || completing) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      if (observationIntegrityRef.current.dirty) {
        setCompleteError(DIRTY_OBSERVATION_COMPLETE_MESSAGE);
        setCompleteOpen(false);
        return;
      }
      let observationIdle =
        !observationIntegrityRef.current.busy &&
        !observationIntegrityRef.current.error;
      if (observationIntegrityRef.current.busy) {
        observationIdle = await waitForObservationIdle(
          () => observationIntegrityRef.current,
        );
      }
      if (!observationIdle || observationIntegrityRef.current.error) {
        setCompleteError(OBSERVATION_SAVE_COMPLETE_ERROR_MESSAGE);
        setCompleteOpen(false);
        return;
      }
      const flushed = await flushAllQuestions(
        flatQuestions.map((item) => item.question.id),
      );
      if (!flushed) {
        setCompleteError(COMPLETE_WALK_SAVE_ERROR_MESSAGE);
        setCompleteOpen(false);
        return;
      }
      const trimmedSummary = summary.trim();
      const result = trimmedSummary
        ? await onComplete(walkId, trimmedSummary)
        : await onComplete(walkId);
      if (!isCompleteSuccess(result)) {
        const record = result as { error?: unknown } | null | undefined;
        setCompleteError(
          typeof record?.error === "string"
            ? record.error
            : "Couldn't complete this walk.",
        );
        setCompleteOpen(false);
        return;
      }
      clearStoredGembaWalkPromptId(walkId);
      setCompleteOpen(false);
      router.refresh();
    } catch (error) {
      setCompleteError(
        error instanceof Error ? error.message : "Couldn't complete this walk.",
      );
      setCompleteOpen(false);
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
  const answeredCount = questionIds.filter((questionId) =>
    Boolean(getAnswer(questionId).text_value?.trim()),
  ).length;
  const observationCounts = countGembaObservationsByType(observations);

  return (
    <div className="flex flex-col gap-6" data-testid="gemba-walk-workspace">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" data-testid="gemba-walk-status">
          {formatGembaWalkStatus(status)}
        </Badge>
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
            onClick={openCompletePanel}
            data-testid="gemba-complete-walk"
          >
            Complete walk
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

      <GembaObservationPanel
        walkId={walkId}
        observations={observations}
        evidence={evidence}
        canEdit={canEdit}
        onIntegrityChange={handleObservationIntegrity}
      />

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
          disabled={safeIndex === 0 || questionBusy}
          onClick={() => moveTo(Math.max(0, safeIndex - 1))}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="default"
          className="min-h-11 flex-1"
          disabled={safeIndex >= flatQuestions.length - 1 || questionBusy}
          onClick={() =>
            moveTo(Math.min(flatQuestions.length - 1, safeIndex + 1))
          }
        >
          Next
        </Button>
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete this walk?</DialogTitle>
            <DialogDescription>
              Review the walk, add an optional summary, then confirm. Completed
              walks cannot be edited.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Answered prompts: {answeredCount} of {questionIds.length}
            </p>
            <p>
              Observations: {observations.length} (
              {formatGembaObservationType("positive_practice")}{" "}
              {observationCounts.positive_practice},{" "}
              {formatGembaObservationType("improvement_opportunity")}{" "}
              {observationCounts.improvement_opportunity},{" "}
              {formatGembaObservationType("issue")} {observationCounts.issue})
            </p>
            <div>
              <Label htmlFor="gemba-summary-notes">
                Summary / overall conclusion
              </Label>
              <Textarea
                id="gemba-summary-notes"
                className="mt-2 min-h-24"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                data-testid="gemba-summary-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={completing}
              onClick={() => setCompleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={completing}
              onClick={() => {
                void handleConfirmComplete();
              }}
              data-testid="gemba-confirm-complete"
            >
              {completing ? "Completing…" : "Confirm completion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
