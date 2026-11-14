import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/modules/billing/assert-module-write", () => ({
  assertPlanModuleWrite: vi.fn(async () => ({ ok: true })),
}));

const rpcMock = vi.fn();
const loadContextMock = vi.fn();

vi.mock("@/lib/problem-solving/load-hypothesis-for-verification", () => ({
  loadHypothesisForVerification: (...args: unknown[]) =>
    loadContextMock(...args),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

describe("verify and reject hypothesis server actions", () => {
  it("returns eligibility error before verify RPC when blocked", async () => {
    loadContextMock.mockResolvedValueOnce({
      hypothesis: {
        id: "h1",
        status: "supported",
        evidence_links: [],
      },
      tests: [
        {
          id: "t1",
          hypothesis_id: "h1",
          test_question: "Q",
          expected_result: "E",
          method: "Interview",
          status: "active",
          conclusion: "supports",
          actual_result: "A",
          completed_date: "2026-01-02",
          created_by_membership_id: "m1",
          created_at: "2026-01-02T10:00:00Z",
        },
      ],
    });
    const { verifyCauseHypothesis } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await verifyCauseHypothesis(
      "h1",
      "case-1",
      "Looks verified to the team.",
    );
    expect(result.error).toBe("Confirm with observation, data or a trial");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects blank rejection rationale without RPC", async () => {
    const { rejectCauseHypothesis } =
      await import("@/app/(platform)/platform/problem-solving/actions");
    const result = await rejectCauseHypothesis("h1", "case-1", "   ");
    expect(result.error).toBe("What disproved it? is required.");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
