import { describe, expect, it } from "vitest";

import {
  ALL_SITES_COOKIE_VALUE,
  filterPeopleForActiveSite,
  filterUnitsForActiveSite,
  formatPersonOptionLabel,
  isLikelyOpaqueId,
  listAccessibleSites,
  mergeSelectablePeople,
  nextSelectorValue,
  requireSelectableMemberships,
  resolveActiveSiteContext,
  resolvePersonDisplayName,
  resolveSelectorValue,
} from "@/modules/organisation/site-context";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

const cookieWorksUnits: FlatOrganisationUnit[] = [
  {
    id: "bodmin",
    code: "bodmin-cookie-factory",
    name: "Bodmin Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
  {
    id: "bodmin-ops",
    code: "operations",
    name: "Operations",
    unit_type: "department",
    parent_unit_id: "bodmin",
  },
  {
    id: "bodmin-packing",
    code: "packing",
    name: "Packing",
    unit_type: "area",
    parent_unit_id: "bodmin-ops",
  },
  {
    id: "bodmin-baking",
    code: "baking",
    name: "Baking",
    unit_type: "area",
    parent_unit_id: "bodmin-ops",
  },
  {
    id: "bodmin-quality",
    code: "quality",
    name: "Quality",
    unit_type: "department",
    parent_unit_id: "bodmin",
  },
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
    id: "exeter-baking",
    code: "exeter-baking",
    name: "Baking",
    unit_type: "area",
    parent_unit_id: "exeter-ops",
  },
  {
    id: "exeter-quality",
    code: "exeter-quality",
    name: "Quality",
    unit_type: "department",
    parent_unit_id: "exeter",
  },
];

function names(units: FlatOrganisationUnit[]) {
  return units.map((unit) => unit.name);
}

describe("active site context", () => {
  it("lists semantic site units from the existing hierarchy", () => {
    const sites = listAccessibleSites(cookieWorksUnits);
    expect(sites.map((site) => site.name)).toEqual([
      "Bodmin Cookie Factory",
      "Exeter Cookie Factory",
    ]);
  });

  it("locks a scoped user to their only accessible site even if another site id is requested", () => {
    const bodminOnly = cookieWorksUnits.filter((unit) =>
      unit.id.startsWith("bodmin"),
    );
    const context = resolveActiveSiteContext(
      listAccessibleSites(bodminOnly),
      "exeter",
    );

    expect(context.mode).toBe("site");
    expect(context.activeSiteId).toBe("bodmin");
    expect(context.locked).toBe(true);
  });

  it("ignores a forged multi-site cookie that is not in the accessible set", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      "00000000-0000-4000-8000-000000000099",
    );

    expect(context.mode).toBe("all");
    expect(context.activeSiteId).toBeNull();
  });

  it("returns only Bodmin units for organisation admin with Bodmin active", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      "bodmin",
    );
    const units = filterUnitsForActiveSite(cookieWorksUnits, context, {
      requireConcreteSite: true,
    });

    expect(names(units)).toEqual([
      "Bodmin Cookie Factory",
      "Operations",
      "Packing",
      "Baking",
      "Quality",
    ]);
    expect(units.some((unit) => unit.id.startsWith("exeter"))).toBe(false);
    expect(units.filter((unit) => unit.name === "Packing")).toHaveLength(1);
    expect(units.find((unit) => unit.name === "Packing")?.id).toBe(
      "bodmin-packing",
    );
  });

  it("returns only Exeter units after switching active site", () => {
    const bodminContext = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      "bodmin",
    );
    const exeterContext = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      "exeter",
    );

    const afterSwitch = filterUnitsForActiveSite(
      cookieWorksUnits,
      exeterContext,
      { requireConcreteSite: true },
    );
    const beforeSwitch = filterUnitsForActiveSite(
      cookieWorksUnits,
      bodminContext,
      { requireConcreteSite: true },
    );

    expect(beforeSwitch.find((unit) => unit.name === "Packing")?.id).toBe(
      "bodmin-packing",
    );
    expect(afterSwitch.find((unit) => unit.name === "Packing")?.id).toBe(
      "exeter-packing",
    );
    expect(afterSwitch.some((unit) => unit.id.startsWith("bodmin"))).toBe(
      false,
    );
    expect(afterSwitch.filter((unit) => unit.name === "Packing")).toHaveLength(
      1,
    );
    expect(afterSwitch.filter((unit) => unit.name === "Baking")).toHaveLength(
      1,
    );
    expect(afterSwitch.filter((unit) => unit.name === "Quality")).toHaveLength(
      1,
    );
  });

  it("does not mix sites when a creation form requires a concrete site", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      ALL_SITES_COOKIE_VALUE,
    );
    expect(
      filterUnitsForActiveSite(cookieWorksUnits, context, {
        requireConcreteSite: true,
      }),
    ).toEqual([]);
  });

  it("cannot obtain another site's units from client-only site state", () => {
    const bodminVisibleUnits = cookieWorksUnits.filter((unit) =>
      unit.id.startsWith("bodmin"),
    );
    const context = resolveActiveSiteContext(
      listAccessibleSites(bodminVisibleUnits),
      "exeter",
    );
    const units = filterUnitsForActiveSite(bodminVisibleUnits, context, {
      requireConcreteSite: true,
    });

    expect(units.some((unit) => unit.id.startsWith("exeter"))).toBe(false);
    expect(units.map((unit) => unit.id)).toEqual(
      expect.arrayContaining(["bodmin", "bodmin-packing"]),
    );
  });
});

