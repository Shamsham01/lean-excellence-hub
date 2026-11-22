import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { failAiRunBestEffort } from "@/platform/ai/fail-ai-run-best-effort";

/**
 * Last-resort settlement when application control flow ends while the row may
 * still be `running` (for example after an unhandled reject inside the budget race).
 */
export async function ensureAiRunSettledBestEffort(
  supabase: SupabaseClient,
  runId: string,
  error: unknown,
): Promise<void> {
  const { data, error: readError } = await supabase
    .from("ai_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();

  if (readError || data?.status !== "running") {
    return;
  }

  await failAiRunBestEffort(supabase, runId, error);
}
