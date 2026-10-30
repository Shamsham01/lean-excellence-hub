import {
  formatUnitPath,
  type FlatOrganisationUnit,
} from "@/modules/organisation/unit-hierarchy";

export const PENDING_INVITATION_GRANT_BATCH_SIZE = 50;

export type PendingInvitationGrant = {
  invitation_id: string;
  scope_type: string;
  scope_unit_id: string | null;
  role_version_id: string;
};

export type PendingInvitationAccessLabel = {
  roleName: string;
  scopeLabel: string;
};

export function labelPendingInvitationGrant(
  grant: PendingInvitationGrant,
  roleNameByVersionId: ReadonlyMap<string, string>,
  units: readonly FlatOrganisationUnit[],
): PendingInvitationAccessLabel {
  const scopeUnitId = grant.scope_unit_id ?? "";
  return {
    roleName:
      roleNameByVersionId.get(grant.role_version_id) ?? "Application access",
    scopeLabel:
      grant.scope_type === "organisation"
        ? "Entire organisation"
        : scopeUnitId
          ? `Specific site: ${formatUnitPath(scopeUnitId, [...units])}`
          : "Specific site",
  };
}

export function groupPendingInvitationAccess(
  grants: readonly PendingInvitationGrant[],
  roleNameByVersionId: ReadonlyMap<string, string>,
  units: readonly FlatOrganisationUnit[],
): Map<string, PendingInvitationAccessLabel[]> {
  const grouped = new Map<string, PendingInvitationAccessLabel[]>();
  for (const grant of grants) {
    const labels = grouped.get(grant.invitation_id) ?? [];
    labels.push(labelPendingInvitationGrant(grant, roleNameByVersionId, units));
    grouped.set(grant.invitation_id, labels);
  }
  return grouped;
}

export type PendingInvitationGrantQueryResult = {
  data: PendingInvitationGrant[] | null;
  error: { message?: string } | null;
};

export type PendingInvitationGrantQuery = (
  invitationIds: readonly string[],
) => Promise<PendingInvitationGrantQueryResult>;

export function chunkInvitationIds<T>(
  items: readonly T[],
  batchSize: number,
): T[][] {
  if (batchSize < 1) {
    throw new Error("Invitation grant batch size must be at least 1.");
  }

  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

export async function loadPendingInvitationGrants(
  queryGrants: PendingInvitationGrantQuery,
  invitationIds: readonly string[],
  options?: { batchSize?: number },
): Promise<PendingInvitationGrantQueryResult> {
  if (invitationIds.length === 0) {
    return { data: [], error: null };
  }

  const batchSize = options?.batchSize ?? PENDING_INVITATION_GRANT_BATCH_SIZE;
  const grants: PendingInvitationGrant[] = [];

  for (const batch of chunkInvitationIds(invitationIds, batchSize)) {
    const result = await queryGrants(batch);
    if (result.error) {
      return { data: null, error: result.error };
    }

    grants.push(...(result.data ?? []));
  }

  return { data: grants, error: null };
}
