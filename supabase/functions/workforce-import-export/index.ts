import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import { handleWorkforceImportExportRequest } from "../_shared/workforce-import/export-handler.ts";

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
};

Deno.serve((request) =>
  handleWorkforceImportExportRequest(request, dependencies),
);
