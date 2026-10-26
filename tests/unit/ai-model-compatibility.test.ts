import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  applyReasoningCompatibility,
  prepareWorkflowModelCall,
  resolveWorkflowOutputTokens,
  resolveWorkflowReasoning,
  WORKFLOW_REASONING_DEFAULTS,
} from "@/platform/ai/model-compatibility";
import type { AiReasoningEffort } from "@/platform/ai/types";
import { AiProviderError } from "@/platform/ai/providers/errors";

describe("workflow reasoning", () => {
  it("uses the documented effort for each workflow", () => {
    expect(WORKFLOW_REASONING_DEFAULTS).toEqual({
      explain: "none",
      explain_follow_up: "none",
      setup_conversation: "low",
      setup_builder: "low",
      framework_builder: "medium",
      complex_reasoning: "medium",
      problem_solving: "medium",
      problem_solving_challenge: "high",
    });
  });

  it("lets AI_MODEL_REASONING replace the task default without changing the model", () => {
    const prepared = prepareWorkflowModelCall({
      workflow: "framework_builder",
      model: "gpt-6.1-terra",
      environment: { AI_MODEL_REASONING: "low" },
    });

    expect(prepared.model).toBe("gpt-6.1-terra");
    expect(prepared.reasoningEffort).toBe("low");
    expect(prepared.reasoning.source).toBe("environment_override");
    expect(prepared.reasoning.adjustedFrom).toBeNull();
  });

  it("rewrites none to low on gpt-6.1-sol and keeps the same model", () => {
    const decision = resolveWorkflowReasoning(
      "problem_solving",
      "gpt-6.1-sol",
      {
        AI_MODEL_REASONING: "none",
      },
    );

    expect(decision.effort).toBe("low");
    expect(decision.source).toBe("environment_override");
    expect(decision.adjustedFrom).toBe("none");
  });

  it("leaves none unchanged for an unknown remapped model", () => {
    const decision = resolveWorkflowReasoning("explain", "operator-economy", {
      AI_MODEL_REASONING: "none",
    });

    expect(decision.effort).toBe("none");
    expect(decision.adjustedFrom).toBeNull();
  });

  it("rejects an unsupported non-none effort instead of changing models", () => {
    expect(() =>
      applyReasoningCompatibility(
        "gpt-6.1-sol",
        "minimal" as AiReasoningEffort,
      ),
    ).toThrow(AiProviderError);

    try {
      applyReasoningCompatibility(
        "gpt-6.1-sol",
        "minimal" as AiReasoningEffort,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).diagnostics.model).toBe("gpt-6.1-sol");
      expect((error as AiProviderError).message).toContain("did not switch");
    }
  });

  it("includes reasoning reserve in the output budget and lets the env ceiling only lower it", () => {
    expect(resolveWorkflowOutputTokens("explain", "none", undefined)).toBe(
      1500,
    );
    expect(
      resolveWorkflowOutputTokens("setup_conversation", "low", undefined),
    ).toBe(3000);
    expect(resolveWorkflowOutputTokens("setup_builder", "low", undefined)).toBe(
      5500,
    );
    expect(
      resolveWorkflowOutputTokens("framework_builder", "medium", undefined),
    ).toBe(10_000);
    expect(
      resolveWorkflowOutputTokens("problem_solving", "medium", undefined),
    ).toBe(10_000);
    expect(
      resolveWorkflowOutputTokens(
        "problem_solving_challenge",
        "high",
        undefined,
      ),
    ).toBe(14_000);
    expect(
      resolveWorkflowOutputTokens("framework_builder", "medium", 9000),
    ).toBe(9000);
    expect(
      resolveWorkflowOutputTokens("framework_builder", "medium", 20_000),
    ).toBe(10_000);
  });

  it("does not throw a provider error for the supported Sol default", () => {
    expect(() =>
      prepareWorkflowModelCall({
        workflow: "problem_solving",
        model: "gpt-6.1-sol",
        environment: {},
      }),
    ).not.toThrow(AiProviderError);
  });
});
