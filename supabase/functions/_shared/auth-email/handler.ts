import {
  buildAuthEmailDelivery,
  formatAuthEmailFrom,
} from "./build-message.ts";
import type { SendEmailHookPayload } from "./types.ts";
import {
  createHookErrorResponse,
  createHookSuccessResponse,
  SendEmailHookVerificationError,
  verifySendEmailHookPayload,
} from "./verify.ts";

export type SendEmailDependencies = {
  verifyHook: (
    payload: string,
    headers: Record<string, string>,
    hookSecret: string,
  ) => SendEmailHookPayload;
  sendEmail: (input: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }) => Promise<void>;
  readEnv: (name: string) => string | undefined;
};

function readRequiredEnv(
  readEnv: SendEmailDependencies["readEnv"],
  name: string,
): string {
  const value = readEnv(name)?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export async function handleSendEmailRequest(
  request: Request,
  dependencies: SendEmailDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { message: "Method not allowed." } }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const payload = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    const hookSecret = readRequiredEnv(
      dependencies.readEnv,
      "SEND_EMAIL_HOOK_SECRET",
    );
    const appOrigin = readRequiredEnv(dependencies.readEnv, "APP_ORIGIN");
    const fromEmail = readRequiredEnv(dependencies.readEnv, "AUTH_EMAIL_FROM");
    const fromName =
      dependencies.readEnv("AUTH_EMAIL_FROM_NAME")?.trim() ||
      "Lean Excellence Hub";

    const verifiedPayload = verifySendEmailHookPayload(
      payload,
      headers,
      hookSecret,
      dependencies.verifyHook,
    );

    const deliveryResult = buildAuthEmailDelivery(verifiedPayload, appOrigin);
    if (!deliveryResult.ok) {
      if (deliveryResult.reason === "unsupported_action") {
        return createHookSuccessResponse();
      }

      throw new SendEmailHookVerificationError(
        "Send Email Hook payload is invalid.",
      );
    }

    await dependencies.sendEmail({
      from: formatAuthEmailFrom(fromName, fromEmail),
      to: verifiedPayload.user.email,
      subject: deliveryResult.delivery.subject,
      html: deliveryResult.delivery.html,
      text: deliveryResult.delivery.text,
    });

    return createHookSuccessResponse();
  } catch (error) {
    return createHookErrorResponse(error);
  }
}
