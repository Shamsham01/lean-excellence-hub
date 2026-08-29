import { describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

import { buildAuthEmailDelivery } from "../../supabase/functions/_shared/auth-email/build-message";
import {
  buildAuthConfirmUrl,
  resolveTokenHashForAction,
} from "../../supabase/functions/_shared/auth-email/confirm-url";
import { handleSendEmailRequest } from "../../supabase/functions/_shared/auth-email/handler";
import {
  parseSendEmailHookPayload,
  verifySendEmailHookPayload,
} from "../../supabase/functions/_shared/auth-email/verify";

const APP_ORIGIN = "https://hub.example.test";
const HOOK_SECRET = "v1,whsec_dGVzdC1zZWNyZXQ";

function buildPayload(
  emailActionType: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    user: {
      email: "employee@example.com",
    },
    email_data: {
      token: "123456",
      token_hash: "abc123tokenhash",
      redirect_to: `${APP_ORIGIN}/platform`,
      email_action_type: emailActionType,
      site_url: "https://project.supabase.co",
      token_new: "",
      token_hash_new: "",
      ...overrides,
    },
  };
}

function signPayload(payload: unknown) {
  const webhook = new Webhook(HOOK_SECRET.replace("v1,whsec_", ""));
  const body = JSON.stringify(payload);
  const msgId = "msg_test_id";
  const timestamp = new Date();
  const signature = webhook.sign(msgId, timestamp, body);

  return {
    body,
    headers: {
      "webhook-id": msgId,
      "webhook-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "webhook-signature": signature,
    },
  };
}

describe("auth confirm URLs", () => {
  it("builds signup confirmation URLs through /auth/confirm", () => {
    expect(buildAuthConfirmUrl(APP_ORIGIN, "abc123tokenhash", "signup")).toBe(
      "https://hub.example.test/auth/confirm?token_hash=abc123tokenhash&type=signup",
    );
  });

  it("builds recovery URLs through /auth/confirm", () => {
    expect(buildAuthConfirmUrl(APP_ORIGIN, "abc123tokenhash", "recovery")).toBe(
      "https://hub.example.test/auth/confirm?token_hash=abc123tokenhash&type=recovery",
    );
  });

  it("rejects invalid APP_ORIGIN values", () => {
    expect(() =>
      buildAuthConfirmUrl("not-a-url", "abc123tokenhash", "signup"),
    ).toThrow(/APP_ORIGIN/);
  });

  it("uses token_hash_new for email_change_new actions", () => {
    expect(
      resolveTokenHashForAction("email_change_new", "old-hash", "new-hash"),
    ).toBe("new-hash");
  });
});

describe("auth email delivery content", () => {
  it("creates branded signup confirmation delivery", () => {
    const result = buildAuthEmailDelivery(
      buildPayload("signup") as never,
      APP_ORIGIN,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.delivery.confirmUrl).toBe(
      "https://hub.example.test/auth/confirm?token_hash=abc123tokenhash&type=signup",
    );
    expect(result.delivery.subject).toContain(
      "Confirm your Lean Excellence Hub account",
    );
    expect(result.delivery.html).toContain("Confirm account");
    expect(result.delivery.html).toContain(
      "token_hash=abc123tokenhash&amp;type=signup",
    );
    expect(result.delivery.text).toContain(result.delivery.confirmUrl);
  });

  it("creates recovery delivery through /auth/confirm", () => {
    const result = buildAuthEmailDelivery(
      buildPayload("recovery") as never,
      APP_ORIGIN,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.delivery.confirmUrl).toBe(
      "https://hub.example.test/auth/confirm?token_hash=abc123tokenhash&type=recovery",
    );
    expect(result.delivery.subject).toContain(
      "Recover your Lean Excellence Hub account",
    );
  });

  it("handles unsupported email actions safely", () => {
    const result = buildAuthEmailDelivery(
      buildPayload("reauthentication") as never,
      APP_ORIGIN,
    );

    expect(result).toEqual({ ok: false, reason: "unsupported_action" });
  });
});

describe("send email hook verification", () => {
  it("accepts signed webhook payloads", () => {
    const payload = buildPayload("signup");
    const { body, headers } = signPayload(payload);

    const verified = verifySendEmailHookPayload(
      body,
      headers,
      HOOK_SECRET,
      (rawBody, rawHeaders, secret) => {
        const webhook = new Webhook(secret);
        return parseSendEmailHookPayload(webhook.verify(rawBody, rawHeaders));
      },
    );

    expect(verified.user.email).toBe("employee@example.com");
    expect(verified.email_data.email_action_type).toBe("signup");
  });

  it("rejects unsigned webhook payloads", () => {
    const payload = buildPayload("signup");
    const body = JSON.stringify(payload);

    expect(() =>
      verifySendEmailHookPayload(
        body,
        {},
        HOOK_SECRET,
        (rawBody, rawHeaders, secret) => {
          const webhook = new Webhook(secret);
          return parseSendEmailHookPayload(webhook.verify(rawBody, rawHeaders));
        },
      ),
    ).toThrow(/Invalid Send Email Hook signature/);
  });
});

describe("send email hook handler", () => {
  it("rejects GET requests", async () => {
    const response = await handleSendEmailRequest(
      new Request("https://example.test/send-email", { method: "GET" }),
      {
        readEnv: () => undefined,
        verifyHook: vi.fn(),
        sendEmail: vi.fn(),
      },
    );

    expect(response.status).toBe(405);
  });

  it("sends signup email without calling Resend when mocked", async () => {
    const payload = buildPayload("signup");
    const { body, headers } = signPayload(payload);
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const response = await handleSendEmailRequest(
      new Request("https://example.test/send-email", {
        method: "POST",
        body,
        headers,
      }),
      {
        readEnv: (name) =>
          ({
            SEND_EMAIL_HOOK_SECRET: HOOK_SECRET,
            APP_ORIGIN,
            AUTH_EMAIL_FROM: "auth@resend.dev",
            AUTH_EMAIL_FROM_NAME: "Lean Excellence Hub",
            RESEND_API_KEY: "re_test_key",
          })[name],
        verifyHook: (rawBody, rawHeaders, secret) => {
          const webhook = new Webhook(secret);
          return parseSendEmailHookPayload(webhook.verify(rawBody, rawHeaders));
        },
        sendEmail,
      },
    );

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({
      from: "Lean Excellence Hub <auth@resend.dev>",
      to: "employee@example.com",
      subject: expect.stringContaining(
        "Confirm your Lean Excellence Hub account",
      ),
    });
  });

  it("returns success without sending for unsupported actions", async () => {
    const payload = buildPayload("reauthentication");
    const { body, headers } = signPayload(payload);
    const sendEmail = vi.fn();

    const response = await handleSendEmailRequest(
      new Request("https://example.test/send-email", {
        method: "POST",
        body,
        headers,
      }),
      {
        readEnv: (name) =>
          ({
            SEND_EMAIL_HOOK_SECRET: HOOK_SECRET,
            APP_ORIGIN,
            AUTH_EMAIL_FROM: "auth@resend.dev",
          })[name],
        verifyHook: (rawBody, rawHeaders, secret) => {
          const webhook = new Webhook(secret);
          return parseSendEmailHookPayload(webhook.verify(rawBody, rawHeaders));
        },
        sendEmail,
      },
    );

    expect(response.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
