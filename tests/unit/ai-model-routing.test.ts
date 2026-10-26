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
    expect(resolveLogicalModelId("economy", env)).toBe("gpt-6-luna");
    expect(resolveLogicalModelId("standard", env)).toBe("gpt-6.1-terra");
    expect(resolveLogicalModelId("deep", env)).toBe("gpt-6.1-sol");
    expect(problemSolvingModelId(env)).toBe("gpt-6.1-sol");
    expect(AI_MODEL_CLASS_DEFAULTS.economy).not.toMatch(
      /gpt-4o-mini|o4-mini|chatgpt|gpt-4\.1/i,
    );
  });

  it("honours server-side class overrides without exposing them as defaults", () => {
    const env = parseAiEnvironment({
      AI_MODEL_ECONOMY: "operator-economy",
      AI_MODEL_STANDARD: "operator-standard",
      AI_MODEL_DEEP: "operator-deep",
    });
    expect(resolveLogicalModelId("economy", env)).toBe("operator-economy");
    expect(resolveLogicalModelId("standard", env)).toBe("operator-standard");
    expect(resolveLogicalModelId("deep", env)).toBe("operator-deep");
    expect(AI_MODEL_CLASS_DEFAULTS.economy).toBe("gpt-6-luna");
  });

  it("keeps Problem Solving on AI_MODEL_DEFAULT rather than class routing", () => {
    const env = parseAiEnvironment({
      AI_MODEL_DEFAULT: "operator-problem-solving",
      AI_MODEL_ECONOMY: "gpt-6-luna",
      AI_MODEL_DEEP: "gpt-6.1-sol",
    });
    expect(problemSolvingModelId(env)).toBe("operator-problem-solving");
    expect(problemSolvingModelId(env)).not.toBe(
      resolveLogicalModelId("economy", env),
    );
    expect(problemSolvingModelId(env)).not.toBe(
      resolveLogicalModelId("deep", env),
    );
  });

  it("does not route standard tasks through the Problem Solving model", () => {
    const env = parseAiEnvironment({
      AI_MODEL_DEFAULT: "gpt-6.1-sol",
    });
    expect(resolveLogicalModelId("standard", env)).toBe("gpt-6.1-terra");
    expect(resolveLogicalModelId("economy", env)).toBe("gpt-6-luna");
    expect(problemSolvingModelId(env)).toBe("gpt-6.1-sol");
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
