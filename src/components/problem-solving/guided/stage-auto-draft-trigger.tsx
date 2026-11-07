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
  onDraftComplete,
}: StageAutoDraftTriggerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const autoRan = useRef(false);
  const pendingTurnRef = useRef<{ idempotencyKey: string } | null>(null);

  const stageLabel = stageTitle ?? stageKey;

  const runDraft = useCallback(
    async (fromAuto = false) => {
      if (!canUseAi || !providerAvailable) return;
      setLoading(true);
      setMessage(null);
      setIsError(false);

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
          setIsError(true);
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
          setIsError(true);
          setMessage(
            `Lean AI finished but did not create any proposals for ${stageLabel}. Try again or ask in the Lean AI panel.`,
          );
          router.refresh();
          return;
        }

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(storageKey(caseId, stageKey), "1");
        }
        setMessage(
          fromAuto
            ? `${pendingProposalCount} proposal(s) ready for ${stageLabel} — review Pending Lean AI proposals below.`
            : `${pendingProposalCount} proposal(s) for ${stageLabel} — see Pending Lean AI proposals below.`,
        );
        onDraftComplete?.();
        router.refresh();
      } finally {
        setLoading(false);
      }
    },
    [
      autoDraftPrompt,
      canUseAi,
      caseId,
      currentStageKey,
      onDraftComplete,
      providerAvailable,
      router,
      stageKey,
      stageLabel,
      viewStageKey,
    ],
  );

  useEffect(() => {
    if (!canUseAi || !providerAvailable || !hasProblemData || autoRan.current) {
      return;
    }
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("pps-disable-stage-auto-draft") === "1") {
      return;
    }
    if (window.sessionStorage.getItem(storageKey(caseId, stageKey))) {
      return;
    }
    autoRan.current = true;
    const timer = window.setTimeout(() => {
      void runDraft(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canUseAi, providerAvailable, hasProblemData, caseId, stageKey, runDraft]);

  if (!canUseAi || !providerAvailable) {
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
        disabled={loading || !hasProblemData}
        onClick={() => runDraft(false)}
        data-testid="pps-stage-auto-draft-button"
        title={
          hasProblemData
            ? "Generate one bounded draft for this stage visit"
            : "Add a problem statement or current-condition facts first"
        }
      >
        {loading ? "Drafting…" : "Draft this stage"}
      </Button>
      {!hasProblemData ? (
        <p className="w-full text-xs text-muted-foreground">
          Add problem or current-condition facts first.
        </p>
      ) : null}
      {message ? (
        <p
          className={
            isError
              ? "w-full text-xs text-destructive"
              : "w-full text-xs text-muted-foreground"
          }
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
