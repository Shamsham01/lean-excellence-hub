import type { SendEmailHookPayload } from "./types";

export class SendEmailHookVerificationError extends Error {
  readonly status = 401;
}

export function normalizeSendEmailHookSecret(secret: string): string {
  const trimmed = secret.trim();
  return trimmed.startsWith("v1,whsec_")
    ? trimmed.replace("v1,whsec_", "")
    : trimmed;
}

export function verifySendEmailHookPayload(
  payload: string,
  headers: Record<string, string>,
  hookSecret: string,
  verify: (
    payload: string,
    headers: Record<string, string>,
    secret: string,
  ) => SendEmailHookPayload,
): SendEmailHookPayload {
  if (!hookSecret.trim()) {
    throw new SendEmailHookVerificationError(
      "Send Email Hook secret is not configured.",
    );
  }

  try {
    return verify(payload, headers, normalizeSendEmailHookSecret(hookSecret));
  } catch {
    throw new SendEmailHookVerificationError(
      "Invalid Send Email Hook signature.",
    );
  }
}

export function parseSendEmailHookPayload(
  value: unknown,
): SendEmailHookPayload {
  if (!value || typeof value !== "object") {
    throw new SendEmailHookVerificationError(
      "Malformed Send Email Hook payload.",
    );
  }

  const record = value as Record<string, unknown>;
  const user = record.user;
  const emailData = record.email_data;

  if (!user || typeof user !== "object") {
    throw new SendEmailHookVerificationError(
      "Malformed Send Email Hook payload.",
    );
  }

  if (!emailData || typeof emailData !== "object") {
    throw new SendEmailHookVerificationError(
      "Malformed Send Email Hook payload.",
    );
  }

  const userRecord = user as Record<string, unknown>;
  const emailDataRecord = emailData as Record<string, unknown>;

  if (typeof userRecord.email !== "string" || !userRecord.email.trim()) {
    throw new SendEmailHookVerificationError(
      "Malformed Send Email Hook payload.",
    );
  }

  if (typeof emailDataRecord.email_action_type !== "string") {
    throw new SendEmailHookVerificationError(
      "Malformed Send Email Hook payload.",
    );
  }

  return {
    user: {
      email: userRecord.email,
    },
    email_data: {
      token:
        typeof emailDataRecord.token === "string" ? emailDataRecord.token : "",
      token_hash:
        typeof emailDataRecord.token_hash === "string"
          ? emailDataRecord.token_hash
          : "",
      redirect_to:
        typeof emailDataRecord.redirect_to === "string"
          ? emailDataRecord.redirect_to
          : "",
      email_action_type: emailDataRecord.email_action_type,
      site_url:
        typeof emailDataRecord.site_url === "string"
          ? emailDataRecord.site_url
          : "",
      token_new:
        typeof emailDataRecord.token_new === "string"
          ? emailDataRecord.token_new
          : "",
      token_hash_new:
        typeof emailDataRecord.token_hash_new === "string"
          ? emailDataRecord.token_hash_new
          : "",
      ...(typeof emailDataRecord.old_email === "string"
        ? { old_email: emailDataRecord.old_email }
        : {}),
      ...(typeof emailDataRecord.old_phone === "string"
        ? { old_phone: emailDataRecord.old_phone }
        : {}),
      ...(typeof emailDataRecord.provider === "string"
        ? { provider: emailDataRecord.provider }
        : {}),
      ...(typeof emailDataRecord.factor_type === "string"
        ? { factor_type: emailDataRecord.factor_type }
        : {}),
    },
  };
}

export function createHookErrorResponse(error: unknown): Response {
  const message =
    error instanceof SendEmailHookVerificationError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Send Email Hook request failed.";

  const status =
    error instanceof SendEmailHookVerificationError ? error.status : 500;

  return new Response(
    JSON.stringify({
      error: {
        message,
      },
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

export function createHookSuccessResponse(): Response {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
