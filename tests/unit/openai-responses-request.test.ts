import { describe, expect, it } from "vitest";

import { facilitatorEnvelopeJsonSchema } from "@/platform/ai/providers/openai-transport";
import { buildResponsesCreateParams } from "@/platform/ai/providers/openai-responses-core";

describe("buildResponsesCreateParams", () => {
  const baseInput = {
    model: "gpt-5.6-luna",
    systemPrompt: "system",
    messages: [{ role: "user" as const, content: "follow-up" }],
    tools: [{ type: "function", name: "get_hypotheses" }],
    maxOutputTokens: 6000,
    timeoutMs: 45_000,
  };

  it("keeps store:false for stateless privacy architecture", () => {
    const params = buildResponsesCreateParams(baseInput);
    expect(params.store).toBe(false);
  });

  it("does not send previous_response_id", () => {
    const params = buildResponsesCreateParams(baseInput);
    expect(params).not.toHaveProperty("previous_response_id");
  });

  it("sends configured reasoning effort", () => {
    const params = buildResponsesCreateParams({
      ...baseInput,
      reasoningEffort: "low",
    });

    expect(params.reasoning).toEqual({ effort: "low" });
  });

  it("does not invent reasoning effort when omitted", () => {
    const params = buildResponsesCreateParams(baseInput);
    expect(params).not.toHaveProperty("reasoning");
  });

  it("sends configured max_output_tokens", () => {
    const params = buildResponsesCreateParams(baseInput);
    expect(params.max_output_tokens).toBe(6000);
  });

  it("keeps strict facilitator response schema configured", () => {
    const params = buildResponsesCreateParams(baseInput);

    expect(params.text?.format).toEqual({
      type: "json_schema",
      name: "facilitator_envelope",
      schema: facilitatorEnvelopeJsonSchema,
      strict: true,
    });
  });

  it("uses the Coach envelope schema when a format is supplied", () => {
    const params = buildResponsesCreateParams({
      ...baseInput,
      structuredOutputFormat: {
        name: "coach_envelope",
        schema: { type: "object", properties: { message: { type: "string" } } },
      },
    });

    expect(params.store).toBe(false);
    expect(params.text?.format).toEqual({
      type: "json_schema",
      name: "coach_envelope",
      schema: { type: "object", properties: { message: { type: "string" } } },
      strict: true,
    });
  });

  it("serializes user history as input_text", () => {
    const params = buildResponsesCreateParams({
      ...baseInput,
      messages: [{ role: "user", content: "first question" }],
    });

    const history = params.input!.slice(1);
    expect(history).toEqual([
      {
        role: "user",
        content: [{ type: "input_text", text: "first question" }],
      },
    ]);
  });

  it("serializes assistant history as output_text", () => {
    const params = buildResponsesCreateParams({
      ...baseInput,
      messages: [
        { role: "assistant", content: "Here is the prior Coach reply." },
      ],
    });

    const history = params.input!.slice(1);
    expect(history).toEqual([
      {
        role: "assistant",
        content: [
          { type: "output_text", text: "Here is the prior Coach reply." },
        ],
      },
    ]);
  });

  it("preserves mixed conversation order with role-appropriate content types", () => {
    const params = buildResponsesCreateParams({
      ...baseInput,
      messages: [
        { role: "user", content: "Explain maturity setup." },
        {
          role: "assistant",
          content: "Publish a Maturity Framework first.",
        },
        { role: "user", content: "What should the first version include?" },
      ],
    });

    expect(params.input).toEqual([
      {
        role: "user",
        content: [{ type: "input_text", text: "system" }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: "Explain maturity setup." }],
      },
      {
        role: "assistant",
        content: [
          { type: "output_text", text: "Publish a Maturity Framework first." },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "What should the first version include?",
          },
        ],
      },
    ]);
    expect(params.store).toBe(false);
    expect(params).not.toHaveProperty("previous_response_id");
  });
});
