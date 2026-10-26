import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";

import { createEmptyProposalsTransport } from "@/platform/ai/proposals/proposal-transport";
import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
  aiRunFailureCategory,
} from "@/platform/ai/providers/errors";
import { mapOpenAiSdkError } from "@/platform/ai/providers/openai-error-map";
import { OpenAIResponsesProvider } from "@/platform/ai/providers/openai-responses-core";
import type { CreateResponseInput } from "@/platform/ai/types";

function headers(requestId: string) {
  return new Headers({ "x-request-id": requestId });
}

function apiError(
  status: number,
  error: Record<string, unknown>,
  requestId = "req_test",
) {
  return OpenAI.APIError.generate(
    status,
    { error },
    undefined,
    headers(requestId),
  );
}

const baseInput: CreateResponseInput = {
  model: "gpt-6-luna",
  systemPrompt: "system",
  messages: [{ role: "user", content: "What should I do on this page?" }],
  tools: [],
  maxOutputTokens: 1500,
  timeoutMs: 1000,
  reasoningEffort: "none",
  expectsStructuredOutput: true,
};

function completedEnvelope() {
  return {
    id: "resp_ok",
    status: "completed",
    output_text: JSON.stringify({
      message: "A concise facilitator reply.",
      observations: [],
      questions: [],
      warnings: [],
      source_refs: [],
      proposals: createEmptyProposalsTransport(),
    }),
    output: [],
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      input_tokens_details: { cached_tokens: 4 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  };
}

describe("mapOpenAiSdkError", () => {
  it("classifies a retired-model 404 without substituting another model", () => {
    const error = mapOpenAiSdkError(
      apiError(404, {
        message: "The model `gpt-4.1-nano` has been deprecated.",
        type: "invalid_request_error",
        code: "model_not_found",
      }),
      { model: "gpt-4.1-nano", reasoningEffort: "none" },
    );

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.code).toBe(AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_UNAVAILABLE);
    expect(error.diagnostics.model).toBe("gpt-4.1-nano");
    expect(error.diagnostics.requestId).toBe("req_test");
    expect(error.diagnostics.httpStatus).toBe(404);
    expect(error.message).toContain("gpt-4.1-nano");
    expect(error.message).toContain("did not switch");
    expect(error.message).not.toMatch(/sk-/);
    expect(aiRunFailureCategory(error)).toBe("model_unavailable");
  });

  it("classifies model access denial, reasoning 400s, rate limits and timeouts", () => {
    const denied = mapOpenAiSdkError(
      apiError(
        403,
        {
          message: "Project does not have access to model gpt-6.1-sol",
          code: "model_not_found",
        },
        "req_denied",
      ),
      { model: "gpt-6.1-sol" },
    );
    expect(denied.code).toBe(
      AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_ACCESS_DENIED,
    );
    expect(aiRunFailureCategory(denied)).toBe("model_access_denied");

    const reasoning = mapOpenAiSdkError(
      apiError(400, {
        message: "Unsupported value: 'none' is not supported with gpt-6.1-sol.",
        param: "reasoning.effort",
        code: "invalid_value",
      }),
      { model: "gpt-6.1-sol", reasoningEffort: "none" },
    );
    expect(reasoning.code).toBe(
      AI_PROVIDER_ERROR_CODES.RESPONSE_UNSUPPORTED_PARAMETER,
    );
    expect(reasoning.diagnostics.providerErrorParam).toBe("reasoning.effort");
    expect(reasoning.message).not.toMatch(/sk-/);

    const structured = mapOpenAiSdkError(
      apiError(400, {
        message: "Invalid schema for response_format json_schema.",
        param: "text.format",
        code: "invalid_json_schema",
      }),
      { model: "gpt-6.1-terra" },
    );
    expect(structured.message).toMatch(/strict structured response/);

    const limited = mapOpenAiSdkError(
      apiError(429, {
        message: "Rate limit reached",
        code: "rate_limit_exceeded",
      }),
      { model: "gpt-6-luna" },
    );
    expect(limited.code).toBe(AI_PROVIDER_ERROR_CODES.RESPONSE_RATE_LIMITED);

    const timeout = mapOpenAiSdkError(
      new OpenAI.APIConnectionTimeoutError({ message: "Request timed out." }),
      { model: "gpt-6-luna" },
    );
    expect(timeout.code).toBe(AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT);
    expect(aiRunFailureCategory(timeout)).toBe("timeout");

    const temporary = mapOpenAiSdkError(
      apiError(503, {
        message: "The server had an error.",
        code: "server_error",
      }),
      { model: "gpt-6.1-terra" },
    );
    expect(temporary.code).toBe(AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY);
    expect(aiRunFailureCategory(temporary)).toBe("provider_unavailable");
  });

  it("redacts credential-shaped text from diagnostics", () => {
    const error = mapOpenAiSdkError(
      apiError(500, {
        message: "upstream failed for sk-testsecretvalue123456",
        code: "server_error",
      }),
      { model: "gpt-6-luna" },
    );

    expect(error.diagnostics.providerMessage).not.toContain("sk-test");
    expect(JSON.stringify(error.diagnostics)).not.toMatch(
      /sk-[A-Za-z0-9_-]{8,}/,
    );
  });
});

describe("OpenAIResponsesProvider request guard", () => {
  it("does not call the API for a retired model and does not substitute one", async () => {
    const create = vi.fn();
    const provider = new OpenAIResponsesProvider("test-key", {
      responses: { create },
    } as unknown as OpenAI);

    await expect(
      provider.createResponse({ ...baseInput, model: "gpt-4.1-nano" }),
    ).rejects.toMatchObject({
      code: AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_UNAVAILABLE,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rewrites unsupported none on gpt-6.1-sol before a single request", async () => {
    const create = vi.fn().mockResolvedValue(completedEnvelope());
    const provider = new OpenAIResponsesProvider("test-key", {
      responses: { create },
    } as unknown as OpenAI);

    const result = await provider.createResponse({
      ...baseInput,
      model: "gpt-6.1-sol",
      reasoningEffort: "none",
      tools: [{ type: "function", name: "get_hypotheses" }],
    });

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]?.[0] as {
      model: string;
      store: boolean;
      reasoning: { effort: string };
      previous_response_id?: string;
      temperature?: number;
    };
    expect(params.model).toBe("gpt-6.1-sol");
    expect(params.reasoning).toEqual({ effort: "low" });
    expect(params.store).toBe(false);
    expect(params.previous_response_id).toBeUndefined();
    expect(params.temperature).toBeUndefined();
    expect(result.usage.cachedInputTokens).toBe(4);
    expect(result.structuredOutput?.message).toMatch(/facilitator/);
  });

  it("reports a provider 404 once and keeps the requested model", async () => {
    const create = vi.fn().mockRejectedValue(
      apiError(
        404,
        {
          message: "The model `gpt-4.1-nano` has been deprecated.",
          code: "model_not_found",
        },
        "req_live_404",
      ),
    );
    const provider = new OpenAIResponsesProvider("test-key", {
      responses: { create },
    } as unknown as OpenAI);

    await expect(
      provider.createResponse({ ...baseInput, model: "custom-retired" }),
    ).rejects.toMatchObject({
      code: AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_UNAVAILABLE,
      diagnostics: { model: "custom-retired", requestId: "req_live_404" },
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].model).toBe("custom-retired");
  });
});
