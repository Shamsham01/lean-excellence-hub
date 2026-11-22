import type { CasePendingAiProposal } from "@/lib/problem-solving/load-case-pending-ai-proposals";

export type SessionPendingProposalRow = {
  id: string;
  proposal_type: string;
  payload_json: Record<string, unknown>;
  human_explanation: string;
  status: string;
  semantic_stage_key?: string | null;
  ai_session_id?: string;
};

/**
 * Replaces client chat proposal state with the server session snapshot so
 * superseded / accepted rows do not linger in the canvas after a new turn.
 */
export function syncSessionPendingProposals(
  incoming: SessionPendingProposalRow[],
): CasePendingAiProposal[] {
  return incoming
    .filter((row) => row.status === "pending")
    .map((row) => ({
      id: row.id,
      proposal_type: row.proposal_type,
      payload_json: row.payload_json,
      human_explanation: row.human_explanation,
      status: row.status,
      ai_session_id: row.ai_session_id ?? "",
      semantic_stage_key: row.semantic_stage_key ?? null,
    }));
}

export function mergeServerAndChatPendingProposals(
  server: CasePendingAiProposal[],
  chat: CasePendingAiProposal[],
): CasePendingAiProposal[] {
  const byId = new Map<string, CasePendingAiProposal>();
  for (const row of server) {
    byId.set(row.id, row);
  }
  for (const row of chat) {
    if (row.status !== "pending") continue;
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}
