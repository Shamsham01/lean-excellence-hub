/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  decideWorkplaceAccess,
  presentCatalogRead,
} from "@/modules/workplace/access-decision";

describe("decideWorkplaceAccess", () => {
  it("opens the module workspace for an explicit read grant", () => {
    expect(
      decideWorkplaceAccess({
        hasExplicitModuleRead: true,
        hasWorkplaceView: true,
        hasBaselineParticipation: true,
      }),
    ).toBe("module");
    expect(
      decideWorkplaceAccess({
        hasExplicitModuleRead: true,
        hasWorkplaceView: false,
        hasBaselineParticipation: false,
      }),
    ).toBe("module");
  });

  it("opens the safe projection for Workplace Viewer without an explicit grant", () => {
    expect(
      decideWorkplaceAccess({
        hasExplicitModuleRead: false,
        hasWorkplaceView: true,
        hasBaselineParticipation: true,
      }),
    ).toBe("workplace");
  });

  it("keeps self-scoped modules open from baseline when Workplace Viewer is absent", () => {
    expect(
      decideWorkplaceAccess({
        hasExplicitModuleRead: false,
        hasWorkplaceView: false,
        hasBaselineParticipation: true,
        baselineOpensModule: true,
      }),
    ).toBe("module");
  });

  it("does not let Workplace Viewer replace an explicit grant, and does not let baseline replace Workplace Viewer", () => {
    expect(
      decideWorkplaceAccess({
        hasExplicitModuleRead: false,
        hasWorkplaceView: true,
        hasBaselineParticipation: true,
        baselineOpensModule: true,
      }),
    ).toBe("workplace");
  });

  it("limits baseline catalogue participation and denies members with no access", () => {
    expect(
      decideWorkplaceAccess({
        hasExplicitModuleRead: false,
        hasWorkplaceView: false,
        hasBaselineParticipation: true,
      }),
    ).toBe("restricted");
    expect(
      decideWorkplaceAccess({
        hasExplicitModuleRead: false,
        hasWorkplaceView: false,
        hasBaselineParticipation: false,
      }),
    ).toBe("denied");
  });
});

describe("presentCatalogRead", () => {
  it("separates a failed read from an authorised empty catalogue", () => {
    expect(presentCatalogRead({ failed: true, visibleCount: 0 })).toBe(
      "failed",
    );
    expect(presentCatalogRead({ failed: false, visibleCount: 0 })).toBe(
      "empty",
    );
    expect(presentCatalogRead({ failed: false, visibleCount: 2 })).toBe(
      "ready",
    );
  });
});

describe("workplace routing source contract", () => {
  const access = readFileSync("src/modules/workplace/access.tsx", "utf8");
  const fiveS = readFileSync("src/app/(platform)/platform/5s/page.tsx", "utf8");
  const gemba = readFileSync(
    "src/app/(platform)/platform/gemba/page.tsx",
    "utf8",
  );

  it("routes module read through the grant probe and keeps baseline as a separate fact", () => {
    expect(access).toContain(
      "currentMemberHasGrantPermission(input.readPermission)",
    );
    expect(access).toContain("hasExplicitModuleRead");
    expect(access).toContain("hasParticipationProbe && !hasExplicitModuleRead");
    expect(access).toContain("decideWorkplaceAccess");
  });

  it("does not treat a zero 5S or Gemba count as proof that nothing exists", () => {
    expect(fiveS.indexOf("presentCatalogRead")).toBeLessThan(
      fiveS.indexOf("No 5S standards yet"),
    );
    expect(fiveS).toContain("No 5S standards are available with your access");
    expect(fiveS).toContain("WorkplaceSharedRecords");
    expect(gemba.indexOf("presentCatalogRead")).toBeLessThan(
      gemba.indexOf("No Gemba definitions yet"),
    );
    expect(gemba).toContain(
      "No Gemba definitions are available with your access",
    );
  });
});
