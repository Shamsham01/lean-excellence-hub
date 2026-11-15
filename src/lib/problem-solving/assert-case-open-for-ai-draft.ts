import "server-only";

import { assertProblemSolvingCaseOpenForAiDraftWithClient } from "@/lib/problem-solving/assert-case-open-for-ai-draft-shared";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export { PROBLEM_SOLVING_CASE_CLOSED_AI_DRAFT_MESSAGE } from "@/lib/problem-solving/assert-case-open-for-ai-draft-shared";

export async function assertProblemSolvingCaseOpenForAiDraft(
  caseId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  return assertProblemSolvingCaseOpenForAiDraftWithClient(supabase, caseId);
}
