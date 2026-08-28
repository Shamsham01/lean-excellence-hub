import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InviteColleagueForm } from "@/components/people/invite-colleague-form";

const invitationUrl =
  "https://lean-excellence-hub.netlify.app/invitations/test-token";

const offers = [
  {
    role_version_id: "role-version-1",
    role_display_name: "Manager",
    role_canonical_name: "manager",
    scope_options: [
      {
        scope_type: "organisation",
        scope_unit_id: null,
        label: "Entire organisation",
      },
    ],
  },
];

describe("InviteColleagueForm invitation link UX", () => {
  it("shows a copy button after successful invitation creation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const onInvite = vi.fn().mockResolvedValue({
      ok: true,
      invitationUrl,
    });

    render(
      <InviteColleagueForm
        offers={offers}
        units={[]}
        jobFunctions={[]}
        onInvite={onInvite}
      />,
    );

    fireEvent.change(screen.getByLabelText("Colleague email"), {
      target: { value: "colleague@example.test" },
    });
    fireEvent.change(
      document.getElementById("invite-scope") as HTMLSelectElement,
      {
        target: { value: "organisation::null" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("copy-invitation-link-button"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Invitation created. Share this secure link with your colleague.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Invitation link: ${invitationUrl}`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("copy-invitation-link-button"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(invitationUrl);
      expect(
        screen.getByRole("button", { name: "Copied" }),
      ).toBeInTheDocument();
    });
  });
});
