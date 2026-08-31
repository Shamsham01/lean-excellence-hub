import { describe, expect, it, vi } from "vitest";

import {
  handleNotificationDeliveryRequest,
  processClaimedNotificationDelivery,
  runNotificationDeliveryWorker,
} from "../../supabase/functions/_shared/notification-delivery/handler.ts";
import { createFakeOperationalEmailProvider } from "../../supabase/functions/_shared/notification-delivery/provider/fake.ts";
import { OperationalEmailProviderError } from "../../supabase/functions/_shared/notification-delivery/provider/types.ts";
import type {
  ClaimedNotificationDelivery,
  NotificationProviderEnvelope,
} from "../../supabase/functions/_shared/notification-delivery/types.ts";
import type { NotificationDeliveryWorkerClient } from "../../supabase/functions/_shared/notification-delivery/worker-client.ts";

const BASE_DELIVERY: ClaimedNotificationDelivery = {
  organisationId: "11111111-1111-4111-8111-111111111111",
  deliveryId: "22222222-2222-4222-8222-222222222222",
  sourceDomainEventId: "33333333-3333-4333-8333-333333333333",
  recipientMembershipId: "44444444-4444-4444-8444-444444444444",
  notificationKind: "workforce.job_function_assigned",
  deliveryKey:
    "workforce.job_function_assigned:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444",
  leaseToken: "55555555-5555-4555-8555-555555555555",
  attemptCount: 1,
};

const DELIVERABLE_CONTEXT = {
  organisationId: BASE_DELIVERY.organisationId,
  organisationName: "Acme Manufacturing",
  deliveryId: BASE_DELIVERY.deliveryId,
  sourceDomainEventId: BASE_DELIVERY.sourceDomainEventId,
  notificationKind: BASE_DELIVERY.notificationKind,
  recipientMembershipId: BASE_DELIVERY.recipientMembershipId,
  recipientDisplayName: "Alex Operator",
  recipientResolutionStatus: "deliverable" as const,
  deliverableEmail: "alex@example.test",
  eventType: "JobFunctionAssigned",
  resourceRecordId: null,
  eventPayload: {},
  contextTitle: "Production Operator",
  contextDetail: "Primary assignment",
  contextLinkPath: "/platform/people",
};

function createMockClient(
  overrides: Partial<NotificationDeliveryWorkerClient> = {},
): NotificationDeliveryWorkerClient {
  const storedEnvelopes = new Map<string, NotificationProviderEnvelope>();

  return {
    claimNotificationDeliveries: vi.fn(async () => ({
      deliveries: [BASE_DELIVERY],
      error: null,
    })),
    getDeliveryContext: vi.fn(async () => ({
      context: DELIVERABLE_CONTEXT,
      error: null,
    })),
    getProviderEnvelope: vi.fn(async (input) => ({
      envelope: storedEnvelopes.get(input.deliveryId) ?? null,
      error: null,
    })),
    storeProviderEnvelope: vi.fn(async (input) => {
      const envelope: NotificationProviderEnvelope = {
        organisationId: input.organisationId,
        deliveryId: input.deliveryId,
        deliveryKey: input.deliveryKey,
        senderFrom: input.senderFrom,
        recipientEmail: input.recipientEmail,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody,
        payloadHash: input.payloadHash,
      };
      storedEnvelopes.set(input.deliveryId, envelope);
      return { envelope, error: null };
    }),
    completeNotificationDelivery: vi.fn(async () => ({
      data: true,
      error: null,
    })),
    failNotificationDeliveryRetryable: vi.fn(async () => ({
      data: true,
      error: null,
    })),
    failNotificationDeliveryTerminal: vi.fn(async () => ({
      data: true,
      error: null,
    })),
    ...overrides,
  };
}

