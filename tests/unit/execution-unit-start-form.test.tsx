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

  it("locks a single applicable unit instead of rendering a dropdown", () => {
    render(
      <ExecutionUnitStartForm
        action={() => undefined}
        hiddenFields={<input type="hidden" name="standardId" value="std" />}
        units={[{ id: "exeter-packing", name: "Packing" }]}
        requiresSiteSelection={false}
        unitFieldId="five-s-unit-id"
        label="Start audit for unit"
        lockedLabel="Audit area"
        submitLabel="Start audit"
        emptyMessage="Select an active site in the sidebar before starting an audit."
        formTestId="five-s-start-audit-form"
        unitSelectTestId="five-s-unit-select"
        submitTestId="five-s-start-audit"
      />,
    );

    expect(screen.getByTestId("five-s-unit-select-locked")).toHaveTextContent(
      "Audit area",
    );
    expect(screen.getByTestId("five-s-unit-select-locked")).toHaveTextContent(
      "Packing",
    );
    expect(screen.queryByTestId("five-s-unit-select")).not.toBeInTheDocument();
    expect(screen.getByTestId("five-s-start-audit")).toBeEnabled();
  });

  it("does not fall back to unrelated units when none are applicable", () => {
    render(
      <ExecutionUnitStartForm
        action={() => undefined}
        hiddenFields={<input type="hidden" name="standardId" value="std" />}
        units={[]}
        requiresSiteSelection={false}
        unitFieldId="five-s-unit-id"
        label="Start audit for unit"
        submitLabel="Start audit"
        emptyMessage="Select an active site in the sidebar before starting an audit."
        notApplicableMessage="This standard is not applicable to the active site."
        formTestId="five-s-start-audit-form"
        unitSelectTestId="five-s-unit-select"
        submitTestId="five-s-start-audit"
      />,
    );

    expect(screen.getByTestId("site-context-required")).toHaveTextContent(
      "This standard is not applicable to the active site.",
    );
    expect(
      screen.queryByRole("option", { name: "Baking" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("five-s-start-audit")).toBeDisabled();
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
