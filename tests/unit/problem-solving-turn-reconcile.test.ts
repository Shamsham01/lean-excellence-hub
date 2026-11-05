import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/platform/ai/recover-problem-solving-ai-runs", () => ({
  recoverProblemSolvingAiRunsForCase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/platform/ai/stale-ai-run-recovery", () => ({
  recoverStaleAiRunsForSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/platform/ai/ai-run-reconciliation", () => ({
  reconcileCompletedAiRunTurn: vi.fn(),
}));

import { AI_TURN_INTERRUPTED_BILLING_MESSAGE } from "@/platform/ai/ai-turn-messages";
import { reconcileProblemSolvingAiTurnByIdempotencyKey } from "@/platform/ai/problem-solving-turn-reconcile";

describe("reconcileProblemSolvingAiTurnByIdempotencyKey", () => {
  it("returns billing-safe copy when the run failed after provider dispatch", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "run-1",
            status: "failed",
            ai_session_id: "session-1",
            error_category: "interrupted_unknown_billing",
            final_output: null,
          },
          error: null,
        }),
      })),
    };

    const result = await reconcileProblemSolvingAiTurnByIdempotencyKey(
      supabase as never,
      {
        caseId: "case-1",
        sessionId: "session-1",
        idempotencyKey: "idem-1",
      },
    );

    expect(result).toEqual({
      state: "failed",
      message: AI_TURN_INTERRUPTED_BILLING_MESSAGE,
      runId: "run-1",
    });
  });
});
