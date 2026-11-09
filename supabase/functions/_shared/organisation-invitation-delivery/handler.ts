import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { Resend } from "npm:resend@4.8.0";

import {
  authenticateNotificationWorkerRequest,
  resolvePrivilegedSupabaseKey,
} from "../worker-auth.ts";
import { resolveInvitationDeliveryMailpitCaptureUrl } from "./mailpit-capture-policy.ts";
import {
  buildOrganisationInvitationActivateUrl,
  renderOrganisationInvitationEmail,
} from "./templates.ts";

export { buildOrganisationInvitationActivateUrl } from "./templates.ts";
export {
  isLocalSupabaseInvitationDeliveryRuntime,
  resolveInvitationDeliveryMailpitCaptureUrl,
} from "./mailpit-capture-policy.ts";

export type InvitationDeliveryDispatchPayload = {
  delivery_id: string;
  invitation_token: string;
  inbox_proof: string;
};

type DispatchDependencies = {
  readEnv: (name: string) => string | undefined;
  sendEmail: (input: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
  }) => Promise<{ providerMessageId: string | null }>;
  createServiceClient: (
    url: string,
    serviceKey: string,
  ) => ReturnType<typeof createClient>;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readRequiredEnv(
  readEnv: DispatchDependencies["readEnv"],
  name: string,
): string {
  const value = readEnv(name)?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function formatFrom(fromName: string, fromEmail: string): string {
  if (!fromName.trim()) {
    return fromEmail;
  }
  return `${fromName.trim()} <${fromEmail}>`;
}

async function sha256ByteaHex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `\\x${[...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function normalisePgByteaHex(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("\\x")) {
    return trimmed;
  }
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return `\\x${trimmed}`;
  }
  return trimmed;
}

async function sendViaMailpitCapture(
  captureBaseUrl: string,
  input: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  },
): Promise<{ providerMessageId: string | null }> {
  const match = input.from.match(/^(.*)<([^>]+)>$/);
  const fromEmail = match?.[2]?.trim() ?? input.from;
  const fromName = match?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
  const response = await fetch(
    `${captureBaseUrl.replace(/\/$/, "")}/api/v1/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: fromEmail, Name: fromName },
        To: [{ Email: input.to }],
        Subject: input.subject,
        HTML: input.html,
        Text: input.text,
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `INVITATION_DELIVERY_MAILPIT_URL capture failed (${response.status}): ${detail}`,
    );
  }
  const payload = (await response.json()) as { ID?: string };
  return { providerMessageId: payload.ID ?? null };
}

