import { AI_TURN_IN_PROGRESS_MESSAGE } from "@/platform/ai/ai-turn-messages";
import type { FacilitatorEnvelope } from "@/platform/ai/types";

export type FacilitatorPendingProposal = {
  id: string;
  proposal_type: string;
  payload_json: Record<string, unknown>;
  human_explanation: string;
  status: string;
  semantic_stage_key?: string | null;
};

export type ResolvedFacilitatorTurn =
  | {
      status: "completed";
      envelope: FacilitatorEnvelope;
      pendingProposals: FacilitatorPendingProposal[];
    }
  | { status: "in_progress"; message: string }
  | { status: "failed"; message: string }
  | { status: "unknown" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readEnvelope(value: unknown): FacilitatorEnvelope | null {
  if (!isRecord(value) || typeof value.message !== "string") {
    return null;
  }
  return value as FacilitatorEnvelope;
}

function readPendingProposals(value: unknown): FacilitatorPendingProposal[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord) as FacilitatorPendingProposal[];
}

export function resolveFacilitatorTurnPayload(
  data: unknown,
): ResolvedFacilitatorTurn {
  if (!isRecord(data)) {
    return { status: "unknown" };
  }

  const directEnvelope = readEnvelope(data.envelope);
  if (directEnvelope) {
    const pendingProposals = readPendingProposals(data.pendingProposals);
    return {
      status: "completed",
      envelope: directEnvelope,
      pendingProposals,
    };
  }

  if (data.state === "completed") {
    const envelope = readEnvelope(data.envelope);
    if (envelope) {
      const pendingProposals = readPendingProposals(data.pendingProposals);
      return {
        status: "completed",
        envelope,
        pendingProposals,
      };
    }
  }

  if (data.state === "in_progress") {
    return {
      status: "in_progress",
      message:
        typeof data.message === "string" && data.message.trim().length > 0
          ? data.message
          : AI_TURN_IN_PROGRESS_MESSAGE,
    };
  }

  if (data.state === "failed") {
    return {
      status: "failed",
      message:
        typeof data.message === "string" && data.message.trim().length > 0
          ? data.message
          : "Lean AI could not finish this turn.",
    };
  }

  return { status: "unknown" };
}
