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
