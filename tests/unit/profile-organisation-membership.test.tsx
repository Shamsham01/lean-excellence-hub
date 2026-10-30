import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProfileOrganisationMembership } from "@/components/profile/profile-organisation-membership";

describe("ProfileOrganisationMembership", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an explicit load failure instead of missing assignments", () => {
    render(<ProfileOrganisationMembership view={{ status: "error" }} />);

    expect(
      screen.getByTestId("profile-membership-load-error"),
    ).toHaveTextContent("could not be loaded");
    expect(
      screen.queryByTestId("profile-job-function"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Not assigned")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No active access grants"),
    ).not.toBeInTheDocument();
  });

  it("shows real assignments and each grant scope when the profile loads", () => {
    render(
      <ProfileOrganisationMembership
        view={{
          status: "ready",
          organisationDisplayName: "Production Operator",
          jobFunctionName: "Production Operator",
          primaryWorkAreaName: "Line 3",
          grants: [
            {
              role_display_name: "Suggestions",
              scope_type: "unit_subtree",
              scope_unit_name: "North Site",
            },
          ],
          canManageOwnAssignment: false,
          administrationHref: null,
        }}
      />,
    );

    expect(
      screen.getByTestId("profile-organisation-display-name"),
    ).toHaveTextContent("Production Operator");
    expect(screen.getByTestId("profile-job-function")).toHaveTextContent(
      "Production Operator",
    );
    expect(screen.getByTestId("profile-primary-work-area")).toHaveTextContent(
      "Line 3",
    );
    expect(screen.getByTestId("profile-application-role")).toHaveTextContent(
      "Suggestions",
    );
    expect(screen.getByTestId("profile-access-scope")).toHaveTextContent(
      "North Site and its sub-areas",
    );
  });

  it("uses Not assigned only after a successful load with no assignment", () => {
    render(
      <ProfileOrganisationMembership
        view={{
          status: "ready",
          organisationDisplayName: null,
          jobFunctionName: null,
          primaryWorkAreaName: null,
          grants: [],
          canManageOwnAssignment: false,
          administrationHref: null,
        }}
      />,
    );

    expect(screen.getAllByText("Not assigned")).toHaveLength(2);
    expect(
      screen.getByTestId("profile-organisation-display-name"),
    ).toHaveTextContent("No organisation name is recorded yet.");
    expect(
      screen.getByTestId("profile-application-access-empty"),
    ).toHaveTextContent("No active access grants");
  });
});
