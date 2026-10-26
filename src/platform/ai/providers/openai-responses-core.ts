import OpenAI from "openai";

import {
  guardOpenAiResponsesRequest,
  mapOpenAiSdkError,
} from "@/platform/ai/providers/openai-error-map";
import { facilitatorEnvelopeJsonSchema } from "@/platform/ai/providers/openai-transport";
import {
  parseStructuredOpenAiResponse,
  type OpenAiResponseSnapshot,
} from "@/platform/ai/providers/openai-response-parser";
import { AiProviderError } from "@/platform/ai/providers/errors";
import type {
  AIProvider,
  CreateResponseInput,
  CreateResponseResult,
} from "@/platform/ai/types";
import {
  providerToolsIncludeWebSearch,
  WEB_SEARCH_SOURCES_INCLUDE,
} from "@/platform/ai/web-search";

function serializeConversationMessage(message: {
  role: "user" | "assistant";
  content: string;
}): OpenAI.Responses.ResponseInputItem {
  if (message.role === "assistant") {
    // Responses API requires assistant replay items to use output_text blocks.
    // The SDK's EasyInputMessage typing only lists input_* content types.
    return {
      role: "assistant",
      content: [{ type: "output_text", text: message.content }],
    } as OpenAI.Responses.ResponseInputItem;
  }

  return {
    role: "user",
    content: [{ type: "input_text", text: message.content }],
  };
}

export function buildResponsesCreateParams(
  input: CreateResponseInput,
): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  const structuredFormat = input.structuredOutputFormat
    ? {
        type: "json_schema" as const,
        name: input.structuredOutputFormat.name,
        schema: input.structuredOutputFormat.schema,
        strict: true as const,
      }
    : {
        type: "json_schema" as const,
        name: "facilitator_envelope",
        schema: facilitatorEnvelopeJsonSchema,
        strict: true as const,
      };

  return {
    model: input.model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: input.systemPrompt,
          },
        ],
      },
      ...input.messages.map(serializeConversationMessage),
    ],
    tools: input.tools as unknown as OpenAI.Responses.Tool[],
    max_output_tokens: input.maxOutputTokens,
    ...(input.reasoningEffort
      ? { reasoning: { effort: input.reasoningEffort } }
      : {}),
    ...(providerToolsIncludeWebSearch(input.tools)
      ? { include: [WEB_SEARCH_SOURCES_INCLUDE] }
      : {}),
    // Application-managed context is replayed on every request with store:false.
    // Do not send previous_response_id; retained provider responses conflict with
    // the M12 privacy architecture. Future optimisation could replay stateless
    // response items or encrypted reasoning if benchmarks justify it.
    store: false,
    text: {
      format: structuredFormat,
    },
  };
}

export class OpenAIResponsesProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey: string, client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey });
  }

  async healthCheck() {
    return { ok: true, provider: this.name };
  }

  async createResponse(
    input: CreateResponseInput,
  ): Promise<CreateResponseResult> {
    const prepared = guardOpenAiResponsesRequest(input);
    let response: OpenAI.Responses.Response;
    try {
      response = await this.client.responses.create(
        buildResponsesCreateParams(prepared),
        { timeout: prepared.timeoutMs },
      );
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw mapOpenAiSdkError(error, {
        model: prepared.model,
        ...(prepared.reasoningEffort
          ? { reasoningEffort: prepared.reasoningEffort }
          : {}),
        maxOutputTokens: prepared.maxOutputTokens,
      });
    }

    const formatName = prepared.structuredOutputFormat?.name;
    return parseStructuredOpenAiResponse(response as OpenAiResponseSnapshot, {
      provider: this.name,
      model: prepared.model,
      maxOutputTokens: prepared.maxOutputTokens,
      ...(formatName ? { formatName } : {}),
    });
  }
}
