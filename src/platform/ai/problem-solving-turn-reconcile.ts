import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AI_TURN_FAILED_RETRY_MESSAGE,
  AI_TURN_IN_PROGRESS_MESSAGE,
} from "@/platform/ai/ai-turn-messages";
import { reconcileFailureMessage } from "@/platform/ai/reconcile-failure-message";
import { reconcileCompletedAiRunTurn } from "@/platform/ai/ai-run-reconciliation";
import {
  AI_STALE_RUN_AFTER_MS,
  AI_TURN_FINALIZE_BUFFER_MS,
  resolveAiTurnWallClockMs,
} from "@/platform/ai/run-deadline";
import { getAiEnvironment, AI_DEFAULTS } from "@/platform/ai/config";
import {
  AiProviderError,
  AI_PROVIDER_ERROR_CODES,
} from "@/platform/ai/providers/errors";
import { recoverStaleAiRunsForSession } from "@/platform/ai/stale-ai-run-recovery";
import { recoverProblemSolvingAiRunsForCase } from "@/platform/ai/recover-problem-solving-ai-runs";
import type { FacilitatorEnvelope } from "@/platform/ai/types";

export type ProblemSolvingTurnReconcileResult =
  | {
      state: "completed";
      runId: string;
      assistantMessageId: string;
      envelope: FacilitatorEnvelope;
    }
  | { state: "in_progress"; message: string }
  | { state: "failed"; message: string; runId: string | null };

function resolveTurnBudgetStaleMs(): number {
  const env = getAiEnvironment();
  const wallClockMs = resolveAiTurnWallClockMs(
    env.AI_TURN_WALL_CLOCK_MS ?? AI_DEFAULTS.turnWallClockMs,
  );
  return wallClockMs + AI_TURN_FINALIZE_BUFFER_MS + 2_000;
}

export async function reconcileProblemSolvingAiTurnByIdempotencyKey(
  supabase: SupabaseClient,
  input: {
    caseId: string;
    sessionId: string;
    idempotencyKey: string;
  },
): Promise<ProblemSolvingTurnReconcileResult> {
  await recoverProblemSolvingAiRunsForCase(supabase, input.caseId);
  await recoverStaleAiRunsForSession(
    supabase,
    input.sessionId,
    AI_STALE_RUN_AFTER_MS,
  );
  await recoverStaleAiRunsForSession(
    supabase,
    input.sessionId,
    resolveTurnBudgetStaleMs(),
  );

  const { data: runRow, error } = await supabase
    .from("ai_runs")
    .select("id, status, ai_session_id, error_category, final_output")
    .eq("idempotency_key", input.idempotencyKey.trim())
    .maybeSingle();

  if (error || !runRow?.id) {
    return {
      state: "failed",
      message: AI_TURN_FAILED_RETRY_MESSAGE,
      runId: null,
    };
  }

  if (runRow.ai_session_id !== input.sessionId) {
    return {
      state: "failed",
      message: AI_TURN_FAILED_RETRY_MESSAGE,
      runId: null,
    };
  }

  const runId = runRow.id;
  const status = runRow.status;

  if (status === "completed") {
    const reconciled = await reconcileCompletedAiRunTurn(supabase, runId);
    if (!reconciled) {
      return {
        state: "failed",
        message: AI_TURN_FAILED_RETRY_MESSAGE,
        runId,
      };
    }
    return { state: "completed", ...reconciled };
  }

  if (status === "running") {
    return {
      state: "in_progress",
      message: AI_TURN_IN_PROGRESS_MESSAGE,
    };
  }

  return {
    state: "failed",
    message: reconcileFailureMessage({
      status,
      error_category: runRow.error_category ?? null,
      final_output: runRow.final_output ?? null,
    }),
    runId,
  };
}

export function throwReconciledTurnError(
  result: Extract<ProblemSolvingTurnReconcileResult, { state: "failed" }>,
): never {
  throw new AiProviderError(
    AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
    result.message,
    { provider: "lean-ai", model: "reconcile" },
  );
}
