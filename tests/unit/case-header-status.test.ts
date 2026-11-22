import { describe, expect, it } from "vitest";

import { closureOutcomeLabel } from "@/lib/problem-solving/closure";
import { problemSolvingStatusLabel } from "@/lib/problem-solving/status";

describe("case header status presentation", () => {
  it("maps closed resolved outcome labels", () => {
    expect(problemSolvingStatusLabel("closed")).toBe("Closed");
    expect(closureOutcomeLabel("resolved_verified_cause")).toBe(
      "Resolved (verified cause)",
    );
  });
});
