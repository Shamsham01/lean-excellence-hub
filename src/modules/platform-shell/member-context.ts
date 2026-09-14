import "server-only";

import {
  createPlatformBoundaryReference,
  logPlatformBoundaryError,
} from "@/platform/observability/platform-boundary";
import { readRequestPathname } from "@/platform/http/request-path";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type PlatformShellMember = {
  displayName: string;
  roleLabel: string | null;
};

type MembershipProfile = {
  access_grants?: Array<{ role_display_name: string }>;
};

const FALLBACK_MEMBER: PlatformShellMember = {
  displayName: "Member",
  roleLabel: null,
};

export async function loadPlatformShellMember(
  membershipId: string,
): Promise<PlatformShellMember> {
  try {
    const supabase = await createServerSupabaseClient();
    const claims = await supabase.auth.getClaims();
    const userId = claims.data?.claims?.sub;

    const [profileResult, adminResult] = await Promise.all([
      userId
        ? supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null as { display_name?: string } | null }),
      supabase.rpc("get_membership_administration_profile", {
        target_membership_id: membershipId,
      }),
    ]);

    const grants =
      (adminResult.data as MembershipProfile | null)?.access_grants ?? [];
    const roleLabel = resolveRoleLabel(grants);

    const displayName = profileResult.data?.display_name?.trim();
    return {
      displayName:
        displayName && displayName.length > 0 ? displayName : "Member",
      roleLabel,
    };
  } catch (error) {
    logPlatformBoundaryError({
      category: "identity",
      operation: "loadPlatformShellMember",
      reference: createPlatformBoundaryReference(),
      route: await readRequestPathname(),
      supabaseMessage: error instanceof Error ? error.message : null,
    });
    return FALLBACK_MEMBER;
  }
}

function resolveRoleLabel(
  grants: Array<{ role_display_name: string }>,
): string | null {
  if (grants.length === 0) {
    return null;
  }

  if (grants.length === 1) {
    return grants[0]!.role_display_name;
  }

  return "Multiple roles";
}
