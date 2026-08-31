export type ClaimedDomainEvent = {
  organisationId: string;
  eventId: string;
  resourceRecordId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  leaseToken: string;
  attemptCount: number;
};

export type ProjectionIntent = {
  recipientMembershipId: string;
  notificationKind: string;
  deliveryKey: string;
};

export type ProjectorOutcome =
  | { kind: "project"; intents: ProjectionIntent[] }
  | { kind: "noop" };

export type ProjectorContext = {
  lookupRecognitionRecipients: (
    organisationId: string,
    awardId: string,
  ) => Promise<string[]>;
};

export type ProcessedEventSummary = {
  eventId: string;
  eventType: string;
  outcome: "completed" | "failed_terminal" | "failed_retryable";
  deliveryCount: number;
  errorCode?: string;
};

export type WorkerRunSummary = {
  claimed: number;
  completed: number;
  failedTerminal: number;
  failedRetryable: number;
  deliveriesCreated: number;
  events: ProcessedEventSummary[];
};
