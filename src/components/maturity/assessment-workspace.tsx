"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { saveCriterionNote } from "@/app/(platform)/platform/maturity/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { AssessmentActionForm } from "@/components/maturity/assessment-action-form";
import { AssessmentLifecycleActions } from "@/components/maturity/assessment-lifecycle-actions";
import { QuestionCard } from "@/components/maturity/assessment-question-card";
import { FormalLifecycleIndicator } from "@/components/maturity/formal-lifecycle-indicator";
import {
  SaveStatus,
  type FieldSaveState,
} from "@/components/maturity/save-status";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  actionStatusLabel,
  formatActionReference,
  formatDueDate,
} from "@/lib/actions/status";
import { cn } from "@/lib/utils";
import {
  persistCriterionSelection,
  resolveInitialCriterionId,
} from "@/modules/maturity/assessment-criterion-state";
import {
  buildAssessmentNavPosition,
  formatAssessmentNavPosition,
  scrollAssessmentTarget,
  type AssessmentScrollIntent,
} from "@/modules/maturity/assessment-navigation";
import { buildAssessmentReadiness } from "@/modules/maturity/assessment-readiness";
import type {
  AssessmentAnswer,
  AssessmentLevel,
  AssessmentLifecyclePermissions,
  AssessmentPillar,
  LinkedAssessmentAction,
} from "@/modules/maturity/assessment-workspace-types";
import { AssessmentStatusBadge } from "@/modules/maturity/status-badges";

type AssessmentWorkspaceProps = {
  assessmentId: string;
  status: string;
  assessmentType: string;
  pillars: AssessmentPillar[];
  levels: AssessmentLevel[];
  answers: Record<string, AssessmentAnswer>;
  criterionNotes: Record<string, string>;
  questionNotes: Record<string, string>;
  evidence: EvidenceItem[];
  canEdit: boolean;
  linkedActions?: LinkedAssessmentAction[];
  leadAssessorName?: string | null;
  submittedByName?: string | null;
  lifecycle: AssessmentLifecyclePermissions;
  initialCriterionId?: string | null;
};

