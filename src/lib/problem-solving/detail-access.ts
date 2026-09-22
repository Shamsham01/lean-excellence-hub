import "server-only";

import { resolveProblemSolvingRequiredData } from "@/lib/problem-solving/resolve-supabase-load";

export async function resolveProblemSolvingDetailAccess<T>(input: {
  data: T | null;
  error: unknown;
  operation?: string;
}): Promise<T> {
  return resolveProblemSolvingRequiredData(
    input,
    input.operation ?? "get_problem_solving_detail",
  );
}
