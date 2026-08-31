import { classifyProviderError } from "./provider/classify-error.ts";
import type { OperationalEmailProvider } from "./provider/types.ts";
import { mapRecipientFailureCode } from "./recipient.ts";
import { renderOperationalNotification } from "./renderer/registry.ts";
import type {
  ClaimedNotificationDelivery,
  ProcessedDeliverySummary,
  WorkerRunSummary,
} from "./types.ts";
import type { NotificationDeliveryWorkerClient } from "./worker-client.ts";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 1000;

export type NotificationDeliveryRuntimeConfig = {
  appOrigin: string;
  operationalEmailFrom: string;
};

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

function logDeliveryResult(input: {
  deliveryId: string;
  sourceDomainEventId: string;
  organisationId: string;
  notificationKind: string;
  attemptCount: number;
  result: string;
  providerResultCategory?: string;
}) {
  console.info(
    JSON.stringify({
      component: "notification-delivery",
      delivery_id: input.deliveryId,
      source_domain_event_id: input.sourceDomainEventId,
      organisation_id: input.organisationId,
      notification_kind: input.notificationKind,
      attempt_count: input.attemptCount,
      result: input.result,
      provider_result_category: input.providerResultCategory ?? null,
    }),
  );
}

async function markDeliveryTerminal(
  client: NotificationDeliveryWorkerClient,
  delivery: ClaimedNotificationDelivery,
  errorCode: string,
): Promise<boolean> {
  const result = await client.failNotificationDeliveryTerminal({
    organisationId: delivery.organisationId,
    deliveryId: delivery.deliveryId,
    leaseToken: delivery.leaseToken,
    errorCode,
  });

  if (result.error) {
    throw result.error;
  }

  return result.data === true;
}

async function markDeliveryRetryable(
  client: NotificationDeliveryWorkerClient,
  delivery: ClaimedNotificationDelivery,
  errorCode: string,
): Promise<boolean> {
  const result = await client.failNotificationDeliveryRetryable({
    organisationId: delivery.organisationId,
    deliveryId: delivery.deliveryId,
    leaseToken: delivery.leaseToken,
    errorCode,
  });

  if (result.error) {
    throw result.error;
  }

  return result.data === true;
}

