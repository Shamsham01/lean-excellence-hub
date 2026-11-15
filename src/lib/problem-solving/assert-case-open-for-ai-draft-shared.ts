import { callProblemSolvingRpc } from "@/lib/problem-solving/supabase-untyped";
import { isProblemSolvingCaseOpenForAiDraft } from "@/lib/problem-solving/status";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROBLEM_SOLVING_CASE_CLOSED_AI_DRAFT_MESSAGE =
  "This case is closed or cancelled; Lean AI is not available on this case.";

export async function assertProblemSolvingCaseOpenForAiDraftWithClient(
  supabase: SupabaseClient,
  caseId: string,
): Promise<{ ok: true } | { error: string }> {
  const detailResult = await callProblemSolvingRpc<ProblemSolvingCaseDetail>(
    supabase,
    "get_problem_solving_detail",
    { target_case_id: caseId },
  );
  if (detailResult.error || !detailResult.data) {
    return { error: "Problem solving case not found." };
  }
  if (!isProblemSolvingCaseOpenForAiDraft(detailResult.data.status)) {
    return { error: PROBLEM_SOLVING_CASE_CLOSED_AI_DRAFT_MESSAGE };
  }
  return { ok: true };
}
