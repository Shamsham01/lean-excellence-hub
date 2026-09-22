import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CreateBenefitWizard } from "@/components/benefits/create-benefit-wizard";

const baseProps = {
  units: [{ id: "exeter-packing", name: "Packing" }],
  members: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "CookieWorks Admin",
      label: "CookieWorks Admin (Organisation Owner)",
      placementUnitId: null,
    },
  ],
  categories: [] as Array<{ id: string; label: string }>,
  projects: [],
};

describe("CreateBenefitWizard category empty state", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows manage categories guidance when the member can configure categories", () => {
    render(<CreateBenefitWizard {...baseProps} canManageCategories={true} />);

    expect(
      screen.getByTestId("benefit-category-empty-state"),
    ).toHaveTextContent("No benefit categories configured.");
    expect(
      screen.getByTestId("benefit-manage-categories-link"),
    ).toHaveAttribute("href", "/platform/benefits/categories");
    expect(
      screen.queryByTestId("benefit-category-select"),
    ).not.toBeInTheDocument();
  });

  it("shows administrator guidance without a manage link when permission is missing", () => {
    render(<CreateBenefitWizard {...baseProps} canManageCategories={false} />);

    expect(
      screen.getByTestId("benefit-category-empty-state"),
    ).toHaveTextContent(
      "Ask an administrator with category management permission to configure categories.",
    );
    expect(
      screen.queryByTestId("benefit-manage-categories-link"),
    ).not.toBeInTheDocument();
  });

  it("renders the category selector when categories exist", () => {
    render(
      <CreateBenefitWizard
        {...baseProps}
        categories={[{ id: "cat-1", label: "Cost reduction (cost-reduction)" }]}
      />,
    );

    expect(screen.getByTestId("benefit-category-select")).toBeInTheDocument();
    expect(
      screen.queryByTestId("benefit-category-empty-state"),
    ).not.toBeInTheDocument();
  });
});
