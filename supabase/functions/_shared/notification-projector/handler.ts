import {
  RetryableProjectionError,
  TerminalProjectionError,
  classifyWorkerRpcError,
} from "./errors.ts";
import { projectDomainEvent } from "./registry.ts";
import type {
  ClaimedDomainEvent,
  ProcessedEventSummary,
  WorkerRunSummary,
} from "./types.ts";
import type { NotificationProjectorWorkerClient } from "./worker-client.ts";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 1000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function parseBatchSize(body: Record<string, unknown> | null): number {
  const rawValue = body?.batch_size ?? body?.batchSize;
  if (rawValue === undefined || rawValue === null) {
    return DEFAULT_BATCH_SIZE;
  }

  if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) {
    throw new Error("batch_size must be an integer");
  }

  if (rawValue < 1 || rawValue > MAX_BATCH_SIZE) {
    throw new Error("batch_size must be between 1 and 1000");
  }

  return rawValue;
}

async function markEventFailed(
  client: NotificationProjectorWorkerClient,
  event: ClaimedDomainEvent,
  failure: "terminal" | "retryable",
  errorCode: string,
  errorDetail: string,
): Promise<void> {
  const args = {
    organisationId: event.organisationId,
    eventId: event.eventId,
    leaseToken: event.leaseToken,
    errorCode,
    errorDetail,
  };

  const result =
    failure === "terminal"
      ? await client.failDomainEventTerminal(args)
      : await client.failDomainEventRetryable(args);

  if (result.error) {
    throw result.error;
  }

  if (result.data !== true) {
    throw new Error("event failure RPC returned false");
  }
}

async function markEventCompleted(
  client: NotificationProjectorWorkerClient,
  event: ClaimedDomainEvent,
): Promise<void> {
  const result = await client.completeDomainEvent({
    organisationId: event.organisationId,
    eventId: event.eventId,
    leaseToken: event.leaseToken,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.data !== true) {
    throw new Error("event completion RPC returned false");
  }
}

export async function processClaimedDomainEvent(
  client: NotificationProjectorWorkerClient,
  event: ClaimedDomainEvent,
): Promise<ProcessedEventSummary> {
  try {
    const projection = await projectDomainEvent(event, {
      lookupRecognitionRecipients: (organisationId, awardId) =>
        client.lookupRecognitionRecipients(organisationId, awardId),
    });

    if (!projection) {
      await markEventCompleted(client, event);
      return {
        eventId: event.eventId,
        eventType: event.eventType,
        outcome: "completed",
        deliveryCount: 0,
      };
    }

    if (projection.kind === "noop") {
      await markEventCompleted(client, event);
      return {
        eventId: event.eventId,
        eventType: event.eventType,
        outcome: "completed",
        deliveryCount: 0,
      };
    }

    let deliveryCount = 0;
    for (const intent of projection.intents) {
      const deliveryResult = await client.createNotificationDelivery({
        organisationId: event.organisationId,
        sourceDomainEventId: event.eventId,
        recipientMembershipId: intent.recipientMembershipId,
        notificationKind: intent.notificationKind,
        deliveryKey: intent.deliveryKey,
      });

      if (deliveryResult.error) {
        const failure = classifyWorkerRpcError(deliveryResult.error);
        await markEventFailed(
          client,
          event,
          failure,
          failure === "terminal" ? "delivery_create_terminal" : "delivery_create_retryable",
          deliveryResult.error.message,
        );

        return {
          eventId: event.eventId,
          eventType: event.eventType,
          outcome:
            failure === "terminal" ? "failed_terminal" : "failed_retryable",
          deliveryCount,
          errorCode:
            failure === "terminal"
              ? "delivery_create_terminal"
              : "delivery_create_retryable",
        };
      }

      if (typeof deliveryResult.data !== "string") {
        throw new RetryableProjectionError(
          "delivery_create_retryable",
          "create_notification_delivery_for_worker returned unexpected data",
        );
      }

      deliveryCount += 1;
    }

    await markEventCompleted(client, event);
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      outcome: "completed",
      deliveryCount,
    };
  } catch (error) {
    if (error instanceof TerminalProjectionError) {
      await markEventFailed(
        client,
        event,
        "terminal",
        error.code,
        error.message,
      );
      return {
        eventId: event.eventId,
        eventType: event.eventType,
        outcome: "failed_terminal",
        deliveryCount: 0,
        errorCode: error.code,
      };
    }

    if (error instanceof RetryableProjectionError) {
      await markEventFailed(
        client,
        event,
        "retryable",
        error.code,
        error.message,
      );
      return {
        eventId: event.eventId,
        eventType: event.eventType,
        outcome: "failed_retryable",
        deliveryCount: 0,
        errorCode: error.code,
      };
    }

    const message = error instanceof Error ? error.message : "unknown_error";
    await markEventFailed(
      client,
      event,
      "retryable",
      "projection_retryable",
      message,
    );

    return {
      eventId: event.eventId,
      eventType: event.eventType,
      outcome: "failed_retryable",
      deliveryCount: 0,
      errorCode: "projection_retryable",
    };
  }
}

export async function runNotificationProjector(
  client: NotificationProjectorWorkerClient,
  batchSize: number,
): Promise<WorkerRunSummary> {
  const claimResult = await client.claimDomainEvents(batchSize);
  if (claimResult.error) {
    throw claimResult.error;
  }

  const summary: WorkerRunSummary = {
    claimed: claimResult.events.length,
    completed: 0,
    failedTerminal: 0,
    failedRetryable: 0,
    deliveriesCreated: 0,
    events: [],
  };

  for (const event of claimResult.events) {
    const processed = await processClaimedDomainEvent(client, event);
    summary.events.push(processed);
    summary.deliveriesCreated += processed.deliveryCount;

    if (processed.outcome === "completed") {
      summary.completed += 1;
    } else if (processed.outcome === "failed_terminal") {
      summary.failedTerminal += 1;
    } else {
      summary.failedRetryable += 1;
    }
  }

  return summary;
}

export async function handleNotificationProjectorRequest(
  request: Request,
  dependencies: {
    readEnv: (name: string) => string | undefined;
    createWorkerClient: () => NotificationProjectorWorkerClient;
  },
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const serviceRoleKey = dependencies.readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return jsonResponse({ error: "Worker is not configured." }, 500);
  }

  const bearerToken = readBearerToken(request);
  if (!bearerToken || bearerToken !== serviceRoleKey) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  let batchSize = DEFAULT_BATCH_SIZE;
  try {
    batchSize = parseBatchSize(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid body.";
    return jsonResponse({ error: message }, 400);
  }

  try {
    const summary = await runNotificationProjector(
      dependencies.createWorkerClient(),
      batchSize,
    );
    return jsonResponse({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failed.";
    return jsonResponse({ error: message }, 500);
  }
}
