import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import { ExecutionUnitStartForm } from "@/components/organisation/execution-unit-start-form";

afterEach(() => {
  cleanup();
});

describe("ApplicableUnitsField", () => {
  it("uses a distinct empty-state test id from start-audit site context", () => {
    render(
      <>
        <ExecutionUnitStartForm
          action={() => undefined}
          hiddenFields={<input type="hidden" name="standardId" value="std" />}
          units={[]}
          requiresSiteSelection
          unitFieldId="five-s-unit-id"
          label="Start audit for unit"
          submitLabel="Start audit"
          emptyMessage="Select an active site in the sidebar before starting an audit."
          formTestId="five-s-start-audit-form"
          unitSelectTestId="five-s-unit-select"
          submitTestId="five-s-start-audit"
        />
        <ApplicableUnitsField options={[]} requiresSiteSelection />
      </>,
    );

    expect(
      within(screen.getByTestId("five-s-start-audit-form")).getByTestId(
        "site-context-required",
      ),
    ).toHaveTextContent(
      "Select an active site in the sidebar before starting an audit.",
    );
    expect(screen.getByTestId("applicable-units-empty")).toHaveTextContent(
      "Select an active site in the sidebar before choosing applicable areas.",
    );
    expect(screen.getAllByTestId("site-context-required")).toHaveLength(1);
  });

  it("keeps off-site preserved mappings when the active site has no units", () => {
    render(
      <ApplicableUnitsField
        options={[]}
        preservedIds={["off-site-packing"]}
        requiresSiteSelection
      />,
    );

    expect(screen.getByDisplayValue("off-site-packing")).toHaveAttribute(
      "name",
      "applicableUnitIds",
    );
    expect(screen.getByTestId("applicable-units-empty")).toBeVisible();
  });
});
