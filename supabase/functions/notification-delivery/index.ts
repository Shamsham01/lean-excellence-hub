import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import { handleNotificationDeliveryRequest } from "../_shared/notification-delivery/handler.ts";
import { createResendOperationalEmailProvider } from "../_shared/notification-delivery/provider/resend.ts";
import { createNotificationDeliveryWorkerClient } from "../_shared/notification-delivery/worker-client.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve((request) =>
  handleNotificationDeliveryRequest(request, {
    readEnv: (name) => Deno.env.get(name),
    createWorkerClient: () => {
      const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
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
