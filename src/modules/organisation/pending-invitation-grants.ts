export const PENDING_INVITATION_GRANT_BATCH_SIZE = 50;

export type PendingInvitationGrant = {
  invitation_id: string;
  scope_type: string;
  scope_unit_id: string | null;
  role_version_id: string;
};

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
