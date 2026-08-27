import OpenAI from "openai";

import {
  facilitatorEnvelopeJsonSchema,
  normalizeTransportEnvelope,
  type OpenAiFacilitatorEnvelopeTransport,
} from "@/platform/ai/providers/openai-transport";
import type {
  AIProvider,
  CreateResponseInput,
  CreateResponseResult,
  FacilitatorEnvelope,
} from "@/platform/ai/types";

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
    const inputItems: OpenAI.Responses.ResponseInputItem[] = [
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
    ];

    const response = await this.client.responses.create(
      {
        model: input.model,
        input: inputItems,
        tools: input.tools as unknown as OpenAI.Responses.Tool[],
        max_output_tokens: input.maxOutputTokens,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "facilitator_envelope",
            schema: facilitatorEnvelopeJsonSchema,
            strict: true,
          },
        },
      },
      { timeout: input.timeoutMs },
    );

    const toolCalls: CreateResponseResult["toolCalls"] = [];
    for (const item of response.output ?? []) {
      if (item.type === "function_call") {
        toolCalls.push({
          id: item.call_id ?? item.id ?? `call-${toolCalls.length}`,
          name: item.name,
          arguments: JSON.parse(item.arguments || "{}") as Record<
            string,
            unknown
          >,
        });
      }
    }

    let structuredOutput: FacilitatorEnvelope | undefined;
    let outputText = response.output_text ?? "";
    if (outputText) {
      try {
        const transport = JSON.parse(
          outputText,
        ) as OpenAiFacilitatorEnvelopeTransport;
        structuredOutput = normalizeTransportEnvelope(transport);
        outputText = structuredOutput.message ?? outputText;
      } catch {
        structuredOutput = undefined;
      }
    }

    const usage = response.usage;

    const result: CreateResponseResult = {
      responseId: response.id,
      outputText,
      toolCalls,
      usage: {
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
        reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0,
      },
    };

    if (structuredOutput) {
      result.structuredOutput = structuredOutput;
    }

    return result;
  }
}