export async function processClaimedNotificationDelivery(
  client: NotificationDeliveryWorkerClient,
  provider: OperationalEmailProvider,
  config: NotificationDeliveryRuntimeConfig,
  delivery: ClaimedNotificationDelivery,
): Promise<ProcessedDeliverySummary> {
  const contextResult = await client.getDeliveryContext({
    organisationId: delivery.organisationId,
    deliveryId: delivery.deliveryId,
    sourceDomainEventId: delivery.sourceDomainEventId,
  });

  if (contextResult.error) {
    await markDeliveryRetryable(client, delivery, "context_lookup_retryable");
    logDeliveryResult({
      deliveryId: delivery.deliveryId,
      sourceDomainEventId: delivery.sourceDomainEventId,
      organisationId: delivery.organisationId,
      notificationKind: delivery.notificationKind,
      attemptCount: delivery.attemptCount,
      result: "failed_retryable",
      providerResultCategory: "context_lookup_retryable",
    });
    return {
      deliveryId: delivery.deliveryId,
      notificationKind: delivery.notificationKind,
      outcome: "failed_retryable",
      errorCode: "context_lookup_retryable",
    };
  }

  if (!contextResult.context) {
    await markDeliveryTerminal(client, delivery, "invalid_delivery_context");
    logDeliveryResult({
      deliveryId: delivery.deliveryId,
      sourceDomainEventId: delivery.sourceDomainEventId,
      organisationId: delivery.organisationId,
      notificationKind: delivery.notificationKind,
      attemptCount: delivery.attemptCount,
      result: "invalid_context",
    });
    return {
      deliveryId: delivery.deliveryId,
      notificationKind: delivery.notificationKind,
      outcome: "invalid_context",
      errorCode: "invalid_delivery_context",
    };
  }

  const context = contextResult.context;

  if (
    context.recipientResolutionStatus !== "deliverable" ||
    !context.deliverableEmail
  ) {
    const errorCode = mapRecipientFailureCode(
      context.recipientResolutionStatus,
    );
    await markDeliveryTerminal(client, delivery, errorCode);
    logDeliveryResult({
      deliveryId: delivery.deliveryId,
      sourceDomainEventId: delivery.sourceDomainEventId,
      organisationId: delivery.organisationId,
      notificationKind: delivery.notificationKind,
      attemptCount: delivery.attemptCount,
      result: "failed_terminal",
      providerResultCategory: errorCode,
    });
    return {
      deliveryId: delivery.deliveryId,
      notificationKind: delivery.notificationKind,
      outcome: "failed_terminal",
      errorCode,
    };
  }

  let rendered;
  try {
    rendered = renderOperationalNotification(context, config.appOrigin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "render_failed";
    await markDeliveryTerminal(client, delivery, "render_terminal");
    logDeliveryResult({
      deliveryId: delivery.deliveryId,
      sourceDomainEventId: delivery.sourceDomainEventId,
      organisationId: delivery.organisationId,
      notificationKind: delivery.notificationKind,
      attemptCount: delivery.attemptCount,
      result: "failed_terminal",
      providerResultCategory: message,
    });
    return {
      deliveryId: delivery.deliveryId,
      notificationKind: delivery.notificationKind,
      outcome: "failed_terminal",
      errorCode: "render_terminal",
    };
  }

  try {
    const providerResult = await provider.send(
      {
        from: config.operationalEmailFrom,
        to: context.deliverableEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
      delivery.deliveryKey,
    );

    const completionResult = await client.completeNotificationDelivery({
      organisationId: delivery.organisationId,
      deliveryId: delivery.deliveryId,
      leaseToken: delivery.leaseToken,
      providerMessageId: providerResult.providerMessageId,
    });

    if (completionResult.error) {
      throw completionResult.error;
    }

    if (completionResult.data !== true) {
      logDeliveryResult({
        deliveryId: delivery.deliveryId,
        sourceDomainEventId: delivery.sourceDomainEventId,
        organisationId: delivery.organisationId,
        notificationKind: delivery.notificationKind,
        attemptCount: delivery.attemptCount,
        result: "fencing_loss_after_provider_accept",
        providerResultCategory: "provider_accepted",
      });
      return {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "fencing_loss_after_provider_accept",
        providerMessageId: providerResult.providerMessageId,
        errorCode: "lease_lost_after_provider_accept",
      };
    }

    logDeliveryResult({
      deliveryId: delivery.deliveryId,
      sourceDomainEventId: delivery.sourceDomainEventId,
      organisationId: delivery.organisationId,
      notificationKind: delivery.notificationKind,
      attemptCount: delivery.attemptCount,
      result: "sent",
      providerResultCategory: "provider_accepted",
    });

    return {
      deliveryId: delivery.deliveryId,
      notificationKind: delivery.notificationKind,
      outcome: "sent",
      providerMessageId: providerResult.providerMessageId,
    };
  } catch (error) {
    const classification = classifyProviderError(error);
    if (classification.retryable) {
      await markDeliveryRetryable(client, delivery, classification.code);
      logDeliveryResult({
        deliveryId: delivery.deliveryId,
        sourceDomainEventId: delivery.sourceDomainEventId,
        organisationId: delivery.organisationId,
        notificationKind: delivery.notificationKind,
        attemptCount: delivery.attemptCount,
        result: "failed_retryable",
        providerResultCategory: classification.code,
      });
      return {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "failed_retryable",
        errorCode: classification.code,
      };
    }

    await markDeliveryTerminal(client, delivery, classification.code);
    logDeliveryResult({
      deliveryId: delivery.deliveryId,
      sourceDomainEventId: delivery.sourceDomainEventId,
      organisationId: delivery.organisationId,
      notificationKind: delivery.notificationKind,
      attemptCount: delivery.attemptCount,
      result: "failed_terminal",
      providerResultCategory: classification.code,
    });
    return {
      deliveryId: delivery.deliveryId,
      notificationKind: delivery.notificationKind,
      outcome: "failed_terminal",
      errorCode: classification.code,
    };
  }
}

export async function runNotificationDeliveryWorker(
  client: NotificationDeliveryWorkerClient,
  provider: OperationalEmailProvider,
  config: NotificationDeliveryRuntimeConfig,
  batchSize: number,
): Promise<WorkerRunSummary> {
  const claimResult = await client.claimNotificationDeliveries(batchSize);
  if (claimResult.error) {
    throw claimResult.error;
  }

  const summary: WorkerRunSummary = {
    claimed: claimResult.deliveries.length,
    sent: 0,
    failedTerminal: 0,
    failedRetryable: 0,
    fencingLossAfterProviderAccept: 0,
    invalidContext: 0,
    deliveries: [],
  };

  for (const delivery of claimResult.deliveries) {
    const processed = await processClaimedNotificationDelivery(
      client,
      provider,
      config,
      delivery,
    );
    summary.deliveries.push(processed);

    if (processed.outcome === "sent") {
      summary.sent += 1;
    } else if (processed.outcome === "failed_terminal") {
      summary.failedTerminal += 1;
    } else if (processed.outcome === "failed_retryable") {
      summary.failedRetryable += 1;
    } else if (processed.outcome === "fencing_loss_after_provider_accept") {
      summary.fencingLossAfterProviderAccept += 1;
    } else {
      summary.invalidContext += 1;
    }
  }

  return summary;
}

export async function handleNotificationDeliveryRequest(
  request: Request,
  dependencies: {
    readEnv: (name: string) => string | undefined;
    createWorkerClient: () => NotificationDeliveryWorkerClient;
    createProvider: () => OperationalEmailProvider;
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

  const appOrigin = dependencies.readEnv("APP_ORIGIN")?.trim();
  const operationalEmailFrom = dependencies
    .readEnv("OPERATIONAL_EMAIL_FROM")
    ?.trim();
  const operationalEmailFromName = dependencies
    .readEnv("OPERATIONAL_EMAIL_FROM_NAME")
    ?.trim();

  if (!appOrigin) {
    return jsonResponse({ error: "APP_ORIGIN is not configured." }, 500);
  }

  if (!operationalEmailFrom) {
    return jsonResponse(
      { error: "OPERATIONAL_EMAIL_FROM is not configured." },
      500,
    );
  }

  const formattedFrom = operationalEmailFromName
    ? `${operationalEmailFromName} <${operationalEmailFrom}>`
    : operationalEmailFrom;

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
    const summary = await runNotificationDeliveryWorker(
      dependencies.createWorkerClient(),
      dependencies.createProvider(),
      {
        appOrigin,
        operationalEmailFrom: formattedFrom,
      },
      batchSize,
    );
    return jsonResponse({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failed.";
    return jsonResponse({ error: message }, 500);
  }
}
