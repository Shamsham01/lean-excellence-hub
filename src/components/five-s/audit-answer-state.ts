"use client";

import { useEffect, useRef, useState } from "react";

import { saveFiveSAuditAnswer } from "@/app/(platform)/platform/5s/actions";

export type AuditAnswer = {
  text_value?: string | null;
  number_value?: number | null;
  is_not_applicable?: boolean;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type SaveAnswerFn = typeof saveFiveSAuditAnswer;

export const ANSWER_SAVE_ERROR_MESSAGE =
  "Couldn't save this answer. Try again.";

export const COMPLETE_AUDIT_SAVE_ERROR_MESSAGE =
  "Couldn't save all answers. Fix the error and try again.";

export const TEXT_NUMBER_SAVE_DEBOUNCE_MS = 400;

type SavePayload = {
  isNotApplicable?: boolean;
  textValue?: string | null;
  numberValue?: number | null;
};

type SaveJob = {
  payload: SavePayload;
  answer: AuditAnswer;
  epoch: number;
};

type QuestionRuntime = {
  inFlight: boolean;
  current: SaveJob | null;
  pending: SaveJob | null;
  latest: SaveJob | null;
  lastFailed: SaveJob | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  waiters: Array<(ok: boolean) => void>;
};

function cloneAnswers(
  answers: Record<string, AuditAnswer>,
): Record<string, AuditAnswer> {
  const next: Record<string, AuditAnswer> = {};
  for (const [questionId, answer] of Object.entries(answers)) {
    next[questionId] = { ...answer };
  }
  return next;
}

function buildNumberDrafts(
  answers: Record<string, AuditAnswer>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [questionId, answer] of Object.entries(answers)) {
    next[questionId] =
      answer.number_value == null ? "" : String(answer.number_value);
  }
  return next;
}

export function normalizeAnswer(answer: AuditAnswer | undefined): {
  text_value: string | null;
  number_value: number | null;
  is_not_applicable: boolean;
} {
  return {
    text_value: answer?.text_value ?? null,
    number_value: answer?.number_value ?? null,
    is_not_applicable: answer?.is_not_applicable ?? false,
  };
}

export function answersEqual(
  left: AuditAnswer | undefined,
  right: AuditAnswer | undefined,
) {
  const a = normalizeAnswer(left);
  const b = normalizeAnswer(right);
  return (
    a.text_value === b.text_value &&
    a.number_value === b.number_value &&
    a.is_not_applicable === b.is_not_applicable
  );
}

function isSaveSuccess(result: unknown) {
  if (!result || typeof result !== "object") return false;
  const record = result as { ok?: unknown; error?: unknown };
  return record.ok === true && record.error == null;
}

