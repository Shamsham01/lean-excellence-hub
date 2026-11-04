import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AIProvider,
  CreateResponseInput,
  CreateResponseResult,
  FacilitatorEnvelope,
} from "@/platform/ai/types";

vi.mock("server-only", () => ({}));

const { getAiEnvironment } = vi.hoisted(() => ({
  getAiEnvironment: vi.fn((): Record<string, unknown> => ({
    AI_MODEL_DEFAULT: "gpt-test",
    AI_MODEL_REASONING: "low" as const,
  })),
}));

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

vi.mock("@/platform/ai/stale-ai-run-recovery", () => ({
  recoverStaleAiRunsForSession: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/platform/ai/config", () => ({
  AI_DEFAULTS: {
    model: "gpt-test",
    maxOutputTokens: 6000,
    maxToolCalls: 8,
    runTimeoutMs: 45_000,
    turnWallClockMs: 50_000,
  },
  getAiEnvironment: () => getAiEnvironment(),
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

function sessionLookup(caseId: string) {
  return vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: {
            problem_solving_case_id: caseId,
            context_type: "problem_solving",
          },
          error: null,
        }),
      }),
    }),
  }));
}

describe("runAiTurn stateless tool continuation", () => {
  beforeEach(() => {
    createResponseCalls.length = 0;
    getAiEnvironment.mockReturnValue({
      AI_MODEL_DEFAULT: "gpt-test",
      AI_MODEL_REASONING: "low",
    });
  });

  it("replays authorised tool results without previous_response_id chaining", async () => {
    const supabase = {
      from: sessionLookup("case-1"),
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
    expect(createResponseCalls[0]?.model).toBe("gpt-test");
    expect(createResponseCalls[0]?.reasoningEffort).toBe("low");
    expect(createResponseCalls[0]?.timeoutMs).toBeLessThanOrEqual(45_000);
    expect(createResponseCalls[1]?.reasoningEffort).toBe("low");
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

  it("uses high reasoning for challenge mode without changing the Problem Solving model", async () => {
    getAiEnvironment.mockReturnValue({
      AI_MODEL_DEFAULT: "gpt-test",
      AI_MODEL_REASONING: undefined as never,
    });
    const finishPayloads: Array<{
      target_manifest_json: Record<string, unknown>;
    }> = [];
    const supabase = {
      from: sessionLookup("case-1"),
      rpc: vi.fn().mockImplementation((name: string, args: unknown) => {
        if (name === "start_ai_run") {
          return Promise.resolve({ data: "run-challenge", error: null });
        }
        if (name === "finish_ai_run") {
          finishPayloads.push(
            args as { target_manifest_json: Record<string, unknown> },
          );
          return Promise.resolve({ data: "assistant-challenge", error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    await runAiTurn({
      supabase: supabase as never,
      sessionId: "session-challenge",
      caseId: "case-1",
      mode: "challenge",
      userMessage: "Challenge the operator-rushing assumption.",
      idempotencyKey: "idem-challenge",
      conversationHistory: [],
    });

    expect(createResponseCalls[0]?.model).toBe("gpt-test");
    expect(createResponseCalls[0]?.reasoningEffort).toBe("high");
    expect(createResponseCalls[0]?.maxOutputTokens).toBe(14_000);
    const toolNames = (createResponseCalls[0]?.tools ?? []).map(
      (tool) => (tool as { name?: string }).name,
    );
    expect(toolNames).not.toContain("close_case");
    expect(toolNames).not.toContain("verify_root_cause");
    expect(finishPayloads[0]?.target_manifest_json.reasoning_effort).toBe(
      "high",
    );
    expect(
      finishPayloads[0]?.target_manifest_json.reasoning_effort_source,
    ).toBe("task_default");
  });

  it("fails the run when the wall-clock budget is exhausted before a provider call", async () => {
    getAiEnvironment.mockReturnValue({
      AI_MODEL_DEFAULT: "gpt-test",
      AI_MODEL_REASONING: "low",
      AI_TURN_WALL_CLOCK_MS: 3_000,
      AI_RUN_TIMEOUT_MS: 45_000,
    });
    const failCalls: unknown[] = [];
    const supabase = {
      from: sessionLookup("case-1"),
      rpc: vi.fn().mockImplementation((name: string, args: unknown) => {
        if (name === "start_ai_run") {
          return Promise.resolve({ data: "run-timeout", error: null });
        }
        if (name === "fail_ai_run") {
          failCalls.push(args);
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    vi.useFakeTimers();
    const turn = runAiTurn({
      supabase: supabase as never,
      sessionId: "session-timeout",
      caseId: "case-1",
      mode: "review",
      userMessage: "Help me build a 5 Whys chain for the seal defect.",
      idempotencyKey: "idem-timeout",
      conversationHistory: [],
    });
    vi.advanceTimersByTime(3_500);
    await expect(turn).rejects.toThrow(/took too long/i);
    vi.useRealTimers();

    expect(failCalls).toHaveLength(1);
    expect(createResponseCalls).toHaveLength(0);
  });

  it("refuses a turn when the session is bound to a different case", async () => {
    const rpc = vi.fn();
    const supabase = {
      from: sessionLookup("case-authorised"),
      rpc,
    };

    await expect(
      runAiTurn({
        supabase: supabase as never,
        sessionId: "session-1",
        caseId: "case-other",
        mode: "facilitate",
        userMessage: "Read the other case.",
        idempotencyKey: "idem-mismatch",
        conversationHistory: [],
      }),
    ).rejects.toThrow(/not authorised for this case/);
    expect(rpc).not.toHaveBeenCalled();
    expect(createResponseCalls).toHaveLength(0);
  });
});
