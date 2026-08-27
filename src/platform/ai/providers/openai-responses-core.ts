import OpenAI from "openai";

import { facilitatorEnvelopeJsonSchema } from "@/platform/ai/providers/openai-transport";
import {
  parseStructuredOpenAiResponse,
  type OpenAiResponseSnapshot,
} from "@/platform/ai/providers/openai-response-parser";
import type {
  AIProvider,
  CreateResponseInput,
  CreateResponseResult,
} from "@/platform/ai/types";

export function buildResponsesCreateParams(
  input: CreateResponseInput,
): OpenAI.Responses.ResponseCreateParamsNonStreaming {
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
      ...input.messages.map((message) => ({
        role: message.role,
        content: [
          {
            type: "input_text" as const,
            text: message.content,
          },
        ],
      })),
    ],
    tools: input.tools as unknown as OpenAI.Responses.Tool[],
    max_output_tokens: input.maxOutputTokens,
    ...(input.previousResponseId
      ? { previous_response_id: input.previousResponseId }
      : {}),
    ...(input.reasoningEffort
      ? { reasoning: { effort: input.reasoningEffort } }
      : {}),
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "facilitator_envelope",
        schema: facilitatorEnvelopeJsonSchema,
        strict: true,
      },
    },
  };
}

export class OpenAIResponsesProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async healthCheck() {
    return { ok: true, provider: this.name };
  }

  async createResponse(
    input: CreateResponseInput,
  ): Promise<CreateResponseResult> {
    const response = await this.client.responses.create(
      buildResponsesCreateParams(input),
      { timeout: input.timeoutMs },
    );

    return parseStructuredOpenAiResponse(response as OpenAiResponseSnapshot, {
      provider: this.name,
      model: input.model,
      maxOutputTokens: input.maxOutputTokens,
    });
  }
}
