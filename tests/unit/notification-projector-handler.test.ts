import { describe, expect, it, vi } from "vitest";

import { TerminalProjectionError } from "../../supabase/functions/_shared/notification-projector/errors.ts";
import {
  handleNotificationProjectorRequest,
  processClaimedDomainEvent,
  runNotificationProjector,
} from "../../supabase/functions/_shared/notification-projector/handler.ts";
import {
  JOB_FUNCTION_ASSIGNED_KIND,
  projectJobFunctionAssigned,
} from "../../supabase/functions/_shared/notification-projector/projectors/job-function-assigned.ts";
import type { ClaimedDomainEvent } from "../../supabase/functions/_shared/notification-projector/types.ts";
import type { NotificationProjectorWorkerClient } from "../../supabase/functions/_shared/notification-projector/worker-client.ts";

const ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBERSHIP_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LEASE_TOKEN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function buildEvent(
  overrides: Partial<ClaimedDomainEvent> = {},
): ClaimedDomainEvent {
  return {
    organisationId: ORG_ID,
    eventId: EVENT_ID,
    resourceRecordId: null,
    eventType: "JobFunctionAssigned",
    payload: {
      membership_id: MEMBERSHIP_ID,
    },
    leaseToken: LEASE_TOKEN,
    attemptCount: 1,
    ...overrides,
  };
}

function createMockClient(
  overrides: Partial<NotificationProjectorWorkerClient> = {},
): NotificationProjectorWorkerClient {
  return {
    claimDomainEvents: vi.fn(async () => ({ events: [], error: null })),
    createNotificationDelivery: vi.fn(async () => ({
      data: "delivery-id",
      error: null,
    })),
    completeDomainEvent: vi.fn(async () => ({ data: true, error: null })),
    failDomainEventRetryable: vi.fn(async () => ({ data: true, error: null })),
    failDomainEventTerminal: vi.fn(async () => ({ data: true, error: null })),
    lookupRecognitionRecipients: vi.fn(async () => []),
    ...overrides,
  };
}

