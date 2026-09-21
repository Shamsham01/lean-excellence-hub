import { describe, expect, it } from "vitest";

import {
  resolvePortfolioOpenActionIds,
  withPortfolioSiteScope,
} from "@/lib/projects/site-scope";
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

describe("resolvePortfolioOpenActionIds", () => {
  const bodminProjectId = "11111111-1111-4111-8111-111111111111";
  const exeterProjectId = "22222222-2222-4222-8222-222222222222";
  const bodminActionId = "33333333-3333-4333-8333-333333333333";
  const exeterActionId = "44444444-4444-4444-8444-444444444444";

  const actionContexts = [
    { action_id: bodminActionId, project_id: bodminProjectId },
    { action_id: exeterActionId, project_id: exeterProjectId },
  ];

  it("returns only Bodmin action IDs when Bodmin projects are in scope", () => {
    expect(
      resolvePortfolioOpenActionIds([bodminProjectId], actionContexts),
    ).toEqual([bodminActionId]);
  });

  it("returns only Exeter action IDs when Exeter projects are in scope", () => {
    expect(
      resolvePortfolioOpenActionIds([exeterProjectId], actionContexts),
    ).toEqual([exeterActionId]);
  });

  it("returns an empty list when the scoped portfolio has no projects", () => {
    expect(resolvePortfolioOpenActionIds([], actionContexts)).toEqual([]);
  });

  it("deduplicates repeated action IDs for the same scoped project", () => {
    expect(
      resolvePortfolioOpenActionIds(
        [bodminProjectId],
        [
          { action_id: bodminActionId, project_id: bodminProjectId },
          { action_id: bodminActionId, project_id: bodminProjectId },
        ],
      ),
    ).toEqual([bodminActionId]);
  });
});
