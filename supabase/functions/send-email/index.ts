import { Webhook } from "npm:standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.8.0";

import { handleSendEmailRequest } from "../_shared/auth-email/handler.ts";
import { parseSendEmailHookPayload } from "../_shared/auth-email/verify.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");

Deno.serve((request) =>
  handleSendEmailRequest(request, {
    readEnv: (name) => Deno.env.get(name),
    verifyHook: (payload, headers, hookSecret) => {
      const webhook = new Webhook(hookSecret);
      const verified = webhook.verify(payload, headers);
      return parseSendEmailHookPayload(verified);
    },
    sendEmail: async ({ from, to, subject, html, text }) => {
      const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured.");
      }

      const { error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
        text,
      });

      if (error) {
        throw error;
      }
    },
  }),
);
