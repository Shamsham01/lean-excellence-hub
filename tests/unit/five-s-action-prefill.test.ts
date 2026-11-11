import { describe, expect, it } from "vitest";

import { buildFiveSActionPrefill } from "@/modules/5s/build-action-prefill";

describe("buildFiveSActionPrefill", () => {
  it("includes location, question, and numeric score", () => {
    const result = buildFiveSActionPrefill({
      questionPrompt: "Are walkways clear?",
      questionType: "score",
      answer: { number_value: 4 },
      standardName: "Workshop 5S",
      unitName: "Unit A",
    });
    expect(result.title).toBe("Are walkways clear?");
    expect(result.description).toContain("Workshop 5S · Unit A");
    expect(result.description).toContain("Response: 4");
  });
});
