import { describe, expect, it } from "vitest";

import {
  guidedStageConfig,
  resolveViewStage,
} from "@/lib/problem-solving/guided-flow";
import type { MethodStage } from "@/lib/problem-solving/stages";

const stages: MethodStage[] = [
  {
    id: "s1",
    title: "Define",
    semantic_stage_key: "DEFINE",
    description: null,
    display_order: 1,
  },
  {
    id: "s2",
    title: "Cause",
    semantic_stage_key: "ROOT_CAUSE_ANALYSIS",
    description: null,
    display_order: 2,
  },
];

describe("problem solving guided flow", () => {
  it("returns stage copy and auto-draft prompt", () => {
    const config = guidedStageConfig("ROOT_CAUSE_ANALYSIS", stages[1]);
    expect(config.title).toMatch(/Cause analysis/i);
    expect(config.autoDraftPrompt).toMatch(/propose/i);
  });

  it("resolves the viewed stage by id", () => {
    expect(resolveViewStage(stages, "s2", "s1")?.id).toBe("s2");
    expect(resolveViewStage(stages, null, "s1")?.id).toBe("s1");
  });
});
