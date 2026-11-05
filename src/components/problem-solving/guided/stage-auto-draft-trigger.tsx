"use client";

import { useEffect, useRef, useState } from "react";

import { sendProblemSolvingAiMessage } from "@/app/(platform)/platform/problem-solving/ai/actions";
import { createProblemSolvingAiSession } from "@/app/(platform)/platform/problem-solving/ai/actions";
import { Button } from "@/components/ui/button";
import type { AiSessionMode } from "@/platform/ai/types";

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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoRan = useRef(false);

  useEffect(() => {
    if (!canUseAi || !providerAvailable || !hasProblemData || autoRan.current) {
      return;
    }
    if (typeof window === "undefined") return;
    if (
      window.sessionStorage.getItem("pps-disable-stage-auto-draft") === "1"
    ) {
      return;
    }
    if (window.sessionStorage.getItem(storageKey(caseId, stageKey))) {
      return;
    }
    autoRan.current = true;
    void runDraft(true);
  }, [canUseAi, providerAvailable, hasProblemData, caseId, stageKey]);

  async function runDraft(fromAuto = false) {
    if (!canUseAi || !providerAvailable) return;
    setLoading(true);
    setMessage(null);
    try {
      const session = await createProblemSolvingAiSession({
        caseId,
        mode: "facilitate" satisfies AiSessionMode,
      });
      if (session.error || !session.data?.sessionId) {
        throw new Error(session.error ?? "Could not start Lean AI session.");
      }
      const sessionId = session.data.sessionId;
      const idempotencyKey = `${sessionId}-auto-${stageKey}-${crypto.randomUUID()}`;
      const result = await sendProblemSolvingAiMessage({
        caseId,
        sessionId,
        mode: "facilitate",
        stageKey,
        message: autoDraftPrompt,
        idempotencyKey,
        conversationHistory: [],
      });
      if (result.error) {
        throw new Error(result.error);
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey(caseId, stageKey), "1");
      }
      setMessage(
        fromAuto
          ? "Lean AI drafted suggestions for this stage — review proposals in the facilitator panel."
          : "Draft ready — review proposals below.",
      );
      onDraftComplete?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not run stage draft.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!canUseAi || !providerAvailable) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/10 p-3"
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
      >
        {loading ? "Drafting…" : "Draft this stage"}
      </Button>
      {!hasProblemData ? (
        <p className="text-xs text-muted-foreground">
          Add a problem statement or current-condition facts first.
        </p>
      ) : null}
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
