import { describe, expect, it } from "vitest";

import { formatOverlapWarning, overlapSeverity } from "@/lib/benefits/overlap";

describe("benefit overlap helpers", () => {
  it("returns no warning when allocation is within 100%", () => {
    expect(formatOverlapWarning(100, ["BEN-001"])).toBeNull();
    expect(overlapSeverity(100)).toBe("none");
  });

  it("warns when allocation exceeds 100%", () => {
    expect(formatOverlapWarning(110, ["BEN-001", "BEN-002"])).toContain(
      "BEN-001",
    );
    expect(overlapSeverity(110)).toBe("warning");
  });

  it("marks severe overlap as critical", () => {
    expect(overlapSeverity(140)).toBe("critical");
  });
});
