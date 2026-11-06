import { describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/modules/platform-shell/permissions", () => ({
  currentMemberHasPermission: vi.fn().mockResolvedValue(true),
}));

const { acceptAiProposal } = await import("@/platform/ai/proposals/acceptance");

function createProposalChain(row: Record<string, unknown>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
}

describe("acceptAiProposal case-level outcomes", () => {
  it("passes problem_solving_case_id when accepting target_condition", async () => {
    rpcMock.mockImplementation(
      async (name: string, args: Record<string, unknown>) => {
        if (name === "update_problem_solving_target_condition") {
          return { error: null };
        }
        if (name === "record_ai_proposal_accepted") {
          expect(args.target_problem_solving_case_id).toBe("case-1");
          expect(args.target_ai_proposal_id).toBe("prop-1");
          return { error: null };
        }
        return { error: null };
      },
    );

    const fromMock = vi.fn(() =>
      createProposalChain({
        id: "prop-1",
        status: "pending",
        proposal_type: "target_condition",
        problem_solving_case_id: "case-1",
        ai_session_id: "sess-1",
        ai_run_id: "run-1",
      }),
    );

    const supabase = { from: fromMock, rpc: rpcMock } as never;

    await acceptAiProposal(supabase, "prop-1", {
      statement: "Film tracks true after each splice.",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "record_ai_proposal_accepted",
      expect.objectContaining({
        target_problem_solving_case_id: "case-1",
      }),
    );
  });
});
