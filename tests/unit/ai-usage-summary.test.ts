import { describe, expect, it, vi } from "vitest";

import {
  formatAiUsageLoadError,
  formatUsageCount,
  isEmptyAiUsageSummary,
  logAiUsageLoadError,
  parseAiUsageSummary,
  totalAiUsageTokens,
} from "@/lib/ai/usage-summary";

const validZeroUsagePayload = {
  runs_this_month: 0,
  input_tokens: 0,
  output_tokens: 0,
  cached_input_tokens: 0,
  reasoning_tokens: 0,
  tool_calls: 0,
  provider_distribution: [],
};

describe("parseAiUsageSummary", () => {
  it("parses the get_ai_usage_summary RPC payload into a stable summary shape", () => {
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

  it("accepts valid zero usage when every RPC field is present", () => {
    expect(parseAiUsageSummary(validZeroUsagePayload)).toEqual({
      runs_this_month: 0,
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
      reasoning_tokens: 0,
      tool_calls: 0,
      provider_distribution: [],
    });
  });

  it("returns null for missing or unavailable payloads", () => {
    expect(parseAiUsageSummary(null)).toBeNull();
    expect(parseAiUsageSummary(undefined)).toBeNull();
  });

  it("returns null for empty objects and partial payloads", () => {
    expect(parseAiUsageSummary({})).toBeNull();
    expect(parseAiUsageSummary({ runs_this_month: 0 })).toBeNull();
    expect(
      parseAiUsageSummary({
        ...validZeroUsagePayload,
        provider_distribution: undefined,
      }),
    ).toBeNull();
  });

  it("returns null for malformed numeric fields instead of coercing to zero", () => {
    expect(
      parseAiUsageSummary({
        runs_this_month: "4",
        input_tokens: 1200,
        output_tokens: 800,
        cached_input_tokens: 100,
        reasoning_tokens: 50,
        tool_calls: 3,
        provider_distribution: [],
      }),
    ).toBeNull();

    expect(
      parseAiUsageSummary({
        runs_this_month: 4,
        input_tokens: -10,
        output_tokens: 800,
        cached_input_tokens: 100,
        reasoning_tokens: 50,
        tool_calls: 3,
        provider_distribution: [],
      }),
    ).toBeNull();
  });

  it("returns null for malformed provider_distribution payloads", () => {
    expect(
      parseAiUsageSummary({
        ...validZeroUsagePayload,
        provider_distribution: "[]",
      }),
    ).toBeNull();

    expect(
      parseAiUsageSummary({
        ...validZeroUsagePayload,
        provider_distribution: [
          { provider: "openai", model: "gpt", run_count: "2" },
        ],
      }),
    ).toBeNull();
  });
});

describe("usage summary helpers", () => {
  it("calculates displayed total tokens as input plus output only", () => {
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
    expect(totalAiUsageTokens(summary!)).toBe(300);
  });

  it("detects an empty month-to-date summary", () => {
    const summary = parseAiUsageSummary(validZeroUsagePayload);

    expect(summary).not.toBeNull();
    expect(isEmptyAiUsageSummary(summary!)).toBe(true);
  });

  it("formats counts for en-GB locale", () => {
    expect(formatUsageCount(1234567)).toBe("1,234,567");
  });
});

describe("formatAiUsageLoadError", () => {
  it("maps authz failures to a clear message without logging", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      formatAiUsageLoadError({
        code: "42501",
        message: "ai usage summary is not authorised",
      }),
    ).toBe(
      "You are not authorised to view Lean AI usage for this organisation.",
    );
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("returns safe customer copy for unexpected failures and logs technical detail", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      formatAiUsageLoadError({
        message: "connection timeout while reading ai_usage_events",
      }),
    ).toBe(
      "Lean AI usage could not be loaded. Please try again or contact an administrator.",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[lean-ai:usage-summary]",
      JSON.stringify({
        code: null,
        message: "connection timeout while reading ai_usage_events",
      }),
    );

    warnSpy.mockRestore();
  });

  it("falls back to generic copy when no detail is available", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(formatAiUsageLoadError({})).toBe(
      "Lean AI usage could not be loaded. Please try again or contact an administrator.",
    );
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });
});

describe("logAiUsageLoadError", () => {
  it("logs structured diagnostics without exposing them in UI copy", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logAiUsageLoadError({
      code: "XX000",
      message: "internal SQL detail",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[lean-ai:usage-summary]",
      JSON.stringify({ code: "XX000", message: "internal SQL detail" }),
    );

    warnSpy.mockRestore();
  });
});
