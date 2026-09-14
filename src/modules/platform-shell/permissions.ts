import "server-only";

import { cache } from "react";
import { unstable_rethrow } from "next/navigation";

import {
  createPlatformBoundaryReference,
  logPlatformBoundaryError,
} from "@/platform/observability/platform-boundary";
import { readRequestPathname } from "@/platform/http/request-path";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function supabaseErrorFields(error: unknown): {
  code: string | null;
  message: string | null;
} {
  if (!error || typeof error !== "object") {
    return {
      code: null,
      message: error instanceof Error ? error.message : null,
    };
  }

  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === "string" ? record.code : null,
    message: typeof record.message === "string" ? record.message : null,
  };
}

async function logPermissionFailure(
  operation: string,
  permissionKey: string,
  error: unknown,
) {
  const { code, message } = supabaseErrorFields(error);
  logPlatformBoundaryError({
    category: "permission",
    operation,
    reference: createPlatformBoundaryReference(),
    route: await readRequestPathname(),
    permissionKey,
    supabaseCode: code,
    supabaseMessage: message,
  });
}

export const currentMemberHasPermission = cache(
  async (permissionKey: string) => {
    try {
      const supabase = await createServerSupabaseClient();
      const result = await supabase.rpc("member_has_permission", {
        target_permission_key: permissionKey,
      });
      if (result.error) {
        await logPermissionFailure(
          "member_has_permission",
          permissionKey,
          result.error,
        );
        return false;
      }
      return result.data === true;
    } catch (error) {
      unstable_rethrow(error);
      await logPermissionFailure("member_has_permission", permissionKey, error);
      return false;
    }
  },
);

export const currentMemberHasScopedPermission = cache(
  async (
    permissionKey: string,
    unitId?: string | null,
    membershipId?: string | null,
  ) => {
    try {
      const supabase = await createServerSupabaseClient();
      const orgId = await supabase.rpc("current_organisation_id");
      if (orgId.error || !orgId.data) {
        if (orgId.error) {
          await logPermissionFailure(
            "current_organisation_id",
            permissionKey,
            orgId.error,
          );
        }
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
      if (result.error) {
        await logPermissionFailure(
          "has_scoped_permission",
          permissionKey,
          result.error,
        );
        return false;
      }

      return result.data === true;
    } catch (error) {
      unstable_rethrow(error);
      await logPermissionFailure("has_scoped_permission", permissionKey, error);
      return false;
    }
  },
);

export async function currentMemberHasOrganisationScopedPermission(
  permissionKey: string,
) {
  return currentMemberHasScopedPermission(permissionKey);
}

export async function currentMemberHasDelegatableAccess() {
  try {
    const supabase = await createServerSupabaseClient();
    const result = await supabase.rpc("get_delegatable_access_offers");
    if (result.error || !result.data) {
      if (result.error) {
        await logPermissionFailure(
          "get_delegatable_access_offers",
          "delegatable_access",
          result.error,
        );
      }
      return false;
    }

    const offers = (result.data as { offers?: unknown[] } | null)?.offers ?? [];
    return offers.length > 0;
  } catch (error) {
    unstable_rethrow(error);
    await logPermissionFailure(
      "get_delegatable_access_offers",
      "delegatable_access",
      error,
    );
    return false;
  }
}
