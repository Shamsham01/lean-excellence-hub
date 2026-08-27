import "server-only";

import OpenAI from "openai";

import { getAiEnvironment } from "@/platform/ai/config";
import type {
  AIProvider,
  CreateResponseInput,
  CreateResponseResult,
  FacilitatorEnvelope,
} from "@/platform/ai/types";

const envelopeJsonSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          support_level: {
            type: "string",
            enum: [
              "insufficient_evidence",
              "partially_supported",
              "well_supported",
            ],
          },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
    questions: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    source_refs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          ref: {
            type: "object",
            properties: {
              problem_solving_case_id: { type: "string" },
              current_condition_item_id: { type: "string" },
              containment_id: { type: "string" },
              hypothesis_id: { type: "string" },
              hypothesis_test_id: { type: "string" },
              countermeasure_id: { type: "string" },
              effectiveness_check_id: { type: "string" },
              sustainment_item_id: { type: "string" },
              problem_solving_session_id: { type: "string" },
              action_id: { type: "string" },
              lesson_learned_id: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        required: ["label", "ref"],
        additionalProperties: false,
      },
    },
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          proposal_type: { type: "string" },
          payload: { type: "object", additionalProperties: true },
          explanation: { type: "string" },
        },
        required: ["proposal_type", "payload", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "message",
    "observations",
    "questions",
    "warnings",
    "source_refs",
    "proposals",
  ],
  additionalProperties: false,
} as const;

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
            schema: envelopeJsonSchema,
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
        structuredOutput = JSON.parse(outputText) as FacilitatorEnvelope;
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

export function createOpenAIProvider(): OpenAIResponsesProvider {
  const env = getAiEnvironment();
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAIResponsesProvider(apiKey);
}