function parseNumberDraft(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

/**
 * Local 5S answer state.
 *
 * Architecture:
 * - Server-loaded `answers` seed local and last-confirmed maps.
 * - Visible controls always read local state.
 * - Refresh / new `answers` fingerprint is the authoritative DB rehydrate.
 *
 * Persistence:
 * - Yes/No and N/A enqueue immediately (optimistic selected state).
 * - Text/number update locally immediately, then persist on debounce (400ms)
 *   and on blur / navigation flush. This follows the maturity workspace
 *   blur-save pattern, with debounce so a paused floor user still persists.
 *
 * Races:
 * - Per-question latest-wins queue. Rapid Yes→No or 1→2→3 keeps the latest
 *   intended payload; a slower older response cannot overwrite UI or enqueue
 *   a stale persist. In-flight work is allowed to finish, then the latest
 *   pending payload is sent so the DB matches the visible answer.
 * - Dirty checks compare against the effective persistence target (pending,
 *   then in-flight, then last confirmed). Reverting to the previously
 *   confirmed value while an older different save is in flight still queues
 *   that revert so the DB cannot finish on the superseded value.
 *
 * Failures:
 * - Keep the attempted local value visible.
 * - Show a clear inline error (never "Saved").
 * - Retry re-sends the last failed payload.
 * - Page refresh restores last confirmed DB value.
 *
 * Navigation:
 * - Flush the current question, wait for the queue to drain, then move.
 * - Do not advance when the latest save failed.
 *
 * Completion:
 * - Flush every dirty/debounced question and wait for in-flight saves.
 * - Block Complete when any latest save failed; keep the error visible.
 */
export function useAuditAnswerState({
  auditId,
  answers,
  canEdit,
  saveAnswer = saveFiveSAuditAnswer,
}: {
  auditId: string;
  answers: Record<string, AuditAnswer>;
  canEdit: boolean;
  saveAnswer?: SaveAnswerFn;
}) {
  const [localAnswers, setLocalAnswers] = useState(() => cloneAnswers(answers));
  const [confirmedAnswers, setConfirmedAnswers] = useState(() =>
    cloneAnswers(answers),
  );
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [numberDrafts, setNumberDrafts] = useState(() =>
    buildNumberDrafts(answers),
  );

  const confirmedRef = useRef(confirmedAnswers);
  const statusRef = useRef(statuses);
  const epochRef = useRef(0);
  const runtimesRef = useRef(new Map<string, QuestionRuntime>());
  const saveAnswerRef = useRef(saveAnswer);
  const auditIdRef = useRef(auditId);
  const canEditRef = useRef(canEdit);
  const answersSnapshotRef = useRef(answers);
  const runLoopRef = useRef<(questionId: string) => Promise<void>>(
    async () => undefined,
  );
  const enqueueRef = useRef<
    (questionId: string, payload: SavePayload, answer: AuditAnswer) => void
  >(() => undefined);

  const answersFingerprint = JSON.stringify(answers);

  useEffect(() => {
    confirmedRef.current = confirmedAnswers;
    statusRef.current = statuses;
    saveAnswerRef.current = saveAnswer;
    auditIdRef.current = auditId;
    canEditRef.current = canEdit;
    answersSnapshotRef.current = answers;
  }, [answers, auditId, canEdit, confirmedAnswers, saveAnswer, statuses]);

  useEffect(() => {
    const snapshot = answersSnapshotRef.current;
    const runtimes = runtimesRef.current;
    epochRef.current += 1;
    for (const runtime of runtimes.values()) {
      if (runtime.debounceTimer) {
        clearTimeout(runtime.debounceTimer);
        runtime.debounceTimer = null;
      }
      runtime.current = null;
      runtime.pending = null;
      runtime.latest = null;
      runtime.lastFailed = null;
      const waiters = runtime.waiters.splice(0);
      for (const waiter of waiters) waiter(false);
    }
    setLocalAnswers(cloneAnswers(snapshot));
    setConfirmedAnswers(cloneAnswers(snapshot));
    setStatuses({});
    setErrors({});
    setNumberDrafts(buildNumberDrafts(snapshot));
    return () => {
      for (const runtime of runtimes.values()) {
        if (runtime.debounceTimer) {
          clearTimeout(runtime.debounceTimer);
          runtime.debounceTimer = null;
        }
      }
    };
  }, [auditId, answersFingerprint]);

  function ensureRuntime(questionId: string) {
    const existing = runtimesRef.current.get(questionId);
    if (existing) return existing;
    const created: QuestionRuntime = {
      inFlight: false,
      current: null,
      pending: null,
      latest: null,
      lastFailed: null,
      debounceTimer: null,
      waiters: [],
    };
    runtimesRef.current.set(questionId, created);
    return created;
  }

  function persistenceTarget(
    runtime: QuestionRuntime,
    questionId: string,
  ): AuditAnswer | undefined {
    return (
      runtime.pending?.answer ??
      runtime.current?.answer ??
      confirmedRef.current[questionId]
    );
  }

  function needsPersist(
    runtime: QuestionRuntime,
    answer: AuditAnswer,
    questionId: string,
  ) {
    return !answersEqual(answer, persistenceTarget(runtime, questionId));
  }

  function queueLatestIfStale(questionId: string, saved: AuditAnswer) {
    const runtime = ensureRuntime(questionId);
    const latest = runtime.latest;
    if (!latest || answersEqual(latest.answer, saved)) return;
    if (
      runtime.pending &&
      answersEqual(runtime.pending.answer, latest.answer)
    ) {
      return;
    }
    enqueueRef.current(questionId, latest.payload, latest.answer);
  }

  async function runLoop(questionId: string) {
    const runtime = ensureRuntime(questionId);
    if (runtime.inFlight) return;
    runtime.inFlight = true;
    let lastOk = statusRef.current[questionId] !== "error";

    try {
      while (runtime.pending) {
        const job = runtime.pending;
        runtime.pending = null;
        runtime.current = job;
        setStatuses((current) => ({ ...current, [questionId]: "saving" }));
        setErrors((current) => ({ ...current, [questionId]: null }));

        let result: unknown;
        try {
          result = await saveAnswerRef.current(
            auditIdRef.current,
            questionId,
            job.payload,
          );
        } catch {
          result = { error: ANSWER_SAVE_ERROR_MESSAGE };
        }

        runtime.current = null;

        if (job.epoch !== epochRef.current) {
          lastOk = false;
          continue;
        }

        if (!isSaveSuccess(result)) {
          queueLatestIfStale(questionId, job.answer);
          if (runtime.pending) {
            continue;
          }
          lastOk = false;
          runtime.lastFailed = job;
          setStatuses((current) => ({ ...current, [questionId]: "error" }));
          setErrors((current) => ({
            ...current,
            [questionId]: ANSWER_SAVE_ERROR_MESSAGE,
          }));
          continue;
        }

        lastOk = true;
        runtime.lastFailed = null;
        setConfirmedAnswers((current) => ({
          ...current,
          [questionId]: job.answer,
        }));
        queueLatestIfStale(questionId, job.answer);
        if (runtime.pending) {
          continue;
        }
        setStatuses((current) => ({ ...current, [questionId]: "saved" }));
        setErrors((current) => ({ ...current, [questionId]: null }));
      }
    } finally {
      runtime.current = null;
      runtime.inFlight = false;
      if (runtime.pending) {
        void runLoopRef.current(questionId);
        return;
      }
      const waiters = runtime.waiters.splice(0);
      for (const waiter of waiters) waiter(lastOk);
    }
  }

  function enqueue(
    questionId: string,
    payload: SavePayload,
    answer: AuditAnswer,
  ) {
    if (!canEditRef.current) return;
    const runtime = ensureRuntime(questionId);
    if (runtime.debounceTimer) {
      clearTimeout(runtime.debounceTimer);
      runtime.debounceTimer = null;
    }
    const job: SaveJob = {
      payload,
      answer,
      epoch: epochRef.current,
    };
    runtime.latest = job;
    runtime.lastFailed = null;
    runtime.pending = job;
    setLocalAnswers((current) => ({ ...current, [questionId]: answer }));
    setStatuses((current) => ({ ...current, [questionId]: "saving" }));
    setErrors((current) => ({ ...current, [questionId]: null }));
    void runLoopRef.current(questionId);
  }

  useEffect(() => {
    runLoopRef.current = runLoop;
    enqueueRef.current = enqueue;
  });

  function markQuestionSaving(questionId: string) {
    setStatuses((current) => ({ ...current, [questionId]: "saving" }));
    setErrors((current) => ({ ...current, [questionId]: null }));
  }

  function markQuestionSavedIfIdle(
    questionId: string,
    runtime: QuestionRuntime,
  ) {
    if (runtime.inFlight || runtime.pending) return;
    setStatuses((current) => ({ ...current, [questionId]: "saved" }));
    setErrors((current) => ({ ...current, [questionId]: null }));
  }

  function schedulePersist(
    questionId: string,
    payload: SavePayload,
    answer: AuditAnswer,
  ) {
    if (!canEditRef.current) return;
    const runtime = ensureRuntime(questionId);
    const job: SaveJob = {
      payload,
      answer,
      epoch: epochRef.current,
    };
    runtime.latest = job;
    setLocalAnswers((current) => ({ ...current, [questionId]: answer }));

    if (!needsPersist(runtime, answer, questionId)) {
      if (runtime.debounceTimer) {
        clearTimeout(runtime.debounceTimer);
        runtime.debounceTimer = null;
      }
      markQuestionSavedIfIdle(questionId, runtime);
      return;
    }

    // Debounce window is part of the save lifecycle: never leave Saved on a
    // visible draft that has not been persisted yet.
    markQuestionSaving(questionId);
    if (runtime.inFlight || runtime.pending || runtime.current) {
      enqueueRef.current(questionId, payload, answer);
      return;
    }
    if (runtime.debounceTimer) {
      clearTimeout(runtime.debounceTimer);
    }
    runtime.debounceTimer = setTimeout(() => {
      runtime.debounceTimer = null;
      const latest = runtime.latest;
      if (!latest) return;
      if (!needsPersist(runtime, latest.answer, questionId)) {
        markQuestionSavedIfIdle(questionId, runtime);
        return;
      }
      enqueueRef.current(questionId, latest.payload, latest.answer);
    }, TEXT_NUMBER_SAVE_DEBOUNCE_MS);
  }

  function getAnswer(questionId: string): AuditAnswer {
    return localAnswers[questionId] ?? {};
  }

  function getStatus(questionId: string): SaveStatus {
    return statuses[questionId] ?? "idle";
  }

  function getError(questionId: string) {
    return errors[questionId] ?? null;
  }

  function getNumberDraft(questionId: string) {
    return numberDrafts[questionId] ?? "";
  }

  function isQuestionBusy(questionId: string) {
    return statuses[questionId] === "saving";
  }

  function selectYesNo(questionId: string, value: "yes" | "no") {
    enqueue(
      questionId,
      { textValue: value },
      {
        text_value: value,
        number_value: null,
        is_not_applicable: false,
      },
    );
    setNumberDrafts((current) => ({ ...current, [questionId]: "" }));
  }

  function selectNotApplicable(questionId: string) {
    enqueue(
      questionId,
      {
        isNotApplicable: true,
        textValue: null,
        numberValue: null,
      },
      {
        text_value: null,
        number_value: null,
        is_not_applicable: true,
      },
    );
    setNumberDrafts((current) => ({ ...current, [questionId]: "" }));
  }

  function changeText(questionId: string, value: string) {
    schedulePersist(
      questionId,
      { textValue: value },
      {
        text_value: value,
        number_value: null,
        is_not_applicable: false,
      },
    );
  }

  function changeNumber(questionId: string, value: string) {
    setNumberDrafts((current) => ({ ...current, [questionId]: value }));
    const parsed = parseNumberDraft(value);
    if (parsed === undefined) {
      setLocalAnswers((current) => ({
        ...current,
        [questionId]: {
          text_value: null,
          number_value: current[questionId]?.number_value ?? null,
          is_not_applicable: false,
        },
      }));
      return;
    }
    schedulePersist(
      questionId,
      { numberValue: parsed },
      {
        text_value: null,
        number_value: parsed,
        is_not_applicable: false,
      },
    );
  }

  async function flushQuestion(questionId: string) {
    const runtime = ensureRuntime(questionId);
    if (runtime.debounceTimer) {
      clearTimeout(runtime.debounceTimer);
      runtime.debounceTimer = null;
    }
    const latest = runtime.latest;
    if (latest && needsPersist(runtime, latest.answer, questionId)) {
      enqueue(questionId, latest.payload, latest.answer);
    } else if (latest) {
      markQuestionSavedIfIdle(questionId, runtime);
    }

    if (!runtime.inFlight && !runtime.pending) {
      return statusRef.current[questionId] !== "error";
    }

    return new Promise<boolean>((resolve) => {
      runtime.waiters.push(resolve);
      if (!runtime.inFlight && !runtime.pending) {
        const waiters = runtime.waiters.splice(0);
        const ok = statusRef.current[questionId] !== "error";
        for (const waiter of waiters) waiter(ok);
      }
    });
  }

  async function flushAllQuestions(questionIds: string[]) {
    const ids = new Set(questionIds);
    for (const id of runtimesRef.current.keys()) {
      ids.add(id);
    }
    const results = await Promise.all(
      [...ids].map((questionId) => flushQuestion(questionId)),
    );
    return results.every(Boolean);
  }

  function retryQuestion(questionId: string) {
    const runtime = ensureRuntime(questionId);
    if (!runtime.lastFailed) return;
    enqueue(questionId, runtime.lastFailed.payload, runtime.lastFailed.answer);
  }

  return {
    getAnswer,
    getStatus,
    getError,
    getNumberDraft,
    isQuestionBusy,
    selectYesNo,
    selectNotApplicable,
    changeText,
    changeNumber,
    flushQuestion,
    flushAllQuestions,
    retryQuestion,
  };
}
