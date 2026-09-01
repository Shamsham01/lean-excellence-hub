import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import { handleNotificationDeliveryRequest } from "../_shared/notification-delivery/handler.ts";
import { createResendOperationalEmailProvider } from "../_shared/notification-delivery/provider/resend.ts";
import { resolvePrivilegedSupabaseKey } from "../_shared/notification-delivery/worker-auth.ts";
import { createNotificationDeliveryWorkerClient } from "../_shared/notification-delivery/worker-client.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

Deno.serve((request) =>
  handleNotificationDeliveryRequest(request, {
    readEnv: (name) => Deno.env.get(name),
    createWorkerClient: () => {
      const privilegedKey = resolvePrivilegedSupabaseKey((name) =>
        Deno.env.get(name),
      );
      if (!privilegedKey) {
        throw new Error("Worker is not configured.");
      }

      const serviceClient = createClient(supabaseUrl, privilegedKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      return createNotificationDeliveryWorkerClient({
        rpc: (fn, args) => serviceClient.rpc(fn, args),
      });
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