describe("notification delivery worker auth", () => {
  it("rejects non-POST requests", async () => {
    const response = await handleNotificationDeliveryRequest(
      new Request("https://example.test/notification-delivery", {
        method: "GET",
      }),
      {
        readEnv: () => "service-role-key",
        createWorkerClient: () => createMockClient(),
        createProvider: () => createFakeOperationalEmailProvider(),
      },
    );

    expect(response.status).toBe(405);
  });

  it("rejects missing trusted authorization", async () => {
    const response = await handleNotificationDeliveryRequest(
      new Request("https://example.test/notification-delivery", {
        method: "POST",
      }),
      {
        readEnv: () => "service-role-key",
        createWorkerClient: () => createMockClient(),
        createProvider: () => createFakeOperationalEmailProvider(),
      },
    );

    expect(response.status).toBe(401);
  });

  it("rejects incorrect trusted authorization", async () => {
    const response = await handleNotificationDeliveryRequest(
      new Request("https://example.test/notification-delivery", {
        method: "POST",
        headers: {
          Authorization: "Bearer wrong-key",
        },
      }),
      {
        readEnv: () => "service-role-key",
        createWorkerClient: () => createMockClient(),
        createProvider: () => createFakeOperationalEmailProvider(),
      },
    );

    expect(response.status).toBe(401);
  });

  it("accepts valid trusted worker invocation", async () => {
    const response = await handleNotificationDeliveryRequest(
      new Request("https://example.test/notification-delivery", {
        method: "POST",
        headers: {
          Authorization: "Bearer service-role-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batch_size: 1 }),
      }),
      {
        readEnv: (name) => {
          if (name === "SUPABASE_SERVICE_ROLE_KEY") {
            return "service-role-key";
          }
          if (name === "APP_ORIGIN") {
            return "https://hub.example.test";
          }
          if (name === "OPERATIONAL_EMAIL_FROM") {
            return "notifications@example.test";
          }
          if (name === "OPERATIONAL_EMAIL_FROM_NAME") {
            return "Lean Excellence Hub";
          }
          return undefined;
        },
        createWorkerClient: () => createMockClient(),
        createProvider: () => createFakeOperationalEmailProvider(),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      summary: {
        claimed: 1,
        sent: 1,
      },
    });
  });

  it("rejects invalid batch size", async () => {
    const response = await handleNotificationDeliveryRequest(
      new Request("https://example.test/notification-delivery", {
        method: "POST",
        headers: {
          Authorization: "Bearer service-role-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batch_size: 0 }),
      }),
      {
        readEnv: (name) => {
          if (name === "SUPABASE_SERVICE_ROLE_KEY") {
            return "service-role-key";
          }
          if (name === "APP_ORIGIN") {
            return "https://hub.example.test";
          }
          if (name === "OPERATIONAL_EMAIL_FROM") {
            return "notifications@example.test";
          }
          return undefined;
        },
        createWorkerClient: () => createMockClient(),
        createProvider: () => createFakeOperationalEmailProvider(),
      },
    );

    expect(response.status).toBe(400);
  });
});

describe("notification delivery processing", () => {
  it("completes delivery after provider acceptance", async () => {
    const client = createMockClient();
    const provider = createFakeOperationalEmailProvider();

    const result = await processClaimedNotificationDelivery(
      client,
      provider,
      {
        appOrigin: "https://hub.example.test",
        operationalEmailFrom:
          "Lean Excellence Hub <notifications@example.test>",
      },
      BASE_DELIVERY,
    );

    expect(result.outcome).toBe("sent");
    expect(result.providerMessageId).toMatch(/^fake-msg-/);
    expect(client.completeNotificationDelivery).toHaveBeenCalledWith({
      organisationId: BASE_DELIVERY.organisationId,
      deliveryId: BASE_DELIVERY.deliveryId,
      leaseToken: BASE_DELIVERY.leaseToken,
      providerMessageId: result.providerMessageId,
    });
  });

  it("uses delivery_key as provider idempotency key", async () => {
    const provider = createFakeOperationalEmailProvider();

    await processClaimedNotificationDelivery(
      createMockClient(),
      provider,
      {
        appOrigin: "https://hub.example.test",
        operationalEmailFrom: "notifications@example.test",
      },
      BASE_DELIVERY,
    );

    expect(provider.getSendsByKey().has(BASE_DELIVERY.deliveryKey)).toBe(true);
  });

  it("retries with the same provider idempotency key", async () => {
    const provider = createFakeOperationalEmailProvider();
    const config = {
      appOrigin: "https://hub.example.test",
      operationalEmailFrom: "notifications@example.test",
    };

    await processClaimedNotificationDelivery(
      createMockClient(),
      provider,
      config,
      BASE_DELIVERY,
    );
    await processClaimedNotificationDelivery(
      createMockClient(),
      provider,
      config,
      BASE_DELIVERY,
    );

    expect(provider.getSendCount()).toBe(2);
    expect(provider.getSendsByKey().size).toBe(1);
  });

  it("terminal-fails missing recipient contact", async () => {
    const client = createMockClient({
      getDeliveryContext: vi.fn(async () => ({
        context: {
          ...DELIVERABLE_CONTEXT,
          recipientResolutionStatus: "no_contact" as const,
          deliverableEmail: null,
        },
        error: null,
      })),
    });

    const result = await processClaimedNotificationDelivery(
      client,
      createFakeOperationalEmailProvider(),
      {
        appOrigin: "https://hub.example.test",
        operationalEmailFrom: "notifications@example.test",
      },
      BASE_DELIVERY,
    );

    expect(result.outcome).toBe("failed_terminal");
    expect(result.errorCode).toBe("missing_recipient_contact");
    expect(client.failNotificationDeliveryTerminal).toHaveBeenCalled();
  });

  it("retryable-fails transient provider errors", async () => {
    const provider = createFakeOperationalEmailProvider({
      failWith: new OperationalEmailProviderError(
        "provider_rate_limited",
        "rate limited",
        { retryable: true, statusCode: 429 },
      ),
    });

    const result = await processClaimedNotificationDelivery(
      createMockClient(),
      provider,
      {
        appOrigin: "https://hub.example.test",
        operationalEmailFrom: "notifications@example.test",
      },
      BASE_DELIVERY,
    );

    expect(result.outcome).toBe("failed_retryable");
    expect(result.errorCode).toBe("provider_rate_limited");
  });

  it("handles lost lease after provider acceptance without sending again", async () => {
    const provider = createFakeOperationalEmailProvider();
    const client = createMockClient({
      completeNotificationDelivery: vi.fn(async () => ({
        data: false,
        error: null,
      })),
    });

    const result = await processClaimedNotificationDelivery(
      client,
      provider,
      {
        appOrigin: "https://hub.example.test",
        operationalEmailFrom: "notifications@example.test",
      },
      BASE_DELIVERY,
    );

    expect(result.outcome).toBe("fencing_loss_after_provider_accept");
    expect(provider.getSendCount()).toBe(1);
    expect(client.failNotificationDeliveryRetryable).not.toHaveBeenCalled();
    expect(client.failNotificationDeliveryTerminal).not.toHaveBeenCalled();
  });

  it("reuses stored provider envelope without re-rendering on retry", async () => {
    const client = createMockClient();
    const provider = createFakeOperationalEmailProvider();
    const config = {
      appOrigin: "https://hub.example.test",
      operationalEmailFrom: "Lean Excellence Hub <notifications@example.test>",
    };

    await processClaimedNotificationDelivery(
      client,
      provider,
      config,
      BASE_DELIVERY,
    );

    const firstPayload = provider
      .getSendsByKey()
      .get(BASE_DELIVERY.deliveryKey)?.message;

    await processClaimedNotificationDelivery(
      client,
      provider,
      config,
      BASE_DELIVERY,
    );

    const secondPayload = provider
      .getSendsByKey()
      .get(BASE_DELIVERY.deliveryKey)?.message;

    expect(client.getDeliveryContext).toHaveBeenCalledTimes(1);
    expect(firstPayload).toEqual(secondPayload);
  });

  it("classifies completion RPC errors separately from provider failures", async () => {
    const client = createMockClient({
      completeNotificationDelivery: vi.fn(async () => ({
        data: null,
        error: { message: "completion rpc failed" },
      })),
    });

    const result = await processClaimedNotificationDelivery(
      client,
      createFakeOperationalEmailProvider(),
      {
        appOrigin: "https://hub.example.test",
        operationalEmailFrom: "notifications@example.test",
      },
      BASE_DELIVERY,
    );

    expect(result.outcome).toBe("completion_failure_after_provider_accept");
    expect(result.errorCode).toBe("completion_db_retryable");
    expect(client.failNotificationDeliveryRetryable).toHaveBeenCalled();
  });

  it("processes partial batch outcomes independently", async () => {
    const secondDelivery = {
      ...BASE_DELIVERY,
      deliveryId: "66666666-6666-4666-8666-666666666666",
      deliveryKey:
        "workforce.job_function_assigned:33333333-3333-4333-8333-333333333333:66666666-6666-4666-8666-666666666666",
    };

    const client = createMockClient({
      claimNotificationDeliveries: vi.fn(async () => ({
        deliveries: [BASE_DELIVERY, secondDelivery],
        error: null,
      })),
      getDeliveryContext: vi.fn(async (input) => {
        if (input.deliveryId === secondDelivery.deliveryId) {
          return {
            context: {
              ...DELIVERABLE_CONTEXT,
              deliveryId: secondDelivery.deliveryId,
              recipientResolutionStatus: "synthetic_auth_email" as const,
              deliverableEmail: null,
            },
            error: null,
          };
        }

        return {
          context: DELIVERABLE_CONTEXT,
          error: null,
        };
      }),
    });

    const summary = await runNotificationDeliveryWorker(
      client,
      createFakeOperationalEmailProvider(),
      {
        appOrigin: "https://hub.example.test",
        operationalEmailFrom: "notifications@example.test",
      },
      2,
    );

    expect(summary.sent).toBe(1);
    expect(summary.failedTerminal).toBe(1);
  });
});
