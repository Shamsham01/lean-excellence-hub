/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/modules/billing/assert-module-write", () => ({
  assertPlanModuleWrite: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/platform/ai/config", () => ({
  isApplicationAiProviderAvailable: () => true,
}));

const rpcMock = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

describe("draftProblemSolvingStage closed-case guard", () => {
  it("rejects stage drafts when the case is not open", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { status: "closed" },
      error: null,
    });

    const { draftProblemSolvingStage } =
      await import("@/app/(platform)/platform/problem-solving/ai/actions");

    const result = await draftProblemSolvingStage({
      caseId: "case-closed",
      stageKey: "ROOT_CAUSE_ANALYSIS",
      message: "Draft",
      idempotencyKey: "idem-1",
    });

    expect(result.error).toMatch(/closed or cancelled/i);
    expect(result.ok).toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith("get_problem_solving_detail", {
      target_case_id: "case-closed",
    });
  });
});
