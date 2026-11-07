import { describe, expect, it } from "vitest";

import { safeValidateProposalPayload } from "@/platform/ai/proposals/contracts";

describe("fishbone_cause proposal payload", () => {
  it("normalizes category aliases before validation", () => {
    const motherNature = safeValidateProposalPayload("fishbone_cause", {
      label: "Humidity swings in the warehouse",
      category: "Mother Nature",
    });
    expect(motherNature.success).toBe(true);
    expect(motherNature.success).toBe(true);
    if (!motherNature.success) return;
    expect((motherNature.data as { category: string }).category).toBe(
      "environment",
    );

    const people = safeValidateProposalPayload("fishbone_cause", {
      label: "Shift handover gaps",
      category: "People",
    });
    expect(people.success).toBe(true);
    if (!people.success) return;
    expect((people.data as { category: string }).category).toBe("man");
  });
});
