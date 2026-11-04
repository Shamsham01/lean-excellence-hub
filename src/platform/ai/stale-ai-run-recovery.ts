import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const STALE_RUN_FINAL_OUTPUT =
  "Lean AI did not finish before the hosting limit. Nothing was applied — you can retry safely.";

/**
 * Marks long-running `ai_runs` rows as timed out so a new turn can start.
 * Only runs the caller is allowed to fail (via `fail_ai_run`) are updated.
 */
export async function recoverStaleAiRunsForSession(
  supabase: SupabaseClient,
  sessionId: string,
  staleAfterMs: number,
): Promise<number> {
  if (staleAfterMs <= 0) {
    return 0;
  }

  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const { data: rows, error } = await supabase
    .from("ai_runs")
    .select("id, started_at")
    .eq("ai_session_id", sessionId)
    .eq("status", "running");

  if (error || !rows?.length) {
    return 0;
  }

  let recovered = 0;
  for (const row of rows) {
    if (typeof row.started_at !== "string" || row.started_at > cutoff) {
      continue;
    }
    const { error: failError } = await supabase.rpc("fail_ai_run", {
      target_ai_run_id: row.id,
      target_error_category: "timeout",
      target_final_output: STALE_RUN_FINAL_OUTPUT,
    });
    if (!failError) {
      recovered += 1;
    }
  }
  return recovered;
}