export async function handleOrganisationInvitationDeliveryRequest(
  request: Request,
  dependencies: DispatchDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const auth = authenticateNotificationWorkerRequest(
    request,
    dependencies.readEnv,
  );
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  let payload: InvitationDeliveryDispatchPayload;
  try {
    const body = (await request.json()) as InvitationDeliveryDispatchPayload;
    if (
      typeof body.delivery_id !== "string" ||
      typeof body.invitation_token !== "string" ||
      typeof body.inbox_proof !== "string"
    ) {
      return jsonResponse({ error: "Invalid payload." }, 400);
    }
    payload = body;
  } catch {
    return jsonResponse({ error: "Invalid JSON." }, 400);
  }

  let lease: { deliveryId: string; leaseToken: string } | null = null;
  let workerClient: ReturnType<
    DispatchDependencies["createServiceClient"]
  > | null = null;

  try {
    const supabaseUrl = readRequiredEnv(dependencies.readEnv, "SUPABASE_URL");
    const serviceKey = resolvePrivilegedSupabaseKey(dependencies.readEnv);
    if (!serviceKey) {
      return jsonResponse({ error: "Worker is not configured." }, 500);
    }
    const appOrigin = readRequiredEnv(dependencies.readEnv, "APP_ORIGIN");
    const fromEmail = readRequiredEnv(dependencies.readEnv, "AUTH_EMAIL_FROM");
    const fromName =
      dependencies.readEnv("AUTH_EMAIL_FROM_NAME")?.trim() ||
      "Lean Excellence Hub";

    const client = dependencies.createServiceClient(supabaseUrl, serviceKey);
    workerClient = client;

    const begin = await client.rpc(
      "begin_organisation_invitation_delivery_send",
      {
        target_delivery_id: payload.delivery_id,
      },
    );

    const row = begin.data?.[0] as
      | {
          delivery_id: string;
          lease_token: string;
          provider_idempotency_key: string;
          recipient_email: string;
          organisation_name: string;
          intended_display_name: string | null;
          invitation_token_digest: string;
          inbox_proof_digest: string;
        }
      | undefined;

    if (begin.error || !row?.delivery_id || !row.lease_token) {
      return jsonResponse({ error: "Delivery is not available to send." }, 409);
    }

    lease = {
      deliveryId: row.delivery_id,
      leaseToken: row.lease_token,
    };

    const submittedTokenDigest = await sha256ByteaHex(payload.invitation_token);
    const submittedProofDigest = await sha256ByteaHex(payload.inbox_proof);
    const expectedTokenDigest = normalisePgByteaHex(
      row.invitation_token_digest,
    );
    const expectedProofDigest = normalisePgByteaHex(row.inbox_proof_digest);

    if (
      !expectedTokenDigest ||
      !expectedProofDigest ||
      submittedTokenDigest.toLowerCase() !== expectedTokenDigest ||
      submittedProofDigest.toLowerCase() !== expectedProofDigest
    ) {
      await client.rpc("fail_organisation_invitation_delivery_for_worker", {
        target_delivery_id: row.delivery_id,
        target_lease_token: row.lease_token,
        target_error_code: "delivery_mismatch",
        target_error_detail:
          "Invitation token or inbox proof did not match the delivery record.",
        target_retryable: false,
      });
      return jsonResponse({ error: "Delivery payload mismatch." }, 400);
    }

    const activateUrl = buildOrganisationInvitationActivateUrl(
      appOrigin,
      payload.invitation_token,
      payload.inbox_proof,
    );

    const rendered = renderOrganisationInvitationEmail({
      organisationName: row.organisation_name,
      recipientEmail: row.recipient_email,
      intendedDisplayName: row.intended_display_name,
      activateUrl,
    });

    const providerResult = await dependencies.sendEmail({
      from: formatFrom(fromName, fromEmail),
      to: row.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: row.provider_idempotency_key,
    });

    const complete = await client.rpc(
      "complete_organisation_invitation_delivery_for_worker",
      {
        target_delivery_id: row.delivery_id,
        target_lease_token: row.lease_token,
        target_provider_message_id: providerResult.providerMessageId,
      },
    );

    if (complete.error || complete.data !== true) {
      await client.rpc("fail_organisation_invitation_delivery_for_worker", {
        target_delivery_id: row.delivery_id,
        target_lease_token: row.lease_token,
        target_error_code: "completion_failed",
        target_error_detail: "Unable to record delivery completion.",
        target_retryable: true,
      });
      return jsonResponse({ error: "Unable to record delivery." }, 500);
    }

    return jsonResponse({ ok: true, delivery_id: row.delivery_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    if (lease && workerClient) {
      try {
        await workerClient.rpc(
          "fail_organisation_invitation_delivery_for_worker",
          {
            target_delivery_id: lease.deliveryId,
            target_lease_token: lease.leaseToken,
            target_error_code: "send_failed",
            target_error_detail: message.slice(0, 500),
            target_retryable: true,
          },
        );
      } catch {
        // Surface the original send failure.
      }
    }
    return jsonResponse({ error: message }, 500);
  }
}

export function createDefaultInvitationDeliveryDependencies(): DispatchDependencies {
  return {
    readEnv: (name) => Deno.env.get(name),
    createServiceClient: (url, serviceKey) =>
      createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    sendEmail: async (input) => {
      const captureUrl = resolveInvitationDeliveryMailpitCaptureUrl((name) =>
        Deno.env.get(name),
      );
      if (captureUrl) {
        return await sendViaMailpitCapture(captureUrl, input);
      }

      const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured.");
      }
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send(
        {
          from: input.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (error) {
        throw error;
      }
      return { providerMessageId: data?.id ?? null };
    },
  };
}
