import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function currentMemberHasPermission(permissionKey: string) {
  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("member_has_permission", {
    target_permission_key: permissionKey,
  });
  if (result.error) {
    return false;
  }
  return result.data === true;
}

export async function currentMemberHasScopedPermission(
  permissionKey: string,
  unitId?: string | null,
  membershipId?: string | null,
) {
  const supabase = await createServerSupabaseClient();
  const orgId = await supabase.rpc("current_organisation_id");
  if (orgId.error || !orgId.data) {
    return false;
  }

  const args: {
    target_organisation_id: string;
    target_permission_key: string;
    target_membership_id?: string;
    target_unit_id?: string;
  } = {
    target_organisation_id: orgId.data,
    target_permission_key: permissionKey,
  };

  if (membershipId) {
    args.target_membership_id = membershipId;
  }

  if (unitId) {
    args.target_unit_id = unitId;
  }

  const result = await supabase.rpc("has_scoped_permission", args);

  return result.data === true;
}

export async function currentMemberHasOrganisationScopedPermission(
  permissionKey: string,
) {
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

export async function currentMemberHasDelegatableAccess() {
  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("get_delegatable_access_offers");
  if (result.error || !result.data) {
    return false;
  }

  const offers = (result.data as { offers?: unknown[] } | null)?.offers ?? [];
  return offers.length > 0;
}
