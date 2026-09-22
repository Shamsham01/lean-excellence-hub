import { describe, expect, it } from "vitest";

import {
  formatAiUsageLoadError,
  formatUsageCount,
  isEmptyAiUsageSummary,
  parseAiUsageSummary,
  totalAiUsageTokens,
} from "@/lib/ai/usage-summary";

describe("parseAiUsageSummary", () => {
  it("parses RPC payload fields into a stable summary shape", () => {
    const summary = parseAiUsageSummary({
      runs_this_month: 4,
      input_tokens: 1200,
      output_tokens: 800,
      cached_input_tokens: 100,
      reasoning_tokens: 50,
      tool_calls: 3,
      provider_distribution: [
        { provider: "openai", model: "gpt-4.1-mini", run_count: 4 },
      ],
    });

    expect(summary).toEqual({
      runs_this_month: 4,
      input_tokens: 1200,
      output_tokens: 800,
      cached_input_tokens: 100,
      reasoning_tokens: 50,
      tool_calls: 3,
      provider_distribution: [
        { provider: "openai", model: "gpt-4.1-mini", run_count: 4 },
      ],
    });
  });

  it("returns null when usage summary is missing", () => {
    expect(parseAiUsageSummary(null)).toBeNull();
    expect(parseAiUsageSummary(undefined)).toBeNull();
  });

  it("coerces invalid numeric values to zero", () => {
    const summary = parseAiUsageSummary({
      runs_this_month: "4",
      input_tokens: -10,
      output_tokens: Number.NaN,
      cached_input_tokens: null,
      reasoning_tokens: 12.9,
      tool_calls: "x",
      provider_distribution: [{ provider: "openai", model: "gpt", run_count: 2.7 }],
    });

    expect(summary).toEqual({
      runs_this_month: 0,
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
      reasoning_tokens: 12,
      tool_calls: 0,
      provider_distribution: [
        { provider: "openai", model: "gpt", run_count: 2 },
      ],
    });
  });
});

describe("usage summary helpers", () => {
  it("calculates total token usage across categories", () => {
    const summary = parseAiUsageSummary({
      runs_this_month: 1,
      input_tokens: 100,
      output_tokens: 200,
      cached_input_tokens: 50,
      reasoning_tokens: 25,
      tool_calls: 1,
      provider_distribution: [],
    });

    expect(summary).not.toBeNull();
    expect(totalAiUsageTokens(summary!)).toBe(375);
  });

  it("detects an empty month-to-date summary", () => {
    const summary = parseAiUsageSummary({
      runs_this_month: 0,
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
      reasoning_tokens: 0,
      tool_calls: 0,
      provider_distribution: [],
    });

    expect(summary).not.toBeNull();
    expect(isEmptyAiUsageSummary(summary!)).toBe(true);
  });

  it("formats counts for en-GB locale", () => {
    expect(formatUsageCount(1234567)).toBe("1,234,567");
  });
});

describe("formatAiUsageLoadError", () => {
  it("maps authz failures to a clear message", () => {
    expect(
      formatAiUsageLoadError({
        code: "42501",
        message: "ai usage summary is not authorised",
      }),
    ).toBe(
      "You are not authorised to view Lean AI usage for this organisation.",
    );
  });

  it("preserves provider error detail for unexpected failures", () => {
    expect(
      formatAiUsageLoadError({
        message: "connection timeout",
      }),
    ).toBe("Lean AI usage could not be loaded: connection timeout");
  });

  it("falls back to a generic message when no detail is available", () => {
    expect(formatAiUsageLoadError({})).toBe(
      "Lean AI usage could not be loaded. Please try again or contact an administrator.",
    );
  });
});
