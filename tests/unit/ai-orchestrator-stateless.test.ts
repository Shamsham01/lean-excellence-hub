import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AIProvider,
  CreateResponseInput,
  CreateResponseResult,
  FacilitatorEnvelope,
} from "@/platform/ai/types";

vi.mock("server-only", () => ({}));

const createResponseCalls: CreateResponseInput[] = [];

class TrackingOpenAiProvider implements AIProvider {
  readonly name = "openai";

  async healthCheck() {
    return { ok: true, provider: this.name };
  }

  async createResponse(
    input: CreateResponseInput,
  ): Promise<CreateResponseResult> {
    createResponseCalls.push(structuredClone(input));

    if (createResponseCalls.length === 1) {
      return {
        responseId: "resp_tool_turn",
        outputText: "",
        toolCalls: [
          {
            id: "call-1",
            name: "get_problem_solving_case_overview",
            arguments: {},
          },
        ],
        usage: {
          inputTokens: 100,
          outputTokens: 20,
          cachedInputTokens: 0,
          reasoningTokens: 10,
        },
      };
    }

    const structuredOutput: FacilitatorEnvelope = {
      message: "Based on authorised case context, consider a hypothesis test.",
      observations: [],
      questions: [],
      warnings: [],
      source_refs: [],
      proposals: [
        {
          proposal_type: "hypothesis",
          payload: {
            statement: "Thermal expansion shifts seal alignment.",
            category: "technical",
            rationale: "Defects cluster after sustained hot runs.",
          },
          explanation: "Testable technical hypothesis.",
        },
      ],
    };

    return {
      responseId: "resp_final_turn",
      outputText: structuredOutput.message,
      structuredOutput,
      toolCalls: [],
      usage: {
        inputTokens: 180,
        outputTokens: 90,
        cachedInputTokens: 0,
        reasoningTokens: 20,
      },
    };
  }
}

vi.mock("@/platform/ai/registry", () => ({
  resolveAIProvider: () => new TrackingOpenAiProvider(),
}));

vi.mock("@/platform/ai/config", () => ({
  AI_DEFAULTS: {
    model: "gpt-test",
    maxOutputTokens: 6000,
    maxToolCalls: 8,
    runTimeoutMs: 45_000,
  },
  getAiEnvironment: () => ({
    AI_MODEL_DEFAULT: "gpt-test",
    AI_MODEL_REASONING: "low",
  }),
  isApplicationAiProviderAvailable: () => true,
}));

vi.mock("@/platform/ai/tools/problem-solving-executors", () => ({
  executeProblemSolvingTool: vi.fn().mockResolvedValue({
    status: "succeeded",
    resultMetadata: { case_title: "Hot-running seal defects" },
    sourceRefsAdded: [],
  }),
}));

import { runAiTurn } from "@/platform/ai/orchestrator";

describe("runAiTurn stateless tool continuation", () => {
  beforeEach(() => {
    createResponseCalls.length = 0;
  });

  it("replays authorised tool results without previous_response_id chaining", async () => {
    const supabase = {
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === "start_ai_run") {
          return Promise.resolve({ data: "run-1", error: null });
        }
        if (name === "finish_ai_run") {
          return Promise.resolve({ data: "assistant-1", error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    const result = await runAiTurn({
      supabase: supabase as never,
      sessionId: "session-1",
      caseId: "case-1",
      mode: "facilitate",
      stageKey: "ANALYSE",
      userMessage:
        "Please propose hypothesis for the hot-running defect pattern.",
      idempotencyKey: "idem-1",
      conversationHistory: [],
    });

    expect(createResponseCalls).toHaveLength(2);
    expect(createResponseCalls[0]).not.toHaveProperty("previousResponseId");
    expect(createResponseCalls[1]).not.toHaveProperty("previousResponseId");

    const secondTurnMessages = createResponseCalls[1]?.messages ?? [];
    expect(secondTurnMessages.at(-1)?.content).toContain(
      "Authorised tool results:",
    );
    expect(secondTurnMessages.at(-1)?.content).toContain(
      "get_problem_solving_case_overview",
    );
    expect(secondTurnMessages.at(-1)?.content).toContain(
      "Hot-running seal defects",
    );

    expect(result.envelope.proposals).toHaveLength(1);
    expect(result.envelope.proposals[0]?.proposal_type).toBe("hypothesis");
    expect(result.envelope.message).toBe(
      "Based on authorised case context, consider a hypothesis test.",
    );
  });
});
