import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateResponseInput } from "@/platform/ai/types";

vi.mock("server-only", () => ({}));

const providerCalls: CreateResponseInput[] = [];

vi.mock("@/platform/ai/registry", async () => {
  const { FakeAIProvider } = await import("@/platform/ai/providers/fake");
  const fake = new FakeAIProvider();
  return {
    resolveAIProvider: () => ({
      name: "fake",
      healthCheck: () => fake.healthCheck(),
      createResponse: async (input: CreateResponseInput) => {
        providerCalls.push(structuredClone(input));
        return fake.createResponse(input);
      },
    }),
  };
});

vi.mock("@/platform/ai/config", () => ({
  AI_DEFAULTS: {
    model: "gpt-6.1-sol",
    maxOutputTokens: 6000,
    maxToolCalls: 8,
    runTimeoutMs: 45_000,
  },
  getAiEnvironment: () => ({
    AI_MODEL_STANDARD: "gpt-6.1-terra",
    AI_MODEL_DEFAULT: "gpt-6.1-sol",
  }),
  isApplicationAiProviderAvailable: () => true,
}));

import { fiveSSetupBuilderModule } from "@/modules/5s/ai-builder/module";
import { buildModuleSetupBuilderContext } from "@/modules/module-setup/ai-builder/context";
import { runModuleSetupBuilderTurn } from "@/platform/ai/module-setup-builder-orchestrator";

const rpc = vi.fn();

beforeEach(() => {
  providerCalls.length = 0;
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "start_ai_run") return { data: "run-setup", error: null };
    if (fn === "finish_ai_run") return { data: "msg-setup", error: null };
    return { data: null, error: null };
  });
});

describe("runModuleSetupBuilderTurn", () => {
  it("asks Terra for a low-effort 5S proposal and does not publish", async () => {
    const context = buildModuleSetupBuilderContext({
      contract: fiveSSetupBuilderModule.contextContract,
      facts: {
        organisationName: "Acme Ltd",
        activeSiteName: "Plant North",
        unitNames: ["Plant North"],
        existingConfigurationNames: [],
        configurationCount: 0,
      },
      understanding: null,
      currentProposal: null,
      intent: "answer",
      focusLabel: null,
      retry: false,
      limits: { ...fiveSSetupBuilderModule.limits },
    });

    const result = await runModuleSetupBuilderTurn({
      supabase: { rpc } as never,
      adapter: fiveSSetupBuilderModule.adapter,
      sessionId: "session-setup",
      userRequest: "Set up a simple 5S standard for the packing cell.",
      intent: "answer",
      focus: null,
      idempotencyKey: "idem-setup",
      conversationHistory: [],
      context,
    });

    expect(result.responseStatus).toBe("ok");
    const start = rpc.mock.calls.find(([fn]) => fn === "start_ai_run")?.[1] as {
      target_model: string;
    };
    expect(start.target_model).toBe("gpt-6.1-terra");
    expect(providerCalls[0]?.model).toBe("gpt-6.1-terra");
    expect(providerCalls[0]?.reasoningEffort).toBe("low");
    expect(providerCalls[0]?.maxOutputTokens).toBe(5500);
    expect(providerCalls[0]?.tools).toEqual([]);
    expect(providerCalls[0]?.model).not.toBe("gpt-6.1-sol");

    const finish = rpc.mock.calls.find(
      ([fn]) => fn === "finish_ai_run",
    )?.[1] as {
      target_proposals: unknown[];
      target_manifest_json: { reasoning_effort: string };
    };
    expect(finish.target_proposals).toEqual([]);
    expect(finish.target_manifest_json.reasoning_effort).toBe("low");
  });
});
