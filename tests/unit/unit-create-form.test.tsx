import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnitCreateForm } from "@/components/organisation/unit-create-form";

afterEach(() => {
  cleanup();
});

const units = [
  {
    id: "club",
    name: "The Club",
    code: "the-club",
    parent_unit_id: null,
  },
];

describe("UnitCreateForm", () => {
  it("auto-generates a valid code and stops after a manual edit", () => {
    render(
      <UnitCreateForm
        units={units}
        canCreateRoot
        existingCodes={["community"]}
        onCreate={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Community"), {
      target: { value: "Community" },
    });
    expect(screen.getByTestId("unit-code-preview")).toHaveTextContent(
      "community-2",
    );

    fireEvent.click(screen.getByTestId("unit-code-edit"));
    fireEvent.change(screen.getByTestId("unit-code"), {
      target: { value: "my-code" },
    });
    fireEvent.change(screen.getByPlaceholderText("Community"), {
      target: { value: "Community Ops" },
    });
    expect(screen.getByTestId("unit-code")).toHaveValue("my-code");
  });

  it("supports a custom unit type", () => {
    render(<UnitCreateForm units={units} canCreateRoot onCreate={vi.fn()} />);

    fireEvent.change(screen.getByTestId("unit-type-choice"), {
      target: { value: "custom" },
    });
    expect(screen.getByTestId("unit-type-choice")).toHaveValue("custom");
    const customType = screen.getByPlaceholderText("For example, ward or cell");
    expect(customType).toBeVisible();
    fireEvent.change(customType, {
      target: { value: "ward" },
    });
    expect(screen.getByTestId("unit-type")).toHaveValue("ward");
    expect(
      screen.queryByRole("option", { name: "Site" }),
    ).not.toBeInTheDocument();
  });

  it("explains exhausted site capacity and links billing administrators to Billing", async () => {
    const onCreate = vi.fn().mockResolvedValue({
      error:
        "This organisation has used all subscribed site capacity. Add site capacity before creating another site.",
      errorCode: "SITE_CAPACITY_EXHAUSTED",
      canManageBilling: true,
    });

    render(
      <UnitCreateForm
        units={units}
        canCreateRoot
        onCreate={onCreate}
        siteCapacity={{
          activeSiteCount: 1,
          subscribedLimit: 1,
          remainingSlots: 0,
          enforced: true,
          canManageBilling: true,
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Community"), {
      target: { value: "Second Site" },
    });
    fireEvent.change(screen.getByTestId("unit-type-choice"), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByPlaceholderText("For example, ward or cell"), {
      target: { value: "site" },
    });
    expect(screen.getByTestId("site-type-capacity-hint").textContent).toContain(
      "teams. This organisation has used all subscribed site capacity.",
    );
    fireEvent.click(screen.getByTestId("unit-create-submit"));

    expect(await screen.findByTestId("site-capacity-error")).toHaveTextContent(
      "used all subscribed site capacity",
    );
    expect(screen.getByTestId("site-capacity-open-billing")).toHaveAttribute(
      "href",
      "/platform/settings/billing?addCapacity=1",
    );
    expect(screen.queryByText(/postgres|23514|P0001/i)).not.toBeInTheDocument();
  });

  it("preselects a parent when provided", () => {
    render(
      <UnitCreateForm
        units={units}
        canCreateRoot
        initialParentUnitId="club"
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByTestId("unit-parent-select")).toHaveValue("club");
  });
});
