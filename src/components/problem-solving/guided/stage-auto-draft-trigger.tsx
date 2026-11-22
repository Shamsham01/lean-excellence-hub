"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  draftProblemSolvingStage,
  reconcileProblemSolvingStageDraft,
} from "@/app/(platform)/platform/problem-solving/ai/actions";
import { Button } from "@/components/ui/button";
import {
  invokeProblemSolvingTurnAction,
  shouldRetainProblemSolvingTurnKey,
} from "@/lib/problem-solving/problem-solving-ai-turn-client";
import { isProblemSolvingCaseOpenForAiDraft } from "@/lib/problem-solving/status";

type StageAutoDraftTriggerProps = {
  caseId: string;
  stageKey: string;
  stageTitle?: string;
  viewStageKey?: string;
  currentStageKey?: string | null;
  autoDraftPrompt: string;
  canUseAi: boolean;
  providerAvailable: boolean;
  hasProblemData: boolean;
  caseStatus?: string;
  stagePendingCount?: number;
  autoDraft?: boolean;
  onDraftComplete?: () => void;
};

function storageKey(caseId: string, stageKey: string) {
  return `pps-stage-auto-draft:${caseId}:${stageKey}`;
}

export function StageAutoDraftTrigger({
  caseId,
  stageKey,
  stageTitle,
  viewStageKey,
  currentStageKey,
  autoDraftPrompt,
  canUseAi,
  providerAvailable,
  hasProblemData,
  caseStatus = "active",
  stagePendingCount = 0,
  autoDraft = true,
  onDraftComplete,
}: StageAutoDraftTriggerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const pendingTurnRef = useRef<{ idempotencyKey: string } | null>(null);

  const stageLabel = stageTitle ?? stageKey;
  const caseOpenForAiDraft = isProblemSolvingCaseOpenForAiDraft(caseStatus);

  const runDraft = useCallback(async () => {
    if (
      !canUseAi ||
      !providerAvailable ||
      !caseOpenForAiDraft ||
      !hasProblemData ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    window.sessionStorage.setItem(storageKey(caseId, stageKey), "1");
    setLoading(true);
    setMessage(null);

    const idempotencyKey =
      pendingTurnRef.current?.idempotencyKey ??
      `stage-draft-${caseId}-${stageKey}-${crypto.randomUUID()}`;
    pendingTurnRef.current = { idempotencyKey };

    try {
      const result = await invokeProblemSolvingTurnAction({
        invoke: () =>
          draftProblemSolvingStage({
            caseId,
            stageKey,
            viewStageKey: viewStageKey ?? stageKey,
            currentStageKey: currentStageKey ?? null,
            message: autoDraftPrompt,
            idempotencyKey,
          }),
        reconcile: () =>
          reconcileProblemSolvingStageDraft({
            caseId,
            idempotencyKey,
            stageKey,
            viewStageKey: viewStageKey ?? stageKey,
          }),
      });

      if (result.error || !result.data) {
        setMessage(result.error ?? "Could not run stage draft.");
        if (
          result.error &&
          shouldRetainProblemSolvingTurnKey(result.error) &&
          pendingTurnRef.current
        ) {
          return;
        }
        pendingTurnRef.current = null;
        return;
      }

      pendingTurnRef.current = null;

      const pendingProposalCount =
        "pendingProposalCount" in result.data &&
        typeof result.data.pendingProposalCount === "number"
          ? result.data.pendingProposalCount
          : 0;

      if (pendingProposalCount <= 0) {
        setMessage(
          `Lean AI finished but did not create any proposals for ${stageLabel}. Try again or ask in the Lean AI panel.`,
        );
        router.refresh();
        return;
      }

      onDraftComplete?.();
      router.refresh();
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [
    autoDraftPrompt,
    canUseAi,
    caseId,
    caseOpenForAiDraft,
    currentStageKey,
    hasProblemData,
    onDraftComplete,
    providerAvailable,
    router,
    stageKey,
    stageLabel,
    viewStageKey,
  ]);

  useEffect(() => {
    if (
      !canUseAi ||
      !providerAvailable ||
      !hasProblemData ||
      !caseOpenForAiDraft ||
      !autoDraft
    ) {
      return;
    }
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("pps-disable-stage-auto-draft") === "1") {
      return;
    }
    if (window.sessionStorage.getItem(storageKey(caseId, stageKey))) {
      return;
    }
    if (stagePendingCount > 0) {
      window.sessionStorage.setItem(storageKey(caseId, stageKey), "1");
      return;
    }
    const timer = window.setTimeout(() => void runDraft(), 0);
    return () => window.clearTimeout(timer);
  }, [
    autoDraft,
    stagePendingCount,
    canUseAi,
    providerAvailable,
    hasProblemData,
    caseOpenForAiDraft,
    caseId,
    stageKey,
    runDraft,
  ]);

  if (!canUseAi || !providerAvailable) {
    return null;
  }

  if (!caseOpenForAiDraft) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-2.5"
      data-testid="pps-stage-auto-draft"
    >
      <p className="text-sm font-medium">Lean AI draft · {stageLabel}</p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={loading || !hasProblemData || !caseOpenForAiDraft}
        onClick={() => void runDraft()}
        data-testid="pps-stage-auto-draft-button"
        title={
          !caseOpenForAiDraft
            ? "Stage drafts are only available on draft or active cases"
            : hasProblemData
              ? "Generate proposals for this stage"
              : "Add a problem statement or current-condition facts first"
        }
      >
        {loading ? "Drafting…" : "Draft this stage"}
      </Button>
      {!caseOpenForAiDraft ? (
        <p className="w-full text-xs text-muted-foreground">
          This case is closed or cancelled — stage drafts are disabled.
        </p>
      ) : !hasProblemData ? (
        <p className="w-full text-xs text-muted-foreground">
          Add problem or current-condition facts first.
        </p>
      ) : null}
      {message ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      {stagePendingCount > 0 ? (
        <p
          className="w-full text-xs text-muted-foreground"
          role="status"
          data-testid="pps-stage-auto-draft-status"
        >
          {stagePendingCount} proposal(s) ready for {stageLabel} — review
          Pending Lean AI proposals below.
        </p>
      ) : null}
    </div>
  );
}
