import { describe, expect, it } from "vitest";

import { classifyProviderError } from "../../supabase/functions/_shared/notification-delivery/provider/classify-error.ts";
import { createFakeOperationalEmailProvider } from "../../supabase/functions/_shared/notification-delivery/provider/fake.ts";
import { OperationalEmailProviderError } from "../../supabase/functions/_shared/notification-delivery/provider/types.ts";

const MESSAGE = {
  from: "Lean Excellence Hub <notifications@example.test>",
  to: "alex@example.test",
  subject: "Test",
  html: "<p>Test</p>",
  text: "Test",
};

describe("operational email provider", () => {
  it("returns provider id on success", async () => {
    const provider = createFakeOperationalEmailProvider();
    const result = await provider.send(MESSAGE, "delivery-key-1");

    expect(result.providerMessageId).toMatch(/^fake-msg-/);
  });

  it("reuses the same idempotency key on retry", async () => {
    const provider = createFakeOperationalEmailProvider();

    const first = await provider.send(MESSAGE, "delivery-key-1");
    const second = await provider.send(MESSAGE, "delivery-key-1");

    expect(second.providerMessageId).toBe(first.providerMessageId);
    expect(provider.getSendCount()).toBe(2);
  });

  it("classifies invalid_idempotent_request as terminal conflict", () => {
    expect(
      classifyProviderError({
        name: "invalid_idempotent_request",
        statusCode: 409,
        message: "Idempotent request payload mismatch",
      }),
    ).toEqual({
      retryable: false,
      code: "provider_idempotency_conflict",
    });
  });

  it("classifies concurrent_idempotent_requests as retryable in-flight", () => {
    expect(
      classifyProviderError({
        name: "concurrent_idempotent_requests",
        statusCode: 409,
        message: "Another request with the same idempotency key is in-flight",
      }),
    ).toEqual({
      retryable: true,
      code: "provider_idempotency_in_flight",
    });
  });

  it("classifies rate limits as retryable", () => {
    expect(
      classifyProviderError({ statusCode: 429, message: "Too many requests" }),
    ).toEqual({
      retryable: true,
      code: "provider_rate_limited",
    });
  });

  it("classifies provider 5xx as retryable", () => {
    expect(
      classifyProviderError({ statusCode: 503, message: "Unavailable" }),
    ).toEqual({
      retryable: true,
      code: "provider_server_error",
    });
  });

  it("classifies invalid request as terminal", () => {
    expect(
      classifyProviderError({ statusCode: 422, message: "Invalid recipient" }),
    ).toEqual({
      retryable: false,
      code: "provider_invalid_request",
    });
  });

  it("classifies mismatched idempotency payload as terminal", async () => {
    const provider = createFakeOperationalEmailProvider();

    await provider.send(MESSAGE, "delivery-key-1");

    await expect(
      provider.send(
        {
          ...MESSAGE,
          subject: "Different subject",
        },
        "delivery-key-1",
      ),
    ).rejects.toMatchObject({
      code: "provider_idempotency_conflict",
      retryable: false,
    });
  });

  it("classifies explicit provider errors", () => {
    expect(
      classifyProviderError(
        new OperationalEmailProviderError(
          "provider_auth_configuration",
          "unauthorized",
          { retryable: false, statusCode: 401 },
        ),
      ),
    ).toEqual({
      retryable: false,
      code: "provider_auth_configuration",
    });
  });
});
