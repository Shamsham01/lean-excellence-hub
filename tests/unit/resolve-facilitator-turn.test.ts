import { describe, expect, it } from "vitest";

import { AI_TURN_IN_PROGRESS_MESSAGE } from "@/platform/ai/ai-turn-messages";
import { resolveFacilitatorTurnPayload } from "@/lib/problem-solving/resolve-facilitator-turn";

describe("resolveFacilitatorTurnPayload", () => {
  it("accepts direct invoke payloads with envelope", () => {
    const resolved = resolveFacilitatorTurnPayload({
      runId: "r1",
      envelope: { message: "Done", proposals: [], source_refs: [] },
      pendingProposals: [],
    });
    expect(resolved.status).toBe("completed");
    if (resolved.status === "completed") {
      expect(resolved.envelope.message).toBe("Done");
    }
  });

  it("accepts reconcile payloads", () => {
    const resolved = resolveFacilitatorTurnPayload({
      state: "completed",
      envelope: { message: "Recovered", proposals: [], source_refs: [] },
    });
    expect(resolved.status).toBe("completed");
  });

  it("maps in-progress reconcile states", () => {
    const resolved = resolveFacilitatorTurnPayload({
      state: "in_progress",
      message: AI_TURN_IN_PROGRESS_MESSAGE,
    });
    expect(resolved.status).toBe("in_progress");
  });
});
