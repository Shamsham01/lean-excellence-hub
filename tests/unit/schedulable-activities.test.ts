import { describe, expect, it } from "vitest";

import {
  buildSchedulableFiveSOptions,
  buildSchedulableGembaOptions,
  mergeSchedulableActivityOptions,
} from "@/lib/schedule/schedulable-activities";
import {
  buildSiteScopedUnitOptions,
  filterUnitsForActiveSite,
} from "@/modules/organisation/site-context";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";

const units: FlatOrganisationUnit[] = [
  {
    id: "bodmin",
    code: "bodmin-cookie-factory",
    name: "Bodmin Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
  {
    id: "bodmin-packing",
    code: "packing",
    name: "Packing",
    unit_type: "area",
    parent_unit_id: "bodmin",
  },
];

const context: ActiveSiteContext = {
  mode: "site",
  activeSiteId: "bodmin",
  locked: false,
  sites: [
    {
      id: "bodmin",
      name: "Bodmin Cookie Factory",
      code: "bodmin-cookie-factory",
    },
  ],
};

const configurationUnits = buildSiteScopedUnitOptions(units, context, {
  requireConcreteSite: true,
});
const hierarchyUnits = filterUnitsForActiveSite(units, context, {
  requireConcreteSite: true,
});

const unitStatusById = new Map([
  ["bodmin-packing", "active"],
  ["bodmin", "active"],
]);

describe("schedulable activities", () => {
  it("includes published 5S standards with active applicable units", () => {
    const options = buildSchedulableFiveSOptions(
      [{ id: "std-1", display_name: "Weekly 5S" }],
      new Set(["std-1"]),
      new Map([["std-1", ["bodmin-packing"]]]),
      unitStatusById,
      configurationUnits,
      hierarchyUnits,
    );

    expect(options).toEqual([
      {
        kind: "five_s",
        id: "std-1",
        displayName: "Weekly 5S",
        applicabilitySummary: "Packing",
      },
    ]);
  });

  it("omits draft-only 5S standards", () => {
    const options = buildSchedulableFiveSOptions(
      [{ id: "std-draft", display_name: "Draft 5S" }],
      new Set(),
      new Map([["std-draft", ["bodmin-packing"]]]),
      unitStatusById,
      configurationUnits,
      hierarchyUnits,
    );

    expect(options).toEqual([]);
  });

  it("omits published standards without active site applicability", () => {
    const options = buildSchedulableFiveSOptions(
      [{ id: "std-1", display_name: "Other site" }],
      new Set(["std-1"]),
      new Map([["std-1", ["hidden-unit"]]]),
      unitStatusById,
      configurationUnits,
      hierarchyUnits,
    );

    expect(options).toEqual([]);
  });

  it("includes published Gemba definitions and merges sorted by name", () => {
    const gemba = buildSchedulableGembaOptions(
      [{ id: "def-1", display_name: "Morning walk" }],
      new Set(["def-1"]),
      new Map([["def-1", ["bodmin-packing"]]]),
      unitStatusById,
      configurationUnits,
      hierarchyUnits,
    );
    const fiveS = buildSchedulableFiveSOptions(
      [{ id: "std-1", display_name: "Weekly 5S" }],
      new Set(["std-1"]),
      new Map([["std-1", ["bodmin-packing"]]]),
      unitStatusById,
      configurationUnits,
      hierarchyUnits,
    );

    const merged = mergeSchedulableActivityOptions(fiveS, gemba);
    expect(merged.map((row) => row.displayName)).toEqual([
      "Morning walk",
      "Weekly 5S",
    ]);
  });
});
