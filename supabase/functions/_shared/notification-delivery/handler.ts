import { authenticateNotificationWorkerRequest } from "./worker-auth.ts";
import { DeliveryCompletionError } from "./completion-error.ts";
import { computeProviderPayloadHash } from "./envelope-payload.ts";
import { classifyProviderError } from "./provider/classify-error.ts";
import type {
  OperationalEmailMessage,
  OperationalEmailProvider,
} from "./provider/types.ts";
import { mapRecipientFailureCode } from "./recipient.ts";
import { renderOperationalNotification } from "./renderer/registry.ts";
import { requiresDeliveryTimeAuthorizationRevalidation } from "./suggestion-kinds.ts";
import type {
  ClaimedNotificationDelivery,
  NotificationProviderEnvelope,
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
  providerResultCategory?: string | undefined;
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

function envelopeToProviderMessage(
  envelope: NotificationProviderEnvelope,
): OperationalEmailMessage {
  return {
    from: envelope.senderFrom,
    to: envelope.recipientEmail,
    subject: envelope.subject,
    html: envelope.htmlBody,
    text: envelope.textBody,
  };
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

async function resolveProviderMessage(
  client: NotificationDeliveryWorkerClient,
  delivery: ClaimedNotificationDelivery,
  config: NotificationDeliveryRuntimeConfig,
): Promise<
  | { message: OperationalEmailMessage; error: null }
  | { message: null; error: ProcessedDeliverySummary }
> {
  const existingEnvelope = await client.getProviderEnvelope({
    organisationId: delivery.organisationId,
    deliveryId: delivery.deliveryId,
  });

  if (existingEnvelope.error) {
    await markDeliveryRetryable(client, delivery, "envelope_lookup_retryable");
    return {
      message: null,
      error: {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "failed_retryable",
        errorCode: "envelope_lookup_retryable",
      },
    };
  }

  if (existingEnvelope.envelope) {
    if (existingEnvelope.envelope.deliveryKey !== delivery.deliveryKey) {
      await markDeliveryTerminal(
        client,
        delivery,
        "provider_envelope_integrity_conflict",
      );
      return {
        message: null,
        error: {
          deliveryId: delivery.deliveryId,
          notificationKind: delivery.notificationKind,
          outcome: "failed_terminal",
          errorCode: "provider_envelope_integrity_conflict",
        },
      };
    }

    if (
      requiresDeliveryTimeAuthorizationRevalidation(delivery.notificationKind)
    ) {
      const contextResult = await client.getDeliveryContext({
        organisationId: delivery.organisationId,
        deliveryId: delivery.deliveryId,
        sourceDomainEventId: delivery.sourceDomainEventId,
      });

      if (contextResult.error) {
        await markDeliveryRetryable(
          client,
          delivery,
          "context_lookup_retryable",
        );
        return {
          message: null,
          error: {
            deliveryId: delivery.deliveryId,
            notificationKind: delivery.notificationKind,
            outcome: "failed_retryable",
            errorCode: "context_lookup_retryable",
          },
        };
      }

      if (
        !contextResult.context ||
        contextResult.context.recipientResolutionStatus !== "deliverable" ||
        !contextResult.context.deliverableEmail
      ) {
        const errorCode = contextResult.context
          ? mapRecipientFailureCode(
              contextResult.context.recipientResolutionStatus,
            )
          : "invalid_delivery_context";
        await markDeliveryTerminal(client, delivery, errorCode);
        return {
          message: null,
          error: {
            deliveryId: delivery.deliveryId,
            notificationKind: delivery.notificationKind,
            outcome: "failed_terminal",
            errorCode,
          },
        };
      }

      if (
        contextResult.context.deliverableEmail !==
        existingEnvelope.envelope.recipientEmail
      ) {
        await markDeliveryTerminal(client, delivery, "recipient_email_changed");
        return {
          message: null,
          error: {
            deliveryId: delivery.deliveryId,
            notificationKind: delivery.notificationKind,
            outcome: "failed_terminal",
            errorCode: "recipient_email_changed",
          },
        };
      }
    }

    return {
      message: envelopeToProviderMessage(existingEnvelope.envelope),
      error: null,
    };
  }

  const contextResult = await client.getDeliveryContext({
    organisationId: delivery.organisationId,
    deliveryId: delivery.deliveryId,
    sourceDomainEventId: delivery.sourceDomainEventId,
  });

  if (contextResult.error) {
    await markDeliveryRetryable(client, delivery, "context_lookup_retryable");
    return {
      message: null,
      error: {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "failed_retryable",
        errorCode: "context_lookup_retryable",
      },
    };
  }

  if (!contextResult.context) {
    await markDeliveryTerminal(client, delivery, "invalid_delivery_context");
    return {
      message: null,
      error: {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "invalid_context",
        errorCode: "invalid_delivery_context",
      },
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
    return {
      message: null,
      error: {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "failed_terminal",
        errorCode,
      },
    };
  }

  let rendered;
  try {
    rendered = renderOperationalNotification(context, config.appOrigin);
  } catch {
    await markDeliveryTerminal(client, delivery, "render_terminal");
    return {
      message: null,
      error: {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "failed_terminal",
        errorCode: "render_terminal",
      },
    };
  }

  const message: OperationalEmailMessage = {
    from: config.operationalEmailFrom,
    to: context.deliverableEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };

  const payloadHash = await computeProviderPayloadHash(message);
  const storeResult = await client.storeProviderEnvelope({
    organisationId: delivery.organisationId,
    deliveryId: delivery.deliveryId,
    deliveryKey: delivery.deliveryKey,
    senderFrom: message.from,
    recipientEmail: message.to,
    subject: message.subject,
    htmlBody: message.html,
    textBody: message.text,
    payloadHash,
  });

  if (storeResult.error) {
    const isIntegrityConflict =
      storeResult.error.code === "23505" ||
      storeResult.error.message.includes("different payload");

    if (isIntegrityConflict) {
      await markDeliveryTerminal(
        client,
        delivery,
        "provider_envelope_integrity_conflict",
      );
      return {
        message: null,
        error: {
          deliveryId: delivery.deliveryId,
          notificationKind: delivery.notificationKind,
          outcome: "failed_terminal",
          errorCode: "provider_envelope_integrity_conflict",
        },
      };
    }

    await markDeliveryRetryable(client, delivery, "envelope_store_retryable");
    return {
      message: null,
      error: {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "failed_retryable",
        errorCode: "envelope_store_retryable",
      },
    };
  }

  if (!storeResult.envelope) {
    await markDeliveryRetryable(client, delivery, "envelope_store_retryable");
    return {
      message: null,
      error: {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "failed_retryable",
        errorCode: "envelope_store_retryable",
      },
    };
  }

  return {
    message: envelopeToProviderMessage(storeResult.envelope),
    error: null,
  };
}

export async function processClaimedNotificationDelivery(
  client: NotificationDeliveryWorkerClient,
  provider: OperationalEmailProvider,
  config: NotificationDeliveryRuntimeConfig,
  delivery: ClaimedNotificationDelivery,
): Promise<ProcessedDeliverySummary> {
  const resolved = await resolveProviderMessage(client, delivery, config);
  if (resolved.error) {
    logDeliveryResult({
      deliveryId: delivery.deliveryId,
      sourceDomainEventId: delivery.sourceDomainEventId,
      organisationId: delivery.organisationId,
      notificationKind: delivery.notificationKind,
      attemptCount: delivery.attemptCount,
      result: resolved.error.outcome,
      providerResultCategory: resolved.error.errorCode,
    });
    return resolved.error;
  }

  const providerMessage = resolved.message;

  let providerResult;
  try {
    providerResult = await provider.send(providerMessage, delivery.deliveryKey);
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

  try {
    const completionResult = await client.completeNotificationDelivery({
      organisationId: delivery.organisationId,
      deliveryId: delivery.deliveryId,
      leaseToken: delivery.leaseToken,
      providerMessageId: providerResult.providerMessageId,
    });

    if (completionResult.error) {
      throw new DeliveryCompletionError(
        "completion_db_retryable",
        completionResult.error.message,
      );
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
    if (error instanceof DeliveryCompletionError) {
      await markDeliveryRetryable(client, delivery, error.code);
      logDeliveryResult({
        deliveryId: delivery.deliveryId,
        sourceDomainEventId: delivery.sourceDomainEventId,
        organisationId: delivery.organisationId,
        notificationKind: delivery.notificationKind,
        attemptCount: delivery.attemptCount,
        result: "completion_failure_after_provider_accept",
        providerResultCategory: error.code,
      });
      return {
        deliveryId: delivery.deliveryId,
        notificationKind: delivery.notificationKind,
        outcome: "completion_failure_after_provider_accept",
        providerMessageId: providerResult.providerMessageId,
        errorCode: error.code,
      };
    }

    throw error;
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
    completionFailureAfterProviderAccept: 0,
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
    } else if (
      processed.outcome === "completion_failure_after_provider_accept"
    ) {
      summary.completionFailureAfterProviderAccept += 1;
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

  const authResult = authenticateNotificationWorkerRequest(
    request,
    dependencies.readEnv,
  );
  if (!authResult.ok) {
    return jsonResponse({ error: authResult.error }, authResult.status);
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
