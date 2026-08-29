import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import { handleWorkforceProvisionRequest } from "../_shared/workforce-provision/handler.ts";
import { generateWorkforceTemporaryPassword } from "@workforce/password";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve((request) =>
  handleWorkforceProvisionRequest(request, {
    readEnv: (name) => Deno.env.get(name),
    createUserClient: (accessToken) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    createServiceClient: () =>
      createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    createAuthAdminClient: () =>
      createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    generatePassword: () => generateWorkforceTemporaryPassword(),
  }),
);
