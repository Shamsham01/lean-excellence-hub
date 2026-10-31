import { describe, expect, it, vi } from "vitest";

import { handlePlatformNotificationRequest } from "../../supabase/functions/_shared/platform-notification/handler.ts";
import {
  renderPlatformNotification,
  type PlatformNotificationEvent,
} from "../../supabase/functions/_shared/platform-notification/render.ts";
import { createFakeOperationalEmailProvider } from "../../supabase/functions/_shared/notification-delivery/provider/fake.ts";
import { OperationalEmailProviderError } from "../../supabase/functions/_shared/notification-delivery/provider/types.ts";
import type { PlatformNotificationWorkerClient } from "../../supabase/functions/_shared/platform-notification/handler.ts";

const SECRET_KEY = "sb_secret_test_key_value";

const EVENT: PlatformNotificationEvent = {
  attemptCount: 1,
  eventId: "22222222-2222-4222-8222-222222222222",
  eventKind: "subscription.entitlement_activated",
  idempotencyKey:
    "subscription.entitlement_activated:11111111-1111-4111-8111-111111111111:sub_123",
  leaseToken: "55555555-5555-4555-8555-555555555555",
  organisationId: "11111111-1111-4111-8111-111111111111",
  payload: {
    billing_state: "active",
    organisation_name: "Harbourfield Foods",
    stripe_livemode: false,
    api_key: "must-not-render",
  },
  recipientEmail: "admin.lean.excellence.hub@gmail.com",
};

function authorizedRequest(body: Record<string, unknown> = { batch_size: 10 }) {
  return new Request("https://example.test/platform-notification-delivery", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      apikey: SECRET_KEY,
    },
    method: "POST",
  });
}

function createClient(
  events: PlatformNotificationEvent[],
): PlatformNotificationWorkerClient {
  const queue = [...events];
  return {
    claim: vi.fn(async () => {
      const claimed = queue.splice(0, queue.length);
      return { error: null, events: claimed };
    }),
    complete: vi.fn(async () => ({ data: true, error: null })),
    failRetryable: vi.fn(async () => ({ data: true, error: null })),
    failTerminal: vi.fn(async () => ({ data: true, error: null })),
  };
}

describe("platform notification delivery", () => {
  it("rejects callers without the worker secret", async () => {
    const response = await handlePlatformNotificationRequest(
      new Request("https://example.test/platform-notification-delivery", {
        method: "POST",
      }),
      {
        createProvider: () => createFakeOperationalEmailProvider(),
        createWorkerClient: () => createClient([]),
        readEnv: (name) =>
          name === "SUPABASE_SECRET_KEYS"
            ? JSON.stringify({ default: SECRET_KEY })
            : undefined,
      },
    );
    expect(response.status).toBe(401);
  });

  it("sends a claimed event once and does not send when the next claim is empty", async () => {
    const provider = createFakeOperationalEmailProvider();
    const client = createClient([EVENT]);
    const dependencies = {
      createProvider: () => provider,
      createWorkerClient: () => client,
      readEnv: (name: string) => {
        const values: Record<string, string> = {
          APP_ORIGIN: "https://hub.example.test",
          OPERATIONAL_EMAIL_FROM: "notifications@example.test",
          OPERATIONAL_EMAIL_FROM_NAME: "Lean Excellence Hub",
          SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
        };
        return values[name];
      },
    };

    const first = await handlePlatformNotificationRequest(
      authorizedRequest(),
      dependencies,
    );
    const second = await handlePlatformNotificationRequest(
      authorizedRequest(),
      dependencies,
    );

    expect(first.status).toBe(200);
    expect(provider.getSendCount()).toBe(1);
    expect(client.complete).toHaveBeenCalledTimes(1);
    expect(
      provider.getSendsByKey().get(EVENT.idempotencyKey)?.message.subject,
    ).toContain("Stripe test");
    expect(
      provider.getSendsByKey().get(EVENT.idempotencyKey)?.message.text,
    ).not.toContain("must-not-render");
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ claimed: 0 });
    expect(provider.getSendCount()).toBe(1);
  });

  it("does not describe a Checkout redirect as payment success", () => {
    const message = renderPlatformNotification({
      appOrigin: "https://hub.example.test",
      event: EVENT,
      from: "Lean Excellence Hub <notifications@example.test>",
    });
    expect(message.text).toContain(
      "Checkout browser redirect is not payment confirmation",
    );
    expect(message.subject).toContain("Stripe test");
    expect(message.html).not.toContain("must-not-render");
  });

  it("records a retryable provider failure without a second send", async () => {
    const provider = createFakeOperationalEmailProvider({
      failWith: new OperationalEmailProviderError(
        "provider_rate_limited",
        "slow",
        {
          retryable: true,
          statusCode: 429,
        },
      ),
    });
    const client = createClient([EVENT]);
    const response = await handlePlatformNotificationRequest(
      authorizedRequest(),
      {
        createProvider: () => provider,
        createWorkerClient: () => client,
        readEnv: (name) => {
          const values: Record<string, string> = {
            OPERATIONAL_EMAIL_FROM: "notifications@example.test",
            SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
          };
          return values[name];
        },
      },
    );
    expect(response.status).toBe(200);
    expect(client.failRetryable).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "provider_rate_limited" }),
    );
    expect(client.complete).not.toHaveBeenCalled();
  });
});
