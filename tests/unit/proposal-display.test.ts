import { describe, expect, it } from "vitest";

import {
  formatProposalPreview,
  proposalTypeLabel,
} from "@/lib/problem-solving/proposal-display";

describe("proposal-display", () => {
  it("maps known proposal types to human labels", () => {
    expect(proposalTypeLabel("problem_statement")).toBe("Problem statement");
    expect(proposalTypeLabel("current_condition_item")).toBe(
      "Current condition",
    );
  });

  it("unwraps statement fields instead of showing raw JSON", () => {
    const text = formatProposalPreview(
      "problem_statement",
      { statement: "On Packing Line 1, film wanders after splices." },
      "fallback",
    );
    expect(text).toBe("On Packing Line 1, film wanders after splices.");
    expect(text).not.toContain("{");
  });

  it("prefers structured current condition statements", () => {
    expect(
      formatProposalPreview(
        "current_condition_item",
        {
          category: "performance",
          statement: "Measured defect rate spikes after changeovers.",
        },
        "",
      ),
    ).toBe("Measured defect rate spikes after changeovers.");
  });
});
