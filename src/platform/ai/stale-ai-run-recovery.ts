import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { staleAiRunSettlement } from "@/platform/ai/ai-run-stale-settlement";

const STALE_AFTER_SECONDS_DEFAULT = 65;
const CASE_RECOVERY_LIMIT = 20;

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
    .select("id, started_at, provider_dispatched_at, provider_request_id")
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
    const settlement = staleAiRunSettlement({
      provider_dispatched_at: row.provider_dispatched_at ?? null,
      provider_request_id: row.provider_request_id ?? null,
    });
    const { error: failError } = await supabase.rpc("fail_ai_run", {
      target_ai_run_id: row.id,
      target_error_category: settlement.target_error_category,
      target_final_output: settlement.target_final_output,
    });
    if (!failError) {
      recovered += 1;
    }
  }
  return recovered;
}

/**
 * Closes orphaned `running` rows for every AI session on a case when the
 * member reloads the workspace. Scoped to the caller's own runs only.
 */
export async function recoverStaleAiRunsForProblemSolvingCase(
  supabase: SupabaseClient,
  caseId: string,
  staleAfterMs: number,
): Promise<number> {
  if (staleAfterMs <= 0) {
    return 0;
  }

  const staleAfterSeconds = Math.max(1, Math.ceil(staleAfterMs / 1000));
  const { data, error } = await supabase.rpc(
    "recover_stale_ai_runs_for_problem_solving_case",
    {
      target_problem_solving_case_id: caseId,
      target_stale_after_seconds: Math.min(
        staleAfterSeconds,
        STALE_AFTER_SECONDS_DEFAULT * 10,
      ),
    },
  );

  if (error || typeof data !== "number") {
    return 0;
  }

  return Math.min(data, CASE_RECOVERY_LIMIT);
}
