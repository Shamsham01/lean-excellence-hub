"use client";

import {
  unstable_rethrow,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { InlineAlert } from "@/components/ui/alert";

import {
  completeGembaWalk,
  saveGembaWalkAnswer,
  savePromptCapture,
} from "@/app/(platform)/platform/gemba/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { GembaAuditRaiseAction } from "@/components/gemba/gemba-audit-raise-action";
import { GembaEvidenceBlock } from "@/components/gemba/gemba-evidence-block";
import {
  GembaObservationPanel,
  type ObservationIntegrity,
  type WalkObservation,
} from "@/components/gemba/observation-panel";
import {
  ANSWER_SAVE_ERROR_MESSAGE,
  COMPLETE_WALK_SAVE_ERROR_MESSAGE,
  REQUIRED_PROMPTS_INCOMPLETE_MESSAGE,
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
import { SectionProgressNav } from "@/components/ui/section-progress-nav";
import { Textarea } from "@/components/ui/textarea";
import { answerProgressPercent } from "@/modules/operational/answer-progress-percent";
import { deriveSectionCompletionState } from "@/modules/operational/section-visual-state";
import {
  countGembaObservationsByType,
  formatGembaObservationType,
  formatGembaWalkStatus,
  gembaObservationTypeOptions,
} from "@/modules/operational/gemba-display";
import {
  countUnansweredRequiredGembaPrompts,
  hasUsableGembaPromptAnswer,
} from "@/modules/operational/gemba-walk-completion";
import type {
  ProjectLinkSummary,
  ProjectSelectorOption,
} from "@/lib/projects/types";
import {
  buildGembaWalkPromptSearch,
  clearStoredGembaWalkPromptId,
  GEMBA_WALK_PROMPT_PARAM,
  gembaWalkPath,
  readGembaWalkPromptIdFromSearch,
  readStoredGembaWalkPromptId,
  resolveActiveGembaWalkPromptIndex,
  resolveGembaWalkPromptId,
  subscribeGembaWalkPromptLocation,
  writeStoredGembaWalkPromptId,
} from "@/modules/operational/gemba-walk-prompt";

function readPromptIdFromWindowLocation() {
  if (typeof window === "undefined") return null;
  return readGembaWalkPromptIdFromSearch(window.location.search);
}

type Section = {
  id: string;
  title: string;
  questions: Array<{
    id: string;
    prompt: string;
    question_type: string;
    help_text: string | null;
    is_required: boolean;
    allows_not_applicable: boolean;
  }>;
};

type GembaWalkWorkspaceProps = {
  walkId: string;
  siteUnitId?: string | null;
  status: string;
  sections: Section[];
  answers: Record<
    string,
    { text_value?: string | null; is_not_applicable?: boolean }
  >;
  evidence: EvidenceItem[];
  observations?: WalkObservation[];
  canEdit: boolean;
  canComplete?: boolean;
  initialPromptId?: string | null;
  onComplete?: typeof completeGembaWalk;
  projectOptions?: ProjectSelectorOption[];
  requiresSiteSelection?: boolean;
  linkedProjectsByObservationId?: Record<string, ProjectLinkSummary | null>;
  actionCountsByObservation?: Record<string, number>;
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
          <InlineAlert tone="error">
            {error ?? ANSWER_SAVE_ERROR_MESSAGE}
          </InlineAlert>
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
  siteUnitId = null,
  status,
  sections,
  answers,
  evidence,
  observations = [],
  canEdit,
  canComplete = false,
  initialPromptId = null,
  onComplete = completeGembaWalk,
  projectOptions = [],
  requiresSiteSelection = false,
  linkedProjectsByObservationId = {},
  actionCountsByObservation = {},
}: GembaWalkWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const promptFromRouter =
    searchParams.get(GEMBA_WALK_PROMPT_PARAM)?.trim() ?? null;
  const promptFromWindow = useSyncExternalStore(
    subscribeGembaWalkPromptLocation,
    readPromptIdFromWindowLocation,
    () => null,
  );
  const urlPromptId = resolveGembaWalkPromptId({
    windowPromptId: promptFromWindow,
    routerPromptId: promptFromRouter,
  });
  const flatQuestions = sections.flatMap((s) =>
    s.questions.map((q) => ({ section: s, question: q })),
  );
  const questionIds = useMemo(
    () => sections.flatMap((section) => section.questions.map((q) => q.id)),
    [sections],
  );
  const storedPromptId = readStoredGembaWalkPromptId(walkId);
  const promptIndex = resolveActiveGembaWalkPromptIndex({
    questionIds,
    urlPromptId,
    initialPromptId,
    storedPromptId,
  });
  const urlCanonicalizedWalkIdRef = useRef<string | null>(null);
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
  const [types, setTypes] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      observations
        .filter((o) => o.question_id && o.question_id === o.client_request_id)
        .map((o) => [o.question_id!, o.observation_type]),
    ),
  );
  const [primaryIds, setPrimaryIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      observations
        .filter((o) => o.question_id && o.question_id === o.client_request_id)
        .map((o) => [o.question_id!, o.id]),
    ),
  );
  const [typeBusy, setTypeBusy] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [liveObservations, setLiveObservations] = useState(observations);
  const handleObservationsChange = useCallback((next: WalkObservation[]) => {
    setLiveObservations(next);
  }, []);
  const safeIndex =
    flatQuestions.length === 0
      ? 0
      : Math.min(Math.max(promptIndex, 0), flatQuestions.length - 1);
  const current = flatQuestions[safeIndex];
  const {
    getAnswer,
    getStatus,
    getError,
    isQuestionBusy,
    changeText,
    selectNotApplicable,
    flushQuestion,
    flushAllQuestions,
    retryQuestion,
  } = useWalkAnswerState({
    walkId,
    answers,
    canEdit,
    saveAnswer: async (id, questionId, payload) => {
      if (!types[questionId] && !primaryIds[questionId])
        return saveGembaWalkAnswer(id, questionId, payload);
      const result = await savePromptCapture(
        id,
        questionId,
        payload.textValue ?? "",
        !!payload.isNotApplicable,
        types[questionId] ?? null,
      );
      if (result.observationId)
        setPrimaryIds((previous) => ({
          ...previous,
          [questionId]: result.observationId!,
        }));
      return result;
    },
  });

  const answeredCount = flatQuestions.filter((item) =>
    hasUsableGembaPromptAnswer(item.question, getAnswer(item.question.id)),
  ).length;
  const requiredQuestions = flatQuestions.filter(
    (item) => item.question.is_required,
  );
  const answeredRequiredCount = requiredQuestions.filter((item) =>
    hasUsableGembaPromptAnswer(item.question, getAnswer(item.question.id)),
  ).length;
  const progress = requiredQuestions.length
    ? answerProgressPercent(answeredRequiredCount, requiredQuestions.length)
    : answerProgressPercent(answeredCount, flatQuestions.length);
  const sectionNavItems = useMemo(
    () =>
      sections.map((section) => {
        const questions = section.questions;
        const answered = questions.filter((question) =>
          hasUsableGembaPromptAnswer(question, getAnswer(question.id)),
        ).length;
        return {
          id: section.id,
          label: section.title,
          completion: deriveSectionCompletionState(answered, questions.length),
          detail: `${answered}/${questions.length}`,
        };
      }),
    [getAnswer, sections],
  );

  const syncPromptLocation = useCallback(
    (questionId: string, mode: "push" | "replace" = "replace") => {
      writeStoredGembaWalkPromptId(walkId, questionId);
      const nextPath = `${pathname}${buildGembaWalkPromptSearch(questionId)}`;
      const currentPath = `${pathname}${window.location.search}`;
      if (currentPath === nextPath) return;
      const navigate = mode === "push" ? router.push : router.replace;
      navigate(nextPath, { scroll: false });
    },
    [pathname, router, walkId],
  );

  useEffect(() => {
    if (status !== "in_progress" || completing) return;

    const windowPrompt = readPromptIdFromWindowLocation();
    if (windowPrompt) {
      writeStoredGembaWalkPromptId(walkId, windowPrompt);
      if (urlCanonicalizedWalkIdRef.current !== walkId) {
        urlCanonicalizedWalkIdRef.current = walkId;
      }
      return;
    }

    if (urlCanonicalizedWalkIdRef.current === walkId) {
      return;
    }

    const bootstrapIndex = resolveActiveGembaWalkPromptIndex({
      questionIds,
      urlPromptId: null,
      initialPromptId,
      storedPromptId: null,
    });
    const questionId = flatQuestions[bootstrapIndex]?.question.id;
    if (!questionId) return;
    syncPromptLocation(questionId, "replace");
    urlCanonicalizedWalkIdRef.current = walkId;
  }, [
    completing,
    flatQuestions,
    initialPromptId,
    questionIds,
    status,
    syncPromptLocation,
    walkId,
  ]);

  useEffect(() => {
    const viewport = document.querySelector(
      ".platform-main-viewport",
    ) as HTMLElement | null;
    if (viewport) {
      viewport.scrollTop = 0;
    }
  }, [safeIndex]);

  useEffect(() => {
    if (status !== "in_progress" || completing) return;

    const syncRouterToHistory = () => {
      const windowPrompt = readPromptIdFromWindowLocation();
      if (!windowPrompt) return;
      const routerPrompt =
        searchParams.get(GEMBA_WALK_PROMPT_PARAM)?.trim() ?? null;
      if (windowPrompt === routerPrompt) return;
      writeStoredGembaWalkPromptId(walkId, windowPrompt);
      router.replace(`${pathname}${buildGembaWalkPromptSearch(windowPrompt)}`, {
        scroll: false,
      });
    };

    window.addEventListener("popstate", syncRouterToHistory);
    return () => window.removeEventListener("popstate", syncRouterToHistory);
  }, [completing, pathname, router, searchParams, status, walkId]);

  async function moveTo(nextIndex: number) {
    if (!current) return;
    if (nextIndex === safeIndex || typeBusy) return;
    if (
      observationIntegrityRef.current.dirty ||
      observationIntegrityRef.current.busy
    ) {
      setCompleteError(DIRTY_OBSERVATION_COMPLETE_MESSAGE);
      return;
    }
    const target = flatQuestions[nextIndex];
    if (!target) return;
    setNavigating(true);
    try {
      const saved = await flushQuestion(current.question.id);
      if (!saved) return;
      syncPromptLocation(target.question.id, "push");
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
    let shouldUnlock = true;
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
      const unansweredRequired = countUnansweredRequiredGembaPrompts(
        flatQuestions.map((item) => item.question),
        getAnswer,
      );
      if (unansweredRequired > 0) {
        setCompleteError(REQUIRED_PROMPTS_INCOMPLETE_MESSAGE);
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
      if (
        countUnansweredRequiredGembaPrompts(
          flatQuestions.map((item) => item.question),
          getAnswer,
        ) > 0
      ) {
        setCompleteError(REQUIRED_PROMPTS_INCOMPLETE_MESSAGE);
        return;
      }
      const trimmedSummary = summary.trim();
      clearStoredGembaWalkPromptId(walkId);
      shouldUnlock = false;
      const result = trimmedSummary
        ? await onComplete(walkId, trimmedSummary)
        : await onComplete(walkId);
      if (!isCompleteSuccess(result)) {
        shouldUnlock = true;
        const record = result as { error?: unknown } | null | undefined;
        setCompleteError(
          typeof record?.error === "string"
            ? record.error
            : "Couldn't complete this walk.",
        );
        setCompleteOpen(false);
        return;
      }
      setCompleteOpen(false);
      router.replace(gembaWalkPath(walkId));
    } catch (error) {
      unstable_rethrow(error);
      shouldUnlock = true;
      setCompleteError(
        error instanceof Error ? error.message : "Couldn't complete this walk.",
      );
      setCompleteOpen(false);
    } finally {
      if (shouldUnlock) {
        setCompleting(false);
      }
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
  const unansweredRequiredCount = countUnansweredRequiredGembaPrompts(
    flatQuestions.map((item) => item.question),
    getAnswer,
  );
  const summaryObservations = [
    ...liveObservations.filter(
      (item) =>
        !item.question_id || item.client_request_id !== item.question_id,
    ),
    ...Object.keys(primaryIds).map((questionId) => ({
      observation_type: types[questionId] ?? null,
    })),
  ];
  const observationCounts = countGembaObservationsByType(summaryObservations);

  return (
    <div
      className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8"
      data-testid="gemba-walk-workspace"
    >
      <SectionProgressNav
        ariaLabel="Walk sections"
        items={sectionNavItems}
        activeId={current.section.id}
        disabled={questionBusy}
        onSelect={(sectionId) => {
          const idx = flatQuestions.findIndex(
            (f) => f.section.id === sectionId,
          );
          if (idx >= 0) {
            void moveTo(idx);
          }
        }}
        testId="gemba-section-nav"
        testIdPrefix="gemba-section"
        className="lg:sticky lg:top-4 lg:self-start"
      />

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" data-testid="gemba-walk-status">
            {formatGembaWalkStatus(status)}
          </Badge>
          <Progress
            value={progress}
            className="h-2 w-full max-w-xs"
            aria-label="Walk progress"
            data-testid="gemba-answer-progress"
          />
          <span
            className="text-sm text-muted-foreground"
            data-testid="gemba-answer-progress-label"
          >
            {requiredQuestions.length > 0
              ? `${answeredRequiredCount}/${requiredQuestions.length} required · `
              : ""}
            {answeredCount}/{flatQuestions.length} answered
          </span>
          {canComplete ? (
            <Button
              type="button"
              className="hidden min-h-11 sm:ml-auto sm:inline-flex"
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

        <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            {current.section.title}
          </p>
          <h2
            className="typography-section-title mt-2"
            data-testid="gemba-walk-prompt-heading"
          >
            <span>{current.question.prompt}</span>
            {current.question.is_required ? (
              <span
                className="text-destructive"
                aria-hidden="true"
                title="Required"
              >
                {" "}
                *
              </span>
            ) : null}
            <span className="sr-only">
              {current.question.is_required ? " (required)" : " (optional)"}
            </span>
          </h2>
          {canEdit && (
            <div
              className="mt-3 flex flex-wrap gap-2"
              aria-label="Observation type"
            >
              {gembaObservationTypeOptions().map((option) => (
                <Button
                  type="button"
                  key={option.value}
                  variant={
                    types[current.question.id] === option.value
                      ? "default"
                      : "outline"
                  }
                  aria-pressed={types[current.question.id] === option.value}
                  disabled={typeBusy}
                  className="h-auto min-h-11 max-w-full whitespace-normal"
                  onClick={async () => {
                    const q = current.question.id;
                    const next =
                      types[q] === option.value ? null : option.value;
                    setTypeBusy(true);
                    try {
                      if (!(await flushQuestion(q))) return;
                      if (answer.text_value?.trim()) {
                        const result = await savePromptCapture(
                          walkId,
                          q,
                          answer.text_value,
                          false,
                          next,
                        );
                        if (result.error) {
                          setCaptureError(result.error);
                          return;
                        }
                        if (result.observationId)
                          setPrimaryIds((prev) => ({
                            ...prev,
                            [q]: result.observationId!,
                          }));
                      }
                      setCaptureError(null);
                      setTypes((prev) => ({ ...prev, [q]: next }));
                    } finally {
                      setTypeBusy(false);
                    }
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
          <div className="mt-6">
            <Label htmlFor="walk-notes">Notes</Label>
            <Textarea
              id="walk-notes"
              className="mt-2 min-h-24"
              value={answer.is_not_applicable ? "" : (answer.text_value ?? "")}
              disabled={!canEdit}
              data-testid="gemba-walk-notes"
              onChange={(e) => changeText(current.question.id, e.target.value)}
              onBlur={() => {
                void flushQuestion(current.question.id);
              }}
            />
          </div>
          {current.question.allows_not_applicable ? (
            <Button
              type="button"
              variant={answer.is_not_applicable ? "secondary" : "outline"}
              className="mt-3 min-h-11"
              disabled={!canEdit}
              aria-pressed={Boolean(answer.is_not_applicable)}
              onClick={() => selectNotApplicable(current.question.id)}
              data-testid="gemba-answer-na"
            >
              N/A
            </Button>
          ) : null}
          <div className="mt-4">
            <AnswerSaveFeedback
              status={saveStatus}
              error={saveError}
              canRetry={canEdit}
              onRetry={() => retryQuestion(current.question.id)}
            />
          </div>

          <GembaEvidenceBlock
            key={current.question.id}
            walkId={walkId}
            sectionId={current.section.id}
            questionId={current.question.id}
            evidence={evidence}
            canEdit={canEdit}
          />
          {captureError && <p role="alert">{captureError}</p>}
          {canEdit && (
            <GembaAuditRaiseAction
              actionCount={
                actionCountsByObservation[
                  primaryIds[current.question.id] ?? ""
                ] ?? 0
              }
              disabled={typeBusy}
              linkContext={{
                walkId,
                defaultTitle: current.question.prompt,
                siteUnitId,
              }}
              prepare={async () => {
                const q = current.question.id;
                if (!(await flushQuestion(q))) return null;
                const notes = answer.text_value?.trim() ?? "";
                let observationId = primaryIds[q] ?? null;
                if (notes) {
                  const result = await savePromptCapture(
                    walkId,
                    q,
                    notes,
                    false,
                    types[q] ?? null,
                    true,
                  );
                  if (result.error) {
                    setCaptureError(result.error);
                    return null;
                  }
                  if (result.observationId) {
                    observationId = result.observationId;
                    setPrimaryIds((prev) => ({
                      ...prev,
                      [q]: result.observationId!,
                    }));
                  }
                }
                return {
                  walkId,
                  sectionId: current.section.id,
                  questionId: q,
                  observationId,
                  siteUnitId,
                  defaultTitle: (notes || current.question.prompt).slice(
                    0,
                    120,
                  ),
                  defaultDescription: notes,
                  evidenceNames: evidence
                    .filter((e) => !e.observation_id && e.question_id === q)
                    .map((e) => e.filename),
                };
              }}
              onActionCreated={() => router.refresh()}
            />
          )}
          {types[current.question.id] === "issue" &&
            !actionCountsByObservation[
              primaryIds[current.question.id] ?? ""
            ] && (
              <p className="text-xs text-muted-foreground">No action raised</p>
            )}
          <GembaObservationPanel
            siteUnitId={siteUnitId}
            questionId={current.question.id}
            walkId={walkId}
            observations={observations}
            evidence={evidence}
            canEdit={canEdit}
            projectOptions={projectOptions}
            requiresSiteSelection={requiresSiteSelection}
            linkedProjectsByObservationId={linkedProjectsByObservationId}
            actionCountsByObservation={actionCountsByObservation}
            onIntegrityChange={handleObservationIntegrity}
            onObservationsChange={handleObservationsChange}
            onActionCountsChange={() => router.refresh()}
          />
        </div>

        <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-background pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {canComplete ? (
            <Button
              type="button"
              className="min-h-11 w-full sm:hidden"
              disabled={completing}
              onClick={openCompletePanel}
              data-testid="gemba-complete-walk-mobile"
            >
              Complete walk
            </Button>
          ) : null}
          <div className="flex gap-3">
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
        </div>

        <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete this walk?</DialogTitle>
              <DialogDescription>
                Review the walk, add an optional summary, then confirm.
                Completed walks cannot be edited.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-sm">
              <p data-testid="gemba-completion-answered-count">
                Answered prompts: {answeredCount} of {questionIds.length}
              </p>
              <p
                className={
                  unansweredRequiredCount > 0 ? "text-destructive" : undefined
                }
                data-testid="gemba-completion-required-unanswered"
              >
                Required prompts unanswered: {unansweredRequiredCount}
              </p>
              <p data-testid="gemba-completion-observation-count">
                Observations: {summaryObservations.length} (
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
                disabled={completing || unansweredRequiredCount > 0}
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
    </div>
  );
}
