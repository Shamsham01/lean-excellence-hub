import { describe, expect, it } from "vitest";

import {
  countGembaObservationsByType,
  formatGembaObservationType,
  formatGembaVersionStatus,
  formatGembaWalkStatus,
} from "@/modules/operational/gemba-display";

describe("Gemba display labels", () => {
  it("formats walk statuses without exposing raw enums", () => {
    expect(formatGembaWalkStatus("in_progress")).toBe("In progress");
    expect(formatGembaWalkStatus("completed")).toBe("Completed");
  });

  it("formats observation types without exposing raw enums", () => {
    expect(formatGembaObservationType("positive_practice")).toBe(
      "Positive practice",
    );
    expect(formatGembaObservationType("improvement_opportunity")).toBe(
      "Improvement opportunity",
    );
    expect(formatGembaObservationType("issue")).toBe("Issue");
  });

  it("formats version statuses without exposing raw enums", () => {
    expect(formatGembaVersionStatus("published")).toBe("Published");
    expect(formatGembaVersionStatus("draft")).toBe("Draft");
  });

  it("counts observations by canonical type", () => {
    expect(
      countGembaObservationsByType([
        { observation_type: "issue" },
        { observation_type: "issue" },
        { observation_type: "positive_practice" },
      ]),
    ).toEqual({
      positive_practice: 1,
      improvement_opportunity: 0,
      issue: 2,
    });
  });
});
