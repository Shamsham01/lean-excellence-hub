import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CreateResponseInput,
  CreateResponseResult,
} from "@/platform/ai/types";

vi.mock("server-only", () => ({}));

const providerCalls: CreateResponseInput[] = [];
let providerOverride:
  | ((input: CreateResponseInput) => Promise<CreateResponseResult>)
  | null = null;

vi.mock("@/platform/ai/registry", async () => {
  const { FakeAIProvider } = await import("@/platform/ai/providers/fake");
  const fake = new FakeAIProvider();
  return {
    resolveAIProvider: () => ({
      name: "fake",
      healthCheck: () => fake.healthCheck(),
      createResponse: async (input: CreateResponseInput) => {
        providerCalls.push(structuredClone(input));
        return providerOverride
          ? providerOverride(input)
          : fake.createResponse(input);
      },
    }),
  };
});

vi.mock("@/platform/ai/config", () => ({
  AI_DEFAULTS: {
    model: "gpt-4.1-mini",
    maxOutputTokens: 6000,
    maxToolCalls: 8,
    runTimeoutMs: 45_000,
  },
  getAiEnvironment: () => ({
    AI_MODEL_STANDARD: "gpt-4.1-mini",
    AI_MAX_OUTPUT_TOKENS: 9000,
  }),
  isApplicationAiProviderAvailable: () => true,
}));

import {
  buildMaturityBuilderContext,
  validateMaturityBuilderProposal,
} from "@/modules/maturity/ai-builder";
import { runMaturityBuilderTurn } from "@/platform/ai/maturity-builder-orchestrator";
import { MATURITY_FRAMEWORK_BUILDER_FORMAT_NAME } from "@/platform/ai/prompts/maturity-framework-builder";

import {
  BUILDER_SESSION_ID,
  rawBuilderProposal,
  understandingPayload,
} from "../fixtures/maturity-ai-builder";

const rpc = vi.fn();
const supabase = { rpc } as never;

function rpcCalls(name: string) {
  return rpc.mock.calls.filter(([fn]) => fn === name);
}

function context(
  overrides: Partial<Parameters<typeof buildMaturityBuilderContext>[0]> = {},
) {
  return buildMaturityBuilderContext({
    facts: {
      organisationName: "Acme Ltd",
      units: [{ name: "Plant North", unit_type: "site", parent_unit_id: "r" }],
      jobFunctionNames: ["Operator"],
      existingFrameworkNames: [],
    },
    understanding: null,
    currentProposal: null,
    intent: "answer",
    focusLabel: null,
    ...overrides,
  });
}

function currentProposal() {
  const result = validateMaturityBuilderProposal(rawBuilderProposal());
  if (!result.ok) throw new Error("fixture invalid");
  return result.proposal;
}

async function run(
  userRequest: string,
  overrides: Partial<Parameters<typeof runMaturityBuilderTurn>[0]> = {},
) {
  return runMaturityBuilderTurn({
    supabase,
    sessionId: BUILDER_SESSION_ID,
    userRequest,
    intent: "answer",
    focus: null,
    idempotencyKey: "idem-1",
    conversationHistory: [],
    context: context(),
    ...overrides,
  });
}

beforeEach(() => {
  providerCalls.length = 0;
  providerOverride = null;
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "start_ai_run") return { data: "run-1", error: null };
    if (fn === "finish_ai_run") return { data: "msg-1", error: null };
    return { data: null, error: null };
  });
});

