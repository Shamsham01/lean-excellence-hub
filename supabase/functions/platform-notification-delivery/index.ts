import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import { handlePlatformNotificationRequest } from "../_shared/platform-notification/handler.ts";
import type { PlatformNotificationEvent } from "../_shared/platform-notification/render.ts";
import { createResendOperationalEmailProvider } from "../_shared/notification-delivery/provider/resend.ts";
import { resolvePrivilegedSupabaseKey } from "../_shared/worker-auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

Deno.serve((request) =>
  handlePlatformNotificationRequest(request, {
    readEnv: (name) => Deno.env.get(name),
    createWorkerClient: () => {
      const privilegedKey = resolvePrivilegedSupabaseKey((name) =>
        Deno.env.get(name),
      );
      if (!privilegedKey) {
        throw new Error("Worker is not configured.");
      }
      const serviceClient = createClient(supabaseUrl, privilegedKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      return {
        claim: async (batchSize) => {
          const { data, error } = await serviceClient.rpc(
            "claim_platform_notifications_for_worker",
            { batch_size: batchSize, lease_seconds: 300 },
          );
          if (error) {
            return { error, events: [] };
          }
          const events = (data ?? []).map((row): PlatformNotificationEvent => ({
            attemptCount: row.attempt_count,
            eventId: row.event_id,
            eventKind: row.event_kind,
            idempotencyKey: row.idempotency_key,
            leaseToken: row.lease_token,
            organisationId: row.organisation_id,
            payload: asRecord(row.payload),
            recipientEmail: row.recipient_email,
          }));
          return { error: null, events };
        },
        complete: async (input) => {
          const { data, error } = await serviceClient.rpc(
            "complete_platform_notification_for_worker",
            {
              expected_lease_token: input.leaseToken,
              target_event_id: input.eventId,
              target_provider_message_id: input.providerMessageId,
            },
          );
          return { data, error };
        },
        failRetryable: async (input) => {
          const { data, error } = await serviceClient.rpc(
            "fail_platform_notification_retryable_for_worker",
            {
              error_code: input.errorCode,
              expected_lease_token: input.leaseToken,
              target_event_id: input.eventId,
            },
          );
          return { data, error };
        },
        failTerminal: async (input) => {
          const { data, error } = await serviceClient.rpc(
            "fail_platform_notification_terminal_for_worker",
            {
              error_code: input.errorCode,
              expected_lease_token: input.leaseToken,
              target_event_id: input.eventId,
            },
          );
          return { data, error };
        },
      };
    },
    createProvider: () => {
      const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not configured.");
      }
      return createResendOperationalEmailProvider(apiKey);
    },
  }),
);
