import { describe, expect, it } from "vitest";

import { describeInvitationAccess } from "@/modules/people/invitation-access-preview";

describe("describeInvitationAccess", () => {
  it("describes a suggestions contributor without review or management", () => {
    expect(
      describeInvitationAccess({
        role_canonical_name: "suggestions-contributor",
        role_display_name: "Suggestions Contributor",
      }),
    ).toEqual({
      viewing: "Their own suggestions",
      contribution: "Submit suggestions",
      management: "No review or programme administration",
    });
  });

  it("keeps the suggestions responsibility role distinct from submission", () => {
    expect(
      describeInvitationAccess({
        role_canonical_name: "responsibility-suggestions",
        role_display_name: "Suggestions",
        responsibility_kind: "module",
      }).management,
    ).toBe("Manage suggestions and programmes");
  });

  it("does not describe Team Member as read-only", () => {
    expect(
      describeInvitationAccess({
        role_canonical_name: "team-member",
        role_display_name: "Team Member",
      }).contribution,
    ).toMatch(/creating and submitting/i);
  });

  it("describes organisation administration without treating it as the default operator role", () => {
    expect(
      describeInvitationAccess({
        role_canonical_name: "organisation-administrator",
        role_display_name: "Organisation Administrator",
        responsibility_kind: "admin",
      }).management,
    ).toBe("Organisation administration");
  });
});