describe("notification projector handler", () => {
  it("projects a supported event and completes after delivery creation", async () => {
    const client = createMockClient();
    const event = buildEvent();
    const intent = projectJobFunctionAssigned(event);
    if (intent.kind !== "project") {
      throw new Error("expected project outcome");
    }

    const summary = await processClaimedDomainEvent(client, event);

    expect(summary.outcome).toBe("completed");
    expect(summary.deliveryCount).toBe(1);
    expect(client.createNotificationDelivery).toHaveBeenCalledWith({
      organisationId: ORG_ID,
      sourceDomainEventId: EVENT_ID,
      recipientMembershipId: MEMBERSHIP_ID,
      notificationKind: JOB_FUNCTION_ASSIGNED_KIND,
      deliveryKey: intent.intents[0]?.deliveryKey,
    });
    expect(client.completeDomainEvent).toHaveBeenCalledWith({
      organisationId: ORG_ID,
      eventId: EVENT_ID,
      leaseToken: LEASE_TOKEN,
    });
  });

  it("uses the same delivery key on retry", async () => {
    const event = buildEvent();
    const firstIntent = projectJobFunctionAssigned(event);
    const secondIntent = projectJobFunctionAssigned(event);

    expect(firstIntent).toEqual(secondIntent);
  });

  it("completes unsupported events without creating deliveries", async () => {
    const client = createMockClient();
    const summary = await processClaimedDomainEvent(
      client,
      buildEvent({ eventType: "ActionCreated", payload: {} }),
    );

    expect(summary.outcome).toBe("completed");
    expect(summary.deliveryCount).toBe(0);
    expect(client.createNotificationDelivery).not.toHaveBeenCalled();
    expect(client.completeDomainEvent).toHaveBeenCalledTimes(1);
  });

  it("handles zero claimed events", async () => {
    const client = createMockClient();
    const summary = await runNotificationProjector(client, 10);

    expect(summary.claimed).toBe(0);
    expect(summary.completed).toBe(0);
    expect(summary.deliveriesCreated).toBe(0);
  });

  it("fails malformed membership payload events terminally", async () => {
    const client = createMockClient();
    const summary = await processClaimedDomainEvent(
      client,
      buildEvent({ payload: {} }),
    );

    expect(summary.outcome).toBe("failed_terminal");
    expect(summary.errorCode).toBe("invalid_payload");
    expect(client.failDomainEventTerminal).toHaveBeenCalledTimes(1);
    expect(client.createNotificationDelivery).not.toHaveBeenCalled();
  });

  it("classifies delivery RPC failures as retryable or terminal", async () => {
    const retryableClient = createMockClient({
      createNotificationDelivery: vi.fn(async () => ({
        data: null,
        error: { message: "connection reset", code: "08006" },
      })),
    });
    const retryableSummary = await processClaimedDomainEvent(
      retryableClient,
      buildEvent(),
    );
    expect(retryableSummary.outcome).toBe("failed_retryable");
    expect(retryableClient.failDomainEventRetryable).toHaveBeenCalledTimes(1);

    const terminalClient = createMockClient({
      createNotificationDelivery: vi.fn(async () => ({
        data: null,
        error: {
          message: "recipient membership organisation mismatch",
          code: "23514",
        },
      })),
    });
    const terminalSummary = await processClaimedDomainEvent(
      terminalClient,
      buildEvent(),
    );
    expect(terminalSummary.outcome).toBe("failed_terminal");
    expect(terminalClient.failDomainEventTerminal).toHaveBeenCalledTimes(1);
  });

  it("projects multiple recipients when applicable", async () => {
    const client = createMockClient({
      lookupRecognitionRecipients: vi.fn(async () => [
        MEMBERSHIP_ID,
        "ffffffff-ffff-4fff-8fff-ffffffffffff",
      ]),
    });

    const summary = await processClaimedDomainEvent(
      client,
      buildEvent({
        eventType: "RecognitionAwarded",
        resourceRecordId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        payload: {},
      }),
    );

    expect(summary.outcome).toBe("completed");
    expect(summary.deliveryCount).toBe(2);
    expect(client.createNotificationDelivery).toHaveBeenCalledTimes(2);
  });

  it("completes events only after delivery creation succeeds", async () => {
    const client = createMockClient({
      createNotificationDelivery: vi
        .fn()
        .mockResolvedValueOnce({ data: "delivery-id", error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "temporary outage" },
        }),
    });

    await processClaimedDomainEvent(client, buildEvent());
    expect(client.completeDomainEvent).toHaveBeenCalledTimes(1);

    vi.mocked(client.completeDomainEvent).mockClear();
    await processClaimedDomainEvent(
      client,
      buildEvent({ eventId: "99999999-9999-4999-8999-999999999999" }),
    );
    expect(client.completeDomainEvent).not.toHaveBeenCalled();
    expect(client.failDomainEventRetryable).toHaveBeenCalledTimes(1);
  });

  it("rejects requests without the service role bearer token", async () => {
    const response = await handleNotificationProjectorRequest(
      new Request("http://localhost/functions/v1/notification-projector", {
        method: "POST",
        headers: {
          Authorization: "Bearer wrong-token",
        },
      }),
      {
        readEnv: () => "service-role-key",
        createWorkerClient: () => createMockClient(),
      },
    );

    expect(response.status).toBe(401);
  });

  it("accepts authorized requests and returns a worker summary", async () => {
    const client = createMockClient({
      claimDomainEvents: vi.fn(async () => ({
        events: [buildEvent()],
        error: null,
      })),
    });

    const response = await handleNotificationProjectorRequest(
      new Request("http://localhost/functions/v1/notification-projector", {
        method: "POST",
        headers: {
          Authorization: "Bearer service-role-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batch_size: 1 }),
      }),
      {
        readEnv: () => "service-role-key",
        createWorkerClient: () => client,
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      summary: { completed: number; deliveriesCreated: number };
    };
    expect(payload.ok).toBe(true);
    expect(payload.summary.completed).toBe(1);
    expect(payload.summary.deliveriesCreated).toBe(1);
  });

  it("surfaces terminal projector validation failures", () => {
    expect(() =>
      new TerminalProjectionError("invalid_payload", "missing membership"),
    ).toMatchObject({ code: "invalid_payload" });
  });
});
