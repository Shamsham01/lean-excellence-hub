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
});
