import { describe, expect, it } from "vitest";

import {
  UNAVAILABLE_MEMBER_LABEL,
  isUsableMembershipDisplayName,
  labelForMembershipId,
  membershipDisplayLabel,
  resolveMembershipNameById,
} from "@/lib/identity/membership-display-label";

describe("membership display labels", () => {
  it("prefers an authorised human-readable name", () => {
    expect(
      membershipDisplayLabel("05057700", "CookieWorks Admin", "Apex Manager"),
    ).toBe("CookieWorks Admin");
  });

  it("renders a facilitator name when present", () => {
    expect(membershipDisplayLabel(null, "Apex Manager")).toBe("Apex Manager");
  });

  it("uses a neutral label when the identity is missing or inaccessible", () => {
    expect(membershipDisplayLabel(null, undefined, "")).toBe(
      UNAVAILABLE_MEMBER_LABEL,
    );
    expect(
      labelForMembershipId({}, "33333333-3333-3333-3333-333333333333"),
    ).toBe(UNAVAILABLE_MEMBER_LABEL);
  });

  it("never treats a UUID or UUID prefix as a display name", () => {
    expect(membershipDisplayLabel("33333333-3333-3333-3333-333333333333")).toBe(
      UNAVAILABLE_MEMBER_LABEL,
    );
    expect(membershipDisplayLabel("05057700")).toBe(UNAVAILABLE_MEMBER_LABEL);
    expect(
      isUsableMembershipDisplayName("05057700-aaaa-4bbb-8ccc-ddddeeeeffff"),
    ).toBe(false);
  });

  it("never treats email or synthetic Auth identifiers as display names", () => {
    expect(membershipDisplayLabel("admin@cookie.works")).toBe(
      UNAVAILABLE_MEMBER_LABEL,
    );
    expect(
      membershipDisplayLabel("05057700@workforce.invalid", "Jane Operator"),
    ).toBe("Jane Operator");
  });

  it("maps authorised labels and fills unavailable for remaining ids", () => {
    const ownerId = "33333333-3333-3333-3333-333333333333";
    const facilitatorId = "44444444-4444-4444-4444-444444444444";
    const missingId = "55555555-5555-5555-5555-555555555555";

    expect(
      resolveMembershipNameById({
        membershipIds: [ownerId, facilitatorId, missingId, ownerId, null],
        authorisedLabels: {
          [ownerId]: "CookieWorks Admin",
          [facilitatorId]: "05057700",
        },
      }),
    ).toEqual({
      [ownerId]: "CookieWorks Admin",
      [facilitatorId]: UNAVAILABLE_MEMBER_LABEL,
      [missingId]: UNAVAILABLE_MEMBER_LABEL,
    });
  });
});
