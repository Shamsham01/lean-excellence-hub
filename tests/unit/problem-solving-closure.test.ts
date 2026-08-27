import { describe, expect, it } from "vitest";

import { closureOutcomeLabel } from "@/lib/problem-solving/closure";

describe("problem solving closure helpers", () => {
  it("labels closure outcomes distinctly from cancellation", () => {
    expect(closureOutcomeLabel("resolved_verified_cause")).toContain("verified cause");
    expect(closureOutcomeLabel("resolved_without_verified_cause")).toContain("unverified");
    expect(closureOutcomeLabel("transferred")).toBe("Transferred");
    expect(closureOutcomeLabel(null)).toBe("—");
  });
});
