import { describe, expect, it } from "vitest";

import { formatApplicableUnitsCompactSummary } from "@/modules/organisation/applicability-summary";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

const units: FlatOrganisationUnit[] = [
  { id: "a", code: "a", name: "Line 1", parent_unit_id: "site" },
  { id: "b", code: "b", name: "Line 2", parent_unit_id: "site" },
  { id: "c", code: "c", name: "Line 3", parent_unit_id: "site" },
  { id: "d", code: "d", name: "Line 4", parent_unit_id: "site" },
];

describe("formatApplicableUnitsCompactSummary", () => {
  it("summarises selected units with overflow", () => {
    expect(
      formatApplicableUnitsCompactSummary(new Set(["a", "b", "c", "d"]), units),
    ).toBe("Line 1, Line 2 +2 more");
  });

  it("returns empty label when nothing is selected", () => {
    expect(formatApplicableUnitsCompactSummary(new Set(), units)).toBe(
      "No locations selected",
    );
  });
});