export function AssessmentWorkspace({
  assessmentId,
  status,
  assessmentType,
  pillars,
  levels,
  answers,
  criterionNotes,
  questionNotes,
  evidence,
  canEdit,
  linkedActions = [],
  leadAssessorName,
  submittedByName,
  lifecycle,
  initialCriterionId = null,
}: AssessmentWorkspaceProps) {
  const flatCriteria = useMemo(
    () =>
      pillars.flatMap((pillar) =>
        pillar.criteria.map((criterion) => ({
          pillar,
          criterion,
        })),
      ),
    [pillars],
  );
  const criterionIds = useMemo(
    () => flatCriteria.map((item) => item.criterion.id),
    [flatCriteria],
  );
  const [criterionId, setCriterionId] = useState(
    () =>
      resolveInitialCriterionId({
        assessmentId,
        criterionIds,
        urlCriterionId: initialCriterionId,
      }) ??
      criterionIds[0] ??
      "",
  );
  const [localAnswers, setLocalAnswers] = useState<
    Record<string, AssessmentAnswer>
  >({});
  const [localQuestionNotes, setLocalQuestionNotes] = useState<
    Record<string, string>
  >({});
  const [actionFormOpen, setActionFormOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [highlightQuestionId, setHighlightQuestionId] = useState<string | null>(
    null,
  );
  const pendingSaves = useRef(new Set<Promise<unknown>>());
  const fieldFlushers = useRef(new Set<() => Promise<void>>());
  const criterionTopRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<AssessmentScrollIntent | null>(null);
  const [scrollNonce, setScrollNonce] = useState(0);

  const trackSave = useCallback(async <T,>(promise: Promise<T>) => {
    pendingSaves.current.add(promise);
    try {
      return await promise;
    } finally {
      pendingSaves.current.delete(promise);
    }
  }, []);

  const registerFlush = useCallback((flush: () => Promise<void>) => {
    fieldFlushers.current.add(flush);
    return () => {
      fieldFlushers.current.delete(flush);
    };
  }, []);

  const flushSaves = useCallback(async () => {
    await Promise.allSettled([
      ...[...fieldFlushers.current].map((flush) => flush()),
      ...pendingSaves.current,
    ]);
  }, []);

  const draftAnswers = useMemo(
    () => ({ ...answers, ...localAnswers }),
    [answers, localAnswers],
  );
  const draftQuestionNotes = useMemo(
    () => ({ ...questionNotes, ...localQuestionNotes }),
    [localQuestionNotes, questionNotes],
  );

  const readiness = useMemo(
    () => buildAssessmentReadiness(pillars, draftAnswers),
    [draftAnswers, pillars],
  );

  const currentIndex = Math.max(
    0,
    flatCriteria.findIndex((item) => item.criterion.id === criterionId),
  );
  const current = flatCriteria[currentIndex] ?? flatCriteria[0];
  const navPosition = useMemo(
    () => buildAssessmentNavPosition(pillars, criterionId),
    [criterionId, pillars],
  );

  const selectCriterion = useCallback(
    async (nextId: string, questionId?: string | null) => {
      await flushSaves();
      pendingScrollRef.current = questionId
        ? { kind: "question", questionId }
        : { kind: "criterion-top" };
      setScrollNonce((value) => value + 1);
      setCriterionId(nextId);
      persistCriterionSelection({
        assessmentId,
        criterionId: nextId,
        ...(questionId ? { questionId } : {}),
      });
      setHighlightQuestionId(questionId ?? null);
      setCriteriaOpen(false);
    },
    [assessmentId, flushSaves],
  );

  useEffect(() => {
    if (!current?.criterion.id) {
      return;
    }
    persistCriterionSelection({
      assessmentId,
      criterionId: current.criterion.id,
    });
  }, [assessmentId, current?.criterion.id]);

  useEffect(() => {
    if (scrollNonce === 0) {
      return;
    }
    const intent = pendingScrollRef.current;
    pendingScrollRef.current = null;
    if (!intent) {
      return;
    }
    scrollAssessmentTarget(intent, criterionTopRef.current);
  }, [criterionId, scrollNonce]);

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">No criteria configured.</p>
    );
  }

  const { pillar, criterion } = current;
  const firstMissing = readiness.remaining[0];
  const nextIncomplete = readiness.remaining.find(
    (item) => item.criterionId !== criterion.id,
  );

  return (
    <div
      className="flex flex-col gap-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8"
      data-testid="assessment-workspace"
    >
      <aside
        className="hidden min-w-0 flex-col gap-1 lg:flex"
        data-testid="desktop-criterion-nav"
      >
        <CriterionNavigator
          pillars={pillars}
          readiness={readiness}
          activeId={criterion.id}
          testIdPrefix="criterion-nav"
          onSelect={(id) => void selectCriterion(id)}
        />
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        {/*
          html/body use overflow-x: clip, which prevents position:sticky in
          Chromium. Keep this compact bar fixed below platform-mobile-chrome.
        */}
        <div className="lg:hidden">
          <div
            aria-hidden
            className="h-[5.75rem]"
            data-testid="assessment-mobile-context-spacer"
          />
          <header
            data-testid="assessment-mobile-context"
            className="fixed inset-x-0 top-[calc(3.85rem+env(safe-area-inset-top,0px))] z-30 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm sm:px-6"
          >
            <div className="mx-auto flex max-w-6xl min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                  data-testid="assessment-mobile-pillar-name"
                >
                  {pillar.name}
                </p>
                <h2
                  className="truncate text-sm leading-tight font-semibold text-foreground"
                  data-testid="assessment-mobile-criterion-name"
                >
                  {criterion.name}
                </h2>
                <p
                  className="text-[11px] leading-tight text-muted-foreground"
                  data-testid="assessment-criterion-position"
                >
                  {formatAssessmentNavPosition(navPosition)}
                </p>
                <p
                  className="text-[11px] leading-tight text-muted-foreground"
                  data-testid="assessment-mobile-completion"
                >
                  {readiness.answeredRequired} / {readiness.totalRequired}{" "}
                  complete · {readiness.completionPercent}%
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                data-testid="criteria-drawer-open"
                onClick={() => setCriteriaOpen(true)}
              >
                Criteria
              </Button>
            </div>
            <Progress
              className="mx-auto mt-2 h-1 max-w-6xl"
              value={readiness.completionPercent}
              aria-label="Assessment progress"
            />
          </header>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AssessmentStatusBadge status={status} />
          <span className="text-sm text-muted-foreground capitalize">
            {assessmentType.replace("_", " ")}
          </span>
        </div>
        {assessmentType === "formal" ? (
          <FormalLifecycleIndicator status={status} />
        ) : null}
        {leadAssessorName || submittedByName ? (
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            {leadAssessorName ? (
              <div>
                <dt className="text-muted-foreground">Lead assessor</dt>
                <dd data-testid="lead-assessor-name">{leadAssessorName}</dd>
              </div>
            ) : null}
            {submittedByName ? (
              <div>
                <dt className="text-muted-foreground">Submitted by</dt>
                <dd data-testid="submitted-by-name">{submittedByName}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div
          className="hidden flex-col gap-2 lg:flex"
          data-testid="assessment-desktop-progress"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p
              className="text-sm font-medium"
              data-testid="assessment-completion-count"
            >
              {readiness.answeredRequired} / {readiness.totalRequired} required
              responses
            </p>
            <p className="text-sm text-muted-foreground">
              {readiness.completionPercent}% complete
            </p>
          </div>
          <Progress
            value={readiness.completionPercent}
            aria-label="Assessment progress"
          />
          <p
            className="text-xs text-muted-foreground"
            data-testid="assessment-desktop-nav-position"
          >
            {formatAssessmentNavPosition(navPosition)}
          </p>
        </div>

        <div
          ref={criterionTopRef}
          data-testid="assessment-criterion-top"
          className="h-px scroll-mt-[calc(3.85rem+env(safe-area-inset-top,0px)+5.75rem)] lg:scroll-mt-2"
        />

        <div className="hidden lg:block">
          <p className="typography-section-title">{pillar.name}</p>
          <h2 className="mt-1 text-lg font-semibold">{criterion.name}</h2>
          {criterion.description ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {criterion.description}
            </p>
          ) : null}
        </div>

        <ContextualGuidance criterion={criterion} levels={levels} />

        <div className="flex flex-col gap-4">
          {criterion.questions.map((question) => (
            <QuestionCard
              key={question.id}
              assessmentId={assessmentId}
              criterionId={criterion.id}
              question={question}
              {...(draftAnswers[question.id]
                ? { answer: draftAnswers[question.id] }
                : {})}
              comment={draftQuestionNotes[question.id] ?? ""}
              evidence={evidence}
              levels={levels}
              canEdit={canEdit}
              highlight={highlightQuestionId === question.id}
              trackSave={trackSave}
              registerFlush={registerFlush}
              onAnswerChange={(id, next) =>
                setLocalAnswers((current) => ({ ...current, [id]: next }))
              }
              onCommentChange={(id, next) =>
                setLocalQuestionNotes((current) => ({
                  ...current,
                  [id]: next,
                }))
              }
            />
          ))}
        </div>

        <CriterionSummaryField
          key={criterion.id}
          assessmentId={assessmentId}
          criterionId={criterion.id}
          initialComment={criterionNotes[criterion.id] ?? ""}
          canEdit={canEdit}
          trackSave={trackSave}
          registerFlush={registerFlush}
        />

        {canEdit ? (
          actionFormOpen ? (
            <div className="max-w-lg rounded-lg border border-border bg-card p-4">
              <AssessmentActionForm
                assessmentId={assessmentId}
                pillarId={pillar.id}
                criterionId={criterion.id}
                questions={criterion.questions.map((question) => ({
                  id: question.id,
                  prompt: question.prompt,
                }))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setActionFormOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              data-testid="create-improvement-action"
              onClick={() => setActionFormOpen(true)}
            >
              + Create improvement action
            </Button>
          )
        ) : null}

        <LinkedActionsList
          actions={linkedActions.filter(
            (action) => action.criterion_id === criterion.id,
          )}
          heading="Actions for this criterion"
          emptyLabel="No actions have been created from this criterion yet."
        />

        <AssessmentLifecycleActions
          assessmentId={assessmentId}
          assessmentType={assessmentType}
          status={status}
          readiness={readiness}
          lifecycle={lifecycle}
          canEdit={canEdit}
          flushSaves={flushSaves}
          onGoToFirstMissing={() => {
            if (!firstMissing) return;
            void selectCriterion(
              firstMissing.criterionId,
              firstMissing.questionId,
            );
          }}
        />

        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-20 flex gap-2 rounded-lg border border-border bg-background/95 p-2 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            disabled={currentIndex === 0}
            data-testid="previous-criterion"
            onClick={() => {
              const previous = flatCriteria[currentIndex - 1];
              if (previous) void selectCriterion(previous.criterion.id);
            }}
          >
            Previous
          </Button>
          <Button
            type="button"
            disabled={currentIndex >= flatCriteria.length - 1}
            data-testid="next-criterion"
            onClick={() => {
              const next = flatCriteria[currentIndex + 1];
              if (next) void selectCriterion(next.criterion.id);
            }}
          >
            Next
          </Button>
          {nextIncomplete ? (
            <Button
              type="button"
              variant="outline"
              data-testid="next-incomplete"
              onClick={() =>
                void selectCriterion(
                  nextIncomplete.criterionId,
                  nextIncomplete.questionId,
                )
              }
            >
              Next incomplete
            </Button>
          ) : null}
        </div>

        <LinkedActionsList
          actions={linkedActions}
          heading="All assessment actions"
          emptyLabel="No actions have been created from this assessment yet."
          testId="assessment-actions-summary"
        />
      </div>

      <Sheet open={criteriaOpen} onOpenChange={setCriteriaOpen}>
        <SheetContent
          side="bottom"
          data-testid="criteria-drawer"
          className="max-h-[80vh] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Criteria</SheetTitle>
            <SheetDescription>
              Choose a criterion. Completion is required responses, not
              navigation position.
            </SheetDescription>
          </SheetHeader>
          <CriterionNavigator
            pillars={pillars}
            readiness={readiness}
            activeId={criterion.id}
            testIdPrefix="criteria-drawer-item"
            onSelect={(id) => void selectCriterion(id)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CriterionNavigator({
  pillars,
  readiness,
  activeId,
  onSelect,
  testIdPrefix,
}: {
  pillars: AssessmentPillar[];
  readiness: ReturnType<typeof buildAssessmentReadiness>;
  activeId: string;
  onSelect: (criterionId: string) => void;
  testIdPrefix: string;
}) {
  return (
    <nav className="flex flex-col gap-3" data-testid={`${testIdPrefix}-list`}>
      {pillars.map((pillar) => (
        <div key={pillar.id}>
          <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {pillar.name}
          </p>
          {pillar.criteria.map((criterion) => {
            const completion = readiness.criterionCompletions[criterion.id];
            const state = completion?.state ?? "not_started";
            const marker =
              state === "complete" ? "✓" : state === "partial" ? "●" : "○";
            return (
              <button
                key={criterion.id}
                type="button"
                onClick={() => onSelect(criterion.id)}
                data-testid={`${testIdPrefix}-${criterion.id}`}
                data-completion-state={state}
                data-active={criterion.id === activeId ? "true" : "false"}
                aria-current={criterion.id === activeId ? "true" : undefined}
                className={cn(
                  "mt-1 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  criterion.id === activeId
                    ? "bg-accent font-medium text-accent-foreground"
                    : "hover:bg-muted",
                )}
              >
                <span aria-hidden className="mt-0.5 text-xs">
                  {marker}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{criterion.name}</span>
                  {completion && completion.totalRequired > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {completion.answeredRequired}/{completion.totalRequired}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function ContextualGuidance({
  criterion,
  levels,
}: {
  criterion: AssessmentPillar["criteria"][number];
  levels: AssessmentLevel[];
}) {
  return (
    <div className="flex flex-col gap-2" data-testid="contextual-guidance">
      <details className="rounded-md border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          Scoring guidance
        </summary>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
          {levels.length === 0 ? (
            <li>No maturity levels are configured on this framework.</li>
          ) : (
            levels.map((level) => (
              <li key={level.level_number}>
                <span className="font-medium text-foreground">
                  {level.level_number} {level.name}
                </span>
                {level.guidance ? ` — ${level.guidance}` : ""}
              </li>
            ))
          )}
        </ul>
      </details>
      <details className="rounded-md border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          Criterion guidance
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          {criterion.guidance ??
            criterion.description ??
            "Review the criterion and capture evidence against each question."}
        </p>
      </details>
      <details className="rounded-md border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          Level descriptors
        </summary>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
          {levels.map((level) => (
            <li key={level.level_number}>
              <span className="font-medium text-foreground">{level.name}</span>
              {level.guidance
                ? ` — ${level.guidance}`
                : " — No descriptor configured."}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function LinkedActionsList({
  actions,
  heading,
  emptyLabel,
  testId,
}: {
  actions: LinkedAssessmentAction[];
  heading: string;
  emptyLabel: string;
  testId?: string;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      data-testid={testId ?? "criterion-linked-actions"}
    >
      <p className="font-medium">{heading}</p>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {actions.map((action) => (
            <li key={action.id} className="text-sm">
              <AppLink
                href={`/platform/actions/${action.id}`}
                className="font-medium underline"
              >
                {formatActionReference(action.action_number, action.title)}
              </AppLink>
              <p className="text-muted-foreground">
                {actionStatusLabel(action.status)}
                {action.assignee_name ? ` · ${action.assignee_name}` : ""}
                {action.due_at ? ` · Due ${formatDueDate(action.due_at)}` : ""}
                {` · ${action.pillar_name} / ${action.criterion_name}`}
                {action.question_prompt ? ` / ${action.question_prompt}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CriterionSummaryField({
  assessmentId,
  criterionId,
  initialComment,
  canEdit,
  trackSave,
  registerFlush,
}: {
  assessmentId: string;
  criterionId: string;
  initialComment: string;
  canEdit: boolean;
  trackSave: <T>(promise: Promise<T>) => Promise<T>;
  registerFlush: (flush: () => Promise<void>) => () => void;
}) {
  const [comment, setComment] = useState(initialComment);
  const [state, setState] = useState<FieldSaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const commentRef = useRef(initialComment);
  const dirtyRef = useRef(false);

  const saveComment = useCallback(
    async (value = commentRef.current) => {
      if (!canEdit || !value.trim()) {
        dirtyRef.current = false;
        return;
      }
      dirtyRef.current = false;
      setState("saving");
      setError(null);
      const result = await trackSave(
        saveCriterionNote(assessmentId, criterionId, value.trim()),
      );
      if (result.error) {
        dirtyRef.current = true;
        setState("error");
        setError(result.error);
        return;
      }
      setState("saved");
      window.setTimeout(() => setState("idle"), 2000);
    },
    [assessmentId, canEdit, criterionId, trackSave],
  );

  useEffect(() => {
    return registerFlush(async () => {
      if (dirtyRef.current) {
        await saveComment(commentRef.current);
      }
    });
  }, [registerFlush, saveComment]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Label htmlFor={`criterion-note-${criterionId}`}>Criterion summary</Label>
      <p className="typography-helper mt-1">
        Overall observation for this criterion. Use question comments for
        detailed evidence narrative.
      </p>
      <Textarea
        id={`criterion-note-${criterionId}`}
        className="mt-2"
        rows={3}
        disabled={!canEdit}
        value={comment}
        onChange={(event) => {
          commentRef.current = event.target.value;
          dirtyRef.current = true;
          setComment(event.target.value);
        }}
        onBlur={() => void saveComment()}
        data-testid="assessor-comment"
        placeholder="Overall criterion observation."
      />
      <SaveStatus
        state={state}
        error={error}
        onRetry={() => void saveComment()}
      />
    </div>
  );
}
