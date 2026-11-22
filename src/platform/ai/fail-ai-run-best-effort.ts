import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AI_TURN_WALL_CLOCK_USER_MESSAGE } from "@/platform/ai/ai-turn-messages";
import { staleAiRunSettlement } from "@/platform/ai/ai-run-stale-settlement";
import {
  aiRunFailureCategory,
  AiProviderError,
  AI_PROVIDER_ERROR_CODES,
} from "@/platform/ai/providers/errors";

export async function failAiRunBestEffort(
  supabase: SupabaseClient,
  runId: string,
  error: unknown,
): Promise<void> {
  let category = aiRunFailureCategory(error);
  let finalOutput =
    error instanceof AiProviderError
      ? error.message
      : error instanceof Error
        ? error.message.slice(0, 500)
        : "Lean AI encountered an error.";

  if (
    category === "timeout" ||
    (error instanceof AiProviderError &&
      error.code === AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT)
  ) {
    const { data: runRow } = await supabase
      .from("ai_runs")
      .select("provider_dispatched_at, provider_request_id")
      .eq("id", runId)
      .maybeSingle();
    if (runRow) {
      const settlement = staleAiRunSettlement({
        provider_dispatched_at: runRow.provider_dispatched_at ?? null,
        provider_request_id: runRow.provider_request_id ?? null,
      });
      const abortedByTurnDeadline =
        error instanceof AiProviderError &&
        error.diagnostics.abortedByTurnDeadline === true;
      if (
        settlement.target_error_category === "interrupted_unknown_billing" &&
        !abortedByTurnDeadline
      ) {
        category = settlement.target_error_category;
        finalOutput = settlement.target_final_output;
      } else if (abortedByTurnDeadline) {
        category = "timeout";
        finalOutput = AI_TURN_WALL_CLOCK_USER_MESSAGE;
      }
    }
  }

  try {
    const { error: rpcError } = await supabase.rpc("fail_ai_run", {
      target_ai_run_id: runId,
      target_error_category: category,
      target_final_output: finalOutput,
    });
    if (rpcError) {
      console.warn(
        "[lean-ai:fail_run]",
        JSON.stringify({
          ai_run_id: runId,
          error_category: category,
          cleanup_code: rpcError.code ?? "unknown",
        }),
      );
    }
  } catch (cleanupError) {
    console.warn(
      "[lean-ai:fail_run]",
      JSON.stringify({
        ai_run_id: runId,
        error_category: category,
        cleanup_threw: true,
        cleanup_message:
          cleanupError instanceof Error
            ? cleanupError.message.slice(0, 120)
            : "unknown",
      }),
    );
  }
}
