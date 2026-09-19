import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/platform/supabase/database.types";

export async function callActionRpc<T = unknown>(
  supabase: SupabaseClient<Database>,
  fn: string,
  args?: Record<string, unknown>,
): Promise<{
  data: T | null;
  error: { message: string; code?: string } | null;
}> {
  const { data, error } = await supabase.rpc(
    fn as "create_action",
    (args ?? {}) as never,
  );
  return {
    data: data as T | null,
    error: error ? { message: error.message, code: error.code } : null,
  };
}
