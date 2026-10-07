import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseAiEnvironment } from "@/platform/ai/config";
import {
  AI_MODEL_CLASS_DEFAULTS,
  assertModelClassNotEscalated,
  problemSolvingModelId,
  resolveLogicalModelId,
  selectCoachTaskModelClass,
} from "@/platform/ai/model-routing";

describe("logical model routing", () => {
  it("defaults ordinary Coach Explain and follow-up to economy", () => {
    expect(selectCoachTaskModelClass("explain")).toBe("economy");
    expect(selectCoachTaskModelClass("explain_follow_up")).toBe("economy");
  });

  it("requires an explicit setup conversation to use standard", () => {
    expect(selectCoachTaskModelClass("setup_conversation")).toBe("standard");
  });

  it("routes the Maturity framework builder to standard", () => {
    expect(selectCoachTaskModelClass("framework_builder")).toBe("standard");
  });

  it("routes module setup builders to standard", () => {
    expect(selectCoachTaskModelClass("setup_builder")).toBe("standard");
  });

  it("reserves deep for complex reasoning", () => {
    expect(selectCoachTaskModelClass("complex_reasoning")).toBe("deep");
  });

  it("maps classes to official OpenAI API identifiers, not ChatGPT product names", () => {
    const env = parseAiEnvironment({});
    expect(resolveLogicalModelId("economy", env)).toBe("gpt-4.1-nano");
    expect(resolveLogicalModelId("standard", env)).toBe("gpt-4.1-mini");
    expect(resolveLogicalModelId("deep", env)).toBe("gpt-4.1");
    expect(AI_MODEL_CLASS_DEFAULTS.economy).not.toMatch(
      /gpt-4o-mini|o4-mini|chatgpt/i,
    );
  });

  it("honours server-side class overrides without exposing them as defaults", () => {
    const env = parseAiEnvironment({
      AI_MODEL_ECONOMY: "gpt-6-luna",
      AI_MODEL_STANDARD: "gpt-4.1-mini",
      AI_MODEL_DEEP: "gpt-6.1-sol",
    });
    expect(resolveLogicalModelId("economy", env)).toBe("gpt-6-luna");
    expect(resolveLogicalModelId("deep", env)).toBe("gpt-6.1-sol");
  });

  it("keeps Problem Solving on AI_MODEL_DEFAULT rather than class routing", () => {
    const env = parseAiEnvironment({
      AI_MODEL_DEFAULT: "gpt-4.1-mini",
      AI_MODEL_ECONOMY: "gpt-4.1-nano",
      AI_MODEL_DEEP: "gpt-4.1",
    });
    expect(problemSolvingModelId(env)).toBe("gpt-4.1-mini");
    expect(problemSolvingModelId(env)).not.toBe(
      resolveLogicalModelId("economy", env),
    );
  });

  it("falls standard back to AI_MODEL_DEFAULT when the class override is omitted", () => {
    const env = parseAiEnvironment({
      AI_MODEL_DEFAULT: "operator-standard-model",
    });
    expect(resolveLogicalModelId("standard", env)).toBe(
      "operator-standard-model",
    );
  });

  it("refuses silent model-class escalation", () => {
    expect(() => assertModelClassNotEscalated("deep", "economy")).toThrow(
      /not permitted/,
    );
    expect(() =>
      assertModelClassNotEscalated("economy", "economy"),
    ).not.toThrow();
  });
});
