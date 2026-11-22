import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InvitationAcceptanceCard } from "@/components/invitations/invitation-acceptance-card";

const lifecycle = {
  state: "valid" as const,
  sessionState: "ready_to_accept" as const,
  organisationName: "North Plant",
  intendedDisplayName: "Very Long Invitation Name For The Frontline Operator",
  roleDisplayName: "Suggestions",
  scopeLabel: "North Site and its sub-areas",
};

describe("InvitationAcceptanceCard invited name", () => {
  afterEach(() => {
    cleanup();
  });

  it("prefills the organisation name so the invitee can confirm it", () => {
    render(
      <InvitationAcceptanceCard
        token="lFrDc8I1cPo76h25La6wblFaqDj2KhMF4dBXxhQAlpo"
        lifecycle={lifecycle}
        loginPath="/login"
        activatePath="/invitations/token/activate"
        acceptEndpoint="/api/auth/invitations/accept"
      />,
    );

    expect(screen.getByTestId("invitation-display-name")).toHaveValue(
      "Very Long Invitation Name For The Frontline Operator",
    );
    expect(
      screen.getByText(/personal profile name you have already saved/i),
    ).toBeInTheDocument();
  });

  it("shows the invited name before the person is ready to accept", () => {
    render(
      <InvitationAcceptanceCard
        token="lFrDc8I1cPo76h25La6wblFaqDj2KhMF4dBXxhQAlpo"
        lifecycle={{
          ...lifecycle,
          sessionState: "unauthenticated",
        }}
        loginPath="/login"
        activatePath="/invitations/token/activate"
        acceptEndpoint="/api/auth/invitations/accept"
      />,
    );

    expect(screen.getByText("Invited name")).toBeInTheDocument();
    expect(
      screen.getByText("Very Long Invitation Name For The Frontline Operator"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("invitation-display-name"),
    ).not.toBeInTheDocument();
  });
});
