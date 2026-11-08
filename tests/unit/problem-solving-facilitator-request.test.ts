import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prepareWorkflowModelCall } from "@/platform/ai/model-compatibility";
import {
  PROBLEM_SOLVING_FACILITATOR_MAX_TOOLS,
  buildProblemSolvingFacilitatorProviderTools,
  facilitatorIncludesOperationalRetrieval,
  problemSolvingFacilitatorToolNames,
} from "@/platform/ai/problem-solving-facilitator-request";
import {
  buildSystemPrompt,
  PROMPT_VERSION,
} from "@/platform/ai/prompts/problem-solving-facilitator";
import { buildResponsesCreateParams } from "@/platform/ai/providers/openai-responses-core";
import { PROBLEM_SOLVING_TOOLS } from "@/platform/ai/tools/problem-solving-schemas";

describe("problem solving facilitator provider request", () => {
  it("keeps facilitate on the v7-sized Problem Solving tool surface (25 tools)", () => {
    expect(facilitatorIncludesOperationalRetrieval("facilitate")).toBe(false);
    const tools = buildProblemSolvingFacilitatorProviderTools({
      mode: "facilitate",
    });
    expect(tools).toHaveLength(PROBLEM_SOLVING_TOOLS.length);
    expect(problemSolvingFacilitatorToolNames("facilitate")).toHaveLength(25);
    expect(
      tools.every((tool) =>
        (PROBLEM_SOLVING_TOOLS as readonly string[]).includes(
          String(tool.name),
        ),
      ),
    ).toBe(true);
  });

  it("adds operational retrieval only for ask, review, and challenge", () => {
    for (const mode of ["ask", "review", "challenge"] as const) {
      expect(facilitatorIncludesOperationalRetrieval(mode)).toBe(true);
      expect(
        buildProblemSolvingFacilitatorProviderTools({ mode }),
      ).toHaveLength(27);
    }
  });

  it("stays within the agreed facilitator tool budget", () => {
    for (const mode of ["facilitate", "ask", "review", "challenge"] as const) {
      expect(
        buildProblemSolvingFacilitatorProviderTools({ mode }).length,
      ).toBeLessThanOrEqual(PROBLEM_SOLVING_FACILITATOR_MAX_TOOLS);
    }
  });

  it("matches v7 facilitate request bytes without operational schemas", () => {
    const stage = "ROOT_CAUSE_ANALYSIS";
    const prompt = buildSystemPrompt("facilitate", stage, {
      viewStageKey: stage,
      currentStageKey: stage,
    });
    const prepared = prepareWorkflowModelCall({
      workflow: "problem_solving_facilitate",
      model: "gpt-6.1-sol",
      environment: {},
    });
    const tools = buildProblemSolvingFacilitatorProviderTools({
      mode: "facilitate",
    });
    const params = buildResponsesCreateParams({
      model: "gpt-6.1-sol",
      systemPrompt: prompt,
      messages: [{ role: "user", content: "RCA for seal defects" }],
      tools,
      maxOutputTokens: prepared.maxOutputTokens,
      timeoutMs: 24_000,
      maxRetries: 0,
      reasoningEffort: prepared.reasoningEffort,
      expectsStructuredOutput: true,
    });
    const requestBytes = JSON.stringify(params).length;
    expect(requestBytes).toBeLessThanOrEqual(19_000);
    expect(prepared.maxOutputTokens).toBe(5_000);
    expect(prepared.reasoningEffort).toBe("low");
    expect(PROMPT_VERSION).toBe("v9");
  });
});
