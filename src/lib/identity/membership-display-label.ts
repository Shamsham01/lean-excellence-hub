import { isLikelyOpaqueId } from "@/modules/organisation/site-context";

export const UNAVAILABLE_MEMBER_LABEL = "Unavailable member";

function looksLikeEmail(value: string): boolean {
  return value.includes("@") && !value.includes(" ");
}

export function isUsableMembershipDisplayName(
  value: string | null | undefined,
): value is string {
  const trimmed = value?.trim();
  return Boolean(
    trimmed && !isLikelyOpaqueId(trimmed) && !looksLikeEmail(trimmed),
  );
}

export function membershipDisplayLabel(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isUsableMembershipDisplayName(trimmed)) {
      return trimmed;
    }
  }

  return UNAVAILABLE_MEMBER_LABEL;
}

export function labelForMembershipId(
  membershipNameById: Record<string, string>,
  membershipId: string | null | undefined,
): string {
  if (!membershipId) {
    return UNAVAILABLE_MEMBER_LABEL;
  }

  return membershipDisplayLabel(membershipNameById[membershipId]);
}

export function resolveMembershipNameById(input: {
  membershipIds: Array<string | null | undefined>;
  authorisedLabels?: Record<string, string | null | undefined> | null;
}): Record<string, string> {
  const membershipNameById: Record<string, string> = {};

  for (const membershipId of input.membershipIds) {
    if (!membershipId || membershipNameById[membershipId]) {
      continue;
    }

    membershipNameById[membershipId] = membershipDisplayLabel(
      input.authorisedLabels?.[membershipId],
    );
  }

  return membershipNameById;
}
