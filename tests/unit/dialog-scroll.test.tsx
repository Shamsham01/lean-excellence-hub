import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

afterEach(() => {
  cleanup();
});

const options = [
  { id: "unit-a", name: "Packing" },
  { id: "unit-b", name: "Dispatch" },
];

function LocationDialog({ error }: { error?: string }) {
  return (
    <Dialog open>
      <DialogContent data-testid="location-dialog">
        <DialogHeader>
          <DialogTitle>Create draft</DialogTitle>
          <DialogDescription>
            This creates an editable draft. Nothing is published until you
            publish it.
          </DialogDescription>
        </DialogHeader>
        <ApplicableUnitsField
          options={options}
          description="You choose where this draft applies."
        />
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit">Create draft</button>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog location selection", () => {
  it("exposes a scroll region and keeps the title and close control named", () => {
    render(<LocationDialog />);

    const dialog = screen.getByRole("dialog", { name: "Create draft" });
    expect(dialog.querySelector("[data-dialog-scroll]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
    expect(screen.getAllByTestId("applicable-unit-checkbox")).toHaveLength(2);
  });

  it("keeps checkbox selection when a validation error is shown", () => {
    const view = render(<LocationDialog />);
    const packing = screen.getByRole("checkbox", { name: "Packing" });
    fireEvent.click(packing);
    expect(packing).toBeChecked();

    view.rerender(
      <LocationDialog error="Select at least one applicable area. LeanAI does not choose applicability." />,
    );

    expect(screen.getByRole("checkbox", { name: "Packing" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Dispatch" }),
    ).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Select at least one applicable area.",
    );
  });
});
