import { OperationalEmailProviderError } from "./types.ts";
import type {
  OperationalEmailMessage,
  OperationalEmailProvider,
  OperationalEmailSendResult,
} from "./types.ts";

type StoredSend = {
  message: OperationalEmailMessage;
  providerMessageId: string;
};

export type FakeOperationalEmailProviderOptions = {
  messageIdPrefix?: string;
  failWith?: OperationalEmailProviderError;
  failOnAttempt?: number;
};

export function createFakeOperationalEmailProvider(
  options: FakeOperationalEmailProviderOptions = {},
): OperationalEmailProvider & {
  getSendCount: () => number;
  getSendsByKey: () => Map<string, StoredSend>;
  getSendAttemptsByKey: () => Map<string, number>;
} {
  const sendsByKey = new Map<string, StoredSend>();
  const attemptsByKey = new Map<string, number>();
  let sendCount = 0;
  const messageIdPrefix = options.messageIdPrefix ?? "fake-msg";

  return {
    getSendCount: () => sendCount,
    getSendsByKey: () => sendsByKey,
    getSendAttemptsByKey: () => attemptsByKey,
    async send(
      message: OperationalEmailMessage,
      idempotencyKey: string,
    ): Promise<OperationalEmailSendResult> {
      const attemptCount = (attemptsByKey.get(idempotencyKey) ?? 0) + 1;
      attemptsByKey.set(idempotencyKey, attemptCount);
      sendCount += 1;

      if (
        options.failOnAttempt !== undefined &&
        attemptCount === options.failOnAttempt
      ) {
        throw (
          options.failWith ??
          new OperationalEmailProviderError(
            "provider_network_error",
            "simulated provider failure",
            { retryable: true },
          )
        );
      }

      if (options.failWith && options.failOnAttempt === undefined) {
        throw options.failWith;
      }

      const existing = sendsByKey.get(idempotencyKey);
      if (existing) {
        const samePayload =
          existing.message.subject === message.subject &&
          existing.message.text === message.text &&
          existing.message.html === message.html &&
          existing.message.to === message.to &&
          existing.message.from === message.from;

        if (!samePayload) {
          throw new OperationalEmailProviderError(
            "provider_idempotency_conflict",
            "idempotency key reused with a different payload",
            { retryable: false, statusCode: 409 },
          );
        }

        return { providerMessageId: existing.providerMessageId };
      }

      const providerMessageId = `${messageIdPrefix}-${sendsByKey.size + 1}`;
      sendsByKey.set(idempotencyKey, {
        message,
        providerMessageId,
      });

      return { providerMessageId };
    },
  };
}
