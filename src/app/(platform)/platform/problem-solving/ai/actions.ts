"use server";

import { revalidatePath } from "next/cache";

import {
  formatAiSettingsSaveError,
  isValidMonthlyTokenCeiling,
} from "@/lib/ai/organisation-ai-settings";
import { isApplicationAiProviderAvailable } from "@/platform/ai/config";
import { AI_TURN_WALL_CLOCK_USER_MESSAGE } from "@/platform/ai/run-deadline";
import { AiProviderError } from "@/platform/ai/providers/errors";
import { runAiTurn } from "@/platform/ai/orchestrator";
import { reconcileProblemSolvingAiTurnByIdempotencyKey } from "@/platform/ai/problem-solving-turn-reconcile";
import { recoverProblemSolvingAiRunsForCase } from "@/platform/ai/recover-problem-solving-ai-runs";
import { acceptAiProposal } from "@/platform/ai/proposals/acceptance";
import { formatProposalAcceptanceError } from "@/platform/ai/proposals/contracts";
import type { AiSessionMode } from "@/platform/ai/types";
import {
  countPendingProposalsForViewStage,
  resolveCanonicalStageKey,
} from "@/lib/problem-solving/stage-draft";
import { assertPlanModuleWrite } from "@/modules/billing/assert-module-write";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type ActionResult<T = undefined> = { error?: string; ok?: true; data?: T };

/** Ensure server-action payloads are plain JSON (Next.js RSC serialization). */
function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type PendingProposalRow = {
  id: string;
  proposal_type: string;
  payload_json: Record<string, unknown>;
  human_explanation: string;
  status: string;
  semantic_stage_key?: string | null;
};

export async function createProblemSolvingAiSession(input: {
  caseId: string;
  mode: AiSessionMode;
  problemSolvingSessionId?: string;
}): Promise<ActionResult<{ sessionId: string }>> {
  const moduleGate = await assertPlanModuleWrite("problem_solving");
  if (!moduleGate.ok) return { error: moduleGate.error };
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("create_ai_session", {
      target_problem_solving_case_id: input.caseId,
      target_mode: input.mode,
      ...(input.problemSolvingSessionId
        ? { target_problem_solving_session_id: input.problemSolvingSessionId }
        : {}),
    });
    if (error) throw error;
    revalidatePath(`/platform/problem-solving/${input.caseId}`);
    return { ok: true, data: { sessionId: data as string } };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not start Lean AI session.",
    };
  }
}

