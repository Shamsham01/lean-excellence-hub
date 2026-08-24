import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function currentMemberHasPermission(permissionKey: string) {
  const supabase = await createServerSupabaseClient();
  const orgId = await supabase.rpc("current_organisation_id");
  if (orgId.error || !orgId.data) {
    return false;
  }

  const result = await supabase.rpc("has_scoped_permission", {
    target_organisation_id: orgId.data,
    target_permission_key: permissionKey,
  });

  return result.data === true;
}
