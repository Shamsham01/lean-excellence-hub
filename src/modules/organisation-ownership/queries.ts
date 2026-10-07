import "server-only";

import { classifyPermissionProbeResult } from "@/platform/supabase/error-classification";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import type {
  OrganisationOwnershipSnapshot,
  OwnershipTransferTarget,
} from "./types";

type OwnershipRpc = {
  organisation_id?: string;
  organisation_name?: string;
  can_transfer?: boolean;
  can_view_owners?: boolean;
  owners?: Array<{
    membership_id?: string;
    display_name?: string;
    email?: string | null;
  }>;
};

type TargetsRpc = {
  targets?: Array<{
    membership_id?: string;
    display_name?: string;
    email?: string | null;
    is_already_owner?: boolean;
    grants?: Array<{
      role_display_name?: string;
      role_canonical_name?: string;
      scope_type?: string;
      scope_label?: string;
    }>;
  }>;
};

function parseOwnershipSnapshot(
  payload: OwnershipRpc | null,
): OrganisationOwnershipSnapshot | null {
  if (!payload?.organisation_id || !payload.organisation_name) {
    return null;
  }

  const canViewOwners = payload.can_view_owners === true;
  return {
    organisationId: payload.organisation_id,
    organisationName: payload.organisation_name,
    canTransfer: payload.can_transfer === true,
    canViewOwners,
    owners: canViewOwners
      ? (payload.owners ?? []).flatMap((owner) =>
          owner.membership_id
            ? [
                {
                  membershipId: owner.membership_id,
                  displayName:
                    owner.display_name?.trim() || "Organisation owner",
                  email: owner.email ?? null,
                },
              ]
            : [],
        )
      : [],
  };
}

export async function loadOrganisationOwnership(): Promise<OrganisationOwnershipSnapshot | null> {
  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("get_organisation_ownership");
  const classified = classifyPermissionProbeResult(result);
  if (!classified.ok) {
    return null;
  }

  return parseOwnershipSnapshot(classified.data as OwnershipRpc | null);
}

export async function loadOwnershipTransferTargets(): Promise<
  OwnershipTransferTarget[]
> {
  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc(
    "list_organisation_ownership_transfer_targets",
  );
  const classified = classifyPermissionProbeResult(result);
  if (!classified.ok) {
    return [];
  }

  const payload = classified.data as TargetsRpc | null;
  return (payload?.targets ?? []).flatMap((target) =>
    target.membership_id
      ? [
          {
            membershipId: target.membership_id,
            displayName: target.display_name?.trim() || "Organisation member",
            email: target.email ?? null,
            isAlreadyOwner: target.is_already_owner === true,
            grants: (target.grants ?? []).map((grant) => ({
              roleDisplayName: grant.role_display_name?.trim() || "Access",
              roleCanonicalName: grant.role_canonical_name ?? "",
              scopeType: grant.scope_type ?? "",
              scopeLabel: grant.scope_label?.trim() || "Granted access",
            })),
          },
        ]
      : [],
  );
}
