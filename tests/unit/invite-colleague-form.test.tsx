import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    cleanup();
  });

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
      document.getElementById("invite-role") as HTMLSelectElement,
      {
        target: { value: "role-version-1" },
      },
    );
    fireEvent.change(
      document.getElementById("invite-scope") as HTMLSelectElement,
      {
        target: { value: "organisation::null" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("copy-invitation-link-button"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Invitation created\. Copy the secure link below/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send invitation" }),
    ).not.toBeInTheDocument();
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

    expect(onInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "colleague@example.test",
        grants: [
          {
            roleVersionId: "role-version-1",
            scopeType: "organisation",
            scopeUnitId: null,
          },
        ],
      }),
    );
  });

  it("starts without a role selected and submits every grant row", async () => {
    const onInvite = vi.fn().mockResolvedValue({
      ok: true,
      invitationUrl,
    });
    const roleOffers = [
      {
        role_version_id: "admin-role",
        role_display_name: "Organisation Administrator",
        role_canonical_name: "organisation-administrator",
        responsibility_kind: "admin",
        scope_options: [
          {
            scope_type: "organisation",
            scope_unit_id: null,
            label: "Entire organisation",
          },
        ],
      },
      {
        role_version_id: "viewer-role",
        role_display_name: "Site Viewer",
        role_canonical_name: "site-viewer",
        scope_options: [
          {
            scope_type: "unit_subtree",
            scope_unit_id: "site-a",
            label: "Site A",
          },
          {
            scope_type: "unit_subtree",
            scope_unit_id: "site-b",
            label: "Site B",
          },
        ],
      },
    ];

    render(
      <InviteColleagueForm
        offers={roleOffers}
        units={[]}
        jobFunctions={[]}
        onInvite={onInvite}
      />,
    );

    expect(
      (document.getElementById("invite-role") as HTMLSelectElement).value,
    ).toBe("");
    expect(document.querySelector("#invite-role option")?.textContent).toBe(
      "Select a role",
    );
    expect(
      screen.getAllByText(/Job function does not grant permissions/i).length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Colleague email"), {
      target: { value: "operator@example.test" },
    });
    fireEvent.change(
      document.getElementById("invite-role") as HTMLSelectElement,
      {
        target: { value: "viewer-role" },
      },
    );
    fireEvent.change(
      document.getElementById("invite-scope") as HTMLSelectElement,
      {
        target: { value: "unit_subtree::site-a" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add another role" }));
    fireEvent.change(
      document.getElementById("invite-role-1") as HTMLSelectElement,
      {
        target: { value: "viewer-role" },
      },
    );
    fireEvent.change(
      document.getElementById("invite-scope-1") as HTMLSelectElement,
      {
        target: { value: "unit_subtree::site-b" },
      },
    );
    expect(
      screen.getAllByText("Viewing: The published permissions for this role"),
    ).toHaveLength(2);
    expect(screen.getAllByText(/Scope: Specific site: Site/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));

    await waitFor(() => {
      expect(onInvite).toHaveBeenCalledWith(
        expect.objectContaining({
          grants: [
            {
              roleVersionId: "viewer-role",
              scopeType: "unit_subtree",
              scopeUnitId: "site-a",
            },
            {
              roleVersionId: "viewer-role",
              scopeType: "unit_subtree",
              scopeUnitId: "site-b",
            },
          ],
        }),
      );
    });
  });
});
