import { describe, expect, it } from "vitest";

import {
  collectApplicableUnitIds,
  formatApplicableUnitLabels,
  readApplicableUnitIds,
  splitApplicabilitySelection,
} from "@/modules/operational/five-s-applicability";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

const units: FlatOrganisationUnit[] = [
  {
    id: "exeter",
    code: "exeter-cookie-factory",
    name: "Exeter Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
  {
    id: "exeter-packing",
    code: "exeter-packing",
    name: "Packing",
    unit_type: "area",
    parent_unit_id: "exeter",
  },
  {
    id: "bodmin-packing",
    code: "packing",
    name: "Packing",
    unit_type: "area",
    parent_unit_id: "bodmin",
  },
  {
    id: "bodmin",
    code: "bodmin-cookie-factory",
    name: "Bodmin Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
];

describe("5S applicability helpers", () => {
  it("collects exact unit ids without treating an empty mapping as all units", () => {
    expect(collectApplicableUnitIds([])).toEqual(new Set());
    expect(collectApplicableUnitIds(null)).toEqual(new Set());
    expect(collectApplicableUnitIds([{ unit_id: "exeter-packing" }])).toEqual(
      new Set(["exeter-packing"]),
    );
  });

  it("preserves out-of-site applicable ids when editing the active-site selection", () => {
    const split = splitApplicabilitySelection(
      new Set(["exeter-packing", "bodmin-packing"]),
      [{ id: "exeter-packing" }, { id: "exeter-baking" }],
    );

    expect([...split.selectedIds]).toEqual(["exeter-packing"]);
    expect(split.preservedIds).toEqual(["bodmin-packing"]);
  });

  it("disambiguates duplicate packing names across sites", () => {
    expect(
      formatApplicableUnitLabels(
        new Set(["exeter-packing", "bodmin-packing"]),
        units,
      ),
    ).toEqual([
      "Exeter Cookie Factory › Packing",
      "Bodmin Cookie Factory › Packing",
    ]);
  });

  it("reads checkbox values from the create/edit form", () => {
    const formData = new FormData();
    formData.append("applicableUnitIds", "exeter-packing");
    formData.append("applicableUnitIds", "exeter-packing");
    formData.append("applicableUnitIds", "bodmin-packing");
    expect(readApplicableUnitIds(formData)).toEqual([
      "exeter-packing",
      "bodmin-packing",
    ]);
  });
});
