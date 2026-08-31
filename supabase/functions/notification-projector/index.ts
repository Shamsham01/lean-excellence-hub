import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import { handleNotificationProjectorRequest } from "../_shared/notification-projector/handler.ts";
import { createNotificationProjectorWorkerClient } from "../_shared/notification-projector/worker-client.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve((request) =>
  handleNotificationProjectorRequest(request, {
    readEnv: (name) => Deno.env.get(name),
    createWorkerClient: () => {
      const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      return createNotificationProjectorWorkerClient({
        rpc: (fn, args) => serviceClient.rpc(fn, args),
        from: (table) => serviceClient.from(table),
      });
    },
  }),
);
