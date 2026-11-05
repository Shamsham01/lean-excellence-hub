import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CasePendingAiProposal = {
  id: string;
  proposal_type: string;
  payload_json: Record<string, unknown>;
  human_explanation: string;
  status: string;
  ai_session_id: string;
};

function canDisplayProposal(
  displayPermissionKey: string | null,
  permissions: { canManage: boolean; canContribute: boolean },
): boolean {
  if (displayPermissionKey === "problem_solving.contribute") {
    return permissions.canContribute || permissions.canManage;
  }
  return permissions.canManage;
}

export async function loadCasePendingAiProposals(
  supabase: SupabaseClient,
  caseId: string,
  permissions: { canManage: boolean; canContribute: boolean },
): Promise<CasePendingAiProposal[]> {
  const { data, error } = await supabase
    .from("ai_proposals")
    .select(
      "id, proposal_type, payload_json, human_explanation, status, display_permission_key, ai_session_id",
    )
    .eq("problem_solving_case_id", caseId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data
    .filter((row) =>
      canDisplayProposal(row.display_permission_key, permissions),
    )
    .map((row) => ({
      id: row.id,
      proposal_type: row.proposal_type,
      payload_json: (row.payload_json ?? {}) as Record<string, unknown>,
      human_explanation: row.human_explanation,
      status: row.status,
      ai_session_id: row.ai_session_id,
    }));
}
