import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AI_STALE_RUN_AFTER_MS } from "@/platform/ai/run-deadline";
import { recoverStaleAiRunsForProblemSolvingCase } from "@/platform/ai/stale-ai-run-recovery";

export async function recoverProblemSolvingAiRunsForCase(
  supabase: SupabaseClient,
  caseId: string,
): Promise<void> {
  await recoverStaleAiRunsForProblemSolvingCase(
    supabase,
    caseId,
    AI_STALE_RUN_AFTER_MS,
  );
}
