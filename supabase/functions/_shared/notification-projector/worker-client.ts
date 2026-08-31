import type { ClaimedDomainEvent } from "./types.ts";

type RpcResult = PromiseLike<{
  data: unknown;
  error: { message: string; code?: string } | null;
}>;

export type NotificationProjectorWorkerClient = {
  claimDomainEvents: (
    batchSize: number,
  ) => Promise<{ events: ClaimedDomainEvent[]; error: null } | { events: []; error: { message: string; code?: string } }>;
  createNotificationDelivery: (input: {
    organisationId: string;
    sourceDomainEventId: string;
    recipientMembershipId: string;
    notificationKind: string;
    deliveryKey: string;
  }) => RpcResult;
  completeDomainEvent: (input: {
    organisationId: string;
    eventId: string;
    leaseToken: string;
  }) => RpcResult;
  failDomainEventRetryable: (input: {
    organisationId: string;
    eventId: string;
    leaseToken: string;
    errorCode: string;
    errorDetail?: string;
  }) => RpcResult;
  failDomainEventTerminal: (input: {
    organisationId: string;
    eventId: string;
    leaseToken: string;
    errorCode: string;
    errorDetail?: string;
  }) => RpcResult;
  lookupRecognitionRecipients: (
    organisationId: string,
    awardId: string,
  ) => Promise<string[]>;
};

type ClaimRow = {
  organisation_id: string;
  event_id: string;
  resource_record_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  lease_token: string;
  attempt_count: number;
};

export function createNotificationProjectorWorkerClient(deps: {
  rpc: (fn: string, args: Record<string, unknown>) => RpcResult;
  from: (
    table: string,
  ) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{
          data: Array<{ membership_id: string }> | null;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
  };
}): NotificationProjectorWorkerClient {
  return {
    async claimDomainEvents(batchSize) {
      const { data, error } = await deps.rpc("claim_domain_events_for_worker", {
        batch_size: batchSize,
      });

      if (error) {
        return { events: [], error };
      }

      const rows = (data ?? []) as ClaimRow[];
      return {
        events: rows.map((row) => ({
          organisationId: row.organisation_id,
          eventId: row.event_id,
          resourceRecordId: row.resource_record_id,
          eventType: row.event_type,
          payload: (row.payload ?? {}) as Record<string, unknown>,
          leaseToken: row.lease_token,
          attemptCount: row.attempt_count,
        })),
        error: null,
      };
    },
    createNotificationDelivery(input) {
      return deps.rpc("create_notification_delivery_for_worker", {
        target_organisation_id: input.organisationId,
        source_domain_event_id: input.sourceDomainEventId,
        recipient_membership_id: input.recipientMembershipId,
        notification_kind: input.notificationKind,
        target_delivery_key: input.deliveryKey,
      });
    },
    completeDomainEvent(input) {
      return deps.rpc("complete_domain_event_for_worker", {
        target_organisation_id: input.organisationId,
        target_event_id: input.eventId,
        expected_lease_token: input.leaseToken,
      });
    },
    failDomainEventRetryable(input) {
      return deps.rpc("fail_domain_event_retryable_for_worker", {
        target_organisation_id: input.organisationId,
        target_event_id: input.eventId,
        expected_lease_token: input.leaseToken,
        error_code: input.errorCode,
        error_detail: input.errorDetail ?? null,
      });
    },
    failDomainEventTerminal(input) {
      return deps.rpc("fail_domain_event_terminal_for_worker", {
        target_organisation_id: input.organisationId,
        target_event_id: input.eventId,
        expected_lease_token: input.leaseToken,
        error_code: input.errorCode,
        error_detail: input.errorDetail ?? null,
      });
    },
    async lookupRecognitionRecipients(organisationId, awardId) {
      const { data, error } = await deps
        .from("recognition_recipients")
        .select("membership_id")
        .eq("organisation_id", organisationId)
        .eq("recognition_award_id", awardId);

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => row.membership_id);
    },
  };
}
