import { describe, expect, it } from "vitest";

import {
  AI_TURN_UNCERTAIN_COMPLETION_MESSAGE,
  problemSolvingClientTurnError,
  retainProblemSolvingTurnKey,
} from "@/platform/ai/ai-turn-messages";

describe("problem solving turn client recovery", () => {
  it("keeps the idempotency key when the host returns a non-RSC response", () => {
    const message = "An unexpected response was received from the server.";
    expect(retainProblemSolvingTurnKey(message)).toBe(true);
    expect(problemSolvingClientTurnError(message)).toBe(
      AI_TURN_UNCERTAIN_COMPLETION_MESSAGE,
    );
  });

  it("maps proxy reset bodies to the uncertain completion message", () => {
    expect(problemSolvingClientTurnError("upstream reset")).toBe(
      AI_TURN_UNCERTAIN_COMPLETION_MESSAGE,
    );
    expect(retainProblemSolvingTurnKey("upstream reset")).toBe(true);
  });

  it("keeps the key when billing uncertainty is reported", () => {
    expect(
      retainProblemSolvingTurnKey(
        "Lean AI lost contact with the provider before this turn finished.",
      ),
    ).toBe(true);
  });

  it("keeps the key while a turn is unfinished and clears it after a settled timeout", () => {
    expect(
      retainProblemSolvingTurnKey(
        "Lean AI is still finishing this request. Wait a moment.",
      ),
    ).toBe(true);
    expect(
      retainProblemSolvingTurnKey(
        "Lean AI did not confirm whether this turn finished.",
      ),
    ).toBe(true);
    expect(
      retainProblemSolvingTurnKey(
        "Lean AI took too long to finish this turn. Nothing was saved to your case.",
      ),
    ).toBe(false);
  });
});
