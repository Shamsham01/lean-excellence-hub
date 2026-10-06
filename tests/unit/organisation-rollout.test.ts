import { describe, expect, it } from "vitest";

import {
  identicalNameGuidance,
  namesLookAccidentalDuplicate,
  parseMultiSiteIntent,
  resolveMultiSiteIntent,
  rolloutStateLabel,
} from "@/modules/organisation-rollout/multi-site-intent";
import {
  buildOrganisationGovernanceSnapshot,
  siteLeadershipState,
} from "@/modules/organisation-rollout/governance";
import {
  PROVEN_VERTICAL_SLICE_DOMAIN,
  taxonomyFollowUps,
} from "@/modules/organisation-rollout/taxonomy";
import {
  customerAccessScopeLabel,
  preferredSiteScopeKey,
} from "@/modules/rbac2/access-scope";
import { rolloutGrantScopeError } from "@/modules/organisation-rollout/rollout-grant";

describe("multi-site intent", () => {
  it("treats missing legacy values as not sure", () => {
    expect(resolveMultiSiteIntent(null)).toBe("not_sure");
    expect(resolveMultiSiteIntent(undefined)).toBe("not_sure");
    expect(parseMultiSiteIntent("YES")).toBe("yes");
    expect(parseMultiSiteIntent("maybe")).toBeNull();
  });

  it("warns when organisation and site names match after a wider-group answer", () => {
    expect(
      namesLookAccidentalDuplicate(
        "Plymouth Factory",
        "Plymouth Factory",
        "yes",
      ),
    ).toBe(true);
    expect(
      namesLookAccidentalDuplicate(
        "Plymouth Factory",
        "Plymouth Factory",
        "no",
      ),
    ).toBe(false);
    expect(
      identicalNameGuidance("Plymouth Factory", "Plymouth Factory"),
    ).toMatch(/Acme Foods Ltd/);
  });

  it("does not use intent as a security or billing signal in rollout labels", () => {
    expect(rolloutStateLabel("yes", 1)).toBe(
      "Single-site pilot in a wider organisation",
    );
    expect(rolloutStateLabel("not_sure", 2)).toBe("Multi-site organisation");
  });
});

describe("rollout governance", () => {
  it("marks only active sites as consuming capacity", () => {
    const snapshot = buildOrganisationGovernanceSnapshot({
      organisationName: "Acme Foods Ltd",
      organisationCode: "acme",
      multiSiteIntent: "yes",
      units: [
        {
          id: "plymouth",
          name: "Plymouth Factory",
          unit_type: "site",
          parent_unit_id: null,
          status: "active",
        },
        {
          id: "bristol",
          name: "Bristol Factory",
          unit_type: "site",
          parent_unit_id: null,
          status: "retired",
        },
        {
          id: "ops",
          name: "Operations",
          unit_type: "department",
          parent_unit_id: "plymouth",
          status: "active",
        },
      ],
      grants: [
        {
          scope_type: "unit_subtree",
          scope_unit_id: "plymouth",
          status: "active",
        },
      ],
      childCountBySiteId: new Map([["plymouth", 1]]),
      assessmentCountBySiteId: new Map([["plymouth", 1]]),
      siteCapacity: {
        activeSiteCount: 1,
        subscribedLimit: 2,
        remainingSlots: 1,
        enforced: true,
        canManageBilling: true,
      },
      canManageHierarchy: true,
      canManageBilling: true,
      canDelegateRoles: true,
      canInvite: true,
    });

    expect(snapshot.activeSiteCount).toBe(1);
    expect(snapshot.rolloutStateLabel).toBe(
      "Single-site pilot in a wider organisation",
    );
    expect(snapshot.sites).toHaveLength(2);
    expect(snapshot.sites[0]?.consumesCapacity).toBe(true);
    expect(snapshot.sites[0]?.leadership).toBe("assigned");
    expect(snapshot.sites[1]?.consumesCapacity).toBe(false);
    expect(snapshot.ownerTransferAvailable).toBe(false);
  });

  it("does not invent local leadership when grants cannot be assessed", () => {
    expect(siteLeadershipState("plymouth", null)).toBe("unknown");
  });
});

describe("access scope customer labels", () => {
  it("distinguishes organisation-wide from specific site without database vocabulary", () => {
    expect(
      customerAccessScopeLabel({
        scope_type: "organisation",
        scope_unit_id: null,
        label: "Entire organisation",
      }),
    ).toBe("Entire organisation");
    expect(
      customerAccessScopeLabel({
        scope_type: "unit_subtree",
        scope_unit_id: "bristol",
        label: "Bristol Factory subtree",
      }),
    ).toBe("Specific site: Bristol Factory");
    expect(
      preferredSiteScopeKey(
        [
          {
            scope_type: "organisation",
            scope_unit_id: null,
            label: "Entire organisation",
          },
          {
            scope_type: "unit_subtree",
            scope_unit_id: "bristol",
            label: "Bristol Factory subtree",
          },
        ],
        "bristol",
      ),
    ).toBe("unit_subtree::bristol");
  });
});

describe("shared standard taxonomy", () => {
  it("proves Maturity as the vertical slice and flags follow-ups instead of silent broadening", () => {
    expect(PROVEN_VERTICAL_SLICE_DOMAIN).toBe("Maturity");
    expect(taxonomyFollowUps().length).toBeGreaterThan(0);
    expect(
      taxonomyFollowUps().every((row) => typeof row.followUp === "string"),
    ).toBe(true);
  });
});

describe("rollout site grant scope", () => {
  it("accepts only the site being rolled out", () => {
    expect(
      rolloutGrantScopeError({
        siteId: "bristol",
        scopeType: "unit_subtree",
        scopeUnitId: "bristol",
      }),
    ).toBeNull();
    expect(
      rolloutGrantScopeError({
        siteId: "bristol",
        scopeType: "organisation",
        scopeUnitId: null,
      }),
    ).toMatch(/this site only/i);
    expect(
      rolloutGrantScopeError({
        siteId: "bristol",
        scopeType: "unit_subtree",
        scopeUnitId: "plymouth",
      }),
    ).toMatch(/site you are rolling out/i);
  });
});
