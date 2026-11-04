import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { aiRunFailureCategory } from "@/platform/ai/providers/errors";
import { AiProviderError } from "@/platform/ai/providers/errors";

export async function failAiRunBestEffort(
  supabase: SupabaseClient,
  runId: string,
  error: unknown,
): Promise<void> {
  const category = aiRunFailureCategory(error);
  const finalOutput =
    error instanceof AiProviderError
      ? error.message
      : error instanceof Error
        ? error.message.slice(0, 500)
        : "Lean AI encountered an error.";

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
