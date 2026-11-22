import type { SupabaseClient } from "@supabase/supabase-js";

export async function expectRpc(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    throw new Error(`RPC ${fn} failed: ${error.message}`);
  }
  return data;
}
