import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { FacilitatorEnvelope } from "@/platform/ai/types";

export type ReconciledAiRunTurn = {
  runId: string;
  assistantMessageId: string;
  envelope: FacilitatorEnvelope;
};

export type ExistingAiRunStatus =
  "running" | "completed" | "failed" | "timed_out" | "denied" | "unknown";

export type ExistingAiRunSnapshot = {
  status: ExistingAiRunStatus;
  ageMs: number;
};

export async function readExistingAiRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<ExistingAiRunSnapshot | null> {
  const { data, error } = await supabase
    .from("ai_runs")
    .select("status, started_at")
    .eq("id", runId)
    .maybeSingle();
  if (error || !data?.status || typeof data.started_at !== "string") {
    return null;
  }
  const startedMs = Date.parse(data.started_at);
  const ageMs = Number.isFinite(startedMs) ? Date.now() - startedMs : 0;
  const status = data.status;
  if (
    status === "running" ||
    status === "completed" ||
    status === "failed" ||
    status === "timed_out" ||
    status === "denied"
  ) {
    return { status, ageMs };
  }
  return { status: "unknown", ageMs };
}

export async function reconcileCompletedAiRunTurn(
  supabase: SupabaseClient,
  runId: string,
): Promise<ReconciledAiRunTurn | null> {
  const snapshot = await readExistingAiRun(supabase, runId);
  if (!snapshot || snapshot.status !== "completed") {
    return null;
  }

  const { data: message, error } = await supabase
    .from("ai_messages")
    .select("id, structured_payload")
    .eq("ai_run_id", runId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !message?.id || !message.structured_payload) {
    return null;
  }

  return {
    runId,
    assistantMessageId: message.id,
    envelope: message.structured_payload as FacilitatorEnvelope,
  };
}
