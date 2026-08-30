import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import { handleWorkforceImportBatchRequest } from "../_shared/workforce-import/batch-handler.ts";
import { encryptCredential } from "../_shared/workforce-import/credential-crypto.ts";
import { generateWorkforceTemporaryPassword } from "@workforce/password";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const dependencies = {
  readEnv: (name: string) => Deno.env.get(name),
  createUserClient: (accessToken: string) =>
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
  encryptCredential,
};

Deno.serve((request) =>
  handleWorkforceImportBatchRequest(request, dependencies),
);
