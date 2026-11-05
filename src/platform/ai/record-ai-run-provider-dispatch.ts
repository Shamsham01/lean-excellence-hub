import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordAiRunProviderDispatch(
  supabase: SupabaseClient,
  runId: string,
): Promise<void> {
  const { error } = await supabase.rpc("record_ai_run_provider_dispatch", {
    target_ai_run_id: runId,
  });
  if (error) {
    throw error;
  }
}
