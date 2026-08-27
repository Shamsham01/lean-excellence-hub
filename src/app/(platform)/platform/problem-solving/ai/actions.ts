"use server";

import { revalidatePath } from "next/cache";

import { isApplicationAiProviderAvailable } from "@/platform/ai/config";
import { runAiTurn } from "@/platform/ai/orchestrator";
import { acceptAiProposal } from "@/platform/ai/proposals/acceptance";
import { formatProposalAcceptanceError } from "@/platform/ai/proposals/contracts";
import type { AiSessionMode } from "@/platform/ai/types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type ActionResult<T = undefined> = { error?: string; ok?: true; data?: T };

type PendingProposalRow = {
  id: string;
  proposal_type: string;
  payload_json: Record<string, unknown>;
  human_explanation: string;
  status: string;
};

export async function createProblemSolvingAiSession(input: {
  caseId: string;
  mode: AiSessionMode;
  problemSolvingSessionId?: string;
}): Promise<ActionResult<{ sessionId: string }>> {
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
    const result = await runAiTurn({
      supabase,
      sessionId: input.sessionId,
      caseId: input.caseId,
      mode: input.mode,
      stageKey: input.stageKey ?? null,
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
      data: {
        ...result,
        pendingProposals,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Lean AI could not complete this turn.",
    };
  }
}

export async function acceptProblemSolvingAiProposal(input: {
  caseId: string;
  proposalId: string;
  payload: Record<string, unknown>;
}): Promise<ActionResult<{ resultId: string }>> {
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
  monthlyTokenCeiling?: number | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("update_organisation_ai_settings", {
      target_ai_enabled: input.aiEnabled,
      ...(typeof input.monthlyTokenCeiling === "number"
        ? { target_monthly_token_ceiling: input.monthlyTokenCeiling }
        : {}),
    });
    if (error) throw error;
    revalidatePath("/platform/settings/ai");
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update AI settings.",
    };
  }
}
