import { describe, expect, it } from "vitest";

import { formatFiveSAuditScoreBand } from "@/modules/5s/audit-status";
import {
  scoreAnswerFromMetadata,
  weightedMean,
} from "@/modules/maturity/scoring";

describe("five_s scoring helpers", () => {
  it.each([
    ["below_standard", "Below standard"],
    ["at_standard", "At standard"],
    ["meets_standard", "Meets standard"],
    ["above_standard", "Above standard"],
    ["unknown", "Unknown"],
    ["needs_review", "Needs review"],
    [null, null],
  ])("formats the %s audit score band", (status, label) => {
    expect(formatFiveSAuditScoreBand(status)).toBe(label);
  });

  it("scores yes_no answers for 5S audits", () => {
    const metadata = { type: "yes_no" as const, yes_value: 100, no_value: 0 };
    expect(
      scoreAnswerFromMetadata("yes_no", true, metadata, { text_value: "yes" }),
    ).toBe(100);
    expect(
      scoreAnswerFromMetadata("yes_no", true, metadata, { text_value: "no" }),
    ).toBe(0);
  });

  it("computes section weighted mean for all-yes 5S sections", () => {
    expect(
      weightedMean([
        { value: 100, weight: 1 },
        { value: 100, weight: 1 },
        { value: 100, weight: 1 },
        { value: 100, weight: 1 },
        { value: 100, weight: 1 },
      ]),
    ).toBe(100);
  });
});
