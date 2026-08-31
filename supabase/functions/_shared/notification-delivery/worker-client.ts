import type {
  ClaimedNotificationDelivery,
  NotificationDeliveryContext,
  NotificationProviderEnvelope,
  RecipientResolutionStatus,
} from "./types.ts";

type RpcResult = PromiseLike<{
  data: unknown;
  error: { message: string; code?: string } | null;
}>;

export type NotificationDeliveryWorkerClient = {
  claimNotificationDeliveries: (
    batchSize: number,
  ) => Promise<
    | { deliveries: ClaimedNotificationDelivery[]; error: null }
    | { deliveries: []; error: { message: string; code?: string } }
  >;
  getDeliveryContext: (input: {
    organisationId: string;
    deliveryId: string;
    sourceDomainEventId: string;
  }) => Promise<
    | { context: NotificationDeliveryContext; error: null }
    | { context: null; error: { message: string; code?: string } | null }
  >;
  getProviderEnvelope: (input: {
    organisationId: string;
    deliveryId: string;
  }) => Promise<
    | { envelope: NotificationProviderEnvelope; error: null }
    | { envelope: null; error: { message: string; code?: string } | null }
  >;
  storeProviderEnvelope: (input: {
    organisationId: string;
    deliveryId: string;
    deliveryKey: string;
    senderFrom: string;
    recipientEmail: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    payloadHash: string;
  }) => Promise<
    | { envelope: NotificationProviderEnvelope; error: null }
    | { envelope: null; error: { message: string; code?: string } | null }
  >;
  completeNotificationDelivery: (input: {
    organisationId: string;
    deliveryId: string;
    leaseToken: string;
    providerMessageId: string;
  }) => RpcResult;
  failNotificationDeliveryRetryable: (input: {
    organisationId: string;
    deliveryId: string;
    leaseToken: string;
    errorCode: string;
  }) => RpcResult;
  failNotificationDeliveryTerminal: (input: {
    organisationId: string;
    deliveryId: string;
    leaseToken: string;
    errorCode: string;
  }) => RpcResult;
};

type ClaimRow = {
  organisation_id: string;
  delivery_id: string;
  source_domain_event_id: string;
  recipient_membership_id: string;
  notification_kind: string;
  delivery_key: string;
  lease_token: string;
  attempt_count: number;
};

type ContextRow = {
  organisation_id: string;
  organisation_name: string;
  delivery_id: string;
  source_domain_event_id: string;
  notification_kind: string;
  recipient_membership_id: string;
  recipient_display_name: string;
  recipient_resolution_status: RecipientResolutionStatus;
  deliverable_email: string | null;
  event_type: string;
  resource_record_id: string | null;
  event_payload: Record<string, unknown> | null;
  context_title: string | null;
  context_detail: string | null;
  context_link_path: string | null;
};

type EnvelopeRow = {
  organisation_id: string;
  delivery_id: string;
  delivery_key: string;
  sender_from: string;
  recipient_email: string;
  subject: string;
  html_body: string;
  text_body: string;
  payload_hash: string;
};

function mapEnvelopeRow(row: EnvelopeRow): NotificationProviderEnvelope {
  return {
    organisationId: row.organisation_id,
    deliveryId: row.delivery_id,
    deliveryKey: row.delivery_key,
    senderFrom: row.sender_from,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    htmlBody: row.html_body,
    textBody: row.text_body,
    payloadHash: row.payload_hash,
  };
}

