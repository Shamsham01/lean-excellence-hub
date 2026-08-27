import { describe, expect, it } from "vitest";

import {
  semanticStageLabel,
  sortMethodStages,
} from "@/lib/problem-solving/stages";

describe("problem solving stage helpers", () => {
  it("labels semantic stage keys", () => {
    expect(semanticStageLabel("DEFINE")).toBe("Define");
    expect(semanticStageLabel("CURRENT_CONDITION")).toBe("Current condition");
  });

  it("sorts method stages by display order", () => {
    const sorted = sortMethodStages([
      {
        id: "2",
        title: "Analyse",
        semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
        description: null,
        display_order: 4,
      },
      {
        id: "1",
        title: "Define",
        semantic_stage_key: "DEFINE",
        description: null,
        display_order: 1,
      },
    ]);
    expect(sorted.map((stage) => stage.semantic_stage_key)).toEqual([
      "DEFINE",
      "ROOT_CAUSE_ANALYSIS",
    ]);
  });
});
