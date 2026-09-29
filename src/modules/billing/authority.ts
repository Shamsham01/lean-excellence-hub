import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function currentCanManageBilling() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_can_manage_billing");
  if (error) {
    return false;
  }
  return data === true;
}