describe("human-readable people selector data", () => {
  const people = mergeSelectablePeople({
    memberships: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        display_name: null,
        job_title: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        display_name: "22222222",
        job_title: null,
      },
    ],
    directoryPeople: [
      {
        membership_id: "11111111-1111-4111-8111-111111111111",
        display_name: "CookieWorks Finance",
        job_function_name: null,
      },
    ],
    assignments: [
      {
        membership_id: "22222222-2222-4222-8222-222222222222",
        job_function_name_snapshot: "Team Leader",
        organisational_unit_id: "bodmin-ops",
      },
    ],
    units: cookieWorksUnits,
  });

  it("prefers directory display names and never uses raw membership ids as labels", () => {
    const finance = people.find(
      (person) => person.id === "11111111-1111-4111-8111-111111111111",
    );
    const teamLeader = people.find(
      (person) => person.id === "22222222-2222-4222-8222-222222222222",
    );

    expect(finance?.displayName).toBe("CookieWorks Finance");
    expect(isLikelyOpaqueId(finance?.displayName)).toBe(false);
    expect(formatPersonOptionLabel(finance!)).not.toMatch(
      /11111111-1111-4111-8111-111111111111/,
    );
    expect(teamLeader?.displayName).toBe("Team Leader");
    expect(formatPersonOptionLabel(teamLeader!)).toBe(
      "Team Leader (Operations)",
    );
  });

  it("keeps organisation-level people visible and hides out-of-site placements", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      "bodmin",
    );
    const visibleUnits = filterUnitsForActiveSite(cookieWorksUnits, context, {
      requireConcreteSite: true,
    });
    const visiblePeople = filterPeopleForActiveSite(
      people,
      context,
      new Set(visibleUnits.map((unit) => unit.id)),
      { requireConcreteSite: true },
    );

    expect(visiblePeople.map((person) => person.displayName)).toEqual([
      "CookieWorks Finance",
      "Team Leader",
    ]);
  });

  it("does not treat opaque ids as display names", () => {
    expect(
      resolvePersonDisplayName("11111111-1111-4111-8111-111111111111"),
    ).toBe("Colleague");
    expect(resolvePersonDisplayName("abcdef12", "Jane Operator")).toBe(
      "Jane Operator",
    );
  });

  it("does not emit a directory-only membership as a selectable candidate", () => {
    const merged = mergeSelectablePeople({
      memberships: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          display_name: null,
          job_title: null,
        },
      ],
      directoryPeople: [
        {
          membership_id: "11111111-1111-4111-8111-111111111111",
          display_name: "CookieWorks Finance",
        },
        {
          membership_id: "99999999-9999-4999-8999-999999999999",
          display_name: "Directory Only Person",
        },
      ],
      assignments: [
        {
          membership_id: "99999999-9999-4999-8999-999999999999",
          job_function_name_snapshot: "Hidden Role",
          organisational_unit_id: "exeter-ops",
        },
      ],
      units: cookieWorksUnits,
    });

    expect(merged.map((person) => person.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(
      merged.some(
        (person) => person.id === "99999999-9999-4999-8999-999999999999",
      ),
    ).toBe(false);
    expect(merged[0]?.displayName).toBe("CookieWorks Finance");
  });

  it("fails closed when the memberships query errors instead of falling back to directory rows", () => {
    expect(() =>
      requireSelectableMemberships({
        data: null,
        error: { message: "permission denied" },
      }),
    ).toThrow("Unable to load organisation memberships.");

    expect(
      requireSelectableMemberships({
        data: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            display_name: "CookieWorks Finance",
            job_title: null,
          },
        ],
        error: null,
      }),
    ).toHaveLength(1);
  });
});

describe("selector value resolution", () => {
  const units = [
    { id: "bodmin-baking", name: "Baking" },
    { id: "bodmin-packing", name: "Packing" },
  ];

  it("does not auto-select the first of many candidates", () => {
    expect(resolveSelectorValue(units)).toBe("");
    expect(nextSelectorValue({ options: units, value: "" })).toBe("");
  });

  it("auto-selects an exactly-one candidate only when empty", () => {
    expect(resolveSelectorValue([{ id: "bodmin-packing" }])).toBe(
      "bodmin-packing",
    );
  });

  it("keeps a valid preferred or saved value", () => {
    expect(resolveSelectorValue(units, "bodmin-packing")).toBe(
      "bodmin-packing",
    );
  });

  it("clears a missing saved value instead of substituting another record", () => {
    expect(resolveSelectorValue(units, "exeter-packing")).toBe("");
    expect(
      nextSelectorValue({
        options: [{ id: "bodmin-packing" }],
        value: "exeter-packing",
      }),
    ).toBe("");
  });
});
