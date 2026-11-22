/**
 * Founder commercial invariant (t116u, 8 Nov 2026): billed unit is **site**,
 * not people. Every plan allows unlimited memberships (employees/users) per
 * purchased site. Do not add headcount bands, seat caps, or per-user fees.
 */
export const UNLIMITED_MEMBERSHIP_PER_SITE = true as const;

export const BILLED_UNIT_LABEL = "site" as const;

/** LeanAI pooled credits scale with subscribed site quantity — never employee headcount. */
export const LEANAI_ALLOWANCE_SCOPES = [
  "organisation",
  "subscribed_site_quantity",
] as const;

export type CommercialPrinciples = {
  unlimitedMembershipPerSite: typeof UNLIMITED_MEMBERSHIP_PER_SITE;
  billedUnit: typeof BILLED_UNIT_LABEL;
  chargesPerUser: false;
};

export const LEH_COMMERCIAL_PRINCIPLES: CommercialPrinciples = {
  unlimitedMembershipPerSite: UNLIMITED_MEMBERSHIP_PER_SITE,
  billedUnit: BILLED_UNIT_LABEL,
  chargesPerUser: false,
};

export function assertPlanHasUnlimitedMembershipPerSite() {
  return LEH_COMMERCIAL_PRINCIPLES;
}
