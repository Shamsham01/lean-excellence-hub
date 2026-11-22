import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
} from "@/platform/ai/providers/errors";
import { shouldRetryProviderOnce } from "@/platform/ai/provider-turn-retry";
import { createAiRunDeadline } from "@/platform/ai/run-deadline";

describe("shouldRetryProviderOnce", () => {
  it("retries once for fast 5xx errors when budget remains", () => {
    const deadline = createAiRunDeadline(20_000);
    const error = new AiProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
      "temporary",
      { provider: "openai", model: "gpt-test", httpStatus: 503 },
    );
    expect(shouldRetryProviderOnce(error, deadline)).toBe(true);
  });

  it("does not retry rate limits or client errors", () => {
    const deadline = createAiRunDeadline(20_000);
    expect(
      shouldRetryProviderOnce(
        new AiProviderError(
          AI_PROVIDER_ERROR_CODES.RESPONSE_RATE_LIMITED,
          "rate limited",
          { provider: "openai", model: "gpt-test", httpStatus: 429 },
        ),
        deadline,
      ),
    ).toBe(false);
  });

  it("does not retry when the turn budget is nearly exhausted", () => {
    const deadline = createAiRunDeadline(4_000);
    const error = new AiProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
      "temporary",
      { provider: "openai", model: "gpt-test", httpStatus: 502 },
    );
    expect(shouldRetryProviderOnce(error, deadline)).toBe(false);
  });
});
