import { describe, expect, it } from "vitest";

import { createEmptyProposalsTransport } from "@/platform/ai/proposals/proposal-transport";
import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
  INCOMPLETE_MAX_OUTPUT_USER_MESSAGE,
} from "@/platform/ai/providers/errors";
import {
  parseStructuredOpenAiResponse,
  type OpenAiResponseSnapshot,
} from "@/platform/ai/providers/openai-response-parser";
import { buildResponsesCreateParams } from "@/platform/ai/providers/openai-responses-core";

const parserContext = {
  provider: "openai",
  model: "gpt-5.6-luna",
  maxOutputTokens: 6000,
};

function completedResponse(
  outputText: string,
  overrides: Partial<OpenAiResponseSnapshot> = {},
): OpenAiResponseSnapshot {
  return {
    id: "resp_test_123",
    status: "completed",
    output_text: outputText,
    output: [],
    usage: {
      input_tokens: 100,
      output_tokens: 250,
      output_tokens_details: { reasoning_tokens: 120 },
    },
    ...overrides,
  };
}

function validTransportJson() {
  return JSON.stringify({
    message: "A concise facilitator reply.",
    observations: [
      {
        text: "Hot-running defect rate exceeds baseline.",
        support_level: "well_supported",
      },
    ],
    questions: ["What measurement window was used?"],
    warnings: [],
    source_refs: [],
    proposals: {
      ...createEmptyProposalsTransport(),
      hypotheses: [
        {
          statement: "Thermal expansion shifts seal alignment.",
          category: "technical",
          rationale: "Defects cluster after sustained hot runs.",
          parent_hypothesis_id: null,
          explanation: "Testable technical hypothesis.",
        },
      ],
    },
  });
}

describe("parseStructuredOpenAiResponse", () => {
  it("returns normalized envelope and message text for completed structured JSON", () => {
    const result = parseStructuredOpenAiResponse(
      completedResponse(validTransportJson()),
      parserContext,
    );

    expect(result.outputText).toBe("A concise facilitator reply.");
    expect(result.structuredOutput?.message).toBe(
      "A concise facilitator reply.",
    );
    expect(result.structuredOutput?.observations).toHaveLength(1);
    expect(result.structuredOutput?.proposals).toHaveLength(1);
    expect(result.structuredOutput?.proposals[0]?.proposal_type).toBe(
      "hypothesis",
    );
    expect(result.toolCalls).toEqual([]);
  });

  it("throws typed incomplete max-output error without returning raw JSON", () => {
    expect(() =>
      parseStructuredOpenAiResponse(
        completedResponse('{"message":"partial', {
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
        }),
        parserContext,
      ),
    ).toThrow(AiProviderError);

    try {
      parseStructuredOpenAiResponse(
        completedResponse('{"message":"partial', {
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
        }),
        parserContext,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      const providerError = error as AiProviderError;
      expect(providerError.code).toBe(
        AI_PROVIDER_ERROR_CODES.RESPONSE_INCOMPLETE_MAX_OUTPUT,
      );
      expect(providerError.message).toBe(INCOMPLETE_MAX_OUTPUT_USER_MESSAGE);
      expect(providerError.diagnostics.responseId).toBe("resp_test_123");
      expect(providerError.diagnostics.incompleteReason).toBe(
        "max_output_tokens",
      );
      expect(providerError.diagnostics.reasoningTokens).toBe(120);
    }
  });

  it("throws typed parse error for malformed completed JSON", () => {
    expect(() =>
      parseStructuredOpenAiResponse(
        completedResponse('{"message":"partial'),
        parserContext,
      ),
    ).toThrow(AiProviderError);

    try {
      parseStructuredOpenAiResponse(
        completedResponse('{"message":"partial'),
        parserContext,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe(
        AI_PROVIDER_ERROR_CODES.RESPONSE_PARSE_ERROR,
      );
    }
  });

  it("throws typed normalization error when transport shape is invalid", () => {
    expect(() =>
      parseStructuredOpenAiResponse(
        completedResponse(
          JSON.stringify({
            message: "Broken envelope",
            observations: "not-an-array",
            questions: [],
            warnings: [],
            source_refs: [],
            proposals: createEmptyProposalsTransport(),
          }),
        ),
        parserContext,
      ),
    ).toThrow(AiProviderError);

    try {
      parseStructuredOpenAiResponse(
        completedResponse(
          JSON.stringify({
            message: "Broken envelope",
            observations: "not-an-array",
            questions: [],
            warnings: [],
            source_refs: [],
            proposals: createEmptyProposalsTransport(),
          }),
        ),
        parserContext,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe(
        AI_PROVIDER_ERROR_CODES.RESPONSE_NORMALIZATION_ERROR,
      );
    }
  });

  it("preserves proposals for orchestrator persistence", () => {
    const result = parseStructuredOpenAiResponse(
      completedResponse(validTransportJson()),
      parserContext,
    );

    expect(result.structuredOutput?.proposals[0]).toEqual({
      proposal_type: "hypothesis",
      payload: {
        statement: "Thermal expansion shifts seal alignment.",
        category: "technical",
        rationale: "Defects cluster after sustained hot runs.",
      },
      explanation: "Testable technical hypothesis.",
    });
  });
});

describe("buildResponsesCreateParams", () => {
  it("sends reasoning effort when configured", () => {
    const params = buildResponsesCreateParams({
      model: "gpt-5.6-luna",
      systemPrompt: "system",
      messages: [],
      tools: [],
      maxOutputTokens: 6000,
      timeoutMs: 45_000,
      reasoningEffort: "low",
    });

    expect(params.reasoning).toEqual({ effort: "low" });
  });

  it("does not invent reasoning effort when omitted", () => {
    const params = buildResponsesCreateParams({
      model: "gpt-5.6-luna",
      systemPrompt: "system",
      messages: [],
      tools: [],
      maxOutputTokens: 6000,
      timeoutMs: 45_000,
    });

    expect(params).not.toHaveProperty("reasoning");
  });

  it("sends max_output_tokens and previous_response_id in the request contract", () => {
    const params = buildResponsesCreateParams({
      model: "gpt-5.6-luna",
      systemPrompt: "system",
      messages: [{ role: "user", content: "follow-up" }],
      tools: [],
      maxOutputTokens: 6000,
      timeoutMs: 45_000,
      previousResponseId: "resp_prev_456",
    });

    expect(params.max_output_tokens).toBe(6000);
    expect(params.previous_response_id).toBe("resp_prev_456");
  });
});
