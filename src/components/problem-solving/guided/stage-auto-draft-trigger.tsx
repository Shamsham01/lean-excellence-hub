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
              message: autoDraftPrompt,
              idempotencyKey,
            }),
          reconcile: () =>
            reconcileProblemSolvingStageDraft({
              caseId,
              idempotencyKey,
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

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(storageKey(caseId, stageKey), "1");
        }
        setMessage(
          fromAuto
            ? "Lean AI drafted suggestions for this stage — review proposals in the facilitator panel."
            : result.data.pendingProposalCount > 0
              ? `Draft ready — ${result.data.pendingProposalCount} proposal(s) in Pending Lean AI proposals below.`
              : "Draft finished — check Pending Lean AI proposals or the facilitator panel.",
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
      onDraftComplete,
      providerAvailable,
      router,
      stageKey,
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
      className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 shadow-xs"
      data-testid="pps-stage-auto-draft"
    >
      <p className="text-sm font-medium">Lean AI stage draft</p>
      <p className="text-xs text-muted-foreground">
        One automatic draft per stage visit (bounded). Accept proposals before
        they become case records.
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={loading || !hasProblemData}
        onClick={() => runDraft(false)}
        data-testid="pps-stage-auto-draft-button"
      >
        {loading ? "Drafting…" : "Draft this stage"}
      </Button>
      {!hasProblemData ? (
        <p className="text-xs text-muted-foreground">
          Add a problem statement or current-condition facts first.
        </p>
      ) : null}
      {message ? (
        <p
          className={
            isError
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
