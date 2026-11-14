import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/modules/billing/assert-module-write", () => ({
  assertPlanModuleWrite: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/problem-solving/assert-can-edit-case-definition", () => ({
  assertCanEditCaseDefinition: vi.fn(async () => ({ ok: true })),
}));

const rpcMock = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

describe("problem solving case definition server actions", () => {
  it("calls update_problem_solving_problem_statement for active cases", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    const { updateProblemSolvingProblemStatement } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await updateProblemSolvingProblemStatement(
      "case-1",
      "Updated statement",
    );
    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "update_problem_solving_problem_statement",
      {
        target_case_id: "case-1",
        target_problem_statement: "Updated statement",
      },
    );
  });

  it("calls update_problem_solving_target_condition for active cases", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    const { updateProblemSolvingTargetCondition } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await updateProblemSolvingTargetCondition(
      "case-1",
      "Target achieved",
    );
    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "update_problem_solving_target_condition",
      {
        target_case_id: "case-1",
        target_target_condition: "Target achieved",
      },
    );
  });
});
