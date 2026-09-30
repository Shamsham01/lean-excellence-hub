import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AI_DEFAULTS, parseAiEnvironment } from "@/platform/ai/config";

describe("parseAiEnvironment", () => {
  it("accepts supported reasoning effort values", () => {
    expect(
      parseAiEnvironment({ AI_MODEL_REASONING: "low" }).AI_MODEL_REASONING,
    ).toBe("low");
  });

  it("rejects invalid reasoning effort values", () => {
    expect(() => parseAiEnvironment({ AI_MODEL_REASONING: "turbo" })).toThrow();
  });

  it("does not invent reasoning effort when omitted", () => {
    expect(parseAiEnvironment({}).AI_MODEL_REASONING).toBeUndefined();
  });

  it("defaults max output tokens to the safe structured budget", () => {
    expect(AI_DEFAULTS.maxOutputTokens).toBe(6000);
  });

  it("treats AI_ENABLED=0 as a disabled application provider", () => {
    expect(parseAiEnvironment({ AI_ENABLED: "0" }).AI_ENABLED).toBe("0");
  });

  it("accepts optional logical model class mappings", () => {
    const env = parseAiEnvironment({
      AI_MODEL_ECONOMY: "gpt-4.1-nano",
      AI_MODEL_STANDARD: "gpt-4.1-mini",
      AI_MODEL_DEEP: "gpt-4.1",
    });
    expect(env.AI_MODEL_ECONOMY).toBe("gpt-4.1-nano");
    expect(env.AI_MODEL_STANDARD).toBe("gpt-4.1-mini");
    expect(env.AI_MODEL_DEEP).toBe("gpt-4.1");
  });
});
