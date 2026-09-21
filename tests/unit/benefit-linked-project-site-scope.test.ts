import { describe, expect, it } from "vitest";

import { filterProjectsForActiveSite } from "@/lib/projects/site-scope";
import {
  resolveActiveSiteContext,
  listAccessibleSites,
} from "@/modules/organisation/site-context";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

const cookieWorksUnits: FlatOrganisationUnit[] = [
  {
    id: "exeter",
    code: "exeter-cookie-factory",
    name: "Exeter Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
  {
    id: "exeter-ops",
    code: "exeter-operations",
    name: "Operations",
    unit_type: "department",
    parent_unit_id: "exeter",
  },
  {
    id: "exeter-packing",
    code: "exeter-packing",
    name: "Packing",
    unit_type: "area",
    parent_unit_id: "exeter-ops",
  },
  {
    id: "bodmin",
    code: "bodmin-cookie-factory",
    name: "Bodmin Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
];

describe("filterProjectsForActiveSite", () => {
  it("includes descendant-unit projects when site_unit_id matches the active site", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      "exeter",
    );

    const projects = [
      {
        id: "packing-project",
        project_number: "PROJ-2026-0001",
        unit_id: "exeter-packing",
        site_unit_id: "exeter",
      },
      {
        id: "site-root-project",
        project_number: "PROJ-2026-0002",
        unit_id: "exeter",
        site_unit_id: "exeter",
      },
      {
        id: "bodmin-project",
        project_number: "PROJ-2026-0099",
        unit_id: "bodmin",
        site_unit_id: "bodmin",
      },
    ];

    const filtered = filterProjectsForActiveSite(
      projects,
      cookieWorksUnits,
      context,
      { requireConcreteSite: true },
    );

    expect(filtered.map((project) => project.project_number)).toEqual([
      "PROJ-2026-0001",
      "PROJ-2026-0002",
    ]);
  });

  it("returns no projects when a concrete site is required but none is selected", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      null,
    );

    const filtered = filterProjectsForActiveSite(
      [
        {
          id: "packing-project",
          unit_id: "exeter-packing",
          site_unit_id: "exeter",
        },
      ],
      cookieWorksUnits,
      context,
      { requireConcreteSite: true },
    );

    expect(filtered).toEqual([]);
  });
});
