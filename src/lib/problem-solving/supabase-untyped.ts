import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/platform/supabase/database.types";

type UntypedQueryBuilder = ReturnType<SupabaseClient<Database>["from"]>;

export function untypedFrom(
  supabase: SupabaseClient<Database>,
  table: string,
): UntypedQueryBuilder {
  return (supabase as SupabaseClient<Database> & {
    from: (relation: string) => UntypedQueryBuilder;
  }).from(table);
}

export async function callProblemSolvingRpc<T = unknown>(
  supabase: SupabaseClient<Database>,
  fn: string,
  args?: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
  const client = supabase as SupabaseClient<Database> & {
    rpc: (
      name: string,
      params?: Record<string, unknown>,
    ) => ReturnType<SupabaseClient<Database>["rpc"]>;
  };
  const { data, error } = await client.rpc(fn, args ?? {});
  return { data: data as T | null, error: error ? new Error(error.message) : null };
}