export async function sendProblemSolvingAiMessage(input: {
  caseId: string;
  sessionId: string;
  mode: AiSessionMode;
  stageKey?: string | null;
  viewStageKey?: string | null;
  currentStageKey?: string | null;
  message: string;
  idempotencyKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<
  ActionResult<{
    runId: string;
    assistantMessageId: string;
    envelope: import("@/platform/ai/types").FacilitatorEnvelope;
    pendingProposals?: PendingProposalRow[];
  }>
> {
  if (!isApplicationAiProviderAvailable()) {
    return {
      error: "Lean AI is not available. Enable AI in organisation settings.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    await recoverProblemSolvingAiRunsForCase(supabase, input.caseId);
    const result = await runAiTurn({
      supabase,
      sessionId: input.sessionId,
      caseId: input.caseId,
      mode: input.mode,
      stageKey: input.stageKey ?? null,
      viewStageKey: input.viewStageKey ?? input.stageKey ?? null,
      currentStageKey: input.currentStageKey ?? null,
      userMessage: input.message,
      idempotencyKey: input.idempotencyKey,
      conversationHistory: input.conversationHistory,
    });

    const { data: sessionDetail } = await supabase.rpc(
      "get_ai_session_detail",
      {
        target_ai_session_id: input.sessionId,
      },
    );

    const proposalsRaw =
      (sessionDetail as { proposals?: PendingProposalRow[] } | null)
        ?.proposals ?? [];
    const pendingProposals = proposalsRaw.filter(
      (row) => row.status === "pending",
    );

    revalidatePath(`/platform/problem-solving/${input.caseId}`);
    return {
      ok: true,
      data: toPlainJson({
        ...result,
        pendingProposals,
      }),
    };
  } catch (error) {
    // Supabase PostgrestError values may be plain objects instead of Error.
    // Emit only non-sensitive diagnostic codes, never user prompts or case data.
    const detail =
      error !== null && typeof error === "object"
        ? (error as { code?: unknown; status?: unknown })
        : null;
    const code =
      typeof detail?.code === "string" &&
      /^[a-zA-Z0-9_]{2,20}$/.test(detail.code)
        ? detail.code
        : null;
    console.warn(
      "[lean-ai:problem-solving-action]",
      JSON.stringify({
        error_type: error instanceof Error ? error.name : typeof error,
        error_code: code,
        http_status: typeof detail?.status === "number" ? detail.status : null,
        mode: input.mode,
      }),
    );
    if (error instanceof AiProviderError) {
      return { error: error.message };
    }
    if (
      error instanceof Error &&
      /timeout|timed out|wall.?clock/i.test(error.message)
    ) {
      return { error: AI_TURN_WALL_CLOCK_USER_MESSAGE };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Lean AI could not complete this turn.",
    };
  }
}

export async function draftProblemSolvingStage(input: {
  caseId: string;
  stageKey: string;
  viewStageKey?: string;
  currentStageKey?: string | null;
  message: string;
  idempotencyKey: string;
}): Promise<
  ActionResult<{
    sessionId: string;
    runId: string;
    pendingProposalCount: number;
  }>
> {
  if (!isApplicationAiProviderAvailable()) {
    return {
      error: "Lean AI is not available. Enable AI in organisation settings.",
    };
  }

  const trimmedKey = input.idempotencyKey.trim();
  if (!trimmedKey) {
    return { error: "Lean AI could not start this stage draft." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    await recoverProblemSolvingAiRunsForCase(supabase, input.caseId);

    const sessionResult = await createProblemSolvingAiSession({
      caseId: input.caseId,
      mode: "facilitate",
    });
    if (sessionResult.error || !sessionResult.data?.sessionId) {
      return {
        error: sessionResult.error ?? "Could not start Lean AI session.",
      };
    }
    const sessionId = sessionResult.data.sessionId;

    const result = await runAiTurn({
      supabase,
      sessionId,
      caseId: input.caseId,
      mode: "facilitate",
      stageKey: input.stageKey,
      viewStageKey: input.viewStageKey ?? input.stageKey,
      currentStageKey: input.currentStageKey ?? null,
      userMessage: input.message,
      idempotencyKey: trimmedKey,
      conversationHistory: [],
      turnProfile: "stage_draft",
    });

    const { data: sessionDetail } = await supabase.rpc(
      "get_ai_session_detail",
      {
        target_ai_session_id: sessionId,
      },
    );
    const proposalsRaw =
      (sessionDetail as { proposals?: PendingProposalRow[] } | null)
        ?.proposals ?? [];
    const viewStage = resolveCanonicalStageKey(
      input.viewStageKey ?? input.stageKey,
    );
    const pendingProposalCount = countPendingProposalsForViewStage(
      proposalsRaw,
      viewStage,
    );

    revalidatePath(`/platform/problem-solving/${input.caseId}`);
    return {
      ok: true,
      data: toPlainJson({
        sessionId,
        runId: result.runId,
        pendingProposalCount,
      }),
    };
  } catch (error) {
    const detail =
      error !== null && typeof error === "object"
        ? (error as { code?: unknown; status?: unknown })
        : null;
    const code =
      typeof detail?.code === "string" &&
      /^[a-zA-Z0-9_]{2,20}$/.test(detail.code)
        ? detail.code
        : null;
    console.warn(
      "[lean-ai:problem-solving-stage-draft]",
      JSON.stringify({
        error_type: error instanceof Error ? error.name : typeof error,
        error_code: code,
        stage_key: input.stageKey,
      }),
    );
    if (error instanceof AiProviderError) {
      return { error: error.message };
    }
    if (
      error instanceof Error &&
      /timeout|timed out|wall.?clock/i.test(error.message)
    ) {
      return { error: AI_TURN_WALL_CLOCK_USER_MESSAGE };
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "Lean AI could not draft this stage. Try again in a moment.",
    };
  }
}

export async function reconcileProblemSolvingStageDraft(input: {
  caseId: string;
  idempotencyKey: string;
  stageKey?: string;
  viewStageKey?: string;
}): Promise<
  ActionResult<{
    sessionId: string;
    runId: string;
    pendingProposalCount: number;
  }>
> {
  try {
    const supabase = await createServerSupabaseClient();
    const trimmedKey = input.idempotencyKey.trim();
    const { data: runRow, error: runError } = await supabase
      .from("ai_runs")
      .select("id, ai_session_id")
      .eq("idempotency_key", trimmedKey)
      .maybeSingle();

    if (runError || !runRow?.ai_session_id) {
      return {
        error:
          "Lean AI did not find a stage draft to reconcile. Try Draft this stage again.",
      };
    }

    const reconciled = await reconcileProblemSolvingAiTurnByIdempotencyKey(
      supabase,
      {
        caseId: input.caseId,
        sessionId: runRow.ai_session_id,
        idempotencyKey: trimmedKey,
      },
    );

    if (reconciled.state === "completed") {
      const { data: sessionDetail } = await supabase.rpc(
        "get_ai_session_detail",
        { target_ai_session_id: runRow.ai_session_id },
      );
      const proposalsRaw =
        (sessionDetail as { proposals?: PendingProposalRow[] } | null)
          ?.proposals ?? [];
      const viewStage = resolveCanonicalStageKey(
        input.viewStageKey ?? input.stageKey ?? "DEFINE",
      );
      revalidatePath(`/platform/problem-solving/${input.caseId}`);
      return {
        ok: true,
        data: toPlainJson({
          sessionId: runRow.ai_session_id,
          runId: reconciled.runId,
          pendingProposalCount: countPendingProposalsForViewStage(
            proposalsRaw,
            viewStage,
          ),
        }),
      };
    }

    return {
      error:
        reconciled.state === "failed"
          ? reconciled.message
          : (reconciled.message ??
            "Lean AI is still finishing this stage draft. Wait a moment, then retry."),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not reconcile Lean AI stage draft.",
    };
  }
}

export async function reconcileProblemSolvingAiTurn(input: {
  caseId: string;
  sessionId: string;
  idempotencyKey: string;
}): Promise<
  ActionResult<{
    state: "completed" | "in_progress" | "failed";
    runId?: string;
    assistantMessageId?: string;
    envelope?: import("@/platform/ai/types").FacilitatorEnvelope;
    message?: string;
    pendingProposals?: PendingProposalRow[];
  }>
> {
  try {
    const supabase = await createServerSupabaseClient();
    const result = await reconcileProblemSolvingAiTurnByIdempotencyKey(
      supabase,
      input,
    );

    if (result.state === "completed") {
      const { data: sessionDetail } = await supabase.rpc(
        "get_ai_session_detail",
        { target_ai_session_id: input.sessionId },
      );
      const proposalsRaw =
        (sessionDetail as { proposals?: PendingProposalRow[] } | null)
          ?.proposals ?? [];
      const pendingProposals = proposalsRaw.filter(
        (row) => row.status === "pending",
      );
      revalidatePath(`/platform/problem-solving/${input.caseId}`);
      return {
        ok: true,
        data: {
          state: "completed",
          runId: result.runId,
          assistantMessageId: result.assistantMessageId,
          envelope: result.envelope,
          pendingProposals,
        },
      };
    }

    return {
      ok: true,
      data: {
        state: result.state,
        message: result.message,
        ...(result.state === "failed" && result.runId
          ? { runId: result.runId }
          : {}),
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not reconcile Lean AI turn.",
    };
  }
}

export async function acceptProblemSolvingAiProposal(input: {
  caseId: string;
  proposalId: string;
  payload: Record<string, unknown>;
}): Promise<ActionResult<{ resultId: string }>> {
  const moduleGate = await assertPlanModuleWrite("problem_solving");
  if (!moduleGate.ok) return { error: moduleGate.error };
  try {
    const supabase = await createServerSupabaseClient();
    const result = await acceptAiProposal(
      supabase,
      input.proposalId,
      input.payload,
    );
    revalidatePath(`/platform/problem-solving/${input.caseId}`);
    return { ok: true, data: { resultId: result.resultId } };
  } catch (error) {
    return {
      error: formatProposalAcceptanceError(error),
    };
  }
}

export async function rejectProblemSolvingAiProposal(input: {
  caseId: string;
  proposalId: string;
  reason?: string;
}): Promise<ActionResult> {
  const moduleGate = await assertPlanModuleWrite("problem_solving");
  if (!moduleGate.ok) return { error: moduleGate.error };
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("reject_ai_proposal", {
      target_ai_proposal_id: input.proposalId,
      ...(input.reason ? { target_rejection_reason: input.reason } : {}),
    });
    if (error) throw error;
    revalidatePath(`/platform/problem-solving/${input.caseId}`);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not reject proposal.",
    };
  }
}

export async function updateOrganisationAiSettings(input: {
  aiEnabled: boolean;
  monthlyTokenCeiling: number | null;
  webSearchEnabled: boolean;
}): Promise<ActionResult> {
  if (
    input.monthlyTokenCeiling !== null &&
    !isValidMonthlyTokenCeiling(input.monthlyTokenCeiling)
  ) {
    return {
      error: "Enter a whole number greater than zero, or turn the pause off.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("update_organisation_ai_settings", {
      target_ai_enabled: input.aiEnabled,
      // Generated types omit null. Explicit null clears the ceiling; omitting
      // the argument also clears it because the SQL default is null.
      target_monthly_token_ceiling: input.monthlyTokenCeiling as number,
      target_web_search_enabled: input.webSearchEnabled,
    });
    if (error) throw error;
    revalidatePath("/platform/settings/ai");
    return { ok: true };
  } catch (error) {
    const details: { code?: string; message?: string } = {};
    if (error && typeof error === "object") {
      if ("code" in error && typeof error.code === "string") {
        details.code = error.code;
      }
      if ("message" in error && typeof error.message === "string") {
        details.message = error.message;
      }
    }
    console.warn("[lean-ai:settings]", JSON.stringify(details));
    return { error: formatAiSettingsSaveError(details) };
  }
}
