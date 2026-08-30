import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ProfileAccessGrants,
  resolveProfileAccessGrantsView,
  type ProfileAccessGrant,
} from "@/components/profile/profile-access-grants";

const teamMemberGrant: ProfileAccessGrant = {
  role_display_name: "Team Member",
  scope_type: "unit_subtree",
  scope_unit_name: "Production",
};

const financeGrant: ProfileAccessGrant = {
  role_display_name: "Finance Validator",
  scope_type: "organisation",
};

describe("resolveProfileAccessGrantsView", () => {
  it("returns none when there are zero active grants", () => {
    expect(resolveProfileAccessGrantsView([])).toEqual({ mode: "none" });
  });

  it("returns single when there is one active grant", () => {
    expect(resolveProfileAccessGrantsView([teamMemberGrant])).toEqual({
      mode: "single",
      grant: teamMemberGrant,
    });
  });

  it("returns multiple with all grants when more than one is active", () => {
    expect(
      resolveProfileAccessGrantsView([teamMemberGrant, financeGrant]),
    ).toEqual({
      mode: "multiple",
      grants: [teamMemberGrant, financeGrant],
    });
  });
});

describe("ProfileAccessGrants", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a single grant with role and scope fields", () => {
    render(
      <dl>
        <ProfileAccessGrants grants={[teamMemberGrant]} />
      </dl>,
    );

    expect(screen.getByTestId("profile-application-role")).toHaveTextContent(
      "Team Member",
    );
    expect(screen.getByTestId("profile-access-scope")).toHaveTextContent(
      "Production and its sub-areas",
    );
    expect(
      screen.queryByTestId("profile-application-access-list"),
    ).not.toBeInTheDocument();
  });

  it("renders every active grant in the multiple-grant list", () => {
    render(
      <dl>
        <ProfileAccessGrants grants={[teamMemberGrant, financeGrant]} />
      </dl>,
    );

    const items = screen.getAllByTestId("profile-application-access-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Team Member");
    expect(items[0]).toHaveTextContent("Production and its sub-areas");
    expect(items[1]).toHaveTextContent("Finance Validator");
    expect(items[1]).toHaveTextContent("Entire organisation");
  });

  it("renders the zero-grant empty state", () => {
    render(
      <dl>
        <ProfileAccessGrants grants={[]} />
      </dl>,
    );

    expect(
      screen.getByTestId("profile-application-access-empty"),
    ).toHaveTextContent("No active access grants");
    expect(
      screen.queryByTestId("profile-application-role"),
    ).not.toBeInTheDocument();
  });
});