describe("runMaturityBuilderTurn", () => {
  it("runs discovery through the shared run path with no tools and standard class", async () => {
    const result = await run("Assess how our sites apply standards");

    expect(result).toMatchObject({
      runId: "run-1",
      assistantMessageId: "msg-1",
      responseStatus: "ok",
      proposalStatus: "none",
    });
    const [start] = rpcCalls("start_ai_run");
    const startArgs = start?.[1] as Record<string, string>;
    expect(startArgs.target_ai_session_id).toBe(BUILDER_SESSION_ID);
    expect(startArgs.target_model).toBe("gpt-4.1-mini");
    expect(startArgs.target_prompt_key).toBe(
      "leanai-maturity-framework-builder",
    );
    expect(startArgs.target_user_message).toMatch(
      /^\[Maturity framework builder · context [a-f0-9]{12}\]\n\nUser request:\nAssess how our sites apply standards$/,
    );
    expect(startArgs.target_user_message).not.toContain("Plant North");

    const [call] = providerCalls;
    expect(call?.tools).toEqual([]);
    expect(call?.maxOutputTokens).toBe(6000);
    expect(call?.structuredOutputFormat?.name).toBe(
      MATURITY_FRAMEWORK_BUILDER_FORMAT_NAME,
    );
    expect(call?.messages.at(-1)?.content).toContain(
      "<maturity_builder_context>",
    );
    expect(call?.messages.at(-1)?.content).toContain("Plant North");

    const [finish] = rpcCalls("finish_ai_run");
    const finishArgs = finish?.[1] as Record<string, unknown>;
    expect(finishArgs.target_input_tokens).toBe(220);
    expect(finishArgs.target_output_tokens).toBe(480);
    expect(finishArgs.target_proposals).toEqual([]);
    expect(finishArgs.target_structured_payload).toMatchObject({
      kind: "maturity_framework_builder",
      response_status: "ok",
      phase: "discovery",
      proposal_status: "none",
    });
    expect(finishArgs.target_manifest_json).toMatchObject({
      logical_model_class: "standard",
      intervention_key: "maturity_framework_builder",
      denied_tool_count: 0,
    });
    expect(rpcCalls("fail_ai_run")).toHaveLength(0);
    expect(
      rpc.mock.calls.some(([fn]) => String(fn).includes("maturity_model")),
    ).toBe(false);
  });

  it("stores a validated proposal when asked to propose", async () => {
    const result = await run("Draft it now", {
      intent: "propose",
      context: context({
        intent: "propose",
        understanding: understandingPayload(),
      }),
    });
    expect(result.proposalStatus).toBe("valid");
    const payload = rpcCalls("finish_ai_run")[0]?.[1]
      .target_structured_payload as Record<string, unknown>;
    expect(payload.proposal).toMatchObject({
      name: "Acme Ltd Operational Excellence Framework",
      assessmentScopes: ["site", "area"],
    });
  });

  it("records usage but does not adopt a malformed proposal", async () => {
    const result = await run("MALFORMED_PROPOSAL_TEST", {
      context: context({ understanding: understandingPayload() }),
    });
    expect(result.responseStatus).toBe("ok");
    expect(result.proposalStatus).toBe("invalid");
    expect(result.issues.length).toBeGreaterThan(0);
    const finishArgs = rpcCalls("finish_ai_run")[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(finishArgs.target_structured_payload).toMatchObject({
      proposal_status: "invalid",
      proposal: null,
    });
    expect(finishArgs.target_output_tokens).toBe(480);
  });

  it("marks an unreadable envelope invalid without failing the run", async () => {
    const result = await run("BROKEN_ENVELOPE_TEST");
    expect(result.responseStatus).toBe("invalid_response");
    const finishArgs = rpcCalls("finish_ai_run")[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(finishArgs.target_assistant_content).toContain("nothing changed");
    expect(finishArgs.target_structured_payload).toMatchObject({
      response_status: "invalid_response",
      proposal: null,
    });
  });

  it("denies and records tool requests", async () => {
    const result = await run("TOOL_REQUEST_TEST");
    expect(result.responseStatus).toBe("invalid_response");
    const finishArgs = rpcCalls("finish_ai_run")[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(finishArgs.target_tool_calls).toEqual([
      expect.objectContaining({
        tool_name: "publish_maturity_model",
        status: "denied",
        denial_reason: "maturity_builder_has_no_tools",
      }),
    ]);
    expect(finishArgs.target_tool_call_count).toBe(1);
  });

  it("refines only the focused pillar and keeps the rest", async () => {
    const result = await run(
      "Refine pillar “Quality at Source”: rename it to Right First Time",
      {
        intent: "refine",
        focus: { kind: "pillar", pillarIndex: 1 },
        context: context({
          intent: "refine",
          focusLabel: "pillar “Quality at Source”",
          currentProposal: currentProposal(),
          understanding: understandingPayload(),
        }),
      },
    );
    expect(result.proposalStatus).toBe("valid");
    const payload = rpcCalls("finish_ai_run")[0]?.[1]
      .target_structured_payload as {
      proposal: { pillars: Array<{ name: string }> };
      change_summary: string[];
      focus: unknown;
    };
    expect(payload.proposal.pillars.map((pillar) => pillar.name)).toEqual([
      "Safe Work",
      "Right First Time",
      "Continuous Improvement",
    ]);
    expect(payload.change_summary).toEqual([
      "Renamed pillar “Quality at Source” to “Right First Time”.",
    ]);
    expect(payload.focus).toEqual({ kind: "pillar", pillarIndex: 1 });
  });

  it("fails the run without usage when the provider errors", async () => {
    providerOverride = async () => {
      throw new Error("Provider timeout");
    };
    await expect(run("Hello")).rejects.toThrow("Provider timeout");
    expect(rpcCalls("finish_ai_run")).toHaveLength(0);
    expect(rpcCalls("fail_ai_run")[0]?.[1]).toMatchObject({
      target_ai_run_id: "run-1",
      target_error_category: "timeout",
    });
  });

  it("does not call the provider when the run cannot start", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "start_ai_run"
        ? { data: null, error: { message: "organisation ai monthly token ceiling reached" } }
        : { data: null, error: null },
    );
    await expect(run("Hello")).rejects.toMatchObject({
      message: "organisation ai monthly token ceiling reached",
    });
    expect(providerCalls).toHaveLength(0);
  });
});
