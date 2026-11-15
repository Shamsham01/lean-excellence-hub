import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/modules/billing/assert-module-write", () => ({
  assertPlanModuleWrite: vi.fn(async () => ({ ok: true })),
}));

const rpcMock = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

describe("deleteHypothesisTest server action", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: true, error: null });
  });

  it("calls delete_hypothesis_test with target_test_id", async () => {
    const { deleteHypothesisTest } =
      await import("@/app/(platform)/platform/problem-solving/actions");

    const result = await deleteHypothesisTest({
      testId: "test-id-408",
      caseId: "case-id-408",
    });

    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("delete_hypothesis_test", {
      target_test_id: "test-id-408",
    });
  });
});