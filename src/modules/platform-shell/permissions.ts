import "server-only";

import { cache } from "react";
import { unstable_rethrow } from "next/navigation";

import { throwPlatformBoundaryError } from "@/platform/observability/platform-boundary";
import { readRequestPathname } from "@/platform/http/request-path";
import {
  classifyPermissionProbeResult,
  readSupabaseErrorFields,
} from "@/platform/supabase/error-classification";
import { createServerSupabaseClient } from "@/platform/supabase/server";

async function throwPermissionProbeFailure(
  operation: string,
  permissionKey: string,
  error: unknown,
): Promise<never> {
  const { code, message } = readSupabaseErrorFields(error);
  throwPlatformBoundaryError({
    category: "organisation_access",
    operation,
    route: await readRequestPathname(),
    supabaseError: { code, message },
    cause: error,
  });
}

export const currentMemberHasPermission = cache(
  async (permissionKey: string) => {
    try {
      const supabase = await createServerSupabaseClient();
      const result = await supabase.rpc("member_has_permission", {
        target_permission_key: permissionKey,
      });
      const classified = classifyPermissionProbeResult(result);
      if (!classified.ok) {
        if (classified.denied) {
          return false;
        }

        return throwPermissionProbeFailure(
          "member_has_permission",
          permissionKey,
          classified.error,
        );
      }

      return classified.data === true;
    } catch (error) {
      unstable_rethrow(error);
      return throwPermissionProbeFailure(
        "member_has_permission",
        permissionKey,
        error,
      );
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
      const orgClassified = classifyPermissionProbeResult(orgId);
      if (!orgClassified.ok) {
        if (orgClassified.denied) {
          return false;
        }

        return throwPermissionProbeFailure(
          "current_organisation_id",
          permissionKey,
          orgClassified.error,
        );
      }

      if (!orgClassified.data) {
        return false;
      }

      const args: {
        target_organisation_id: string;
        target_permission_key: string;
        target_membership_id?: string;
        target_unit_id?: string;
      } = {
        target_organisation_id: orgClassified.data,
        target_permission_key: permissionKey,
      };

      if (membershipId) {
        args.target_membership_id = membershipId;
      }

      if (unitId) {
        args.target_unit_id = unitId;
      }

      const result = await supabase.rpc("has_scoped_permission", args);
      const classified = classifyPermissionProbeResult(result);
      if (!classified.ok) {
        if (classified.denied) {
          return false;
        }

        return throwPermissionProbeFailure(
          "has_scoped_permission",
          permissionKey,
          classified.error,
        );
      }

      return classified.data === true;
    } catch (error) {
      unstable_rethrow(error);
      return throwPermissionProbeFailure(
        "has_scoped_permission",
        permissionKey,
        error,
      );
    }
  },
);

export async function currentMemberHasOrganisationScopedPermission(
  permissionKey: string,
) {
  return currentMemberHasScopedPermission(permissionKey);
}

export const currentMemberCanDelegateRoles = cache(async () =>
  currentMemberHasPermission("roles.delegate"),
);

/** @deprecated Use currentMemberCanDelegateRoles for UI gates. */
export async function currentMemberHasDelegatableAccess() {
  return currentMemberCanDelegateRoles();
}

export type DelegatableAccessOffersPayload = {
  offers: unknown[];
};

export const loadDelegatableAccessOffers = cache(async () => {
  try {
    const supabase = await createServerSupabaseClient();
    const result = await supabase.rpc("get_delegatable_access_offers");
    const classified = classifyPermissionProbeResult(result);
    if (!classified.ok) {
      if (classified.denied) {
        return { offers: [] } satisfies DelegatableAccessOffersPayload;
      }

      return throwPermissionProbeFailure(
        "get_delegatable_access_offers",
        "delegatable_access",
        classified.error,
      );
    }

    const offers =
      (classified.data as DelegatableAccessOffersPayload | null)?.offers ?? [];
    return { offers } satisfies DelegatableAccessOffersPayload;
  } catch (error) {
    unstable_rethrow(error);
    return throwPermissionProbeFailure(
      "get_delegatable_access_offers",
      "delegatable_access",
      error,
    );
  }
});
