import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompactApplicableUnitsField } from "@/components/organisation/compact-applicable-units-field";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

const hierarchyUnits: FlatOrganisationUnit[] = [
  { id: "site", code: "SITE", name: "Test site", unit_type: "site" },
  {
    id: "packing",
    code: "PACK",
    name: "Packing",
    parent_unit_id: "site",
  },
  {
    id: "production",
    code: "PROD",
    name: "Production",
    parent_unit_id: "site",
  },
  {
    id: "warehouse",
    code: "WH",
    name: "Warehouse",
    parent_unit_id: "site",
  },
];
const options = hierarchyUnits
  .filter((unit) => unit.id !== "site")
  .map(({ id, name }) => ({ id, name }));
const initialIds = new Set(options.map((option) => option.id));

function selectOnlyWarehouse() {
  fireEvent.click(screen.getByTestId("applicable-units-edit-locations"));
  const clearSite = screen.getByTestId(
    "applicable-units-select-all-site-site",
  );
  expect(clearSite).toHaveTextContent("Clear site");
  fireEvent.click(clearSite);
  fireEvent.click(screen.getByRole("checkbox", { name: "Warehouse" }));
  fireEvent.click(screen.getByTestId("applicable-units-picker-save"));
}

function expectSelection(expectedIds: string[], expectedSummary: string) {
  const summary = screen.getByTestId("applicable-units-compact-summary");
  expect(summary.textContent).toBe(`Applies to: ${expectedSummary}`);
  const form = summary.closest("form")!;
  const hiddenInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>(
      'input[type="hidden"][name="applicableUnitIds"]',
    ),
  );
  expect(hiddenInputs.map((input) => input.value)).toEqual(expectedIds);
  expect(new FormData(form).getAll("applicableUnitIds")).toEqual(expectedIds);
}

afterEach(cleanup);

describe("CompactApplicableUnitsField", () => {
  it.each(["selectedIds", "defaultSelectedIds"] as const)(
    "updates the summary and submitted ids when initialized with %s alone",
    (prop) => {
      render(
        <form>
          <CompactApplicableUnitsField
            hierarchyUnits={hierarchyUnits}
            options={options}
            {...{ [prop]: initialIds }}
          />
        </form>,
      );

      expectSelection([...initialIds], "Packing, Production +1 more");
      selectOnlyWarehouse();
      expectSelection(["warehouse"], "Warehouse");
    },
  );

  it("notifies the parent and respects the value in fully controlled mode", () => {
    const onSelectedIdsChange = vi.fn();
    const field = (ids: ReadonlySet<string>) => (
      <form>
        <CompactApplicableUnitsField
          hierarchyUnits={hierarchyUnits}
          options={options}
          selectedIds={ids}
          onSelectedIdsChange={onSelectedIdsChange}
        />
      </form>
    );
    const { rerender } = render(field(initialIds));

    selectOnlyWarehouse();

    expect(onSelectedIdsChange).toHaveBeenCalledTimes(1);
    expect(onSelectedIdsChange).toHaveBeenCalledWith(new Set(["warehouse"]));
    expectSelection([...initialIds], "Packing, Production +1 more");

    rerender(field(new Set(["warehouse"])));
    expectSelection(["warehouse"], "Warehouse");
  });
});
