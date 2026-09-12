import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExecutionUnitStartForm } from "@/components/organisation/execution-unit-start-form";

afterEach(() => {
  cleanup();
});

describe("ExecutionUnitStartForm", () => {
  it("renders a required site-local selector without duplicate labels", () => {
    render(
      <ExecutionUnitStartForm
        action={() => undefined}
        hiddenFields={<input type="hidden" name="standardId" value="std" />}
        units={[
          { id: "exeter-packing", name: "Packing" },
          { id: "exeter-baking", name: "Baking" },
        ]}
        requiresSiteSelection={false}
        unitFieldId="five-s-unit-id"
        label="Start audit for unit"
        submitLabel="Start audit"
        emptyMessage="Select an active site in the sidebar before starting an audit."
        formTestId="five-s-start-audit-form"
        unitSelectTestId="five-s-unit-select"
        submitTestId="five-s-start-audit"
      />,
    );

    const select = screen.getByTestId("five-s-unit-select");
    expect(screen.getByText("Start audit for unit")).toBeVisible();
    expect(select).toBeRequired();
    expect(screen.getByRole("option", { name: "Packing" })).toHaveValue(
      "exeter-packing",
    );
    expect(screen.getAllByRole("option", { name: "Packing" })).toHaveLength(1);
    expect(
      screen.queryByRole("option", { name: "Bodmin Cookie Factory" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("five-s-start-audit")).toBeEnabled();
  });

  it("asks for an active site instead of exposing a mixed-site list", () => {
    render(
      <ExecutionUnitStartForm
        action={() => undefined}
        hiddenFields={<input type="hidden" name="definitionId" value="def" />}
        units={[]}
        requiresSiteSelection
        unitFieldId="gemba-unit-id"
        label="Start walk for unit"
        submitLabel="Start walk"
        emptyMessage="Select an active site in the sidebar before starting a walk."
        formTestId="gemba-start-walk-form"
        unitSelectTestId="gemba-unit-select"
        submitTestId="gemba-start-walk"
      />,
    );

    expect(screen.getByTestId("site-context-required")).toHaveTextContent(
      "Select an active site in the sidebar before starting a walk.",
    );
    expect(screen.queryByTestId("gemba-unit-select")).not.toBeInTheDocument();
    expect(screen.getByTestId("gemba-start-walk")).toBeDisabled();
  });
});
