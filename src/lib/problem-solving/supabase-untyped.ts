import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/platform/supabase/database.types";

type UntypedQueryBuilder = ReturnType<SupabaseClient<Database>["from"]>;

export function untypedFrom(
  supabase: SupabaseClient<Database>,
  table: string,
): UntypedQueryBuilder {
  return (
    supabase as SupabaseClient<Database> & {
      from: (relation: string) => UntypedQueryBuilder;
    }
  ).from(table);
}

export type SupabaseRpcError = {
  code: string | null;
  message: string;
};

export async function callProblemSolvingRpc<T = unknown>(
  supabase: SupabaseClient<Database>,
  fn: string,
  args?: Record<string, unknown>,
): Promise<{ data: T | null; error: SupabaseRpcError | null }> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        params?: Record<string, unknown>,
      ) => Promise<{
        data: unknown;
        error: { code?: string; message: string } | null;
      }>;
    }
  ).rpc(fn, args ?? {});
  return {
    data: data as T | null,
    error: error
      ? {
          code: typeof error.code === "string" ? error.code : null,
          message: error.message,
        }
      : null,
  };
}
