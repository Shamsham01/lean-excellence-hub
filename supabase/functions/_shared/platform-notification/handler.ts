import { classifyProviderError } from "../notification-delivery/provider/classify-error.ts";
import type { OperationalEmailProvider } from "../notification-delivery/provider/types.ts";
import { authenticateNotificationWorkerRequest } from "../worker-auth.ts";
import {
  renderPlatformNotification,
  type PlatformNotificationEvent,
} from "./render.ts";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;

export type PlatformNotificationWorkerClient = {
  claim: (batchSize: number) => Promise<{
    error: { message: string } | null;
    events: PlatformNotificationEvent[];
  }>;
  complete: (input: {
    eventId: string;
    leaseToken: string;
    providerMessageId: string;
  }) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  failRetryable: (input: {
    errorCode: string;
    eventId: string;
    leaseToken: string;
  }) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  failTerminal: (input: {
    errorCode: string;
    eventId: string;
    leaseToken: string;
  }) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

export type PlatformNotificationDependencies = {
  createProvider: () => OperationalEmailProvider;
  createWorkerClient: () => PlatformNotificationWorkerClient;
  readEnv: (name: string) => string | undefined;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseBatchSize(body: Record<string, unknown> | null) {
  const rawValue = body?.batch_size ?? body?.batchSize;
  if (rawValue === undefined || rawValue === null) {
    return DEFAULT_BATCH_SIZE;
  }
  if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) {
    throw new Error("batch_size must be an integer");
  }
  if (rawValue < 1 || rawValue > MAX_BATCH_SIZE) {
    throw new Error("batch_size must be between 1 and 50");
  }
  return rawValue;
}

export async function handlePlatformNotificationRequest(
  request: Request,
  dependencies: PlatformNotificationDependencies,
) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const auth = authenticateNotificationWorkerRequest(
    request,
    dependencies.readEnv,
  );
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const fromAddress = dependencies.readEnv("OPERATIONAL_EMAIL_FROM")?.trim();
  if (!fromAddress) {
    return jsonResponse(
      { error: "OPERATIONAL_EMAIL_FROM is not configured." },
      500,
    );
  }
  const fromName = dependencies.readEnv("OPERATIONAL_EMAIL_FROM_NAME")?.trim();
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress;
  const appOrigin = dependencies.readEnv("APP_ORIGIN")?.trim() || null;

  let body: Record<string, unknown> | null = null;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  let batchSize: number;
  try {
    batchSize = parseBatchSize(body);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid request." },
      400,
    );
  }

  const client = dependencies.createWorkerClient();
  const provider = dependencies.createProvider();
  const claimed = await client.claim(batchSize);
  if (claimed.error) {
    return jsonResponse({ error: "Notifications could not be claimed." }, 500);
  }

  const results = [];
  for (const event of claimed.events) {
    const message = renderPlatformNotification({ appOrigin, event, from });
    try {
      const sent = await provider.send(message, event.idempotencyKey);
      const completed = await client.complete({
        eventId: event.eventId,
        leaseToken: event.leaseToken,
        providerMessageId: sent.providerMessageId,
      });
      results.push({
        eventId: event.eventId,
        kind: event.eventKind,
        outcome:
          completed.error || completed.data !== true
            ? "complete_failed"
            : "sent",
      });
    } catch (error) {
      const classified = classifyProviderError(error);
      const failure = classified.retryable
        ? await client.failRetryable({
            errorCode: classified.code,
            eventId: event.eventId,
            leaseToken: event.leaseToken,
          })
        : await client.failTerminal({
            errorCode: classified.code,
            eventId: event.eventId,
            leaseToken: event.leaseToken,
          });
      console.info(
        JSON.stringify({
          component: "platform-notification-delivery",
          event_id: event.eventId,
          event_kind: event.eventKind,
          result: classified.retryable ? "failed_retryable" : "failed_terminal",
        }),
      );
      results.push({
        eventId: event.eventId,
        kind: event.eventKind,
        outcome:
          failure.error || failure.data !== true
            ? "failure_record_failed"
            : classified.retryable
              ? "failed_retryable"
              : "failed_terminal",
      });
    }
  }

  return jsonResponse({
    claimed: claimed.events.length,
    results,
  });
}
