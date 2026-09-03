export type ClaimedNotificationDelivery = {
  organisationId: string;
  deliveryId: string;
  sourceDomainEventId: string;
  recipientMembershipId: string;
  notificationKind: string;
  deliveryKey: string;
  leaseToken: string;
  attemptCount: number;
};

export type RecipientResolutionStatus =
  | "deliverable"
  | "inactive_membership"
  | "disabled_workforce_account"
  | "no_contact"
  | "synthetic_auth_email"
  | "invalid_email"
  | "not_authorized";

export type NotificationDeliveryContext = {
  organisationId: string;
  organisationName: string;
  deliveryId: string;
  sourceDomainEventId: string;
  notificationKind: string;
  recipientMembershipId: string;
  recipientDisplayName: string;
  recipientResolutionStatus: RecipientResolutionStatus;
  deliverableEmail: string | null;
  eventType: string;
  resourceRecordId: string | null;
  eventPayload: Record<string, unknown>;
  contextTitle: string | null;
  contextDetail: string | null;
  contextLinkPath: string | null;
};

export type RenderedOperationalEmail = {
  subject: string;
  text: string;
  html: string;
};

export type NotificationProviderEnvelope = {
  organisationId: string;
  deliveryId: string;
  deliveryKey: string;
  senderFrom: string;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  payloadHash: string;
};

export type ProcessedDeliverySummary = {
  deliveryId: string;
  notificationKind: string;
  outcome:
    | "sent"
    | "failed_terminal"
    | "failed_retryable"
    | "fencing_loss_after_provider_accept"
    | "completion_failure_after_provider_accept"
    | "invalid_context";
  providerMessageId?: string;
  errorCode?: string;
};

export type WorkerRunSummary = {
  claimed: number;
  sent: number;
  failedTerminal: number;
  failedRetryable: number;
  fencingLossAfterProviderAccept: number;
  completionFailureAfterProviderAccept: number;
  invalidContext: number;
  deliveries: ProcessedDeliverySummary[];
};