export function createNotificationDeliveryWorkerClient(deps: {
  rpc: (fn: string, args: Record<string, unknown>) => RpcResult;
}): NotificationDeliveryWorkerClient {
  return {
    async claimNotificationDeliveries(batchSize) {
      const { data, error } = await deps.rpc(
        "claim_notification_deliveries_for_worker",
        {
          batch_size: batchSize,
        },
      );

      if (error) {
        return { deliveries: [], error };
      }

      const rows = (data ?? []) as ClaimRow[];
      return {
        deliveries: rows.map((row) => ({
          organisationId: row.organisation_id,
          deliveryId: row.delivery_id,
          sourceDomainEventId: row.source_domain_event_id,
          recipientMembershipId: row.recipient_membership_id,
          notificationKind: row.notification_kind,
          deliveryKey: row.delivery_key,
          leaseToken: row.lease_token,
          attemptCount: row.attempt_count,
        })),
        error: null,
      };
    },
    async getDeliveryContext(input) {
      const { data, error } = await deps.rpc(
        "get_notification_delivery_context_for_worker",
        {
          target_organisation_id: input.organisationId,
          target_delivery_id: input.deliveryId,
          target_source_domain_event_id: input.sourceDomainEventId,
        },
      );

      if (error) {
        return { context: null, error };
      }

      const rows = (data ?? []) as ContextRow[];
      const row = rows[0];
      if (!row) {
        return { context: null, error: null };
      }

      return {
        context: {
          organisationId: row.organisation_id,
          organisationName: row.organisation_name,
          deliveryId: row.delivery_id,
          sourceDomainEventId: row.source_domain_event_id,
          notificationKind: row.notification_kind,
          recipientMembershipId: row.recipient_membership_id,
          recipientDisplayName: row.recipient_display_name,
          recipientResolutionStatus: row.recipient_resolution_status,
          deliverableEmail: row.deliverable_email,
          eventType: row.event_type,
          resourceRecordId: row.resource_record_id,
          eventPayload: (row.event_payload ?? {}) as Record<string, unknown>,
          contextTitle: row.context_title,
          contextDetail: row.context_detail,
          contextLinkPath: row.context_link_path,
        },
        error: null,
      };
    },
    async getProviderEnvelope(input) {
      const { data, error } = await deps.rpc(
        "get_notification_delivery_provider_envelope_for_worker",
        {
          target_organisation_id: input.organisationId,
          target_delivery_id: input.deliveryId,
        },
      );

      if (error) {
        return { envelope: null, error };
      }

      const rows = (data ?? []) as EnvelopeRow[];
      const row = rows[0];
      if (!row) {
        return { envelope: null, error: null };
      }

      return { envelope: mapEnvelopeRow(row), error: null };
    },
    async storeProviderEnvelope(input) {
      const { data, error } = await deps.rpc(
        "store_notification_delivery_provider_envelope_for_worker",
        {
          target_organisation_id: input.organisationId,
          target_delivery_id: input.deliveryId,
          expected_delivery_key: input.deliveryKey,
          target_sender_from: input.senderFrom,
          target_recipient_email: input.recipientEmail,
          target_subject: input.subject,
          target_html_body: input.htmlBody,
          target_text_body: input.textBody,
          target_payload_hash: input.payloadHash,
        },
      );

      if (error) {
        return { envelope: null, error };
      }

      const rows = (data ?? []) as EnvelopeRow[];
      const row = rows[0];
      if (!row) {
        return {
          envelope: null,
          error: { message: "store_provider_envelope returned no row" },
        };
      }

      return { envelope: mapEnvelopeRow(row), error: null };
    },
    completeNotificationDelivery(input) {
      return deps.rpc("complete_notification_delivery_for_worker", {
        target_organisation_id: input.organisationId,
        target_delivery_id: input.deliveryId,
        expected_lease_token: input.leaseToken,
        target_provider_message_id: input.providerMessageId,
      });
    },
    failNotificationDeliveryRetryable(input) {
      return deps.rpc("fail_notification_delivery_retryable_for_worker", {
        target_organisation_id: input.organisationId,
        target_delivery_id: input.deliveryId,
        expected_lease_token: input.leaseToken,
        error_code: input.errorCode,
      });
    },
    failNotificationDeliveryTerminal(input) {
      return deps.rpc("fail_notification_delivery_terminal_for_worker", {
        target_organisation_id: input.organisationId,
        target_delivery_id: input.deliveryId,
        expected_lease_token: input.leaseToken,
        error_code: input.errorCode,
      });
    },
  };
}
