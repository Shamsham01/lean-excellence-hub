import {
  callProblemSolvingRpc,
  untypedFrom,
} from "@/lib/problem-solving/supabase-untyped";
import type {
  ProblemSolvingCaseDetail,
  ProblemSolvingHypothesis,
  ProblemSolvingHypothesisTest,
} from "@/lib/problem-solving/types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function loadHypothesisForVerification(
  caseId: string,
  hypothesisId: string,
): Promise<{
  hypothesis: ProblemSolvingHypothesis;
  tests: ProblemSolvingHypothesisTest[];
} | null> {
  const supabase = await createServerSupabaseClient();
  const { data: detail, error: detailError } =
    await callProblemSolvingRpc<ProblemSolvingCaseDetail>(
      supabase,
      "get_problem_solving_detail",
      { target_case_id: caseId },
    );
  if (detailError || !detail) {
    return null;
  }
  const hypothesis = detail.hypotheses?.find((row) => row.id === hypothesisId);
  if (!hypothesis) {
    return null;
  }

  const testsResult = await untypedFrom(
    supabase,
    "problem_solving_hypothesis_tests",
  )
    .select(
      "id, hypothesis_id, test_question, expected_result, method, conclusion, actual_result, completed_date, created_by_membership_id, created_at",
    )
    .eq("hypothesis_id", hypothesisId)
    .order("created_at", { ascending: true });

  if (testsResult.error) {
    throw new Error(testsResult.error.message);
  }

  const tests = (testsResult.data ?? []) as ProblemSolvingHypothesisTest[];
  return { hypothesis, tests };
}
