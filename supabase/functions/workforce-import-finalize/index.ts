import { handleWorkforceImportFinalizeRequest } from "../_shared/workforce-import/finalize-handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve((request) =>
  handleWorkforceImportFinalizeRequest(request, {
    readEnv: (name) => Deno.env.get(name),
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
  }),
);
