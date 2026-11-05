import { describe, expect, it, vi } from "vitest";

import { AI_TURN_UNCERTAIN_COMPLETION_MESSAGE } from "@/platform/ai/ai-turn-messages";
import {
  invokeProblemSolvingTurnAction,
  normalizeProblemSolvingTurnFailure,
  shouldRetainProblemSolvingTurnKey,
} from "@/lib/problem-solving/problem-solving-ai-turn-client";

describe("problem-solving-ai-turn-client", () => {
  it("maps Next.js transport failures to uncertain completion copy", () => {
    expect(
      normalizeProblemSolvingTurnFailure(
        "An unexpected response was received from the server.",
      ),
    ).toBe(AI_TURN_UNCERTAIN_COMPLETION_MESSAGE);
    expect(
      shouldRetainProblemSolvingTurnKey(
        "An unexpected response was received from the server.",
      ),
    ).toBe(true);
  });

  it("reconciles after a transport failure when a turn key is retained", async () => {
    const reconcile = vi.fn().mockResolvedValue({
      ok: true as const,
      data: { sessionId: "s1", runId: "r1", pendingProposalCount: 2 },
    });
    const invoke = vi.fn().mockRejectedValue(
      new Error("An unexpected response was received from the server."),
    );

    const result = await invokeProblemSolvingTurnAction({
      invoke,
      reconcile,
    });

    expect(reconcile).toHaveBeenCalledOnce();
    expect(result.data).toMatchObject({ pendingProposalCount: 2 });
  });

  it("returns mapped errors from server-action error fields", async () => {
    const result = await invokeProblemSolvingTurnAction({
      invoke: async () => ({
        error: "An unexpected response was received from the server.",
      }),
    });
    expect(result.error).toBe(AI_TURN_UNCERTAIN_COMPLETION_MESSAGE);
  });
});
