import { describe, expect, it } from "vitest";

import { withPortfolioSiteScope } from "@/lib/projects/site-scope";
import {
  listAccessibleSites,
  resolveActiveSiteContext,
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
    id: "exeter",
    code: "exeter-cookie-factory",
    name: "Exeter Cookie Factory",
    unit_type: "plant",
    parent_unit_id: null,
  },
];

describe("withPortfolioSiteScope", () => {
  const baseArgs = {
    target_search: null,
    target_status: null,
    target_page: 1,
    target_page_size: 25,
  };

  it("adds target_site_unit_id when a concrete site is active", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      "bodmin",
    );

    expect(withPortfolioSiteScope(baseArgs, context)).toEqual({
      ...baseArgs,
      target_site_unit_id: "bodmin",
    });
  });

  it("omits target_site_unit_id for all-sites mode", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      null,
    );

    expect(withPortfolioSiteScope(baseArgs, context)).toEqual(baseArgs);
    expect(withPortfolioSiteScope(baseArgs, context)).not.toHaveProperty(
      "target_site_unit_id",
    );
  });

  it("omits target_site_unit_id for legacy single-site-less mode", () => {
    const context = resolveActiveSiteContext([], null);

    expect(withPortfolioSiteScope(baseArgs, context)).toEqual(baseArgs);
    expect(withPortfolioSiteScope(baseArgs, context)).not.toHaveProperty(
      "target_site_unit_id",
    );
  });

  it("scopes metrics queries the same way as the paged list", () => {
    const context = resolveActiveSiteContext(
      listAccessibleSites(cookieWorksUnits),
      "exeter",
    );
    const metricsArgs = { target_page: 1, target_page_size: 500 };

    expect(withPortfolioSiteScope(metricsArgs, context)).toEqual({
      ...metricsArgs,
      target_site_unit_id: "exeter",
    });
  });
});
