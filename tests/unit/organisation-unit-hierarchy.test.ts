import { describe, expect, it } from "vitest";

import {
  buildOrganisationUnitTree,
  formatUnitPath,
} from "@/modules/organisation/unit-hierarchy";

describe("organisation unit hierarchy", () => {
  it("builds a nested tree with sorted siblings", () => {
    const tree = buildOrganisationUnitTree([
      {
        id: "site",
        code: "site-1",
        name: "Demo Manufacturing Site",
        unit_type: "site",
        parent_unit_id: null,
      },
      {
        id: "packing",
        code: "packing",
        name: "Packing",
        unit_type: "department",
        parent_unit_id: "site",
      },
      {
        id: "line-2",
        code: "line-2",
        name: "Line 2",
        unit_type: "line",
        parent_unit_id: "packing",
      },
      {
        id: "line-1",
        code: "line-1",
        name: "Line 1",
        unit_type: "line",
        parent_unit_id: "packing",
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.children.map((node) => node.name)).toEqual([
      "Line 1",
      "Line 2",
    ]);
  });

  it("keeps duplicate child names distinguishable by parent path", () => {
    const units = [
      {
        id: "packing",
        code: "packing",
        name: "Packing",
        unit_type: "department",
        parent_unit_id: "site",
      },
      {
        id: "site",
        code: "site-1",
        name: "Demo Manufacturing Site",
        unit_type: "site",
        parent_unit_id: null,
      },
      {
        id: "line-a",
        code: "line-1",
        name: "Line 1",
        unit_type: "line",
        parent_unit_id: "packing",
      },
      {
        id: "production",
        code: "production",
        name: "Production",
        unit_type: "department",
        parent_unit_id: "site",
      },
      {
        id: "line-b",
        code: "line-1b",
        name: "Line 1",
        unit_type: "line",
        parent_unit_id: "production",
      },
    ];

    expect(formatUnitPath("line-a", units)).toBe(
      "Demo Manufacturing Site › Packing › Line 1",
    );
    expect(formatUnitPath("line-b", units)).toBe(
      "Demo Manufacturing Site › Production › Line 1",
    );
  });
});
