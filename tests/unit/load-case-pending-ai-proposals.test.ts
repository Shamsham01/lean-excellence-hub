import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadCasePendingAiProposals } from "@/lib/problem-solving/load-case-pending-ai-proposals";

describe("loadCasePendingAiProposals", () => {
  it("filters proposals the member cannot display", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "p1",
              proposal_type: "problem_statement",
              payload_json: { statement: "x" },
              human_explanation: "manage only",
              status: "pending",
              display_permission_key: "problem_solving.manage",
              ai_session_id: "s1",
            },
            {
              id: "p2",
              proposal_type: "current_condition_item",
              payload_json: { statement: "y", category: "observation" },
              human_explanation: "contribute",
              status: "pending",
              display_permission_key: "problem_solving.contribute",
              ai_session_id: "s1",
            },
          ],
          error: null,
        }),
      })),
    };

    const result = await loadCasePendingAiProposals(
      supabase as never,
      "case-1",
      { canManage: false, canContribute: true },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("p2");
  });
});
