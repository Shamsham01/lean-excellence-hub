import { describe, expect, it } from "vitest";

import { filterDelegatableOffersForActiveSite } from "@/modules/organisation/delegatable-offers";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";

const units: FlatOrganisationUnit[] = [
  {
    id: "bodmin",
    code: "bodmin",
    name: "Bodmin Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
  {
    id: "bodmin-ops",
    code: "bodmin-ops",
    name: "Operations",
    unit_type: "department",
    parent_unit_id: "bodmin",
  },
  {
    id: "exeter",
    code: "exeter",
    name: "Exeter Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
  {
    id: "exeter-ops",
    code: "exeter-ops",
    name: "Operations",
    unit_type: "department",
    parent_unit_id: "exeter",
  },
];

const offers: DelegatableAccessOffer[] = [
  {
    role_version_id: "manager-version",
    role_display_name: "Manager",
    role_canonical_name: "manager",
    scope_options: [
      {
        scope_type: "organisation",
        scope_unit_id: null,
        label: "Entire organisation",
      },
      {
        scope_type: "unit_subtree",
        scope_unit_id: "bodmin",
        label: "Bodmin Cookie Factory subtree",
      },
      {
        scope_type: "unit_subtree",
        scope_unit_id: "exeter",
        label: "Exeter Cookie Factory subtree",
      },
    ],
  },
  {
    role_version_id: "exeter-only-version",
    role_display_name: "Exeter Lead",
    role_canonical_name: "exeter-lead",
    scope_options: [
      {
        scope_type: "unit_subtree",
        scope_unit_id: "exeter-ops",
        label: "Exeter Operations subtree",
      },
    ],
  },
];

const allSitesContext: ActiveSiteContext = {
  mode: "all",
  activeSiteId: null,
  locked: false,
  sites: [
    { id: "bodmin", name: "Bodmin Cookie Factory", code: "bodmin" },
    { id: "exeter", name: "Exeter Cookie Factory", code: "exeter" },
  ],
};

const bodminContext: ActiveSiteContext = {
  mode: "site",
  activeSiteId: "bodmin",
  locked: false,
  sites: allSitesContext.sites,
};

describe("filterDelegatableOffersForActiveSite", () => {
  it("returns every offer when the active-site context is not site-locked", () => {
    expect(
      filterDelegatableOffersForActiveSite(offers, units, allSitesContext),
    ).toEqual(offers);
  });

  it("keeps organisation scope and descendant unit scopes for the active site", () => {
    const filtered = filterDelegatableOffersForActiveSite(
      offers,
      units,
      bodminContext,
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.role_canonical_name).toBe("manager");
    expect(
      filtered[0]?.scope_options.map((scope) => scope.scope_unit_id),
    ).toEqual([null, "bodmin"]);
  });

  it("drops offers that have no remaining in-scope options", () => {
    const filtered = filterDelegatableOffersForActiveSite(
      offers,
      units,
      bodminContext,
    );

    expect(
      filtered.some((offer) => offer.role_canonical_name === "exeter-lead"),
    ).toBe(false);
  });
});
