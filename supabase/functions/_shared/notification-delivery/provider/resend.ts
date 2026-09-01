import { Resend } from "npm:resend@4.8.0";

import { classifyProviderError } from "./classify-error.ts";
import {
  OperationalEmailProviderError,
  type OperationalEmailMessage,
  type OperationalEmailProvider,
  type OperationalEmailSendResult,
} from "./types.ts";

type ResendSendResponse = {
  data?: { id?: string | null } | null;
  error?: { message?: string; name?: string; statusCode?: number } | null;
};

export function createResendOperationalEmailProvider(
  apiKey: string,
): OperationalEmailProvider {
  const resend = new Resend(apiKey);

  return {
    async send(
      message: OperationalEmailMessage,
      idempotencyKey: string,
    ): Promise<OperationalEmailSendResult> {
      let response: ResendSendResponse;

      try {
        response = await resend.emails.send(
          {
            from: message.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          },
          {
            idempotencyKey,
          },
        );
      } catch (error) {
        const classification = classifyProviderError(error);
        throw new OperationalEmailProviderError(
          classification.code,
          readMessage(error),
          {
            retryable: classification.retryable,
            statusCode: readStatusCode(error),
          },
        );
      }

      if (response.error) {
        const statusCode = response.error.statusCode;
        const providerMessage = response.error.message ?? "resend_send_failed";
        const providerErrorName = response.error.name;
        const classification = classifyProviderError({
          statusCode,
          message: providerMessage,
          name: providerErrorName,
        });

        throw new OperationalEmailProviderError(
          classification.code,
          providerMessage,
          {
            retryable: classification.retryable,
            statusCode,
            providerErrorName,
          },
        );
      }

      const providerMessageId = response.data?.id?.trim();
      if (!providerMessageId) {
        throw new OperationalEmailProviderError(
          "provider_missing_message_id",
          "Resend accepted the request without a message id",
          { retryable: true },
        );
      }

      return { providerMessageId };
    },
  };
}

function readStatusCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "resend_send_failed";
}
