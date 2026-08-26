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

export async function callBenefitRpc<T = unknown>(
  supabase: SupabaseClient<Database>,
  fn: string,
  args?: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
  const { data, error } = await supabase.rpc(
    fn as "create_benefit_draft",
    (args ?? {}) as never,
  );
  return { data: data as T | null, error: error ? new Error(error.message) : null };
}
