import { describe, expect, it } from "vitest";

import {
  collectApplicableUnitIds,
  formatApplicableUnitLabels,
  formatStaleApplicabilityWarning,
  interpretFiveSStandardLookup,
  readApplicableUnitIds,
  requireApplicableUnitIds,
  requireQuerySuccess,
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
      new Map([
        ["exeter-packing", "active"],
        ["bodmin-packing", "active"],
      ]),
    );

    expect([...split.selectedIds]).toEqual(["exeter-packing"]);
    expect(split.preservedIds).toEqual(["bodmin-packing"]);
    expect(split.staleInactiveIds).toEqual([]);
    expect([...split.confirmedActiveIds].sort()).toEqual([
      "bodmin-packing",
      "exeter-packing",
    ]);
  });

  it("does not preserve retired mapped units as hidden applicability values", () => {
    const split = splitApplicabilitySelection(
      new Set(["exeter-packing", "bodmin-packing"]),
      [{ id: "exeter-baking" }, { id: "exeter-quality" }],
      new Map([
        ["exeter-packing", "retired"],
        ["bodmin-packing", "active"],
      ]),
    );

    expect([...split.selectedIds]).toEqual([]);
    expect(split.preservedIds).toEqual(["bodmin-packing"]);
    expect(split.staleInactiveIds).toEqual(["exeter-packing"]);
    expect([...split.confirmedActiveIds]).toEqual(["bodmin-packing"]);
  });

  it("treats RLS-hidden mapped units as preserved rather than deleting them", () => {
    const split = splitApplicabilitySelection(
      new Set(["hidden-bodmin-packing"]),
      [{ id: "exeter-packing" }],
      new Map([["exeter-packing", "active"]]),
    );

    expect(split.preservedIds).toEqual(["hidden-bodmin-packing"]);
    expect(split.staleInactiveIds).toEqual([]);
    expect([...split.confirmedActiveIds]).toEqual([]);
  });

  it("describes stale inactive mappings that Save will drop", () => {
    expect(formatStaleApplicabilityWarning(0)).toBeNull();
    expect(formatStaleApplicabilityWarning(1)).toBe(
      "1 previously applicable area is inactive and will be removed when you save.",
    );
    expect(formatStaleApplicabilityWarning(2)).toBe(
      "2 previously applicable areas are inactive and will be removed when you save.",
    );
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

  it("treats a successful empty applicability query as empty, not all units", () => {
    expect(requireApplicableUnitIds(null, [])).toEqual(new Set());
    expect(requireApplicableUnitIds(undefined, null)).toEqual(new Set());
  });

  it("fails closed when applicability rows cannot be loaded", () => {
    expect(() =>
      requireApplicableUnitIds({ message: "JWT expired" }, [
        { unit_id: "exeter-packing" },
      ]),
    ).toThrow("Failed to load 5S applicability: JWT expired");
  });

  it("distinguishes a missing 5S standard from a lookup failure", () => {
    expect(interpretFiveSStandardLookup(null, null)).toBe("not_five_s");
    expect(interpretFiveSStandardLookup(null, { id: "standard-1" })).toBe(
      "five_s",
    );
    expect(() =>
      interpretFiveSStandardLookup({ message: "connection reset" }, null),
    ).toThrow("Failed to load 5S standard: connection reset");
  });

  it("does not convert a query failure into empty domain state", () => {
    expect(() =>
      requireQuerySuccess(
        { message: "timeout" },
        null,
        "Failed to load 5S standard",
      ),
    ).toThrow("Failed to load 5S standard: timeout");
    expect(requireQuerySuccess(null, { id: "standard-1" }, "unused")).toEqual({
      id: "standard-1",
    });
  });
});
