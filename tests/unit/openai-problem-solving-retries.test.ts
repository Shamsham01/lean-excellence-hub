import { describe, expect, it, vi } from "vitest";

import { OpenAIResponsesProvider } from "@/platform/ai/providers/openai-responses-core";

const request = {
  model: "gpt-test",
  systemPrompt: "Facilitate a 5 Whys without writing the case.",
  messages: [{ role: "user" as const, content: "Why did the seal fail?" }],
  tools: [],
  maxOutputTokens: 1_000,
  timeoutMs: 12_000,
};

describe("OpenAI problem-solving request retries", () => {
  it("disables SDK retries when the caller sets maxRetries to 0", async () => {
    const create = vi.fn().mockRejectedValue(new Error("stop"));
    const provider = new OpenAIResponsesProvider("sk-test", {
      responses: { create },
    } as never);

    await expect(
      provider.createResponse({ ...request, maxRetries: 0 }),
    ).rejects.toThrow();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      timeout: 12_000,
      maxRetries: 0,
    });
  });

  it("leaves the SDK retry default in place for other workflows", async () => {
    const create = vi.fn().mockRejectedValue(new Error("stop"));
    const provider = new OpenAIResponsesProvider("sk-test", {
      responses: { create },
    } as never);

    await expect(provider.createResponse(request)).rejects.toThrow();

    expect(create.mock.calls[0]?.[1]).toEqual({ timeout: 12_000 });
  });
});
